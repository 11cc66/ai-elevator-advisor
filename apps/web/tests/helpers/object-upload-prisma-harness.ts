type Row = Record<string, unknown> & { id: string };
type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
};

function cloneMaps(
  maps: Record<string, Map<string, Row>>,
): Record<string, Map<string, Row>> {
  return Object.fromEntries(
    Object.entries(maps).map(([key, value]) => [
      key,
      structuredClone(value),
    ]),
  );
}

function compareValue(actual: unknown, expected: unknown): boolean {
  if (
    expected &&
    typeof expected === "object" &&
    !(expected instanceof Date)
  ) {
    if ("in" in expected) {
      const values = expected.in;
      return Array.isArray(values) && values.includes(actual);
    }
    if ("gt" in expected) {
      return (
        actual instanceof Date &&
        expected.gt instanceof Date &&
        actual.getTime() > expected.gt.getTime()
      ) || (
        typeof actual === "bigint" &&
        typeof expected.gt === "bigint" &&
        actual > expected.gt
      );
    }
    if ("lt" in expected) {
      return (
        actual instanceof Date &&
        expected.lt instanceof Date &&
        actual.getTime() < expected.lt.getTime()
      ) || (
        typeof actual === "bigint" &&
        typeof expected.lt === "bigint" &&
        actual < expected.lt
      );
    }
    if ("not" in expected) {
      return expected.not !== actual;
    }
  }
  return actual === expected;
}

function matches(
  row: Row,
  where: Record<string, unknown> | undefined,
): boolean {
  if (!where) {
    return true;
  }
  return Object.entries(where).every(([key, expected]) =>
    compareValue(row[key], expected),
  );
}

function applyData(
  row: Row,
  data: Record<string, unknown> | undefined,
): Row {
  const next = {
    ...row,
    ...(data ?? {}),
    updatedAt: new Date(),
  };
  return next;
}

export class ObjectUploadPrismaHarness {
  readonly projects = new Map<string, Row>();
  readonly intents = new Map<string, Row>();
  readonly attempts = new Map<string, Row>();
  readonly lifecycles = new Map<string, Row>();
  readonly operations = new Map<string, Row>();
  readonly bindings = new Map<string, Row>();
  readonly files = new Map<string, Row>();
  readonly fileVersions = new Map<string, Row>();
  readonly extractions = new Map<string, Row>();

  failNextOperationLock = false;
  failNextLeaseLookup = false;
  failFinalizationBeforeCommit = false;
  readonly transactionOptions: unknown[] = [];
  failNextTransaction:
    | "LOCAL_STAGING"
    | "LOCAL_CANONICAL"
    | "LOCAL_FINALIZATION"
    | null = null;
  nextCommitResponseLoss:
    | "RESERVATION"
    | "BINDING_OBSERVATION"
    | "FINALIZATION"
    | "LOCAL_STAGING"
    | "LOCAL_CANONICAL"
    | "LOCAL_FINALIZATION"
    | null = null;

  #txTouched = new Set<string>();
  #sequence = 0;
  #transactionTail: Promise<void> = Promise.resolve();

  readonly fileUploadIntent = {
    findUnique: async (args: QueryArgs) => {
      const row = this.intents.get(String(args.where?.id));
      if (!row) {
        return null;
      }
      const project = this.projects.get(String(row.projectId));
      return {
        ...row,
        project: project ? { ...project } : null,
      };
    },
    updateMany: async (args: QueryArgs) => {
      this.#txTouched.add("intent");
      let count = 0;
      for (const [id, row] of this.intents) {
        if (matches(row, args.where)) {
          this.intents.set(id, applyData(row, args.data));
          count += 1;
        }
      }
      return { count };
    },
  };

