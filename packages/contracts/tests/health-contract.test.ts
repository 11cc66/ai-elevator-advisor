import { describe, expect, it } from "vitest";

import { healthCheckSchema } from "../src/index.js";

describe("healthCheckSchema", () => {
  it("accepts the documented health response shape", () => {
    const response = healthCheckSchema.parse({
      status: "ok",
      service: "web",
      timestamp: "2026-11-15T00:00:00.000Z",
      durationMs: 3,
      checks: {
        database: "ok",
      },
    });

    expect(response.status).toBe("ok");
  });

  it("rejects responses that leak an unsupported database state", () => {
    const result = healthCheckSchema.safeParse({
      status: "ok",
      service: "web",
      timestamp: "2026-11-15T00:00:00.000Z",
      durationMs: 3,
      checks: {
        database: "contains-secret-details",
      },
    });

    expect(result.success).toBe(false);
  });
});
