import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto";

import {
  createBuildManifest,
  signBuildManifest,
} from "@elevator/build-integrity";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  EVIDENCE_CATEGORIES,
  sealEvidenceBundleDraft,
  signEvidenceBundle,
  verifyEvidenceBundle,
  type EvidenceBundle,
  type EvidenceVerificationTrust,
} from "../scripts/p13-deployment-evidence/evidence-bundle";
import { EVIDENCE_REQUIREMENT_MATRIX } from "../scripts/p13-deployment-evidence/requirements";

const NOW = new Date("2026-11-18T04:00:00.000Z");
const COLLECTED_AT = "2026-11-18T03:50:00.000Z";
const HOST_ID = "prod-host-01";
const COLLECTOR_ID = "trusted-evidence-collector";
const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const DIGEST_C = "c".repeat(64);

const releaseKeys = generateKeyPairSync("ed25519");
const releasePrivateKeyPem = releaseKeys.privateKey.export({
  format: "pem",
  type: "pkcs8",
}) as string;
const releasePublicKeyPem = releaseKeys.publicKey.export({
  format: "pem",
  type: "spki",
}) as string;
const evidenceKeys = generateKeyPairSync("ed25519");
const evidencePrivateKeyPem = evidenceKeys.privateKey.export({
  format: "pem",
  type: "pkcs8",
}) as string;
const evidencePublicKeyPem = evidenceKeys.publicKey.export({
  format: "pem",
  type: "spki",
}) as string;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function fingerprint(publicKeyPem: string): string {
  return createHash("sha256")
    .update(
      createPublicKey(publicKeyPem).export({
        format: "der",
        type: "spki",
      }),
    )
    .digest("hex");
}

function manifestFor(
  application: "web" | "worker",
  releaseId: string,
  digests: {
    source: string;
    artifact: string;
    runtime: string;
  },
) {
  return signBuildManifest(
    createBuildManifest({
      application,
      releaseId,
      gitSha: "d".repeat(40),
      gitDirty: true,
      sourceTreeDigest: digests.source,
      dependencyLockDigest: DIGEST_A,
      runtimeDependencyDigest: digests.runtime,
      runtimeDependencyCount: 1,
      runtimePlatform: "win32-x64:test",
      artifactDigest: digests.artifact,
    }),
    releasePrivateKeyPem,
    "release-key-1",
  );
}

function provenance(
  evidenceId: string,
  category: (typeof EVIDENCE_CATEGORIES)[number],
) {
  return {
    evidenceId,
    category,
    hostId: HOST_ID,
    collectedAt: COLLECTED_AT,
    collectorIdentity: COLLECTOR_ID,
    collectorVersion: "collector-1.0.0",
    collectionMethod: "READ_ONLY_COLLECTOR",
    trustLevel: 3,
  };
}

