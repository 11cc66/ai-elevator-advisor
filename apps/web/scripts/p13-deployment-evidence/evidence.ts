import { createHash } from "node:crypto";

import { canonicalize } from "@elevator/build-integrity";

export const DEPLOYMENT_EVIDENCE_SCHEMA_VERSION = 1;
export const DEPLOYMENT_EVIDENCE_MAX_AGE_MS =
  24 * 60 * 60 * 1000;
export const DEPLOYMENT_EVIDENCE_MAX_FUTURE_SKEW_MS =
  5 * 60 * 1000;

export type VerificationStatus =
  | "VERIFIED"
  | "PARTIAL"
  | "UNKNOWN"
  | "FAILED"
  | "NOT_APPLICABLE";

export type ArtifactProductionStatus =
  | "CURRENT"
  | "LEGACY"
  | "QUARANTINED"
  | "UNKNOWN";

export type RuntimeRole =
  | "BUILD_IDENTITY"
  | "RELEASE_SIGNER_IDENTITY"
  | "WEB_RUNTIME_IDENTITY"
  | "WORKER_RUNTIME_IDENTITY"
  | "MAINTENANCE_RUNTIME_IDENTITY"
  | "FUTURE_CLEANUP_IDENTITY"
  | "DEPLOYMENT_ADMIN_IDENTITY"
  | "TRUST_ROOT_ADMIN_IDENTITY";

export interface ArtifactEvidence {
  artifactId: string;
  application: "web" | "worker" | "unknown";
  location: string;
  buildId: string | null;
  releaseId: string | null;
  sourceTreeDigest: string | null;
  artifactDigest: string | null;
  runtimeDependencyDigest: string | null;
  manifestStatus: VerificationStatus;
  startupGateStatus: VerificationStatus;
  productionStatus: ArtifactProductionStatus;
  cleanupCapability: "DISABLED" | "ENABLED" | "UNKNOWN";
  legacyDeleteMarkers: number | null;
  canStartDirectly: boolean;
  canBeRestarted: boolean;
}

export interface InstanceEvidence {
  instanceId: string;
  hostId: string;
  artifactId: string | null;
  runtimeIdentity: string;
  startupEntry:
    | "WEB_SECURE_LAUNCHER"
    | "WEB_DIRECT_NEXT_START"
    | "WORKER_SIGNED_RELEASE_INDEX"
    | "WORKER_DIRECT_LEGACY_DIST"
    | "UNKNOWN";
  activeJobs: number | null;
}

export interface ProcessEvidence {
  processId: number;
  name: string;
  executablePath: string;
  runtimeIdentity: string;
  artifactId: string | null;
}

export interface ServiceEvidence {
  name: string;
  state: "RUNNING" | "STOPPED" | "UNKNOWN";
  startMode: string;
  automaticRestart: boolean;
  artifactId: string | null;
}

export interface SchedulerEvidence {
  name: string;
  kind:
    | "PGBOSS"
    | "CRON"
    | "TASK_SCHEDULER"
    | "WINDOWS_SERVICE"
    | "SYSTEMD"
    | "KUBERNETES"
    | "SUPERVISOR"
    | "WATCHDOG"
    | "UNKNOWN";
  enabled: boolean;
  artifactId: string | null;
}

export interface RuntimeIdentityEvidence {
  role: RuntimeRole;
  account: string;
  releaseRootRead: boolean;
  releaseRootWrite: boolean;
  trustRootRead: boolean;
  trustRootWrite: boolean;
  storagePhysicalDelete:
    | "DENIED_VERIFIED"
    | "ALLOWED_VERIFIED"
    | "UNKNOWN";
  cleanupCapability: "DISABLED" | "ENABLED" | "UNKNOWN";
}

export interface StorageAclEvidence {
  role: RuntimeRole;
  resource: "RELEASE_ROOT" | "TRUST_ROOT" | "STORAGE_ROOT";
  permission: "READ" | "WRITE" | "DELETE";
  status: "ALLOWED_VERIFIED" | "DENIED_VERIFIED" | "UNKNOWN";
}

export interface DeploymentEvidence {
  schemaVersion: 1;
  evidenceId: string;
  collectedAt: string;
  collectorVersion: string;
  hostId: string;
  environment: "PRODUCTION" | "STAGING" | "ISOLATED_TEST";
  inventory: {
    processes: ProcessEvidence[];
    services: ServiceEvidence[];
    schedulers: SchedulerEvidence[];
    webInstances: InstanceEvidence[];
    workerInstances: InstanceEvidence[];
    maintenanceInstances: InstanceEvidence[];
    artifacts: ArtifactEvidence[];
  };
  trustChain: {
    buildPipelineStatus: VerificationStatus;
    releaseSigningKeyStatus:
      | "ACTIVE"
      | "NOT_CONFIGURED"
      | "REVOKED"
      | "UNKNOWN";
    trustRootConfigured: boolean;
    trustRootPath: string | null;
    trustRootRuntimeWritable: boolean | null;
    trustRootAdminOnly: boolean | null;
    privateSigningKeyRuntimeAccessible: boolean | null;
  };
  queue: {
    legacyRunning: number | null;
    legacyBacklog: number | null;
    legacyFailed: number | null;
    oldestLegacyJobAt: string | null;
  };
  runtimeIdentities: RuntimeIdentityEvidence[];
  storageAcls: StorageAclEvidence[];
  integrity: {
    algorithm: "sha256";
    digest: string;
  };
}

export interface EvidenceDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface DeploymentEvidenceValidationResult {
  status: "READY" | "BLOCKED" | "INVALID";
  valid: boolean;
  readyForLegacyDrain: boolean;
  blockers: EvidenceDiagnostic[];
  warnings: EvidenceDiagnostic[];
  retainedArtifactCount: number;
  currentArtifactCount: number;
  legacyInstanceCount: number;
  enabledLegacySchedulerCount: number;
  legacyAutoRestartCount: number;
}

