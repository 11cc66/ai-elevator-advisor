export const SELECTION_ENGINE_VERSION = "1.0.0";

export type InstallationScenario =
  | "OLD_BUILDING_ADDITION"
  | "EXISTING_ELEVATOR_RENOVATION"
  | "NEW_BUILDING_INSTALLATION";

export type VerificationStatus =
  | "VERIFIED"
  | "UNVERIFIED"
  | "DEMO_MOCK"
  | "EXPIRED";

export interface SelectionRequirement {
  installationScenario: InstallationScenario;
  buildingUse?: string;
  buildingType?: string;
  floorCount?: number;
  floorHeight?: number;
  buildingHeight?: number;
  budgetMin?: number;
  budgetMax?: number;
  hardBudget?: boolean;
  externalInstallationAllowed?: boolean;
}

export interface SelectionProduct {
  productId: string;
  manufacturer: string;
  brand: string;
  modelCode: string;
  name: string;
  applicableScenarios: InstallationScenario[];
  verificationStatus: VerificationStatus;
  specification: {
    capacityKg?: number;
    speedMps?: number;
    maxFloors?: number;
    maxTravelM?: number;
    shaftWidthMm?: number;
    shaftDepthMm?: number;
    pitDepthMm?: number;
    overheadMm?: number;
    machineRoomType?: "MRL" | "MR" | "UNKNOWN";
  };
  price?: {
    minimumAmount?: number;
    maximumAmount?: number;
    currency: string;
    validityStatus: "VALID" | "EXPIRED" | "DEMO_MOCK";
    sourceReference?: string;
  };
  sourceReferences: string[];
  specificationVersion?: number;
}

export type BudgetAssessment =
  | "WITHIN_BUDGET"
  | "SLIGHTLY_OVER_BUDGET_IMPROVEMENT"
  | "OVER_BUDGET"
  | "UNKNOWN";

export interface SelectionCandidate {
  product: SelectionProduct;
  budgetAssessment: BudgetAssessment;
  recommendationType: "PRIMARY" | "ALTERNATIVE" | "IMPROVEMENT";
  score: number;
  matchingReasons: string[];
  unmatchedConstraints: string[];
  warnings: string[];
  sourceReferences: string[];
  dataClassification: "DEMO_MOCK" | "OPERATIONAL";
}

export interface SelectionResult {
  status: "COMPLETED" | "NO_VALID_MATCH";
  rulesVersion: string;
  recommendations: SelectionCandidate[];
  alternatives: SelectionCandidate[];
  improvementCandidates: SelectionCandidate[];
  missingInformation: string[];
  riskWarnings: string[];
  professionalReviewRequired: true;
  derivedTargets: {
    minimumCapacityKg?: number;
    minimumSpeedMps?: number;
    estimatedBuildingHeightM?: number;
  };
}

export interface SelectionEngineDescriptor {
  name: "deterministic-selection-engine";
  version: string;
  implemented: true;
}

export function describeSelectionEngine(): SelectionEngineDescriptor {
  return {
    name: "deterministic-selection-engine",
    version: SELECTION_ENGINE_VERSION,
    implemented: true,
  };
}

export function derivePreliminaryTargets(
  requirement: SelectionRequirement,
): SelectionResult["derivedTargets"] {
  if (!requirement.floorCount) {
    return {};
  }

  const minimumCapacityKg =
    requirement.floorCount <= 6
      ? 800
      : requirement.floorCount <= 12
        ? 1000
        : 1150;
  const minimumSpeedMps =
    requirement.floorCount <= 6
      ? 1
      : requirement.floorCount <= 12
        ? 1.5
        : 1.75;
  const estimatedBuildingHeightM =
    requirement.buildingHeight ??
    (requirement.floorHeight
      ? requirement.floorCount * requirement.floorHeight
      : undefined);

  return {
    minimumCapacityKg,
    minimumSpeedMps,
    estimatedBuildingHeightM,
  };
}

function assessBudget(
  requirement: SelectionRequirement,
  product: SelectionProduct,
): BudgetAssessment {
  if (
    requirement.budgetMax === undefined ||
    product.price?.minimumAmount === undefined ||
    product.price.validityStatus === "EXPIRED"
  ) {
    return "UNKNOWN";
  }
  if (product.price.minimumAmount <= requirement.budgetMax) {
    return "WITHIN_BUDGET";
  }
  if (product.price.minimumAmount <= requirement.budgetMax * 1.15) {
    return "SLIGHTLY_OVER_BUDGET_IMPROVEMENT";
  }
  return "OVER_BUDGET";
}

