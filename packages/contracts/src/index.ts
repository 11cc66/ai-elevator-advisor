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
  projectType: z.literal("OLD_BUILDING_ELEVATOR"),
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

export const FILE_RECOGNITION_QUEUE = "file-recognition";
export const FILE_MAINTENANCE_QUEUE = "file-maintenance";

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
