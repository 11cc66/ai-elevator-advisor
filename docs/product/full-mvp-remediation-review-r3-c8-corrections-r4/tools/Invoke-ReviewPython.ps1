[CmdletBinding()]
param(
  [string]$Tool,
  [string[]]$ToolArguments = @(),
  [switch]$SelfTest,
  [switch]$SealManifest,
  [switch]$VerifyManifest
)

$ErrorActionPreference = 'Stop'
$reviewRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $reviewRoot '..\..\..')).Path
$current = [System.Diagnostics.Process]::GetCurrentProcess()
$currentPath = $current.Path
$fileVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($currentPath)
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
$parent = Get-Process -Id $parentPid
$creation = $current.StartTime.ToUniversalTime().ToFileTimeUtc()

if ($PSVersionTable.PSVersion.ToString() -ne '7.6.9') { throw 'PowerShell version mismatch' }
if ($PSVersionTable.PSEdition -ne 'Core') { throw 'PowerShell edition mismatch' }
if ([IO.Path]::GetFileName($currentPath).ToLowerInvariant() -ne 'pwsh.exe') {
  throw 'Actual executable is not pwsh.exe'
}
if ($fileVersion.FileVersion -ne '7.6.9.500') {
  throw 'PowerShell file version mismatch'
}
if ($parent.ProcessName -notin @('codex', 'pwsh')) {
  throw 'Unapproved parent process'
}
if ((Get-Location).Path -ne $repoRoot) {
  throw 'Working directory mismatch'
}

$manifestName = 'SHA256SUMS_R4_REVIEW.txt'
$manifestPath = Join-Path $reviewRoot $manifestName
$rootPrefix = [IO.Path]::GetFullPath($reviewRoot).TrimEnd('\') + '\'

function Get-ReviewFiles {
  Get-ChildItem -LiteralPath $reviewRoot -Recurse -File |
    Where-Object { $_.FullName -ne $manifestPath } |
    Sort-Object FullName
}

function Get-ReviewRecord([System.IO.FileInfo]$File) {
  $full = [IO.Path]::GetFullPath($File.FullName)
  if (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Review file escapes root: $full"
  }
  $relative = [IO.Path]::GetRelativePath($reviewRoot, $full).Replace('\', '/')
  $hash = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash
  $lines = @(Get-Content -LiteralPath $full).Count
  "$hash $($File.Length) $lines $relative"
}

if ($SealManifest) {
  $records = @(Get-ReviewFiles | ForEach-Object { Get-ReviewRecord $_ })
  $encoding = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllLines($manifestPath, $records, $encoding)
  Write-Output "REVIEW_MANIFEST_RECORDS=$($records.Count)"
  Write-Output "REVIEW_MANIFEST_SHA256=$((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash)"
  Write-Output 'REVIEW_MANIFEST_SEAL=PASS'
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
      $errors.Add('malformed')
      continue
    }
    $records++
    $relative = $Matches[4].Trim()
    if (-not $paths.Add($relative)) {
      $errors.Add("duplicate:$relative")
      continue
    }
    $full = [IO.Path]::GetFullPath((Join-Path $reviewRoot $relative))
    if (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      $errors.Add("escape:$relative")
      continue
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $errors.Add("missing:$relative")
      continue
    }
    if ((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash -ne $Matches[1].ToUpperInvariant()) {
      $errors.Add("hash:$relative")
    }
    if ((Get-Item -LiteralPath $full).Length -ne [long]$Matches[2]) {
      $errors.Add("bytes:$relative")
    }
    if (@(Get-Content -LiteralPath $full).Count -ne [int]$Matches[3]) {
      $errors.Add("lines:$relative")
    }
  }
  $actual = @(Get-ReviewFiles | ForEach-Object {
    [IO.Path]::GetRelativePath($reviewRoot, $_.FullName).Replace('\', '/')
  })
  foreach ($relative in $actual) {
    if (-not $paths.Contains($relative)) { $errors.Add("uncovered:$relative") }
  }
  foreach ($relative in $paths) {
    if ($relative -notin $actual) { $errors.Add("extra:$relative") }
  }
  Write-Output "REVIEW_MANIFEST_RECORDS=$records"
  Write-Output "REVIEW_ACTUAL_FILES_EXCLUDING_MANIFEST=$($actual.Count)"
  Write-Output "REVIEW_MANIFEST_ERRORS=$($errors.Count)"
  Write-Output "REVIEW_MANIFEST_SHA256=$((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash)"
  if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Output $_ }
    Write-Output 'REVIEW_MANIFEST_VERIFY=FAIL'
    exit 1
  }
  Write-Output 'REVIEW_MANIFEST_VERIFY=PASS'
  exit 0
}

