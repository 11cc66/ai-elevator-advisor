import { randomUUID } from "node:crypto";

import {
  Prisma,
  PrismaClient,
  type ExtractionFieldStatus,
} from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";

import type { Actor } from "../../src/modules/access/actor";
import { loadActor } from "../../src/modules/access/actor";
import { submitCustomerFieldReview } from "../../src/modules/files/field-review-service";
import { TEST_FIXTURE_IDS } from "../../scripts/test-db/seed";

const prisma = new PrismaClient();
let adminUserId = "";
let customerUserId = "";
let customerActor: Actor;
let adminActor: Actor;
let sequence = 0;

beforeAll(async () => {
  const adminUsername =
    process.env.TEST_ADMIN_USERNAME?.toLowerCase();
  const customerUsername =
    process.env.TEST_CUSTOMER_USERNAME?.toLowerCase();
  const [admin, customer] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { username: adminUsername },
      select: { id: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { username: customerUsername },
      select: { id: true },
    }),
  ]);

  adminUserId = admin.id;
  customerUserId = customer.id;
  adminActor = await loadActor(admin.id);
  customerActor = await loadActor(customer.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createFixture() {
  sequence += 1;
  const file = await prisma.file.create({
    data: {
      customerId: TEST_FIXTURE_IDS.customer,
      projectId: TEST_FIXTURE_IDS.project,
      buildingId: TEST_FIXTURE_IDS.building,
      installationUnitId: TEST_FIXTURE_IDS.installationUnit,
      displayName: `DEMO_MOCK P1-1 文件 ${sequence}`,
      dataClassification: "DEMO_MOCK",
      createdById: adminUserId,
    },
  });
  const version = await prisma.fileVersion.create({
    data: {
      fileId: file.id,
      versionNumber: 1,
      originalFilename: `p11-${sequence}.pdf`,
      sanitizedFilename: `p11-${sequence}.pdf`,
      declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      sizeBytes: 100n,
      checksumSha256: String(sequence % 10).repeat(64),
      storageKey: `test/p11/${sequence}-${randomUUID()}`,
      uploadStatus: "UPLOADED",
      validationStatus: "PASSED",
      malwareScanStatus: "SCAN_UNAVAILABLE",
      integrityStatus: "VERIFIED",
      recognitionStatus: "COMPLETED",
      uploadedById: adminUserId,
      finalizedAt: new Date(),
    },
  });
  const extraction = await prisma.fileExtraction.create({
    data: {
      fileVersionId: version.id,
      extractionVersion: 1,
      provider: "DEMO_MOCK",
      providerVersion: "p1.1-test",
      parserVersion: "p1.1-test",
      dataClassification: "DEMO_MOCK",
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  return { file, version, extraction };
}

async function createField(
  extractionId: string,
  input: {
    classification: "ORDINARY" | "PROFESSIONAL";
    fieldKey?: string;
    value?: string | number;
    initialStatus?: ExtractionFieldStatus;
    customerConfirmable?: boolean;
    requiresProfessionalReview?: boolean;
  },
) {
  return prisma.extractionField.create({
    data: {
      extractionId,
      fieldKey: input.fieldKey ?? `field_${randomUUID()}`,
      fieldLabel: "DEMO_MOCK P1-1 字段",
      valueType:
        input.classification === "ORDINARY" ? "TEXT" : "NUMBER",
      originalRawValue: input.value ?? "DEMO_MOCK 原始值",
      originalNormalizedValue: input.value ?? "DEMO_MOCK 原始值",
      pageNumber: 1,
      sourceText: "DEMO_MOCK source",
      sourceRefs: [{ page: 1 }],
      confidence: 0.8,
      fieldClassification: input.classification,
      initialStatus:
        input.initialStatus ??
        (input.classification === "PROFESSIONAL"
          ? "PENDING_VERIFICATION"
          : "EXTRACTED"),
      customerConfirmable:
        input.customerConfirmable ??
        (input.classification === "ORDINARY"),
      requiresProfessionalReview:
        input.requiresProfessionalReview ??
        (input.classification === "PROFESSIONAL"),
    },
  });
}

function reviewInput(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  fieldId: string,
  action: "CONFIRM" | "CORRECT" | "REJECT",
  expectedReviewSequence: number,
  correctedRawValue?: string | number,
) {
  return {
    actor: customerActor,
    projectId: TEST_FIXTURE_IDS.project,
    fileId: fixture.file.id,
    versionId: fixture.version.id,
    extractionId: fixture.extraction.id,
    fieldId,
    requestId: randomUUID(),
    review: {
      action,
      expectedReviewSequence,
      ...(correctedRawValue === undefined
        ? {}
        : { correctedRawValue }),
    },
  };
}

function reviewSnapshot(
  projectId: string = TEST_FIXTURE_IDS.project,
) {
  return {
    roleCodes: ["CUSTOMER"],
    scope: "PROJECT",
    projectId,
  };
}

it("enforces the final field configuration matrix", async () => {
  const fixture = await createFixture();
  await expect(
    createField(fixture.extraction.id, {
      classification: "ORDINARY",
      customerConfirmable: false,
      requiresProfessionalReview: false,
    }),
  ).resolves.toBeDefined();
  await expect(
    createField(fixture.extraction.id, {
      classification: "ORDINARY",
      customerConfirmable: false,
      requiresProfessionalReview: true,
    }),
  ).resolves.toBeDefined();
  await expect(
    createField(fixture.extraction.id, {
      classification: "ORDINARY",
      customerConfirmable: true,
      requiresProfessionalReview: false,
    }),
  ).resolves.toBeDefined();
  await expect(
    createField(fixture.extraction.id, {
      classification: "ORDINARY",
      customerConfirmable: true,
      requiresProfessionalReview: true,
    }),
  ).rejects.toBeDefined();
  await expect(
    createField(fixture.extraction.id, {
      classification: "PROFESSIONAL",
      customerConfirmable: false,
      requiresProfessionalReview: true,
    }),
  ).resolves.toBeDefined();

  for (const [customerConfirmable, requiresProfessionalReview] of [
    [true, true],
    [true, false],
    [false, false],
  ] as const) {
    await expect(
      createField(fixture.extraction.id, {
        classification: "PROFESSIONAL",
        customerConfirmable,
        requiresProfessionalReview,
      }),
    ).rejects.toBeDefined();
  }
});

it("keeps non-customer-confirmable ordinary fields inert", async () => {
  const fixture = await createFixture();

  for (const requiresProfessionalReview of [false, true]) {
    const field = await createField(fixture.extraction.id, {
      classification: "ORDINARY",
      customerConfirmable: false,
      requiresProfessionalReview,
    });

    for (const action of [
      "CONFIRM",
      "CORRECT",
      "REJECT",
    ] as const) {
      await expect(
        submitCustomerFieldReview(
          reviewInput(
            fixture,
            field.id,
            action,
            0,
            action === "CORRECT" ? "DEMO_MOCK 禁止" : undefined,
          ),
        ),
      ).rejects.toMatchObject({
        code: "FIELD_NOT_CUSTOMER_CONFIRMABLE",
        status: 403,
      });
    }
  }
});

it("uses the latest ordinary review state for every transition", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });

  await submitCustomerFieldReview(
    reviewInput(fixture, field.id, "CONFIRM", 0),
  );
  await expect(
    submitCustomerFieldReview(
      reviewInput(fixture, field.id, "CONFIRM", 1),
    ),
  ).rejects.toMatchObject({
    code: "FIELD_REVIEW_NO_STATE_CHANGE",
    status: 403,
  });
  await submitCustomerFieldReview(
    reviewInput(fixture, field.id, "CORRECT", 1, "DEMO_MOCK 更正一"),
  );
  await submitCustomerFieldReview(
    reviewInput(fixture, field.id, "REJECT", 2),
  );
  await expect(
    submitCustomerFieldReview(
      reviewInput(fixture, field.id, "REJECT", 3),
    ),
  ).rejects.toMatchObject({
    code: "FIELD_REVIEW_NO_STATE_CHANGE",
    status: 403,
  });
  await submitCustomerFieldReview(
    reviewInput(fixture, field.id, "CONFIRM", 3),
  );
  await submitCustomerFieldReview(
    reviewInput(fixture, field.id, "CORRECT", 4, "DEMO_MOCK 更正二"),
  );

  const reviews = await prisma.extractionFieldReview.findMany({
    where: { extractionFieldId: field.id },
    orderBy: { reviewSequence: "asc" },
  });
  expect(reviews.map((review) => review.reviewSequence)).toEqual([
    1, 2, 3, 4, 5,
  ]);
  expect(reviews.map((review) => review.statusAfterReview)).toEqual([
    "CUSTOMER_CONFIRMED",
    "CUSTOMER_CONFIRMED",
    "CUSTOMER_REJECTED",
    "CUSTOMER_CONFIRMED",
    "CUSTOMER_CONFIRMED",
  ]);
});

it("keeps professional corrections pending and rejects completion", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "PROFESSIONAL",
    value: 2200,
  });

  await submitCustomerFieldReview(
    reviewInput(fixture, field.id, "CORRECT", 0, 2250),
  );
  await submitCustomerFieldReview(
    reviewInput(fixture, field.id, "CORRECT", 1, 2260),
  );
  await expect(
    submitCustomerFieldReview(
      reviewInput(fixture, field.id, "CONFIRM", 2),
    ),
  ).rejects.toMatchObject({
    code: "PROFESSIONAL_FIELD_CONFIRM_FORBIDDEN",
    status: 403,
  });
  await expect(
    submitCustomerFieldReview(
      reviewInput(fixture, field.id, "REJECT", 2),
    ),
  ).rejects.toMatchObject({
    code: "PROFESSIONAL_FIELD_REJECT_FORBIDDEN",
    status: 403,
  });

  const reviews = await prisma.extractionFieldReview.findMany({
    where: { extractionFieldId: field.id },
  });
  expect(reviews).toHaveLength(2);
  expect(
    reviews.every(
      (review) =>
        review.action === "CORRECT" &&
        review.statusAfterReview === "PENDING_VERIFICATION",
    ),
  ).toBe(true);
});

