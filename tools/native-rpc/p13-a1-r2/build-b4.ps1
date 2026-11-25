$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = 'D:\thinkbook\Desktop\jieya\tools\native-rpc\p13-a1-r2'
$RepoRoot = 'D:\thinkbook\Desktop\jieya'
$Midl = 'C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\midl.exe'
$Cl = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\cl.exe'
$Link = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\link.exe'
$Dumpbin = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\dumpbin.exe'
$SdkRoot = 'C:\Program Files (x86)\Windows Kits\10'
$SdkVersion = '10.0.26100.0'
$SdkInclude = Join-Path $SdkRoot "Include\$SdkVersion"
$SdkLib = Join-Path $SdkRoot "Lib\$SdkVersion"
$MsvcRoot = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207'
$MsvcInclude = Join-Path $MsvcRoot 'include'
$MsvcLib = Join-Path $MsvcRoot 'lib\x64'
$MsvcBin = Join-Path $MsvcRoot 'bin\Hostx64\x64'

$Generated = Join-Path $Root 'generated\r4-b4\x64'
$Objects = Join-Path $Root 'obj\r4-b4\x64'
$Bin = Join-Path $Root 'bin\r4-b4\x64'
$Logs = Join-Path $Root 'logs\r4-b4\build'
$StaticLogs = Join-Path $Root 'logs\r4-b4\static-review'
$ManifestDir = Join-Path $Root 'manifest\r4-b4'
$Evidence = Join-Path $Root 'evidence\r4-b4'
$TempDir = Join-Path $Root 'evidence\r4-b4\temp'

foreach ($directory in @($Generated, $Objects, $Bin, $Logs, $StaticLogs, $ManifestDir, $Evidence, $TempDir)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$BuildLog = Join-Path $Logs 'build.log'
Set-Content -LiteralPath $BuildLog -Value '' -Encoding utf8

function Write-Log {
    param([string]$Message)
    Add-Content -LiteralPath $BuildLog -Value ("[{0:O}] {1}" -f [DateTime]::UtcNow, $Message) -Encoding utf8
}

function Quote-Arg {
    param([string]$Value)
    if ($Value -notmatch '[\s"]') { return $Value }
    return '"' + ($Value -replace '"', '\"') + '"'
}

$FixedEnvironment = [ordered]@{
    SystemRoot = $env:SystemRoot
    WINDIR = $env:WINDIR
    TEMP = $TempDir
    TMP = $TempDir
    PATH = "$MsvcBin;$env:SystemRoot\System32;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
    INCLUDE = "$SdkInclude\ucrt;$SdkInclude\shared;$SdkInclude\um;$MsvcInclude"
    LIB = "$MsvcLib;$SdkLib\um\x64;$SdkLib\ucrt\x64"
}

function Invoke-FixedCommand {
    param(
        [string]$Label,
        [string]$Executable,
        [string[]]$CommandArgs,
        [string]$LogPath,
        [string]$WorkingDirectory = $Root
    )
    $rendered = '[' + $Label + '] "' + $Executable + '" ' + (($CommandArgs | ForEach-Object { Quote-Arg $_ }) -join ' ')
    Write-Log $rendered
    Add-Content -LiteralPath $LogPath -Value $rendered -Encoding utf8

    $info = [System.Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Executable
    $info.Arguments = (($CommandArgs | ForEach-Object { Quote-Arg $_ }) -join ' ')
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.CreateNoWindow = $true
    $info.Environment.Clear()
    foreach ($entry in $FixedEnvironment.GetEnumerator()) {
        $info.Environment[$entry.Key] = [string]$entry.Value
    }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $info
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($stdout.Length -ne 0) { Add-Content -LiteralPath $LogPath -Value $stdout -Encoding utf8 }
    if ($stderr.Length -ne 0) { Add-Content -LiteralPath $LogPath -Value $stderr -Encoding utf8 }
    $exitCode = $process.ExitCode
    $process.Dispose()
    Write-Log "[$Label] exit=$exitCode"
    if ($exitCode -ne 0) { throw "$Label failed with exit code $exitCode" }
}

function Assert-FileHash {
    param([string]$Path, [string]$Expected)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "missing toolchain file: $Path" }
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    if ($actual -ne $Expected) { throw "hash mismatch: $Path expected=$Expected actual=$actual" }
}

Assert-FileHash $Cl 'E87E78B3EF6580B75AEBDA843F8A22E874612D9F766344046551399F898EB226'
Assert-FileHash $Link '49A5DF25C3182A22684375B1D62A025016DEFFCCEA247894FE5CA2C85610C6A6'
Assert-FileHash $Dumpbin 'E2C0EC987BB904ACFE88C0685CBC836E695CF22007CB17F3CE9F39E785DEC980'
Assert-FileHash $Midl '2D5675679D6158790C25391EF8BF3004A695C42BB3B29E340BD6CB4708C8F23D'
Assert-FileHash (Join-Path $SdkInclude 'shared\rpc.h') '063BD35DF91C85B029064ABE19D635D985E414C9733C60EE8CA8CE937C98D6D5'
Assert-FileHash (Join-Path $SdkInclude 'shared\rpcasync.h') '5E91801CEE17B175A397CC56FF08790783D4FCDBC8D52FE7BB7461CCFA369A85'
Assert-FileHash (Join-Path $SdkLib 'um\x64\Rpcrt4.lib') 'BFE69184C180BF6ADE840AC5279B53AA67B0EDA43C82BCD86596DB0309FAEEF3'
Assert-FileHash (Join-Path $SdkLib 'um\x64\Authz.lib') '99BCF0102C457BCEAE40557D7BE15C07EECB712DD7BF257B7E05CCBFC080AA42'

$pfr = @((Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -Name PendingFileRenameOperations).PendingFileRenameOperations)
$pfrBytes = [Text.Encoding]::Unicode.GetBytes(($pfr -join "`0"))
$pfrHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($pfrBytes))
if ($pfr.Count -ne 46 -or $pfrHash -ne '0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC') {
    throw "PFR baseline changed: count=$($pfr.Count) hash=$pfrHash"
}