function baseDraft(): any {
  const webManifest = manifestFor("web", "release-web-1", {
    source: DIGEST_A,
    artifact: DIGEST_B,
    runtime: DIGEST_C,
  });
  const workerManifest = manifestFor("worker", "release-worker-1", {
    source: DIGEST_C,
    artifact: DIGEST_A,
    runtime: DIGEST_B,
  });
  const adminId = "identity-admin";
  const webIdentityId = "identity-web";
  const workerIdentityId = "identity-worker";
  const maintenanceIdentityId = "identity-maintenance";
  const aclRows = [
    [webIdentityId, "RELEASE_ROOT"],
    [webIdentityId, "TRUST_ROOT"],
    [webIdentityId, "STORAGE_CANONICAL"],
    [webIdentityId, "STORAGE_STAGING"],
    [workerIdentityId, "RELEASE_ROOT"],
    [workerIdentityId, "TRUST_ROOT"],
    [workerIdentityId, "STORAGE_CANONICAL"],
    [maintenanceIdentityId, "RELEASE_ROOT"],
    [maintenanceIdentityId, "TRUST_ROOT"],
    [maintenanceIdentityId, "STORAGE_CANONICAL"],
  ] as const;
  return {
    schemaVersion: 2,
    bundleId: "bundle-prod-01",
    createdAt: COLLECTED_AT,
    coverage: {
      hostInventoryComplete: true,
      instanceInventoryComplete: true,
      schedulerInventoryComplete: true,
      watchdogInventoryComplete: true,
      autoRestartInventoryComplete: true,
      artifactInventoryComplete: true,
      sourceEvidenceId: "evidence-host",
      collectedAt: COLLECTED_AT,
    },
    hosts: [
      {
        ...provenance("evidence-host", "HOST_INVENTORY"),
        hostId: HOST_ID,
        hostRole: "WEB_AND_WORKER",
        operatingSystem: "Windows Server 2025",
        environment: "PRODUCTION",
        region: "internal",
      },
    ],
    processes: [
      {
        ...provenance("evidence-process-web", "PROCESS_INVENTORY"),
        processKey: `${HOST_ID}:1001`,
        processId: 1001,
        parentProcessId: 1000,
        executable: "C:\\Program Files\\nodejs\\node.exe",
        commandLine:
          "node C:\\app\\apps\\web\\scripts\\start-secure.mjs",
        workingDirectory: "C:\\app\\apps\\web",
        runtimeIdentityId: webIdentityId,
        startupEntry: "WEB_SECURE_LAUNCHER",
        artifactId: "artifact-web",
      },
      {
        ...provenance("evidence-process-worker", "PROCESS_INVENTORY"),
        processKey: `${HOST_ID}:2001`,
        processId: 2001,
        parentProcessId: 2000,
        executable: "C:\\Program Files\\nodejs\\node.exe",
        commandLine: "node C:\\release-root\\worker\\index.js",
        workingDirectory: "C:\\release-root\\worker",
        runtimeIdentityId: workerIdentityId,
        startupEntry: "WORKER_SIGNED_RELEASE_INDEX",
        artifactId: "artifact-worker",
      },
      {
        ...provenance(
          "evidence-process-maintenance",
          "PROCESS_INVENTORY",
        ),
        processKey: `${HOST_ID}:2002`,
        processId: 2002,
        parentProcessId: 2001,
        executable: "C:\\Program Files\\nodejs\\node.exe",
        commandLine: "node C:\\release-root\\worker\\index.js",
        workingDirectory: "C:\\release-root\\worker",
        runtimeIdentityId: maintenanceIdentityId,
        startupEntry: "WORKER_SIGNED_RELEASE_INDEX",
        artifactId: "artifact-worker",
      },
    ],
    services: [
      {
        ...provenance("evidence-service-worker", "AUTO_RESTART"),
        serviceId: "service-worker",
        hostId: HOST_ID,
        state: "RUNNING",
        startMode: "AUTO",
        automaticRestart: true,
        targetArtifactId: "artifact-worker",
        targetEntry: "WORKER_SIGNED_RELEASE_INDEX",
        restartPolicy: "ON_FAILURE",
      },
    ],
    schedulers: [
      {
        ...provenance("evidence-scheduler-pgboss", "SCHEDULER"),
        schedulerId: "scheduler-pgboss",
        hostId: HOST_ID,
        schedulerType: "KUBERNETES",
        jobName: "regular-file-maintenance",
        schedule: "*/15 * * * *",
        command: "release-worker index.js",
        workingDirectory: "C:\\release-root\\worker",
        targetArtifactId: "artifact-worker",
        targetEntry: "WORKER_SIGNED_RELEASE_INDEX",
        restartPolicy: "NONE",
        enabled: true,
        lastExecutionAt: "2026-11-18T03:45:00.000Z",
        nextExecutionAt: "2026-11-18T04:00:00.000Z",
        evidenceSource: "scheduler export",
      },
    ],
    watchdogs: [
      {
        ...provenance("evidence-watchdog-none", "WATCHDOG"),
        watchdogId: "watchdog-none",
        hostId: HOST_ID,
        watchdogType: "WINDOWS_SERVICE",
        enabled: false,
        targetArtifactId: null,
        restartPolicy: "NONE",
      },
    ],
    instances: [
      {
        ...provenance("evidence-instance-web", "WEB_INSTANCE"),
        instanceId: "instance-web-1",
        hostId: HOST_ID,
        kind: "WEB",
        processKey: `${HOST_ID}:1001`,
        runtimeIdentityId: webIdentityId,
        startupEntry: "WEB_SECURE_LAUNCHER",
        artifactId: "artifact-web",
        releaseRootId: "release-root-1",
        releaseId: "release-web-1",
        buildId: webManifest.manifest.buildId,
        manifestDigest: DIGEST_B,
        artifactDigest: DIGEST_B,
        runtimeDependencyDigest: DIGEST_C,
        lifecycleSafetyVersion: "1.0.0",
        processStartedAt: "2026-11-18T03:00:00.000Z",
        automaticRestartId: null,
      },
      {
        ...provenance("evidence-instance-worker", "WORKER_INSTANCE"),
        instanceId: "instance-worker-1",
        hostId: HOST_ID,
        kind: "WORKER",
        processKey: `${HOST_ID}:2001`,
        runtimeIdentityId: workerIdentityId,
        startupEntry: "WORKER_SIGNED_RELEASE_INDEX",
        artifactId: "artifact-worker",
        releaseRootId: "release-root-1",
        releaseId: "release-worker-1",
        buildId: workerManifest.manifest.buildId,
        manifestDigest: DIGEST_A,
        artifactDigest: DIGEST_A,
        runtimeDependencyDigest: DIGEST_B,
        lifecycleSafetyVersion: "1.0.0",
        processStartedAt: "2026-11-18T03:00:00.000Z",
        automaticRestartId: "service-worker",
      },
      {
        ...provenance(
          "evidence-instance-maintenance",
          "WORKER_INSTANCE",
        ),
        instanceId: "instance-maintenance-1",
        hostId: HOST_ID,
        kind: "MAINTENANCE",
        processKey: `${HOST_ID}:2002`,
        runtimeIdentityId: maintenanceIdentityId,
        startupEntry: "WORKER_SIGNED_RELEASE_INDEX",
        artifactId: "artifact-worker",
        releaseRootId: "release-root-1",
        releaseId: "release-worker-1",
        buildId: workerManifest.manifest.buildId,
        manifestDigest: DIGEST_A,
        artifactDigest: DIGEST_A,
        runtimeDependencyDigest: DIGEST_B,
        lifecycleSafetyVersion: "1.0.0",
        processStartedAt: "2026-11-18T03:00:00.000Z",
        automaticRestartId: "service-worker",
      },
    ],
    artifacts: [
      {
        ...provenance("evidence-artifact-web", "ARTIFACT_IDENTITY"),
        artifactId: "artifact-web",
        application: "web",
        location: "C:\\release-root\\web",
        releaseId: "release-web-1",
        buildId: webManifest.manifest.buildId,
        sourceTreeDigest: DIGEST_A,
        artifactDigest: DIGEST_B,
        runtimeDependencyDigest: DIGEST_C,
        manifestSchemaVersion: 1,
        manifestEnvelope: webManifest,
        trustRootId: "trust-root-1",
        keyId: "release-key-1",
        lifecycleSafetyVersion: "1.0.0",
        legacyDeleteMarkerCount: 0,
        startupGateStatus: "VERIFIED",
        cleanupCapability: "DISABLED",
        productionStatus: "CURRENT",
        canStartDirectly: false,
        canBeRestarted: true,
      },
      {
        ...provenance("evidence-artifact-worker", "ARTIFACT_IDENTITY"),
        artifactId: "artifact-worker",
        application: "worker",
        location: "C:\\release-root\\worker",
        releaseId: "release-worker-1",
        buildId: workerManifest.manifest.buildId,
        sourceTreeDigest: DIGEST_C,
        artifactDigest: DIGEST_A,
        runtimeDependencyDigest: DIGEST_B,
        manifestSchemaVersion: 1,
        manifestEnvelope: workerManifest,
        trustRootId: "trust-root-1",
        keyId: "release-key-1",
        lifecycleSafetyVersion: "1.0.0",
        legacyDeleteMarkerCount: 0,
        startupGateStatus: "VERIFIED",
        cleanupCapability: "DISABLED",
        productionStatus: "CURRENT",
        canStartDirectly: false,
        canBeRestarted: true,
      },
    ],
    trustRoots: [
      {
        ...provenance("evidence-trust-root", "TRUST_ROOT"),
        trustRootId: "trust-root-1",
        location: "C:\\trust-root\\trusted-keys.json",
        readPrincipals: ["WebRuntime", "WorkerRuntime"],
        modifyingPrincipals: ["TrustRootAdmin"],
        lastRotatedAt: "2026-01-01T00:00:00.000Z",
        keys: [
          {
            keyId: "release-key-1",
            publicKeyPem: releasePublicKeyPem,
            fingerprintSha256: fingerprint(releasePublicKeyPem),
            validFrom: "2026-01-01T00:00:00.000Z",
            validTo: "2027-01-01T00:00:00.000Z",
            status: "ACTIVE",
          },
        ],
      },
    ],
    releaseRoots: [
      {
        ...provenance("evidence-release-root", "RELEASE_ROOT"),
        releaseRootId: "release-root-1",
        location: "C:\\release-root",
        ownerIdentityId: adminId,
        modifyingIdentityIds: [adminId],
        readingIdentityIds: [
          webIdentityId,
          workerIdentityId,
          maintenanceIdentityId,
        ],
        runtimeWriteDeniedVerified: true,
        parentWriteDeniedVerified: true,
        runtimeDeleteDeniedVerified: true,
        reparsePointFreeVerified: true,
        atomicSwitchVerified: true,
      },
    ],
    runtimeIdentities: [
      {
        ...provenance("evidence-identity-web", "RUNTIME_IDENTITY"),
        runtimeIdentityId: webIdentityId,
        hostId: HOST_ID,
        role: "WEB_RUNTIME_IDENTITY",
        account: "SVC-WEB",
        sharedAccount: false,
        releaseRootRead: true,
        releaseRootWrite: false,
        trustRootRead: true,
        trustRootWrite: false,
        storagePhysicalDelete: "DENIED_VERIFIED",
        cleanupCapability: "DISABLED",
      },
      {
        ...provenance("evidence-identity-worker", "RUNTIME_IDENTITY"),
        runtimeIdentityId: workerIdentityId,
        hostId: HOST_ID,
        role: "WORKER_RUNTIME_IDENTITY",
        account: "SVC-WORKER",
        sharedAccount: false,
        releaseRootRead: true,
        releaseRootWrite: false,
        trustRootRead: true,
        trustRootWrite: false,
        storagePhysicalDelete: "DENIED_VERIFIED",
        cleanupCapability: "DISABLED",
      },
      {
        ...provenance(
          "evidence-identity-maintenance",
          "RUNTIME_IDENTITY",
        ),
        runtimeIdentityId: maintenanceIdentityId,
        hostId: HOST_ID,
        role: "MAINTENANCE_RUNTIME_IDENTITY",
        account: "SVC-MAINT",
        sharedAccount: false,
        releaseRootRead: true,
        releaseRootWrite: false,
        trustRootRead: true,
        trustRootWrite: false,
        storagePhysicalDelete: "DENIED_VERIFIED",
        cleanupCapability: "DISABLED",
      },
      {
        ...provenance("evidence-identity-admin", "RUNTIME_IDENTITY"),
        runtimeIdentityId: adminId,
        hostId: HOST_ID,
        role: "DEPLOYMENT_ADMIN_IDENTITY",
        account: "ADMIN-DEPLOY",
        sharedAccount: false,
        releaseRootRead: true,
        releaseRootWrite: true,
        trustRootRead: false,
        trustRootWrite: false,
        storagePhysicalDelete: "DENIED_VERIFIED",
        cleanupCapability: "DISABLED",
      },
    ],
    storageAcls: aclRows.map(
      ([runtimeIdentityId, resourceType], index) => ({
        ...provenance(`evidence-acl-${index}`, "STORAGE_ACL"),
        aclId: `acl-${index}`,
        hostId: HOST_ID,
        runtimeIdentityId,
        resourceType,
        path:
          resourceType === "RELEASE_ROOT"
            ? "C:\\release-root"
            : resourceType === "TRUST_ROOT"
              ? "C:\\trust-root"
              : "C:\\storage",
        permissions: {
          read: true,
          create:
            resourceType === "STORAGE_STAGING" &&
            runtimeIdentityId === webIdentityId,
          write:
            resourceType === "STORAGE_STAGING" &&
            runtimeIdentityId === webIdentityId,
          rename:
            resourceType === "STORAGE_STAGING" &&
            runtimeIdentityId === webIdentityId,
          delete: false,
          modifyAcl: false,
          changeOwner: false,
        },
        inheritanceEnabled: false,
        parentWidePermission: false,
        reparsePointPresent: false,
        externalObjectStore: false,
        aclModifierIdentityIds: [adminId],
      }),
    ),
    queueSnapshots: [
      {
        ...provenance("evidence-queue", "QUEUE_STATE"),
        snapshotId: "queue-snapshot-1",
        snapshotAt: "2026-11-18T03:55:00.000Z",
        source: "APPROVED_PGBOSS_EXPORT",
        waitingJobs: 0,
        activeJobs: 0,
        retryJobs: 0,
        failedJobs: 0,
        scheduledJobs: 0,
        oldestJobAt: null,
        workerConsumptionRate: 0,
        unfinishedOperations: 0,
        activeUploads: 0,
        processingRecoveryStatus: "IDLE",
      },
    ],
    runningJobs: [],
    networkDependencies: [
      {
        ...provenance(
          "evidence-network-db",
          "NETWORK_AND_DEPENDENCY",
        ),
        dependencyId: "dependency-db",
        dependencyType: "DATABASE",
        target: "PostgreSQL service name only",
        legacyWorkerReachable: false,
      },
    ],
    approvals: [
      {
        ...provenance("evidence-approval-1", "DRAIN_APPROVAL"),
        approvalId: "approval-1",
        bundleId: "bundle-prod-01",
        scope: "LEGACY_DRAIN",
        approverIdentity: "admin-1",
        approverRole: "DEPLOYMENT_ADMIN",
        independent: true,
        approvedAt: "2026-11-18T03:56:00.000Z",
      },
      {
        ...provenance("evidence-approval-2", "DRAIN_APPROVAL"),
        approvalId: "approval-2",
        bundleId: "bundle-prod-01",
        scope: "LEGACY_DRAIN",
        approverIdentity: "admin-2",
        approverRole: "SECURITY_REVIEWER",
        independent: true,
        approvedAt: "2026-11-18T03:57:00.000Z",
      },
    ],
    integrity: {
      algorithm: "sha256",
      digest: "0".repeat(64),
    },
    signature: null,
  };
}

