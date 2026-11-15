import { AppError } from "@/server/http/errors";
import { prisma } from "@/server/prisma";

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
        select: versionSelect,
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
