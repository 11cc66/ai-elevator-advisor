import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20261117130000_phase37_p13_lifecycle_insert_guard/migration.sql",
    import.meta.url,
  ),
);

describe("P1-3 lifecycle INSERT guard migration", () => {
  it("only replaces the existing lifecycle trigger with INSERT coverage", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const statements = sql
      .replace(/--.*$/gm, "")
      .split(";")
      .map((statement) => statement.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    expect(statements).toEqual([
      [
        'CREATE OR REPLACE TRIGGER "p13_storage_lifecycle_guard"',
        "BEFORE INSERT OR UPDATE OR DELETE",
        'ON "storage_object_lifecycle"',
        "FOR EACH ROW",
        'EXECUTE FUNCTION "p13_protect_storage_lifecycle"()',
      ].join(" "),
    ]);
  });

  it("does not include unrelated or destructive DDL", () => {
    const sql = readFileSync(migrationPath, "utf8").replace(/--.*$/gm, "");

    expect(sql).not.toMatch(
      /\b(?:DROP|TRUNCATE|GRANT|REVOKE|ALTER\s+TABLE|CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION)\b/i,
    );
  });
});