$MidlLog = Join-Path $Logs 'midl.log'
Set-Content -LiteralPath $MidlLog -Value '' -Encoding utf8
Invoke-FixedCommand 'MIDL' $Midl @(
    '/nologo', '/x64', '/env', 'x64', '/Oicf', '/robust', '/W1',
    '/char', 'signed', '/error', 'allocation',
    '/I', (Join-Path $SdkInclude 'um'),
    '/I', (Join-Path $SdkInclude 'shared'),
    '/I', (Join-Path $SdkInclude 'ucrt'),
    '/out', $Generated,
    '/h', (Join-Path $Generated 'p13_authority.h'),
    '/cstub', (Join-Path $Generated 'p13_authority_c.c'),
    '/sstub', (Join-Path $Generated 'p13_authority_s.c'),
    (Join-Path $Root 'idl\p13_authority.idl')
) $MidlLog

$IncludeArgs = @('/I', (Join-Path $Root 'include'), '/I', $Generated)
$CompileLog = Join-Path $Logs 'compile.log'
Set-Content -LiteralPath $CompileLog -Value '' -Encoding utf8

$GeneratedServerObject = Join-Path $Objects 'p13_authority_s.obj'
$GeneratedClientObject = Join-Path $Objects 'p13_authority_c.obj'
Invoke-FixedCommand 'CL-generated-server-stub' $Cl (@(
    '/nologo', '/c', '/W3', '/TC', '/D_CRT_SECURE_NO_WARNINGS',
    '/D_WIN32_WINNT=0x0A00', '/DWIN32_LEAN_AND_MEAN', '/DUNICODE', '/D_UNICODE'
) + $IncludeArgs + @('/Fop13_authority_s.obj', (Join-Path $Generated 'p13_authority_s.c'))) $CompileLog $Objects
Invoke-FixedCommand 'CL-generated-client-stub' $Cl (@(
    '/nologo', '/c', '/W3', '/TC', '/D_CRT_SECURE_NO_WARNINGS',
    '/D_WIN32_WINNT=0x0A00', '/DWIN32_LEAN_AND_MEAN', '/DUNICODE', '/D_UNICODE'
) + $IncludeArgs + @('/Fop13_authority_c.obj', (Join-Path $Generated 'p13_authority_c.c'))) $CompileLog $Objects

$CppFlags = @(
    '/nologo', '/c', '/W4', '/WX', '/permissive-', '/std:c++20',
    '/MT', '/GS', '/guard:cf', '/sdl', '/EHsc',
    '/D_WIN32_WINNT=0x0A00', '/DNTDDI_VERSION=0x0A00000C',
    '/DWIN32_LEAN_AND_MEAN', '/DUNICODE', '/D_UNICODE'
)

