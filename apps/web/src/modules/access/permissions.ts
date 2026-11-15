export const PERMISSIONS = {
  CUSTOMER_READ: "customer.read",
  CUSTOMER_MANAGE: "customer.manage",
  PROJECT_READ: "project.read",
  PROJECT_MANAGE: "project.manage",
  AUDIT_READ: "audit.read",
  FILE_READ: "file.read",
  FILE_UPLOAD: "file.upload",
  FILE_PROCESS: "file.process",
  FILE_CONFIRM: "file.confirm",
  FILE_UNSCANNED_TEST_ACCESS: "file.unscanned.test_access",
} as const;

export type PermissionCode =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  [PERMISSIONS.CUSTOMER_READ]: "查看客户资料",
  [PERMISSIONS.CUSTOMER_MANAGE]: "创建和维护客户资料",
  [PERMISSIONS.PROJECT_READ]: "查看项目、建筑和安装单元",
  [PERMISSIONS.PROJECT_MANAGE]: "创建和维护项目、建筑和安装单元",
  [PERMISSIONS.AUDIT_READ]: "查看审计日志",
  [PERMISSIONS.FILE_READ]: "查看和下载项目文件",
  [PERMISSIONS.FILE_UPLOAD]: "上传文件版本",
  [PERMISSIONS.FILE_PROCESS]: "发起文件识别和处理重试",
  [PERMISSIONS.FILE_CONFIRM]: "确认普通提取字段",
  [PERMISSIONS.FILE_UNSCANNED_TEST_ACCESS]:
    "开发或测试环境访问未扫描测试文件",
};

export const SYSTEM_ADMIN_ROLE = "SYSTEM_ADMIN";
