import { describe, expect, it } from "vitest";

import { validateRequirementForm } from "../src/modules/advisor/form-validation";

describe("validateRequirementForm", () => {
  it("accepts valid optional numeric values", () => {
    const result = validateRequirementForm({
      floorCount: "8",
      floorHeight: "3.1",
      buildingHeight: "24.8",
      budgetMin: "400000",
      budgetMax: "500000",
    });

    expect(result.valid).toBe(true);
    expect(result.values).toEqual({
      floorCount: 8,
      floorHeight: 3.1,
      buildingHeight: 24.8,
      budgetMin: 400000,
      budgetMax: 500000,
    });
  });

  it("rejects non-integer floor counts", () => {
    const result = validateRequirementForm({ floorCount: "8.5" });

    expect(result.valid).toBe(false);
    expect(result.errors.floorCount).toContain("整数");
  });

  it("rejects a budget maximum below the minimum", () => {
    const result = validateRequirementForm({
      budgetMin: "600000",
      budgetMax: "500000",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.budgetMax).toBe(
      "预算上限不能低于预算下限。",
    );
  });

  it("treats a zero budget maximum as missing, matching the server rule", () => {
    const result = validateRequirementForm({
      budgetMin: "0",
      budgetMax: "0",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.budgetMax).toBe("预算上限必须大于 0。");
    expect(result.errors.budgetMin).toBeUndefined();
  });

  it("accepts the maximum supported budget and rejects values above it", () => {
    expect(
      validateRequirementForm({ budgetMax: "1000000000" }).valid,
    ).toBe(true);
    expect(
      validateRequirementForm({ budgetMax: "1000000001" }).errors.budgetMax,
    ).toContain("不能大于");
  });

  it("keeps undefined budgets optional and rejects negative budgets", () => {
    expect(
      validateRequirementForm({
        budgetMin: undefined,
        budgetMax: undefined,
      }).valid,
    ).toBe(true);
    expect(
      validateRequirementForm({ budgetMax: "-1" }).errors.budgetMax,
    ).toBe("预算上限必须大于 0。");
  });

  it("rejects zero or negative dimensions", () => {
    const result = validateRequirementForm({
      floorHeight: "0",
      buildingHeight: "-1",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.floorHeight).toBe("层高必须大于 0。");
    expect(result.errors.buildingHeight).toBe("建筑总高必须大于 0。");
  });

  it("treats empty strings as unspecified optional values", () => {
    const result = validateRequirementForm({
      floorCount: "",
      floorHeight: " ",
      budgetMax: null,
    });

    expect(result.valid).toBe(true);
    expect(result.values).toEqual({});
  });
});
