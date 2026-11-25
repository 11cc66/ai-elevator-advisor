import { z } from "zod";

export const healthStatusSchema = z.enum(["ok", "degraded"]);

export const healthCheckSchema = z.object({
  status: healthStatusSchema,
  service: z.literal("web"),
  timestamp: z.string().datetime({ offset: true }),
  durationMs: z.number().int().nonnegative(),
  checks: z.object({
    database: z.enum(["ok", "unavailable"]),
  }),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1),
    timestamp: z.string().datetime({ offset: true }),
  }),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthCheck = z.infer<typeof healthCheckSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

export const loginCredentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "账号至少需要 3 个字符")
    .max(64, "账号不能超过 64 个字符")
    .regex(/^[A-Za-z0-9_]+$/, "账号只能包含字母、数字和下划线"),
  password: z.string().min(1, "请输入密码").max(128, "密码长度无效"),
});

export const createCustomerSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(1, "请输入客户名称")
    .max(160, "客户名称不能超过 160 个字符"),
  contactName: z
    .string()
    .trim()
    .min(1, "请输入联系人")
    .max(120, "联系人不能超过 120 个字符"),
  contactPhone: z
    .string()
    .trim()
    .max(40, "联系电话不能超过 40 个字符")
    .optional()
    .transform((value) => value || undefined),
});

export const createProjectSchema = z.object({
  customerId: z.string().min(1, "请选择客户"),
  name: z
    .string()
    .trim()
    .min(1, "请输入项目名称")
    .max(160, "项目名称不能超过 160 个字符"),
  address: z
    .string()
    .trim()
    .min(1, "请输入项目地址")
    .max(300, "项目地址不能超过 300 个字符"),
  projectType: z.enum([
    "OLD_BUILDING_ELEVATOR",
    "OLD_BUILDING_ADDITION",
    "EXISTING_ELEVATOR_RENOVATION",
    "NEW_BUILDING_INSTALLATION",
  ]),
});

export const createBuildingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入建筑名称")
    .max(160, "建筑名称不能超过 160 个字符"),
  usageType: z
    .string()
    .trim()
    .max(80, "建筑用途不能超过 80 个字符")
    .optional()
    .transform((value) => value || undefined),
  addressDetail: z
    .string()
    .trim()
    .max(300, "建筑地址不能超过 300 个字符")
    .optional()
    .transform((value) => value || undefined),
});

export const createInstallationUnitSchema = z.object({
  intendedLocation: z
    .string()
    .trim()
    .max(200, "拟安装位置不能超过 200 个字符")
    .optional()
    .transform((value) => value || undefined),
});

export const idSchema = z.string().min(1);

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const uploadIntentSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "请输入文件名称")
    .max(255, "文件名称不能超过 255 个字符"),
  originalFilename: z
    .string()
    .trim()
    .min(1, "缺少原始文件名")
    .max(255, "原始文件名不能超过 255 个字符"),
  declaredMimeType: z.enum([
    "application/pdf",
    "image/jpeg",
    "image/png",
  ]),
  declaredSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, "文件不能超过 20 MiB"),
  buildingId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  installationUnitId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  existingFileId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
});

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type CreateInstallationUnitInput = z.infer<
  typeof createInstallationUnitSchema
>;
export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;

export const fieldReviewActionSchema = z.enum([
  "CONFIRM",
  "CORRECT",
  "REJECT",
]);

export const fieldReviewInputSchema = z
  .object({
    action: fieldReviewActionSchema,
    correctedRawValue: z.json().optional(),
    note: z
      .string()
      .trim()
      .max(1_000, "备注不能超过 1000 个字符")
      .optional()
      .transform((value) => value || undefined)
      .optional(),
    expectedReviewSequence: z
      .number()
      .int()
      .min(0, "识别字段历史序号无效"),
  })
  .superRefine((value, context) => {
    if (
      value.action === "CORRECT" &&
      (value.correctedRawValue === undefined ||
        value.correctedRawValue === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["correctedRawValue"],
        message: "更正字段时必须提供修正值",
      });
    }

    if (
      value.action !== "CORRECT" &&
      value.correctedRawValue !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["correctedRawValue"],
        message: "只有更正操作可以提交修正值",
      });
    }
  });

export type FieldReviewAction = z.infer<
  typeof fieldReviewActionSchema
>;
export type FieldReviewInput = z.infer<
  typeof fieldReviewInputSchema
>;

export const FILE_RECOGNITION_QUEUE = "file-recognition";
export const FILE_MAINTENANCE_QUEUE = "file-maintenance";

export const TEST_DATABASE_NAME = "elevator_advisor_test";
export const TEST_DATABASE_ROLE = "elevator_test_app";

export function isStrictTestRuntime(input: {
  nodeEnvironment: string | undefined;
  fileAccessMode: "enforce" | "test";
  databaseName: string;
  databaseRole: string;
}): boolean {
  return (
    input.nodeEnvironment === "test" &&
    input.fileAccessMode === "test" &&
    input.databaseName === TEST_DATABASE_NAME &&
    input.databaseRole === TEST_DATABASE_ROLE
  );
}

