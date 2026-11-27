import {
  resolveCurrentSelectionRun,
  type SelectionRunCandidate,
} from "./selection-consistency";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface Presentation {
  label: string;
  description: string;
  tone: BadgeTone;
}

export const BUSINESS_SCENARIO_CODES = [
  "OLD_BUILDING_ADDITION",
  "EXISTING_ELEVATOR_RENOVATION",
  "NEW_BUILDING_INSTALLATION",
] as const;

export type BusinessScenarioCode =
  (typeof BUSINESS_SCENARIO_CODES)[number];

const SCENARIOS: Record<string, Presentation> = {
  OLD_BUILDING_ELEVATOR: {
    label: "旧楼加装电梯",
    description: "既有建筑新增电梯，需要结合现场条件开展进一步确认。",
    tone: "info",
  },
  OLD_BUILDING_ADDITION: {
    label: "旧楼加装电梯",
    description: "既有建筑新增电梯，需要结合现场条件开展进一步确认。",
    tone: "info",
  },
  EXISTING_ELEVATOR_RENOVATION: {
    label: "旧电梯更新",
    description: "对现有电梯进行更新或改造，现场设备和井道条件需要核实。",
    tone: "warning",
  },
  NEW_BUILDING_INSTALLATION: {
    label: "新楼安装电梯",
    description: "新建建筑配置电梯，图纸和工程条件仍以专业确认结果为准。",
    tone: "success",
  },
};

const PROJECT_STATUS: Record<string, Presentation> = {
  DRAFT: {
    label: "资料整理中",
    description: "项目正在收集需求与基础资料。",
    tone: "info",
  },
  ACTIVE: {
    label: "事项推进中",
    description: "项目已经进入持续处理阶段。",
    tone: "success",
  },
  ARCHIVED: {
    label: "已归档",
    description: "项目当前处于归档状态，可继续查看历史记录。",
    tone: "neutral",
  },
};

const REQUIREMENT_STATUS: Record<string, Presentation> = {
  DRAFT: {
    label: "需求待确认",
    description: "信息仍在整理，客户确认后才可进行初步方案匹配。",
    tone: "warning",
  },
  CUSTOMER_CONFIRMED: {
    label: "客户已确认",
    description: "客户已确认基础信息，不代表工程条件已经专业审核。",
    tone: "success",
  },
};

const SELECTION_STATUS: Record<string, Presentation> = {
  COMPLETED: {
    label: "初步方案已生成",
    description: "已按当前需求生成初步匹配结果，仍需人工复核。",
    tone: "success",
  },
  NO_VALID_MATCH: {
    label: "暂无可直接匹配方案",
    description: "当前条件下没有可直接展示的候选，需要补充信息或核对产品目录。",
    tone: "warning",
  },
};

const SALES_STATUS: Record<string, Presentation> = {
  PENDING_FOLLOW_UP: {
    label: "待销售跟进",
    description: "项目已进入销售队列，尚未开始联系。",
    tone: "info",
  },
  IN_FOLLOW_UP: {
    label: "销售跟进中",
    description: "销售人员正在核实需求或预算事项。",
    tone: "warning",
  },
  CUSTOMER_RESPONDED: {
    label: "客户已反馈",
    description: "客户已经反馈，等待销售人员继续处理。",
    tone: "success",
  },
  CLOSED: {
    label: "跟进已关闭",
    description: "当前销售跟进已关闭，历史记录仍可查看。",
    tone: "neutral",
  },
};

const RECOMMENDATION_TYPE: Record<string, Presentation> = {
  PRIMARY: {
    label: "首选方案",
    description: "按当前规则优先展示的候选。",
    tone: "success",
  },
  ALTERNATIVE: {
    label: "备选方案",
    description: "满足当前初步条件，可作为比较候选。",
    tone: "info",
  },
  IMPROVEMENT: {
    label: "预算改善候选",
    description: "参考价格略高于当前预算，需要进一步沟通。",
    tone: "warning",
  },
};

