import { randomUUID } from "node:crypto";

import type {
  InstallationScenario,
  MvpProjectCreateInput,
  ProductCreateInput,
  ProductUpdateInput,
  RequirementDraft,
  SalesFollowUpInput,
} from "@elevator/contracts";
import type { SelectionResult } from "../../../../../packages/selection-engine/src/index";

import { appendAuditLog } from "@/modules/audit/log";
import { resolveCurrentSelectionRun } from "@/modules/workbench/selection-consistency";
import { AppError } from "@/server/http/errors";
import { prisma } from "@/server/prisma";

import type {
  AdvisorMessageRecord,
  CatalogProductRecord,
  ConversationSummary,
  RequirementRecord,
  SalesHandoffRecord,
  SelectionRunRecord,
} from "./types";

interface ConversationRow {
  id: string;
  projectId: string;
  provider: "MOCK" | "REAL_PROVIDER";
  status: "ACTIVE" | "CLOSED";
  createdAt: Date;
  messageCount: bigint | number;
  latestMessage: string | null;
}

interface MessageRow {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  provider: "MOCK" | "REAL_PROVIDER";
  structuredPayload: unknown;
  createdAt: Date;
}

interface RequirementRow {
  id: string;
  projectId: string;
  conversationId: string | null;
  installationScenario: InstallationScenario;
  status: "DRAFT" | "CUSTOMER_CONFIRMED";
  version: number;
  fields: RequirementDraft;
  missingFields: string[];
  professionalReviewRequired: boolean;
  updatedAt: Date;
}

interface ProductRow {
  productId: string;
  manufacturer: string;
  brand: string;
  modelCode: string;
  name: string;
  applicableScenarios: InstallationScenario[];
  verificationStatus: "DEMO_MOCK" | "UNVERIFIED" | "VERIFIED" | "EXPIRED";
  sourceReference: string | null;
  specificationSourceReference: string | null;
  priceSourceReference: string | null;
  specificationId: string;
  specificationVersion: number;
  capacityKg: number | null;
  speedMps: string | number | null;
  maxFloors: number | null;
  maxTravelM: string | number | null;
  shaftWidthMm: number | null;
  shaftDepthMm: number | null;
  pitDepthMm: number | null;
  overheadMm: number | null;
  machineRoomType: "MRL" | "MR" | "UNKNOWN" | null;
  priceVersion: number | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
  currency: string | null;
  priceValidityStatus: "DEMO_MOCK" | "VALID" | "EXPIRED" | null;
  updatedAt: Date;
}

interface ProductAuditContext {
  actorUserId: string;
  requestId: string;
}

function asJson(value: unknown): string {
  return JSON.stringify(value);
}

export async function listConversations(
  projectId: string,
): Promise<ConversationSummary[]> {
  const rows = await prisma.$queryRaw<ConversationRow[]>`
    SELECT
      c."id",
      c."projectId",
      c."provider",
      c."status",
      c."createdAt",
      COUNT(m."id") AS "messageCount",
      (
        SELECT latest."content"
        FROM "advisor_message" latest
        WHERE latest."conversationId" = c."id"
        ORDER BY latest."sequence" DESC
        LIMIT 1
      ) AS "latestMessage"
    FROM "advisor_conversation" c
    LEFT JOIN "advisor_message" m ON m."conversationId" = c."id"
    WHERE c."projectId" = ${projectId}
    GROUP BY c."id"
    ORDER BY c."createdAt" DESC
  `;
  return rows.map((row) => ({
    ...row,
    messageCount: Number(row.messageCount),
  }));
}

export async function createConversation(input: {
  projectId: string;
  userId: string;
}): Promise<{ id: string }> {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "advisor_conversation"
      ("id", "projectId", "createdById", "provider", "status", "createdAt", "updatedAt")
    VALUES
      (${id}, ${input.projectId}, ${input.userId}, 'MOCK', 'ACTIVE', NOW(), NOW())
  `;
  return { id };
}

export async function conversationBelongsToProject(
  conversationId: string,
  projectId: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "advisor_conversation"
    WHERE "id" = ${conversationId} AND "projectId" = ${projectId}
    LIMIT 1
  `;
  return rows.length === 1;
}

export async function listMessages(
  conversationId: string,
): Promise<AdvisorMessageRecord[]> {
  return prisma.$queryRaw<MessageRow[]>`
    SELECT
      "id", "role", "content", "provider", "structuredPayload", "createdAt"
    FROM "advisor_message"
    WHERE "conversationId" = ${conversationId}
    ORDER BY "sequence" ASC
  `;
}

