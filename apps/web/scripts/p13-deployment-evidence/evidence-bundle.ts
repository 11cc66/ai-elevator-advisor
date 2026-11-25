import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";

import {
  BuildIntegrityError,
  canonicalize,
  compareLifecycleSafetyVersions,
  P13_LIFECYCLE_SAFETY_VERSION,
  verifySignedBuildManifest,
} from "@elevator/build-integrity";
import { z } from "zod";

export const EVIDENCE_BUNDLE_SCHEMA_VERSION = 2;
export const EVIDENCE_BUNDLE_MAX_AGE_MS =
  60 * 60 * 1000;
export const EVIDENCE_ITEM_MAX_AGE_MS =
  24 * 60 * 60 * 1000;
export const EVIDENCE_MAX_FUTURE_SKEW_MS =
  5 * 60 * 1000;
export const EVIDENCE_MAX_COLLECTION_SKEW_MS =
  30 * 60 * 1000;
export const QUEUE_SNAPSHOT_MAX_AGE_MS =
  15 * 60 * 1000;

const isoDateTime = z.string().refine(
  (value) =>
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value)),
  "Expected an ISO-8601 timestamp.",
);

const nullableIsoDateTime = isoDateTime.nullable();
const digest = z.string().regex(/^[0-9a-f]{64}$/i);
const lifecycleSafetyVersion = z
  .string()
  .regex(/^\d+(?:\.\d+){0,2}$/);
const absolutePath = z.string().refine(
  (value) =>
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith("\\\\") ||
    value.startsWith("/"),
  "Expected an absolute path.",
);
const nonEmpty = z.string().min(1).refine(
  (value) => !value.includes("\0"),
  "Control characters are forbidden.",
);

export const EVIDENCE_CATEGORIES = [
  "HOST_INVENTORY",
  "WEB_INSTANCE",
  "WORKER_INSTANCE",
  "PROCESS_INVENTORY",
  "STARTUP_ENTRY",
  "ARTIFACT_IDENTITY",
  "RELEASE_MANIFEST",
  "TRUST_ROOT",
  "RELEASE_ROOT",
  "RUNTIME_IDENTITY",
  "STORAGE_ACL",
  "SCHEDULER",
  "WATCHDOG",
  "AUTO_RESTART",
  "QUEUE_STATE",
  "RUNNING_JOBS",
  "RETRY_JOBS",
  "NETWORK_AND_DEPENDENCY",
  "DRAIN_APPROVAL",
] as const;

export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

const provenanceSchema = z
  .object({
    evidenceId: nonEmpty,
    category: z.enum(EVIDENCE_CATEGORIES),
    hostId: nonEmpty,
    collectedAt: isoDateTime,
    collectorIdentity: nonEmpty,
    collectorVersion: nonEmpty,
    collectionMethod: nonEmpty,
    trustLevel: z.number().int().min(0).max(4),
  })
  .strict();

const hostSchema = provenanceSchema
  .extend({
    hostRole: z.enum(["WEB", "WORKER", "WEB_AND_WORKER", "CONTROL"]),
    operatingSystem: nonEmpty,
    environment: z.enum(["PRODUCTION", "STAGING"]),
    region: nonEmpty,
  })
  .strict();

const startupEntrySchema = z.enum([
  "WEB_SECURE_LAUNCHER",
  "WEB_DIRECT_NEXT_START",
  "WORKER_SECURE_LAUNCHER",
  "WORKER_SIGNED_RELEASE_INDEX",
  "WORKER_DIRECT_LEGACY_DIST",
  "WORKER_DIRECT_ENTRY",
  "UNKNOWN",
]);

const processSchema = provenanceSchema
  .extend({
    processKey: nonEmpty,
    processId: z.number().int().positive(),
    parentProcessId: z.number().int().nonnegative().nullable(),
    executable: absolutePath,
    commandLine: nonEmpty.nullable(),
    workingDirectory: absolutePath,
    runtimeIdentityId: nonEmpty,
    startupEntry: startupEntrySchema,
    artifactId: nonEmpty.nullable(),
  })
  .strict();

const serviceSchema = provenanceSchema
  .extend({
    serviceId: nonEmpty,
    hostId: nonEmpty,
    state: z.enum(["RUNNING", "STOPPED", "UNKNOWN"]),
    startMode: nonEmpty,
    automaticRestart: z.boolean(),
    targetArtifactId: nonEmpty.nullable(),
    targetEntry: startupEntrySchema,
    restartPolicy: nonEmpty,
  })
  .strict();

const schedulerSchema = provenanceSchema
  .extend({
    schedulerId: nonEmpty,
    hostId: nonEmpty,
    schedulerType: z.enum([
      "WINDOWS_SERVICE",
      "TASK_SCHEDULER",
      "PM2",
      "DOCKER",
      "KUBERNETES",
      "CRON",
      "SYSTEMD",
      "SUPERVISOR",
      "WATCHDOG",
      "CI_CD",
      "CLOUD_SCHEDULER",
      "OTHER",
      "UNKNOWN",
    ]),
    jobName: nonEmpty,
    schedule: nonEmpty,
    command: nonEmpty,
    workingDirectory: absolutePath.nullable(),
    targetArtifactId: nonEmpty.nullable(),
    targetEntry: startupEntrySchema,
    restartPolicy: nonEmpty,
    enabled: z.boolean(),
    lastExecutionAt: nullableIsoDateTime,
    nextExecutionAt: nullableIsoDateTime,
    evidenceSource: nonEmpty,
  })
  .strict();

const watchdogSchema = provenanceSchema
  .extend({
    watchdogId: nonEmpty,
    hostId: nonEmpty,
    watchdogType: z.enum([
      "WINDOWS_SERVICE",
      "TASK_SCHEDULER",
      "PM2",
      "DOCKER",
      "KUBERNETES",
      "SYSTEMD",
      "SUPERVISOR",
      "EXTERNAL",
      "UNKNOWN",
    ]),
    enabled: z.boolean(),
    targetArtifactId: nonEmpty.nullable(),
    restartPolicy: nonEmpty,
  })
  .strict();

const instanceSchema = provenanceSchema
  .extend({
    instanceId: nonEmpty,
    hostId: nonEmpty,
    kind: z.enum(["WEB", "WORKER", "MAINTENANCE"]),
    processKey: nonEmpty,
    runtimeIdentityId: nonEmpty,
    startupEntry: startupEntrySchema,
    artifactId: nonEmpty.nullable(),
    releaseRootId: nonEmpty,
    releaseId: nonEmpty.nullable(),
    buildId: nonEmpty.nullable(),
    manifestDigest: digest.nullable(),
    artifactDigest: digest.nullable(),
    runtimeDependencyDigest: digest.nullable(),
    lifecycleSafetyVersion: lifecycleSafetyVersion.nullable(),
    processStartedAt: isoDateTime,
    automaticRestartId: nonEmpty.nullable(),
  })
  .strict();

const trustKeySchema = z
  .object({
    keyId: nonEmpty,
    publicKeyPem: nonEmpty.refine((value) => {
      try {
        return (
          createPublicKey(value).asymmetricKeyType === "ed25519"
        );
      } catch {
        return false;
      }
    }, "Expected an Ed25519 public key."),
    fingerprintSha256: digest,
    validFrom: isoDateTime,
    validTo: isoDateTime,
    status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]),
  })
  .strict();

const trustRootSchema = provenanceSchema
  .extend({
    trustRootId: nonEmpty,
    location: absolutePath,
    readPrincipals: z.array(nonEmpty).min(1),
    modifyingPrincipals: z.array(nonEmpty).min(1),
    lastRotatedAt: isoDateTime.nullable(),
    keys: z.array(trustKeySchema).min(1),
  })
  .strict();

