[CmdletBinding()]
param(
  [string]$Tool,
  [string[]]$ToolArguments = @(),
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$r3 = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repo = (Resolve-Path -LiteralPath (Join-Path $r3 '..\..\..')).Path
$proc = [System.Diagnostics.Process]::GetCurrentProcess()
$procPath = $proc.Path
$vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($procPath)
$parentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
$parent = Get-Process -Id $parentPid
$created = $proc.StartTime.ToUniversalTime().ToFileTimeUtc()
$token = [guid]::NewGuid().ToString('N')
$evidenceDir = Join-Path $r3 'evidence'
if (-not (Test-Path -LiteralPath $evidenceDir -PathType Container)) {
  New-Item -ItemType Directory -Path $evidenceDir | Out-Null
}
$evidencePath = Join-Path $evidenceDir 'EXECUTION_IDENTITY_EVIDENCE_R3.json'
$historyPath = Join-Path $evidenceDir 'EXECUTION_HISTORY_R3.jsonl'

if ($PSVersionTable.PSVersion.ToString() -ne '7.6.9') { throw 'PowerShell version mismatch' }
if ($PSVersionTable.PSEdition -ne 'Core') { throw 'PowerShell edition mismatch' }
if ([IO.Path]::GetFileName($procPath).ToLowerInvariant() -ne 'pwsh.exe') { throw 'Not pwsh.exe' }
if ($vi.FileVersion -ne '7.6.9.500') { throw 'PowerShell file version mismatch' }
if ($parent.ProcessName -notin @('codex','pwsh')) { throw 'Unapproved parent process' }
if ((Get-Location).Path -ne $repo) { throw 'Working directory mismatch' }

$candidates = @(Get-Command python.exe -CommandType Application -All -ErrorAction Stop |
  Where-Object { $_.Source -and [IO.Path]::IsPathRooted($_.Source) } |
  ForEach-Object { [IO.Path]::GetFullPath($_.Source) } |
  Sort-Object -Unique)
$verifiedPython = @()
foreach ($candidate in $candidates) {
  try {
    $v = @(& $candidate --version)
    if ($LASTEXITCODE -eq 0 -and ($v -join ' ') -match '^Python 3\.') {
      $verifiedPython += [pscustomobject]@{ path = $candidate; version = ($v -join ' ') }
    }
  } catch { continue }
}
if ($verifiedPython.Count -eq 0) { throw 'No executable Python 3 interpreter' }
$python = $verifiedPython[0].path

if (-not $SelfTest) {
  $toolPath = (Resolve-Path -LiteralPath $Tool).Path
  if (-not $toolPath.StartsWith($r3, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Tool path escapes R3 directory'
  }
} else {
  $toolPath = 'SELF_TEST'
}

[pscustomobject]@{
  guard_token = $token
  powershell_version = $PSVersionTable.PSVersion.ToString()
  powershell_edition = $PSVersionTable.PSEdition
  powershell_pid = $PID
  powershell_path = $procPath
  powershell_creation_100ns = $created
  file_version = $vi.FileVersion
  parent_pid = $parentPid
  parent_name = $parent.ProcessName
  parent_path = $parent.Path
  working_directory = (Get-Location).Path
  tool = $toolPath
  python_candidates = $candidates
  verified_python = $verifiedPython
  started_at_utc = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $evidencePath -Encoding utf8

if ($SelfTest) {
  Write-Output 'GUARD_SELF_TEST=PASS'
  exit 0
}

$env:PYTHONDONTWRITEBYTECODE = '1'
$env:AIEA_R3_PWSH_PID = "$PID"
$env:AIEA_R3_PWSH_PATH = $procPath
$env:AIEA_R3_PWSH_CREATED_100NS = "$created"
$env:AIEA_R3_GUARD_TOKEN = $token
$env:AIEA_R3_GUARD_EVIDENCE = $evidencePath
& $python -B $toolPath @ToolArguments
$exitCode = $LASTEXITCODE
$finished = [DateTime]::UtcNow.ToString('o')
[pscustomobject]@{
  guard_token = $token
  tool = $toolPath
  exit_code = $exitCode
  finished_at_utc = $finished
} | ConvertTo-Json -Compress | Add-Content -LiteralPath $historyPath -Encoding utf8
$evidence = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
$evidence | Add-Member -NotePropertyName tool_exit_code -NotePropertyValue $exitCode -Force
$evidence | Add-Member -NotePropertyName finished_at_utc -NotePropertyValue $finished -Force
$evidence | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $evidencePath -Encoding utf8
if ($exitCode -ne 0) { Write-Output "GUARDED_TOOL_RESULT=FAIL exit_code=$exitCode"; exit $exitCode }
Write-Output 'GUARDED_TOOL_RESULT=PASS'