export async function appendMessage(input: {
  conversationId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  provider: "MOCK" | "REAL_PROVIDER";
  structuredPayload?: unknown;
}): Promise<AdvisorMessageRecord> {
  const id = randomUUID();
  return prisma.$transaction(async (tx) => {
    const conversations = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "advisor_conversation"
      WHERE "id" = ${input.conversationId}
      FOR UPDATE
    `;
    if (!conversations[0]) {
      throw new AppError(
        "CONVERSATION_NOT_FOUND",
        "顾问会话不存在。",
        404,
      );
    }
    const sequences = await tx.$queryRaw<Array<{ value: number }>>`
      SELECT COALESCE(MAX("sequence"), 0) + 1 AS value
      FROM "advisor_message"
      WHERE "conversationId" = ${input.conversationId}
    `;
    const sequence = sequences[0]?.value ?? 1;
    await tx.$executeRaw`
      INSERT INTO "advisor_message"
        ("id", "conversationId", "sequence", "role", "content", "provider", "structuredPayload", "createdAt")
      VALUES
        (${id}, ${input.conversationId}, ${sequence},
         ${input.role}::"AdvisorMessageRole", ${input.content},
         ${input.provider}::"AdvisorProviderKind",
         ${input.structuredPayload === undefined ? null : asJson(input.structuredPayload)}::jsonb,
         NOW())
    `;
    await tx.$executeRaw`
      UPDATE "advisor_conversation"
      SET "updatedAt" = NOW()
      WHERE "id" = ${input.conversationId}
    `;
    const rows = await tx.$queryRaw<MessageRow[]>`
      SELECT "id", "role", "content", "provider", "structuredPayload", "createdAt"
      FROM "advisor_message"
      WHERE "id" = ${id}
    `;
    if (!rows[0]) {
      throw new AppError("MESSAGE_CREATE_FAILED", "消息保存失败。", 500);
    }
    return rows[0];
  });
}

export async function getLatestRequirement(
  projectId: string,
): Promise<RequirementRecord | null> {
  const rows = await prisma.$queryRaw<RequirementRow[]>`
    SELECT
      "id", "projectId", "conversationId", "installationScenario",
      "status", "version", "fields", "missingFields",
      "professionalReviewRequired", "updatedAt"
    FROM "building_requirement"
    WHERE "projectId" = ${projectId}
    ORDER BY "version" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createRequirementVersion(input: {
  projectId: string;
  conversationId: string | null;
  installationScenario: InstallationScenario;
  fields: RequirementDraft;
  missingFields: string[];
  createdById: string;
  source: "CHAT_USER" | "MOCK_AI" | "USER_EDIT";
  status?: "DRAFT" | "CUSTOMER_CONFIRMED";
  expectedVersion?: number;
}): Promise<RequirementRecord> {
  const id = randomUUID();
  const revisionId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const projects = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "project"
      WHERE "id" = ${input.projectId}
      FOR UPDATE
    `;
    if (!projects[0]) {
      throw new AppError("PROJECT_NOT_FOUND", "项目不存在。", 404);
    }
    if (input.expectedVersion !== undefined) {
      const latest = await tx.$queryRaw<Array<{ version: number }>>`
        SELECT "version" FROM "building_requirement"
        WHERE "projectId" = ${input.projectId}
        ORDER BY "version" DESC
        LIMIT 1
      `;
      if (latest[0]?.version !== input.expectedVersion) {
        throw new AppError(
          "REQUIREMENT_VERSION_CONFLICT",
          "需求已被更新，请刷新后重新确认。",
          409,
        );
      }
    }
    const versions = await tx.$queryRaw<Array<{ value: number }>>`
      SELECT COALESCE(MAX("version"), 0) + 1 AS value
      FROM "building_requirement"
      WHERE "projectId" = ${input.projectId}
    `;
    const version = versions[0]?.value ?? 1;
    await tx.$executeRaw`
      INSERT INTO "building_requirement"
        ("id", "projectId", "conversationId", "installationScenario",
         "status", "version", "fields", "missingFields",
         "professionalReviewRequired", "createdById", "updatedById",
         "createdAt", "updatedAt")
      VALUES
        (${id}, ${input.projectId}, ${input.conversationId},
         ${input.installationScenario}::"InstallationScenario",
         ${input.status ?? "DRAFT"}::"RequirementStatus",
         ${version}, ${asJson(input.fields)}::jsonb,
         ${asJson(input.missingFields)}::jsonb,
         TRUE, ${input.createdById}, ${input.createdById}, NOW(), NOW())
    `;
    await tx.$executeRaw`
      INSERT INTO "requirement_revision"
        ("id", "requirementId", "version", "source", "snapshot",
         "missingFields", "status", "createdById", "createdAt")
      VALUES
        (${revisionId}, ${id}, ${version},
         ${input.source}::"RequirementRevisionSource",
         ${asJson(input.fields)}::jsonb,
         ${asJson(input.missingFields)}::jsonb,
         ${input.status ?? "DRAFT"}::"RequirementStatus",
         ${input.createdById}, NOW())
    `;
    const rows = await tx.$queryRaw<RequirementRow[]>`
      SELECT
        "id", "projectId", "conversationId", "installationScenario",
        "status", "version", "fields", "missingFields",
        "professionalReviewRequired", "updatedAt"
      FROM "building_requirement"
      WHERE "id" = ${id}
    `;
    if (!rows[0]) {
      throw new AppError("REQUIREMENT_CREATE_FAILED", "需求保存失败。", 500);
    }
    return rows[0];
  });
}

export async function confirmRequirement(input: {
  projectId: string;
  expectedVersion: number;
  actorUserId: string;
}): Promise<RequirementRecord> {
  const current = await getLatestRequirement(input.projectId);
  if (!current || current.version !== input.expectedVersion) {
    throw new AppError(
      "REQUIREMENT_VERSION_CONFLICT",
      "需求已被更新，请刷新后重新确认。",
      409,
    );
  }
  if (current.missingFields.length > 0) {
    throw new AppError(
      "REQUIREMENT_INCOMPLETE",
      "仍有必填需求未补充。",
      409,
    );
  }
  return createRequirementVersion({
    projectId: current.projectId,
    conversationId: current.conversationId,
    installationScenario: current.installationScenario,
    fields: current.fields,
    missingFields: [],
    createdById: input.actorUserId,
    source: "USER_EDIT",
    status: "CUSTOMER_CONFIRMED",
    expectedVersion: input.expectedVersion,
  });
}

function productFromRow(row: ProductRow): CatalogProductRecord {
  const speed =
    row.speedMps === null ? undefined : Number(row.speedMps);
  const maxTravel =
    row.maxTravelM === null ? undefined : Number(row.maxTravelM);
  return {
    productId: row.productId,
    manufacturer: row.manufacturer,
    brand: row.brand,
    modelCode: row.modelCode,
    name: row.name,
    applicableScenarios: row.applicableScenarios,
    verificationStatus: row.verificationStatus,
    specification: {
      capacityKg: row.capacityKg ?? undefined,
      speedMps: speed,
      maxFloors: row.maxFloors ?? undefined,
      maxTravelM: maxTravel,
      shaftWidthMm: row.shaftWidthMm ?? undefined,
      shaftDepthMm: row.shaftDepthMm ?? undefined,
      pitDepthMm: row.pitDepthMm ?? undefined,
      overheadMm: row.overheadMm ?? undefined,
      machineRoomType: row.machineRoomType ?? undefined,
    },
    price:
      row.priceVersion === null
        ? undefined
        : {
            minimumAmount: row.minimumAmount ?? undefined,
            maximumAmount: row.maximumAmount ?? undefined,
            currency: row.currency ?? "CNY",
            validityStatus: row.priceValidityStatus ?? "EXPIRED",
          },
    sourceReferences: [
      row.sourceReference,
      row.specificationSourceReference,
      row.priceSourceReference,
    ].filter((value): value is string => Boolean(value)),
    specificationId: row.specificationId,
    specificationVersion: row.specificationVersion,
    priceVersion: row.priceVersion,
    updatedAt: row.updatedAt,
  };
}

export async function listCatalogProducts(): Promise<CatalogProductRecord[]> {
  const rows = await prisma.$queryRaw<ProductRow[]>`
    SELECT
      p."id" AS "productId", m."name" AS "manufacturer", b."name" AS "brand",
      p."modelCode", p."name", p."applicableScenarios", p."verificationStatus",
      p."sourceReference",
      s."sourceReference" AS "specificationSourceReference",
      pr."sourceReference" AS "priceSourceReference",
      s."id" AS "specificationId",
      s."version" AS "specificationVersion", s."capacityKg", s."speedMps",
      s."maxFloors", s."maxTravelM", s."shaftWidthMm", s."shaftDepthMm",
      s."pitDepthMm", s."overheadMm", s."machineRoomType",
      pr."version" AS "priceVersion", pr."minimumAmount", pr."maximumAmount",
      pr."currency", pr."validityStatus" AS "priceValidityStatus",
      GREATEST(p."updatedAt", s."createdAt") AS "updatedAt"
    FROM "product_model" p
    JOIN "product_brand" b ON b."id" = p."brandId"
    JOIN "product_manufacturer" m ON m."id" = b."manufacturerId"
    JOIN LATERAL (
      SELECT * FROM "product_specification"
      WHERE "productId" = p."id"
      ORDER BY "version" DESC
      LIMIT 1
    ) s ON TRUE
    LEFT JOIN LATERAL (
      SELECT * FROM "product_price"
      WHERE "productId" = p."id"
      ORDER BY "version" DESC
      LIMIT 1
    ) pr ON TRUE
    WHERE p."active" = TRUE
    ORDER BY m."name", b."name", p."modelCode"
  `;
  return rows.map(productFromRow);
}

export async function getCatalogProduct(
  productId: string,
): Promise<CatalogProductRecord | null> {
  const rows = await prisma.$queryRaw<ProductRow[]>`
    SELECT
      p."id" AS "productId", m."name" AS "manufacturer", b."name" AS "brand",
      p."modelCode", p."name", p."applicableScenarios", p."verificationStatus",
      p."sourceReference",
      s."sourceReference" AS "specificationSourceReference",
      pr."sourceReference" AS "priceSourceReference",
      s."id" AS "specificationId",
      s."version" AS "specificationVersion", s."capacityKg", s."speedMps",
      s."maxFloors", s."maxTravelM", s."shaftWidthMm", s."shaftDepthMm",
      s."pitDepthMm", s."overheadMm", s."machineRoomType",
      pr."version" AS "priceVersion", pr."minimumAmount", pr."maximumAmount",
      pr."currency", pr."validityStatus" AS "priceValidityStatus",
      GREATEST(p."updatedAt", s."createdAt") AS "updatedAt"
    FROM "product_model" p
    JOIN "product_brand" b ON b."id" = p."brandId"
    JOIN "product_manufacturer" m ON m."id" = b."manufacturerId"
    JOIN LATERAL (
      SELECT * FROM "product_specification"
      WHERE "productId" = p."id"
      ORDER BY "version" DESC
      LIMIT 1
    ) s ON TRUE
    LEFT JOIN LATERAL (
      SELECT * FROM "product_price"
      WHERE "productId" = p."id"
      ORDER BY "version" DESC
      LIMIT 1
    ) pr ON TRUE
    WHERE p."id" = ${productId}
    LIMIT 1
  `;
  return rows[0] ? productFromRow(rows[0]) : null;
}

export async function createCatalogProduct(
  input: ProductCreateInput,
  audit: ProductAuditContext,
): Promise<string> {
  const manufacturerId = randomUUID();
  const brandId = randomUUID();
  const productId = randomUUID();
  const specificationId = randomUUID();
  const priceId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const manufacturers = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "product_manufacturer"
        ("id", "name", "supplier", "verificationStatus", "sourceReference", "createdAt", "updatedAt")
      VALUES
        (${manufacturerId}, ${input.manufacturerName}, ${input.manufacturerName},
         ${input.verificationStatus}::"CatalogVerificationStatus",
         ${input.sourceReference ?? null}, NOW(), NOW())
      ON CONFLICT ("name") DO UPDATE SET "updatedAt" = NOW()
      RETURNING "id"
    `;
    const resolvedManufacturerId = manufacturers[0]?.id;
    if (!resolvedManufacturerId) {
      throw new AppError("CATALOG_WRITE_FAILED", "厂商保存失败。", 500);
    }
    const brands = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "product_brand"
        ("id", "manufacturerId", "name", "verificationStatus", "createdAt", "updatedAt")
      VALUES
        (${brandId}, ${resolvedManufacturerId}, ${input.brandName},
         ${input.verificationStatus}::"CatalogVerificationStatus", NOW(), NOW())
      ON CONFLICT ("manufacturerId", "name") DO UPDATE SET "updatedAt" = NOW()
      RETURNING "id"
    `;
    const resolvedBrandId = brands[0]?.id;
    if (!resolvedBrandId) {
      throw new AppError("CATALOG_WRITE_FAILED", "品牌保存失败。", 500);
    }
    await tx.$executeRaw`
      INSERT INTO "product_model"
        ("id", "brandId", "modelCode", "name", "description",
         "applicableScenarios", "verificationStatus", "sourceReference",
         "active", "createdAt", "updatedAt")
      VALUES
        (${productId}, ${resolvedBrandId}, ${input.modelCode}, ${input.name},
         ${input.description ?? null}, ${asJson(input.applicableScenarios)}::jsonb,
         ${input.verificationStatus}::"CatalogVerificationStatus",
         ${input.sourceReference ?? null}, TRUE, NOW(), NOW())
    `;
    await tx.$executeRaw`
      INSERT INTO "product_specification"
        ("id", "productId", "version", "capacityKg", "speedMps", "maxFloors",
         "maxTravelM", "shaftWidthMm", "shaftDepthMm", "pitDepthMm",
         "overheadMm", "doorConfiguration", "machineRoomType",
         "sourceReference", "verificationStatus", "createdAt")
      VALUES
        (${specificationId}, ${productId}, 1,
         ${input.specification.capacityKg ?? null},
         ${input.specification.speedMps ?? null},
         ${input.specification.maxFloors ?? null},
         ${input.specification.maxTravelM ?? null},
         ${input.specification.shaftWidthMm ?? null},
         ${input.specification.shaftDepthMm ?? null},
         ${input.specification.pitDepthMm ?? null},
         ${input.specification.overheadMm ?? null},
         ${input.specification.doorConfiguration ?? null},
         ${input.specification.machineRoomType},
         ${input.sourceReference ?? null},
         ${input.verificationStatus}::"CatalogVerificationStatus", NOW())
    `;
    if (input.price) {
      await tx.$executeRaw`
        INSERT INTO "product_price"
          ("id", "productId", "version", "currency", "region",
           "minimumAmount", "maximumAmount", "sourceReference",
           "validityStatus", "createdAt")
        VALUES
          (${priceId}, ${productId}, 1, ${input.price.currency},
           ${input.price.region}, ${input.price.minimumAmount ?? null},
           ${input.price.maximumAmount ?? null},
           ${input.price.sourceReference ?? null},
           ${input.price.validityStatus}::"PriceValidityStatus", NOW())
      `;
    }
    await appendAuditLog(tx, {
      actorUserId: audit.actorUserId,
      action: "catalog.product.created",
      objectType: "ProductModel",
      objectId: productId,
      newValue: {
        manufacturerName: input.manufacturerName,
        brandName: input.brandName,
        modelCode: input.modelCode,
        name: input.name,
        applicableScenarios: input.applicableScenarios,
        verificationStatus: input.verificationStatus,
        sourceReference: input.sourceReference ?? null,
        specificationVersion: 1,
        priceVersion: input.price ? 1 : null,
      },
      requestId: audit.requestId,
    });
  });

  return productId;
}

export async function seedDemoCatalog(
  audit: ProductAuditContext,
): Promise<number> {
  const existing = await listCatalogProducts();
  if (existing.length > 0) {
    throw new AppError(
      "CATALOG_NOT_EMPTY",
      "目录已有数据，不能重复载入演示产品。",
      409,
    );
  }
  const products: ProductCreateInput[] = [
    {
      manufacturerName: "虚构厂家甲",
      brandName: "甲品牌",
      modelCode: "E100",
      name: "DEMO 经济型 1000kg",
      applicableScenarios: ["OLD_BUILDING_ADDITION"],
      verificationStatus: "DEMO_MOCK",
      sourceReference: "Blueprint DEMO_MOCK catalog",
      specification: {
        capacityKg: 1000,
        speedMps: 1,
        maxFloors: 18,
        maxTravelM: 51,
        shaftWidthMm: 2200,
        shaftDepthMm: 2100,
        pitDepthMm: 1500,
        overheadMm: 4500,
        machineRoomType: "MRL",
      },
      price: {
        minimumAmount: 280_000,
        maximumAmount: 310_000,
        currency: "CNY",
        region: "DEMO",
        validityStatus: "DEMO_MOCK",
        sourceReference: "Blueprint DEMO_MOCK catalog",
      },
    },
    {
      manufacturerName: "虚构厂家甲",
      brandName: "甲品牌",
      modelCode: "E200",
      name: "DEMO 均衡型 1000kg",
      applicableScenarios: [
        "OLD_BUILDING_ADDITION",
        "NEW_BUILDING_INSTALLATION",
      ],
      verificationStatus: "DEMO_MOCK",
      sourceReference: "Blueprint DEMO_MOCK catalog",
      specification: {
        capacityKg: 1000,
        speedMps: 1.5,
        maxFloors: 18,
        maxTravelM: 51,
        shaftWidthMm: 2200,
        shaftDepthMm: 2100,
        pitDepthMm: 1500,
        overheadMm: 4500,
        machineRoomType: "MRL",
      },
      price: {
        minimumAmount: 320_000,
        maximumAmount: 360_000,
        currency: "CNY",
        region: "DEMO",
        validityStatus: "DEMO_MOCK",
        sourceReference: "Blueprint DEMO_MOCK catalog",
      },
    },
    {
      manufacturerName: "虚构厂家乙",
      brandName: "乙品牌",
      modelCode: "B300",
      name: "DEMO 改善型 1150kg",
      applicableScenarios: [
        "OLD_BUILDING_ADDITION",
        "EXISTING_ELEVATOR_RENOVATION",
        "NEW_BUILDING_INSTALLATION",
      ],
      verificationStatus: "DEMO_MOCK",
      sourceReference: "Blueprint DEMO_MOCK catalog",
      specification: {
        capacityKg: 1150,
        speedMps: 1.75,
        maxFloors: 18,
        maxTravelM: 51,
        shaftWidthMm: 2300,
        shaftDepthMm: 2200,
        pitDepthMm: 1500,
        overheadMm: 4500,
        machineRoomType: "MRL",
      },
      price: {
        minimumAmount: 330_000,
        maximumAmount: 370_000,
        currency: "CNY",
        region: "DEMO",
        validityStatus: "DEMO_MOCK",
        sourceReference: "Blueprint DEMO_MOCK catalog",
      },
    },
    {
      manufacturerName: "虚构厂家乙",
      brandName: "乙品牌",
      modelCode: "B400",
      name: "DEMO 紧凑型 800kg",
      applicableScenarios: ["OLD_BUILDING_ADDITION"],
      verificationStatus: "DEMO_MOCK",
      sourceReference: "Blueprint DEMO_MOCK catalog",
      specification: {
        capacityKg: 800,
        speedMps: 1,
        maxFloors: 18,
        maxTravelM: 51,
        shaftWidthMm: 2000,
        shaftDepthMm: 1900,
        pitDepthMm: 1500,
        overheadMm: 4500,
        machineRoomType: "MRL",
      },
      price: {
        minimumAmount: 250_000,
        maximumAmount: 280_000,
        currency: "CNY",
        region: "DEMO",
        validityStatus: "DEMO_MOCK",
        sourceReference: "Blueprint DEMO_MOCK catalog",
      },
    },
  ];
  for (const product of products) {
    await createCatalogProduct(product, audit);
  }
  return products.length;
}

export async function updateCatalogProduct(
  productId: string,
  input: ProductUpdateInput,
  audit: ProductAuditContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const previousRows = await tx.$queryRaw<Array<{
      name: string;
      verificationStatus: string;
    }>>`
      SELECT "name", "verificationStatus"::text AS "verificationStatus"
      FROM "product_model"
      WHERE "id" = ${productId}
      FOR UPDATE
    `;
    if (!previousRows[0]) {
      throw new AppError("PRODUCT_NOT_FOUND", "产品不存在。", 404);
    }
    const changed = await tx.$executeRaw`
      UPDATE "product_model"
      SET "name" = ${input.name},
          "description" = ${input.description ?? null},
          "applicableScenarios" = ${asJson(input.applicableScenarios)}::jsonb,
          "verificationStatus" = ${input.verificationStatus}::"CatalogVerificationStatus",
          "sourceReference" = ${input.sourceReference ?? null},
          "updatedAt" = NOW()
      WHERE "id" = ${productId}
    `;
    if (changed !== 1) {
      throw new AppError("PRODUCT_NOT_FOUND", "产品不存在。", 404);
    }
    await tx.$executeRaw`
      INSERT INTO "product_specification"
        ("id", "productId", "version", "capacityKg", "speedMps", "maxFloors",
         "maxTravelM", "shaftWidthMm", "shaftDepthMm", "pitDepthMm",
         "overheadMm", "doorConfiguration", "machineRoomType",
         "sourceReference", "verificationStatus", "createdAt")
      VALUES
        (${randomUUID()}, ${productId},
        (SELECT COALESCE(MAX("version"), 0) + 1 FROM "product_specification" WHERE "productId" = ${productId}),
        ${input.specification.capacityKg ?? null},
        ${input.specification.speedMps ?? null},
        ${input.specification.maxFloors ?? null},
        ${input.specification.maxTravelM ?? null},
        ${input.specification.shaftWidthMm ?? null},
        ${input.specification.shaftDepthMm ?? null},
        ${input.specification.pitDepthMm ?? null},
        ${input.specification.overheadMm ?? null},
        ${input.specification.doorConfiguration ?? null},
        ${input.specification.machineRoomType},
        ${input.sourceReference ?? null},
        ${input.verificationStatus}::"CatalogVerificationStatus", NOW())
    `;
    if (input.price) {
      await tx.$executeRaw`
        INSERT INTO "product_price"
          ("id", "productId", "version", "currency", "region",
           "minimumAmount", "maximumAmount", "sourceReference",
           "validityStatus", "createdAt")
        VALUES
          (${randomUUID()}, ${productId},
          (SELECT COALESCE(MAX("version"), 0) + 1 FROM "product_price" WHERE "productId" = ${productId}),
          ${input.price.currency}, ${input.price.region},
          ${input.price.minimumAmount ?? null},
          ${input.price.maximumAmount ?? null},
          ${input.price.sourceReference ?? null},
          ${input.price.validityStatus}::"PriceValidityStatus", NOW())
      `;
    }
    await appendAuditLog(tx, {
      actorUserId: audit.actorUserId,
      action: "catalog.product.updated",
      objectType: "ProductModel",
      objectId: productId,
      oldValue: {
        name: previousRows[0].name,
        verificationStatus: previousRows[0].verificationStatus,
      },
      newValue: {
        name: input.name,
        applicableScenarios: input.applicableScenarios,
        verificationStatus: input.verificationStatus,
        sourceReference: input.sourceReference ?? null,
        specificationChanged: true,
        priceChanged: Boolean(input.price),
      },
      requestId: audit.requestId,
    });
  });
}

export async function createSelectionRun(input: {
  projectId: string;
  requirementId: string;
  createdById: string;
  inputSnapshot: unknown;
  result: SelectionResult;
}): Promise<SelectionRunRecord> {
  const id = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "selection_run"
        ("id", "projectId", "requirementId", "createdById",
         "rulesVersion", "status", "inputSnapshot", "outputSnapshot", "createdAt")
      VALUES
        (${id}, ${input.projectId}, ${input.requirementId}, ${input.createdById},
         ${input.result.rulesVersion},
         ${input.result.status}::"SelectionRunStatus",
         ${asJson(input.inputSnapshot)}::jsonb,
         ${asJson(input.result)}::jsonb, NOW())
    `;
    for (const candidate of [
      ...input.result.recommendations,
      ...input.result.alternatives,
      ...input.result.improvementCandidates,
    ]) {
      await tx.$executeRaw`
        INSERT INTO "selection_recommendation"
          ("id", "selectionRunId", "productId", "specVersion",
           "budgetAssessment", "recommendationType", "reasons",
           "limitations", "sourceReferences", "createdAt")
        VALUES
          (${randomUUID()}, ${id}, ${candidate.product.productId},
           ${candidate.product.specificationVersion},
           ${candidate.budgetAssessment}::"BudgetAssessment",
           ${candidate.recommendationType},
           ${asJson(candidate.matchingReasons)}::jsonb,
           ${asJson([...candidate.unmatchedConstraints, ...candidate.warnings])}::jsonb,
           ${asJson(candidate.sourceReferences)}::jsonb, NOW())
      `;
    }
  });

  return {
    id,
    projectId: input.projectId,
    requirementId: input.requirementId,
    status: input.result.status,
    rulesVersion: input.result.rulesVersion,
    result: input.result,
    createdAt: new Date(),
  };
}

export async function listSelectionRuns(
  projectId: string,
): Promise<SelectionRunRecord[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    projectId: string;
    requirementId: string;
    status: "COMPLETED" | "NO_VALID_MATCH";
    rulesVersion: string;
    result: SelectionResult;
    createdAt: Date;
  }>>`
    SELECT
      "id", "projectId", "requirementId", "status",
      "rulesVersion", "outputSnapshot" AS "result", "createdAt"
    FROM "selection_run"
    WHERE "projectId" = ${projectId}
    ORDER BY "createdAt" DESC
  `;
  return rows;
}