const artifactSchema = provenanceSchema
  .extend({
    artifactId: nonEmpty,
    application: z.enum(["web", "worker"]),
    location: absolutePath,
    releaseId: nonEmpty,
    buildId: nonEmpty,
    sourceTreeDigest: digest,
    artifactDigest: digest,
    runtimeDependencyDigest: digest,
    manifestSchemaVersion: z.literal(1),
    manifestEnvelope: z.unknown().refine(
      (value) => value !== undefined,
      "Manifest envelope is required.",
    ),
    trustRootId: nonEmpty,
    keyId: nonEmpty,
    lifecycleSafetyVersion,
    legacyDeleteMarkerCount: z.number().int().nonnegative(),
    startupGateStatus: z.enum([
      "VERIFIED",
      "FAILED",
      "UNKNOWN",
    ]),
    cleanupCapability: z.enum(["DISABLED", "ENABLED", "UNKNOWN"]),
    productionStatus: z.enum([
      "CURRENT",
      "LEGACY",
      "QUARANTINED",
      "UNKNOWN",
    ]),
    canStartDirectly: z.boolean(),
    canBeRestarted: z.boolean(),
  })
  .strict();

const releaseRootSchema = provenanceSchema
  .extend({
    releaseRootId: nonEmpty,
    location: absolutePath,
    ownerIdentityId: nonEmpty,
    modifyingIdentityIds: z.array(nonEmpty),
    readingIdentityIds: z.array(nonEmpty),
    runtimeWriteDeniedVerified: z.boolean(),
    parentWriteDeniedVerified: z.boolean(),
    runtimeDeleteDeniedVerified: z.boolean(),
    reparsePointFreeVerified: z.boolean(),
    atomicSwitchVerified: z.boolean(),
  })
  .strict();

const runtimeIdentitySchema = provenanceSchema
  .extend({
    runtimeIdentityId: nonEmpty,
    hostId: nonEmpty,
    role: z.enum([
      "BUILD_IDENTITY",
      "RELEASE_SIGNER_IDENTITY",
      "WEB_RUNTIME_IDENTITY",
      "WORKER_RUNTIME_IDENTITY",
      "MAINTENANCE_RUNTIME_IDENTITY",
      "FUTURE_CLEANUP_IDENTITY",
      "DEPLOYMENT_ADMIN_IDENTITY",
      "TRUST_ROOT_ADMIN_IDENTITY",
    ]),
    account: nonEmpty,
    sharedAccount: z.boolean(),
    releaseRootRead: z.boolean(),
    releaseRootWrite: z.boolean(),
    trustRootRead: z.boolean(),
    trustRootWrite: z.boolean(),
    storagePhysicalDelete: z.enum([
      "DENIED_VERIFIED",
      "ALLOWED_VERIFIED",
      "UNKNOWN",
    ]),
    cleanupCapability: z.enum(["DISABLED", "ENABLED", "UNKNOWN"]),
  })
  .strict();

const permissionsSchema = z
  .object({
    read: z.boolean(),
    create: z.boolean(),
    write: z.boolean(),
    rename: z.boolean(),
    delete: z.boolean(),
    modifyAcl: z.boolean(),
    changeOwner: z.boolean(),
  })
  .strict();

const storageAclSchema = provenanceSchema
  .extend({
    aclId: nonEmpty,
    hostId: nonEmpty,
    runtimeIdentityId: nonEmpty,
    resourceType: z.enum([
      "RELEASE_ROOT",
      "TRUST_ROOT",
      "STORAGE_STAGING",
      "STORAGE_CANONICAL",
      "STORAGE_TEMP",
    ]),
    path: absolutePath,
    permissions: permissionsSchema,
    inheritanceEnabled: z.boolean(),
    parentWidePermission: z.boolean(),
    reparsePointPresent: z.boolean(),
    externalObjectStore: z.boolean(),
    aclModifierIdentityIds: z.array(nonEmpty),
  })
  .strict();

const queueSnapshotSchema = provenanceSchema
  .extend({
    snapshotId: nonEmpty,
    snapshotAt: isoDateTime,
    source: nonEmpty,
    waitingJobs: z.number().int().nonnegative(),
    activeJobs: z.number().int().nonnegative(),
    retryJobs: z.number().int().nonnegative(),
    failedJobs: z.number().int().nonnegative(),
    scheduledJobs: z.number().int().nonnegative(),
    oldestJobAt: nullableIsoDateTime,
    workerConsumptionRate: z.number().nonnegative(),
    unfinishedOperations: z.number().int().nonnegative(),
    activeUploads: z.number().int().nonnegative(),
    processingRecoveryStatus: z.enum([
      "IDLE",
      "RUNNING",
      "UNKNOWN",
    ]),
  })
  .strict();

const runningJobSchema = provenanceSchema
  .extend({
    jobId: nonEmpty,
    hostId: nonEmpty,
    jobType: nonEmpty,
    status: z.enum([
      "WAITING",
      "ACTIVE",
      "RETRY",
      "FAILED",
      "SCHEDULED",
      "COMPLETE",
      "UNKNOWN",
    ]),
    legacyJob: z.boolean(),
    startedAt: nullableIsoDateTime,
    workerInstanceId: nonEmpty.nullable(),
  })
  .strict();

const networkDependencySchema = provenanceSchema
  .extend({
    dependencyId: nonEmpty,
    dependencyType: z.enum([
      "DATABASE",
      "QUEUE",
      "STORAGE",
      "HTTP",
      "OTHER",
    ]),
    target: nonEmpty,
    legacyWorkerReachable: z.boolean().nullable(),
  })
  .strict();

const approvalSchema = provenanceSchema
  .extend({
    approvalId: nonEmpty,
    bundleId: nonEmpty,
    scope: z.literal("LEGACY_DRAIN"),
    approverIdentity: nonEmpty,
    approverRole: nonEmpty,
    independent: z.boolean(),
    approvedAt: isoDateTime,
  })
  .strict();

const coverageSchema = z
  .object({
    hostInventoryComplete: z.boolean(),
    instanceInventoryComplete: z.boolean(),
    schedulerInventoryComplete: z.boolean(),
    watchdogInventoryComplete: z.boolean(),
    autoRestartInventoryComplete: z.boolean(),
    artifactInventoryComplete: z.boolean(),
    sourceEvidenceId: nonEmpty,
    collectedAt: isoDateTime,
  })
  .strict();

const evidenceSignatureSchema = z
  .object({
    algorithm: z.literal("ed25519"),
    keyId: nonEmpty,
    value: nonEmpty,
  })
  .strict()
  .nullable();

const bundleSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_BUNDLE_SCHEMA_VERSION),
    bundleId: nonEmpty,
    createdAt: isoDateTime,
    coverage: coverageSchema,
    hosts: z.array(hostSchema).min(1),
    processes: z.array(processSchema),
    services: z.array(serviceSchema),
    schedulers: z.array(schedulerSchema),
    watchdogs: z.array(watchdogSchema),
    instances: z.array(instanceSchema),
    artifacts: z.array(artifactSchema),
    trustRoots: z.array(trustRootSchema),
    releaseRoots: z.array(releaseRootSchema),
    runtimeIdentities: z.array(runtimeIdentitySchema),
    storageAcls: z.array(storageAclSchema),
    queueSnapshots: z.array(queueSnapshotSchema),
    runningJobs: z.array(runningJobSchema),
    networkDependencies: z.array(networkDependencySchema),
    approvals: z.array(approvalSchema),
    integrity: z
      .object({
        algorithm: z.literal("sha256"),
        digest,
      })
      .strict(),
    signature: evidenceSignatureSchema,
  })
  .strict();

const evidenceVerificationTrustSchema = z
  .object({
    signerPublicKeys: z.record(
      z.string().min(1),
      z
        .string()
        .refine((value) => {
          if (
            !value.includes("PUBLIC KEY") ||
            value.includes("PRIVATE KEY")
          ) {
            return false;
          }
          try {
            return (
              createPublicKey(value).asymmetricKeyType === "ed25519"
            );
          } catch {
            return false;
          }
        }, "Expected an Ed25519 public key PEM."),
    ),
    trustedCollectorIdentities: z.array(nonEmpty).min(1),
  })
  .strict();

export type EvidenceBundle = z.infer<typeof bundleSchema>;
export type EvidenceProvenance = z.infer<typeof provenanceSchema>;
export type RuntimeIdentityEvidence =
  z.infer<typeof runtimeIdentitySchema>;
export type StorageAclEvidence = z.infer<typeof storageAclSchema>;

export interface EvidenceBundleDiagnostic {
  code: string;
  path: string;
  message: string;
  section: EvidenceReadinessSection;
}

