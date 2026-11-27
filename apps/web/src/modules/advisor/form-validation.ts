export type RequirementNumericField =
  | "floorCount"
  | "floorHeight"
  | "buildingHeight"
  | "budgetMin"
  | "budgetMax";

export interface RequirementNumericValues {
  floorCount?: number;
  floorHeight?: number;
  buildingHeight?: number;
  budgetMin?: number;
  budgetMax?: number;
}

export interface RequirementFormValidation {
  values: RequirementNumericValues;
  errors: Partial<Record<RequirementNumericField, string>>;
  valid: boolean;
}

type RawRequirementValues = Partial<
  Record<RequirementNumericField, string | null>
>;

function parseOptionalNumber(input: {
  raw: string | null | undefined;
  label: string;
  min: number;
  max: number;
  integer?: boolean;
  exclusiveMin?: boolean;
}): { value?: number; error?: string } {
  const raw = input.raw?.trim() ?? "";
  if (!raw) {
    return {};
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { error: `${input.label}必须是有效数字。` };
  }
  if (input.integer && !Number.isInteger(value)) {
    return { error: `${input.label}必须是整数。` };
  }
  if (input.exclusiveMin ? value <= input.min : value < input.min) {
    return {
      error: input.exclusiveMin
        ? `${input.label}必须大于 ${input.min}。`
        : `${input.label}不能小于 ${input.min}。`,
    };
  }
  if (value > input.max) {
    return { error: `${input.label}不能大于 ${input.max}。` };
  }
  return { value };
}

export function validateRequirementForm(
  raw: RawRequirementValues,
): RequirementFormValidation {
  const errors: Partial<Record<RequirementNumericField, string>> = {};
  const values: RequirementNumericValues = {};

  const fields: Array<{
    key: RequirementNumericField;
    label: string;
    min: number;
    max: number;
    integer?: boolean;
    exclusiveMin?: boolean;
  }> = [
    {
      key: "floorCount",
      label: "楼层数量",
      min: 1,
      max: 200,
      integer: true,
    },
    {
      key: "floorHeight",
      label: "层高",
      min: 0,
      max: 20,
      exclusiveMin: true,
    },
    {
      key: "buildingHeight",
      label: "建筑总高",
      min: 0,
      max: 1_000,
      exclusiveMin: true,
    },
    {
      key: "budgetMin",
      label: "预算下限",
      min: 0,
      max: 1_000_000_000,
      integer: true,
    },
    {
      key: "budgetMax",
      label: "预算上限",
      min: 0,
      max: 1_000_000_000,
      integer: true,
      exclusiveMin: true,
    },
  ];

  for (const field of fields) {
    const parsed = parseOptionalNumber({
      raw: raw[field.key],
      label: field.label,
      min: field.min,
      max: field.max,
      integer: field.integer,
      exclusiveMin: field.exclusiveMin,
    });
    if (parsed.error) {
      errors[field.key] = parsed.error;
    } else if (parsed.value !== undefined) {
      values[field.key] = parsed.value;
    }
  }

  if (
    values.budgetMin !== undefined &&
    values.budgetMax !== undefined &&
    values.budgetMin > values.budgetMax
  ) {
    errors.budgetMax = "预算上限不能低于预算下限。";
  }

  return {
    values,
    errors,
    valid: Object.keys(errors).length === 0,
  };
}