it("rejects invalidated fields for every action", async () => {
  const fixture = await createFixture();
  const ordinary = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    initialStatus: "INVALIDATED",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  const professional = await createField(fixture.extraction.id, {
    classification: "PROFESSIONAL",
    initialStatus: "INVALIDATED",
    value: 2200,
  });

  for (const field of [ordinary, professional]) {
    for (const action of [
      "CONFIRM",
      "CORRECT",
      "REJECT",
    ] as const) {
      await expect(
        submitCustomerFieldReview(
          reviewInput(
            fixture,
            field.id,
            action,
            0,
            action === "CORRECT" ? 2250 : undefined,
          ),
        ),
      ).rejects.toMatchObject({
        code: "FIELD_CURRENT_STATUS_INVALID",
        status: 403,
      });
    }
  }
});

it("strictly validates actor snapshots and rejects invalid payloads", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  const base = {
    extractionFieldId: field.id,
    reviewSequence: 1,
    action: "CONFIRM" as const,
    originalValueSnapshot: "DEMO_MOCK 原始值",
    statusAfterReview: "CUSTOMER_CONFIRMED" as const,
  };
  const invalidSnapshots: Array<
    Prisma.InputJsonValue | typeof Prisma.JsonNull
  > = [
    Prisma.JsonNull,
    {},
    {
      ...reviewSnapshot(),
      extra: true,
    },
    {
      ...reviewSnapshot(),
      roleCodes: ["CUSTOMER", "SYSTEM_ADMIN"],
    },
    reviewSnapshot(TEST_FIXTURE_IDS.project2),
    {
      ...reviewSnapshot(),
      projectId: "",
    },
    {
      ...reviewSnapshot(),
      scope: 123,
    },
  ];

  for (const actorRoleSnapshot of invalidSnapshots) {
    await expect(
      prisma.extractionFieldReview.create({
        data: {
          ...base,
          actorUserId: customerUserId,
          actorRoleSnapshot,
        },
      }),
    ).rejects.toBeDefined();
  }

  await expect(
    prisma.extractionFieldReview.create({
      data: {
        ...base,
        actorUserId: adminUserId,
        actorRoleSnapshot: reviewSnapshot(),
      },
    }),
  ).rejects.toBeDefined();
  await expect(
    prisma.extractionFieldReview.create({
      data: {
        ...base,
        originalValueSnapshot: "DEMO_MOCK 伪造值",
        actorUserId: customerUserId,
        actorRoleSnapshot: reviewSnapshot(),
      },
    }),
  ).rejects.toBeDefined();
  await expect(
    prisma.extractionFieldReview.create({
      data: {
        ...base,
        reviewSequence: 2,
        actorUserId: customerUserId,
        actorRoleSnapshot: reviewSnapshot(),
      },
    }),
  ).rejects.toBeDefined();
  await expect(
    prisma.extractionFieldReview.create({
      data: {
        ...base,
        correctedRawValue: "DEMO_MOCK 非法修正值",
        actorUserId: customerUserId,
        actorRoleSnapshot: reviewSnapshot(),
      },
    }),
  ).rejects.toBeDefined();

  const valid = await prisma.extractionFieldReview.create({
    data: {
      ...base,
      actorUserId: customerUserId,
      actorRoleSnapshot: reviewSnapshot(),
    },
  });
  expect(valid.reviewSequence).toBe(1);
});

