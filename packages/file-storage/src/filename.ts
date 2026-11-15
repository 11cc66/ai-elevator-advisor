import path from "node:path";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;
const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*]/g;

export function sanitizeDisplayFilename(input: string): string {
  const normalizedSlashPath = input.replaceAll("\\", "/");
  const baseName = path.posix.basename(normalizedSlashPath);
  const cleaned = baseName
    .replace(CONTROL_CHARACTERS, "")
    .replace(INVALID_FILENAME_CHARACTERS, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();

  return (cleaned || "file").slice(0, 240);
}
