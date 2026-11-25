import { describe, expect, it } from "vitest";

import {
  createCustomerSchema,
  createProjectSchema,
  loginCredentialsSchema,
  productCreateSchema,
  requirementDraftSchema,
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

  it("accepts all three MVP installation scenarios", () => {
    for (const projectType of [
      "OLD_BUILDING_ADDITION",
      "EXISTING_ELEVATOR_RENOVATION",
      "NEW_BUILDING_INSTALLATION",
    ]) {
      expect(
        createProjectSchema.safeParse({
          customerId: "customer-1",
          name: "演示项目",
          address: "演示地址",
          projectType,
        }).success,
      ).toBe(true);
    }
  });

  it("requires structured requirement values to remain explicit", () => {
    const parsed = requirementDraftSchema.parse({
      installationScenario: "OLD_BUILDING_ADDITION",
      floorCount: 8,
      budgetMax: 500_000,
    });
    expect(parsed.floorCount).toBe(8);
    expect(parsed.budgetMax).toBe(500_000);
    expect(parsed.professionalReviewRequired).toBe(true);
    expect(parsed).not.toHaveProperty("capacityKg");
    expect(parsed).not.toHaveProperty("speedMps");
  });

  it("accepts the composite height-or-floor-height missing requirement", () => {
    const parsed = requirementDraftSchema.parse({
      installationScenario: "OLD_BUILDING_ADDITION",
      missingFields: [
        "floorHeight",
        "buildingHeight",
        "buildingHeightOrFloorHeight",
      ],
    });

    expect(parsed.missingFields).toEqual([
      "floorHeight",
      "buildingHeight",
      "buildingHeightOrFloorHeight",
    ]);
  });

  it("rejects impossible product price ranges", () => {
    expect(
      productCreateSchema.safeParse({
        manufacturerName: "虚构厂商",
        brandName: "虚构品牌",
        modelCode: "DEMO-1",
        name: "DEMO 产品",
        applicableScenarios: ["OLD_BUILDING_ADDITION"],
        verificationStatus: "DEMO_MOCK",
        specification: { machineRoomType: "MRL" },
        price: {
          minimumAmount: 500_000,
          maximumAmount: 400_000,
          validityStatus: "DEMO_MOCK",
        },
      }).success,
    ).toBe(false);
  });

  it("requires provenance for verified catalog and valid price data", () => {
    const base = {
      manufacturerName: "虚构厂商",
      brandName: "虚构品牌",
      modelCode: "DEMO-SOURCE",
      name: "DEMO 来源校验产品",
      applicableScenarios: ["OLD_BUILDING_ADDITION"],
      specification: { machineRoomType: "MRL" },
    };
    expect(
      productCreateSchema.safeParse({
        ...base,
        verificationStatus: "VERIFIED",
      }).success,
    ).toBe(false);
    expect(
      productCreateSchema.safeParse({
        ...base,
        verificationStatus: "DEMO_MOCK",
        price: { validityStatus: "VALID" },
      }).success,
    ).toBe(false);
  });
});
