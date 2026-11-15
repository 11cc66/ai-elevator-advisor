import { describe, expect, it } from "vitest";

import { fieldReviewInputSchema } from "@elevator/contracts";

import {
  customerFieldActions,
  decideFieldReview,
  deriveEffectiveFieldStatus,
} from "@/modules/files/field-review-policy";

const ordinary = {
  fieldClassification: "ORDINARY" as const,
  initialStatus: "EXTRACTED" as const,
  customerConfirmable: true,
  requiresProfessionalReview: false,
};

const professional = {
  fieldClassification: "PROFESSIONAL" as const,
  initialStatus: "EXTRACTED" as const,
  customerConfirmable: false,
  requiresProfessionalReview: true,
};

describe("Phase 3.6 field review contracts", () => {
  it("requires a value only for corrections", () => {
    expect(
      fieldReviewInputSchema.safeParse({
        action: "CONFIRM",
        expectedReviewSequence: 0,
      }).success,
    ).toBe(true);
    expect(
      fieldReviewInputSchema.safeParse({
        action: "CORRECT",
        correctedRawValue: "新的建筑名称",
        expectedReviewSequence: 0,
      }).success,
    ).toBe(true);
    expect(
      fieldReviewInputSchema.safeParse({
        action: "CORRECT",
        expectedReviewSequence: 0,
      }).success,
    ).toBe(false);
    expect(
      fieldReviewInputSchema.safeParse({
        action: "REJECT",
        correctedRawValue: "不应提交",
        expectedReviewSequence: 0,
      }).success,
    ).toBe(false);
  });
});

describe("Phase 3.6 field review policy", () => {
  it("maps ordinary actions to customer states", () => {
    expect(decideFieldReview(ordinary, "CONFIRM")).toEqual({
      allowed: true,
      statusAfterReview: "CUSTOMER_CONFIRMED",
    });
    expect(decideFieldReview(ordinary, "CORRECT")).toEqual({
      allowed: true,
      statusAfterReview: "CUSTOMER_CONFIRMED",
    });
    expect(decideFieldReview(ordinary, "REJECT")).toEqual({
      allowed: true,
      statusAfterReview: "CUSTOMER_REJECTED",
    });
  });

  it("defaults to deny when ordinary customer confirmation is unavailable", () => {
    expect(
      decideFieldReview(
        { ...ordinary, customerConfirmable: false },
        "CONFIRM",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_NOT_CUSTOMER_CONFIRMABLE",
    });
  });

  it("allows only correction suggestions for professional fields", () => {
    expect(decideFieldReview(professional, "CONFIRM")).toMatchObject({
      allowed: false,
      code: "PROFESSIONAL_FIELD_CONFIRM_FORBIDDEN",
    });
    expect(decideFieldReview(professional, "REJECT")).toMatchObject({
      allowed: false,
      code: "PROFESSIONAL_FIELD_REJECT_FORBIDDEN",
    });
    expect(decideFieldReview(professional, "CORRECT")).toEqual({
      allowed: true,
      statusAfterReview: "PENDING_VERIFICATION",
    });
    expect(customerFieldActions(professional)).toEqual({
      canConfirm: false,
      canCorrect: true,
      canReject: false,
    });
  });

  it("derives effective status independently from review history", () => {
    expect(
      deriveEffectiveFieldStatus({
        fieldClassification: "ORDINARY",
        initialStatus: "EXTRACTED",
      }),
    ).toBe("EXTRACTED");
    expect(
      deriveEffectiveFieldStatus({
        fieldClassification: "ORDINARY",
        initialStatus: "EXTRACTED",
        latestReviewStatus: "CUSTOMER_CONFIRMED",
      }),
    ).toBe("CUSTOMER_CONFIRMED");
    expect(
      deriveEffectiveFieldStatus({
        fieldClassification: "PROFESSIONAL",
        initialStatus: "EXTRACTED",
      }),
    ).toBe("PENDING_VERIFICATION");
  });
});