it("serializes concurrent submissions at supported isolation levels", async () => {
  for (const isolationLevel of [
    Prisma.TransactionIsolationLevel.ReadCommitted,
    Prisma.TransactionIsolationLevel.RepeatableRead,
    Prisma.TransactionIsolationLevel.Serializable,
  ]) {
    const fixture = await createFixture();
    const field = await createField(fixture.extraction.id, {
      classification: "ORDINARY",
      customerConfirmable: true,
      requiresProfessionalReview: false,
    });
    const results = await Promise.allSettled([
      submitCustomerFieldReview({
        ...reviewInput(fixture, field.id, "CONFIRM", 0),
        transactionIsolationLevel: isolationLevel,
      }),
      submitCustomerFieldReview({
        ...reviewInput(fixture, field.id, "CORRECT", 0, "DEMO_MOCK 并发"),
        transactionIsolationLevel: isolationLevel,
      }),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({
      status: "rejected",
      reason: {
        status: 409,
      },
    });
    expect(
      await prisma.extractionFieldReview.findMany({
        where: { extractionFieldId: field.id },
        orderBy: { reviewSequence: "asc" },
        select: { reviewSequence: true },
      }),
    ).toEqual([{ reviewSequence: 1 }]);
  }
});

it("allows different fields to proceed in parallel", async () => {
  const firstFixture = await createFixture();
  const secondFixture = await createFixture();
  const firstField = await createField(firstFixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  const secondField = await createField(secondFixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });

  await Promise.all([
    submitCustomerFieldReview(
      reviewInput(firstFixture, firstField.id, "CONFIRM", 0),
    ),
    submitCustomerFieldReview(
      reviewInput(secondFixture, secondField.id, "CONFIRM", 0),
    ),
  ]);

  expect(
    await prisma.extractionFieldReview.count({
      where: {
        extractionFieldId: {
          in: [firstField.id, secondField.id],
        },
      },
    }),
  ).toBe(2);
});

it("limits administrator reviews to the project CUSTOMER", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });

  await expect(
    submitCustomerFieldReview({
      ...reviewInput(fixture, field.id, "CONFIRM", 0),
      actor: adminActor,
    }),
  ).rejects.toMatchObject({
    code: "CUSTOMER_ROLE_REQUIRED",
    status: 403,
  });
  expect(
    await prisma.extractionFieldReview.count({
      where: { extractionFieldId: field.id },
    }),
  ).toBe(0);
});

