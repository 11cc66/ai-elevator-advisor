import { describe, expect, it } from "vitest";

import { deriveMissingRequirementFields } from "../src/modules/advisor/missing-fields";

describe("deriveMissingRequirementFields", () => {
  it("recomputes fields after manual customer edits", () => {
    expect(
      deriveMissingRequirementFields("OLD_BUILDING_ADDITION", {
        buildingUse: "住宅",
        floorCount: 8,
        floorHeight: 3,
        budgetMax: 500_000,
        externalInstallationAllowed: true,
      }),
    ).toEqual([]);
  });

  it("keeps scenario-specific professional inputs explicit", () => {
    expect(
      deriveMissingRequirementFields("EXISTING_ELEVATOR_RENOVATION", {
        buildingUse: "办公",
        floorCount: 10,
        buildingHeight: 35,
        budgetMax: 700_000,
        externalInstallationAllowed: false,
      }),
    ).toEqual(["existingElevatorDescription"]);
    expect(
      deriveMissingRequirementFields("NEW_BUILDING_INSTALLATION", {
        buildingUse: "学校",
        floorCount: 12,
        floorHeight: 3,
        budgetMax: 550_000,
        externalInstallationAllowed: true,
      }),
    ).toEqual(["drawingStatus"]);
  });
});
