$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = 'D:\thinkbook\Desktop\jieya\tools\native-rpc\p13-a1-r2'
$RepoRoot = 'D:\thinkbook\Desktop\jieya'
$Output = Join-Path $Root 'logs\r4-b4\static-review\static-verification.json'

$allSource = Get-ChildItem -LiteralPath (Join-Path $Root 'src'), (Join-Path $Root 'include') -Recurse -File |
    Get-Content -Raw
$idlText = Get-Content -Raw -LiteralPath (Join-Path $Root 'idl\p13_authority.idl')
$sourceText = ($allSource -join "`n") + "`n" + $idlText
$managerText = Get-Content -Raw -LiteralPath (Join-Path $Root 'src\server\p13_managers.cpp')
$serverRuntime = Get-Content -Raw -LiteralPath (Join-Path $Root 'src\server\p13_server_runtime.cpp')
$buildText = Get-Content -Raw -LiteralPath (Join-Path $Root 'build-b4.ps1')
$testText = Get-Content -Raw -LiteralPath (Join-Path $Root 'tests\b4\native_test_sources.cpp')
$manifestPath = Join-Path $Root 'manifest\r4-b4\build-manifest.json'
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

$authorityOps = ([regex]::Matches($sourceText, 'P13_AUTH_[A-Z0-9_]+\s*=' )).Count
$launchOps = ([regex]::Matches($sourceText, 'P13_LAUNCH_[A-Z0-9_]+\s*=' )).Count
$tests = ([regex]::Matches($testText, '\{"T[0-9]{2}",')).Count

