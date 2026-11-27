import { describe, expect, it } from "vitest";

import {
  BUSINESS_SCENARIO_CODES,
  buildProjectWorkbench,
  getAdvisorConversationStatusPresentation,
  getAdvisorProviderPresentation,
  getMissingFieldLabels,
  getProjectRecordStatusLabel,
  getProjectStatusPresentation,
  getScenarioPresentation,
} from "../src/modules/workbench/presentation";

const currentRequirement = {
  id: "requirement-current",
  status: "CUSTOMER_CONFIRMED",
  missingFields: [],
  version: 2,
};

const currentSelection = {
  id: "run-current",
  requirementId: currentRequirement.id,
  status: "COMPLETED",
  createdAt: new Date("2026-11-27T02:00:00.000Z"),
  result: {
    recommendations: [{}],
    alternatives: [],
    improvementCandidates: [],
    missingInformation: [],
  },
};

function workbench(
  overrides: Partial<Parameters<typeof buildProjectWorkbench>[0]> = {},
) {
  return buildProjectWorkbench({
    projectStatus: "DRAFT",
    requirement: currentRequirement,
    selectionRuns: [currentSelection],
    salesHandoff: null,
    salesVisible: false,
    canRequestSalesFollowUp: false,
    ...overrides,
  });
}