export function isVerifiedTestRuntime(input: {
  nodeEnvironment: string | undefined;
  fileAccessMode: "enforce" | "test";
  databaseName: string;
  databaseRole: string;
  databaseMarker: unknown;
  expectedDatabaseMarker: string | undefined;
}): boolean {
  return (
    isStrictTestRuntime(input) &&
    typeof input.expectedDatabaseMarker === "string" &&
    input.expectedDatabaseMarker.length > 0 &&
    input.databaseMarker === input.expectedDatabaseMarker
  );
}

export const FILE_PROCESSING_RETRY_DEFAULTS = {
  maxAttempts: 3,
  retryDelaySeconds: 5,
  retryDelayMaxSeconds: 60,
  jobExpireSeconds: 180,
} as const;

export interface FileProcessingRetryPolicy {
  maxAttempts: number;
  retryDelaySeconds: number;
  retryDelayMaxSeconds: number;
  jobExpireSeconds: number;
}

export function buildFileProcessingRetryOptions(
  policy: FileProcessingRetryPolicy,
) {
  const maxAttempts = Math.max(1, Math.floor(policy.maxAttempts));
  const retryDelaySeconds = Math.max(
    1,
    Math.floor(policy.retryDelaySeconds),
  );
  const retryDelayMaxSeconds = Math.max(
    retryDelaySeconds,
    Math.floor(policy.retryDelayMaxSeconds),
  );

  return {
    retryLimit: Math.max(0, maxAttempts - 1),
    retryDelay: retryDelaySeconds,
    retryBackoff: true,
    retryDelayMax: retryDelayMaxSeconds,
    expireInSeconds: Math.max(
      1,
      Math.floor(policy.jobExpireSeconds),
    ),
  };
}

export const fileRecognitionJobSchema = z.object({
  extractionId: z.string().min(1),
  fileVersionId: z.string().min(1),
  requestedByUserId: z.string().min(1),
  trigger: z.literal("UPLOAD"),
});

export type FileRecognitionJob = z.infer<
  typeof fileRecognitionJobSchema
>;

export const installationScenarioSchema = z.enum([
  "OLD_BUILDING_ADDITION",
  "EXISTING_ELEVATOR_RENOVATION",
  "NEW_BUILDING_INSTALLATION",
]);

export const advisorProviderKindSchema = z.enum([
  "MOCK",
  "REAL_PROVIDER",
]);

export const advisorMessageRoleSchema = z.enum([
  "USER",
  "ASSISTANT",
  "SYSTEM",
]);

export const requirementFieldKeys = [
  "buildingUse",
  "buildingType",
  "installationScenario",
  "floorCount",
  "floorHeight",
  "buildingHeight",
  "budgetMin",
  "budgetMax",
  "externalInstallationAllowed",
  "buildingDescription",
  "siteConditions",
  "drawingStatus",
  "existingElevatorDescription",
  "renovationGoal",
] as const;

export const requirementFieldKeySchema = z.enum(requirementFieldKeys);

export const requirementMissingFieldKeys = [
  ...requirementFieldKeys,
  "buildingHeightOrFloorHeight",
] as const;

export const requirementMissingFieldKeySchema = z.enum(
  requirementMissingFieldKeys,
);

export const requirementDraftSchema = z.object({
  installationScenario: installationScenarioSchema,
  buildingUse: z.string().trim().max(80).optional(),
  buildingType: z.string().trim().max(80).optional(),
  floorCount: z.number().int().min(1).max(200).optional(),
  floorHeight: z.number().positive().max(20).optional(),
  buildingHeight: z.number().positive().max(1000).optional(),
  budgetMin: z.number().int().nonnegative().max(1_000_000_000).optional(),
  budgetMax: z.number().int().nonnegative().max(1_000_000_000).optional(),
  externalInstallationAllowed: z.boolean().optional(),
  buildingDescription: z.string().trim().max(4_000).optional(),
  siteConditions: z.string().trim().max(4_000).optional(),
  drawingStatus: z.enum([
    "NONE",
    "AVAILABLE_NOT_ANALYZED",
    "ANALYSIS_UNAVAILABLE",
  ]).optional(),
  existingElevatorDescription: z.string().trim().max(4_000).optional(),
  renovationGoal: z.string().trim().max(2_000).optional(),
  fieldSources: z.record(z.string(), z.string()).optional(),
  missingFields: z.array(requirementMissingFieldKeySchema).default([]),
  professionalReviewRequired: z.boolean().default(true),
});

export const advisorCreateSchema = z.object({
  installationScenario: installationScenarioSchema,
});

export const advisorMessageRequestSchema = z.object({
  content: z.string().trim().min(1).max(4_000),
});

export const requirementUpdateSchema = requirementDraftSchema
  .omit({ missingFields: true, professionalReviewRequired: true })
  .partial()
  .extend({
    installationScenario: installationScenarioSchema.optional(),
  });