class EvidenceShapeError extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "EvidenceShapeError";
  }
}

const SAFE_SENSITIVE_KEYS = new Set([
  "releaseSigningKeyStatus",
  "privateSigningKeyRuntimeAccessible",
]);

const SENSITIVE_KEY_PATTERN =
  /(?:password|passwd|secret|token|api[_-]?key|connection[_-]?string|database[_-]?url|private[_-]?key)/i;

const SENSITIVE_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\bpostgres(?:ql)?:\/\/[^/\s:@]+:[^/\s@]+@/i,
];

function record(value: unknown, pathName: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new EvidenceShapeError(
      "EVIDENCE_SHAPE_INVALID",
      pathName,
      "Expected an object.",
    );
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  pathName: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new EvidenceShapeError(
      "EVIDENCE_FIELDS_INVALID",
      pathName,
      "Object fields do not match the evidence schema.",
    );
  }
}

function stringValue(
  value: unknown,
  pathName: string,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.trim().length === 0) ||
    value.includes("\0")
  ) {
    throw new EvidenceShapeError(
      "EVIDENCE_STRING_INVALID",
      pathName,
      "Expected a non-empty string.",
    );
  }
  return value;
}

function nullableString(
  value: unknown,
  pathName: string,
): string | null {
  return value === null ? null : stringValue(value, pathName);
}

function booleanValue(value: unknown, pathName: string): boolean {
  if (typeof value !== "boolean") {
    throw new EvidenceShapeError(
      "EVIDENCE_BOOLEAN_INVALID",
      pathName,
      "Expected a boolean.",
    );
  }
  return value;
}

function nullableBoolean(
  value: unknown,
  pathName: string,
): boolean | null {
  return value === null ? null : booleanValue(value, pathName);
}

function numberValue(
  value: unknown,
  pathName: string,
  nullable: boolean,
): number | null {
  if (value === null && nullable) {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new EvidenceShapeError(
      "EVIDENCE_NUMBER_INVALID",
      pathName,
      "Expected a non-negative safe integer.",
    );
  }
  return value;
}

function arrayValue(value: unknown, pathName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new EvidenceShapeError(
      "EVIDENCE_ARRAY_INVALID",
      pathName,
      "Expected an array.",
    );
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  pathName: string,
): T {
  if (
    typeof value !== "string" ||
    !allowed.includes(value as T)
  ) {
    throw new EvidenceShapeError(
      "EVIDENCE_ENUM_INVALID",
      pathName,
      `Value must be one of: ${allowed.join(", ")}.`,
    );
  }
  return value as T;
}

function absoluteLocation(value: unknown, pathName: string): string {
  const location = stringValue(value, pathName);
  if (
    !(
      /^[A-Za-z]:[\\/]/.test(location) ||
      location.startsWith("\\\\") ||
      location.startsWith("/")
    )
  ) {
    throw new EvidenceShapeError(
      "EVIDENCE_PATH_INVALID",
      pathName,
      "Evidence artifact paths must be absolute.",
    );
  }
  return location;
}

function scanSensitive(
  value: unknown,
  pathName = "$",
): EvidenceDiagnostic | null {
  if (typeof value === "string") {
    if (
      SENSITIVE_VALUE_PATTERNS.some((pattern) =>
        pattern.test(value),
      )
    ) {
      return {
        code: "EVIDENCE_SECRET_DETECTED",
        path: pathName,
        message: "Evidence contains a secret-like value.",
      };
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const finding = scanSensitive(item, `${pathName}[${index}]`);
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
        SENSITIVE_KEY_PATTERN.test(key) &&
        !SAFE_SENSITIVE_KEYS.has(key) &&
        typeof item !== "boolean" &&
        item !== null
      ) {
        return {
          code: "EVIDENCE_SECRET_FIELD_DETECTED",
          path: itemPath,
          message: "Evidence contains a forbidden secret field.",
        };
      }
      const finding = scanSensitive(item, itemPath);
      if (finding) {
        return finding;
      }
    }
  }
  return null;
}

function parseArtifact(value: unknown, pathName: string): ArtifactEvidence {
  const item = record(value, pathName);
  exactKeys(
    item,
    [
      "artifactId",
      "application",
      "location",
      "buildId",
      "releaseId",
      "sourceTreeDigest",
      "artifactDigest",
      "runtimeDependencyDigest",
      "manifestStatus",
      "startupGateStatus",
      "productionStatus",
      "cleanupCapability",
      "legacyDeleteMarkers",
      "canStartDirectly",
      "canBeRestarted",
    ],
    pathName,
  );
  return {
    artifactId: stringValue(item.artifactId, `${pathName}.artifactId`),
    application: enumValue(
      item.application,
      ["web", "worker", "unknown"],
      `${pathName}.application`,
    ),
    location: absoluteLocation(item.location, `${pathName}.location`),
    buildId: nullableString(item.buildId, `${pathName}.buildId`),
    releaseId: nullableString(item.releaseId, `${pathName}.releaseId`),
    sourceTreeDigest: nullableString(
      item.sourceTreeDigest,
      `${pathName}.sourceTreeDigest`,
    ),
    artifactDigest: nullableString(
      item.artifactDigest,
      `${pathName}.artifactDigest`,
    ),
    runtimeDependencyDigest: nullableString(
      item.runtimeDependencyDigest,
      `${pathName}.runtimeDependencyDigest`,
    ),
    manifestStatus: enumValue(
      item.manifestStatus,
      ["VERIFIED", "PARTIAL", "UNKNOWN", "FAILED", "NOT_APPLICABLE"],
      `${pathName}.manifestStatus`,
    ),
    startupGateStatus: enumValue(
      item.startupGateStatus,
      ["VERIFIED", "PARTIAL", "UNKNOWN", "FAILED", "NOT_APPLICABLE"],
      `${pathName}.startupGateStatus`,
    ),
    productionStatus: enumValue(
      item.productionStatus,
      ["CURRENT", "LEGACY", "QUARANTINED", "UNKNOWN"],
      `${pathName}.productionStatus`,
    ),
    cleanupCapability: enumValue(
      item.cleanupCapability,
      ["DISABLED", "ENABLED", "UNKNOWN"],
      `${pathName}.cleanupCapability`,
    ),
    legacyDeleteMarkers: numberValue(
      item.legacyDeleteMarkers,
      `${pathName}.legacyDeleteMarkers`,
      true,
    ),
    canStartDirectly: booleanValue(
      item.canStartDirectly,
      `${pathName}.canStartDirectly`,
    ),
    canBeRestarted: booleanValue(
      item.canBeRestarted,
      `${pathName}.canBeRestarted`,
    ),
  };
}

