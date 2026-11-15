import { imageSize } from "image-size";

export interface ImageMetadata {
  width: number;
  height: number;
  format: string | undefined;
  fileSizeBytes: string;
}

export function extractImageMetadata(
  data: Uint8Array,
  maxPixels = 40_000_000,
): ImageMetadata {
  const metadata = imageSize(data);

  if (!metadata.width || !metadata.height) {
    throw new Error("IMAGE_DIMENSIONS_UNAVAILABLE");
  }

  if (metadata.width * metadata.height > maxPixels) {
    throw new Error("IMAGE_PIXEL_LIMIT_EXCEEDED");
  }

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.type,
    fileSizeBytes: data.byteLength.toString(),
  };
}
