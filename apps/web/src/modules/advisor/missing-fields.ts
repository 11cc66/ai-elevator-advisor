import type {
  InstallationScenario,
  RequirementDraft,
  RequirementMissingFieldKey,
} from "@elevator/contracts";

export function deriveMissingRequirementFields(
  scenario: InstallationScenario,
  requirement: Partial<RequirementDraft>,
): RequirementMissingFieldKey[] {
  const missing: RequirementMissingFieldKey[] = [];
  if (!requirement.buildingUse) {
    missing.push("buildingUse");
  }
  if (!requirement.floorCount) {
    missing.push("floorCount");
  }
  if (!requirement.floorHeight && !requirement.buildingHeight) {
    missing.push("buildingHeightOrFloorHeight");
  }
  if (!requirement.budgetMax) {
    missing.push("budgetMax");
  }
  if (requirement.externalInstallationAllowed === undefined) {
    missing.push("externalInstallationAllowed");
  }
  if (
    scenario === "EXISTING_ELEVATOR_RENOVATION" &&
    !requirement.existingElevatorDescription
  ) {
    missing.push("existingElevatorDescription");
  }
  if (
    scenario === "NEW_BUILDING_INSTALLATION" &&
    !requirement.drawingStatus
  ) {
    missing.push("drawingStatus");
  }
  return missing;
}
