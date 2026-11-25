[CmdletBinding()]
param(
  [string]$Tool,
  [string[]]$ToolArguments = @(),
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..\..\..')).Path
$r2Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$evidenceDir = Join-Path $r2Root 'evidence'
if (-not (Test-Path -LiteralPath $evidenceDir -PathType Container)) {
  New-Item -ItemType Directory -Path $evidenceDir | Out-Null
}

$process = [System.Diagnostics.Process]::GetCurrentProcess()
$processPath = $process.Path
$fileVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($processPath)
$parentProcessId = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
$parentProcess = Get-Process -Id $parentProcessId
$creation = $process.StartTime.ToUniversalTime()
$creation100ns = ($creation.ToFileTimeUtc())
$guardToken = [guid]::NewGuid().ToString('N')
$evidencePath = Join-Path $evidenceDir 'SHELL_GUARD_EVIDENCE_R3_C8_CORRECTIONS_R2.json'
$historyPath = Join-Path $evidenceDir 'SHELL_GUARD_HISTORY_R3_C8_CORRECTIONS_R2.jsonl'

$failures = @()
if ($PSVersionTable.PSVersion.ToString() -ne '7.6.9') {
  $failures += 'PowerShell internal version is not 7.6.9'
}
if ($PSVersionTable.PSEdition -ne 'Core') {
  $failures += 'PowerShell edition is not Core'
}
if ([IO.Path]::GetFileName($processPath).ToLowerInvariant() -ne 'pwsh.exe') {
  $failures += 'Current process image is not pwsh.exe'
}
if ($fileVersion.FileVersion -ne '7.6.9.500') {
  $failures += 'PowerShell file version is not 7.6.9.500'
}
if ($parentProcess.ProcessName -notin @('codex','pwsh')) {
  $failures += 'Parent process is not approved codex/pwsh launcher'
}
if ((Get-Location).Path -ne $repoRoot) {
  $failures += 'Working directory is not repository root'
}

$candidates = @()
foreach ($candidate in @(Get-Command pwsh.exe -CommandType Application -All -ErrorAction SilentlyContinue)) {
  if ($candidate.Source -and [IO.Path]::IsPathRooted($candidate.Source)) {
    $candidates += [IO.Path]::GetFullPath($candidate.Source)
  }
}
$envPaths = @($env:PATH -split [IO.Path]::PathSeparator)
foreach ($dir in $envPaths) {
  if ([string]::IsNullOrWhiteSpace($dir)) { continue }
  $candidate = Join-Path $dir 'pwsh.exe'
  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    $candidates += [IO.Path]::GetFullPath($candidate)
  }
}
$candidates = @($candidates | Sort-Object -Unique)
if ($processPath -notin $candidates) {
  $candidates += $processPath
  $candidates = @($candidates | Sort-Object -Unique)
}

if ($failures.Count -gt 0) {
  [pscustomobject]@{
    guard_token = $guardToken
    verified = $false
    failures = $failures
    powershell_pid = $PID
    powershell_path = $processPath
    file_version = $fileVersion.FileVersion
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $evidencePath -Encoding utf8
  $failures | ForEach-Object { Write-Error $_ }
  Write-Output 'GUARDED_TOOL_RESULT=BLOCKED'
  exit 20
}

[pscustomobject]@{
  guard_token = $guardToken
  verified = $true
  powershell_version = $PSVersionTable.PSVersion.ToString()
  powershell_edition = $PSVersionTable.PSEdition
  powershell_pid = $PID
  powershell_path = $processPath
  powershell_creation_100ns = $creation100ns
  file_version = $fileVersion.FileVersion
  parent_pid = $parentProcessId
  parent_name = $parentProcess.ProcessName
  parent_path = $parentProcess.Path
  working_directory = (Get-Location).Path
  candidates = $candidates
  checked_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $evidencePath -Encoding utf8

$historyRecord = [pscustomobject]@{
  guard_token = $guardToken
  tool = if ($SelfTest) { 'SELF_TEST' } else { $Tool }
  powershell_pid = $PID
  powershell_path = $processPath
  powershell_creation_100ns = $creation100ns
  parent_pid = $parentProcessId
  parent_name = $parentProcess.ProcessName
  started_at_utc = [DateTime]::UtcNow.ToString('o')
}
$historyRecord | ConvertTo-Json -Compress | Add-Content -LiteralPath $historyPath -Encoding utf8

if ($SelfTest) {
  Write-Output 'GUARD_SELF_TEST=PASS'
  exit 0
}
if ([string]::IsNullOrWhiteSpace($Tool)) {
  Write-Error 'Tool path is required unless -SelfTest is used.'
  exit 21
}
$toolPath = (Resolve-Path -LiteralPath $Tool).Path
if (-not $toolPath.StartsWith($r2Root, [StringComparison]::OrdinalIgnoreCase)) {
  Write-Error 'Tool path escapes R2 directory.'
  exit 22
}
$pythonCandidates = @(Get-Command python.exe -CommandType Application -All -ErrorAction Stop |
  Where-Object { $_.Source -and [IO.Path]::IsPathRooted($_.Source) } |
  ForEach-Object { [IO.Path]::GetFullPath($_.Source) } |
  Sort-Object -Unique)
if ($pythonCandidates.Count -eq 0) {
  Write-Error 'No absolute python.exe candidate found.'
  exit 23
}
$verifiedPython = @()
foreach ($candidate in $pythonCandidates) {
  try {
    $versionOutput = @(& $candidate --version)
    if ($LASTEXITCODE -eq 0 -and ($versionOutput -join ' ') -match '^Python 3\.') {
      $verifiedPython += [pscustomobject]@{
        path = $candidate
        version = ($versionOutput -join ' ')
      }
    }
  } catch {
    continue
  }
}
if ($verifiedPython.Count -eq 0) {
  Write-Error 'No executable absolute Python 3 interpreter found.'
  exit 24
}
$pythonRecord = $verifiedPython[0]
$python = $pythonRecord.path
$guardEvidence = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
$guardEvidence | Add-Member -NotePropertyName python_candidates -NotePropertyValue $pythonCandidates -Force
$guardEvidence | Add-Member -NotePropertyName verified_python -NotePropertyValue $verifiedPython -Force
$guardEvidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $evidencePath -Encoding utf8
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:AIEA_R2_PWSH_PID = "$PID"
$env:AIEA_R2_PWSH_CREATED_100NS = "$creation100ns"
$env:AIEA_R2_PWSH_PATH = $processPath
$env:AIEA_R2_GUARD_TOKEN = $guardToken
$env:AIEA_R2_GUARD_EVIDENCE = $evidencePath
& $python -B $toolPath @ToolArguments
$exitCode = $LASTEXITCODE
if ($exitCode -eq 0) {
  Write-Output 'GUARDED_TOOL_RESULT=PASS'
} else {
  Write-Output "GUARDED_TOOL_RESULT=FAIL exit_code=$exitCode"
}
exit $exitCode