$ServerSources = @(
    'src\common\p13_types.cpp',
    'src\identity\windows_identity_adapter.cpp',
    'src\authority\p13_operation_policy.cpp',
    'src\authority\p13_authority_components.cpp',
    'src\launch\p13_launch_components.cpp',
    'src\authority\p13_authority_service.cpp',
    'src\lifecycle\job_lifecycle_adapter.cpp',
    'src\lifecycle\sealed_adapter.cpp',
    'src\server\p13_managers.cpp',
    'src\server\p13_server_runtime.cpp',
    'src\server\p13_server_main.cpp'
)
$ServerObjects = @($GeneratedServerObject)
foreach ($relative in $ServerSources) {
    $objectName = [IO.Path]::GetFileNameWithoutExtension($relative) + '.obj'
    $objectPath = Join-Path $Objects $objectName
    Invoke-FixedCommand ('CL-server-' + $relative) $Cl ($CppFlags + $IncludeArgs + @(('/Fo' + $objectName), (Join-Path $Root $relative))) $CompileLog $Objects
    $ServerObjects += $objectPath
}

$ClientSources = @(
    'src\common\p13_types.cpp',
    'src\client\p13_client_runtime.cpp',
    'src\client\p13_client_main.cpp'
)
$ClientObjects = @($GeneratedClientObject)
foreach ($relative in $ClientSources) {
    $objectName = 'client_' + [IO.Path]::GetFileNameWithoutExtension($relative) + '.obj'
    $objectPath = Join-Path $Objects $objectName
    Invoke-FixedCommand ('CL-client-' + $relative) $Cl ($CppFlags + $IncludeArgs + @(('/Fo' + $objectName), (Join-Path $Root $relative))) $CompileLog $Objects
    $ClientObjects += $objectPath
}

$TestSources = @(
    'src\common\p13_types.cpp',
    'src\identity\windows_identity_adapter.cpp',
    'src\authority\p13_operation_policy.cpp',
    'src\authority\p13_authority_components.cpp',
    'src\launch\p13_launch_components.cpp',
    'src\authority\p13_authority_service.cpp',
    'src\lifecycle\job_lifecycle_adapter.cpp',
    'src\lifecycle\sealed_adapter.cpp',
    'tests\b4\native_test_sources.cpp'
)
$TestObjects = @($GeneratedClientObject)
foreach ($relative in $TestSources) {
    $objectName = 'test_' + [IO.Path]::GetFileNameWithoutExtension($relative) + '.obj'
    $objectPath = Join-Path $Objects $objectName
    Invoke-FixedCommand ('CL-test-' + $relative) $Cl ($CppFlags + $IncludeArgs + @(('/Fo' + $objectName), (Join-Path $Root $relative))) $CompileLog $Objects
    $TestObjects += $objectPath
}

$ServerExe = Join-Path $Bin 'p13_native_rpc_server.exe'
$ClientExe = Join-Path $Bin 'p13_native_rpc_client.exe'
$TestExe = Join-Path $Bin 'p13_native_tests.exe'
$LinkLog = Join-Path $Logs 'link.log'
Set-Content -LiteralPath $LinkLog -Value '' -Encoding utf8
$Libs = @('rpcrt4.lib', 'bcrypt.lib', 'authz.lib', 'advapi32.lib', 'kernel32.lib', 'userenv.lib')
Invoke-FixedCommand 'LINK-server' $Link (@(
    '/NOLOGO', '/MACHINE:X64', '/SUBSYSTEM:CONSOLE', '/INCREMENTAL:NO',
    '/DYNAMICBASE', '/NXCOMPAT', '/HIGHENTROPYVA', '/GUARD:CF',
    ('/OUT:' + $ServerExe)
) + $ServerObjects + $Libs) $LinkLog
Invoke-FixedCommand 'LINK-client' $Link (@(
    '/NOLOGO', '/MACHINE:X64', '/SUBSYSTEM:CONSOLE', '/INCREMENTAL:NO',
    '/DYNAMICBASE', '/NXCOMPAT', '/HIGHENTROPYVA', '/GUARD:CF',
    ('/OUT:' + $ClientExe)
) + $ClientObjects + @('rpcrt4.lib', 'bcrypt.lib', 'authz.lib', 'advapi32.lib', 'kernel32.lib')) $LinkLog
Invoke-FixedCommand 'LINK-tests' $Link (@(
    '/NOLOGO', '/MACHINE:X64', '/SUBSYSTEM:CONSOLE', '/INCREMENTAL:NO',
    '/DYNAMICBASE', '/NXCOMPAT', '/HIGHENTROPYVA', '/GUARD:CF',
    ('/OUT:' + $TestExe)
) + $TestObjects + $Libs) $LinkLog

