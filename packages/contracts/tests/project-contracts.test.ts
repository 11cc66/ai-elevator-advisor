import { describe, expect, it } from "vitest";

import {
  createCustomerSchema,
  createProjectSchema,
  loginCredentialsSchema,
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
});
