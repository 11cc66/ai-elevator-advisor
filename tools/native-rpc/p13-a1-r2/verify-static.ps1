$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = 'D:\thinkbook\Desktop\jieya\tools\native-rpc\p13-a1-r2'
$RepoRoot = 'D:\thinkbook\Desktop\jieya'
$Output = Join-Path $Root 'logs\static-review\static-verification.json'

$idlPath = Join-Path $Root 'idl\p13_authority.idl'
$managerSource = Join-Path $Root 'src\server\p13_managers.cpp'
$buildScript = Join-Path $Root 'build.ps1'
$contractsPath = Join-Path $Root 'manifest\operation-contracts.json'
$tracePath = Join-Path $Root 'manifest\test-traceability.json'
$buildManifestPath = Join-Path $Root 'manifest\build-manifest.json'

$idlText = Get-Content -Raw -LiteralPath $idlPath
$managerText = Get-Content -Raw -LiteralPath $managerSource
$buildText = Get-Content -Raw -LiteralPath $buildScript
$contracts = Get-Content -Raw -LiteralPath $contractsPath | ConvertFrom-Json
$trace = Get-Content -Raw -LiteralPath $tracePath | ConvertFrom-Json
$buildManifest = Get-Content -Raw -LiteralPath $buildManifestPath | ConvertFrom-Json

$managerMethodCount = ([regex]::Matches($idlText, '(?m)^\s*error_status_t\s+P13(?:Launch)?Invoke\s*\(')).Count
$authorityOperations = [regex]::Matches($idlText, '(?m)^\s*P13_AUTH_[A-Z0-9_]+\s*=\s*0x').Count
$launchOperations = [regex]::Matches($idlText, '(?m)^\s*P13_LAUNCH_[A-Z0-9_]+\s*=\s*0x').Count
$dispatcherCalls = ([regex]::Matches($managerText, 'DispatchAuthority\s*\(')).Count
$launchDispatcherCalls = ([regex]::Matches($managerText, 'DispatchLaunch\s*\(')).Count
$authBeforeAuthorityDispatch =
    $managerText.IndexOf('AuthorizeCurrentCall(') -lt $managerText.IndexOf('DispatchAuthority(')
$authBeforeLaunchDispatch =
    $managerText.IndexOf('AuthorizeCurrentLaunchCall(') -lt $managerText.IndexOf('DispatchLaunch(')

$oldEndpointHits = @(
    Get-ChildItem -LiteralPath $Root -Recurse -File |
        Where-Object { $_.Name -ne 'verify-static.ps1' } |
        Select-String -SimpleMatch 'p13-launch-staging-writer-v1'
).Count
$securityMutationHits = @(
    Get-ChildItem -LiteralPath (Join-Path $Root 'src') -Recurse -File |
        Select-String -Pattern 'SetNamedSecurityInfo|SetSecurityInfo\(|SetFileSecurity'
).Count
$processExecutionHits = @(
    Select-String -LiteralPath $buildScript -Pattern 'Start-Process|&\s*\$ServerExe|&\s*\$ClientExe'
).Count
$runtimeGuard = $buildText.Contains('runtimeExecuted = $false')

$artifactChecks = foreach ($artifact in $buildManifest.artifacts) {
    $path = Join-Path $Root ($artifact.path.Replace('/', '\'))
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    [ordered]@{
        path = $artifact.path
        expected = $artifact.sha256
        actual = $actual
        match = $actual -eq $artifact.sha256
    }
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
    [ordered]@{
        path = $entry.Key
        expected = $entry.Value
        actual = $actual
        match = $actual -eq $entry.Value
    }
}

$checks = [ordered]@{
    exactlyTwoPublicManagers = $managerMethodCount -eq 2
    authorityOperationCount13 = $authorityOperations -eq 13
    launchOperationCount6 = $launchOperations -eq 6
    contractsAuthorityCount13 = @($contracts.authorityOperations).Count -eq 13
    contractsLaunchCount6 = @($contracts.launchOperations).Count -eq 6
    traceabilityCount30 = @($trace.tests).Count -eq 30
    authorityDispatchPresent = $dispatcherCalls -eq 1
    launchDispatchPresent = $launchDispatcherCalls -eq 1
    authorizeBeforeAuthorityDispatch = $authBeforeAuthorityDispatch
    authorizeBeforeLaunchDispatch = $authBeforeLaunchDispatch
    oldEndpointAbsent = $oldEndpointHits -eq 0
    forbiddenSecurityMutationAbsent = $securityMutationHits -eq 0
    buildDoesNotExecuteArtifacts = $processExecutionHits -eq 0
    buildManifestRuntimeNotExecuted = (-not $buildManifest.runtimeExecuted) -and $runtimeGuard
    allArtifactHashesMatch = @($artifactChecks | Where-Object { -not $_.match }).Count -eq 0
    pfrStable46AndExpectedHash = $pfr.Count -eq 46 -and $pfrHash -eq '0FF69EDFED875BA6310D27382562D1221C0E4EFD9B29625D4035FC06A2DFC1EC'
    allProtectedHashesMatch = @($protectedChecks | Where-Object { -not $_.match }).Count -eq 0
    buildManifestIsBuildOnly = $buildManifest.buildOnly -eq $true
}

$failed = @($checks.GetEnumerator() | Where-Object { $_.Value -ne $true })
$result = [ordered]@{
    schemaVersion = 1
    generatedAtUtc = [DateTime]::UtcNow.ToString('O')
    runtimeExecuted = $false
    checks = $checks
    failedChecks = @($failed | ForEach-Object { $_.Key })
    pfr = [ordered]@{
        count = $pfr.Count
        sha256 = $pfrHash
    }
    artifacts = @($artifactChecks)
    protectedObjects = @($protectedChecks)
}

$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Output -Encoding utf8
if ($failed.Count -ne 0) {
    throw "static verification failed: $($failed.Key -join ', ')"
}

Write-Output "STATIC_VERIFICATION_PASS"
Write-Output "OUTPUT=$Output"
Write-Output "SHA256=$((Get-FileHash -LiteralPath $Output -Algorithm SHA256).Hash)"