export function evaluateSelection(
  requirement: SelectionRequirement,
  products: readonly SelectionProduct[],
): SelectionResult {
  const floorCount = requirement.floorCount;
  const requiredFloorCount = floorCount ?? 0;
  const missingInformation: string[] = [];
  const riskWarnings = [
    "本结果仅为基于已记录需求的初步建议。",
    "结构、基础、井道、底坑和现场安装条件必须由专业勘察确认。",
  ];

  if (!floorCount) {
    missingInformation.push("floorCount");
  }
  if (
    requirement.buildingHeight === undefined &&
    requirement.floorHeight === undefined
  ) {
    missingInformation.push("buildingHeightOrFloorHeight");
  }
  if (requirement.budgetMax === undefined) {
    missingInformation.push("budgetMax");
  }

  const targets = derivePreliminaryTargets(requirement);
  const accepted: SelectionCandidate[] = [];

  for (const product of products) {
    const warnings: string[] = [];
    const reasons: string[] = [];

    if (
      product.verificationStatus !== "VERIFIED" &&
      product.verificationStatus !== "DEMO_MOCK"
    ) {
      continue;
    }
    if (!product.applicableScenarios.includes(requirement.installationScenario)) {
      continue;
    }
    if (
      targets.minimumCapacityKg === undefined ||
      product.specification.capacityKg === undefined ||
      product.specification.capacityKg < targets.minimumCapacityKg
    ) {
      continue;
    }
    if (
      targets.minimumSpeedMps === undefined ||
      product.specification.speedMps === undefined ||
      product.specification.speedMps < targets.minimumSpeedMps
    ) {
      continue;
    }
    if (
      product.specification.maxFloors === undefined ||
      product.specification.maxFloors < requiredFloorCount
    ) {
      continue;
    }
    if (
      targets.estimatedBuildingHeightM !== undefined &&
      product.specification.maxTravelM !== undefined &&
      product.specification.maxTravelM < targets.estimatedBuildingHeightM
    ) {
      continue;
    }

    const budget = assessBudget(requirement, product);
    if (budget === "OVER_BUDGET" && requirement.hardBudget) {
      continue;
    }
    if (budget === "UNKNOWN") {
      warnings.push("价格缺失、过期或预算待确认，不能作为正式报价依据。");
    } else if (budget === "WITHIN_BUDGET") {
      reasons.push("产品价格下限处于客户参考预算内。");
    } else if (budget === "SLIGHTLY_OVER_BUDGET_IMPROVEMENT") {
      reasons.push("产品略高于参考预算，作为改善候选并需销售确认。");
    }

    reasons.push(
      `载重 ${product.specification.capacityKg} kg，满足初步推导下限。`,
      `速度 ${product.specification.speedMps} m/s，满足初步推导下限。`,
      `最大层数 ${product.specification.maxFloors}，覆盖客户 ${requiredFloorCount} 层。`,
    );
    if (product.verificationStatus === "DEMO_MOCK") {
      warnings.push("该产品为 DEMO_MOCK，不得作为真实采购或工程依据。");
    }

    accepted.push({
      product,
      budgetAssessment: budget,
      recommendationType:
        budget === "SLIGHTLY_OVER_BUDGET_IMPROVEMENT"
          ? "IMPROVEMENT"
          : "PRIMARY",
      score:
        (budget === "WITHIN_BUDGET"
          ? 100
          : budget === "SLIGHTLY_OVER_BUDGET_IMPROVEMENT"
            ? 70
            : 40) +
        (product.specification.maxFloors - requiredFloorCount) * 0.1,
      matchingReasons: reasons,
      unmatchedConstraints: [],
      warnings,
      sourceReferences: [...product.sourceReferences],
      dataClassification:
        product.verificationStatus === "DEMO_MOCK"
          ? "DEMO_MOCK"
          : "OPERATIONAL",
    });
  }

  accepted.sort((left, right) => right.score - left.score);
  const primary = accepted.filter(
    (candidate) =>
      candidate.budgetAssessment === "WITHIN_BUDGET" ||
      candidate.budgetAssessment === "UNKNOWN",
  );
  const improvementCandidates = accepted.filter(
    (candidate) =>
      candidate.budgetAssessment ===
      "SLIGHTLY_OVER_BUDGET_IMPROVEMENT",
  );
  const recommended = primary[0];
  if (recommended) {
    recommended.recommendationType = "PRIMARY";
  }
  for (const candidate of primary.slice(1)) {
    candidate.recommendationType = "ALTERNATIVE";
  }

  return {
    status: accepted.length > 0 ? "COMPLETED" : "NO_VALID_MATCH",
    rulesVersion: SELECTION_ENGINE_VERSION,
    recommendations: recommended ? [recommended] : [],
    alternatives: primary.slice(1),
    improvementCandidates,
    missingInformation,
    riskWarnings,
    professionalReviewRequired: true,
    derivedTargets: targets,
  };
}
