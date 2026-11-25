import { describe, expect, it } from "vitest";

import {
  sealDeploymentEvidence,
  validateDeploymentEvidence,
  type DeploymentEvidence,
  type RuntimeIdentityEvidence,
  type StorageAclEvidence,
} from "../scripts/p13-deployment-evidence/evidence";

const NOW = new Date("2026-11-18T03:30:00.000Z");
const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const DIGEST_C = "c".repeat(64);

function criticalIdentities(): RuntimeIdentityEvidence[] {
  return [
    "WEB_RUNTIME_IDENTITY",
    "WORKER_RUNTIME_IDENTITY",
    "MAINTENANCE_RUNTIME_IDENTITY",
  ].map((role) => ({
    role: role as RuntimeIdentityEvidence["role"],
    account: `SERVICE-${role}`,
    releaseRootRead: true,
    releaseRootWrite: false,
    trustRootRead: true,
    trustRootWrite: false,
    storagePhysicalDelete: "DENIED_VERIFIED",
    cleanupCapability: "DISABLED",
  }));
}

function deniedAcls(): StorageAclEvidence[] {
  const roles = [
    "WEB_RUNTIME_IDENTITY",
    "WORKER_RUNTIME_IDENTITY",
    "MAINTENANCE_RUNTIME_IDENTITY",
  ] as const;
  const controls = [
    ["RELEASE_ROOT", "WRITE"],
    ["RELEASE_ROOT", "DELETE"],
    ["TRUST_ROOT", "WRITE"],
    ["TRUST_ROOT", "DELETE"],
    ["STORAGE_ROOT", "DELETE"],
  ] as const;
  return roles.flatMap((role) =>
    controls.map(([resource, permission]) => ({
      role,
      resource,
      permission,
      status: "DENIED_VERIFIED" as const,
    })),
  );
}

function baseEvidence(): Omit<DeploymentEvidence, "integrity"> {
  return {
    schemaVersion: 1,
    evidenceId: "prod-host-01-20261118",
    collectedAt: "2026-11-18T03:29:00.000Z",
    collectorVersion: "p13-l7-manual-v1",
    hostId: "prod-host-01",
    environment: "PRODUCTION",
    inventory: {
      processes: [],
      services: [
        {
          name: "ElevatorWorker",
          state: "RUNNING",
          startMode: "AUTO",
          automaticRestart: true,
          artifactId: "artifact-worker-current",
        },
      ],
      schedulers: [
        {
          name: "regular-file-maintenance",
          kind: "PGBOSS",
          enabled: true,
          artifactId: "artifact-worker-current",
        },
      ],
      webInstances: [
        {
          instanceId: "web-01",
          hostId: "prod-host-01",
          artifactId: "artifact-web-current",
          runtimeIdentity: "SERVICE-WEB_RUNTIME_IDENTITY",
          startupEntry: "WEB_SECURE_LAUNCHER",
          activeJobs: 0,
        },
      ],
      workerInstances: [
        {
          instanceId: "worker-01",
          hostId: "prod-host-01",
          artifactId: "artifact-worker-current",
          runtimeIdentity: "SERVICE-WORKER_RUNTIME_IDENTITY",
          startupEntry: "WORKER_SIGNED_RELEASE_INDEX",
          activeJobs: 0,
        },
      ],
      maintenanceInstances: [
        {
          instanceId: "maintenance-01",
          hostId: "prod-host-01",
          artifactId: "artifact-worker-current",
          runtimeIdentity: "SERVICE-MAINTENANCE_RUNTIME_IDENTITY",
          startupEntry: "WORKER_SIGNED_RELEASE_INDEX",
          activeJobs: 0,
        },
      ],
      artifacts: [
        {
          artifactId: "artifact-web-current",
          application: "web",
          location: "C:\\release-root\\releases\\web-1",
          buildId: "1".repeat(32),
          releaseId: "web-release-1",
          sourceTreeDigest: DIGEST_A,
          artifactDigest: DIGEST_B,
          runtimeDependencyDigest: DIGEST_C,
          manifestStatus: "VERIFIED",
          startupGateStatus: "VERIFIED",
          productionStatus: "CURRENT",
          cleanupCapability: "DISABLED",
          legacyDeleteMarkers: 0,
          canStartDirectly: false,
          canBeRestarted: true,
        },
        {
          artifactId: "artifact-worker-current",
          application: "worker",
          location: "C:\\release-root\\releases\\worker-1",
          buildId: "2".repeat(32),
          releaseId: "worker-release-1",
          sourceTreeDigest: DIGEST_C,
          artifactDigest: DIGEST_A,
          runtimeDependencyDigest: DIGEST_B,
          manifestStatus: "VERIFIED",
          startupGateStatus: "VERIFIED",
          productionStatus: "CURRENT",
          cleanupCapability: "DISABLED",
          legacyDeleteMarkers: 0,
          canStartDirectly: false,
          canBeRestarted: true,
        },
        {
          artifactId: "artifact-worker-legacy",
          application: "worker",
          location: "C:\\legacy\\apps\\worker\\dist",
          buildId: null,
          releaseId: null,
          sourceTreeDigest: null,
          artifactDigest: null,
          runtimeDependencyDigest: null,
          manifestStatus: "FAILED",
          startupGateStatus: "FAILED",
          productionStatus: "LEGACY",
          cleanupCapability: "UNKNOWN",
          legacyDeleteMarkers: 3,
          canStartDirectly: false,
          canBeRestarted: false,
        },
      ],
    },
    trustChain: {
      buildPipelineStatus: "VERIFIED",
      releaseSigningKeyStatus: "ACTIVE",
      trustRootConfigured: true,
      trustRootPath: "C:\\trust-root\\trusted-keys.json",
      trustRootRuntimeWritable: false,
      trustRootAdminOnly: true,
      privateSigningKeyRuntimeAccessible: false,
    },
    queue: {
      legacyRunning: 0,
      legacyBacklog: 0,
      legacyFailed: 0,
      oldestLegacyJobAt: null,
    },
    runtimeIdentities: criticalIdentities(),
    storageAcls: deniedAcls(),
  };
}