export type EvidenceReadinessSection =
  | "EvidenceIntegrity"
  | "HostInventory"
  | "InstanceInventory"
  | "SchedulerWatchdog"
  | "AutomaticRestart"
  | "ArtifactVerification"
  | "TrustRoot"
  | "RuntimeIdentity"
  | "StorageAcl"
  | "LegacyQueue"
  | "DrainApproval"
  | "ReleaseRoot";

export interface EvidenceBundleVerificationResult {
  productionEvidenceStatus: "COMPLETE" | "PARTIAL" | "BLOCKED";
  drainReadiness: "READY FOR HUMAN REVIEW" | "BLOCKED";
  productionDrain: "NOT EXECUTED";
  blockers: EvidenceBundleDiagnostic[];
  warnings: EvidenceBundleDiagnostic[];
  sections: Record<
    EvidenceReadinessSection,
    {
      status: "COMPLETE" | "BLOCKED";
      blockerCount: number;
    }
  >;
  summary: {
    hostCount: number;
    processCount: number;
    instanceCount: number;
    currentArtifactCount: number;
    legacyArtifactCount: number;
    enabledLegacySchedulerCount: number;
    legacyAutoRestartCount: number;
    approvalCount: number;
  };
}

export interface EvidenceVerificationTrust {
  signerPublicKeys: Readonly<Record<string, string>>;
  trustedCollectorIdentities: readonly string[];
}

export function parseEvidenceVerificationTrust(
  input: unknown,
): EvidenceVerificationTrust {
  return evidenceVerificationTrustSchema.parse(input);
}

const itemArrayKeys = [
  "hosts",
  "processes",
  "services",
  "schedulers",
  "watchdogs",
  "instances",
  "artifacts",
  "trustRoots",
  "releaseRoots",
  "runtimeIdentities",
  "storageAcls",
  "queueSnapshots",
  "runningJobs",
  "networkDependencies",
  "approvals",
] as const;

function withoutIntegrityAndSignature(
  bundle: Record<string, unknown>,
): Record<string, unknown> {
  const {
    integrity: _integrity,
    signature: _signature,
    ...body
  } = bundle;
  return body;
}

function withoutSignature(
  bundle: Record<string, unknown>,
): Record<string, unknown> {
  const { signature: _signature, ...body } = bundle;
  return body;
}

export function computeEvidenceBundleDigest(
  input: Record<string, unknown>,
): string {
  return createHash("sha256")
    .update(canonicalize(withoutIntegrityAndSignature(input)))
    .digest("hex");
}

export function sealEvidenceBundleDraft(
  draft: Record<string, unknown>,
): EvidenceBundle {
  if (typeof draft.createdAt !== "string") {
    throw new Error("EVIDENCE_BUNDLE_CREATED_AT_REQUIRED");
  }
  const body = {
    ...draft,
    schemaVersion: EVIDENCE_BUNDLE_SCHEMA_VERSION,
    integrity: {
      algorithm: "sha256" as const,
      digest: "0".repeat(64),
    },
    signature: null,
  };
  body.integrity.digest = computeEvidenceBundleDigest(body);
  return bundleSchema.parse(body);
}

export function signEvidenceBundle(
  bundle: EvidenceBundle,
  input: {
    keyId: string;
    privateKeyPem: string;
  },
): EvidenceBundle {
  if (!input.privateKeyPem.includes("PRIVATE KEY")) {
    throw new Error("EVIDENCE_SIGNING_KEY_INVALID");
  }
  const privateKey = createPrivateKey(input.privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("EVIDENCE_SIGNING_KEY_INVALID");
  }
  const body = withoutSignature(bundle as unknown as Record<string, unknown>);
  const signatureValue = sign(
    null,
    Buffer.from(canonicalize(body), "utf8"),
    privateKey,
  );
  return bundleSchema.parse({
    ...bundle,
    signature: {
      algorithm: "ed25519",
      keyId: input.keyId,
      value: signatureValue.toString("base64url"),
    },
  });
}

export function verifyEvidenceBundleSignature(
  bundle: EvidenceBundle,
  trustedSignerPublicKeys: Readonly<Record<string, string>>,
): { valid: boolean; code: string } {
  if (!bundle.signature) {
    return { valid: false, code: "EVIDENCE_SIGNATURE_MISSING" };
  }
  const publicKeyPem =
    trustedSignerPublicKeys[bundle.signature.keyId];
  if (!publicKeyPem) {
    return { valid: false, code: "EVIDENCE_SIGNER_UNTRUSTED" };
  }
  try {
    const valid = verify(
      null,
      Buffer.from(
        canonicalize(
          withoutSignature(
            bundle as unknown as Record<string, unknown>,
          ),
        ),
        "utf8",
      ),
      createPublicKey(publicKeyPem),
      Buffer.from(bundle.signature.value, "base64url"),
    );
    return valid
      ? { valid: true, code: "EVIDENCE_SIGNATURE_VALID" }
      : { valid: false, code: "EVIDENCE_SIGNATURE_INVALID" };
  } catch {
    return { valid: false, code: "EVIDENCE_SIGNATURE_INVALID" };
  }
}

function sha256PublicKey(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({
    format: "der",
    type: "spki",
  });
  return createHash("sha256").update(der).digest("hex");
}

function normalizePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "");
  return process.platform === "win32"
    ? normalized.toLowerCase()
    : normalized;
}

function pathInside(parent: string, candidate: string): boolean {
  const normalizedParent = normalizePath(parent);
  const normalizedCandidate = normalizePath(candidate);
  return (
    normalizedCandidate === normalizedParent ||
    normalizedCandidate.startsWith(`${normalizedParent}/`)
  );
}

function sensitiveFinding(
  value: unknown,
  pathName = "$",
): { code: string; path: string; message: string } | null {
  const safeKeys = new Set([
    "manifestEnvelope",
    "publicKeyPem",
    "fingerprintSha256",
  ]);
  const keyPattern =
    /(?:password|passwd|secret|token|api[_-]?key|connection[_-]?string|database[_-]?url|private[_-]?key)/i;
  if (typeof value === "string") {
    if (
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value) ||
      /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i.test(value) ||
      /\bpostgres(?:ql)?:\/\/[^/\s:@]+:[^/\s@]+@/i.test(value)
    ) {
      return {
        code: "EVIDENCE_SECRET_DETECTED",
        path: pathName,
        message: "Evidence contains secret-like content.",
      };
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const finding = sensitiveFinding(item, `${pathName}[${index}]`);
      if (finding) {
        return finding;
      }
    }
    return null;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      const itemPath = `${pathName}.${key}`;
      if (
        keyPattern.test(key) &&
        !safeKeys.has(key) &&
        typeof item !== "boolean" &&
        item !== null
      ) {
        return {
          code: "EVIDENCE_SECRET_FIELD_DETECTED",
          path: itemPath,
          message: "Evidence contains a forbidden secret field.",
        };
      }
      const finding = sensitiveFinding(item, itemPath);
      if (finding) {
        return finding;
      }
    }
  }
  return null;
}

function categoryForItemArray(key: (typeof itemArrayKeys)[number]) {
  switch (key) {
    case "hosts":
      return "HOST_INVENTORY";
    case "processes":
      return "PROCESS_INVENTORY";
    case "schedulers":
      return "SCHEDULER";
    case "watchdogs":
      return "WATCHDOG";
    case "instances":
      return "STARTUP_ENTRY";
    case "artifacts":
      return "ARTIFACT_IDENTITY";
    case "trustRoots":
      return "TRUST_ROOT";
    case "releaseRoots":
      return "RELEASE_ROOT";
    case "runtimeIdentities":
      return "RUNTIME_IDENTITY";
    case "storageAcls":
      return "STORAGE_ACL";
    case "queueSnapshots":
      return "QUEUE_STATE";
    case "runningJobs":
      return "RUNNING_JOBS";
    case "networkDependencies":
      return "NETWORK_AND_DEPENDENCY";
    case "approvals":
      return "DRAIN_APPROVAL";
    default:
      return null;
  }
}

