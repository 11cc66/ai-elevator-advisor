import { describe, expect, it } from "vitest";

import { MockAIProvider } from "../src/modules/advisor/mock-provider";

describe("MockAIProvider", () => {
  it("extracts old-building requirements without inventing load or speed", async () => {
    const reply = await new MockAIProvider().reply({
      installationScenario: "OLD_BUILDING_ADDITION",
      currentRequirement: {},
      userMessage:
        "住宅旧楼加装，8层，层高约3米，预算40-50万，外装可以考虑，有图纸。",
    });

    expect(reply.provider).toBe("MOCK");
    expect(reply.requirementPatch).toMatchObject({
      buildingUse: "住宅",
      floorCount: 8,
      floorHeight: 3,
      budgetMin: 400_000,
      budgetMax: 500_000,
      externalInstallationAllowed: true,
      drawingStatus: "AVAILABLE_NOT_ANALYZED",
    });
    expect(reply.requirementPatch).not.toHaveProperty("capacityKg");
    expect(reply.requirementPatch).not.toHaveProperty("speedMps");
    expect(reply.requiresProfessionalReview).toBe(true);
  });

  it("asks for missing fields deterministically", async () => {
    const first = await new MockAIProvider().reply({
      installationScenario: "NEW_BUILDING_INSTALLATION",
      currentRequirement: {},
      userMessage: "我想了解新楼安装。",
    });
    const second = await new MockAIProvider().reply({
      installationScenario: "NEW_BUILDING_INSTALLATION",
      currentRequirement: {},
      userMessage: "我想了解新楼安装。",
    });

    expect(first).toEqual(second);
    expect(first.missingFields).toContain("floorCount");
    expect(first.answerText).toContain("Mock AI");
  });
});