function sealed(
  overrides: Partial<Omit<DeploymentEvidence, "integrity">> = {},
): DeploymentEvidence {
  return sealDeploymentEvidence({
    ...baseEvidence(),
    ...overrides,
  });
}

describe("deployment evidence validator", () => {
  it("accepts a fully evidenced production drain candidate", () => {
    const result = validateDeploymentEvidence(sealed(), NOW);

    expect(result).toMatchObject({
      status: "READY",
      valid: true,
      readyForLegacyDrain: true,
      blockers: [],
      currentArtifactCount: 2,
      legacyInstanceCount: 0,
      enabledLegacySchedulerCount: 0,
      legacyAutoRestartCount: 0,
    });
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "EVIDENCE_CHECKSUM_NOT_AUTHENTICATED",
      }),
    ]);
  });

  it("rejects secret-like evidence before readiness evaluation", () => {
    const result = validateDeploymentEvidence(
      {
        ...sealed(),
        collectorVersion:
          "postgresql://user:secret@example.invalid/database",
      },
      NOW,
    );

    expect(result).toMatchObject({
      status: "INVALID",
      readyForLegacyDrain: false,
    });
    expect(result.blockers[0]?.code).toBe(
      "EVIDENCE_SECRET_DETECTED",
    );
  });

  it("rejects stale evidence and a modified integrity digest", () => {
    const stale = validateDeploymentEvidence(
      sealDeploymentEvidence({
        ...baseEvidence(),
        collectedAt: "2026-11-16T00:00:00.000Z",
      }),
      NOW,
    );
    expect(stale.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EVIDENCE_STALE" }),
      ]),
    );

    const evidence = sealed();
    const tampered = {
      ...evidence,
      integrity: {
        ...evidence.integrity,
        digest: "f".repeat(64),
      },
    };
    expect(validateDeploymentEvidence(tampered, NOW).blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EVIDENCE_DIGEST_MISMATCH",
        }),
      ]),
    );
  });

  it("blocks missing or runtime-writable trust roots", () => {
    const result = validateDeploymentEvidence(
      sealDeploymentEvidence({
        ...baseEvidence(),
        trustChain: {
          ...baseEvidence().trustChain,
          releaseSigningKeyStatus: "NOT_CONFIGURED",
          trustRootConfigured: false,
          trustRootRuntimeWritable: true,
          trustRootAdminOnly: false,
          privateSigningKeyRuntimeAccessible: true,
        },
      }),
      NOW,
    );

    expect(result.readyForLegacyDrain).toBe(false);
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "RELEASE_SIGNING_KEY_NOT_ACTIVE",
        "TRUST_ROOT_NOT_CONFIGURED",
        "TRUST_ROOT_RUNTIME_WRITABLE",
        "TRUST_ROOT_ADMIN_ONLY_NOT_VERIFIED",
        "PRIVATE_SIGNING_KEY_RUNTIME_ACCESS",
      ]),
    );
  });

  it("blocks legacy instances, direct startup, scheduler, and auto-restart", () => {
    const evidence = baseEvidence();
    evidence.inventory.workerInstances = [
      {
        ...evidence.inventory.workerInstances[0]!,
        artifactId: "artifact-worker-legacy",
        startupEntry: "WORKER_DIRECT_LEGACY_DIST",
      },
    ];
    evidence.inventory.schedulers = [
      {
        name: "legacy-cron",
        kind: "CRON",
        enabled: true,
        artifactId: "artifact-worker-legacy",
      },
    ];
    evidence.inventory.services = [
      {
        name: "legacy-watchdog",
        state: "RUNNING",
        startMode: "AUTO",
        automaticRestart: true,
        artifactId: "artifact-worker-legacy",
      },
    ];
    evidence.queue.legacyRunning = 1;

    const result = validateDeploymentEvidence(
      sealDeploymentEvidence(evidence),
      NOW,
    );

    expect(result).toMatchObject({
      readyForLegacyDrain: false,
      legacyInstanceCount: 1,
      enabledLegacySchedulerCount: 1,
      legacyAutoRestartCount: 1,
    });
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "LEGACY_INSTANCE_RUNNING",
        "STARTUP_ENTRY_UNVERIFIED",
        "LEGACY_SCHEDULER_ENABLED",
        "LEGACY_AUTOMATIC_RESTART_ENABLED",
        "LEGACY_QUEUE_NOT_DRAINED",
      ]),
    );
  });

  it("blocks unknown runtime permissions and missing ACL denials", () => {
    const evidence = baseEvidence();
    evidence.runtimeIdentities = evidence.runtimeIdentities.map(
      (identity) =>
        identity.role === "WORKER_RUNTIME_IDENTITY"
          ? {
              ...identity,
              releaseRootWrite: true,
              trustRootWrite: true,
              storagePhysicalDelete: "UNKNOWN",
              cleanupCapability: "ENABLED",
            }
          : identity,
    );
    evidence.storageAcls = evidence.storageAcls.filter(
      (acl) =>
        !(
          acl.role === "WEB_RUNTIME_IDENTITY" &&
          acl.resource === "STORAGE_ROOT" &&
          acl.permission === "DELETE"
        ),
    );

    const result = validateDeploymentEvidence(
      sealDeploymentEvidence(evidence),
      NOW,
    );
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "RELEASE_ROOT_WRITABLE",
        "TRUST_ROOT_WRITABLE_BY_RUNTIME",
        "STORAGE_DELETE_NOT_DENIED",
        "RUNTIME_CLEANUP_NOT_DISABLED",
        "ACL_DENIAL_NOT_VERIFIED",
      ]),
    );
  });

  it("blocks an unsafe CURRENT artifact and enabled future cleanup", () => {
    const evidence = baseEvidence();
    evidence.inventory.artifacts =
      evidence.inventory.artifacts.map((artifact) =>
        artifact.artifactId === "artifact-worker-current"
          ? {
              ...artifact,
              cleanupCapability: "ENABLED",
              legacyDeleteMarkers: 1,
              canStartDirectly: true,
            }
          : artifact,
      );
    evidence.runtimeIdentities = [
      ...evidence.runtimeIdentities,
      {
        role: "FUTURE_CLEANUP_IDENTITY",
        account: "SERVICE-FUTURE_CLEANUP_IDENTITY",
        releaseRootRead: true,
        releaseRootWrite: false,
        trustRootRead: true,
        trustRootWrite: false,
        storagePhysicalDelete: "ALLOWED_VERIFIED",
        cleanupCapability: "ENABLED",
      },
    ];

    const result = validateDeploymentEvidence(
      sealDeploymentEvidence(evidence),
      NOW,
    );
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "ARTIFACT_CLEANUP_NOT_DISABLED",
        "LEGACY_DELETE_MARKERS_PRESENT",
        "FUTURE_CLEANUP_ENABLED",
      ]),
    );
  });
});