export const requirementConfirmSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const mvpProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(300),
  installationScenario: installationScenarioSchema,
});

export const productSpecSchema = z.object({
  capacityKg: z.number().int().positive().max(100_000).optional(),
  speedMps: z.number().positive().max(20).optional(),
  maxFloors: z.number().int().positive().max(200).optional(),
  maxTravelM: z.number().positive().max(1_000).optional(),
  shaftWidthMm: z.number().int().positive().max(20_000).optional(),
  shaftDepthMm: z.number().int().positive().max(20_000).optional(),
  pitDepthMm: z.number().int().positive().max(20_000).optional(),
  overheadMm: z.number().int().positive().max(20_000).optional(),
  doorConfiguration: z.string().trim().max(100).optional(),
  machineRoomType: z.enum(["MRL", "MR", "UNKNOWN"]).default("UNKNOWN"),
});

export const productPriceSchema = z
  .object({
    minimumAmount: z.number().int().nonnegative().max(1_000_000_000).optional(),
    maximumAmount: z.number().int().nonnegative().max(1_000_000_000).optional(),
    currency: z.string().trim().min(3).max(8).default("CNY"),
    region: z.string().trim().min(1).max(80).default("DEMO"),
    validityStatus: z.enum(["DEMO_MOCK", "VALID", "EXPIRED"]),
    sourceReference: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.minimumAmount !== undefined &&
      value.maximumAmount !== undefined &&
      value.minimumAmount > value.maximumAmount
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximumAmount"],
        message: "最高价格不能低于最低价格。",
      });
    }
  });

function validateCatalogProvenance(
  value: {
    verificationStatus: "DEMO_MOCK" | "UNVERIFIED" | "VERIFIED" | "EXPIRED";
    sourceReference?: string;
    price?: {
      validityStatus: "DEMO_MOCK" | "VALID" | "EXPIRED";
      sourceReference?: string;
    };
  },
  context: z.RefinementCtx,
): void {
  if (value.verificationStatus === "VERIFIED" && !value.sourceReference) {
    context.addIssue({
      code: "custom",
      path: ["sourceReference"],
      message: "已审核产品必须提供来源。",
    });
  }
  if (
    value.price?.validityStatus === "VALID" &&
    !value.price.sourceReference
  ) {
    context.addIssue({
      code: "custom",
      path: ["price", "sourceReference"],
      message: "有效价格必须提供来源。",
    });
  }
}

export const productCreateSchema = z
  .object({
    manufacturerName: z.string().trim().min(1).max(160),
    brandName: z.string().trim().min(1).max(120),
    modelCode: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4_000).optional(),
    applicableScenarios: z
      .array(installationScenarioSchema)
      .min(1)
      .max(3),
    verificationStatus: z.enum([
      "DEMO_MOCK",
      "UNVERIFIED",
      "VERIFIED",
      "EXPIRED",
    ]),
    sourceReference: z.string().trim().max(500).optional(),
    specification: productSpecSchema,
    price: productPriceSchema.optional(),
  })
  .superRefine(validateCatalogProvenance);

export const productUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4_000).optional(),
    applicableScenarios: z.array(installationScenarioSchema).min(1).max(3),
    verificationStatus: z.enum([
      "DEMO_MOCK",
      "UNVERIFIED",
      "VERIFIED",
      "EXPIRED",
    ]),
    sourceReference: z.string().trim().max(500).optional(),
    specification: productSpecSchema,
    price: productPriceSchema.optional(),
  })
  .superRefine(validateCatalogProvenance);

export const selectionRequestSchema = z.object({
  requirementVersion: z.number().int().positive(),
});

export const salesHandoffCreateSchema = z.object({
  summary: z.string().trim().min(1).max(4_000),
  budgetConcern: z.string().trim().max(2_000).optional(),
});

export const salesFollowUpSchema = z.object({
  status: z.enum([
    "PENDING_FOLLOW_UP",
    "IN_FOLLOW_UP",
    "CUSTOMER_RESPONDED",
    "CLOSED",
  ]),
  contactStatus: z.string().trim().min(1).max(80),
  note: z.string().trim().min(1).max(4_000),
});

export type InstallationScenario = z.infer<
  typeof installationScenarioSchema
>;
export type RequirementDraft = z.infer<typeof requirementDraftSchema>;
export type RequirementMissingFieldKey = z.infer<
  typeof requirementMissingFieldKeySchema
>;
export type AdvisorMessageRequest = z.infer<
  typeof advisorMessageRequestSchema
>;
export type RequirementUpdate = z.infer<typeof requirementUpdateSchema>;
export type MvpProjectCreateInput = z.infer<
  typeof mvpProjectCreateSchema
>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductSpecInput = z.infer<typeof productSpecSchema>;
export type ProductPriceInput = z.infer<typeof productPriceSchema>;
export type SalesHandoffCreateInput = z.infer<
  typeof salesHandoffCreateSchema
>;
export type SalesFollowUpInput = z.infer<typeof salesFollowUpSchema>;
