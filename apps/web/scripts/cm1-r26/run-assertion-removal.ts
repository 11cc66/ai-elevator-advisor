import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const repoRoot = "D:\\thinkbook\\Desktop\\jieya";
const sourceRoot = path.join(
  repoRoot,
  "apps/web/scripts/cm1-r24",
);
const helperRoot = path.join(
  repoRoot,
  "apps/web/tests/helpers",
);
const evidenceRoot =
  process.env.CM1_R26_EVIDENCE_ROOT ??
  "D:\\AI-Elevator-Advisor-CM1-R26\\evidence\\assertion-removal";
const tsxCli =
  "D:\\thinkbook\\Desktop\\jieya\\node_modules\\.pnpm\\tsx@4.23.15\\node_modules\\tsx\\dist\\cli.mjs";

const helperSource = await readFile(
  path.join(helperRoot, "phase41-trigger-catalog.ts"),
  "utf8",
);
const faultSource = await readFile(
  path.join(sourceRoot, "phase41-catalog-faults.ts"),
  "utf8",
);

const variants = [
  {
    id: "oid",
    expectedCode: "TRIGGER_FUNCTION_OID_MISMATCH",
    block: `    compare(
      "TRIGGER_FUNCTION_OID_MISMATCH",
      actual.expectedFunctionOid,
      actual.triggerFunctionOid,
    );
`,
  },
  {
    id: "type",
    expectedCode: "TRIGGER_TYPE_MISMATCH",
    block: `    compare(
      "TRIGGER_TYPE_MISMATCH",
      expected.triggerType,
      actual.triggerType,
    );
`,
  },
  {
    id: "update_columns",
    expectedCode: "TRIGGER_UPDATE_COLUMNS_MISMATCH",
    block: `    compare(
      "TRIGGER_UPDATE_COLUMNS_MISMATCH",
      expected.updateColumns,
      actual.updateColumns,
    );
`,
  },
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function runVariant(input: {
  id: string;
  expectedCode: string;
  block: string;
}): Promise<void> {
  if (!helperSource.includes(input.block)) {
    throw new Error(`ASSERTION_BLOCK_NOT_FOUND variant=${input.id}`);
  }
  const variantHelper = helperSource.replace(input.block, "");
  if (variantHelper === helperSource) {
    throw new Error(`ASSERTION_BLOCK_NOT_REMOVED variant=${input.id}`);
  }

  const variantDirectory = path.join(
    sourceRoot,
    `.assertion-removal-${randomUUID()}`,
  );
  const evidenceDirectory = path.join(evidenceRoot, input.id);
  await mkdir(variantDirectory, { recursive: true });
  await mkdir(evidenceDirectory, { recursive: true });

  const helperPath = path.join(
    variantDirectory,
    "phase41-trigger-catalog.variant.ts",
  );
  const faultPath = path.join(
    variantDirectory,
    "phase41-catalog-faults.variant.ts",
  );
  const variantFault = faultSource.replace(
    "../../tests/helpers/phase41-trigger-catalog.js",
    "./phase41-trigger-catalog.variant.js",
  );

  try {
    await writeFile(helperPath, variantHelper, "utf8");
    await writeFile(faultPath, variantFault, "utf8");

    const child = spawn(
      process.execPath,
      [tsxCli, faultPath],
      {
        cwd: repoRoot,
        env: process.env,
        windowsHide: true,
      },
    );
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      output += chunk;
    });
    const exitCode = await new Promise<number | null>((resolve) => {
      child.once("exit", resolve);
    });

    const expectedFailure = `EXPECTED_FINDING_MISSING code=${input.expectedCode}`;
    const unrelatedFailure =
      /PrismaClientInitializationError|SyntaxError|POSTGRES_IDENTITY_MISMATCH/.test(
        output,
      );
    const metadata = {
      variant: input.id,
      expectedCode: input.expectedCode,
      removedBlock: input.block,
      canonicalHelperSha256: sha256(helperSource),
      variantHelperSha256: sha256(variantHelper),
      canonicalFaultSourceSha256: sha256(faultSource),
      variantFaultSourceSha256: sha256(variantFault),
      command: `${process.execPath} ${tsxCli} <temporary-variant>/phase41-catalog-faults.variant.ts`,
      exitCode,
      expectedFailureObserved: output.includes(expectedFailure),
      unrelatedFailureObserved: unrelatedFailure,
    };

    await copyFile(
      helperPath,
      path.join(evidenceDirectory, "phase41-trigger-catalog.variant.ts"),
    );
    await copyFile(
      faultPath,
      path.join(evidenceDirectory, "phase41-catalog-faults.variant.ts"),
    );
    await writeFile(
      path.join(evidenceDirectory, "run.log"),
      `${output}\nEXIT_CODE=${exitCode}\n`,
      "utf8",
    );
    await writeFile(
      path.join(evidenceDirectory, "metadata.json"),
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8",
    );

    if (
      exitCode === 0 ||
      !metadata.expectedFailureObserved ||
      unrelatedFailure
    ) {
      throw new Error(
        `ASSERTION_REMOVAL_VARIANT_INVALID ${JSON.stringify(metadata)}`,
      );
    }
    console.log(JSON.stringify({ event: "r26.assertion_removal", ...metadata }));
  } finally {
    await rm(variantDirectory, { recursive: true, force: true });
  }
}

for (const variant of variants) {
  await runVariant(variant);
}