function addBlocker(
  blockers: EvidenceBundleDiagnostic[],
  section: EvidenceReadinessSection,
  code: string,
  pathName: string,
  message: string,
): void {
  blockers.push({ code, path: pathName, message, section });
}

function addWarning(
  warnings: EvidenceBundleDiagnostic[],
  section: EvidenceReadinessSection,
  code: string,
  pathName: string,
  message: string,
): void {
  warnings.push({ code, path: pathName, message, section });
}

export function verifyEvidenceBundle(
  input: unknown,
  options: {
    trust: EvidenceVerificationTrust;
    now?: Date;
  },
): EvidenceBundleVerificationResult {
  const now = options.now ?? new Date();
  const blockers: EvidenceBundleDiagnostic[] = [];
  const warnings: EvidenceBundleDiagnostic[] = [];
  const secret = sensitiveFinding(input);
  if (secret) {
    addBlocker(
      blockers,
      "EvidenceIntegrity",
      secret.code,
      secret.path,
      secret.message,
    );
  }
  const parsed = bundleSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      addBlocker(
        blockers,
        "EvidenceIntegrity",
        "EVIDENCE_SCHEMA_INVALID",
        issue.path.join("."),
        issue.message,
      );
    }
    return finish(
      parsedInputSummary(input),
      blockers,
      warnings,
      true,
    );
  }
  const bundle = parsed.data;
  const body = bundle as unknown as Record<string, unknown>;
  const expectedDigest = computeEvidenceBundleDigest(body);
  if (bundle.integrity.digest.toLowerCase() !== expectedDigest) {
    addBlocker(
      blockers,
      "EvidenceIntegrity",
      "EVIDENCE_DIGEST_MISMATCH",
      "$.integrity.digest",
      "Evidence bundle checksum does not match its body.",
    );
  }
  const signature = verifyEvidenceBundleSignature(
    bundle,
    options.trust.signerPublicKeys,
  );
  if (!signature.valid) {
    addBlocker(
      blockers,
      "EvidenceIntegrity",
      signature.code,
      "$.signature",
      "Evidence bundle signature is not independently trusted.",
    );
  }
  const createdAt = Date.parse(bundle.createdAt);
  if (
    createdAt > now.getTime() + EVIDENCE_MAX_FUTURE_SKEW_MS
  ) {
    addBlocker(
      blockers,
      "EvidenceIntegrity",
      "EVIDENCE_TIMESTAMP_IN_FUTURE",
      "$.createdAt",
      "Evidence bundle creation time is in the future.",
    );
  } else if (now.getTime() - createdAt > EVIDENCE_BUNDLE_MAX_AGE_MS) {
    addBlocker(
      blockers,
      "EvidenceIntegrity",
      "EVIDENCE_STALE",
      "$.createdAt",
      "Evidence bundle is outside its freshness window.",
    );
  }

  const allItems = itemArrayKeys.flatMap((key) =>
    bundle[key].map((item, index) => ({
      key,
      index,
      item,
    })),
  );
  const evidenceIds = new Set<string>();
  const collectionTimes: number[] = [];
  for (const { key, index, item } of allItems) {
    const provenance = item as EvidenceProvenance;
    const prefix = `$.${key}[${index}].provenance`;
    if (evidenceIds.has(provenance.evidenceId)) {
      addBlocker(
        blockers,
        "EvidenceIntegrity",
        "DUPLICATE_EVIDENCE_ID",
        prefix,
        "Evidence IDs must be unique.",
      );
    }
    evidenceIds.add(provenance.evidenceId);
    const expectedCategory =
      key === "instances" && "kind" in item
        ? item.kind === "WEB"
          ? "WEB_INSTANCE"
          : "WORKER_INSTANCE"
        : categoryForItemArray(key);
    if (
      expectedCategory &&
      provenance.category !== expectedCategory
    ) {
      addBlocker(
        blockers,
        "EvidenceIntegrity",
        "EVIDENCE_CATEGORY_MISMATCH",
        prefix,
        "Evidence category does not match its collection.",
      );
    }
    if (
      !options.trust.trustedCollectorIdentities.includes(
        provenance.collectorIdentity,
      )
    ) {
      addBlocker(
        blockers,
        "EvidenceIntegrity",
        "EVIDENCE_COLLECTOR_UNTRUSTED",
        prefix,
        "Collector identity is not independently trusted.",
      );
    }
    if (provenance.trustLevel < 3) {
      addBlocker(
        blockers,
        "EvidenceIntegrity",
        "EVIDENCE_TRUST_LEVEL_INSUFFICIENT",
        prefix,
        "Critical evidence requires trust level 3 or 4.",
      );
    }
    const collectedAt = Date.parse(provenance.collectedAt);
    if (
      collectedAt > now.getTime() + EVIDENCE_MAX_FUTURE_SKEW_MS
    ) {
      addBlocker(
        blockers,
        "EvidenceIntegrity",
        "COLLECTED_AT_FUTURE",
        prefix,
        "Item collection time is in the future.",
      );
    } else if (now.getTime() - collectedAt > EVIDENCE_ITEM_MAX_AGE_MS) {
      addBlocker(
        blockers,
        "EvidenceIntegrity",
        "COLLECTED_AT_STALE",
        prefix,
        "Item collection time is stale.",
      );
    }
    collectionTimes.push(collectedAt);
  }
  if (
    collectionTimes.length > 0 &&
    Math.max(...collectionTimes) - Math.min(...collectionTimes) >
      EVIDENCE_MAX_COLLECTION_SKEW_MS
  ) {
    addBlocker(
      blockers,
      "EvidenceIntegrity",
      "CROSS_HOST_COLLECTION_SKEW",
      "$",
      "Evidence collection times exceed the allowed cross-host skew.",
    );
  }
  const coverage = bundle.coverage;
  for (const [name, value] of Object.entries({
    hostInventoryComplete: coverage.hostInventoryComplete,
    instanceInventoryComplete: coverage.instanceInventoryComplete,
    schedulerInventoryComplete: coverage.schedulerInventoryComplete,
    watchdogInventoryComplete: coverage.watchdogInventoryComplete,
    autoRestartInventoryComplete:
      coverage.autoRestartInventoryComplete,
    artifactInventoryComplete: coverage.artifactInventoryComplete,
  })) {
    if (!value) {
      addBlocker(
        blockers,
        "HostInventory",
        "INVENTORY_COVERAGE_INCOMPLETE",
        `$.coverage.${name}`,
        "Inventory coverage must be explicitly verified complete.",
      );
    }
  }
  if (!evidenceIds.has(coverage.sourceEvidenceId)) {
    addBlocker(
      blockers,
      "HostInventory",
      "COVERAGE_SOURCE_UNKNOWN",
      "$.coverage.sourceEvidenceId",
      "Coverage statement does not reference a known evidence item.",
    );
  }

  const hosts = new Map(bundle.hosts.map((host) => [host.hostId, host]));
  for (const host of bundle.hosts) {
    if (host.environment !== "PRODUCTION") {
      addBlocker(
        blockers,
        "HostInventory",
        "NON_PRODUCTION_HOST_INCLUDED",
        `$.hosts.${host.hostId}`,
        "Production drain bundle contains a non-production host.",
      );
    }
  }
  function requireHost(
    hostId: string,
    section: EvidenceReadinessSection,
    pathName: string,
  ): void {
    if (!hosts.has(hostId)) {
      addBlocker(
        blockers,
        section,
        "UNKNOWN_HOST_REFERENCE",
        pathName,
        "Evidence references a host absent from host inventory.",
      );
    }
  }
  for (const { key, index, item } of allItems) {
    const provenance = item as EvidenceProvenance;
    requireHost(
      provenance.hostId,
      "EvidenceIntegrity",
      `$.${key}[${index}].hostId`,
    );
  }

  const processKeys = new Set<string>();
  for (const process of bundle.processes) {
    requireHost(process.hostId, "InstanceInventory", "$.processes");
    if (processKeys.has(process.processKey)) {
      addBlocker(
        blockers,
        "InstanceInventory",
        "DUPLICATE_PROCESS_ID",
        `$.processes.${process.processKey}`,
        "Process identity must be unique per host.",
      );
    }
    processKeys.add(process.processKey);
  }

  const artifacts = new Map(
    bundle.artifacts.map((artifact) => [
      artifact.artifactId,
      artifact,
    ]),
  );
  const trustRoots = new Map(
    bundle.trustRoots.map((root) => [root.trustRootId, root]),
  );
  const releaseRoots = new Map(
    bundle.releaseRoots.map((root) => [root.releaseRootId, root]),
  );
  let currentArtifactCount = 0;
  let legacyArtifactCount = 0;
  for (const artifact of bundle.artifacts) {
    const trustRoot = trustRoots.get(artifact.trustRootId);
    if (!trustRoot) {
      addBlocker(
        blockers,
        "TrustRoot",
        "ARTIFACT_TRUST_ROOT_UNKNOWN",
        `$.artifacts.${artifact.artifactId}`,
        "Artifact references an unknown Trust Root.",
      );
      continue;
    }
    if (artifact.productionStatus === "UNKNOWN") {
      addBlocker(
        blockers,
        "ArtifactVerification",
        "ARTIFACT_IDENTITY_UNKNOWN",
        `$.artifacts.${artifact.artifactId}`,
        "Artifact production identity remains unknown.",
      );
    }
    if (artifact.productionStatus === "CURRENT") {
      currentArtifactCount += 1;
    } else {
      legacyArtifactCount += 1;
      if (artifact.canStartDirectly || artifact.canBeRestarted) {
        addBlocker(
          blockers,
          "ArtifactVerification",
          "LEGACY_ARTIFACT_REACHABLE",
          `$.artifacts.${artifact.artifactId}`,
          "Legacy artifact remains directly startable or restartable.",
        );
      }
    }
    const keys = new Map(
      trustRoot.keys.map((key) => [key.keyId, key]),
    );
    const matchingKey = keys.get(artifact.keyId);
    if (!matchingKey) {
      addBlocker(
        blockers,
        "TrustRoot",
        "ARTIFACT_KEY_ID_UNKNOWN",
        `$.artifacts.${artifact.artifactId}.keyId`,
        "Artifact key ID is absent from its Trust Root.",
      );
      continue;
    }
    const nowMs = now.getTime();
    if (
      matchingKey.status !== "ACTIVE" ||
      Date.parse(matchingKey.validFrom) > nowMs ||
      Date.parse(matchingKey.validTo) < nowMs
    ) {
      addBlocker(
        blockers,
        "TrustRoot",
        "ARTIFACT_KEY_NOT_ACTIVE",
        `$.trustRoots.${trustRoot.trustRootId}.keys.${matchingKey.keyId}`,
        "Artifact signing key is revoked, expired, or outside validity.",
      );
    }
    try {
      const actualFingerprint = sha256PublicKey(
        matchingKey.publicKeyPem,
      );
      if (
        actualFingerprint.toLowerCase() !==
        matchingKey.fingerprintSha256.toLowerCase()
      ) {
        addBlocker(
          blockers,
          "TrustRoot",
          "TRUST_KEY_FINGERPRINT_MISMATCH",
          `$.trustRoots.${trustRoot.trustRootId}.keys.${matchingKey.keyId}`,
          "Trusted public key fingerprint does not match.",
        );
      }
      const manifest = verifySignedBuildManifest({
        envelope: artifact.manifestEnvelope,
        trustedPublicKeys: Object.fromEntries(
          trustRoot.keys
            .filter((key) => key.status === "ACTIVE")
            .map((key) => [key.keyId, key.publicKeyPem]),
        ),
      });
      const envelope = artifact.manifestEnvelope;
      const envelopeKeyId =
        typeof envelope === "object" &&
        envelope !== null &&
        "signature" in envelope &&
        typeof envelope.signature === "object" &&
        envelope.signature !== null &&
        "keyId" in envelope.signature &&
        typeof envelope.signature.keyId === "string"
          ? envelope.signature.keyId
          : null;
      if (envelopeKeyId !== artifact.keyId) {
        addBlocker(
          blockers,
          "TrustRoot",
          "ARTIFACT_MANIFEST_KEY_MISMATCH",
          `$.artifacts.${artifact.artifactId}.keyId`,
          "Manifest signing key does not match Artifact evidence.",
        );
      }
      const manifestTimestamp = Date.parse(manifest.buildTimestamp);
      if (
        manifestTimestamp > now.getTime() + EVIDENCE_MAX_FUTURE_SKEW_MS ||
        now.getTime() - manifestTimestamp > 365 * 24 * 60 * 60 * 1000
      ) {
        addBlocker(
          blockers,
          "ArtifactVerification",
          "ARTIFACT_MANIFEST_TIMESTAMP_INVALID",
          `$.artifacts.${artifact.artifactId}.manifestEnvelope`,
          "Manifest build time is in the future or outside release age policy.",
        );
      }
      if (
        compareLifecycleSafetyVersions(
          artifact.lifecycleSafetyVersion,
          P13_LIFECYCLE_SAFETY_VERSION,
        ) < 0
      ) {
        addBlocker(
          blockers,
          "ArtifactVerification",
          "LIFECYCLE_SAFETY_VERSION_TOO_OLD",
          `$.artifacts.${artifact.artifactId}.lifecycleSafetyVersion`,
          "Artifact lifecycle safety version is too old.",
        );
      }
      if (
        manifest.application !== artifact.application ||
        manifest.releaseId !== artifact.releaseId ||
        manifest.buildId !== artifact.buildId ||
        manifest.artifactDigest !== artifact.artifactDigest ||
        manifest.runtimeDependencyDigest !==
          artifact.runtimeDependencyDigest ||
        manifest.sourceTreeDigest !== artifact.sourceTreeDigest ||
        manifest.lifecycleSafetyVersion !==
          artifact.lifecycleSafetyVersion
      ) {
        addBlocker(
          blockers,
          "ArtifactVerification",
          "ARTIFACT_MANIFEST_MISMATCH",
          `$.artifacts.${artifact.artifactId}`,
          "Artifact evidence does not match the independently verified manifest.",
        );
      }
      if (
        artifact.productionStatus === "CURRENT" &&
        (artifact.startupGateStatus !== "VERIFIED" ||
          artifact.cleanupCapability !== "DISABLED" ||
          artifact.legacyDeleteMarkerCount !== 0)
      ) {
        addBlocker(
          blockers,
          "ArtifactVerification",
          "CURRENT_ARTIFACT_UNSAFE",
          `$.artifacts.${artifact.artifactId}`,
          "Current artifact has unsafe Gate, cleanup, or delete-marker evidence.",
        );
      }
    } catch (error) {
      addBlocker(
        blockers,
        "ArtifactVerification",
        error instanceof BuildIntegrityError
          ? error.code
          : "MANIFEST_VERIFICATION_FAILED",
        `$.artifacts.${artifact.artifactId}.manifestEnvelope`,
        "Artifact manifest did not pass independent verification.",
      );
    }
  }
  for (const application of ["web", "worker"] as const) {
    if (
      !bundle.artifacts.some(
        (artifact) =>
          artifact.application === application &&
          artifact.productionStatus === "CURRENT",
      )
    ) {
      addBlocker(
        blockers,
        "ArtifactVerification",
        "CURRENT_ARTIFACT_MISSING",
        "$.artifacts",
        `No CURRENT ${application} artifact is evidenced.`,
      );
    }
  }
  const runtimeIdentities = new Map(
    bundle.runtimeIdentities.map((identity) => [
      identity.runtimeIdentityId,
      identity,
    ]),
  );
  const runtimeAccountPrincipals = new Set(
    [...runtimeIdentities.values()]
      .filter((identity) =>
        [
          "WEB_RUNTIME_IDENTITY",
          "WORKER_RUNTIME_IDENTITY",
          "MAINTENANCE_RUNTIME_IDENTITY",
        ].includes(identity.role),
      )
      .map((identity) => identity.account.toLowerCase()),
  );
  for (const trustRoot of bundle.trustRoots) {
    const keyIds = new Set<string>();
    for (const key of trustRoot.keys) {
      if (keyIds.has(key.keyId)) {
        addBlocker(
          blockers,
          "TrustRoot",
          "DUPLICATE_TRUST_KEY_ID",
          `$.trustRoots.${trustRoot.trustRootId}.keys`,
          "Trust Root key IDs must be unique.",
        );
      }
      keyIds.add(key.keyId);
    }
    if (
      trustRoot.modifyingPrincipals.some((principal) =>
        runtimeAccountPrincipals.has(principal.toLowerCase()),
      )
    ) {
      addBlocker(
        blockers,
        "TrustRoot",
        "TRUST_ROOT_RUNTIME_MODIFIER",
        `$.trustRoots.${trustRoot.trustRootId}.modifyingPrincipals`,
        "A runtime account can modify the Trust Root.",
      );
    }
  }
  for (const releaseRoot of bundle.releaseRoots) {
    if (
      !releaseRoot.runtimeWriteDeniedVerified ||
      !releaseRoot.parentWriteDeniedVerified ||
      !releaseRoot.runtimeDeleteDeniedVerified ||
      !releaseRoot.reparsePointFreeVerified ||
      !releaseRoot.atomicSwitchVerified
    ) {
      addBlocker(
        blockers,
        "ReleaseRoot",
        "RELEASE_ROOT_ACL_NOT_VERIFIED",
        `$.releaseRoots.${releaseRoot.releaseRootId}`,
        "Release Root immutable/atomic/reparse controls are incomplete.",
      );
    }
    for (const identityId of [
      releaseRoot.ownerIdentityId,
      ...releaseRoot.modifyingIdentityIds,
      ...releaseRoot.readingIdentityIds,
    ]) {
      if (!runtimeIdentities.has(identityId)) {
        addBlocker(
          blockers,
          "ReleaseRoot",
          "RELEASE_ROOT_IDENTITY_UNKNOWN",
          `$.releaseRoots.${releaseRoot.releaseRootId}`,
          "Release Root references an unknown identity.",
        );
      }
    }
    if (
      releaseRoot.modifyingIdentityIds.some((identityId) => {
        const role = runtimeIdentities.get(identityId)?.role;
        return (
          role === "WEB_RUNTIME_IDENTITY" ||
          role === "WORKER_RUNTIME_IDENTITY" ||
          role === "MAINTENANCE_RUNTIME_IDENTITY"
        );
      })
    ) {
      addBlocker(
        blockers,
        "ReleaseRoot",
        "RELEASE_ROOT_RUNTIME_MODIFIER",
        `$.releaseRoots.${releaseRoot.releaseRootId}.modifyingIdentityIds`,
        "A runtime identity can modify the Release Root.",
      );
    }
  }
  if (bundle.releaseRoots.length === 0) {
    addBlocker(
      blockers,
      "ReleaseRoot",
      "RELEASE_ROOT_EVIDENCE_MISSING",
      "$.releaseRoots",
      "No Release Root evidence was supplied.",
    );
  }

  const requiredRuntimeRoles = [
    "WEB_RUNTIME_IDENTITY",
    "WORKER_RUNTIME_IDENTITY",
    "MAINTENANCE_RUNTIME_IDENTITY",
  ] as const;
  const runtimeAccounts = new Map<string, string>();
  for (const role of requiredRuntimeRoles) {
    const identity = bundle.runtimeIdentities.find(
      (candidate) => candidate.role === role,
    );
    if (!identity) {
      addBlocker(
        blockers,
        "RuntimeIdentity",
        "RUNTIME_IDENTITY_MISSING",
        "$.runtimeIdentities",
        `Required runtime role ${role} is missing.`,
      );
      continue;
    }
    const normalizedAccount = identity.account.toLowerCase();
    const existingRole = runtimeAccounts.get(normalizedAccount);
    if (existingRole && existingRole !== role) {
      addBlocker(
        blockers,
        "RuntimeIdentity",
        "SHARED_RUNTIME_ACCOUNT",
        `$.runtimeIdentities.${identity.runtimeIdentityId}`,
        "Web, Worker, and Maintenance must not share accounts.",
      );
    }
    runtimeAccounts.set(normalizedAccount, role);
    if (
      identity.sharedAccount ||
      identity.releaseRootWrite ||
      identity.trustRootWrite ||
      identity.storagePhysicalDelete !== "DENIED_VERIFIED" ||
      identity.cleanupCapability !== "DISABLED"
    ) {
      addBlocker(
        blockers,
        "RuntimeIdentity",
        "RUNTIME_IDENTITY_UNSAFE",
        `$.runtimeIdentities.${identity.runtimeIdentityId}`,
        "Runtime identity has shared, write, delete, or cleanup authority.",
      );
    }
  }
  for (const identity of bundle.runtimeIdentities) {
    requireHost(
      identity.hostId,
      "RuntimeIdentity",
      `$.runtimeIdentities.${identity.runtimeIdentityId}`,
    );
  }

  const instanceIds = new Set<string>();
  let enabledLegacySchedulerCount = 0;
  for (const instance of bundle.instances) {
    requireHost(instance.hostId, "InstanceInventory", "$.instances");
    if (instanceIds.has(instance.instanceId)) {
      addBlocker(
        blockers,
        "InstanceInventory",
        "DUPLICATE_INSTANCE_ID",
        `$.instances.${instance.instanceId}`,
        "Instance IDs must be unique.",
      );
    }
    instanceIds.add(instance.instanceId);
    const process = bundle.processes.find(
      (candidate) => candidate.processKey === instance.processKey,
    );
    if (!process) {
      addBlocker(
        blockers,
        "InstanceInventory",
        "INSTANCE_PROCESS_UNKNOWN",
        `$.instances.${instance.instanceId}.processKey`,
        "Instance does not map to process evidence.",
      );
    } else if (
      process.hostId !== instance.hostId ||
      process.startupEntry !== instance.startupEntry ||
      process.artifactId !== instance.artifactId ||
      !process.commandLine
    ) {
      addBlocker(
        blockers,
        "InstanceInventory",
        "INSTANCE_PROCESS_MISMATCH",
        `$.instances.${instance.instanceId}`,
        "Instance and process evidence are inconsistent.",
      );
    }
    const artifact = instance.artifactId
      ? artifacts.get(instance.artifactId)
      : null;
    if (!artifact || artifact.productionStatus !== "CURRENT") {
      addBlocker(
        blockers,
        "InstanceInventory",
        "LEGACY_INSTANCE_PRESENT",
        `$.instances.${instance.instanceId}`,
        "Running instance does not map to a CURRENT verified artifact.",
      );
    }
    if (!releaseRoots.has(instance.releaseRootId)) {
      addBlocker(
        blockers,
        "InstanceInventory",
        "INSTANCE_RELEASE_ROOT_UNKNOWN",
        `$.instances.${instance.instanceId}.releaseRootId`,
        "Instance references an unknown Release Root.",
      );
    }
    if (
      instance.releaseId !== artifact?.releaseId ||
      instance.buildId !== artifact?.buildId ||
      instance.manifestDigest !== artifact?.artifactDigest ||
      instance.artifactDigest !== artifact?.artifactDigest ||
      instance.runtimeDependencyDigest !==
        artifact?.runtimeDependencyDigest ||
      instance.lifecycleSafetyVersion !==
        artifact?.lifecycleSafetyVersion
    ) {
      addBlocker(
        blockers,
        "InstanceInventory",
        "INSTANCE_ARTIFACT_IDENTITY_MISMATCH",
        `$.instances.${instance.instanceId}`,
        "Instance artifact identity does not match its Artifact record.",
      );
    }
    const expectedEntry =
      instance.kind === "WEB"
        ? "WEB_SECURE_LAUNCHER"
        : "WORKER_SIGNED_RELEASE_INDEX";
    if (instance.startupEntry !== expectedEntry) {
      addBlocker(
        blockers,
        "InstanceInventory",
        "STARTUP_ENTRY_UNVERIFIED",
        `$.instances.${instance.instanceId}.startupEntry`,
        "Instance startup entry is not an approved gate-protected entry.",
      );
    }
    const commandLine = process?.commandLine?.toLowerCase() ?? "";
    if (
      commandLine.includes("dist/index.js") ||
      commandLine.includes("worker-entry") ||
      commandLine.includes("next start")
    ) {
      addBlocker(
        blockers,
        "InstanceInventory",
        "DIRECT_STARTUP_ENTRY_DETECTED",
        `$.instances.${instance.instanceId}`,
        "Command line contains a prohibited direct or legacy startup entry.",
      );
    }
  }
  if (!bundle.instances.some((instance) => instance.kind === "WEB")) {
    addBlocker(
      blockers,
      "InstanceInventory",
      "WEB_INSTANCE_MISSING",
      "$.instances",
      "No production Web instance evidence was supplied.",
    );
  }
  if (!bundle.instances.some((instance) => instance.kind === "WORKER")) {
    addBlocker(
      blockers,
      "InstanceInventory",
      "WORKER_INSTANCE_MISSING",
      "$.instances",
      "No production Worker instance evidence was supplied.",
    );
  }

  if (bundle.schedulers.length === 0) {
    addBlocker(
      blockers,
      "SchedulerWatchdog",
      "SCHEDULER_INVENTORY_MISSING",
      "$.schedulers",
      "Scheduler inventory cannot be empty without explicit zero-evidence proof.",
    );
  }
  for (const scheduler of bundle.schedulers) {
    requireHost(scheduler.hostId, "SchedulerWatchdog", "$.schedulers");
    if (scheduler.schedulerType === "UNKNOWN") {
      addBlocker(
        blockers,
        "SchedulerWatchdog",
        "SCHEDULER_STATE_UNKNOWN",
        `$.schedulers.${scheduler.schedulerId}`,
        "Scheduler type or ownership remains unknown.",
      );
    }
    if (
      scheduler.command.toLowerCase().includes("dist/index.js") ||
      scheduler.command.toLowerCase().includes("worker-entry") ||
      scheduler.command.toLowerCase().includes("next start")
    ) {
      addBlocker(
        blockers,
        "SchedulerWatchdog",
        "SCHEDULER_COMMAND_BYPASS",
        `$.schedulers.${scheduler.schedulerId}.command`,
        "Scheduler command contains a prohibited direct startup entry.",
      );
    }
    if (!scheduler.enabled) {
      continue;
    }
    const artifact = scheduler.targetArtifactId
      ? artifacts.get(scheduler.targetArtifactId)
      : null;
    if (!artifact || artifact.productionStatus !== "CURRENT") {
      enabledLegacySchedulerCount += 1;
      addBlocker(
        blockers,
        "SchedulerWatchdog",
        "LEGACY_SCHEDULER_ENABLED",
        `$.schedulers.${scheduler.schedulerId}`,
        "Enabled scheduler does not target a CURRENT artifact.",
      );
    }
    if (
      scheduler.targetEntry === "WEB_DIRECT_NEXT_START" ||
      scheduler.targetEntry === "WORKER_DIRECT_LEGACY_DIST" ||
      scheduler.targetEntry === "WORKER_DIRECT_ENTRY" ||
      scheduler.targetEntry === "UNKNOWN"
    ) {
      addBlocker(
        blockers,
        "SchedulerWatchdog",
        "SCHEDULER_STARTUP_ENTRY_UNSAFE",
        `$.schedulers.${scheduler.schedulerId}.targetEntry`,
        "Scheduler targets a direct or unknown startup entry.",
      );
    }
  }
  if (bundle.watchdogs.length === 0) {
    addBlocker(
      blockers,
      "SchedulerWatchdog",
      "WATCHDOG_INVENTORY_MISSING",
      "$.watchdogs",
      "Watchdog inventory cannot be empty without explicit zero-evidence proof.",
    );
  }
  for (const watchdog of bundle.watchdogs) {
    requireHost(watchdog.hostId, "SchedulerWatchdog", "$.watchdogs");
    if (watchdog.watchdogType === "UNKNOWN") {
      addBlocker(
        blockers,
        "SchedulerWatchdog",
        "WATCHDOG_STATE_UNKNOWN",
        `$.watchdogs.${watchdog.watchdogId}`,
        "Watchdog type or ownership remains unknown.",
      );
    }
    if (!watchdog.enabled) {
      continue;
    }
    const artifact = watchdog.targetArtifactId
      ? artifacts.get(watchdog.targetArtifactId)
      : null;
    if (!artifact || artifact.productionStatus !== "CURRENT") {
      addBlocker(
        blockers,
        "SchedulerWatchdog",
        "LEGACY_WATCHDOG_ENABLED",
        `$.watchdogs.${watchdog.watchdogId}`,
        "Enabled watchdog does not target a CURRENT artifact.",
      );
    }
  }

  let legacyAutoRestartCount = 0;
  for (const service of bundle.services) {
    if (service.state === "UNKNOWN") {
      addBlocker(
        blockers,
        "AutomaticRestart",
        "SERVICE_STATE_UNKNOWN",
        `$.services.${service.serviceId}`,
        "Service state remains unknown.",
      );
    }
    if (!service.automaticRestart) {
      continue;
    }
    const artifact = service.targetArtifactId
      ? artifacts.get(service.targetArtifactId)
      : null;
    if (!artifact || artifact.productionStatus !== "CURRENT") {
      legacyAutoRestartCount += 1;
      addBlocker(
        blockers,
        "AutomaticRestart",
        "LEGACY_AUTO_RESTART",
        `$.services.${service.serviceId}`,
        "Automatic restart does not target a CURRENT artifact.",
      );
    }
    if (
      service.targetEntry === "WEB_DIRECT_NEXT_START" ||
      service.targetEntry === "WORKER_DIRECT_LEGACY_DIST" ||
      service.targetEntry === "WORKER_DIRECT_ENTRY" ||
      service.targetEntry === "UNKNOWN"
    ) {
      addBlocker(
        blockers,
        "AutomaticRestart",
        "AUTO_RESTART_ENTRY_UNSAFE",
        `$.services.${service.serviceId}.targetEntry`,
        "Automatic restart targets an unsafe startup entry.",
      );
    }
  }

  for (const acl of bundle.storageAcls) {
    requireHost(acl.hostId, "StorageAcl", "$.storageAcls");
    const identity = runtimeIdentities.get(acl.runtimeIdentityId);
    if (!identity) {
      addBlocker(
        blockers,
        "StorageAcl",
        "ACL_IDENTITY_UNKNOWN",
        `$.storageAcls.${acl.aclId}`,
        "ACL references an unknown runtime identity.",
      );
    }
    if (
      acl.permissions.delete ||
      acl.permissions.modifyAcl ||
      acl.permissions.changeOwner ||
      acl.parentWidePermission ||
      acl.reparsePointPresent ||
      acl.externalObjectStore
    ) {
      addBlocker(
        blockers,
        "StorageAcl",
        "ACL_UNSAFE_PERMISSION",
        `$.storageAcls.${acl.aclId}`,
        "ACL grants delete/ACL/owner/external or unsafe path authority.",
      );
    }
    if (
      (acl.resourceType === "RELEASE_ROOT" ||
        acl.resourceType === "TRUST_ROOT") &&
      (acl.permissions.read ||
        acl.permissions.create ||
        acl.permissions.write ||
        acl.permissions.rename)
    ) {
      if (
        acl.permissions.create ||
        acl.permissions.write ||
        acl.permissions.rename
      ) {
        addBlocker(
          blockers,
          "StorageAcl",
          "SECURITY_ROOT_WRITABLE_BY_RUNTIME",
          `$.storageAcls.${acl.aclId}`,
          "Runtime ACL can modify a Release or Trust Root.",
        );
      }
    }
    for (const modifierId of acl.aclModifierIdentityIds) {
      if (!runtimeIdentities.has(modifierId)) {
        addBlocker(
          blockers,
          "StorageAcl",
          "ACL_MODIFIER_UNKNOWN",
          `$.storageAcls.${acl.aclId}.aclModifierIdentityIds`,
          "ACL modifier identity is absent from runtime identity evidence.",
        );
      }
      const modifierRole =
        runtimeIdentities.get(modifierId)?.role;
      if (
        modifierRole === "WEB_RUNTIME_IDENTITY" ||
        modifierRole === "WORKER_RUNTIME_IDENTITY" ||
        modifierRole === "MAINTENANCE_RUNTIME_IDENTITY"
      ) {
        addBlocker(
          blockers,
          "StorageAcl",
          "ACL_RUNTIME_MODIFIER",
          `$.storageAcls.${acl.aclId}.aclModifierIdentityIds`,
          "A runtime identity can modify ACLs.",
        );
      }
    }
    if (acl.inheritanceEnabled) {
      addWarning(
        warnings,
        "StorageAcl",
        "ACL_INHERITANCE_PRESENT",
        `$.storageAcls.${acl.aclId}`,
        "ACL inheritance is present; effective permission evidence must be reviewed.",
      );
    }
  }
  for (const role of requiredRuntimeRoles) {
    const identity = bundle.runtimeIdentities.find(
      (candidate) => candidate.role === role,
    );
    if (!identity) {
      continue;
    }
    const acls = bundle.storageAcls.filter(
      (acl) => acl.runtimeIdentityId === identity.runtimeIdentityId,
    );
    for (const resourceType of [
      "RELEASE_ROOT",
      "TRUST_ROOT",
      "STORAGE_CANONICAL",
    ] as const) {
      if (
        !acls.some(
          (acl) => acl.resourceType === resourceType,
        )
      ) {
        addBlocker(
          blockers,
          "StorageAcl",
          "ACL_EVIDENCE_MISSING",
          `$.storageAcls.${role}`,
          `Required ACL evidence is missing for ${resourceType}.`,
        );
      }
    }
  }

  let latestQueueSnapshot: (typeof bundle.queueSnapshots)[number] | null =
    null;
  for (const snapshot of bundle.queueSnapshots) {
    const snapshotAt = Date.parse(snapshot.snapshotAt);
    if (
      snapshotAt > now.getTime() + EVIDENCE_MAX_FUTURE_SKEW_MS ||
      now.getTime() - snapshotAt > QUEUE_SNAPSHOT_MAX_AGE_MS
    ) {
      addBlocker(
        blockers,
        "LegacyQueue",
        "QUEUE_SNAPSHOT_STALE",
        `$.queueSnapshots.${snapshot.snapshotId}`,
        "Queue snapshot is not fresh enough for drain readiness.",
      );
    }
    if (
      !latestQueueSnapshot ||
      Date.parse(snapshot.snapshotAt) >
        Date.parse(latestQueueSnapshot.snapshotAt)
    ) {
      latestQueueSnapshot = snapshot;
    }
  }
  if (!latestQueueSnapshot) {
    addBlocker(
      blockers,
      "LegacyQueue",
      "QUEUE_SNAPSHOT_MISSING",
      "$.queueSnapshots",
      "No queue snapshot was supplied.",
    );
  } else if (
    latestQueueSnapshot.waitingJobs !== 0 ||
    latestQueueSnapshot.activeJobs !== 0 ||
    latestQueueSnapshot.retryJobs !== 0 ||
    latestQueueSnapshot.failedJobs !== 0 ||
    latestQueueSnapshot.scheduledJobs !== 0 ||
    latestQueueSnapshot.oldestJobAt !== null ||
    latestQueueSnapshot.unfinishedOperations !== 0 ||
    latestQueueSnapshot.activeUploads !== 0 ||
    latestQueueSnapshot.processingRecoveryStatus !== "IDLE"
  ) {
    addBlocker(
      blockers,
      "LegacyQueue",
      "QUEUE_NOT_DRAINED",
      `$.queueSnapshots.${latestQueueSnapshot.snapshotId}`,
      "Queue, operation, upload, or recovery state is not drained.",
    );
  }
  for (const job of bundle.runningJobs) {
    if (job.status !== "COMPLETE") {
      addBlocker(
        blockers,
        job.status === "RETRY" ? "LegacyQueue" : "LegacyQueue",
        job.status === "RETRY"
          ? "RETRY_JOB_PRESENT"
          : "RUNNING_JOB_PRESENT",
        `$.runningJobs.${job.jobId}`,
        "A non-complete job remains during drain readiness review.",
      );
    }
  }
  for (const dependency of bundle.networkDependencies) {
    if (dependency.legacyWorkerReachable !== false) {
      addBlocker(
        blockers,
        "LegacyQueue",
        "LEGACY_DEPENDENCY_UNVERIFIED",
        `$.networkDependencies.${dependency.dependencyId}`,
        "Network dependency legacy reachability is not verified absent.",
      );
    }
  }

  const approvingIdentities = new Set<string>();
  for (const approval of bundle.approvals) {
    if (
      approval.bundleId !== bundle.bundleId ||
      approval.scope !== "LEGACY_DRAIN" ||
      !approval.independent
    ) {
      addBlocker(
        blockers,
        "DrainApproval",
        "DRAIN_APPROVAL_INVALID",
        `$.approvals.${approval.approvalId}`,
        "Drain approval is not independent or does not bind this bundle.",
      );
    }
    const approvedAt = Date.parse(approval.approvedAt);
    if (
      approvedAt > now.getTime() + EVIDENCE_MAX_FUTURE_SKEW_MS ||
      now.getTime() - approvedAt > EVIDENCE_ITEM_MAX_AGE_MS
    ) {
      addBlocker(
        blockers,
        "DrainApproval",
        "DRAIN_APPROVAL_STALE",
        `$.approvals.${approval.approvalId}`,
        "Drain approval is stale or has a future timestamp.",
      );
    }
    approvingIdentities.add(approval.approverIdentity);
  }
  if (approvingIdentities.size < 2) {
    addBlocker(
      blockers,
      "DrainApproval",
      "INDEPENDENT_DRAIN_APPROVAL_MISSING",
      "$.approvals",
      "At least two independent approvers are required.",
    );
  }

  const summary = {
    hostCount: bundle.hosts.length,
    processCount: bundle.processes.length,
    instanceCount: bundle.instances.length,
    currentArtifactCount,
    legacyArtifactCount,
    enabledLegacySchedulerCount,
    legacyAutoRestartCount,
    approvalCount: approvingIdentities.size,
  };
  return finish(summary, blockers, warnings);
}

