import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const source = readFileSync(
  resolve(root, "apps/web/scripts/cm1-r24/phase41-catalog-faults.ts"),
  "utf8",
);
const assertionRemovalSource = readFileSync(
  resolve(
    root,
    "apps/web/scripts/cm1-r26/run-assertion-removal.ts",
  ),
  "utf8",
);

describe("R24 catalog fault-injection source evidence", () => {
  it("defines seven independently identifiable scenarios", () => {
    for (const scenarioId of [
      "R26-FI-01",
      "R26-FI-02",
      "R26-FI-03",
      "R26-FI-04",
      "R26-FI-05",
      "R26-FI-06",
      "R26-FI-07",
    ]) {
      expect(source).toContain(`scenarioId: "${scenarioId}"`);
    }
  });

  it("isolates the function OID mutation from name and schema", () => {
    expect(source).toContain(
      'mutationKind: "IN_MEMORY_CATALOG_ROW"',
    );
    expect(source).toContain(
      "triggerFunctionOid: actual.expectedFunctionOid + 1",
    );
    expect(source).toContain(
      'mutated.functionSchema !== actual.functionSchema',
    );
    expect(source).toContain(
      'mutated.functionName !== actual.functionName',
    );
    expect(source).toContain(
      'expectedCode: "TRIGGER_FUNCTION_OID_MISMATCH"',
    );
  });

  it("separates UPDATE OF columns from tgtype event bits", () => {
    expect(source).toContain('name: "reduced_update_columns"');
    expect(source).toContain(
      'expectedCode: "TRIGGER_UPDATE_COLUMNS_MISMATCH"',
    );
    expect(source).toContain('name: "missing_expected_event_bit"');
    expect(source).toContain(
      'expectedCode: "TRIGGER_TYPE_MISMATCH"',
    );
    expect(source).toContain("AFTER INSERT ON");
    expect(source).toContain("trigger.triggerType !== 5");
    expect(source).toContain("decoded.update ||");
  });

  it("does not disable Triggers or bypass the catalog validator", () => {
    expect(source).not.toContain("session_replication_role");
    expect(source).not.toContain("DISABLE TRIGGER");
    expect(
      source.match(/ENABLE REPLICA TRIGGER/g) ?? [],
    ).toHaveLength(1);
  });

  it("defines three independent assertion-removal variants", () => {
    expect(assertionRemovalSource).toContain('id: "oid"');
    expect(assertionRemovalSource).toContain('id: "type"');
    expect(assertionRemovalSource).toContain(
      'id: "update_columns"',
    );
    expect(assertionRemovalSource).toContain(
      "ASSERTION_BLOCK_NOT_REMOVED",
    );
    expect(assertionRemovalSource).toContain(
      "unrelatedFailureObserved",
    );
  });

  it("removes temporary assertion-removal source copies", () => {
    expect(assertionRemovalSource).toContain(
      ".assertion-removal-",
    );
    expect(assertionRemovalSource).toContain(
      "await rm(variantDirectory, { recursive: true, force: true })",
    );
  });
});