$sourceHashChecks = foreach ($source in $manifest.sources) {
    $path = Join-Path $Root ($source.path.Replace('/', '\'))
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    [ordered]@{ path = $source.path; expected = $source.sha256; actual = $actual; match = $actual -eq $source.sha256 }
}
$artifactHashChecks = foreach ($artifact in $manifest.artifacts) {
    $path = Join-Path $Root ($artifact.path.Replace('/', '\'))
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    [ordered]@{ path = $artifact.path; expected = $artifact.sha256; actual = $actual; match = $actual -eq $artifact.sha256 }
}

$pfr = @((Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -Name PendingFileRenameOperations).PendingFileRenameOperations)
$pfrBytes = [Text.Encoding]::Unicode.GetBytes(($pfr -join "`0"))
$pfrHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($pfrBytes))

$protectedPaths = [ordered]@{
    'docs/architecture/file-lifecycle-p13-design-freeze.md' = 'E6382930A0A43E3A6134E64ACB5BFC90C7F0F819D1265361CB809F0C855C1705'
    'docs/architecture/file-lifecycle-p13-implementation-status.md' = '5EB9DE6F8911813CE73ADEDA3C69C9E547D56034A9E3143C62285F0F63982586'
    'docs/architecture/file-lifecycle-p13-database-behavior-test-plan.md' = 'FFFF54365CC613025594FC9A6CBDCC9B7AFEB2DD06C36DFCFE02CB582D2922D7'
    'prisma/schema.prisma' = '78236AD340A29F07615687C0E7A66AAE2647E481F76F230C656EF0DEA3388299'
    'apps/web/next-env.d.ts' = '0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC'
    'apps/web/tsconfig.tsbuildinfo' = '21CE143CDA8834673AE44E0420CE319529BC1E5EA42CB9A08BAD5E839E052520'
}
$protectedChecks = foreach ($entry in $protectedPaths.GetEnumerator()) {
    $actual = (Get-FileHash -LiteralPath (Join-Path $RepoRoot $entry.Key) -Algorithm SHA256).Hash
    [ordered]@{ path = $entry.Key; expected = $entry.Value; actual = $actual; match = $actual -eq $entry.Value }
}

$b1Checks = foreach ($entry in @(
    @{ path = 'bin\x64\p13_native_rpc_server.exe'; hash = 'A1169E2F6882BE5CA6F7D18C435DDA77E0F78A15467DE3C3A3271ABE241E38A5' },
    @{ path = 'bin\x64\p13_native_rpc_client.exe'; hash = 'C86BE3839F414A8CE95DFC4312878EA598BE1FEC4A53AE254E943573897B4C6A' },
    @{ path = 'manifest\build-manifest.json'; hash = 'DC164B09C1D16C7CAEB46B3785CA3806C703300C2535A39B471F7D08039FE2FF' },
    @{ path = 'logs\static-review\static-verification.json'; hash = 'D10DE78D2B1736542AB3B4879ADABEA11A216CFEE6E535012A61D71F7218251D' },
    @{ path = 'logs\build\midl.log'; hash = '4ECD6983151475141EB3ABCAB5186FA2E85A5BE1CD0C804535E24BD50D0776A7' },
    @{ path = 'logs\build\compile.log'; hash = '4E8336A0279F6E39AC15CEDB7647A928687AAAFCE1713E875062EC31124C5194' },
    @{ path = 'logs\build\link.log'; hash = 'E4B83D04D3ED679B86E194E6A44B6B920F3CBC99DCBD1DFA49792EC3056B8BF3' },
    @{ path = 'logs\build\build.log'; hash = '285DE59A592D895D0A14FD4365FE9F23E2AFB59A755FF697A357FD23780FE083' }
)) {
    $actual = (Get-FileHash -LiteralPath (Join-Path $Root $entry.path) -Algorithm SHA256).Hash
    [ordered]@{ path = $entry.path; expected = $entry.hash; actual = $actual; match = $actual -eq $entry.hash }
}

$checks = [ordered]@{
    operationPolicyAuthority13 = $authorityOps -eq 13
    operationPolicyLaunch6 = $launchOps -eq 6
    twoPublicManagers = ([regex]::Matches($managerText, '(?m)^extern "C" error_status_t P13(?:Launch)?Invoke')).Count -eq 2
    authorizeBeforeDispatch = $managerText.IndexOf('AuthorizeAuthority') -lt $managerText.IndexOf('DispatchAuthority') -and $managerText.IndexOf('AuthorizeLaunch') -lt $managerText.IndexOf('DispatchLaunch')
    descriptorAllowlistRemoved = $sourceText -notmatch 'std::vector<P13AuthorityOperation>|std::vector<P13LaunchOperation>'
    authorizedTokenPrivateCtor = $sourceText.Contains('friend class AuthorizationEngine')
    grantBindingPresent = $sourceText.Contains('BindingMode::MatchGrant') -and $sourceText.Contains('TestGrantStore::Match')
    ticketBindingPresent = $sourceText.Contains('TestTicketStore::Consume') -and $sourceText.Contains('launchTicketId')
    authzContextPresent = $sourceText.Contains('RpcGetAuthorizationContextForClient') -and $sourceText.Contains('AuthzGetInformationFromContext')
    tokenUserBindingPresent = $sourceText.Contains('rpcAuthzUserSid') -and $sourceText.Contains('processTokenUserSid')
    sidAttributePresent = $sourceText.Contains('SE_GROUP_USE_FOR_DENY_ONLY') -and $sourceText.Contains('SE_GROUP_ENABLED')
    separateUnknownClosedGuard = $sourceText.Contains('EvidenceReconciling') -and $sourceText.Contains('EvidenceUnknown')
    restrictedTokenPresent = $sourceText.Contains('CreateRestrictedToken') -and $sourceText.Contains('IsTokenRestricted')
    crossProcessHandlePresent = $sourceText.Contains('TransferHandlesToSupervisor') -and $sourceText.Contains('supervisorProcess')
    resumeThreadPresent = $sourceText.Contains('ResumeThread')
    sealedProtectedPresent = $sourceText.Contains('SE_DACL_PROTECTED') -and $sourceText.Contains('S-1-3-4')
    dualEvidencePresent = $sourceText.Contains('HELPER_EFFECT') -and $sourceText.Contains('SUPERVISOR_VERIFICATION')
    revertFailurePresent = $sourceText.Contains('RpcRevertToSelf') -and $sourceText.Contains('ERROR_ASSERTION_FAILURE')
    ndrBudgetPresent = $serverRuntime.Contains('P13_MAX_RPC_WIRE_BYTES') -and $sourceText.Contains('P13_MAX_RPC_WIRE_BYTES = 24576')
    blockingListenPresent = $serverRuntime.Contains('RpcServerListen(1, kMaxConcurrentRpcCalls, FALSE)') -and $serverRuntime.Contains('RpcMgmtWaitServerListen')
    shaOutcomePresent = $sourceText.Contains('struct Sha256Outcome') -and $sourceText.Contains('CryptoFailed')
    testSource30 = $tests -eq 30
    sourceHashesPinned = $manifest.sources.Count -gt 0 -and @($sourceHashChecks | Where-Object { -not $_.match }).Count -eq 0
    artifactHashesMatch = @($artifactHashChecks | Where-Object { -not $_.match }).Count -eq 0
    buildEnvironmentAllowlist = $buildText.Contains('Environment.Clear()') -and $buildText.Contains('$FixedEnvironment')
    buildDoesNotExecuteArtifacts = -not ($buildText -match '&\s*\$ServerExe|&\s*\$ClientExe|&\s*\$TestExe|Start-Process')
    runtimeNotExecuted = $manifest.runtimeExecuted -eq $false
    pfrStable = $pfr.Count -eq 46 -and $pfrHash -eq '0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC'
    protectedHashesMatch = @($protectedChecks | Where-Object { -not $_.match }).Count -eq 0
    b1ArtifactsUnchanged = @($b1Checks | Where-Object { -not $_.match }).Count -eq 0
}

$failed = @($checks.GetEnumerator() | Where-Object { $_.Value -ne $true })
$result = [ordered]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString('O')
    runtimeExecuted = $false
    checks = $checks
    failedChecks = @($failed | ForEach-Object { $_.Key })
    pfr = [ordered]@{ count = $pfr.Count; sha256 = $pfrHash }
    sources = @($sourceHashChecks)
    artifacts = @($artifactHashChecks)
    protectedObjects = @($protectedChecks)
    b1Artifacts = @($b1Checks)
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Output -Encoding utf8
if ($failed.Count -ne 0) {
    throw "B4 static verification failed: $($failed.Key -join ', ')"
}
Write-Output "B4_STATIC_VERIFICATION_PASS"
Write-Output "OUTPUT=$Output"
Write-Output "SHA256=$((Get-FileHash -LiteralPath $Output -Algorithm SHA256).Hash)"

