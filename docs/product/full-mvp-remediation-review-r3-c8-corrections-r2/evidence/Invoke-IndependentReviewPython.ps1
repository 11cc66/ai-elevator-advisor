[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Script
)

$ErrorActionPreference = 'Stop'
$reviewRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $reviewRoot '..\..\..')).Path
$process = [System.Diagnostics.Process]::GetCurrentProcess()
$processPath = $process.Path
$versionInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($processPath)
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
$parent = Get-Process -Id $parentPid
$created100ns = $process.StartTime.ToUniversalTime().ToFileTimeUtc()
$token = [guid]::NewGuid().ToString('N')
$evidencePath = Join-Path $PSScriptRoot 'EXECUTION_IDENTITY_EVIDENCE_R3_C8_CORRECTIONS_R2_REVIEW.json'

if ($PSVersionTable.PSVersion.ToString() -ne '7.6.9') { throw 'PowerShell version mismatch' }
if ($PSVersionTable.PSEdition -ne 'Core') { throw 'PowerShell edition mismatch' }
if ([IO.Path]::GetFileName($processPath).ToLowerInvariant() -ne 'pwsh.exe') { throw 'Not pwsh.exe' }
if ($versionInfo.FileVersion -ne '7.6.9.500') { throw 'PowerShell file version mismatch' }
if ($parent.ProcessName -notin @('codex','pwsh')) { throw 'Unapproved parent process' }
if ((Get-Location).Path -ne $repoRoot) { throw 'Working directory mismatch' }

$candidates = @(Get-Command python.exe -CommandType Application -All -ErrorAction Stop |
  Where-Object { $_.Source -and [IO.Path]::IsPathRooted($_.Source) } |
  ForEach-Object { [IO.Path]::GetFullPath($_.Source) } |
  Sort-Object -Unique)
$verified = @()
foreach ($candidate in $candidates) {
  try {
    $version = @(& $candidate --version)
    if ($LASTEXITCODE -eq 0 -and ($version -join ' ') -match '^Python 3\.') {
      $verified += [pscustomobject]@{ path = $candidate; version = ($version -join ' ') }
    }
  } catch {
    continue
  }
}
if ($verified.Count -eq 0) { throw 'No absolute Python 3 interpreter' }
$python = $verified[0].path
$scriptPath = (Resolve-Path -LiteralPath $Script).Path
if (-not $scriptPath.StartsWith($reviewRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Review script path escapes review directory'
}

[pscustomobject]@{
  guard_token = $token
  verified = $true
  powershell_version = $PSVersionTable.PSVersion.ToString()
  powershell_edition = $PSVersionTable.PSEdition
  powershell_pid = $PID
  powershell_path = $processPath
  powershell_creation_100ns = $created100ns
  file_version = $versionInfo.FileVersion
  parent_pid = $parentPid
  parent_name = $parent.ProcessName
  parent_path = $parent.Path
  working_directory = (Get-Location).Path
  python_candidates = $candidates
  verified_python = $verified
  script = $scriptPath
  checked_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $evidencePath -Encoding utf8

$env:PYTHONDONTWRITEBYTECODE = '1'
$env:AIEA_REVIEW_PWSH_PID = "$PID"
$env:AIEA_REVIEW_PWSH_PATH = $processPath
$env:AIEA_REVIEW_PWSH_CREATED_100NS = "$created100ns"
$env:AIEA_REVIEW_GUARD_TOKEN = $token
$env:AIEA_REVIEW_GUARD_EVIDENCE = $evidencePath

& $python -B $scriptPath
exit $LASTEXITCODE