$candidates = @(
  Get-Command python.exe -CommandType Application -All |
    Where-Object { $_.Source -and [IO.Path]::IsPathRooted($_.Source) } |
    ForEach-Object { [IO.Path]::GetFullPath($_.Source) } |
    Sort-Object -Unique
)
$verified = @()
foreach ($candidate in $candidates) {
  try {
    $version = @(& $candidate --version)
    if ($LASTEXITCODE -eq 0 -and ($version -join ' ') -match '^Python 3\.') {
      $verified += [pscustomobject]@{
        path = $candidate
        version = ($version -join ' ')
      }
    }
  } catch {
    continue
  }
}
if ($verified.Count -eq 0) { throw 'No verified Python 3 executable' }
$python = $verified[0].path
$evidenceDir = Join-Path $reviewRoot 'evidence'
if (-not (Test-Path -LiteralPath $evidenceDir -PathType Container)) {
  New-Item -ItemType Directory -Path $evidenceDir | Out-Null
}
$evidence = Join-Path $evidenceDir 'EXECUTION_IDENTITY_EVIDENCE_R4_REVIEW.json'
$history = Join-Path $evidenceDir 'EXECUTION_HISTORY_R4_REVIEW.jsonl'
$token = [guid]::NewGuid().ToString('N')

[pscustomobject]@{
  guard_token = $token
  powershell_version = $PSVersionTable.PSVersion.ToString()
  powershell_edition = $PSVersionTable.PSEdition
  powershell_pid = $PID
  powershell_path = $currentPath
  powershell_creation_100ns = $creation
  file_version = $fileVersion.FileVersion
  parent_pid = $parentPid
  parent_name = $parent.ProcessName
  parent_path = $parent.Path
  working_directory = (Get-Location).Path
  python_candidates = $candidates
  verified_python = $verified
  started_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $evidence -Encoding utf8

if ($SelfTest) {
  Write-Output 'GUARD_SELF_TEST=PASS'
  exit 0
}
if ([string]::IsNullOrWhiteSpace($Tool)) { throw 'Tool path is required' }
$toolPath = (Resolve-Path -LiteralPath $Tool).Path
if (-not $toolPath.StartsWith($reviewRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Tool escapes review directory'
}

$env:PYTHONDONTWRITEBYTECODE = '1'
$env:AIEA_R4_REVIEW_PWSH_PID = "$PID"
$env:AIEA_R4_REVIEW_PWSH_PATH = $currentPath
$env:AIEA_R4_REVIEW_PWSH_CREATED = "$creation"
$env:AIEA_R4_REVIEW_TOKEN = $token
$env:AIEA_R4_REVIEW_EVIDENCE = $evidence
& $python -B $toolPath @ToolArguments
$exitCode = $LASTEXITCODE
$finished = [DateTime]::UtcNow.ToString('o')

[pscustomobject]@{
  guard_token = $token
  tool = $toolPath
  exit_code = $exitCode
  finished_at_utc = $finished
} | ConvertTo-Json -Compress | Add-Content -LiteralPath $history -Encoding utf8

$record = Get-Content -LiteralPath $evidence -Raw | ConvertFrom-Json
$record | Add-Member -NotePropertyName tool -NotePropertyValue $toolPath -Force
$record | Add-Member -NotePropertyName tool_exit_code -NotePropertyValue $exitCode -Force
$record | Add-Member -NotePropertyName finished_at_utc -NotePropertyValue $finished -Force
$record | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $evidence -Encoding utf8

if ($exitCode -ne 0) {
  Write-Output "GUARDED_TOOL_RESULT=FAIL exit_code=$exitCode"
  exit $exitCode
}
Write-Output 'GUARDED_TOOL_RESULT=PASS'
