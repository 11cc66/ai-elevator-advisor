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

export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type CreateInstallationUnitInput = z.infer<
  typeof createInstallationUnitSchema
>;