const BUDGET_ASSESSMENT: Record<string, Presentation> = {
  WITHIN_BUDGET: {
    label: "参考预算内",
    description: "候选的演示参考价格下限在当前预算内。",
    tone: "success",
  },
  SLIGHTLY_OVER_BUDGET_IMPROVEMENT: {
    label: "略高于参考预算",
    description: "作为改善候选展示，正式价格和范围仍需确认。",
    tone: "warning",
  },
  OVER_BUDGET: {
    label: "超出参考预算",
    description: "当前预算下不宜视为首选，需调整条件或另行确认。",
    tone: "danger",
  },
  UNKNOWN: {
    label: "预算待确认",
    description: "缺少可用价格依据，不能作为正式报价判断。",
    tone: "neutral",
  },
};

const DATA_CLASSIFICATION: Record<string, Presentation> = {
  DEMO_MOCK: {
    label: "演示数据",
    description: "仅用于流程演示，不得作为采购或工程依据。",
    tone: "warning",
  },
  OPERATIONAL: {
    label: "业务数据",
    description: "来自当前业务记录，仍需按业务状态核实。",
    tone: "info",
  },
  VERIFIED: {
    label: "已审核",
    description: "数据已进入审核状态，使用范围仍以业务规则为准。",
    tone: "success",
  },
  UNVERIFIED: {
    label: "待审核",
    description: "数据尚未完成审核，不应作为正式结论。",
    tone: "warning",
  },
  EXPIRED: {
    label: "已过期",
    description: "数据已超过有效期，需要重新核实。",
    tone: "danger",
  },
};

const BUILDING_STATUS: Record<string, Presentation> = {
  DRAFT: {
    label: "资料草稿",
    description: "建筑资料仍在整理。",
    tone: "info",
  },
  ACTIVE: {
    label: "已启用",
    description: "建筑资料当前可用于项目流程。",
    tone: "success",
  },
  ARCHIVED: {
    label: "已归档",
    description: "建筑资料当前处于归档状态。",
    tone: "neutral",
  },
};

const INSTALLATION_UNIT_STATUS: Record<string, Presentation> = {
  PENDING_CONFIRMATION: {
    label: "待确认",
    description: "安装位置或工程条件仍需确认。",
    tone: "warning",
  },
  ACTIVE: {
    label: "已确认",
    description: "安装单元当前处于有效状态。",
    tone: "success",
  },
  ARCHIVED: {
    label: "已归档",
    description: "安装单元当前处于归档状态。",
    tone: "neutral",
  },
};

const ADVISOR_CONVERSATION_STATUS: Record<string, Presentation> = {
  ACTIVE: {
    label: "会话进行中",
    description: "可以继续补充或修改需求。",
    tone: "success",
  },
  CLOSED: {
    label: "会话已结束",
    description: "可继续查看历史消息和需求记录。",
    tone: "neutral",
  },
};

const ADVISOR_PROVIDER: Record<string, Presentation> = {
  MOCK: {
    label: "Mock AI",
    description: "使用确定性演示回复，不调用真实模型。",
    tone: "warning",
  },
  REAL_PROVIDER: {
    label: "真实模型",
    description: "由已配置的真实模型 Provider 提供回复。",
    tone: "info",
  },
};

const MISSING_FIELD_LABELS: Record<string, string> = {
  buildingUse: "建筑用途",
  buildingType: "建筑类型",
  installationScenario: "安装场景",
  floorCount: "楼层数量",
  floorHeight: "层高",
  buildingHeight: "建筑总高",
  buildingHeightOrFloorHeight: "层高或建筑总高",
  budgetMin: "预算下限",
  budgetMax: "预算上限",
  externalInstallationAllowed: "是否允许外装",
  buildingDescription: "建筑情况说明",
  siteConditions: "现场条件",
  drawingStatus: "图纸状态",
  existingElevatorDescription: "原有电梯情况",
  renovationGoal: "改造目标",
};