export async function listRecentSelectionRuns(
  projectIds: string[],
  limit = 3,
): Promise<Array<SelectionRunRecord & { projectName: string }>> {
  if (projectIds.length === 0) {
    return [];
  }
  return prisma.$queryRaw<Array<
    SelectionRunRecord & { projectName: string }
  >>`
    SELECT
      r."id", r."projectId", r."requirementId", r."status",
      r."rulesVersion", r."outputSnapshot" AS "result", r."createdAt",
      p."name" AS "projectName"
    FROM "selection_run" r
    JOIN "project" p ON p."id" = r."projectId"
    WHERE r."projectId" = ANY(${projectIds}::text[])
    ORDER BY r."createdAt" DESC
    LIMIT ${limit}
  `;
}

export async function getOrCreateCustomerId(userId: string): Promise<string> {
  const linked = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "customer" WHERE "userId" = ${userId} LIMIT 1
  `;
  if (linked[0]) {
    return linked[0].id;
  }

  const viaProject = await prisma.$queryRaw<Array<{ customerId: string }>>`
    SELECT p."customerId"
    FROM "user_role" ur
    JOIN "project" p ON p."id" = ur."projectId"
    WHERE ur."userId" = ${userId} AND ur."scope" = 'PROJECT'
    LIMIT 1
  `;
  if (viaProject[0]) {
    await prisma.$executeRaw`
      UPDATE "customer" SET "userId" = ${userId}
      WHERE "id" = ${viaProject[0].customerId} AND "userId" IS NULL
    `;
    return viaProject[0].customerId;
  }

  const id = randomUUID();
  const users = await prisma.$queryRaw<Array<{ name: string; id: string }>>`
    SELECT "name", "id" FROM "user" WHERE "id" = ${userId} LIMIT 1
  `;
  if (!users[0]) {
    throw new AppError("USER_NOT_FOUND", "用户不存在。", 404);
  }
  await prisma.$executeRaw`
    INSERT INTO "customer"
      ("id", "userId", "organizationName", "contactName",
       "dataClassification", "createdById", "createdAt", "updatedAt")
    VALUES
      (${id}, ${userId}, ${`${users[0].name}（DEMO 账户）`},
       ${users[0].name}, 'DEMO_MOCK', ${userId}, NOW(), NOW())
  `;
  return id;
}

export async function createCustomerProject(input: {
  userId: string;
  requestId: string;
  data: MvpProjectCreateInput;
}): Promise<{ id: string; projectCode: string }> {
  const customerId = await getOrCreateCustomerId(input.userId);
  const id = randomUUID();
  const projectCode = `DEMO-MVP-${randomUUID().slice(0, 8).toUpperCase()}`;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "project"
        ("id", "projectCode", "customerId", "name", "address",
         "projectType", "status", "dataClassification",
         "createdById", "createdAt", "updatedAt")
      VALUES
        (${id}, ${projectCode}, ${customerId}, ${input.data.name},
         ${input.data.address},
         ${input.data.installationScenario}::"ProjectType",
         'DRAFT', 'DEMO_MOCK', ${input.userId}, NOW(), NOW())
    `;
    const role = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "role" WHERE "code" = 'CUSTOMER' LIMIT 1
    `;
    if (!role[0]) {
      throw new AppError(
        "CUSTOMER_ROLE_NOT_CONFIGURED",
        "客户项目权限尚未初始化。",
        500,
      );
    }
    await tx.$executeRaw`
      INSERT INTO "user_role"
        ("id", "userId", "roleId", "scope", "projectId", "createdAt")
      VALUES
        (${randomUUID()}, ${input.userId}, ${role[0].id},
         'PROJECT', ${id}, NOW())
      ON CONFLICT DO NOTHING
    `;
    await appendAuditLog(tx, {
      actorUserId: input.userId,
      action: "project.created",
      objectType: "Project",
      objectId: id,
      newValue: {
        projectCode,
        name: input.data.name,
        customerId,
        projectType: input.data.installationScenario,
      },
      requestId: input.requestId,
    });
  });
  return { id, projectCode };
}

export async function createSalesHandoff(input: {
  projectId: string;
  createdById: string;
  summary: string;
  budgetConcern?: string;
}): Promise<string> {
  const id = randomUUID();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "sales_handoff"
      ("id", "projectId", "createdById", "status", "summary",
       "budgetConcern", "createdAt", "updatedAt")
    VALUES
      (${id}, ${input.projectId}, ${input.createdById},
       'PENDING_FOLLOW_UP', ${input.summary},
       ${input.budgetConcern ?? null}, NOW(), NOW())
    ON CONFLICT ("projectId") DO UPDATE
      SET "summary" = EXCLUDED."summary",
          "budgetConcern" = EXCLUDED."budgetConcern",
          "updatedAt" = NOW()
    RETURNING "id"
  `;
  if (!rows[0]) {
    throw new AppError("SALES_HANDOFF_WRITE_FAILED", "销售交接保存失败。", 500);
  }
  return rows[0].id;
}