$StaticReview = Join-Path $StaticLogs 'binary-inspection.log'
Set-Content -LiteralPath $StaticReview -Value '' -Encoding utf8
foreach ($executable in @($ServerExe, $ClientExe, $TestExe)) {
    foreach ($mode in @('/headers', '/imports', '/exports', '/symbols', '/dependents')) {
        Invoke-FixedCommand ('DUMPBIN-' + (Split-Path $executable -Leaf) + '-' + $mode.Trim('/')) $Dumpbin @($mode, $executable) $StaticReview $Bin
    }
}

$pfrAfter = @((Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -Name PendingFileRenameOperations).PendingFileRenameOperations)
$pfrAfterBytes = [Text.Encoding]::Unicode.GetBytes(($pfrAfter -join "`0"))
$pfrAfterHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($pfrAfterBytes))
if ($pfrAfter.Count -ne $pfr.Count -or $pfrAfterHash -ne $pfrHash) { throw "PFR changed during B4 build" }

$sourceFiles = @(
    'idl\p13_authority.idl',
    'include\common\p13_types.h',
    'include\authority\p13_operation_policy.h',
    'include\authority\p13_authority_components.h',
    'include\authority\p13_authority_service.h',
    'include\identity\p13_identity_adapter.h',
    'include\launch\p13_launch_components.h',
    'include\lifecycle\p13_lifecycle_adapters.h',
    'include\server\p13_server_runtime.h',
    'src\common\p13_types.cpp',
    'src\identity\windows_identity_adapter.cpp',
    'src\authority\p13_operation_policy.cpp',
    'src\authority\p13_authority_components.cpp',
    'src\launch\p13_launch_components.cpp',
    'src\authority\p13_authority_service.cpp',
    'src\lifecycle\job_lifecycle_adapter.cpp',
    'src\lifecycle\sealed_adapter.cpp',
    'src\server\p13_managers.cpp',
    'src\server\p13_server_runtime.cpp',
    'src\server\p13_server_main.cpp',
    'src\client\p13_client_runtime.cpp',
    'src\client\p13_client_main.cpp',
    'tests\b4\native_test_sources.cpp',
    'build-b4.ps1',
    'verify-static-b4.ps1',
    'README-B4.md',
    'manifest\r4-b4\operation-policy.json',
    'manifest\r4-b4\test-traceability.json'
)
$sourceRecords = foreach ($relative in $sourceFiles) {
    $path = Join-Path $Root $relative
    $item = Get-Item -LiteralPath $path
    [ordered]@{ path = $relative.Replace('\','/'); length = $item.Length; sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
}
$artifactPaths = @(
    Get-ChildItem -LiteralPath $Generated, $Objects, $Bin, $Logs, $StaticLogs -Recurse -File |
        Where-Object { $_.Name -ne 'static-verification.json' -and $_.Name -ne 'build.log' } |
        ForEach-Object { $_.FullName }
)
$artifactRecords = foreach ($path in ($artifactPaths | Sort-Object -Unique)) {
    $item = Get-Item -LiteralPath $path
    [ordered]@{ path = $path.Substring($Root.Length + 1).Replace('\','/'); length = $item.Length; sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
}
$manifest = [ordered]@{
    schemaVersion = 2
    status = 'B4 BUILD-ONLY / NATIVE RUNTIME NOT EXECUTED'
    generatedAtUtc = [DateTime]::UtcNow.ToString('O')
    buildOnly = $true
    runtimeExecuted = $false
    target = 'x64'
    maxRpcWireBytes = 24576
    sources = @($sourceRecords)
    artifacts = @($artifactRecords)
    pfr = [ordered]@{ beforeCount = $pfr.Count; beforeSha256 = $pfrHash; afterCount = $pfrAfter.Count; afterSha256 = $pfrAfterHash; stable = $true }
    toolchain = [ordered]@{
        midlPath = $Midl
        clPath = $Cl
        linkPath = $Link
        dumpbinPath = $Dumpbin
        midlVersion = '8.01.0628 / 10.0.26100.9457'
        msvc = '14.44.35207'
        compiler = '19.44.35230.0'
        linker = '14.44.35230.0'
        sdk = $SdkVersion
    }
}
$manifestPath = Join-Path $ManifestDir 'build-manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash
Write-Output "B4_BUILD_COMPLETE"
Write-Output "SERVER=$ServerExe"
Write-Output "CLIENT=$ClientExe"
Write-Output "TESTS=$TestExe"
Write-Output "MANIFEST=$manifestPath"
Write-Output "MANIFEST_SHA256=$manifestHash"

