import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const username = process.env.TEST_ADMIN_USERNAME;
const password = process.env.TEST_ADMIN_PASSWORD;

test("Phase 2 authentication, RBAC boundary and DEMO project flow", async ({
  request,
}) => {
  expect(
    username,
    "TEST_ADMIN_USERNAME must be configured locally",
  ).toBeTruthy();
  expect(
    password,
    "TEST_ADMIN_PASSWORD must be configured locally",
  ).toBeTruthy();

  const unauthenticatedPage = await request.get("/admin", {
    maxRedirects: 0,
  });
  expect([302, 303, 307, 308]).toContain(
    unauthenticatedPage.status(),
  );
  expect(unauthenticatedPage.headers().location).toContain("/login");

  const unauthenticatedApi = await request.get("/api/admin/projects");
  expect(unauthenticatedApi.status()).toBe(401);

  const failedLogin = await request.post(
    "/api/auth/sign-in/username",
    {
      data: {
        username,
        password: "definitely-wrong-password",
      },
    },
  );
  expect(failedLogin.ok()).toBe(false);

  const disabledSignup = await request.post("/api/auth/sign-up/email", {
    data: {
      name: "不应创建的账号",
      email: "should-not-exist@dev.invalid",
      password: "not-a-real-password",
    },
  });
  expect(disabledSignup.ok()).toBe(false);

  const login = await request.post("/api/auth/sign-in/username", {
    data: {
      username,
      password,
    },
  });
  expect(login.status()).toBe(200);
  const setCookie = login.headers()["set-cookie"] ?? "";
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie.toLowerCase()).toContain("samesite=lax");

  const protectedApi = await request.get("/api/admin/projects");
  expect(protectedApi.status()).toBe(200);

  const suffix = Date.now().toString(36).toUpperCase();
  const customerResponse = await request.post(
    "/api/admin/customers",
    {
      data: {
        organizationName: `DEMO 客户 ${suffix}`,
        contactName: "DEMO 联系人",
        contactPhone: "",
      },
    },
  );
  expect(customerResponse.status()).toBe(201);
  const customerBody = (await customerResponse.json()) as {
    customer: { id: string; dataClassification: string };
  };
  expect(customerBody.customer.dataClassification).toBe("DEMO_MOCK");

  const projectResponse = await request.post("/api/admin/projects", {
    data: {
      customerId: customerBody.customer.id,
      name: `DEMO 项目 ${suffix}`,
      address: "DEMO 地址",
      projectType: "OLD_BUILDING_ELEVATOR",
    },
  });
  expect(projectResponse.status()).toBe(201);
  const projectBody = (await projectResponse.json()) as {
    project: {
      id: string;
      projectCode: string;
      dataClassification: string;
    };
  };
  expect(projectBody.project.projectCode).toMatch(
    /^DEMO-PROJECT-[A-F0-9]{8}$/,
  );
  expect(projectBody.project.dataClassification).toBe("DEMO_MOCK");

  const buildingResponse = await request.post(
    `/api/admin/projects/${projectBody.project.id}/buildings`,
    {
      data: {
        name: "DEMO 建筑",
        usageType: "住宅",
        addressDetail: "",
      },
    },
  );
  expect(buildingResponse.status()).toBe(201);
  const buildingBody = (await buildingResponse.json()) as {
    building: { id: string; buildingCode: string };
  };
  expect(buildingBody.building.buildingCode).toMatch(
    /^DEMO-BUILDING-[A-F0-9]{8}$/,
  );

  const unitResponse = await request.post(
    `/api/admin/projects/${projectBody.project.id}/buildings/${buildingBody.building.id}/installation-units`,
    {
      data: {
        intendedLocation: "DEMO 单元位置",
      },
    },
  );
  expect(unitResponse.status()).toBe(201);
  const unitBody = (await unitResponse.json()) as {
    unit: { unitCode: string };
  };
  expect(unitBody.unit.unitCode).toMatch(
    /^DEMO-UNIT-[A-F0-9]{8}$/,
  );

  const projectDetail = await request.get(
    `/api/admin/projects/${projectBody.project.id}`,
  );
  expect(projectDetail.status()).toBe(200);
  const projectDetailBody = (await projectDetail.json()) as {
    project: {
      buildings: Array<{
        installationUnits: Array<{ unitCode: string }>;
      }>;
    };
  };
  expect(
    projectDetailBody.project.buildings[0]?.installationUnits[0]
      ?.unitCode,
  ).toBe(unitBody.unit.unitCode);

  const auditResponse = await request.get("/api/admin/audit");
  expect(auditResponse.status()).toBe(200);
  const auditBody = (await auditResponse.json()) as {
    auditLogs: Array<{ action: string; objectId: string }>;
  };
  expect(
    auditBody.auditLogs.some(
      (entry) =>
        entry.action === "customer.created" &&
        entry.objectId === customerBody.customer.id,
    ),
  ).toBe(true);
  expect(
    auditBody.auditLogs.some(
      (entry) =>
        entry.action === "project.created" &&
        entry.objectId === projectBody.project.id,
    ),
  ).toBe(true);
  expect(
    auditBody.auditLogs.some(
      (entry) =>
        entry.action === "building.created" &&
        entry.objectId === buildingBody.building.id,
    ),
  ).toBe(true);

  const logout = await request.post("/api/auth/sign-out", {
    data: {},
  });
  expect(logout.status()).toBe(200);

  const afterLogout = await request.get("/api/admin/projects");
  expect(afterLogout.status()).toBe(401);

  const secondLogin = await request.post(
    "/api/auth/sign-in/username",
    {
      data: {
        username,
        password,
      },
    },
  );
  expect(secondLogin.status()).toBe(200);

  const prisma = new PrismaClient();

  try {
    const expired = await prisma.session.updateMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      data: {
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    expect(expired.count).toBeGreaterThan(0);
  } finally {
    await prisma.$disconnect();
  }

  const afterExpiry = await request.get("/api/admin/projects");
  expect(afterExpiry.status()).toBe(401);

  const cleanup = new PrismaClient();

  try {
    await cleanup.session.deleteMany({
      where: {
        expiresAt: { lte: new Date() },
      },
    });
  } finally {
    await cleanup.$disconnect();
  }
});
