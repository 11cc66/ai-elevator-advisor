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

$Generated = Join-Path $Root 'generated\x64'
$Objects = Join-Path $Root 'obj\x64'
$Bin = Join-Path $Root 'bin\x64'
$Logs = Join-Path $Root 'logs\build'
$StaticLogs = Join-Path $Root 'logs\static-review'
$Hashes = Join-Path $Root 'evidence\hashes'
$ManifestDir = Join-Path $Root 'manifest'

foreach ($directory in @($Generated, $Objects, $Bin, $Logs, $StaticLogs, $Hashes, $ManifestDir)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$BuildLog = Join-Path $Logs 'build.log'
Set-Content -LiteralPath $BuildLog -Value '' -Encoding utf8

function Write-Log {
    param([Parameter(Mandatory = $true)][string]$Message)
    $line = "[{0:O}] {1}" -f [DateTime]::UtcNow, $Message
    Add-Content -LiteralPath $BuildLog -Value $line -Encoding utf8
}

function Assert-FileHash {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Expected
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "required toolchain file missing: $Path"
    }
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    if ($actual -ne $Expected) {
        throw "toolchain hash mismatch: $Path expected=$Expected actual=$actual"
    }
}

function Invoke-FixedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$CommandArgs,
        [Parameter(Mandatory = $true)][string]$LogPath,
        [Parameter(Mandatory = $false)][string]$WorkingDirectory = $Root
    )
    $commandText = "[$Label] `"$Executable`" $($CommandArgs -join ' ')"
    Write-Log -Message $commandText
    for ($argIndex = 0; $argIndex -lt $CommandArgs.Count; $argIndex++) {
        Write-Log -Message ("ARG[{0:D2}]={1}" -f $argIndex, $CommandArgs[$argIndex])
    }
    Add-Content -LiteralPath $LogPath -Value $commandText -Encoding utf8
    Push-Location -LiteralPath $WorkingDirectory
    try {
        $output = & $Executable @CommandArgs 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    $output | ForEach-Object {
        $rendered = [string]$_
        Add-Content -LiteralPath $LogPath -Value $rendered -Encoding utf8
    }
    Write-Log -Message "[$Label] exit=$exitCode"
    if ($exitCode -ne 0) {
        throw "$Label failed with exit code $exitCode"
    }
}

Assert-FileHash -Path $Cl -Expected 'E87E78B3EF6580B75AEBDA843F8A22E874612D9F766344046551399F898EB226'
Assert-FileHash -Path $Link -Expected '49A5DF25C3182A22684375B1D62A025016DEFFCCEA247894FE5CA2C85610C6A6'
Assert-FileHash -Path $Dumpbin -Expected 'E2C0EC987BB904ACFE88C0685CBC836E695CF22007CB17F3CE9F39E785DEC980'
Assert-FileHash -Path $Midl -Expected '2D5675679D6158790C25391EF8BF3004A695C42BB3B29E340BD6CB4708C8F23D'
Assert-FileHash -Path (Join-Path $SdkInclude 'shared\rpc.h') -Expected '063BD35DF91C85B029064ABE19D635D985E414C9733C60EE8CA8CE937C98D6D5'
Assert-FileHash -Path (Join-Path $SdkInclude 'shared\rpcdce.h') -Expected '991883893134C8ECBE6AF8335DF0781BFB779C11684B3367DEF514136241B866'
Assert-FileHash -Path (Join-Path $SdkInclude 'shared\rpcasync.h') -Expected '5E91801CEE17B175A397CC56FF08790783D4FCDBC8D52FE7BB7461CCFA369A85'
Assert-FileHash -Path (Join-Path $SdkLib 'um\x64\Rpcrt4.lib') -Expected 'BFE69184C180BF6ADE840AC5279B53AA67B0EDA43C82BCD86596DB0309FAEEF3'

$d1Path = Join-Path $RepoRoot 'docs\architecture\file-lifecycle-p13-c6-2-l8a7-20-r4-a1-r4-d1-native-rpc-harness-architecture-build-plan.md'
Assert-FileHash -Path $d1Path -Expected '5A9A5E0659C6DA8228836D024C66E12B0A424E9E6D6663AFFF42B9F065149ADE'

$pfr = @((Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -Name PendingFileRenameOperations).PendingFileRenameOperations)
$pfrBytes = [Text.Encoding]::Unicode.GetBytes(($pfr -join "`0"))
$pfrHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($pfrBytes))
if ($pfr.Count -ne 46 -or $pfrHash -ne '0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC') {
    throw "PFR baseline changed: count=$($pfr.Count) hash=$pfrHash"
}
Write-Log -Message "PFR pre-build count=$($pfr.Count) hash=$pfrHash"

$env:PATH = (Split-Path $Cl) + ';' + $env:PATH
$env:INCLUDE = "$SdkInclude\ucrt;$SdkInclude\shared;$SdkInclude\um;$MsvcInclude"
$env:LIB = "$MsvcLib;$SdkLib\um\x64;$SdkLib\ucrt\x64"

