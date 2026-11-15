import type { FieldReviewInput } from "@elevator/contracts";
import {
  Prisma,
  type ExtractionFieldStatus,
  type PrismaClient,
} from "@prisma/client";

import type { Actor } from "@/modules/access/actor";
import { AppError } from "@/server/http/errors";
import { prisma } from "@/server/prisma";

import {
  decideFieldReview,
  deriveEffectiveFieldStatus,
} from "./field-review-policy";

interface LockedFieldRow {
  fieldId: string;
  extractionStatus: string;
}

function normalizedCorrection(
  value: Prisma.InputJsonValue,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : Prisma.JsonNull;
}

function validateCorrectionValue(
  valueType: string,
  value: Prisma.InputJsonValue,
): void {
  const valid =
    (valueType === "TEXT" && typeof value === "string") ||
    (valueType === "NUMBER" &&
      typeof value === "number" &&
      Number.isFinite(value)) ||
    (valueType === "BOOLEAN" && typeof value === "boolean") ||
    (valueType === "DATE" &&
      typeof value === "string" &&
      !Number.isNaN(Date.parse(value)));

  if (!valid) {
    throw new AppError(
      "FIELD_CORRECTION_VALUE_INVALID",
      "修正内容与字段资料类型不一致。",
      400,
    );
  }
}

async function requireProjectCustomerRole(
  tx: Prisma.TransactionClient,
  actor: Actor,
  projectId: string,
): Promise<void> {
  const assignment = await tx.userRole.findFirst({
    where: {
      userId: actor.userId,
      scope: "PROJECT",
      projectId,
      role: {
        code: "CUSTOMER",
      },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new AppError(
      "CUSTOMER_ROLE_REQUIRED",
      "只有该项目的客户账号可以提交资料确认。",
      403,
    );
  }
}

export async function submitCustomerFieldReview(input: {
  actor: Actor;
  projectId: string;
  fileId: string;
  versionId: string;
  extractionId: string;
  fieldId: string;
  review: FieldReviewInput;
  requestId: string;
  database?: PrismaClient;
}) {
  const database = input.database ?? prisma;

  try {
    return await database.$transaction(async (tx) => {
      await requireProjectCustomerRole(tx, input.actor, input.projectId);

      const lockedRows = await tx.$queryRaw<LockedFieldRow[]>`
        SELECT
          ef."id" AS "fieldId",
          fe."status"::text AS "extractionStatus"
        FROM "extraction_field" ef
        INNER JOIN "file_extraction" fe
          ON fe."id" = ef."extractionId"
        INNER JOIN "file_version" fv
          ON fv."id" = fe."fileVersionId"
        INNER JOIN "file" f
          ON f."id" = fv."fileId"
        WHERE ef."id" = ${input.fieldId}
          AND ef."extractionId" = ${input.extractionId}
          AND fe."id" = ${input.extractionId}
          AND fe."fileVersionId" = ${input.versionId}
          AND fv."id" = ${input.versionId}
          AND fv."fileId" = ${input.fileId}
          AND f."id" = ${input.fileId}
          AND f."projectId" = ${input.projectId}
        FOR UPDATE OF ef
      `;
      const locked = lockedRows[0];

      if (!locked) {
        throw new AppError(
          "EXTRACTION_FIELD_NOT_FOUND",
          "识别字段不存在或不属于当前文件。",
          404,
        );
      }

      if (locked.extractionStatus !== "COMPLETED") {
        throw new AppError(
          "EXTRACTION_NOT_COMPLETED",
          "识别任务尚未完成，当前不能确认字段。",
          409,
        );
      }

      const field = await tx.extractionField.findUniqueOrThrow({
        where: { id: input.fieldId },
        select: {
          id: true,
          extractionId: true,
          fieldKey: true,
          fieldLabel: true,
          valueType: true,
          originalRawValue: true,
          initialStatus: true,
          fieldClassification: true,
          customerConfirmable: true,
          requiresProfessionalReview: true,
          reviews: {
            orderBy: { reviewSequence: "desc" },
            take: 1,
            select: {
              reviewSequence: true,
              statusAfterReview: true,
            },
          },
        },
      });
      const latest = field.reviews[0] ?? null;
      const latestSequence = latest?.reviewSequence ?? 0;

      if (input.review.expectedReviewSequence !== latestSequence) {
        throw new AppError(
          "FIELD_REVIEW_STALE",
          "字段状态已发生变化，请刷新页面后重新操作。",
          409,
        );
      }

      const decision = decideFieldReview(field, input.review.action);
      if (!decision.allowed) {
        throw new AppError(
          decision.code,
          decision.message,
          403,
        );
      }

      const correctedRawValue =
        input.review.action === "CORRECT"
          ? (input.review.correctedRawValue as
              | Prisma.InputJsonValue
              | undefined)
          : undefined;
      if (
        correctedRawValue !== undefined &&
        input.review.action === "CORRECT"
      ) {
        validateCorrectionValue(field.valueType, correctedRawValue);
      }
      const correctedNormalizedValue =
        correctedRawValue === undefined
          ? undefined
          : normalizedCorrection(correctedRawValue);
      const reviewSequence = latestSequence + 1;
      const previousEffectiveStatus = deriveEffectiveFieldStatus({
        fieldClassification: field.fieldClassification,
        initialStatus: field.initialStatus,
        latestReviewStatus: latest?.statusAfterReview,
      });
      const review = await tx.extractionFieldReview.create({
        data: {
          extractionFieldId: field.id,
          reviewSequence,
          action: input.review.action,
          originalValueSnapshot:
            field.originalRawValue as Prisma.InputJsonValue,
          ...(correctedRawValue === undefined
            ? {}
            : {
                correctedRawValue,
                correctedNormalizedValue,
              }),
          statusAfterReview: decision.statusAfterReview,
          note: input.review.note,
          actorUserId: input.actor.userId,
          actorRoleSnapshot: {
            roleCodes: ["CUSTOMER"],
            scope: "PROJECT",
            projectId: input.projectId,
          },
        },
        select: {
          id: true,
          reviewSequence: true,
          action: true,
          originalValueSnapshot: true,
          correctedRawValue: true,
          correctedNormalizedValue: true,
          statusAfterReview: true,
          note: true,
          actorUserId: true,
          actorRoleSnapshot: true,
          createdAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actor.userId,
          action: `file.extraction_field.${input.review.action.toLowerCase()}`,
          objectType: "ExtractionField",
          objectId: field.id,
          requestId: input.requestId,
          oldValue: {
            effectiveStatus: previousEffectiveStatus,
            latestReviewSequence: latestSequence,
            originalRawValue: field.originalRawValue,
          },
          newValue: {
            reviewId: review.id,
            fieldKey: field.fieldKey,
            action: input.review.action,
            correctedRawValue: correctedRawValue ?? null,
            statusAfterReview: decision.statusAfterReview,
            reviewSequence,
          },
        },
      });

      return {
        review,
        effectiveStatus:
          decision.statusAfterReview as ExtractionFieldStatus,
        latestReviewSequence: reviewSequence,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "FIELD_REVIEW_CONFLICT",
        "字段状态已被其他操作更新，请刷新页面后重试。",
        409,
      );
    }
    throw error;
  }
}