const trust: EvidenceVerificationTrust = {
  signerPublicKeys: { "evidence-key-1": evidencePublicKeyPem },
  trustedCollectorIdentities: [COLLECTOR_ID],
};

function signedBundle(
  draft: Record<string, unknown> = baseDraft(),
): EvidenceBundle {
  const sealed = sealEvidenceBundleDraft(draft);
  return signEvidenceBundle(sealed, {
    keyId: "evidence-key-1",
    privateKeyPem: evidencePrivateKeyPem,
  });
}

describe("L8-A production evidence bundle", () => {
  it("produces READY FOR HUMAN REVIEW for a complete signed bundle", () => {
    const result = verifyEvidenceBundle(signedBundle(), {
      trust,
      now: NOW,
    });

    expect(result).toMatchObject({
      productionEvidenceStatus: "COMPLETE",
      drainReadiness: "READY FOR HUMAN REVIEW",
      productionDrain: "NOT EXECUTED",
      blockers: [],
      summary: {
        hostCount: 1,
        instanceCount: 3,
        currentArtifactCount: 2,
        legacyArtifactCount: 0,
        approvalCount: 2,
      },
    });
  });

  it("blocks tampered evidence, untrusted signer, and stale evidence", () => {
    const bundle = signedBundle();
    const tampered = {
      ...bundle,
      approvals: bundle.approvals.map((approval, index) =>
        index === 0
          ? {
              ...approval,
              independent: false,
            }
          : approval,
      ),
    };
    expect(
      verifyEvidenceBundle(tampered, { trust, now: NOW }).blockers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EVIDENCE_DIGEST_MISMATCH",
        }),
      ]),
    );
    expect(
      verifyEvidenceBundle(bundle, {
        trust: {
          signerPublicKeys: {},
          trustedCollectorIdentities: [COLLECTOR_ID],
        },
        now: NOW,
      }).blockers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EVIDENCE_SIGNER_UNTRUSTED",
        }),
      ]),
    );
    expect(
      verifyEvidenceBundle(bundle, {
        trust,
        now: new Date("2026-11-20T04:00:00.000Z"),
      }).blockers,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EVIDENCE_STALE" }),
      ]),
    );
  });

  it("blocks unknown hosts and inconsistent instance/process evidence", () => {
    const draft = baseDraft();
    draft.processes[0]!.hostId = "unknown-host";
    draft.instances[0]!.processKey = "missing-process";

    const result = verifyEvidenceBundle(signedBundle(draft), {
      trust,
      now: NOW,
    });
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "UNKNOWN_HOST_REFERENCE",
        "INSTANCE_PROCESS_UNKNOWN",
      ]),
    );
  });

  it("blocks a missing host inventory and missing Worker instance", () => {
    const missingHostDraft = baseDraft();
    missingHostDraft.hosts = [];
    const missingHost = verifyEvidenceBundle(
      missingHostDraft,
      { trust, now: NOW },
    );
    expect(missingHost).toMatchObject({
      productionEvidenceStatus: "BLOCKED",
      drainReadiness: "BLOCKED",
    });

    const missingWorkerDraft = baseDraft();
    missingWorkerDraft.instances =
      missingWorkerDraft.instances.filter(
        (instance: { kind: string }) => instance.kind !== "WORKER",
      );
    const missingWorker = verifyEvidenceBundle(
      signedBundle(missingWorkerDraft),
      { trust, now: NOW },
    );
    expect(missingWorker.blockers.map((item) => item.code)).toContain(
      "WORKER_INSTANCE_MISSING",
    );
  });

  it("blocks invalid manifests and revoked signing keys", () => {
    const draft = baseDraft();
    const artifact = draft.artifacts[0]!;
    artifact.manifestEnvelope = {
      manifest: {
        ...(artifact.manifestEnvelope as {
          manifest: Record<string, unknown>;
        }).manifest,
        releaseId: "different-release",
      },
      signature: (
        artifact.manifestEnvelope as {
          signature: Record<string, unknown>;
        }
      ).signature,
    };
    draft.trustRoots[0]!.keys[0]!.status = "REVOKED";
    draft.artifacts[1]!.lifecycleSafetyVersion = "0.9.9";

    const result = verifyEvidenceBundle(signedBundle(draft), {
      trust,
      now: NOW,
    });
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "UNTRUSTED_SIGNING_KEY",
        "ARTIFACT_KEY_NOT_ACTIVE",
      ]),
    );
  });

  it("independently rejects a tampered manifest signature", () => {
    const draft = baseDraft();
    const artifact = draft.artifacts[0]!;
    artifact.manifestEnvelope = {
      manifest: {
        ...artifact.manifestEnvelope.manifest,
        releaseId: "different-release",
      },
      signature: artifact.manifestEnvelope.signature,
    };

    const result = verifyEvidenceBundle(signedBundle(draft), {
      trust,
      now: NOW,
    });
    expect(result.blockers.map((item) => item.code)).toContain(
      "SIGNATURE_INVALID",
    );
  });

  it("blocks shared identities, delete ACLs, missing ACL evidence, and unsafe Release Root", () => {
    const draft = baseDraft();
    draft.runtimeIdentities[1]!.account =
      draft.runtimeIdentities[0]!.account;
    draft.storageAcls[0]!.permissions.delete = true;
    draft.storageAcls.splice(1, 1);
    draft.releaseRoots[0]!.parentWriteDeniedVerified = false;

    const result = verifyEvidenceBundle(signedBundle(draft), {
      trust,
      now: NOW,
    });
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "SHARED_RUNTIME_ACCOUNT",
        "ACL_UNSAFE_PERMISSION",
        "ACL_EVIDENCE_MISSING",
        "RELEASE_ROOT_ACL_NOT_VERIFIED",
      ]),
    );
  });

  it("blocks legacy scheduler, watchdog, auto restart, and unfinished jobs", () => {
    const draft = baseDraft();
    draft.artifacts.push({
      ...provenance("evidence-artifact-legacy", "ARTIFACT_IDENTITY"),
      artifactId: "artifact-legacy",
      application: "worker",
      location: "C:\\legacy\\apps\\worker\\dist",
      releaseId: "legacy-release",
      buildId: "legacy-build",
      sourceTreeDigest: DIGEST_A,
      artifactDigest: DIGEST_B,
      runtimeDependencyDigest: DIGEST_C,
      manifestSchemaVersion: 1,
      manifestEnvelope: {},
      trustRootId: "trust-root-1",
      keyId: "release-key-1",
      lifecycleSafetyVersion: "1.0.0",
      legacyDeleteMarkerCount: 3,
      startupGateStatus: "UNKNOWN",
      cleanupCapability: "UNKNOWN",
      productionStatus: "LEGACY",
      canStartDirectly: true,
      canBeRestarted: true,
    });
    draft.schedulers[0]!.targetArtifactId = "artifact-legacy";
    draft.services[0]!.targetArtifactId = "artifact-legacy";
    draft.watchdogs[0] = {
      ...provenance("evidence-watchdog-legacy", "WATCHDOG"),
      watchdogId: "legacy-watchdog",
      hostId: HOST_ID,
      watchdogType: "EXTERNAL",
      enabled: true,
      targetArtifactId: "artifact-legacy",
      restartPolicy: "ALWAYS",
    };
    draft.queueSnapshots[0]!.retryJobs = 2;
    draft.runningJobs = [
      {
        ...provenance("evidence-retry-job", "RETRY_JOBS"),
        jobId: "retry-job-1",
        hostId: HOST_ID,
        jobType: "file-recognition",
        status: "RETRY",
        legacyJob: true,
        startedAt: "2026-11-18T03:00:00.000Z",
        workerInstanceId: "instance-worker-1",
      },
    ];

    const result = verifyEvidenceBundle(signedBundle(draft), {
      trust,
      now: NOW,
    });
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "LEGACY_ARTIFACT_REACHABLE",
        "LEGACY_SCHEDULER_ENABLED",
        "LEGACY_AUTO_RESTART",
        "LEGACY_WATCHDOG_ENABLED",
        "QUEUE_NOT_DRAINED",
        "RETRY_JOB_PRESENT",
      ]),
    );
  });

  it("blocks low-trust collectors and insufficient independent approvals", () => {
    const draft = baseDraft();
    for (const item of [
      ...draft.hosts,
      ...draft.processes,
      ...draft.instances,
      ...draft.artifacts,
    ]) {
      item.trustLevel = 1;
    }
    draft.approvals = [draft.approvals[0]!];

    const result = verifyEvidenceBundle(signedBundle(draft), {
      trust,
      now: NOW,
    });
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "EVIDENCE_TRUST_LEVEL_INSUFFICIENT",
        "INDEPENDENT_DRAIN_APPROVAL_MISSING",
      ]),
    );
  });

  it("blocks duplicate process/evidence IDs and cross-host collection skew", () => {
    const duplicateDraft = baseDraft();
    duplicateDraft.processes[1]!.processKey =
      duplicateDraft.processes[0]!.processKey;
    duplicateDraft.processes[1]!.evidenceId =
      duplicateDraft.processes[0]!.evidenceId;
    const duplicateResult = verifyEvidenceBundle(
      signedBundle(duplicateDraft),
      { trust, now: NOW },
    );
    expect(duplicateResult.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "DUPLICATE_PROCESS_ID",
        "DUPLICATE_EVIDENCE_ID",
      ]),
    );

    const skewDraft = baseDraft();
    skewDraft.processes[1]!.collectedAt =
      "2026-11-18T02:00:00.000Z";
    const skewResult = verifyEvidenceBundle(signedBundle(skewDraft), {
      trust,
      now: NOW,
    });
    expect(skewResult.blockers.map((item) => item.code)).toContain(
      "CROSS_HOST_COLLECTION_SKEW",
    );
  });

  it("blocks unknown scheduler, watchdog, and service states", () => {
    const draft = baseDraft();
    draft.schedulers[0]!.schedulerType = "UNKNOWN";
    draft.watchdogs[0]!.watchdogType = "UNKNOWN";
    draft.services[0]!.state = "UNKNOWN";

    const result = verifyEvidenceBundle(signedBundle(draft), {
      trust,
      now: NOW,
    });
    expect(result.blockers.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "SCHEDULER_STATE_UNKNOWN",
        "WATCHDOG_STATE_UNKNOWN",
        "SERVICE_STATE_UNKNOWN",
      ]),
    );
  });

  it("has a complete requirement matrix for every evidence category", () => {
    const categories = new Set(
      EVIDENCE_REQUIREMENT_MATRIX.map((item) => item.category),
    );
    expect([...categories].sort()).toEqual(
      [...EVIDENCE_CATEGORIES].sort(),
    );
    for (const item of EVIDENCE_REQUIREMENT_MATRIX) {
      expect(item.evidenceId).toMatch(/^REQ-/);
      expect(item.source.length).toBeGreaterThan(0);
      expect(item.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(item.failureConditions.length).toBeGreaterThan(0);
    }
  });
});