$MidlLog = Join-Path $Logs 'midl.log'
Set-Content -LiteralPath $MidlLog -Value '' -Encoding utf8
Invoke-FixedCommand -Label 'MIDL' -Executable $Midl -CommandArgs @(
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
) -LogPath $MidlLog

$IncludeArgs = @(
    '/I', (Join-Path $Root 'include'),
    '/I', $Generated
)

$GeneratedServerObj = Join-Path $Objects 'p13_authority_s.obj'
$GeneratedClientObj = Join-Path $Objects 'p13_authority_c.obj'
$CompileLog = Join-Path $Logs 'compile.log'
Set-Content -LiteralPath $CompileLog -Value '' -Encoding utf8

Invoke-FixedCommand -Label 'CL-generated-server-stub' -Executable $Cl -CommandArgs (@(
    '/nologo', '/c', '/W3', '/TC', '/D_CRT_SECURE_NO_WARNINGS',
    '/D_WIN32_WINNT=0x0A00', '/DWIN32_LEAN_AND_MEAN',
    '/DUNICODE', '/D_UNICODE'
) + $IncludeArgs + @(
    '/Fop13_authority_s.obj',
    (Join-Path $Generated 'p13_authority_s.c')
)) -LogPath $CompileLog -WorkingDirectory $Objects

Invoke-FixedCommand -Label 'CL-generated-client-stub' -Executable $Cl -CommandArgs (@(
    '/nologo', '/c', '/W3', '/TC', '/D_CRT_SECURE_NO_WARNINGS',
    '/D_WIN32_WINNT=0x0A00', '/DWIN32_LEAN_AND_MEAN',
    '/DUNICODE', '/D_UNICODE'
) + $IncludeArgs + @(
    '/Fop13_authority_c.obj',
    (Join-Path $Generated 'p13_authority_c.c')
)) -LogPath $CompileLog -WorkingDirectory $Objects

$CppFlags = @(
    '/nologo', '/c', '/W4', '/WX', '/permissive-', '/std:c++20',
    '/MT', '/GS', '/guard:cf', '/EHsc',
    '/D_WIN32_WINNT=0x0A00', '/DNTDDI_VERSION=0x0A00000C',
    '/DWIN32_LEAN_AND_MEAN', '/DUNICODE', '/D_UNICODE'
)

$ServerSources = @(
    'src\common\p13_types.cpp',
    'src\identity\windows_identity_adapter.cpp',
    'src\authority\p13_authority_components.cpp',
    'src\launch\p13_launch_components.cpp',
    'src\authority\p13_authority_service.cpp',
    'src\lifecycle\job_lifecycle_adapter.cpp',
    'src\lifecycle\sealed_adapter.cpp',
    'src\server\p13_managers.cpp',
    'src\server\p13_server_runtime.cpp',
    'src\server\p13_server_main.cpp'
)

$ServerObjects = @($GeneratedServerObj)
foreach ($relative in $ServerSources) {
    $sourcePath = Join-Path $Root $relative
    $objectName = [IO.Path]::GetFileNameWithoutExtension($sourcePath) + '.obj'
    $objectPath = Join-Path $Objects $objectName
    Invoke-FixedCommand -Label ('CL-server-' + $relative) -Executable $Cl -CommandArgs ($CppFlags + $IncludeArgs + @(
        ('/Fo' + $objectName),
        $sourcePath
    )) -LogPath $CompileLog -WorkingDirectory $Objects
    $ServerObjects += $objectPath
}

$ClientSources = @(
    'src\common\p13_types.cpp',
    'src\client\p13_client_runtime.cpp',
    'src\client\p13_client_main.cpp'
)

$ClientObjects = @($GeneratedClientObj)
foreach ($relative in $ClientSources) {
    $sourcePath = Join-Path $Root $relative
    $objectName = 'client_' + [IO.Path]::GetFileNameWithoutExtension($sourcePath) + '.obj'
    $objectPath = Join-Path $Objects $objectName
    Invoke-FixedCommand -Label ('CL-client-' + $relative) -Executable $Cl -CommandArgs ($CppFlags + $IncludeArgs + @(
        ('/Fo' + $objectName),
        $sourcePath
    )) -LogPath $CompileLog -WorkingDirectory $Objects
    $ClientObjects += $objectPath
}

$ServerExe = Join-Path $Bin 'p13_native_rpc_server.exe'
$ClientExe = Join-Path $Bin 'p13_native_rpc_client.exe'
$LinkLog = Join-Path $Logs 'link.log'
Set-Content -LiteralPath $LinkLog -Value '' -Encoding utf8