function parseInstance(value: unknown, pathName: string): InstanceEvidence {
  const item = record(value, pathName);
  exactKeys(
    item,
    [
      "instanceId",
      "hostId",
      "artifactId",
      "runtimeIdentity",
      "startupEntry",
      "activeJobs",
    ],
    pathName,
  );
  return {
    instanceId: stringValue(item.instanceId, `${pathName}.instanceId`),
    hostId: stringValue(item.hostId, `${pathName}.hostId`),
    artifactId: nullableString(item.artifactId, `${pathName}.artifactId`),
    runtimeIdentity: stringValue(
      item.runtimeIdentity,
      `${pathName}.runtimeIdentity`,
    ),
    startupEntry: enumValue(
      item.startupEntry,
      [
        "WEB_SECURE_LAUNCHER",
        "WEB_DIRECT_NEXT_START",
        "WORKER_SIGNED_RELEASE_INDEX",
        "WORKER_DIRECT_LEGACY_DIST",
        "UNKNOWN",
      ],
      `${pathName}.startupEntry`,
    ),
    activeJobs: numberValue(
      item.activeJobs,
      `${pathName}.activeJobs`,
      true,
    ),
  };
}

function parseProcess(value: unknown, pathName: string): ProcessEvidence {
  const item = record(value, pathName);
  exactKeys(
    item,
    ["processId", "name", "executablePath", "runtimeIdentity", "artifactId"],
    pathName,
  );
  return {
    processId: numberValue(item.processId, `${pathName}.processId`, false)!,
    name: stringValue(item.name, `${pathName}.name`),
    executablePath: absoluteLocation(
      item.executablePath,
      `${pathName}.executablePath`,
    ),
    runtimeIdentity: stringValue(
      item.runtimeIdentity,
      `${pathName}.runtimeIdentity`,
    ),
    artifactId: nullableString(item.artifactId, `${pathName}.artifactId`),
  };
}

function parseService(value: unknown, pathName: string): ServiceEvidence {
  const item = record(value, pathName);
  exactKeys(
    item,
    ["name", "state", "startMode", "automaticRestart", "artifactId"],
    pathName,
  );
  return {
    name: stringValue(item.name, `${pathName}.name`),
    state: enumValue(
      item.state,
      ["RUNNING", "STOPPED", "UNKNOWN"],
      `${pathName}.state`,
    ),
    startMode: stringValue(item.startMode, `${pathName}.startMode`),
    automaticRestart: booleanValue(
      item.automaticRestart,
      `${pathName}.automaticRestart`,
    ),
    artifactId: nullableString(item.artifactId, `${pathName}.artifactId`),
  };
}

function parseScheduler(value: unknown, pathName: string): SchedulerEvidence {
  const item = record(value, pathName);
  exactKeys(
    item,
    ["name", "kind", "enabled", "artifactId"],
    pathName,
  );
  return {
    name: stringValue(item.name, `${pathName}.name`),
    kind: enumValue(
      item.kind,
      [
        "PGBOSS",
        "CRON",
        "TASK_SCHEDULER",
        "WINDOWS_SERVICE",
        "SYSTEMD",
        "KUBERNETES",
        "SUPERVISOR",
        "WATCHDOG",
        "UNKNOWN",
      ],
      `${pathName}.kind`,
    ),
    enabled: booleanValue(item.enabled, `${pathName}.enabled`),
    artifactId: nullableString(item.artifactId, `${pathName}.artifactId`),
  };
}

function parseRuntimeIdentity(
  value: unknown,
  pathName: string,
): RuntimeIdentityEvidence {
  const item = record(value, pathName);
  exactKeys(
    item,
    [
      "role",
      "account",
      "releaseRootRead",
      "releaseRootWrite",
      "trustRootRead",
      "trustRootWrite",
      "storagePhysicalDelete",
      "cleanupCapability",
    ],
    pathName,
  );
  return {
    role: enumValue(
      item.role,
      [
        "BUILD_IDENTITY",
        "RELEASE_SIGNER_IDENTITY",
        "WEB_RUNTIME_IDENTITY",
        "WORKER_RUNTIME_IDENTITY",
        "MAINTENANCE_RUNTIME_IDENTITY",
        "FUTURE_CLEANUP_IDENTITY",
        "DEPLOYMENT_ADMIN_IDENTITY",
        "TRUST_ROOT_ADMIN_IDENTITY",
      ],
      `${pathName}.role`,
    ),
    account: stringValue(item.account, `${pathName}.account`),
    releaseRootRead: booleanValue(
      item.releaseRootRead,
      `${pathName}.releaseRootRead`,
    ),
    releaseRootWrite: booleanValue(
      item.releaseRootWrite,
      `${pathName}.releaseRootWrite`,
    ),
    trustRootRead: booleanValue(
      item.trustRootRead,
      `${pathName}.trustRootRead`,
    ),
    trustRootWrite: booleanValue(
      item.trustRootWrite,
      `${pathName}.trustRootWrite`,
    ),
    storagePhysicalDelete: enumValue(
      item.storagePhysicalDelete,
      ["DENIED_VERIFIED", "ALLOWED_VERIFIED", "UNKNOWN"],
      `${pathName}.storagePhysicalDelete`,
    ),
    cleanupCapability: enumValue(
      item.cleanupCapability,
      ["DISABLED", "ENABLED", "UNKNOWN"],
      `${pathName}.cleanupCapability`,
    ),
  };
}