function fallbackPresentation(kind: string): Presentation {
  return {
    label: `${kind}待确认`,
    description: "当前信息无法对应到已知业务状态，请联系工作人员核实。",
    tone: "neutral",
  };
}

function resolve(
  values: Record<string, Presentation>,
  code: string | null | undefined,
  kind: string,
): Presentation {
  if (!code) {
    return fallbackPresentation(kind);
  }
  return values[code] ?? fallbackPresentation(kind);
}

export function getScenarioPresentation(code: string) {
  return resolve(SCENARIOS, code, "业务场景");
}

export function getProjectStatusPresentation(code: string) {
  return resolve(PROJECT_STATUS, code, "项目状态");
}

export function getProjectRecordStatusLabel(code: string) {
  return `档案记录：${getProjectStatusPresentation(code).label}`;
}

export function getRequirementStatusPresentation(code: string) {
  return resolve(REQUIREMENT_STATUS, code, "需求状态");
}

export function getSelectionStatusPresentation(code: string) {
  return resolve(SELECTION_STATUS, code, "方案状态");
}

export function getSalesStatusPresentation(code: string) {
  return resolve(SALES_STATUS, code, "销售状态");
}

export function getRecommendationTypePresentation(code: string) {
  return resolve(RECOMMENDATION_TYPE, code, "推荐类型");
}

export function getBudgetAssessmentPresentation(code: string) {
  return resolve(BUDGET_ASSESSMENT, code, "预算状态");
}

export function getDataClassificationPresentation(code: string) {
  return resolve(DATA_CLASSIFICATION, code, "数据状态");
}

export function getBuildingStatusPresentation(code: string) {
  return resolve(BUILDING_STATUS, code, "建筑状态");
}

export function getInstallationUnitStatusPresentation(code: string) {
  return resolve(INSTALLATION_UNIT_STATUS, code, "安装单元状态");
}

export function getAdvisorConversationStatusPresentation(code: string) {
  return resolve(ADVISOR_CONVERSATION_STATUS, code, "会话状态");
}

export function getAdvisorProviderPresentation(code: string) {
  return resolve(ADVISOR_PROVIDER, code, "顾问服务");
}

export function getMissingFieldLabels(
  missingFields: readonly string[],
): string[] {
  return missingFields.map(
    (field) => MISSING_FIELD_LABELS[field] ?? "其他待确认信息",
  );
}

export type WorkbenchStepState =
  | "COMPLETE"
  | "CURRENT"
  | "PENDING"
  | "ATTENTION"
  | "RESTRICTED";

export interface WorkbenchStep {
  id: "intake" | "confirmation" | "selection" | "sales";
  title: string;
  state: WorkbenchStepState;
  detail: string;
}

export type WorkbenchActionTarget = "advisor" | "sales" | "project";

export interface WorkbenchNextAction {
  id: string;
  label: string;
  description: string;
  target: WorkbenchActionTarget;
  actionLabel: string | null;
}

export interface ProjectWorkbench {
  steps: WorkbenchStep[];
  completedCount: number;
  nextAction: WorkbenchNextAction;
  completedItems: string[];
  pendingItems: string[];
  professionalReviewNote: string;
}

interface WorkbenchRequirement {
  id: string;
  status: string;
  missingFields: readonly string[];
  version: number;
}

interface WorkbenchSelection extends SelectionRunCandidate {
  result: {
    recommendations: readonly unknown[];
    alternatives: readonly unknown[];
    improvementCandidates: readonly unknown[];
    missingInformation?: readonly string[];
  };
}

interface WorkbenchSalesHandoff {
  status: string;
  updatedAt?: Date;
}