  readonly fileUploadAttempt = {
    create: async (args: QueryArgs) => {
      this.#txTouched.add("reservation");
      const row: Row = {
        canonicalStorageKey: null,
        status: "RESERVED",
        ...args.data,
        id: String(args.data?.id ?? `attempt-${++this.#sequence}`),
      };
      this.attempts.set(row.id, row);
      return { ...row };
    },
    update: async (args: QueryArgs) => {
      const id = String(args.where?.id);
      const row = this.attempts.get(id);
      if (!row) {
        throw new Error("ATTEMPT_NOT_FOUND");
      }
      const next = applyData(row, args.data);
      this.attempts.set(id, next);
      return { ...next };
    },
    updateMany: async (args: QueryArgs) => {
      let count = 0;
      for (const [id, row] of this.attempts) {
        if (matches(row, args.where)) {
          this.attempts.set(id, applyData(row, args.data));
          count += 1;
        }
      }
      return { count };
    },
    findUnique: async (args: QueryArgs) => {
      const attempt = this.attempts.get(String(args.where?.id));
      if (!attempt) {
        return null;
      }
      if (!args.include) {
        return { ...attempt };
      }
      const staging = [...this.lifecycles.values()].find(
        (row) => row.storageKey === attempt.stagingKey,
      );
      const canonical = [...this.lifecycles.values()].find(
        (row) =>
          row.storageKey === attempt.canonicalStorageKey &&
          row.objectKind === "CANONICAL",
      );
      const operations = [...this.operations.values()]
        .filter((row) => row.sourceAttemptId === attempt.id)
        .map((row) => {
          const binding =
            [...this.bindings.values()].find(
              (candidate) => candidate.operationId === row.id,
            ) ?? null;
          return {
            ...row,
            objectBinding: binding
              ? {
                  ...binding,
                  objectLifecycle:
                    this.lifecycles.get(
                      String(binding.objectLifecycleId),
                    ) ?? null,
                }
              : null,
          };
        });
      return {
        ...attempt,
        stagingLifecycle: staging ? { ...staging } : null,
        canonicalLifecycle: canonical ? { ...canonical } : null,
        operations,
      };
    },
  };

  readonly storageObjectLifecycle = {
    create: async (args: QueryArgs) => {
      this.#txTouched.add("reservation");
      if (args.data?.objectKind === "STAGING") {
        this.#txTouched.add("local-staging");
      }
      if (args.data?.objectKind === "CANONICAL") {
        this.#txTouched.add("local-canonical-created");
      }
      const row: Row = {
        ...args.data,
        id: String(args.data?.id ?? `lifecycle-${++this.#sequence}`),
      };
      this.lifecycles.set(row.id, row);
      return { ...row };
    },
    update: async (args: QueryArgs) => {
      const id = String(args.where?.id);
      const row = this.lifecycles.get(id);
      if (!row) {
        throw new Error("LIFECYCLE_NOT_FOUND");
      }
      const next = applyData(row, args.data);
      this.lifecycles.set(id, next);
      return { ...next };
    },
    updateMany: async (args: QueryArgs) => {
      let count = 0;
      for (const [id, row] of this.lifecycles) {
        if (matches(row, args.where)) {
          this.lifecycles.set(id, applyData(row, args.data));
          count += 1;
        }
      }
      return { count };
    },
    findFirst: async (args: QueryArgs) => {
      if (this.failNextLeaseLookup) {
        this.failNextLeaseLookup = false;
        return null;
      }
      const row = [...this.lifecycles.values()].find((candidate) =>
        matches(candidate, args.where),
      );
      return row ? { ...row } : null;
    },
  };

  readonly storageObjectOperation = {
    create: async (args: QueryArgs) => {
      this.#txTouched.add("reservation");
      if (!("writeIdempotencyKey" in (args.data ?? {}))) {
        this.#txTouched.add("local-operation");
      }
      const row: Row = {
        ...args.data,
        id: String(args.data?.id ?? `operation-${++this.#sequence}`),
      };
      this.operations.set(row.id, row);
      return { ...row };
    },
    update: async (args: QueryArgs) => {
      const id = String(args.where?.id);
      const row = this.operations.get(id);
      if (!row) {
        throw new Error("OPERATION_NOT_FOUND");
      }
      const next = applyData(row, args.data);
      this.operations.set(id, next);
      return { ...next };
    },
    updateMany: async (args: QueryArgs) => {
      let count = 0;
      for (const [id, row] of this.operations) {
        if (matches(row, args.where)) {
          this.operations.set(id, applyData(row, args.data));
          count += 1;
        }
      }
      return { count };
    },
    findFirst: async (args: QueryArgs) => {
      if (this.failNextLeaseLookup) {
        this.failNextLeaseLookup = false;
        return null;
      }
      const row = [...this.operations.values()].find((candidate) =>
        matches(candidate, args.where),
      );
      return row ? { ...row } : null;
    },
  };