function transactionConflictError() {
  return new Prisma.PrismaClientKnownRequestError(
    "Transaction failed due to a write conflict or a deadlock.",
    {
      code: "P2034",
      clientVersion: "6.19.0",
    },
  );
}

function databaseWithTransactionFailures(
  failures: number,
  errorFactory: () => Error = transactionConflictError,
): PrismaClient {
  let attempts = 0;

  return {
    $transaction: async (
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
      options?: {
        isolationLevel?: Prisma.TransactionIsolationLevel;
      },
    ) => {
      attempts += 1;
      if (attempts <= failures) {
        throw errorFactory();
      }
      return prisma.$transaction(callback, options);
    },
  } as unknown as PrismaClient;
}

it("retries the whole transaction and rereads the latest sequence", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });

  const result = await submitCustomerFieldReview({
    ...reviewInput(fixture, field.id, "CONFIRM", 0),
    database: databaseWithTransactionFailures(1),
  });
  expect(result.latestReviewSequence).toBe(1);
  expect(
    await prisma.extractionFieldReview.count({
      where: { extractionFieldId: field.id },
    }),
  ).toBe(1);
});

it("does not silently accept a stale request after a retry", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  await prisma.extractionFieldReview.create({
    data: {
      extractionFieldId: field.id,
      reviewSequence: 1,
      action: "CONFIRM",
      originalValueSnapshot: "DEMO_MOCK 原始值",
      statusAfterReview: "CUSTOMER_CONFIRMED",
      actorUserId: customerUserId,
      actorRoleSnapshot: reviewSnapshot(),
    },
  });

  await expect(
    submitCustomerFieldReview({
      ...reviewInput(fixture, field.id, "REJECT", 0),
      database: databaseWithTransactionFailures(1),
    }),
  ).rejects.toMatchObject({
    code: "FIELD_REVIEW_STALE",
    status: 409,
  });
  expect(
    await prisma.extractionFieldReview.count({
      where: { extractionFieldId: field.id },
    }),
  ).toBe(1);
});