function parseStorageAcl(
  value: unknown,
  pathName: string,
): StorageAclEvidence {
  const item = record(value, pathName);
  exactKeys(
    item,
    ["role", "resource", "permission", "status"],
    pathName,
  );
  return {
    role: enumValue(
      item.role,
      [
        "BUILD_IDENTITY",
        "RELEASE_SIGNER_IDENTITY",
        "WEB_RUNTIME_IDENTITY",
        "WORKER_RUNTIME_IDENTITY",
        "MAINTENANCE_RUNTIME_IDENTITY",
        "FUTURE_CLEANUP_IDENTITY",
        "DEPLOYMENT_ADMIN_IDENTITY",
        "TRUST_ROOT_ADMIN_IDENTITY",
      ],
      `${pathName}.role`,
    ),
    resource: enumValue(
      item.resource,
      ["RELEASE_ROOT", "TRUST_ROOT", "STORAGE_ROOT"],
      `${pathName}.resource`,
    ),
    permission: enumValue(
      item.permission,
      ["READ", "WRITE", "DELETE"],
      `${pathName}.permission`,
    ),
    status: enumValue(
      item.status,
      ["ALLOWED_VERIFIED", "DENIED_VERIFIED", "UNKNOWN"],
      `${pathName}.status`,
    ),
  };
}

export function parseDeploymentEvidence(
  input: unknown,
): DeploymentEvidence {
  const root = record(input, "$");
  exactKeys(
    root,
    [
      "schemaVersion",
      "evidenceId",
      "collectedAt",
      "collectorVersion",
      "hostId",
      "environment",
      "inventory",
      "trustChain",
      "queue",
      "runtimeIdentities",
      "storageAcls",
      "integrity",
    ],
    "$",
  );
  const secretFinding = scanSensitive(input);
  if (secretFinding) {
    throw new EvidenceShapeError(
      secretFinding.code,
      secretFinding.path,
      secretFinding.message,
    );
  }
  if (root.schemaVersion !== DEPLOYMENT_EVIDENCE_SCHEMA_VERSION) {
    throw new EvidenceShapeError(
      "EVIDENCE_SCHEMA_VERSION_UNSUPPORTED",
      "$.schemaVersion",
      "Evidence schema version is unsupported.",
    );
  }
  const inventory = record(root.inventory, "$.inventory");
  exactKeys(
    inventory,
    [
      "processes",
      "services",
      "schedulers",
      "webInstances",
      "workerInstances",
      "maintenanceInstances",
      "artifacts",
    ],
    "$.inventory",
  );
  const trustChain = record(root.trustChain, "$.trustChain");
  exactKeys(
    trustChain,
    [
      "buildPipelineStatus",
      "releaseSigningKeyStatus",
      "trustRootConfigured",
      "trustRootPath",
      "trustRootRuntimeWritable",
      "trustRootAdminOnly",
      "privateSigningKeyRuntimeAccessible",
    ],
    "$.trustChain",
  );
  const queue = record(root.queue, "$.queue");
  exactKeys(
    queue,
    [
      "legacyRunning",
      "legacyBacklog",
      "legacyFailed",
      "oldestLegacyJobAt",
    ],
    "$.queue",
  );
  const integrity = record(root.integrity, "$.integrity");
  exactKeys(
    integrity,
    ["algorithm", "digest"],
    "$.integrity",
  );

  return {
    schemaVersion: 1,
    evidenceId: stringValue(root.evidenceId, "$.evidenceId"),
    collectedAt: stringValue(root.collectedAt, "$.collectedAt"),
    collectorVersion: stringValue(
      root.collectorVersion,
      "$.collectorVersion",
    ),
    hostId: stringValue(root.hostId, "$.hostId"),
    environment: enumValue(
      root.environment,
      ["PRODUCTION", "STAGING", "ISOLATED_TEST"],
      "$.environment",
    ),
    inventory: {
      processes: arrayValue(
        inventory.processes,
        "$.inventory.processes",
      ).map((item, index) =>
        parseProcess(item, `$.inventory.processes[${index}]`),
      ),
      services: arrayValue(
        inventory.services,
        "$.inventory.services",
      ).map((item, index) =>
        parseService(item, `$.inventory.services[${index}]`),
      ),
      schedulers: arrayValue(
        inventory.schedulers,
        "$.inventory.schedulers",
      ).map((item, index) =>
        parseScheduler(item, `$.inventory.schedulers[${index}]`),
      ),
      webInstances: arrayValue(
        inventory.webInstances,
        "$.inventory.webInstances",
      ).map((item, index) =>
        parseInstance(item, `$.inventory.webInstances[${index}]`),
      ),
      workerInstances: arrayValue(
        inventory.workerInstances,
        "$.inventory.workerInstances",
      ).map((item, index) =>
        parseInstance(item, `$.inventory.workerInstances[${index}]`),
      ),
      maintenanceInstances: arrayValue(
        inventory.maintenanceInstances,
        "$.inventory.maintenanceInstances",
      ).map((item, index) =>
        parseInstance(
          item,
          `$.inventory.maintenanceInstances[${index}]`,
        ),
      ),
      artifacts: arrayValue(
        inventory.artifacts,
        "$.inventory.artifacts",
      ).map((item, index) =>
        parseArtifact(item, `$.inventory.artifacts[${index}]`),
      ),
    },
    trustChain: {
      buildPipelineStatus: enumValue(
        trustChain.buildPipelineStatus,
        ["VERIFIED", "PARTIAL", "UNKNOWN", "FAILED", "NOT_APPLICABLE"],
        "$.trustChain.buildPipelineStatus",
      ),
      releaseSigningKeyStatus: enumValue(
        trustChain.releaseSigningKeyStatus,
        ["ACTIVE", "NOT_CONFIGURED", "REVOKED", "UNKNOWN"],
        "$.trustChain.releaseSigningKeyStatus",
      ),
      trustRootConfigured: booleanValue(
        trustChain.trustRootConfigured,
        "$.trustChain.trustRootConfigured",
      ),
      trustRootPath: nullableString(
        trustChain.trustRootPath,
        "$.trustChain.trustRootPath",
      ),
      trustRootRuntimeWritable: nullableBoolean(
        trustChain.trustRootRuntimeWritable,
        "$.trustChain.trustRootRuntimeWritable",
      ),
      trustRootAdminOnly: nullableBoolean(
        trustChain.trustRootAdminOnly,
        "$.trustChain.trustRootAdminOnly",
      ),
      privateSigningKeyRuntimeAccessible: nullableBoolean(
        trustChain.privateSigningKeyRuntimeAccessible,
        "$.trustChain.privateSigningKeyRuntimeAccessible",
      ),
    },
    queue: {
      legacyRunning: numberValue(
        queue.legacyRunning,
        "$.queue.legacyRunning",
        true,
      ),
      legacyBacklog: numberValue(
        queue.legacyBacklog,
        "$.queue.legacyBacklog",
        true,
      ),
      legacyFailed: numberValue(
        queue.legacyFailed,
        "$.queue.legacyFailed",
        true,
      ),
      oldestLegacyJobAt: nullableString(
        queue.oldestLegacyJobAt,
        "$.queue.oldestLegacyJobAt",
      ),
    },
    runtimeIdentities: arrayValue(
      root.runtimeIdentities,
      "$.runtimeIdentities",
    ).map((item, index) =>
      parseRuntimeIdentity(
        item,
        `$.runtimeIdentities[${index}]`,
      ),
    ),
    storageAcls: arrayValue(
      root.storageAcls,
      "$.storageAcls",
    ).map((item, index) =>
      parseStorageAcl(item, `$.storageAcls[${index}]`),
    ),
    integrity: {
      algorithm: enumValue(
        integrity.algorithm,
        ["sha256"],
        "$.integrity.algorithm",
      ),
      digest: stringValue(integrity.digest, "$.integrity.digest"),
    },
  };
}