  readonly storageObjectBinding = {
    create: async (args: QueryArgs) => {
      this.#txTouched.add("reservation");
      this.#txTouched.add("object-binding");
      const row: Row = {
        providerVersionId: null,
        providerGeneration: null,
        providerRequestId: null,
        sizeBytes: null,
        checksumSha256: null,
        writeObservedAt: null,
        verifiedAt: null,
        ...args.data,
        id: String(args.data?.id ?? `binding-${++this.#sequence}`),
      };
      this.bindings.set(row.id, row);
      return { ...row };
    },
    updateMany: async (args: QueryArgs) => {
      this.#txTouched.add(
        args.data && "writeObservedAt" in args.data
          ? "binding-observation"
          : "binding",
      );
      let count = 0;
      for (const [id, row] of this.bindings) {
        if (matches(row, args.where)) {
          this.bindings.set(id, applyData(row, args.data));
          count += 1;
        }
      }
      return { count };
    },
    findUnique: async (args: QueryArgs) => {
      const row = this.bindings.get(String(args.where?.id));
      return row ? { ...row } : null;
    },
  };

  readonly file = {
    create: async (args: QueryArgs) => {
      this.#txTouched.add("finalization");
      const row: Row = {
        currentVersionId: null,
        ...args.data,
        id: String(args.data?.id ?? `file-${++this.#sequence}`),
      };
      this.files.set(row.id, row);
      return { ...row };
    },
    updateMany: async (args: QueryArgs) => {
      let count = 0;
      for (const [id, row] of this.files) {
        if (matches(row, args.where)) {
          this.files.set(id, applyData(row, args.data));
          count += 1;
        }
      }
      return { count };
    },
  };

  readonly fileVersion = {
    aggregate: async (args: QueryArgs) => {
      const rows = [...this.fileVersions.values()].filter((row) =>
        matches(row, args.where),
      );
      const versions = rows.map((row) => Number(row.versionNumber ?? 0));
      return {
        _max: {
          versionNumber: versions.length > 0
            ? Math.max(...versions)
            : null,
        },
      };
    },
    create: async (args: QueryArgs) => {
      if (this.failFinalizationBeforeCommit) {
        this.failFinalizationBeforeCommit = false;
        throw new Error("SIMULATED_FINALIZATION_BEFORE_COMMIT");
      }
      this.#txTouched.add("finalization");
      const row: Row = {
        ...args.data,
        id: String(args.data?.id ?? `file-version-${++this.#sequence}`),
      };
      this.fileVersions.set(row.id, row);
      return { ...row };
    },
    findFirst: async (args: QueryArgs) => {
      const row = [...this.fileVersions.values()].find((candidate) =>
        matches(candidate, args.where),
      );
      return row ? { ...row } : null;
    },
    findUnique: async (args: QueryArgs) => {
      const row = this.fileVersions.get(String(args.where?.id));
      return row ? { ...row } : null;
    },
    findUniqueOrThrow: async (args: QueryArgs) => {
      const row = this.fileVersions.get(String(args.where?.id));
      if (!row) {
        throw new Error("FILE_VERSION_NOT_FOUND");
      }
      return { ...row };
    },
  };

  readonly fileExtraction = {
    create: async (args: QueryArgs) => {
      this.#txTouched.add("finalization");
      const row: Row = {
        ...args.data,
        id: String(args.data?.id ?? `extraction-${++this.#sequence}`),
      };
      this.extractions.set(row.id, row);
      return { ...row };
    },
    findFirst: async (args: QueryArgs) => {
      const row = [...this.extractions.values()].find((candidate) =>
        matches(candidate, args.where),
      );
      return row ? { ...row } : null;
    },
    findFirstOrThrow: async (args: QueryArgs) => {
      const row = [...this.extractions.values()].find((candidate) =>
        matches(candidate, args.where),
      );
      if (!row) {
        throw new Error("EXTRACTION_NOT_FOUND");
      }
      return { ...row };
    },
  };

  async $queryRaw(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown> {
    const query = strings.join("?");
    if (query.includes('SELECT "currentVersionId"')) {
      const file = this.files.get(String(values[0]));
      return file
        ? [{ currentVersionId: file.currentVersionId ?? null }]
        : [];
    }
    if (query.includes('SELECT "id"') && query.includes("FOR UPDATE")) {
      if (this.failNextOperationLock) {
        this.failNextOperationLock = false;
        throw new Error("SIMULATED_OPERATION_LOCK_FAILURE");
      }
      const [id, ownerToken, generation] = values;
      const row = this.operations.get(String(id));
      if (
        !row ||
        row.ownerToken !== ownerToken ||
        row.fencingGeneration !== generation ||
        !["EXECUTING", "UNKNOWN"].includes(String(row.state))
      ) {
        return [];
      }
      return [{ id: row.id }];
    }
    if (query.includes('SELECT "state"')) {
      const [id, ownerToken, generation] = values;
      const row = this.operations.get(String(id));
      if (
        !row ||
        row.ownerToken !== ownerToken ||
        row.fencingGeneration !== generation
      ) {
        return [];
      }
      return [{ state: row.state }];
    }
    throw new Error(`UNSUPPORTED_RAW_QUERY:${query}`);
  }

  async $transaction<T>(
    callback: (tx: this) => Promise<T>,
    options?: unknown,
  ): Promise<T> {
    this.transactionOptions.push(options);
    const previous = this.#transactionTail;
    let release = (): void => undefined;
    this.#transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const before = this.#snapshotMaps();
      this.#txTouched = new Set<string>();
      let result: T;
      try {
        result = await callback(this);
      } catch (error) {
        this.#restoreMaps(before);
        throw error;
      }

      const localStage =
        this.#txTouched.has("local-staging") &&
        !this.#txTouched.has("local-canonical-created") &&
        !this.#txTouched.has("object-binding")
          ? "LOCAL_STAGING"
          : this.#txTouched.has("local-canonical-created") &&
              this.#txTouched.has("local-operation") &&
              !this.#txTouched.has("object-binding")
            ? "LOCAL_CANONICAL"
            : this.#txTouched.has("finalization") &&
                !this.#txTouched.has("object-binding")
              ? "LOCAL_FINALIZATION"
              : null;
      if (localStage && this.failNextTransaction === localStage) {
        this.failNextTransaction = null;
        this.#restoreMaps(before);
        throw new Error(`SIMULATED_${localStage}_BEFORE_COMMIT`);
      }

      const loss = this.nextCommitResponseLoss;
      if (
        (loss === "RESERVATION" && this.#txTouched.has("reservation")) ||
        (loss === "BINDING_OBSERVATION" &&
          this.#txTouched.has("binding-observation")) ||
        (loss === "FINALIZATION" && this.#txTouched.has("finalization")) ||
        (loss === "LOCAL_STAGING" && localStage === "LOCAL_STAGING") ||
        (loss === "LOCAL_CANONICAL" && localStage === "LOCAL_CANONICAL") ||
        (loss === "LOCAL_FINALIZATION" &&
          localStage === "LOCAL_FINALIZATION")
      ) {
        this.nextCommitResponseLoss = null;
        throw new Error("SIMULATED_COMMIT_RESPONSE_LOSS");
      }
      return result;
    } finally {
      release();
    }
  }

  reset(): void {
    for (const map of this.#maps()) {
      map.clear();
    }
    this.failNextOperationLock = false;
    this.failNextLeaseLookup = false;
    this.failFinalizationBeforeCommit = false;
    this.transactionOptions.length = 0;
    this.failNextTransaction = null;
    this.nextCommitResponseLoss = null;
    this.#sequence = 0;
    this.#transactionTail = Promise.resolve();
  }

  seedProject(id: string, customerId: string): void {
    this.projects.set(id, {
      id,
      customerId,
      dataClassification: "DEMO_MOCK",
    });
  }

  seedPendingIntent(input: {
    id: string;
    projectId: string;
    uploadedById: string;
    existingFileId?: string | null;
    expectedCurrentFileVersionId?: string | null;
    expiresAt?: Date;
    requestKey?: string;
  }): void {
    const now = new Date();
    const size = BigInt(PDF_SIZE_BYTES);
    this.intents.set(input.id, {
      id: input.id,
      requestKey: input.requestKey ?? `request-${input.id}`,
      requestFingerprint: "a".repeat(64),
      uploadedById: input.uploadedById,
      projectId: input.projectId,
      buildingId: null,
      installationUnitId: null,
      existingFileId: input.existingFileId ?? null,
      expectedCurrentFileVersionId:
        input.expectedCurrentFileVersionId ?? null,
      displayName: "demo.pdf",
      originalFilename: "demo.pdf",
      sanitizedFilename: "demo.pdf",
      declaredMimeType: "application/pdf",
      declaredSizeBytes: size,
      stagingKey: `staging/${input.id}.part`,
      objectStorageKey: null,
      status: "PENDING",
      currentAttemptId: null,
      expiresAt:
        input.expiresAt ?? new Date(now.getTime() + 600_000),
      claimedAt: null,
      completedAt: null,
      failureCode: null,
      completedFileVersionId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  seedFile(input: {
    id: string;
    projectId: string;
    customerId: string;
    currentVersionId: string | null;
  }): void {
    this.files.set(input.id, {
      ...input,
      displayName: "demo.pdf",
      dataClassification: "DEMO_MOCK",
    });
  }

  expireStagingLease(intentId: string): void {
    const intent = this.intents.get(intentId);
    const attempt = intent
      ? this.attempts.get(String(intent.currentAttemptId))
      : undefined;
    if (!attempt) {
      throw new Error("ATTEMPT_NOT_FOUND");
    }
    const staging = [...this.lifecycles.values()].find(
      (row) =>
        row.objectKind === "STAGING" &&
        row.reservedAttemptId === attempt.id,
    );
    if (!staging) {
      throw new Error("STAGING_LIFECYCLE_NOT_FOUND");
    }
    staging.leaseExpiresAt = new Date(Date.now() - 1_000);
  }

  expireCurrentLease(intentId: string): void {
    const intent = this.intents.get(intentId);
    const operation = [...this.operations.values()].find(
      (row) => row.sourceAttemptId === intent?.currentAttemptId,
    );
    if (!operation) {
      throw new Error("OPERATION_NOT_FOUND");
    }
    operation.leaseExpiresAt = new Date(Date.now() - 1_000);
    for (const lifecycle of this.lifecycles.values()) {
      if (
        lifecycle.id === operation.objectLifecycleId ||
        lifecycle.reservedAttemptId === operation.sourceAttemptId
      ) {
        lifecycle.leaseExpiresAt = operation.leaseExpiresAt;
      }
    }
  }

  currentState(): {
    intent: Row | null;
    attempt: Row | null;
    operation: Row | null;
    binding: Row | null;
    fileVersions: Row[];
  } {
    const intent = [...this.intents.values()][0] ?? null;
    const attempt = intent
      ? this.attempts.get(String(intent.currentAttemptId)) ??
        [...this.attempts.values()][0] ??
        null
      : null;
    const operation = attempt
      ? [...this.operations.values()].find(
          (row) => row.sourceAttemptId === attempt.id,
        ) ?? null
      : null;
    const binding = operation
      ? [...this.bindings.values()].find(
          (row) => row.operationId === operation.id,
        ) ?? null
      : null;
    return {
      intent: intent ? { ...intent } : null,
      attempt: attempt ? { ...attempt } : null,
      operation: operation ? { ...operation } : null,
      binding: binding ? { ...binding } : null,
      fileVersions: [...this.fileVersions.values()].map((row) => ({
        ...row,
      })),
    };
  }

  #maps(): Array<Map<string, Row>> {
    return [
      this.projects,
      this.intents,
      this.attempts,
      this.lifecycles,
      this.operations,
      this.bindings,
      this.files,
      this.fileVersions,
      this.extractions,
    ];
  }

  #snapshotMaps(): Record<string, Map<string, Row>> {
    return cloneMaps({
      projects: this.projects,
      intents: this.intents,
      attempts: this.attempts,
      lifecycles: this.lifecycles,
      operations: this.operations,
      bindings: this.bindings,
      files: this.files,
      fileVersions: this.fileVersions,
      extractions: this.extractions,
    });
  }

  #restoreMaps(snapshot: Record<string, Map<string, Row>>): void {
    const targets = {
      projects: this.projects,
      intents: this.intents,
      attempts: this.attempts,
      lifecycles: this.lifecycles,
      operations: this.operations,
      bindings: this.bindings,
      files: this.files,
      fileVersions: this.fileVersions,
      extractions: this.extractions,
    };
    for (const [key, target] of Object.entries(targets)) {
      target.clear();
      for (const [id, row] of snapshot[key] ?? []) {
        target.set(id, row);
      }
    }
  }
}

const PDF_SIZE_BYTES = Buffer.byteLength(
  "%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
);

export const sharedObjectUploadPrismaHarness =
  new ObjectUploadPrismaHarness();
