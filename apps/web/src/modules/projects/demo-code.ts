import { randomBytes } from "node:crypto";

export type DemoCodeKind = "PROJECT" | "BUILDING" | "UNIT";

export function createDemoCode(kind: DemoCodeKind): string {
  const randomPart = randomBytes(4).toString("hex").toUpperCase();
  return `DEMO-${kind}-${randomPart}`;
}
