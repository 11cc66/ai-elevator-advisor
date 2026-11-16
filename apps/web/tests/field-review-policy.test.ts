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
  currentStatus: "EXTRACTED" as const,
  customerConfirmable: true,
  requiresProfessionalReview: false,
};

const professional = {
  fieldClassification: "PROFESSIONAL" as const,
  initialStatus: "PENDING_VERIFICATION" as const,
  currentStatus: "PENDING_VERIFICATION" as const,
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
        { ...ordinary, currentStatus: "UNKNOWN" },
        "CONFIRM",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_CURRENT_STATUS_INVALID",
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

  it("fails closed for abnormal ordinary current states", () => {
    for (const currentStatus of [
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
            { ...ordinary, currentStatus },
            action,
          ),
        ).toMatchObject({
          allowed: false,
          code: "FIELD_CURRENT_STATUS_INVALID",
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
        { ...professional, currentStatus: "INVALIDATED" },
        "CORRECT",
      ),
    ).toMatchObject({
      allowed: false,
      code: "FIELD_CURRENT_STATUS_INVALID",
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

  it("applies ordinary transitions from the latest review state", () => {
    const confirmed = {
      ...ordinary,
      initialStatus: "EXTRACTED" as const,
      currentStatus: "CUSTOMER_CONFIRMED" as const,
    };
    expect(decideFieldReview(confirmed, "CONFIRM")).toMatchObject({
      allowed: false,
      code: "FIELD_REVIEW_NO_STATE_CHANGE",
    });
    expect(decideFieldReview(confirmed, "CORRECT")).toEqual({
      allowed: true,
      statusAfterReview: "CUSTOMER_CONFIRMED",
    });
    expect(decideFieldReview(confirmed, "REJECT")).toEqual({
      allowed: true,
      statusAfterReview: "CUSTOMER_REJECTED",
    });

    const rejected = {
      ...ordinary,
      initialStatus: "EXTRACTED" as const,
      currentStatus: "CUSTOMER_REJECTED" as const,
    };
    expect(decideFieldReview(rejected, "CONFIRM")).toEqual({
      allowed: true,
      statusAfterReview: "CUSTOMER_CONFIRMED",
    });
    expect(decideFieldReview(rejected, "CORRECT")).toEqual({
      allowed: true,
      statusAfterReview: "CUSTOMER_CONFIRMED",
    });
    expect(decideFieldReview(rejected, "REJECT")).toMatchObject({
      allowed: false,
      code: "FIELD_REVIEW_NO_STATE_CHANGE",
    });
  });

  it("allows repeated corrections for ordinary and professional fields", () => {
    expect(
      decideFieldReview(
        {
          ...ordinary,
          currentStatus: "CUSTOMER_CONFIRMED",
        },
        "CORRECT",
      ),
    ).toEqual({
      allowed: true,
      statusAfterReview: "CUSTOMER_CONFIRMED",
    });
    expect(
      decideFieldReview(professional, "CORRECT"),
    ).toEqual({
      allowed: true,
      statusAfterReview: "PENDING_VERIFICATION",
    });
  });

  it("keeps ordinary fields without customer confirmation inert", () => {
    for (const field of [
      {
        ...ordinary,
        customerConfirmable: false,
        requiresProfessionalReview: false,
      },
      {
        ...ordinary,
        customerConfirmable: false,
        requiresProfessionalReview: true,
      },
    ]) {
      for (const action of [
        "CONFIRM",
        "CORRECT",
        "REJECT",
      ] as const) {
        expect(decideFieldReview(field, action).allowed).toBe(false);
      }
    }
  });
});
