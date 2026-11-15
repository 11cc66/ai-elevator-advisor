import type {
  ExtractionFieldClassification,
  ExtractionFieldStatus,
} from "@prisma/client";

import type { FieldReviewAction } from "@elevator/contracts";

export interface FieldReviewPolicyField {
  fieldClassification: ExtractionFieldClassification | string;
  initialStatus: ExtractionFieldStatus | string;
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
        | "FIELD_CONFIGURATION_INVALID"
        | "FIELD_REVIEW_ACTION_INVALID"
        | "FIELD_INITIAL_STATUS_INVALID"
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
  const initialStatus = field.initialStatus as string;

  if (
    typeof field.customerConfirmable !== "boolean" ||
    typeof field.requiresProfessionalReview !== "boolean"
  ) {
    return {
      allowed: false,
      code: "FIELD_CONFIGURATION_INVALID",
      message: "字段确认配置不完整或类型不正确。",
    };
  }

  if (
    action !== "CONFIRM" &&
    action !== "CORRECT" &&
    action !== "REJECT"
  ) {
    return {
      allowed: false,
      code: "FIELD_REVIEW_ACTION_INVALID",
      message: "字段操作类型无效。",
    };
  }

  if (initialStatus === "INVALIDATED") {
    return {
      allowed: false,
      code: "FIELD_INITIAL_STATUS_INVALID",
      message: "已作废字段不能执行客户操作。",
    };
  }

  if (classification === "PROFESSIONAL") {
    if (
      field.customerConfirmable !== false ||
      field.requiresProfessionalReview !== true
    ) {
      return {
        allowed: false,
        code: "FIELD_CONFIGURATION_INVALID",
        message: "专业工程字段的客户权限或专业核实配置冲突。",
      };
    }

    if (initialStatus !== "PENDING_VERIFICATION") {
      return {
        allowed: false,
        code: "FIELD_INITIAL_STATUS_INVALID",
        message: "专业工程字段的初始状态异常。",
      };
    }

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

  if (field.requiresProfessionalReview) {
    return {
      allowed: false,
      code: "FIELD_CONFIGURATION_INVALID",
      message: "普通资料字段与专业核实要求配置冲突。",
    };
  }

  if (
    initialStatus !== "EXTRACTED" &&
    initialStatus !== "CUSTOMER_CONFIRMED" &&
    initialStatus !== "CUSTOMER_REJECTED"
  ) {
    return {
      allowed: false,
      code: "FIELD_INITIAL_STATUS_INVALID",
      message: "普通资料字段的初始状态异常。",
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
