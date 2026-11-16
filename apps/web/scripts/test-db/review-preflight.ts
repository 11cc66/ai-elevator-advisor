import type {
  ExtractionFieldStatus,
  FieldReviewAction,
  PrismaClient,
} from "@prisma/client";

import { decideFieldReview } from "../../src/modules/files/field-review-policy.js";
import type { TestEnvironment } from "./env.js";
import { verifyTestDatabaseIdentity } from "./guard.js";

interface PreflightIssue {
  code: string;
  fieldId: string;
  reviewId?: string;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }

  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) =>
        jsonEqual(value, right[index]),
      )
    );
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        jsonEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

export async function preflightReviewInvariants(
  env: TestEnvironment,
  prisma: PrismaClient,
): Promise<PreflightIssue[]> {
  await verifyTestDatabaseIdentity("verify", env);

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");

      const fields = await tx.extractionField.findMany({
        orderBy: { id: "asc" },
        include: {
          extraction: {
            select: {
              status: true,
              fileVersion: {
                select: {
                  file: {
                    select: { projectId: true },
                  },
                },
              },
            },
          },
          reviews: {
            orderBy: { reviewSequence: "asc" },
          },
        },
      });
      const issues: PreflightIssue[] = [];

      for (const field of fields) {
        const projectId =
          field.extraction.fileVersion.file.projectId;
        let currentStatus: ExtractionFieldStatus =
          field.initialStatus;
        const configurationValid =
          (field.fieldClassification === "PROFESSIONAL" &&
            field.customerConfirmable === false &&
            field.requiresProfessionalReview === true) ||
          (field.fieldClassification === "ORDINARY" &&
            !(
              field.customerConfirmable === true &&
              field.requiresProfessionalReview === true
            ));
        if (!configurationValid) {
          issues.push({
            code: "FIELD_CONFIGURATION_INVALID",
            fieldId: field.id,
          });
        }

        for (const [index, review] of field.reviews.entries()) {
          const pushIssue = (code: string) => {
            issues.push({
              code,
              fieldId: field.id,
              reviewId: review.id,
            });
          };

          if (review.reviewSequence !== index + 1) {
            pushIssue("REVIEW_SEQUENCE_NOT_CONTIGUOUS");
          }

          if (field.extraction.status !== "COMPLETED") {
            pushIssue("EXTRACTION_NOT_COMPLETED");
          }

          if (
            !jsonEqual(
              review.originalValueSnapshot,
              field.originalRawValue,
            )
          ) {
            pushIssue("ORIGINAL_VALUE_SNAPSHOT_MISMATCH");
          }

          const expectedSnapshot = {
            roleCodes: ["CUSTOMER"],
            scope: "PROJECT",
            projectId,
          };
          if (!jsonEqual(review.actorRoleSnapshot, expectedSnapshot)) {
            pushIssue("ACTOR_ROLE_SNAPSHOT_MISMATCH");
          }

          const assignment = await tx.userRole.findFirst({
            where: {
              userId: review.actorUserId,
              scope: "PROJECT",
              projectId,
              role: { code: "CUSTOMER" },
            },
            select: { id: true },
          });
          if (!assignment) {
            pushIssue("ACTOR_CUSTOMER_ROLE_MISSING");
          }

          if (
            review.action === "CORRECT" &&
            review.correctedRawValue === null
          ) {
            pushIssue("CORRECTION_VALUE_MISSING");
          }
          if (
            review.action !== "CORRECT" &&
            (review.correctedRawValue !== null ||
              review.correctedNormalizedValue !== null)
          ) {
            pushIssue("NON_CORRECTION_HAS_CORRECTED_VALUE");
          }

          const decision = decideFieldReview(
            {
              fieldClassification: field.fieldClassification,
              initialStatus: field.initialStatus,
              currentStatus,
              customerConfirmable: field.customerConfirmable,
              requiresProfessionalReview:
                field.requiresProfessionalReview,
            },
            review.action as FieldReviewAction,
          );
          if (
            !decision.allowed ||
            decision.statusAfterReview !== review.statusAfterReview
          ) {
            pushIssue("REVIEW_TRANSITION_INVALID");
          }

          currentStatus = review.statusAfterReview;
        }
      }

      return issues;
    },
    {
      isolationLevel: "RepeatableRead",
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}