export function computeDeploymentEvidenceDigest(
  evidenceWithoutIntegrity: Omit<DeploymentEvidence, "integrity">,
): string {
  return createHash("sha256")
    .update(canonicalize(evidenceWithoutIntegrity))
    .digest("hex");
}

export function sealDeploymentEvidence(
  evidenceWithoutIntegrity: Omit<DeploymentEvidence, "integrity">,
): DeploymentEvidence {
  return {
    ...evidenceWithoutIntegrity,
    integrity: {
      algorithm: "sha256",
      digest: computeDeploymentEvidenceDigest(
        evidenceWithoutIntegrity,
      ),
    },
  };
}

function diagnostic(
  code: string,
  pathName: string,
  message: string,
): EvidenceDiagnostic {
  return { code, path: pathName, message };
}

function isDigest(value: string | null): boolean {
  return value !== null && /^[0-9a-f]{64}$/i.test(value);
}

export function validateDeploymentEvidence(
  input: unknown,
  now: Date = new Date(),
): DeploymentEvidenceValidationResult {
  const blockers: EvidenceDiagnostic[] = [];
  const warnings: EvidenceDiagnostic[] = [];
  let evidence: DeploymentEvidence;
  try {
    evidence = parseDeploymentEvidence(input);
  } catch (error) {
    if (error instanceof EvidenceShapeError) {
      return {
        status: "INVALID",
        valid: false,
        readyForLegacyDrain: false,
        blockers: [
          diagnostic(error.code, error.path, error.message),
        ],
        warnings: [],
        retainedArtifactCount: 0,
        currentArtifactCount: 0,
        legacyInstanceCount: 0,
        enabledLegacySchedulerCount: 0,
        legacyAutoRestartCount: 0,
      };
    }
    throw error;
  }

  const collectedAt = Date.parse(evidence.collectedAt);
  if (Number.isNaN(collectedAt)) {
    blockers.push(
      diagnostic(
        "EVIDENCE_TIMESTAMP_INVALID",
        "$.collectedAt",
        "Evidence collection time is invalid.",
      ),
    );
  } else if (
    collectedAt > now.getTime() + DEPLOYMENT_EVIDENCE_MAX_FUTURE_SKEW_MS
  ) {
    blockers.push(
      diagnostic(
        "EVIDENCE_TIMESTAMP_IN_FUTURE",
        "$.collectedAt",
        "Evidence collection time is in the future.",
      ),
    );
  } else if (
    now.getTime() - collectedAt > DEPLOYMENT_EVIDENCE_MAX_AGE_MS
  ) {
    blockers.push(
      diagnostic(
        "EVIDENCE_STALE",
        "$.collectedAt",
        "Evidence is older than the allowed collection window.",
      ),
    );
  }
  const expectedDigest = computeDeploymentEvidenceDigest({
    schemaVersion: evidence.schemaVersion,
    evidenceId: evidence.evidenceId,
    collectedAt: evidence.collectedAt,
    collectorVersion: evidence.collectorVersion,
    hostId: evidence.hostId,
    environment: evidence.environment,
    inventory: evidence.inventory,
    trustChain: evidence.trustChain,
    queue: evidence.queue,
    runtimeIdentities: evidence.runtimeIdentities,
    storageAcls: evidence.storageAcls,
  });
  if (
    !/^[0-9a-f]{64}$/i.test(evidence.integrity.digest) ||
    evidence.integrity.digest.toLowerCase() !== expectedDigest
  ) {
    blockers.push(
      diagnostic(
        "EVIDENCE_DIGEST_MISMATCH",
        "$.integrity.digest",
        "Evidence integrity digest does not match the evidence body.",
      ),
    );
  }
  warnings.push(
    diagnostic(
      "EVIDENCE_CHECKSUM_NOT_AUTHENTICATED",
      "$.integrity",
      "The checksum detects accidental changes but is not a production signature.",
    ),
  );
  if (evidence.environment !== "PRODUCTION") {
    blockers.push(
      diagnostic(
        "EVIDENCE_NOT_PRODUCTION",
        "$.environment",
        "Legacy drain approval requires PRODUCTION evidence.",
      ),
    );
  }

  if (evidence.trustChain.buildPipelineStatus !== "VERIFIED") {
    blockers.push(
      diagnostic(
        "BUILD_PIPELINE_NOT_VERIFIED",
        "$.trustChain.buildPipelineStatus",
        "Build pipeline must be independently verified.",
      ),
    );
  }
  if (evidence.trustChain.releaseSigningKeyStatus !== "ACTIVE") {
    blockers.push(
      diagnostic(
        "RELEASE_SIGNING_KEY_NOT_ACTIVE",
        "$.trustChain.releaseSigningKeyStatus",
        "Production release signing key is not active.",
      ),
    );
  }
  if (!evidence.trustChain.trustRootConfigured) {
    blockers.push(
      diagnostic(
        "TRUST_ROOT_NOT_CONFIGURED",
        "$.trustChain.trustRootConfigured",
        "Production Trust Root is not configured.",
      ),
    );
  } else if (
    !evidence.trustChain.trustRootPath ||
    !(
      /^[A-Za-z]:[\\/]/.test(evidence.trustChain.trustRootPath) ||
      evidence.trustChain.trustRootPath.startsWith("\\\\") ||
      evidence.trustChain.trustRootPath.startsWith("/")
    )
  ) {
    blockers.push(
      diagnostic(
        "TRUST_ROOT_PATH_INVALID",
        "$.trustChain.trustRootPath",
        "Configured Trust Root path must be absolute.",
      ),
    );
  }
  if (evidence.trustChain.trustRootRuntimeWritable !== false) {
    blockers.push(
      diagnostic(
        "TRUST_ROOT_RUNTIME_WRITABLE",
        "$.trustChain.trustRootRuntimeWritable",
        "Trust Root write access for runtime identities must be verified denied.",
      ),
    );
  }
  if (evidence.trustChain.trustRootAdminOnly !== true) {
    blockers.push(
      diagnostic(
        "TRUST_ROOT_ADMIN_ONLY_NOT_VERIFIED",
        "$.trustChain.trustRootAdminOnly",
        "Trust Root must be verifiably administered only by the trust-root admin.",
      ),
    );
  }
  if (
    evidence.trustChain.privateSigningKeyRuntimeAccessible !== false
  ) {
    blockers.push(
      diagnostic(
        "PRIVATE_SIGNING_KEY_RUNTIME_ACCESS",
        "$.trustChain.privateSigningKeyRuntimeAccessible",
        "Runtime access to the private signing key must be verified absent.",
      ),
    );
  }

  const artifacts = new Map(
    evidence.inventory.artifacts.map((artifact) => [
      artifact.artifactId,
      artifact,
    ]),
  );
  if (artifacts.size !== evidence.inventory.artifacts.length) {
    blockers.push(
      diagnostic(
        "DUPLICATE_ARTIFACT_ID",
        "$.inventory.artifacts",
        "Artifact IDs must be unique.",
      ),
    );
  }
  const currentArtifacts = evidence.inventory.artifacts.filter(
    (artifact) => artifact.productionStatus === "CURRENT",
  );
  for (const application of ["web", "worker"] as const) {
    if (
      !currentArtifacts.some(
        (artifact) => artifact.application === application,
      )
    ) {
      blockers.push(
        diagnostic(
          "CURRENT_ARTIFACT_MISSING",
          "$.inventory.artifacts",
          `No verified CURRENT ${application} artifact is recorded.`,
        ),
      );
    }
  }
  for (const artifact of evidence.inventory.artifacts) {
    const prefix = `$.inventory.artifacts.${artifact.artifactId}`;
    if (
      artifact.productionStatus === "CURRENT" &&
      (!isDigest(artifact.sourceTreeDigest) ||
        !isDigest(artifact.artifactDigest) ||
        !isDigest(artifact.runtimeDependencyDigest) ||
        !artifact.buildId ||
        !artifact.releaseId)
    ) {
      blockers.push(
        diagnostic(
          "CURRENT_ARTIFACT_IDENTITY_INCOMPLETE",
          prefix,
          "Current artifact identity and digests must be complete.",
        ),
      );
    }
    if (
      artifact.productionStatus === "CURRENT" &&
      artifact.manifestStatus !== "VERIFIED"
    ) {
      blockers.push(
        diagnostic(
          "ARTIFACT_MANIFEST_NOT_VERIFIED",
          `${prefix}.manifestStatus`,
          "Artifact manifest must be verified.",
        ),
      );
    }
    if (
      artifact.productionStatus === "CURRENT" &&
      artifact.startupGateStatus !== "VERIFIED"
    ) {
      blockers.push(
        diagnostic(
          "ARTIFACT_STARTUP_GATE_NOT_VERIFIED",
          `${prefix}.startupGateStatus`,
          "Artifact Startup Gate status must be verified.",
        ),
      );
    }
    if (
      artifact.productionStatus === "CURRENT" &&
      artifact.cleanupCapability !== "DISABLED"
    ) {
      blockers.push(
        diagnostic(
          "ARTIFACT_CLEANUP_NOT_DISABLED",
          `${prefix}.cleanupCapability`,
          "Artifact cleanup capability must be DISABLED.",
        ),
      );
    }
    if (
      artifact.productionStatus === "CURRENT" &&
      artifact.legacyDeleteMarkers !== 0
    ) {
      blockers.push(
        diagnostic(
          "LEGACY_DELETE_MARKERS_PRESENT",
          `${prefix}.legacyDeleteMarkers`,
          "Artifact Legacy delete marker count must be exactly zero.",
        ),
      );
    }
    if (
      artifact.productionStatus !== "CURRENT" &&
      (artifact.canStartDirectly || artifact.canBeRestarted)
    ) {
      blockers.push(
        diagnostic(
          "LEGACY_ARTIFACT_REACHABLE",
          prefix,
          "Legacy or quarantined artifact is directly startable or restartable.",
        ),
      );
    }
  }

  const instances = [
    ...evidence.inventory.webInstances.map((instance) => ({
      kind: "web" as const,
      instance,
    })),
    ...evidence.inventory.workerInstances.map((instance) => ({
      kind: "worker" as const,
      instance,
    })),
    ...evidence.inventory.maintenanceInstances.map((instance) => ({
      kind: "maintenance" as const,
      instance,
    })),
  ];
  const instanceIds = new Set<string>();
  for (const { instance } of instances) {
    if (instanceIds.has(instance.instanceId)) {
      blockers.push(
        diagnostic(
          "DUPLICATE_INSTANCE_ID",
          `$.inventory.instances.${instance.instanceId}`,
          "Instance IDs must be unique across Web, Worker, and Maintenance.",
        ),
      );
    }
    instanceIds.add(instance.instanceId);
    if (instance.hostId !== evidence.hostId) {
      blockers.push(
        diagnostic(
          "INSTANCE_HOST_MISMATCH",
          `$.inventory.instances.${instance.instanceId}.hostId`,
          "Evidence file host ID does not match the instance host ID.",
        ),
      );
    }
  }
  let legacyInstanceCount = 0;
  for (const { kind, instance } of instances) {
    const artifact = instance.artifactId
      ? artifacts.get(instance.artifactId)
      : null;
    const prefix = `$.inventory.${kind}Instances.${instance.instanceId}`;
    if (!artifact) {
      blockers.push(
        diagnostic(
          "INSTANCE_ARTIFACT_UNKNOWN",
          `${prefix}.artifactId`,
          "Running instance does not map to a recorded artifact.",
        ),
      );
    } else if (artifact.productionStatus !== "CURRENT") {
      legacyInstanceCount += 1;
      blockers.push(
        diagnostic(
          "LEGACY_INSTANCE_RUNNING",
          prefix,
          "Legacy or unknown artifact instance is still running.",
        ),
      );
    }
    const expectedStartupEntry =
      kind === "web"
        ? "WEB_SECURE_LAUNCHER"
        : "WORKER_SIGNED_RELEASE_INDEX";
    if (instance.startupEntry !== expectedStartupEntry) {
      blockers.push(
        diagnostic(
          "STARTUP_ENTRY_UNVERIFIED",
          `${prefix}.startupEntry`,
          `Expected startup entry ${expectedStartupEntry}.`,
        ),
      );
    }
  }
  for (const process of evidence.inventory.processes) {
    const artifact = process.artifactId
      ? artifacts.get(process.artifactId)
      : null;
    if (
      process.artifactId &&
      (!artifact || artifact.productionStatus !== "CURRENT")
    ) {
      blockers.push(
        diagnostic(
          "LEGACY_PROCESS_RUNNING",
          `$.inventory.processes.${process.processId}`,
          "A process is bound to a legacy or unknown artifact.",
        ),
      );
    }
  }

  let legacyAutoRestartCount = 0;
  for (const service of evidence.inventory.services) {
    if (!service.automaticRestart) {
      continue;
    }
    const artifact = service.artifactId
      ? artifacts.get(service.artifactId)
      : null;
    if (!artifact || artifact.productionStatus !== "CURRENT") {
      legacyAutoRestartCount += 1;
      blockers.push(
        diagnostic(
          "LEGACY_AUTOMATIC_RESTART_ENABLED",
          `$.inventory.services.${service.name}`,
          "Automatic restart does not target a verified CURRENT artifact.",
        ),
      );
    }
  }

  let enabledLegacySchedulerCount = 0;
  for (const scheduler of evidence.inventory.schedulers) {
    if (!scheduler.enabled) {
      continue;
    }
    const artifact = scheduler.artifactId
      ? artifacts.get(scheduler.artifactId)
      : null;
    if (!artifact || artifact.productionStatus !== "CURRENT") {
      enabledLegacySchedulerCount += 1;
      blockers.push(
        diagnostic(
          "LEGACY_SCHEDULER_ENABLED",
          `$.inventory.schedulers.${scheduler.name}`,
          "Enabled scheduler does not target a verified CURRENT artifact.",
        ),
      );
    }
  }

  for (const field of [
    "legacyRunning",
    "legacyBacklog",
    "legacyFailed",
  ] as const) {
    if (evidence.queue[field] !== 0) {
      blockers.push(
        diagnostic(
          "LEGACY_QUEUE_NOT_DRAINED",
          `$.queue.${field}`,
          `${field} must be verified exactly zero.`,
        ),
      );
    }
  }
  if (evidence.queue.oldestLegacyJobAt !== null) {
    blockers.push(
      diagnostic(
        "LEGACY_QUEUE_AGE_PRESENT",
        "$.queue.oldestLegacyJobAt",
        "No oldest legacy job timestamp may remain when the queue is drained.",
      ),
    );
  }

  const requiredRoles = [
    "WEB_RUNTIME_IDENTITY",
    "WORKER_RUNTIME_IDENTITY",
    "MAINTENANCE_RUNTIME_IDENTITY",
  ] as const;
  const runtimeRoles = new Set<RuntimeRole>();
  for (const identity of evidence.runtimeIdentities) {
    if (runtimeRoles.has(identity.role)) {
      blockers.push(
        diagnostic(
          "DUPLICATE_RUNTIME_ROLE",
          `$.runtimeIdentities.${identity.role}`,
          "Runtime role evidence must be unique.",
        ),
      );
    }
    runtimeRoles.add(identity.role);
  }
  const aclKeys = new Set<string>();
  for (const acl of evidence.storageAcls) {
    const key = `${acl.role}:${acl.resource}:${acl.permission}`;
    if (aclKeys.has(key)) {
      blockers.push(
        diagnostic(
          "DUPLICATE_ACL_EVIDENCE",
          `$.storageAcls.${key}`,
          "ACL evidence entries must be unique.",
        ),
      );
    }
    aclKeys.add(key);
  }
  for (const role of requiredRoles) {
    const identity = evidence.runtimeIdentities.find(
      (candidate) => candidate.role === role,
    );
    const prefix = `$.runtimeIdentities.${role}`;
    if (!identity) {
      blockers.push(
        diagnostic(
          "RUNTIME_IDENTITY_MISSING",
          prefix,
          "Required runtime identity evidence is missing.",
        ),
      );
      continue;
    }
    if (!identity.releaseRootRead) {
      blockers.push(
        diagnostic(
          "RELEASE_ROOT_NOT_READABLE",
          `${prefix}.releaseRootRead`,
          "Runtime identity must be able to read the release root.",
        ),
      );
    }
    if (identity.releaseRootWrite) {
      blockers.push(
        diagnostic(
          "RELEASE_ROOT_WRITABLE",
          `${prefix}.releaseRootWrite`,
          "Runtime identity must not write the release root.",
        ),
      );
    }
    if (!identity.trustRootRead) {
      blockers.push(
        diagnostic(
          "TRUST_ROOT_NOT_READABLE",
          `${prefix}.trustRootRead`,
          "Runtime identity must be able to read the Trust Root.",
        ),
      );
    }
    if (identity.trustRootWrite) {
      blockers.push(
        diagnostic(
          "TRUST_ROOT_WRITABLE_BY_RUNTIME",
          `${prefix}.trustRootWrite`,
          "Runtime identity must not write the Trust Root.",
        ),
      );
    }
    if (identity.storagePhysicalDelete !== "DENIED_VERIFIED") {
      blockers.push(
        diagnostic(
          "STORAGE_DELETE_NOT_DENIED",
          `${prefix}.storagePhysicalDelete`,
          "Physical Storage delete must be verified denied.",
        ),
      );
    }
    if (identity.cleanupCapability !== "DISABLED") {
      blockers.push(
        diagnostic(
          "RUNTIME_CLEANUP_NOT_DISABLED",
          `${prefix}.cleanupCapability`,
          "Runtime cleanup capability must remain DISABLED.",
        ),
      );
    }
    for (const [resource, permission] of [
      ["RELEASE_ROOT", "WRITE"],
      ["RELEASE_ROOT", "DELETE"],
      ["TRUST_ROOT", "WRITE"],
      ["TRUST_ROOT", "DELETE"],
      ["STORAGE_ROOT", "DELETE"],
    ] as const) {
      const acl = evidence.storageAcls.find(
        (candidate) =>
          candidate.role === role &&
          candidate.resource === resource &&
          candidate.permission === permission,
      );
      if (!acl || acl.status !== "DENIED_VERIFIED") {
        blockers.push(
          diagnostic(
            "ACL_DENIAL_NOT_VERIFIED",
            `$.storageAcls.${role}.${resource}.${permission}`,
            "Required ACL denial is missing or not verified.",
          ),
        );
      }
    }
  }
  const futureCleanup = evidence.runtimeIdentities.find(
    (identity) => identity.role === "FUTURE_CLEANUP_IDENTITY",
  );
  if (futureCleanup?.cleanupCapability === "ENABLED") {
    blockers.push(
      diagnostic(
        "FUTURE_CLEANUP_ENABLED",
        "$.runtimeIdentities.FUTURE_CLEANUP_IDENTITY",
        "Future Cleanup must remain disabled during legacy drain.",
      ),
    );
  }

  const readyForLegacyDrain = blockers.length === 0;
  return {
    status: readyForLegacyDrain ? "READY" : "BLOCKED",
    valid: true,
    readyForLegacyDrain,
    blockers,
    warnings,
    retainedArtifactCount: evidence.inventory.artifacts.length,
    currentArtifactCount: currentArtifacts.length,
    legacyInstanceCount,
    enabledLegacySchedulerCount,
    legacyAutoRestartCount,
  };
}
