import { AppError } from "@/server/http/errors";
import { prisma } from "@/server/prisma";

import {
  customerFieldActions,
  deriveEffectiveFieldStatus,
} from "./field-review-policy";

const versionSelect = {
  id: true,
  versionNumber: true,
  originalFilename: true,
  detectedMimeType: true,
  sizeBytes: true,
  checksumSha256: true,
  uploadStatus: true,
  validationStatus: true,
  malwareScanStatus: true,
  integrityStatus: true,
  recognitionStatus: true,
  finalizedAt: true,
  createdAt: true,
} as const;

export async function listProjectFiles(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, customerId: true },
  });

  if (!project) {
    throw new AppError("PROJECT_NOT_FOUND", "项目不存在。", 404);
  }

  const files = await prisma.file.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      projectId: true,
      customerId: true,
      buildingId: true,
      installationUnitId: true,
      displayName: true,
      status: true,
      currentVersionId: true,
      dataClassification: true,
      createdAt: true,
      updatedAt: true,
      currentVersion: {
        select: versionSelect,
      },
      _count: {
        select: { versions: true },
      },
    },
  });

  return files.map((file) => ({
    ...file,
    currentVersion: file.currentVersion
      ? {
          ...file.currentVersion,
          sizeBytes: file.currentVersion.sizeBytes.toString(),
        }
      : null,
  }));
}

export async function getProjectFileDetails(
  projectId: string,
  fileId: string,
) {
  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      projectId,
    },
    select: {
      id: true,
      projectId: true,
      customerId: true,
      buildingId: true,
      installationUnitId: true,
      displayName: true,
      status: true,
      currentVersionId: true,
      dataClassification: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: {
          organizationName: true,
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          ...versionSelect,
          extractions: {
            orderBy: { extractionVersion: "desc" },
            select: {
              id: true,
              extractionVersion: true,
              status: true,
              pageCount: true,
              outputCharacterCount: true,
              attempt: true,
              nextAttemptAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!file) {
    throw new AppError(
      "FILE_NOT_FOUND",
      "文件不存在或不属于当前项目。",
      404,
    );
  }

  return {
    ...file,
    versions: file.versions.map((version) => ({
      ...version,
      sizeBytes: version.sizeBytes.toString(),
    })),
  };
}

async function verifyVersion(
  projectId: string,
  fileId: string,
  versionId: string,
): Promise<void> {
  const version = await prisma.fileVersion.findFirst({
    where: {
      id: versionId,
      fileId,
      file: {
        projectId,
      },
    },
    select: { id: true },
  });

  if (!version) {
    throw new AppError(
      "FILE_VERSION_NOT_FOUND",
      "文件版本不存在或不属于当前项目。",
      404,
    );
  }
}

export async function listVersionExtractions(
  projectId: string,
  fileId: string,
  versionId: string,
) {
  await verifyVersion(projectId, fileId, versionId);
  return prisma.fileExtraction.findMany({
    where: { fileVersionId: versionId },
    orderBy: { extractionVersion: "desc" },
    select: {
      id: true,
      extractionVersion: true,
      provider: true,
      providerVersion: true,
      parserVersion: true,
      dataClassification: true,
      status: true,
      pageCount: true,
      outputCharacterCount: true,
      attempt: true,
      nextAttemptAt: true,
      safeErrorCode: true,
      safeErrorMessage: true,
      queuedAt: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
}

export async function getExtractionDetails(
  projectId: string,
  fileId: string,
  versionId: string,
  extractionId: string,
) {
  await verifyVersion(projectId, fileId, versionId);
  const extraction = await prisma.fileExtraction.findFirst({
    where: {
      id: extractionId,
      fileVersionId: versionId,
    },
    select: {
      id: true,
      fileVersionId: true,
      extractionVersion: true,
      provider: true,
      providerVersion: true,
      parserVersion: true,
      dataClassification: true,
      status: true,
      extractedText: true,
      providerMetadata: true,
      pageCount: true,
      outputCharacterCount: true,
      missingItems: true,
      safetyNotes: true,
      safeErrorCode: true,
      safeErrorMessage: true,
      attempt: true,
      nextAttemptAt: true,
      queuedAt: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      fileVersion: {
        select: {
          id: true,
          versionNumber: true,
          file: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
      fields: {
        orderBy: [{ fieldKey: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          extractionId: true,
          fieldKey: true,
          fieldLabel: true,
          valueType: true,
          originalRawValue: true,
          originalNormalizedValue: true,
          unit: true,
          pageNumber: true,
          sourceText: true,
          sourceRefs: true,
          confidence: true,
          fieldClassification: true,
          initialStatus: true,
          customerConfirmable: true,
          requiresProfessionalReview: true,
          createdAt: true,
          reviews: {
            orderBy: { reviewSequence: "asc" },
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
              actor: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      textBlocks: {
        orderBy: [{ pageNumber: "asc" }, { blockIndex: "asc" }],
        select: {
          id: true,
          pageNumber: true,
          blockIndex: true,
          text: true,
          sourceKind: true,
          sourceRef: true,
          positionData: true,
          characterCount: true,
        },
      },
    },
  });

  if (!extraction) {
    throw new AppError(
      "EXTRACTION_NOT_FOUND",
      "识别结果不存在或不属于当前文件版本。",
      404,
    );
  }

  const fields = extraction.fields.map((field) => {
    const latestReview =
      field.reviews[field.reviews.length - 1] ?? null;
    const effectiveStatus = deriveEffectiveFieldStatus({
      fieldClassification: field.fieldClassification,
      initialStatus: field.initialStatus,
      latestReviewStatus: latestReview?.statusAfterReview,
    });
    const policyActions =
      extraction.status === "COMPLETED"
        ? customerFieldActions(field)
        : {
            canConfirm: false,
            canCorrect: false,
            canReject: false,
          };
    const actions = {
      ...policyActions,
      canConfirm:
        policyActions.canConfirm &&
        effectiveStatus !== "CUSTOMER_CONFIRMED",
      canReject:
        policyActions.canReject &&
        effectiveStatus !== "CUSTOMER_REJECTED",
    };

    return {
      ...field,
      confidence: field.confidence?.toString() ?? null,
      effectiveStatus,
      latestReviewSequence: latestReview?.reviewSequence ?? 0,
      needsCustomerConfirmation:
        field.fieldClassification === "ORDINARY" &&
        field.customerConfirmable &&
        effectiveStatus === "EXTRACTED",
      awaitingProfessionalReview:
        field.fieldClassification === "PROFESSIONAL" ||
        field.requiresProfessionalReview,
      availableActions: actions,
    };
  });

  return {
    ...extraction,
    fields,
    fieldSummary: {
      total: fields.length,
      customerConfirmed: fields.filter(
        (field) => field.effectiveStatus === "CUSTOMER_CONFIRMED",
      ).length,
      customerRejected: fields.filter(
        (field) => field.effectiveStatus === "CUSTOMER_REJECTED",
      ).length,
      awaitingCustomerConfirmation: fields.filter(
        (field) => field.needsCustomerConfirmation,
      ).length,
      awaitingProfessionalReview: fields.filter(
        (field) =>
          field.awaitingProfessionalReview &&
          field.effectiveStatus !== "INVALIDATED",
      ).length,
    },
  };
}
