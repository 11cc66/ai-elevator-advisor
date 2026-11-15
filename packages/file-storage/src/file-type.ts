import { fileTypeFromBuffer } from "file-type";

import { PrivateStorageError } from "./errors.js";

export const ALLOWED_FILE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedFileMimeType =
  (typeof ALLOWED_FILE_MIME_TYPES)[number];

export interface AllowedDetectedFileType {
  mimeType: AllowedFileMimeType;
  extension: "pdf" | "jpg" | "png";
}

export async function detectAllowedFileType(
  headerBytes: Uint8Array,
): Promise<AllowedDetectedFileType> {
  const detected = await fileTypeFromBuffer(headerBytes);

  if (!detected) {
    throw new PrivateStorageError(
      "FILE_TYPE_UNKNOWN",
      "Unable to determine the file type.",
    );
  }

  const mimeType = detected.mime.toLowerCase();
  if (
    mimeType !== "application/pdf" &&
    mimeType !== "image/jpeg" &&
    mimeType !== "image/png"
  ) {
    throw new PrivateStorageError(
      "FILE_TYPE_NOT_ALLOWED",
      "Only PDF, JPEG, and PNG files are supported.",
    );
  }

  return {
    mimeType,
    extension:
      mimeType === "application/pdf"
        ? "pdf"
        : mimeType === "image/jpeg"
          ? "jpg"
          : "png",
  };
}

export function filenameMatchesMimeType(
  filename: string,
  mimeType: AllowedFileMimeType,
): boolean {
  const extension = filename.toLowerCase().split(".").pop();

  if (mimeType === "application/pdf") {
    return extension === "pdf";
  }

  if (mimeType === "image/jpeg") {
    return extension === "jpg" || extension === "jpeg";
  }

  return extension === "png";
}