function finish(
  summary: EvidenceBundleVerificationResult["summary"],
  blockers: EvidenceBundleDiagnostic[],
  warnings: EvidenceBundleDiagnostic[],
  invalid = false,
): EvidenceBundleVerificationResult {
  const sections = Object.fromEntries(
    (
      [
        "EvidenceIntegrity",
        "HostInventory",
        "InstanceInventory",
        "SchedulerWatchdog",
        "AutomaticRestart",
        "ArtifactVerification",
        "TrustRoot",
        "RuntimeIdentity",
        "StorageAcl",
        "LegacyQueue",
        "DrainApproval",
        "ReleaseRoot",
      ] as const
    ).map((section) => {
      const blockerCount = blockers.filter(
        (blocker) => blocker.section === section,
      ).length;
      return [
        section,
        {
          status:
            !invalid && blockerCount === 0
              ? "COMPLETE"
              : "BLOCKED",
          blockerCount,
        },
      ];
    }),
  ) as EvidenceBundleVerificationResult["sections"];
  const ready = blockers.length === 0;
  return {
    productionEvidenceStatus: invalid
      ? "BLOCKED"
      : ready
        ? "COMPLETE"
        : "PARTIAL",
    drainReadiness: ready ? "READY FOR HUMAN REVIEW" : "BLOCKED",
    productionDrain: "NOT EXECUTED",
    blockers,
    warnings,
    sections,
    summary,
  };
}

function parsedInputSummary(
  input: unknown,
): EvidenceBundleVerificationResult["summary"] {
  if (typeof input !== "object" || input === null) {
    return {
      hostCount: 0,
      processCount: 0,
      instanceCount: 0,
      currentArtifactCount: 0,
      legacyArtifactCount: 0,
      enabledLegacySchedulerCount: 0,
      legacyAutoRestartCount: 0,
      approvalCount: 0,
    };
  }
  const value = input as Record<string, unknown>;
  const count = (key: string): number =>
    Array.isArray(value[key]) ? value[key].length : 0;
  return {
    hostCount: count("hosts"),
    processCount: count("processes"),
    instanceCount: count("instances"),
    currentArtifactCount: count("artifacts"),
    legacyArtifactCount: 0,
    enabledLegacySchedulerCount: count("schedulers"),
    legacyAutoRestartCount: count("services"),
    approvalCount: count("approvals"),
  };
}
