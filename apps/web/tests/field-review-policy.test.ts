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
  initialStatus: "PENDING_VERIFICATION" as const,
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

  it("fails closed for ordinary fields that still require professional review", () => {
    const conflicting = {
      ...ordinary,
      requiresProfessionalReview: true,
    };

    for (const action of [
      "CONFIRM",
      "CORRECT",
      "REJECT",
    ] as const) {
      expect(decideFieldReview(conflicting, action)).toMatchObject({
        allowed: false,
        code: "FIELD_CONFIGURATION_INVALID",
      });
    }
  });

  it("fails closed for missing or non-boolean configuration", () => {
    expect(
      decideFieldReview(
        {
          ...ordinary,
          requiresProfessionalReview: undefined as never,
        },
        "CONFIRM",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_CONFIGURATION_INVALID",
    });
    expect(
      decideFieldReview(
        {
          ...ordinary,
          customerConfirmable: "true" as never,
        },
        "CORRECT",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_CONFIGURATION_INVALID",
    });
  });

  it("fails closed for unknown classification, status or action", () => {
    expect(
      decideFieldReview(
        { ...ordinary, fieldClassification: "UNKNOWN" },
        "CONFIRM",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_CLASSIFICATION_UNKNOWN",
    });
    expect(
      decideFieldReview(
        { ...ordinary, initialStatus: "UNKNOWN" },
        "CONFIRM",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_INITIAL_STATUS_INVALID",
    });
    expect(
      decideFieldReview(
        ordinary,
        "UNKNOWN" as never,
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_REVIEW_ACTION_INVALID",
    });
  });

  it("fails closed for abnormal ordinary initial states", () => {
    for (const initialStatus of [
      "PENDING_VERIFICATION",
      "INVALIDATED",
    ] as const) {
      for (const action of [
        "CONFIRM",
        "CORRECT",
        "REJECT",
      ] as const) {
        expect(
          decideFieldReview(
            { ...ordinary, initialStatus },
            action,
          ),
        ).toMatchObject({
          allowed: false,
          code: "FIELD_INITIAL_STATUS_INVALID",
        });
      }
    }
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

  it("does not reactivate invalidated or config-conflicting professional fields", () => {
    expect(
      decideFieldReview(
        { ...professional, initialStatus: "INVALIDATED" },
        "CORRECT",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_INITIAL_STATUS_INVALID",
    });
    expect(
      decideFieldReview(
        {
          ...professional,
          customerConfirmable: true,
        },
        "CORRECT",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_CONFIGURATION_INVALID",
    });
    expect(
      decideFieldReview(
        {
          ...professional,
          requiresProfessionalReview: false,
        },
        "CORRECT",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_CONFIGURATION_INVALID",
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
