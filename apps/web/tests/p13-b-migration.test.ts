import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const bMigrationPath = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20261117140000_phase37_p13_lifecycle_initial_state_guard/migration.sql",
    import.meta.url,
  ),
);
const originalMigrationPath = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20261117120000_phase37_p13_storage_lifecycle_schema/migration.sql",
    import.meta.url,
  ),
);

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractLifecycleGuard(sql: string): string {
  const match = sql.match(
    /CREATE OR REPLACE FUNCTION "p13_protect_storage_lifecycle"\(\)[\s\S]*?\$\$;/,
  );

  if (!match) {
    throw new Error("P13_LIFECYCLE_GUARD_FUNCTION_NOT_FOUND");
  }

  return match[0];
}

describe("P1-3 lifecycle initial-state guard migration", () => {
  it("preserves the original function except for the B initial-state guard", () => {
    const bFunction = extractLifecycleGuard(readFileSync(bMigrationPath, "utf8"));
    const originalFunction = extractLifecycleGuard(
      readFileSync(originalMigrationPath, "utf8"),
    );
    const withoutBGuard = bFunction.replace(
      /\n    IF NEW\."objectKind" IS NULL[\s\S]*?        USING ERRCODE = '23514';\n    END IF;/,
      "",
    );

    expect(normalizeSql(withoutBGuard)).toBe(normalizeSql(originalFunction));
  });

  it("runs A attestation before the B initial-state whitelist", () => {
    const sql = readFileSync(bMigrationPath, "utf8");
    const attestationIndex = sql.indexOf(
      'PERFORM "p13_assert_staging_cleanup_attestation"(NEW)',
    );
    const whitelistIndex = sql.indexOf('NEW."objectKind" IS NULL');

    expect(attestationIndex).toBeGreaterThan(-1);
    expect(whitelistIndex).toBeGreaterThan(attestationIndex);
  });

  it("fails closed for only the two approved ordinary initial states", () => {
    const sql = normalizeSql(readFileSync(bMigrationPath, "utf8"));

    expect(sql).toContain(
      `(NEW."objectKind" = 'STAGING' AND NEW.state = 'STAGING_RESERVED')`,
    );
    expect(sql).toContain(
      `(NEW."objectKind" = 'CANONICAL' AND NEW.state = 'FINALIZING')`,
    );
    expect(sql).toContain(`RAISE EXCEPTION 'invalid storage lifecycle initial state' USING ERRCODE = '23514'`);
  });

  it("does not contain unrelated or destructive DDL", () => {
    const sql = readFileSync(bMigrationPath, "utf8").replace(/--.*$/gm, "");
    const ddlStatements = sql.match(/\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b/gi);

    expect(ddlStatements).toHaveLength(1);
    expect(sql).not.toMatch(
      /\b(?:DROP|TRUNCATE|GRANT|REVOKE|ALTER\s+TABLE|CREATE\s+TRIGGER|CREATE\s+CONSTRAINT\s+TRIGGER)\b/i,
    );
  });
});
