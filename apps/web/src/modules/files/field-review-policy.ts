import type {
  ExtractionFieldClassification,
  ExtractionFieldStatus,
} from "@prisma/client";

import type { FieldReviewAction } from "@elevator/contracts";

export interface FieldReviewPolicyField {
  fieldClassification: ExtractionFieldClassification;
  initialStatus: ExtractionFieldStatus;
  customerConfirmable: boolean;
  requiresProfessionalReview: boolean;
}

export type FieldReviewPolicyDecision =
  | {
      allowed: true;
      statusAfterReview: ExtractionFieldStatus;
    }
  | {
      allowed: false;
      code:
        | "FIELD_CLASSIFICATION_UNKNOWN"
        | "FIELD_NOT_CUSTOMER_CONFIRMABLE"
        | "PROFESSIONAL_FIELD_CONFIRM_FORBIDDEN"
        | "PROFESSIONAL_FIELD_REJECT_FORBIDDEN";
      message: string;
    };

export function decideFieldReview(
  field: FieldReviewPolicyField,
  action: FieldReviewAction,
): FieldReviewPolicyDecision {
  const classification = field.fieldClassification as string;

  if (classification === "PROFESSIONAL") {
    if (action === "CORRECT") {
      return {
        allowed: true,
        statusAfterReview: "PENDING_VERIFICATION",
      };
    }

    return action === "CONFIRM"
      ? {
          allowed: false,
          code: "PROFESSIONAL_FIELD_CONFIRM_FORBIDDEN",
          message: "专业工程字段不能由客户确认。",
        }
      : {
          allowed: false,
          code: "PROFESSIONAL_FIELD_REJECT_FORBIDDEN",
          message: "专业工程字段不能由客户拒绝，请提交修正建议。",
        };
  }

  if (classification !== "ORDINARY") {
    return {
      allowed: false,
      code: "FIELD_CLASSIFICATION_UNKNOWN",
      message: "字段分类无法确认，不能由客户确认。",
    };
  }

  if (!field.customerConfirmable) {
    return {
      allowed: false,
      code: "FIELD_NOT_CUSTOMER_CONFIRMABLE",
      message: "该字段未开放客户确认。",
    };
  }

  return {
    allowed: true,
    statusAfterReview:
      action === "REJECT" ? "CUSTOMER_REJECTED" : "CUSTOMER_CONFIRMED",
  };
}

export function deriveEffectiveFieldStatus(input: {
  fieldClassification: ExtractionFieldClassification;
  initialStatus: ExtractionFieldStatus;
  latestReviewStatus?: ExtractionFieldStatus | null;
}): ExtractionFieldStatus {
  if (input.fieldClassification === "PROFESSIONAL") {
    return input.latestReviewStatus === "INVALIDATED" ||
      (!input.latestReviewStatus && input.initialStatus === "INVALIDATED")
      ? "INVALIDATED"
      : "PENDING_VERIFICATION";
  }

  return input.latestReviewStatus ?? input.initialStatus;
}

export function customerFieldActions(field: FieldReviewPolicyField) {
  return {
    canConfirm: decideFieldReview(field, "CONFIRM").allowed,
    canCorrect: decideFieldReview(field, "CORRECT").allowed,
    canReject: decideFieldReview(field, "REJECT").allowed,
  };
}
