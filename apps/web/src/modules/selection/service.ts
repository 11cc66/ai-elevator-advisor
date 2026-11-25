import { evaluateSelection } from "../../../../../packages/selection-engine/src/index";

import { AppError } from "@/server/http/errors";

import {
  createSelectionRun,
  getLatestRequirement,
  listCatalogProducts,
  listSelectionRuns,
} from "../mvp/store";

export async function runPreliminarySelection(input: {
  projectId: string;
  userId: string;
  requirementVersion: number;
}) {
  const requirement = await getLatestRequirement(input.projectId);
  if (!requirement || requirement.version !== input.requirementVersion) {
    throw new AppError(
      "REQUIREMENT_VERSION_CONFLICT",
      "需求版本已变化，请刷新后重新选型。",
      409,
    );
  }
  if (requirement.status !== "CUSTOMER_CONFIRMED") {
    throw new AppError(
      "REQUIREMENT_NOT_CONFIRMED",
      "客户确认需求后才能进行初步选型。",
      409,
    );
  }

  const products = await listCatalogProducts();
  const result = evaluateSelection(
    {
      installationScenario: requirement.installationScenario,
      buildingUse: requirement.fields.buildingUse,
      buildingType: requirement.fields.buildingType,
      floorCount: requirement.fields.floorCount,
      floorHeight: requirement.fields.floorHeight,
      buildingHeight: requirement.fields.buildingHeight,
      budgetMin: requirement.fields.budgetMin,
      budgetMax: requirement.fields.budgetMax,
      hardBudget: false,
    },
    products,
  );
  return createSelectionRun({
    projectId: input.projectId,
    requirementId: requirement.id,
    createdById: input.userId,
    inputSnapshot: {
      requirementId: requirement.id,
      requirementVersion: requirement.version,
      products: products.map((product) => ({
        productId: product.productId,
        specificationVersion: product.specificationVersion,
      })),
    },
    result,
  });
}

export { listSelectionRuns };