export async function listSalesHandoffs(): Promise<SalesHandoffRecord[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    projectId: string;
    projectName: string;
    status: SalesHandoffRecord["status"];
    summary: string | null;
    budgetConcern: string | null;
    createdAt: Date;
  }>>`
    SELECT
      h."id", h."projectId", p."name" AS "projectName", h."status",
      h."summary", h."budgetConcern", h."createdAt"
    FROM "sales_handoff" h
    JOIN "project" p ON p."id" = h."projectId"
    ORDER BY h."updatedAt" DESC
  `;
  return Promise.all(
    rows.map(async (row) => {
      const [notes, requirement, selectionRuns] = await Promise.all([
        prisma.$queryRaw<Array<{
          id: string;
          contactStatus: string;
          note: string;
          createdAt: Date;
        }>>`
          SELECT "id", "contactStatus", "note", "createdAt"
          FROM "sales_follow_up_note"
          WHERE "handoffId" = ${row.id}
          ORDER BY "createdAt" DESC
        `,
        getLatestRequirement(row.projectId),
        listSelectionRuns(row.projectId),
      ]);
      const selectionResolution = resolveCurrentSelectionRun(
        requirement?.id,
        selectionRuns,
      );
      const currentSelectionRun =
        selectionResolution.kind === "CURRENT" &&
        (selectionResolution.run.status === "COMPLETED" ||
          selectionResolution.run.status === "NO_VALID_MATCH")
          ? selectionResolution.run
          : null;
      return {
        ...row,
        requirement,
        selectionRun: currentSelectionRun,
        followUpNotes: notes,
      };
    }),
  );
}

