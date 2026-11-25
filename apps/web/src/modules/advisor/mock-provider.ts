import type {
  InstallationScenario,
  RequirementDraft,
  RequirementMissingFieldKey,
} from "@elevator/contracts";

import { deriveMissingRequirementFields } from "./missing-fields";

export interface AdvisorReply {
  answerText: string;
  requirementPatch: Partial<RequirementDraft>;
  missingFields: RequirementMissingFieldKey[];
  nextQuestions: string[];
  provider: "MOCK";
  requiresProfessionalReview: true;
}

export interface MockAdvisorInput {
  installationScenario: InstallationScenario;
  currentRequirement: Partial<RequirementDraft>;
  userMessage: string;
}

function parseChineseNumber(value: string): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function extractPatch(input: MockAdvisorInput): Partial<RequirementDraft> {
  const message = input.userMessage;
  const patch: Partial<RequirementDraft> = {
    installationScenario: input.installationScenario,
  };
  const usage = message.match(/(住宅|办公|商业|酒店|医院|学校)/);
  if (usage?.[1]) {
    patch.buildingUse = usage[1];
  }

  const floors = message.match(/(\d+)\s*层/);
  if (floors?.[1]) {
    patch.floorCount = parseChineseNumber(floors[1]);
  }

  const floorHeight = message.match(
    /层高(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*米/,
  );
  if (floorHeight?.[1]) {
    patch.floorHeight = parseChineseNumber(floorHeight[1]);
  }

  const buildingHeight = message.match(
    /(?:建筑高度|总高)(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*米/,
  );
  if (buildingHeight?.[1]) {
    patch.buildingHeight = parseChineseNumber(buildingHeight[1]);
  }

  const budgetRange = message.match(
    /预算(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*[-至到]\s*(\d+(?:\.\d+)?)\s*万/,
  );
  if (budgetRange?.[1] && budgetRange[2]) {
    const minimum = parseChineseNumber(budgetRange[1]);
    const maximum = parseChineseNumber(budgetRange[2]);
    if (minimum !== undefined) {
      patch.budgetMin = Math.round(minimum * 10_000);
    }
    if (maximum !== undefined) {
      patch.budgetMax = Math.round(maximum * 10_000);
    }
  } else {
    const budget = message.match(
      /预算(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*万/,
    );
    if (budget?.[1]) {
      const amount = parseChineseNumber(budget[1]);
      if (amount !== undefined) {
        patch.budgetMax = Math.round(amount * 10_000);
      }
    }
  }

  if (/外装/.test(message)) {
    if (/(?:可以|允许|可行)/.test(message)) {
      patch.externalInstallationAllowed = true;
    } else if (/(?:不可以|不允许|不可行)/.test(message)) {
      patch.externalInstallationAllowed = false;
    }
  }

  if (/图纸/.test(message)) {
    patch.drawingStatus = "AVAILABLE_NOT_ANALYZED";
  }

  if (input.installationScenario === "EXISTING_ELEVATOR_RENOVATION") {
    if (/(?:旧梯|原有电梯|现电梯)/.test(message)) {
      patch.existingElevatorDescription = message.slice(0, 2_000);
    }
    if (/(?:改造|更新|更换)/.test(message)) {
      patch.renovationGoal = message.slice(0, 2_000);
    }
  }

  return patch;
}

const questions: Partial<Record<RequirementMissingFieldKey, string>> = {
  buildingUse: "这栋建筑主要用于住宅、办公、商业还是其他用途？",
  floorCount: "建筑大约有多少层？",
  buildingHeightOrFloorHeight: "每层层高或建筑总高度大约是多少？",
  budgetMax: "客户期望的设备与安装总预算范围大约是多少？",
  externalInstallationAllowed: "建筑外部是否允许设置井道或相关外装结构？",
  existingElevatorDescription: "现有电梯的载重、速度和已使用年限大概是什么情况？",
  drawingStatus: "是否有可用于初步分析的建筑或电梯图纸？",
};

export class MockAIProvider {
  readonly kind = "MOCK" as const;

  async reply(input: MockAdvisorInput): Promise<AdvisorReply> {
    const patch = extractPatch(input);
    const merged = {
      ...input.currentRequirement,
      ...patch,
      missingFields: [],
    };
    const missing = deriveMissingRequirementFields(
      input.installationScenario,
      merged,
    );
    const answeredCount =
      Object.keys(patch).length - 1;
    const acknowledgements =
      answeredCount > 0
        ? `已记录 ${answeredCount} 项需求信息。`
        : "我已收到，但还没有识别出新的结构化字段。";
    const limitation =
      "这是 Mock AI 的确定性演示回复，不代表真实模型判断。";
    const question = missing[0]
      ? `为了继续，请补充：${questions[missing[0]] ?? missing[0]}`
      : "需求信息已基本齐全，请核对结构化需求并确认。";

    return {
      answerText: `${acknowledgements}${question}${limitation}`,
      requirementPatch: patch,
      missingFields: missing,
      nextQuestions: missing.slice(0, 3).map((field) => questions[field] ?? field),
      provider: "MOCK",
      requiresProfessionalReview: true,
    };
  }
}
