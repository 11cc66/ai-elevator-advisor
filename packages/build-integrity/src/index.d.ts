export type BuildApplication = "web" | "worker";
export type CleanupCapability = "DISABLED" | "UNKNOWN" | "ENABLED";

export interface BuildManifest {
  manifestVersion: 1;
  application: BuildApplication;
  buildId: string;
  releaseId: string;
  gitSha: string;
  gitDirty: boolean;
  sourceTreeDigest: string;
  sourceTreeExclusionPolicyVersion: string;
  dependencyLockDigest: string;
  runtimeDependencyDigest: string;
  runtimeDependencyCount: number;
  runtimePlatform: string;
  artifactDigest: string;
  artifactDigestAlgorithm: "sha256";
  buildTimestamp: string;
  lifecycleSafetyVersion: string;
  cleanupCapability: CleanupCapability;
  artifactRoots: string[];
}

export interface ManifestSignature {
  algorithm: "ed25519";
  keyId: string;
  value: string;
}

export interface SignedBuildManifest {
  manifest: BuildManifest;
  signature: ManifestSignature;
}

export interface SourceTreeDigestResult {
  digest: string;
  fileCount: number;
  exclusionPolicyVersion: string;
}

export interface ArtifactDigestResult {
  digest: string;
  fileCount: number;
  totalBytes: number;
}

export interface RuntimeDependencyClosureResult {
  digest: string;
  packageCount: number;
  fileCount: number;
  totalBytes: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  nativePackages: string[];
  missingOptionalDependencies: string[];
}

export interface LegacyMarkerFinding {
  relativePath: string;
  markerId: string;
  line: number;
}

export interface StartupVerificationExpectation {
  application: BuildApplication;
  gitSha: string;
  releaseId: string;
  minimumLifecycleSafetyVersion?: string;
}

export interface StartupVerificationResult {
  manifest: BuildManifest;
  artifactDigest: ArtifactDigestResult;
  runtimeDependency: RuntimeDependencyClosureResult;
  legacyFindings: LegacyMarkerFinding[];
}

export interface CreateManifestInput {
  application: BuildApplication;
  releaseId?: string;
  gitSha: string;
  gitDirty: boolean;
  sourceTreeDigest: string;
  dependencyLockDigest: string;
  runtimeDependencyDigest: string;
  runtimeDependencyCount: number;
  runtimePlatform: string;
  artifactDigest: string;
  lifecycleSafetyVersion?: string;
  artifactRoots?: string[];
}

export interface StartupSecurityFinding {
  code: string;
  file: string;
  message: string;
  classification?: "DANGEROUS" | "UNKNOWN" | "ERROR";
  scriptType?: "shell" | "powershell" | "cmd" | "javascript" | "unknown";
  line?: number;
}

export interface StartupSecurityVersionResult {
  status: "PASS" | "FAIL";
  complete: boolean;
  scriptsScanned: number;
  findings: StartupSecurityFinding[];
}

export interface StartupSecurityAuditResult {
  workspaceRoot: string;
  worktree: StartupSecurityVersionResult;
  head: StartupSecurityVersionResult;
  differences: string[];
  headVsWorktree: "IDENTICAL" | "DIFFERENT";
  scriptInventory: {
    worktree: string[];
    head: string[];
    added: string[];
    removed: string[];
    changed: string[];
  };
  unknowns: Array<
    StartupSecurityFinding & {
      revision: "WORKTREE" | "HEAD";
    }
  >;
  additionalWorktreeScriptsScanned: number;
  additionalHeadScriptsScanned: number;
  worktreeScriptsEnumerated: number;
  headScriptsEnumerated: number;
  legacyArtifacts: Array<{
    relativePath: string;
    present: boolean;
  }>;
}

export class ReleaseSecurityError extends Error {
  readonly code: string;
  readonly details?: unknown;
}

export function inspectStartupEntrySecurity(input: {
  workspaceRoot: string;
  readRevision?: (
    relativePath: string,
  ) => Promise<string | null>;
  listHeadPaths?: () => Promise<string[]>;
}): Promise<StartupSecurityAuditResult>;

export function runBuildSecurityPreflight(input: {
  application: "web" | "worker";
  workspaceRoot: string;
  appDirectory: string;
  targetRoot: string;
  newWritePaths?: string[];
  readRevision?: (
    relativePath: string,
  ) => Promise<string | null>;
  listHeadPaths?: () => Promise<string[]>;
}): Promise<StartupSecurityAuditResult>;

export function executeGuardedBuild<T>(input: {
  runPreflight: () => Promise<StartupSecurityAuditResult>;
  verifyBuildIdentity?: (
    report: StartupSecurityAuditResult,
  ) => Promise<void> | void;
  build: (
    report: StartupSecurityAuditResult,
  ) => Promise<T>;
  afterSuccessfulBuild?: (
    result: T,
    report: StartupSecurityAuditResult,
  ) => Promise<void> | void;
}): Promise<T>;

export const P13_MANIFEST_VERSION: 1;
export const P13_LIFECYCLE_SAFETY_VERSION: string;
export const P13_SOURCE_TREE_EXCLUSION_POLICY_VERSION: string;
export const P13_LEGACY_DELETE_MARKERS: ReadonlyArray<{
  id: string;
  expression: RegExp;
}>;

export class BuildIntegrityError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}

export function canonicalize(value: unknown): string;
export function parseStrictJson(value: string): unknown;
export function computeSourceTreeDigest(input: {
  root: string;
}): Promise<SourceTreeDigestResult>;
export function computeArtifactDigest(input: {
  root: string;
  excludedRelativePaths?: readonly string[];
  allowedSymlinkRoots?: readonly string[];
}): Promise<ArtifactDigestResult>;
export function computeFileDigest(filePath: string): Promise<string>;
export function computeRuntimeDependencyClosure(input: {
  applicationRoot: string;
}): Promise<RuntimeDependencyClosureResult>;
export function scanArtifactForLegacyDelete(
  root: string,
  options?: {
    allowedSymlinkRoots?: readonly string[];
  },
): Promise<LegacyMarkerFinding[]>;
export function createBuildManifest(
  input: CreateManifestInput,
): BuildManifest;
export function generateSignedReleaseManifest(input: {
  application: BuildApplication;
  workspaceRoot: string;
  artifactRoot: string;
  runtimeRoot: string;
  gitSha: string;
  gitDirty: boolean;
  releaseId: string;
  keyId: string;
  privateKeyPath: string;
  allowedSymlinkRoots?: readonly string[];
  manifestFileName?: string;
}): Promise<{
  manifestPath: string;
  manifest: BuildManifest;
  signatureKeyId: string;
}>;
export function validateSigningPrivateKeyPath(input: {
  workspaceRoot: string;
  artifactRoot: string;
  privateKeyPath: string;
}): Promise<string>;
export function signBuildManifest(
  manifest: BuildManifest,
  privateKeyPem: string,
  keyId: string,
): SignedBuildManifest;
export function verifySignedBuildManifest(input: {
  envelope: unknown;
  trustedPublicKeys: ReadonlyMap<string, string> | Record<string, string>;
}): BuildManifest;
export function loadTrustedPublicKeys(
  filePath: string,
): Promise<Map<string, string>>;
export function compareLifecycleSafetyVersions(
  left: string,
  right: string,
): number;
export function verifyStartupRelease(input: {
  releaseRoot: string;
  runtimeRoot: string;
  manifestPath: string;
  trustedPublicKeysPath: string;
  expected: StartupVerificationExpectation;
}): Promise<StartupVerificationResult>;
