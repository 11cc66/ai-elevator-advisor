import fs from "node:fs/promises";
import path from "node:path";

import { canonicalize, parseStrictJson } from "@elevator/build-integrity";

import { validateDeploymentEvidence } from "./evidence.js";
import {
  parseEvidenceVerificationTrust,
  sealEvidenceBundleDraft,
  verifyEvidenceBundle,
} from "./evidence-bundle.js";

function assertSafeInputPath(inputPath: string): string {
  const absolutePath = path.resolve(inputPath);
  const baseName = path.basename(absolutePath).toLowerCase();
  if (
    baseName.startsWith(".env") ||
    baseName.endsWith(".pem") ||
    baseName.endsWith(".key")
  ) {
    throw new Error("SENSITIVE_FILE_INPUT_FORBIDDEN");
  }
  return absolutePath;
}

function assertJsonOutputPath(outputPath: string): string {
  const absolutePath = assertSafeInputPath(outputPath);
  if (path.extname(absolutePath).toLowerCase() !== ".json") {
    throw new Error("EVIDENCE_OUTPUT_MUST_BE_JSON");
  }
  return absolutePath;
}

async function readStrictJson(inputPath: string): Promise<unknown> {
  return parseStrictJson(
    await fs.readFile(assertSafeInputPath(inputPath), "utf8"),
  );
}

async function validateCommand(
  evidencePath: string,
  trustPath?: string,
): Promise<void> {
  const evidence = await readStrictJson(evidencePath);
  const schemaVersion =
    typeof evidence === "object" &&
    evidence !== null &&
    "schemaVersion" in evidence
      ? evidence.schemaVersion
      : null;
  if (schemaVersion === 2 && !trustPath) {
    throw new Error("EVIDENCE_TRUST_FILE_REQUIRED");
  }
  const result =
    schemaVersion === 2
      ? verifyEvidenceBundle(evidence, {
          trust: parseEvidenceVerificationTrust(
            await readStrictJson(trustPath!),
          ),
        })
      : {
          ...validateDeploymentEvidence(evidence),
          productionDrain: "NOT EXECUTED" as const,
          legacySchemaWarning:
            "SCHEMA_V1_IS_NOT_VALID_FOR_L8A_DRAIN_READINESS",
        };
  console.log(JSON.stringify(result, null, 2));
  if (
    "drainReadiness" in result
      ? result.drainReadiness !== "READY FOR HUMAN REVIEW"
      : !result.readyForLegacyDrain
  ) {
    process.exitCode = 2;
  }
}

async function sealCommand(
  draftPath: string,
  outputPath: string,
): Promise<void> {
  const draft = await readStrictJson(draftPath);
  if (typeof draft !== "object" || draft === null) {
    throw new Error("EVIDENCE_DRAFT_INVALID");
  }
  const sealed = sealEvidenceBundleDraft(
    draft as Record<string, unknown>,
  );
  await fs.writeFile(
    assertJsonOutputPath(outputPath),
    `${canonicalize(sealed)}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      event: "evidence.bundle_sealed",
      bundleId: sealed.bundleId,
      digest: sealed.integrity.digest,
      signed: false,
    }),
  );
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "seal") {
    const draftPath = process.argv[3];
    const outputPath = process.argv[4];
    if (!draftPath || !outputPath) {
      throw new Error("EVIDENCE_SEAL_ARGUMENTS_REQUIRED");
    }
    await sealCommand(draftPath, outputPath);
    return;
  }
  if (command === "validate") {
    const evidencePath = process.argv[3];
    const trustPath = process.argv[4];
    if (!evidencePath) {
      throw new Error("EVIDENCE_VALIDATE_PATH_REQUIRED");
    }
    await validateCommand(evidencePath, trustPath);
    return;
  }
  if (command) {
    await validateCommand(command, process.argv[3]);
    return;
  }
  throw new Error("EVIDENCE_COMMAND_REQUIRED");
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: "evidence.validation_failed",
      errorName:
        error instanceof Error ? error.name : "UNKNOWN_ERROR",
      errorCode:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : typeof error === "object" &&
              error !== null &&
              "issues" in error
            ? "EVIDENCE_SCHEMA_INVALID"
            : "UNSPECIFIED",
    }),
  );
  process.exitCode = 1;
});