export async function getLatestSalesHandoff(projectId: string) {
  return prisma.salesHandoff.findUnique({
    where: { projectId },
    select: {
      id: true,
      status: true,
      summary: true,
      budgetConcern: true,
      updatedAt: true,
    },
  });
}

export async function getSalesHandoffProjectId(
  handoffId: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ projectId: string }>>`
    SELECT "projectId" FROM "sales_handoff"
    WHERE "id" = ${handoffId}
    LIMIT 1
  `;
  return rows[0]?.projectId ?? null;
}

export async function addSalesFollowUp(input: {
  handoffId: string;
  authorUserId: string;
  data: SalesFollowUpInput;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRaw`
      UPDATE "sales_handoff"
      SET "status" = ${input.data.status}::"SalesHandoffStatus",
          "updatedAt" = NOW()
      WHERE "id" = ${input.handoffId}
    `;
    if (updated !== 1) {
      throw new AppError("SALES_HANDOFF_NOT_FOUND", "销售交接不存在。", 404);
    }
    await tx.$executeRaw`
      INSERT INTO "sales_follow_up_note"
        ("id", "handoffId", "authorUserId", "contactStatus", "note", "createdAt")
      VALUES
        (${randomUUID()}, ${input.handoffId}, ${input.authorUserId},
         ${input.data.contactStatus}, ${input.data.note}, NOW())
    `;
  });
}