$CommonLibs = @('rpcrt4.lib', 'bcrypt.lib', 'advapi32.lib', 'kernel32.lib', 'userenv.lib')
Invoke-FixedCommand -Label 'LINK-server' -Executable $Link -CommandArgs (@(
    '/NOLOGO', '/MACHINE:X64', '/SUBSYSTEM:CONSOLE', '/INCREMENTAL:NO',
    '/DYNAMICBASE', '/NXCOMPAT', '/HIGHENTROPYVA', '/GUARD:CF',
    ('/OUT:' + $ServerExe)
) + $ServerObjects + $CommonLibs) -LogPath $LinkLog

Invoke-FixedCommand -Label 'LINK-client' -Executable $Link -CommandArgs (@(
    '/NOLOGO', '/MACHINE:X64', '/SUBSYSTEM:CONSOLE', '/INCREMENTAL:NO',
    '/DYNAMICBASE', '/NXCOMPAT', '/HIGHENTROPYVA', '/GUARD:CF',
    ('/OUT:' + $ClientExe)
) + $ClientObjects + @('rpcrt4.lib', 'bcrypt.lib', 'advapi32.lib', 'kernel32.lib')) -LogPath $LinkLog

$StaticReview = Join-Path $StaticLogs 'binary-inspection.log'
Set-Content -LiteralPath $StaticReview -Value '' -Encoding utf8
foreach ($executable in @($ServerExe, $ClientExe)) {
    foreach ($mode in @('/headers', '/imports', '/symbols', '/dependents')) {
        Invoke-FixedCommand -Label ('DUMPBIN-' + (Split-Path $executable -Leaf) + '-' + $mode.Trim('/')) -Executable $Dumpbin -CommandArgs @(
            $mode, $executable
        ) -LogPath $StaticReview
    }
}

$pfrAfter = @((Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -Name PendingFileRenameOperations).PendingFileRenameOperations)
$pfrAfterBytes = [Text.Encoding]::Unicode.GetBytes(($pfrAfter -join "`0"))
$pfrAfterHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($pfrAfterBytes))
if ($pfrAfter.Count -ne $pfr.Count -or $pfrAfterHash -ne $pfrHash) {
    throw "PFR changed during build: before=$pfrHash after=$pfrAfterHash"
}
Write-Log -Message "PFR post-build count=$($pfrAfter.Count) hash=$pfrAfterHash"

$artifactPaths = @(
    Get-ChildItem -LiteralPath $Generated, $Objects, $Bin, $Logs, $StaticLogs -Recurse -File |
        Where-Object {
            $_.Name -ne 'static-verification.json' -and
            $_.Name -ne 'build.log'
        } |
        ForEach-Object { $_.FullName }
)
$strayRootObject = Join-Path $Root 'p13_authority_s.obj'
if (Test-Path -LiteralPath $strayRootObject -PathType Leaf) {
    $artifactPaths += $strayRootObject
}
$artifactRecords = foreach ($path in ($artifactPaths | Sort-Object -Unique)) {
    $item = Get-Item -LiteralPath $path
    [ordered]@{
        path = $path.Substring($Root.Length + 1).Replace('\', '/')
        length = $item.Length
        sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    }
}

$manifest = [ordered]@{
    schemaVersion = 1
    status = 'BUILD-ONLY / RUNTIME NOT EXECUTED'
    generatedAtUtc = [DateTime]::UtcNow.ToString('O')
    repositoryRoot = $RepoRoot
    harnessRoot = $Root
    buildOnly = $true
    runtimeExecuted = $false
    target = 'x64'
    toolchain = [ordered]@{
        visualStudio = '17.14.45 / 17.14.37906.3'
        msvc = '14.44.35207'
        compiler = '19.44.35230.0'
        linker = '14.44.35230.0'
        windowsSdk = $SdkVersion
        classicMidl = '8.01.0628 / 10.0.26100.9457'
        midlPath = $Midl
        clPath = $Cl
        linkPath = $Link
        dumpbinPath = $Dumpbin
        include = @($SdkInclude, $MsvcInclude)
        libraries = @($MsvcLib, (Join-Path $SdkLib 'um\x64'), (Join-Path $SdkLib 'ucrt\x64'))
    }
    pfr = [ordered]@{
        beforeCount = $pfr.Count
        beforeSha256 = $pfrHash
        afterCount = $pfrAfter.Count
        afterSha256 = $pfrAfterHash
        stable = $true
    }
    artifacts = @($artifactRecords)
}

$ManifestPath = Join-Path $ManifestDir 'build-manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ManifestPath -Encoding utf8

$manifestHash = (Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash
Write-Log -Message "BUILD MANIFEST=$ManifestPath SHA256=$manifestHash"
Write-Output "BUILD_ONLY_COMPLETE"
Write-Output "SERVER=$ServerExe"
Write-Output "CLIENT=$ClientExe"
Write-Output "MANIFEST=$ManifestPath"
Write-Output "MANIFEST_SHA256=$manifestHash"

