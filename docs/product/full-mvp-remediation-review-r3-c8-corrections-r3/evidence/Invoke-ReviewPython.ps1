[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Script)
$ErrorActionPreference='Stop'
$review=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$repo=(Resolve-Path -LiteralPath (Join-Path $review '..\..\..')).Path
$p=[System.Diagnostics.Process]::GetCurrentProcess()
$path=$p.Path
$vi=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($path)
$parentId=(Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
$parent=Get-Process -Id $parentId
$created=$p.StartTime.ToUniversalTime().ToFileTimeUtc()
$token=[guid]::NewGuid().ToString('N')
$evidence=Join-Path $PSScriptRoot 'EXECUTION_IDENTITY_EVIDENCE_REVIEW_R3.json'
if($PSVersionTable.PSVersion.ToString()-ne'7.6.9'){throw 'PS version'}
if($PSVersionTable.PSEdition-ne'Core'){throw 'PS edition'}
if([IO.Path]::GetFileName($path).ToLowerInvariant()-ne'pwsh.exe'){throw 'Process path'}
if($vi.FileVersion-ne'7.6.9.500'){throw 'File version'}
if($parent.ProcessName-notin@('codex','pwsh')){throw 'Parent'}
if((Get-Location).Path-ne$repo){throw 'Working dir'}
$candidates=@(Get-Command python.exe -CommandType Application -All|Where-Object{$_.Source-and[IO.Path]::IsPathRooted($_.Source)}|ForEach-Object{[IO.Path]::GetFullPath($_.Source)}|Sort-Object -Unique)
$verified=@()
foreach($c in $candidates){try{$v=@(& $c --version);if($LASTEXITCODE-eq 0-and($v-join' ')-match'^Python 3\.'){$verified+=[pscustomobject]@{path=$c;version=($v-join' ')}}}catch{}}
if($verified.Count-eq 0){throw 'No Python'}
$python=$verified[0].path
$scriptPath=(Resolve-Path -LiteralPath $Script).Path
if(-not$scriptPath.StartsWith($review,[StringComparison]::OrdinalIgnoreCase)){throw 'Script path'}
[pscustomobject]@{guard_token=$token;powershell_version=$PSVersionTable.PSVersion.ToString();powershell_edition=$PSVersionTable.PSEdition;powershell_pid=$PID;powershell_path=$path;powershell_creation_100ns=$created;file_version=$vi.FileVersion;parent_pid=$parentId;parent_name=$parent.ProcessName;parent_path=$parent.Path;working_directory=(Get-Location).Path;python_candidates=$candidates;verified_python=$verified;script=$scriptPath;checked_at_utc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 7|Set-Content -LiteralPath $evidence -Encoding utf8
$env:PYTHONDONTWRITEBYTECODE='1';$env:AIEA_R3R_PWSH_PID="$PID";$env:AIEA_R3R_PWSH_PATH=$path;$env:AIEA_R3R_PWSH_CREATED="$created";$env:AIEA_R3R_TOKEN=$token;$env:AIEA_R3R_EVIDENCE=$evidence
& $python -B $scriptPath
exit $LASTEXITCODE
