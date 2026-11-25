[CmdletBinding()]
param(
  [string]$Tool,
  [string[]]$ToolArguments = @(),
  [switch]$SelfTest,
  [switch]$SealManifest,
  [switch]$VerifyManifest
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repo = (Resolve-Path -LiteralPath (Join-Path $root '..\..\..')).Path
$process = [System.Diagnostics.Process]::GetCurrentProcess()
$processPath = $process.Path
$fileVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($processPath)
$parentId = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
$parent = Get-Process -Id $parentId
$created = $process.StartTime.ToUniversalTime().ToFileTimeUtc()

if ($PSVersionTable.PSVersion.ToString() -ne '7.6.9') {
  throw 'PowerShell version mismatch'
}
if ($PSVersionTable.PSEdition -ne 'Core') {
  throw 'PowerShell edition mismatch'
}
if ([IO.Path]::GetFileName($processPath).ToLowerInvariant() -ne 'pwsh.exe') {
  throw 'Actual process is not pwsh.exe'
}
if ($fileVersion.FileVersion -ne '7.6.9.500') {
  throw 'PowerShell file version mismatch'
}
if ($parent.ProcessName -notin @('codex', 'pwsh')) {
  throw 'Parent process is not an approved launcher'
}
if ((Get-Location).Path -ne $repo) {
  throw 'Working directory mismatch'
}

$manifestPath = Join-Path $root 'SHA256SUMS_R5.txt'
$rootPrefix = [IO.Path]::GetFullPath($root).TrimEnd('\') + '\'

function Get-R5Files {
  Get-ChildItem -LiteralPath $root -Recurse -File |
    Where-Object { $_.FullName -ne $manifestPath } |
    Sort-Object FullName
}

function Get-R5Record([System.IO.FileInfo]$File) {
  $full = [IO.Path]::GetFullPath($File.FullName)
  if (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "R5 file escapes root: $full"
  }
  $relative = [IO.Path]::GetRelativePath($root, $full).Replace('\', '/')
  $hash = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
  $lines = @(Get-Content -LiteralPath $full).Count
  "$hash $($File.Length) $lines $relative"
}

if ($SealManifest) {
  $records = @(Get-R5Files | ForEach-Object { Get-R5Record $_ })
  $encoding = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllLines($manifestPath, $records, $encoding)
  Write-Output "R5_MANIFEST_RECORDS=$($records.Count)"
  Write-Output "R5_MANIFEST_BYTES=$((Get-Item -LiteralPath $manifestPath).Length)"
  Write-Output "R5_MANIFEST_SHA256=$((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash)"
  Write-Output 'R5_MANIFEST_SEAL=PASS'
  exit 0
}

if ($VerifyManifest) {
  $paths = [System.Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
  )
  $errors = [System.Collections.Generic.List[string]]::new()
  $records = 0
  foreach ($line in Get-Content -LiteralPath $manifestPath) {
    if ($line -notmatch '^([0-9A-Fa-f]{64})\s+(\d+)\s+(\d+)\s+(.+)$') {
      $errors.Add('malformed-record')
      continue
    }
    $records++
    $expectedHash = $Matches[1].ToUpperInvariant()
    $expectedBytes = [long]$Matches[2]
    $expectedLines = [int]$Matches[3]
    $relative = $Matches[4].Trim()
    if (-not $paths.Add($relative)) {
      $errors.Add("duplicate:$relative")
      continue
    }
    $full = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      $errors.Add("escape:$relative")
      continue
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $errors.Add("missing:$relative")
      continue
    }
    if ((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash -ne $expectedHash) {
      $errors.Add("hash:$relative")
    }
    if ((Get-Item -LiteralPath $full).Length -ne $expectedBytes) {
      $errors.Add("bytes:$relative")
    }
    if (@(Get-Content -LiteralPath $full).Count -ne $expectedLines) {
      $errors.Add("lines:$relative")
    }
  }
  $actual = @(Get-R5Files | ForEach-Object {
    [IO.Path]::GetRelativePath($root, $_.FullName).Replace('\', '/')
  })
  foreach ($relative in $actual) {
    if (-not $paths.Contains($relative)) { $errors.Add("uncovered:$relative") }
  }
  foreach ($relative in $paths) {
    if ($relative -notin $actual) { $errors.Add("extra:$relative") }
  }
  Write-Output "R5_MANIFEST_RECORDS=$records"
  Write-Output "R5_ACTUAL_FILES_EXCLUDING_MANIFEST=$($actual.Count)"
  Write-Output "R5_MANIFEST_ERRORS=$($errors.Count)"
  Write-Output "R5_MANIFEST_SHA256=$((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash)"
  if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Output $_ }
    Write-Output 'R5_MANIFEST_VERIFY=FAIL'
    exit 1
  }
  Write-Output 'R5_MANIFEST_VERIFY=PASS'
  exit 0
}

$evidenceDir = Join-Path $root 'evidence'
if (-not (Test-Path -LiteralPath $evidenceDir -PathType Container)) {
  New-Item -ItemType Directory -Path $evidenceDir | Out-Null
}
$evidence = Join-Path $evidenceDir 'EXECUTION_IDENTITY_EVIDENCE_R5.json'
$history = Join-Path $evidenceDir 'EXECUTION_HISTORY_R5.jsonl'
$token = [guid]::NewGuid().ToString('N')
$pythonCandidates = @(
  Get-Command python.exe -CommandType Application -All |
    Where-Object { $_.Source -and [IO.Path]::IsPathRooted($_.Source) } |
    ForEach-Object { [IO.Path]::GetFullPath($_.Source) } |
    Sort-Object -Unique
)
$verifiedPython = @()
foreach ($candidate in $pythonCandidates) {
  try {
    $version = @(& $candidate --version)
    if ($LASTEXITCODE -eq 0 -and ($version -join ' ') -match '^Python 3\.') {
      $verifiedPython += [pscustomobject]@{
        path = $candidate
        version = ($version -join ' ')
      }
    }
  } catch {
    continue
  }
}
if ($verifiedPython.Count -eq 0) {
  throw 'No verified Python 3 interpreter'
}
$python = $verifiedPython[0].path

[pscustomobject]@{
  guard_token = $token
  powershell_version = $PSVersionTable.PSVersion.ToString()
  powershell_edition = $PSVersionTable.PSEdition
  powershell_pid = $PID
  powershell_path = $processPath
  powershell_file_version = $fileVersion.FileVersion
  powershell_creation_100ns = $created
  parent_pid = $parentId
  parent_name = $parent.ProcessName
  parent_path = $parent.Path
  working_directory = (Get-Location).Path
  python_candidates = $pythonCandidates
  verified_python = $verifiedPython
  started_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $evidence -Encoding utf8

if ($SelfTest) {
  Write-Output 'GUARD_SELF_TEST=PASS'
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Tool)) {
  throw 'Tool path is required'
}
$toolPath = (Resolve-Path -LiteralPath $Tool).Path
if (-not $toolPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Tool path escapes R5 directory'
}

$env:PYTHONDONTWRITEBYTECODE = '1'
$env:AIEA_R5_REVIEW_PWSH_PID = "$PID"
$env:AIEA_R5_REVIEW_PWSH_PATH = $processPath
$env:AIEA_R5_REVIEW_PWSH_CREATED = "$created"
$env:AIEA_R5_REVIEW_TOKEN = $token
$env:AIEA_R5_REVIEW_EVIDENCE = $evidence
& $python -B $toolPath @ToolArguments
$exitCode = $LASTEXITCODE
$finishedAt = [DateTime]::UtcNow.ToString('o')

[pscustomobject]@{
  guard_token = $token
  tool = $toolPath
  exit_code = $exitCode
  finished_at_utc = $finishedAt
} | ConvertTo-Json -Compress | Add-Content -LiteralPath $history -Encoding utf8

$record = Get-Content -LiteralPath $evidence -Raw | ConvertFrom-Json
$record | Add-Member -NotePropertyName tool -NotePropertyValue $toolPath -Force
$record | Add-Member -NotePropertyName tool_exit_code -NotePropertyValue $exitCode -Force
$record | Add-Member -NotePropertyName finished_at_utc -NotePropertyValue $finishedAt -Force
$record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $evidence -Encoding utf8

if ($exitCode -ne 0) {
  Write-Output "GUARDED_TOOL_RESULT=FAIL exit_code=$exitCode"
  exit $exitCode
}
Write-Output 'GUARDED_TOOL_RESULT=PASS'