it("returns a conflict after bounded P2034 retries without partial writes", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  const auditBefore = await prisma.auditLog.count({
    where: {
      objectType: "ExtractionField",
      objectId: field.id,
    },
  });

  await expect(
    submitCustomerFieldReview({
      ...reviewInput(fixture, field.id, "CONFIRM", 0),
      database: databaseWithTransactionFailures(3),
    }),
  ).rejects.toMatchObject({
    code: "FIELD_REVIEW_CONFLICT",
    status: 409,
  });
  expect(
    await prisma.extractionFieldReview.count({
      where: { extractionFieldId: field.id },
    }),
  ).toBe(0);
  expect(
    await prisma.auditLog.count({
      where: {
        objectType: "ExtractionField",
        objectId: field.id,
      },
    }),
  ).toBe(auditBefore);
});

it("rolls back the Review when AuditLog creation fails", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });

  await expect(
    submitCustomerFieldReview({
      ...reviewInput(fixture, field.id, "CONFIRM", 0),
      requestId: "x".repeat(101),
    }),
  ).rejects.toBeDefined();
  expect(
    await prisma.extractionFieldReview.count({
      where: { extractionFieldId: field.id },
    }),
  ).toBe(0);
  expect(
    await prisma.auditLog.count({
      where: {
        objectType: "ExtractionField",
        objectId: field.id,
      },
    }),
  ).toBe(0);
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("reports raw PostgreSQL 40001 and 40P01 queries as P2010", async () => {
  const serializationKey = `DEMO_MOCK_P11_40001_${randomUUID()}`;
  const deadlockKeyA = `DEMO_MOCK_P11_40P01_A_${randomUUID()}`;
  const deadlockKeyB = `DEMO_MOCK_P11_40P01_B_${randomUUID()}`;
  await prisma.systemMetadata.createMany({
    data: [
      { key: serializationKey, value: "0" },
      { key: deadlockKeyA, value: "A" },
      { key: deadlockKeyB, value: "B" },
    ],
  });
  const clientA = new PrismaClient();
  const clientB = new PrismaClient();

  try {
    const serializationReadA = deferred();
    const serializationReadB = deferred();
    const serializationA = clientA.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "value"
          FROM "system_metadata"
          WHERE "key" = ${serializationKey}
        `;
        serializationReadA.resolve();
        await serializationReadB.promise;
        await tx.$executeRaw`
          UPDATE "system_metadata"
          SET "value" = ${"A"}
          WHERE "key" = ${serializationKey}
        `;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
    const serializationB = clientB.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "value"
          FROM "system_metadata"
          WHERE "key" = ${serializationKey}
        `;
        serializationReadB.resolve();
        await serializationReadA.promise;
        await tx.$executeRaw`
          UPDATE "system_metadata"
          SET "value" = ${"B"}
          WHERE "key" = ${serializationKey}
        `;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
    const serializationResults = await Promise.allSettled([
      serializationA,
      serializationB,
    ]);
    const serializationFailure = serializationResults.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    expect(serializationFailure?.reason).toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(
      (serializationFailure?.reason as Prisma.PrismaClientKnownRequestError)
        .code,
    ).toBe("P2010");

    const deadlockUpdatedA = deferred();
    const deadlockUpdatedB = deferred();
    const deadlockA = clientA.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "system_metadata"
        SET "value" = ${"A1"}
        WHERE "key" = ${deadlockKeyA}
      `;
      deadlockUpdatedA.resolve();
      await deadlockUpdatedB.promise;
      await tx.$executeRaw`
        UPDATE "system_metadata"
        SET "value" = ${"A2"}
        WHERE "key" = ${deadlockKeyB}
      `;
    });
    const deadlockB = clientB.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "system_metadata"
        SET "value" = ${"B1"}
        WHERE "key" = ${deadlockKeyB}
      `;
      deadlockUpdatedB.resolve();
      await deadlockUpdatedA.promise;
      await tx.$executeRaw`
        UPDATE "system_metadata"
        SET "value" = ${"B2"}
        WHERE "key" = ${deadlockKeyA}
      `;
    });
    const deadlockResults = await Promise.allSettled([
      deadlockA,
      deadlockB,
    ]);
    const deadlockFailure = deadlockResults.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    expect(deadlockFailure?.reason).toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    expect(
      (deadlockFailure?.reason as Prisma.PrismaClientKnownRequestError)
        .code,
    ).toBe("P2010");
  } finally {
    await Promise.allSettled([
      clientA.$disconnect(),
      clientB.$disconnect(),
      prisma.systemMetadata.deleteMany({
        where: {
          key: {
            in: [
              serializationKey,
              deadlockKeyA,
              deadlockKeyB,
            ],
          },
        },
      }),
    ]);
  }
}, 30_000);

