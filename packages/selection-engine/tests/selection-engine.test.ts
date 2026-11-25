import { describe, expect, it } from "vitest";

import {
  evaluateSelection,
  type SelectionProduct,
  type SelectionRequirement,
} from "../src/index.js";

const requirement: SelectionRequirement = {
  installationScenario: "OLD_BUILDING_ADDITION",
  buildingUse: "住宅",
  floorCount: 8,
  floorHeight: 3,
  budgetMin: 400_000,
  budgetMax: 500_000,
  hardBudget: false,
};

function product(
  overrides: Partial<SelectionProduct> = {},
): SelectionProduct {
  return {
    productId: "demo-product-1",
    manufacturer: "虚构厂家甲",
    brand: "甲品牌",
    modelCode: "E100",
    name: "DEMO 1000kg",
    applicableScenarios: ["OLD_BUILDING_ADDITION"],
    verificationStatus: "DEMO_MOCK",
    specification: {
      capacityKg: 1000,
      speedMps: 1.5,
      maxFloors: 18,
      maxTravelM: 60,
      machineRoomType: "MRL",
    },
    price: {
      minimumAmount: 450_000,
      maximumAmount: 480_000,
      currency: "CNY",
      validityStatus: "DEMO_MOCK",
      sourceReference: "DEMO fixture",
    },
    sourceReferences: ["DEMO fixture"],
    ...overrides,
  };
}

describe("deterministic selection engine", () => {
  it("derives capacity and speed from floor count", () => {
    const result = evaluateSelection(requirement, [product()]);
    expect(result.derivedTargets).toMatchObject({
      minimumCapacityKg: 1000,
      minimumSpeedMps: 1.5,
      estimatedBuildingHeightM: 24,
    });
  });

  it("returns a traceable demo recommendation within budget", () => {
    const result = evaluateSelection(requirement, [product()]);
    expect(result.status).toBe("COMPLETED");
    expect(result.recommendations[0]?.dataClassification).toBe("DEMO_MOCK");
    expect(result.recommendations[0]?.budgetAssessment).toBe(
      "WITHIN_BUDGET",
    );
    expect(result.recommendations[0]?.matchingReasons.length).toBeGreaterThan(2);
    expect(result.professionalReviewRequired).toBe(true);
  });

  it("keeps a mildly over-budget product as an improvement candidate", () => {
    const result = evaluateSelection(requirement, [
      product({
        productId: "improvement",
        price: {
          minimumAmount: 550_000,
          currency: "CNY",
          validityStatus: "DEMO_MOCK",
        },
      }),
    ]);
    expect(result.recommendations).toHaveLength(0);
    expect(result.improvementCandidates[0]?.budgetAssessment).toBe(
      "SLIGHTLY_OVER_BUDGET_IMPROVEMENT",
    );
  });

  it("excludes over-budget products when the budget is hard", () => {
    const result = evaluateSelection(
      { ...requirement, hardBudget: true },
      [
        product({
          price: {
            minimumAmount: 700_000,
            currency: "CNY",
            validityStatus: "DEMO_MOCK",
          },
        }),
      ],
    );
    expect(result.status).toBe("NO_VALID_MATCH");
  });

  it("never uses unknown or expired catalog data for formal matching", () => {
    const result = evaluateSelection(requirement, [
      product({
        productId: "unverified",
        verificationStatus: "UNVERIFIED",
      }),
      product({
        productId: "expired",
        verificationStatus: "EXPIRED",
      }),
    ]);
    expect(result.status).toBe("NO_VALID_MATCH");
  });

  it("rejects scenario mismatch, insufficient floors, speed or travel", () => {
    const result = evaluateSelection(requirement, [
      product({
        productId: "wrong-scenario",
        applicableScenarios: ["NEW_BUILDING_INSTALLATION"],
      }),
      product({
        productId: "too-few-floors",
        specification: { ...product().specification, maxFloors: 6 },
      }),
      product({
        productId: "slow",
        specification: { ...product().specification, speedMps: 1 },
      }),
      product({
        productId: "short-travel",
        specification: { ...product().specification, maxTravelM: 20 },
      }),
    ]);
    expect(result.status).toBe("NO_VALID_MATCH");
  });

  it("reports missing information without inventing values", () => {
    const result = evaluateSelection(
      { installationScenario: "OLD_BUILDING_ADDITION" },
      [],
    );
    expect(result.missingInformation).toEqual(
      expect.arrayContaining([
        "floorCount",
        "buildingHeightOrFloorHeight",
        "budgetMax",
      ]),
    );
  });

  it("is deterministic for the same input", () => {
    const left = evaluateSelection(requirement, [product()]);
    const right = evaluateSelection(requirement, [product()]);
    expect(right).toEqual(left);
  });
});