describe("workbench presentation", () => {
  it("uses customer-readable labels for all supported scenarios", () => {
    expect(BUSINESS_SCENARIO_CODES).toEqual([
      "OLD_BUILDING_ADDITION",
      "EXISTING_ELEVATOR_RENOVATION",
      "NEW_BUILDING_INSTALLATION",
    ]);
    expect(getScenarioPresentation("OLD_BUILDING_ADDITION").label).toBe(
      "旧楼加装电梯",
    );
    expect(
      getScenarioPresentation("EXISTING_ELEVATOR_RENOVATION").label,
    ).toBe("旧电梯更新");
    expect(getScenarioPresentation("NEW_BUILDING_INSTALLATION").label).toBe(
      "新楼安装电梯",
    );
    expect(getScenarioPresentation("UNKNOWN_SCENARIO").label).toBe(
      "业务场景待确认",
    );
  });

  it("does not expose an unknown internal status code", () => {
    const presentation = getProjectStatusPresentation("INTERNAL_ONLY");
    expect(presentation.label).toBe("项目状态待确认");
    expect(presentation.label).not.toContain("INTERNAL_ONLY");
  });

  it("separates project record status from workflow stage", () => {
    expect(getProjectRecordStatusLabel("DRAFT")).toBe(
      "档案记录：资料整理中",
    );
    const result = workbench({
      projectStatus: "DRAFT",
      salesVisible: true,
      salesHandoff: {
        status: "IN_FOLLOW_UP",
        updatedAt: new Date("2026-11-27T03:00:00.000Z"),
      },
    });
    expect(result.nextAction.id).toBe("sales-in-progress");
    expect(getProjectRecordStatusLabel("DRAFT")).not.toContain("销售");
  });

  it("labels mock and real advisor providers without changing their source kind", () => {
    expect(getAdvisorProviderPresentation("MOCK").label).toBe("Mock AI");
    expect(getAdvisorProviderPresentation("REAL_PROVIDER").label).toBe(
      "真实模型",
    );
    expect(getAdvisorConversationStatusPresentation("ACTIVE").label).toBe(
      "会话进行中",
    );
  });

  it("maps known missing field keys to Chinese labels", () => {
    expect(
      getMissingFieldLabels([
        "floorCount",
        "budgetMax",
        "UNRECOGNIZED_KEY",
      ]),
    ).toEqual(["楼层数量", "预算上限", "其他待确认信息"]);
  });

  it("starts with the requirement conversation when no requirement exists", () => {
    const result = workbench({
      requirement: null,
      selectionRuns: [],
    });

    expect(result.completedCount).toBe(0);
    expect(result.nextAction.id).toBe("start-requirement");
    expect(result.steps[0]?.state).toBe("CURRENT");
  });

  it("does not accept a selection when no latest requirement is available", () => {
    const result = workbench({
      requirement: null,
      selectionRuns: [currentSelection],
    });

    expect(result.steps[2]?.state).toBe("PENDING");
    expect(result.nextAction.id).toBe("start-requirement");
    expect(result.completedItems).not.toContain("已生成初步方案");
  });

  it("asks for missing requirement information before confirmation", () => {
    const result = workbench({
      requirement: {
        id: "requirement-draft",
        status: "DRAFT",
        missingFields: ["floorCount", "budgetMax"],
        version: 1,
      },
      selectionRuns: [],
    });

    expect(result.nextAction.id).toBe("complete-requirement");
    expect(result.steps[0]?.state).toBe("ATTENTION");
    expect(result.pendingItems[0]).toContain("楼层数量");
  });

  it("allows preliminary selection only after customer confirmation", () => {
    const result = workbench({ selectionRuns: [] });

    expect(result.nextAction.id).toBe("run-selection");
    expect(result.steps[1]?.state).toBe("COMPLETE");
    expect(result.steps[2]?.state).toBe("CURRENT");
  });

  it("accepts a completed selection linked to the current requirement", () => {
    const result = workbench({ selectionRuns: [currentSelection] });

    expect(result.steps[2]?.state).toBe("COMPLETE");
    expect(result.completedItems).toContain("已生成初步方案");
    expect(result.nextAction.id).not.toBe("rerun-stale-selection");
  });

  it("rejects an old requirement selection and does not advance to sales", () => {
    const result = workbench({
      selectionRuns: [{
        ...currentSelection,
        requirementId: "requirement-old",
      }],
      salesHandoff: {
        status: "IN_FOLLOW_UP",
        updatedAt: new Date("2026-11-27T01:00:00.000Z"),
      },
      salesVisible: true,
    });

    expect(result.steps[2]?.state).toBe("ATTENTION");
    expect(result.completedItems).not.toContain("已生成初步方案");
    expect(result.completedItems).not.toContain("已提交销售跟进");
    expect(result.pendingItems).toContain(
      "当前需求尚未生成对应的初步方案",
    );
    expect(result.nextAction.id).toBe("rerun-stale-selection");
    expect(result.steps[3]?.detail).toBe(
      "方案已更新，销售跟进需复核",
    );
  });

  it("prioritizes confirming a new draft requirement over an old selection", () => {
    const result = workbench({
      requirement: {
        id: "requirement-new",
        status: "DRAFT",
        missingFields: [],
        version: 3,
      },
      selectionRuns: [currentSelection],
    });

    expect(result.steps[1]?.state).toBe("CURRENT");
    expect(result.steps[2]?.state).toBe("ATTENTION");
    expect(result.nextAction.id).toBe("confirm-requirement");
    expect(result.nextAction.id).not.toBe("request-sales-follow-up");
  });

  it("does not treat a selection for an unknown requirement as current", () => {
    const result = workbench({
      selectionRuns: [{
        ...currentSelection,
        requirementId: "requirement-missing",
      }],
    });

    expect(result.steps[2]?.state).toBe("ATTENTION");
    expect(result.nextAction.id).toBe("rerun-stale-selection");
  });

  it("uses the current requirement run even when an old run is newer", () => {
    const result = workbench({
      selectionRuns: [
        {
          ...currentSelection,
          id: "run-old-newer",
          requirementId: "requirement-old",
          createdAt: new Date("2026-11-27T06:00:00.000Z"),
        },
        {
          ...currentSelection,
          id: "run-current-older",
          createdAt: new Date("2026-11-27T01:00:00.000Z"),
        },
      ],
    });

    expect(result.steps[2]?.state).toBe("COMPLETE");
    expect(result.completedItems).toContain("已生成初步方案");
  });

  it("does not advance sales when the current run is not completed", () => {
    const result = workbench({
      selectionRuns: [
        {
          ...currentSelection,
          id: "run-old-completed",
          requirementId: "requirement-old",
          createdAt: new Date("2026-11-27T06:00:00.000Z"),
        },
        {
          ...currentSelection,
          id: "run-current-pending",
          status: "PROCESSING",
          createdAt: new Date("2026-11-27T01:00:00.000Z"),
        },
      ],
      salesVisible: true,
      salesHandoff: {
        status: "IN_FOLLOW_UP",
        updatedAt: new Date("2026-11-27T02:00:00.000Z"),
      },
    });

    expect(result.steps[2]?.state).toBe("ATTENTION");
    expect(result.completedItems).not.toContain("已生成初步方案");
    expect(result.completedItems).not.toContain("已提交销售跟进");
    expect(result.nextAction.id).toBe("rerun-incomplete-selection");
  });

  it("does not choose a completed result when latest run timestamps are ambiguous", () => {
    const timestamp = new Date("2026-11-27T01:00:00.000Z");
    const result = workbench({
      selectionRuns: [
        { ...currentSelection, id: "run-a", createdAt: timestamp },
        { ...currentSelection, id: "run-b", createdAt: timestamp },
      ],
      salesVisible: true,
      salesHandoff: {
        status: "IN_FOLLOW_UP",
        updatedAt: new Date("2026-11-27T02:00:00.000Z"),
      },
    });

    expect(result.steps[2]?.state).toBe("ATTENTION");
    expect(result.completedItems).not.toContain("已生成初步方案");
    expect(result.completedItems).not.toContain("已提交销售跟进");
    expect(result.nextAction.id).toBe("review-selection-ambiguity");
  });

  it("does not treat no-valid-match as a completed selection", () => {
    const result = workbench({
      selectionRuns: [{
        ...currentSelection,
        status: "NO_VALID_MATCH",
        result: {
          recommendations: [],
          alternatives: [],
          improvementCandidates: [],
          missingInformation: ["budgetMax"],
        },
      }],
    });

    expect(result.steps[2]?.state).toBe("ATTENTION");
    expect(result.nextAction.id).toBe("review-selection-inputs");
    expect(result.pendingItems).toContain(
      "核对需求、预算或产品目录后重新初步选型",
    );
    expect(result.pendingItems).not.toContain("按需提交销售交接");
  });

  it("does not expose sales details when the current user lacks sales access", () => {
    const result = workbench({
      salesHandoff: {
        status: "IN_FOLLOW_UP",
        updatedAt: new Date("2026-11-27T03:00:00.000Z"),
      },
      salesVisible: false,
      canRequestSalesFollowUp: false,
    });

    expect(result.steps[3]?.detail).toBe(
      "销售进展仅向销售管理权限账号显示",
    );
    expect(result.steps[3]?.state).toBe("RESTRICTED");
    expect(result.nextAction.id).toBe("sales-restricted");
    expect(result.nextAction.actionLabel).toBeNull();
    expect(result.completedItems).not.toContain("已提交销售跟进");
  });

  it("allows a permitted project user to request sales follow-up without exposing status", () => {
    const result = workbench({
      salesHandoff: null,
      salesVisible: false,
      canRequestSalesFollowUp: true,
    });

    expect(result.nextAction.id).toBe("sales-restricted");
    expect(result.nextAction.target).toBe("sales");
    expect(result.nextAction.actionLabel).toBe("提交销售跟进");
  });

  it("flags a sales handoff older than the current selection for review", () => {
    const result = workbench({
      selectionRuns: [{
        ...currentSelection,
        createdAt: new Date("2026-11-27T04:00:00.000Z"),
      }],
      salesHandoff: {
        status: "IN_FOLLOW_UP",
        updatedAt: new Date("2026-11-27T03:00:00.000Z"),
      },
      salesVisible: true,
    });

    expect(result.steps[3]?.state).toBe("ATTENTION");
    expect(result.completedItems).not.toContain("已提交销售跟进");
    expect(result.nextAction.id).toBe("review-stale-sales-handoff");
    expect(result.nextAction.actionLabel).toBe("打开销售工作台");
  });

  it("shows current sales follow-up state without implying a formal quote", () => {
    const result = workbench({
      salesHandoff: {
        status: "IN_FOLLOW_UP",
        updatedAt: new Date("2026-11-27T05:00:00.000Z"),
      },
      salesVisible: true,
    });

    expect(result.nextAction.id).toBe("sales-in-progress");
    expect(result.steps[3]?.detail).toBe("销售跟进中");
    expect(result.professionalReviewNote).toContain("正式报价");
  });

  it("does not invent workflow progress for archived projects", () => {
    const result = workbench({
      projectStatus: "ARCHIVED",
      requirement: null,
      selectionRuns: [],
    });

    expect(result.nextAction.id).toBe("archived");
    expect(result.completedCount).toBe(0);
  });
});