it("reports ORM row-lock deadlocks as a Prisma unknown 40P01 error", async () => {
  const firstFixture = await createFixture();
  const secondFixture = await createFixture();
  const firstField = await createField(firstFixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  const secondField = await createField(secondFixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  const clientA = new PrismaClient();
  const clientB = new PrismaClient();
  const firstCreated = deferred();
  const secondCreated = deferred();

  const createReview = (
    tx: Prisma.TransactionClient,
    fieldId: string,
  ) =>
    tx.extractionFieldReview.create({
      data: {
        extractionFieldId: fieldId,
        reviewSequence: 1,
        action: "CONFIRM",
        originalValueSnapshot: "DEMO_MOCK 原始值",
        statusAfterReview: "CUSTOMER_CONFIRMED",
        actorUserId: customerUserId,
        actorRoleSnapshot: reviewSnapshot(),
      },
    });

  try {
    const transactionA = clientA.$transaction(async (tx) => {
      await createReview(tx, firstField.id);
      firstCreated.resolve();
      await secondCreated.promise;
      await createReview(tx, secondField.id);
    });
    const transactionB = clientB.$transaction(async (tx) => {
      await createReview(tx, secondField.id);
      secondCreated.resolve();
      await firstCreated.promise;
      await createReview(tx, firstField.id);
    });
    const results = await Promise.allSettled([
      transactionA,
      transactionB,
    ]);
    const failure = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );
    expect(failure?.reason).toBeInstanceOf(
      Prisma.PrismaClientUnknownRequestError,
    );
    expect(
      (failure?.reason as Error).message,
    ).toContain('code: "40P01"');
  } finally {
    await Promise.allSettled([
      clientA.$disconnect(),
      clientB.$disconnect(),
    ]);
  }
}, 30_000);

it("retries a Prisma unknown error that contains PostgreSQL 40P01", async () => {
  const fixture = await createFixture();
  const field = await createField(fixture.extraction.id, {
    classification: "ORDINARY",
    customerConfirmable: true,
    requiresProfessionalReview: false,
  });
  const deadlockError = () =>
    new Prisma.PrismaClientUnknownRequestError(
      'PostgresError { code: "40P01", message: "deadlock detected" }',
      { clientVersion: "6.19.0" },
    );

  const result = await submitCustomerFieldReview({
    ...reviewInput(fixture, field.id, "CONFIRM", 0),
    database: databaseWithTransactionFailures(1, deadlockError),
  });
  expect(result.latestReviewSequence).toBe(1);
});

it("keeps all P1-1 CHECK constraints validated", async () => {
  const constraints = await prisma.$queryRaw<
    Array<{ constraintName: string; validated: boolean }>
  >`
    SELECT
      "conname" AS "constraintName",
      "convalidated" AS "validated"
    FROM "pg_constraint"
    WHERE "conname" IN (
      'extraction_field_review_configuration_check',
      'extraction_field_review_payload_check',
      'extraction_field_review_actor_snapshot_check'
    )
    ORDER BY "conname"
  `;

  expect(constraints).toHaveLength(3);
  expect(constraints.every((constraint) => constraint.validated)).toBe(
    true,
  );
});
