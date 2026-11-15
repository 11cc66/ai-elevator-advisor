import { describe, expect, it } from "vitest";

import {
  createCustomerSchema,
  createProjectSchema,
  loginCredentialsSchema,
  uploadIntentSchema,
} from "../src/index.js";

describe("Phase 2 contracts", () => {
  it("normalizes optional customer fields", () => {
    const result = createCustomerSchema.parse({
      organizationName: "  测试客户  ",
      contactName: "  测试联系人 ",
      contactPhone: "   ",
    });

    expect(result.organizationName).toBe("测试客户");
    expect(result.contactPhone).toBeUndefined();
  });

  it("accepts only the V1 old-building project type", () => {
    const result = createProjectSchema.safeParse({
      customerId: "customer-1",
      name: "演示项目",
      address: "演示地址",
      projectType: "OTHER",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsafe username characters", () => {
    const result = loginCredentialsSchema.safeParse({
      username: "admin'; DROP TABLE user; --",
      password: "not-logged",
    });

    expect(result.success).toBe(false);
  });

  it("rejects upload declarations over 20 MiB or outside the MIME allowlist", () => {
    const base = {
      displayName: "演示资料",
      originalFilename: "demo.pdf",
      declaredMimeType: "application/pdf",
      declaredSizeBytes: 20 * 1024 * 1024 + 1,
    };

    expect(uploadIntentSchema.safeParse(base).success).toBe(false);
    expect(
      uploadIntentSchema.safeParse({
        ...base,
        declaredMimeType: "image/svg+xml",
        declaredSizeBytes: 100,
      }).success,
    ).toBe(false);
  });
});