export function buildProjectWorkbench(input: {
  projectStatus: string;
  requirement: WorkbenchRequirement | null;
  selectionRuns: readonly WorkbenchSelection[];
  salesHandoff: WorkbenchSalesHandoff | null;
  salesVisible: boolean;
  canRequestSalesFollowUp: boolean;
}): ProjectWorkbench {
  const requirement = input.requirement;
  const hasRequirement = Boolean(requirement);
  const hasMissingFields = Boolean(requirement?.missingFields.length);
  const requirementConfirmed =
    requirement?.status === "CUSTOMER_CONFIRMED";
  const selectionResolution = resolveCurrentSelectionRun(
    requirement?.id,
    input.selectionRuns,
  );
  const selectionRun =
    selectionResolution.kind === "CURRENT"
      ? selectionResolution.run
      : null;
  const hasCandidateRuns = input.selectionRuns.length > 0;
  const selectionCompleted =
    selectionRun?.status === "COMPLETED";
  const selectionHasNoMatch =
    selectionRun?.status === "NO_VALID_MATCH";
  const selectionNotCompleted =
    Boolean(selectionRun) &&
    !selectionCompleted &&
    !selectionHasNoMatch;
  const selectionNeedsManualReview =
    selectionResolution.kind === "AMBIGUOUS" ||
    selectionResolution.kind === "INVALID_TIMESTAMP";
  const selectionIsStale =
    hasCandidateRuns &&
    Boolean(requirement) &&
    selectionResolution.kind === "NO_MATCH";
  const hasVisibleSalesHandoff =
    input.salesVisible && Boolean(input.salesHandoff);
  const selectionCreatedAt = selectionRun?.createdAt;
  const salesUpdatedAt = input.salesHandoff?.updatedAt;
  const salesNeedsReview =
    hasVisibleSalesHandoff &&
    (!selectionCompleted ||
      (selectionCreatedAt !== undefined &&
        salesUpdatedAt !== undefined &&
        salesUpdatedAt.getTime() < selectionCreatedAt.getTime()));
  const salesClosed = input.salesHandoff?.status === "CLOSED";

  const intakeState: WorkbenchStepState = !hasRequirement
    ? "CURRENT"
    : hasMissingFields
      ? "ATTENTION"
      : "COMPLETE";
  const confirmationState: WorkbenchStepState = requirementConfirmed
    ? "COMPLETE"
    : hasRequirement && !hasMissingFields
      ? "CURRENT"
      : "PENDING";
  const selectionState: WorkbenchStepState = selectionCompleted
    ? "COMPLETE"
    : selectionHasNoMatch
      ? "ATTENTION"
      : selectionNeedsManualReview
        ? "ATTENTION"
        : selectionIsStale
          ? "ATTENTION"
          : selectionNotCompleted
            ? "ATTENTION"
            : requirementConfirmed
              ? "CURRENT"
              : "PENDING";
  const salesState: WorkbenchStepState = !input.salesVisible
    ? "RESTRICTED"
    : salesNeedsReview
      ? "ATTENTION"
      : salesClosed
        ? "COMPLETE"
        : hasVisibleSalesHandoff
          ? "CURRENT"
          : "PENDING";

  const steps: WorkbenchStep[] = [
    {
      id: "intake",
      title: "需求整理",
      state: intakeState,
      detail: !requirement
        ? "尚未建立结构化需求"
        : hasMissingFields
          ? `尚有 ${requirement.missingFields.length} 项信息待补充`
          : requirementConfirmed
            ? `需求 v${requirement.version} 已确认`
            : `需求 v${requirement.version} 已整理`,
    },
    {
      id: "confirmation",
      title: "客户确认",
      state: confirmationState,
      detail: requirementConfirmed
        ? "客户已确认基础信息"
        : hasRequirement && !hasMissingFields
          ? "等待客户确认需求"
          : "信息补充后可提交确认",
    },
    {
      id: "selection",
      title: "初步方案",
      state: selectionState,
      detail: selectionCompleted
        ? "已生成初步匹配结果"
        : selectionHasNoMatch
          ? "当前没有可直接匹配的方案"
          : selectionNeedsManualReview
            ? "选型记录无法唯一排序，需要人工核对"
            : selectionIsStale
              ? "需求已更新，需要重新生成初步方案"
              : selectionNotCompleted
                ? "当前选型未满足完成条件，需要重新核对"
                : requirementConfirmed
                  ? "可以生成初步方案"
                  : "需求确认后可进行匹配",
    },
    {
      id: "sales",
      title: "销售跟进",
      state: salesState,
      detail: !input.salesVisible
        ? "销售进展仅向销售管理权限账号显示"
        : salesNeedsReview
          ? "方案已更新，销售跟进需复核"
          : salesClosed
            ? "当前跟进已关闭"
            : hasVisibleSalesHandoff
              ? getSalesStatusPresentation(
                  input.salesHandoff?.status ?? "",
                ).label
              : selectionCompleted
                ? "可按需提交销售跟进"
                : selectionHasNoMatch
                  ? "先核对匹配条件"
                  : "生成初步方案后可提交跟进",
    },
  ];

  const completedItems: string[] = [];
  const pendingItems: string[] = [];

  if (hasRequirement && !hasMissingFields) {
    completedItems.push("已整理需求信息");
  } else if (!hasRequirement) {
    pendingItems.push("建立需求并补充楼层、预算和现场条件");
  } else {
    pendingItems.push(
      `补充${getMissingFieldLabels(requirement?.missingFields ?? []).join("、")}`,
    );
  }

  if (requirementConfirmed) {
    completedItems.push("客户已确认基础需求");
  } else if (hasRequirement) {
    pendingItems.push("由客户确认当前需求版本");
  }

  if (selectionCompleted) {
    completedItems.push("已生成初步方案");
  } else if (selectionHasNoMatch) {
    pendingItems.push("核对需求、预算或产品目录后重新初步选型");
  } else if (selectionNeedsManualReview) {
    pendingItems.push("人工核对当前需求存在歧义的多条选型记录");
  } else if (selectionIsStale) {
    pendingItems.push("当前需求尚未生成对应的初步方案");
  } else if (selectionNotCompleted) {
    pendingItems.push("当前需求的选型结果未满足完成条件");
  } else if (requirementConfirmed) {
    pendingItems.push("生成初步方案");
  }

  if (
    hasVisibleSalesHandoff &&
    !salesNeedsReview &&
    selectionCompleted
  ) {
    completedItems.push("已提交销售跟进");
  } else if (salesNeedsReview) {
    pendingItems.push("复核销售跟进是否仍然对应当前方案");
  } else if (selectionCompleted) {
    pendingItems.push(
      input.canRequestSalesFollowUp
        ? "按需提交销售交接"
        : "销售跟进信息由有权限的销售人员处理",
    );
  }

  let nextAction: WorkbenchNextAction;
  if (input.projectStatus === "ARCHIVED") {
    nextAction = {
      id: "archived",
      label: "查看历史记录",
      description: "项目已归档，如需继续业务处理，请由工作人员核实恢复方式。",
      target: "project",
      actionLabel: null,
    };
  } else if (!hasRequirement) {
    nextAction = {
      id: "start-requirement",
      label: "开始需求对话",
      description: "通过需求顾问补充项目场景、楼层、预算和现场条件。",
      target: "advisor",
      actionLabel: "开始需求对话",
    };
  } else if (hasMissingFields) {
    nextAction = {
      id: "complete-requirement",
      label: "补充需求信息",
      description: "补齐缺失项后，再提交客户确认。",
      target: "advisor",
      actionLabel: "补充需求信息",
    };
  } else if (!requirementConfirmed) {
    nextAction = {
      id: "confirm-requirement",
      label: "确认需求信息",
      description: "核对当前需求版本，并由客户完成基础信息确认。",
      target: "advisor",
      actionLabel: "确认需求信息",
    };
  } else if (selectionNeedsManualReview) {
    nextAction = {
      id: "review-selection-ambiguity",
      label: "核对当前需求的选型记录",
      description: "当前需求存在无法唯一排序的选型记录，不能自动认定完成状态。",
      target: "project",
      actionLabel: null,
    };
  } else if (selectionIsStale) {
    nextAction = {
      id: "rerun-stale-selection",
      label: "为当前需求重新生成初步方案",
      description: "已有初步方案属于旧需求版本，不能继续用于当前需求。",
      target: "advisor",
      actionLabel: "重新生成初步方案",
    };
  } else if (!selectionRun) {
    nextAction = {
      id: "run-selection",
      label: "生成初步方案",
      description: "使用当前已确认需求运行确定性初步匹配。",
      target: "advisor",
      actionLabel: "生成初步方案",
    };
  } else if (selectionHasNoMatch) {
    nextAction = {
      id: "review-selection-inputs",
      label: "核对匹配条件",
      description: "检查缺失信息、预算条件或演示产品目录后重新匹配。",
      target: "advisor",
      actionLabel: "核对匹配条件",
    };
  } else if (selectionNotCompleted) {
    nextAction = {
      id: "rerun-incomplete-selection",
      label: "重新生成当前需求的初步方案",
      description: "当前需求的选型结果未满足完成条件，不能进入销售后续。",
      target: "advisor",
      actionLabel: "重新生成初步方案",
    };
  } else if (salesNeedsReview) {
    nextAction = {
      id: "review-stale-sales-handoff",
      label: "复核销售跟进",
      description: "方案已更新，现有销售跟进需要由销售人员确认是否仍然有效。",
      target: input.salesVisible ? "sales" : "project",
      actionLabel: input.salesVisible ? "打开销售工作台" : null,
    };
  } else if (!input.salesVisible) {
    nextAction = {
      id: "sales-restricted",
      label: "当前方案已生成",
      description: "销售跟进信息仅向销售管理权限账号显示，可由工作人员继续处理。",
      target: input.canRequestSalesFollowUp ? "sales" : "project",
      actionLabel: input.canRequestSalesFollowUp
        ? "提交销售跟进"
        : null,
    };
  } else if (!hasVisibleSalesHandoff) {
    nextAction = {
      id: "request-sales-follow-up",
      label: "查看方案并按需联系销售",
      description: "方案仅为初步建议，需要人工跟进预算、现场和专业条件。",
      target: "sales",
      actionLabel: input.canRequestSalesFollowUp
        ? "提交销售跟进"
        : null,
    };
  } else if (input.salesHandoff?.status === "PENDING_FOLLOW_UP") {
    nextAction = {
      id: "wait-for-sales",
      label: "等待销售人员联系",
      description: "销售交接已记录，可继续查看方案与后续状态。",
      target: "sales",
      actionLabel: "打开销售工作台",
    };
  } else if (input.salesHandoff?.status === "IN_FOLLOW_UP") {
    nextAction = {
      id: "sales-in-progress",
      label: "销售正在跟进",
      description: "如预算或需求变化，请通过现有需求流程补充。",
      target: "sales",
      actionLabel: "打开销售工作台",
    };
  } else if (input.salesHandoff?.status === "CUSTOMER_RESPONDED") {
    nextAction = {
      id: "sales-response",
      label: "等待销售处理反馈",
      description: "客户反馈已记录，方案和价格仍以正式审核结果为准。",
      target: "sales",
      actionLabel: "打开销售工作台",
    };
  } else {
    nextAction = {
      id: "closed-follow-up",
      label: "查看已关闭的销售记录",
      description: "历史记录仍然保留；如需重新处理，请由工作人员确认后续流程。",
      target: "project",
      actionLabel: null,
    };
  }

  return {
    steps,
    completedCount: steps.filter((step) => step.state === "COMPLETE")
      .length,
    nextAction,
    completedItems,
    pendingItems,
    professionalReviewNote:
      "当前工作台只反映需求、客户确认、初步选型和销售交接记录。现场勘察、专业工程审核与正式报价不在本流程完成范围内。",
  };
}
