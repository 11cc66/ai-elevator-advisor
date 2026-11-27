import { expect, test, type APIRequestContext } from "@playwright/test";

const adminUsername = process.env.TEST_ADMIN_USERNAME;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const customerUsername = process.env.TEST_CUSTOMER_USERNAME;
const customerPassword = process.env.TEST_CUSTOMER_PASSWORD;
const salesUsername = process.env.TEST_SALES_USERNAME;

async function signIn(
  request: APIRequestContext,
  username: string | undefined,
  password: string | undefined,
): Promise<void> {
  if (!username || !password) {
    throw new Error("Test credentials are not configured.");
  }
  const response = await request.post("/api/auth/sign-in/username", {
    data: { username, password },
  });
  expect(response.status()).toBe(200);
}

async function signOut(request: APIRequestContext): Promise<void> {
  expect((await request.post("/api/auth/sign-out", { data: {} })).status()).toBe(
    200,
  );
}

test("catalog versioning, audit and project-scoped sales follow-up", async ({
  request,
}) => {
  expect(adminUsername).toBeTruthy();
  expect(adminPassword).toBeTruthy();
  expect(customerUsername).toBeTruthy();
  expect(customerPassword).toBeTruthy();
  expect(salesUsername).toBeTruthy();

  await signIn(request, adminUsername, adminPassword);
  const suffix = Date.now().toString(36).toUpperCase();
  const invalid = await request.post("/api/admin/catalog/products", {
    data: {
      manufacturerName: "虚构厂家校验",
      brandName: "校验品牌",
      modelCode: `INVALID-${suffix}`,
      name: "无效 Demo 产品",
      applicableScenarios: ["OLD_BUILDING_ADDITION"],
      verificationStatus: "DEMO_MOCK",
      specification: { capacityKg: 0 },
    },
  });
  expect(invalid.status()).toBe(400);

  const created = await request.post("/api/admin/catalog/products", {
    data: {
      manufacturerName: "虚构厂家版本",
      brandName: "版本品牌",
      modelCode: `VERSION-${suffix}`,
      name: "DEMO 可编辑产品",
      applicableScenarios: ["OLD_BUILDING_ADDITION"],
      verificationStatus: "DEMO_MOCK",
      sourceReference: "DEMO fixture v1",
      specification: {
        capacityKg: 1000,
        speedMps: 1.5,
        maxFloors: 18,
        maxTravelM: 60,
        machineRoomType: "MRL",
      },
      price: {
        minimumAmount: 450_000,
        maximumAmount: 480_000,
        validityStatus: "DEMO_MOCK",
        sourceReference: "DEMO fixture v1",
      },
    },
  });
  expect(created.status()).toBe(201);
  const productId = ((await created.json()) as { productId: string }).productId;

  const firstVersion = await request.get(
    `/api/admin/catalog/products/${productId}`,
  );
  expect(firstVersion.status()).toBe(200);
  const firstBody = (await firstVersion.json()) as {
    product: {
      specificationVersion: number;
      priceVersion: number;
      verificationStatus: string;
    };
  };
  expect(firstBody.product.specificationVersion).toBe(1);
  expect(firstBody.product.priceVersion).toBe(1);
  expect(firstBody.product.verificationStatus).toBe("DEMO_MOCK");

  const updated = await request.patch(
    `/api/admin/catalog/products/${productId}`,
    {
      data: {
        name: "DEMO 可编辑产品 v2",
        applicableScenarios: ["OLD_BUILDING_ADDITION", "NEW_BUILDING_INSTALLATION"],
        verificationStatus: "DEMO_MOCK",
        sourceReference: "DEMO fixture v2",
        specification: {
          capacityKg: 1150,
          speedMps: 1.75,
          maxFloors: 20,
          maxTravelM: 70,
          machineRoomType: "MRL",
        },
        price: {
          minimumAmount: 470_000,
          maximumAmount: 510_000,
          validityStatus: "DEMO_MOCK",
          sourceReference: "DEMO fixture v2",
        },
      },
    },
  );
  expect(updated.status()).toBe(200);

  const secondVersion = await request.get(
    `/api/admin/catalog/products/${productId}`,
  );
  expect(secondVersion.status()).toBe(200);
  const secondBody = (await secondVersion.json()) as {
    product: {
      name: string;
      specificationVersion: number;
      priceVersion: number;
      specification: { capacityKg: number };
    };
  };
  expect(secondBody.product.name).toBe("DEMO 可编辑产品 v2");
  expect(secondBody.product.specification.capacityKg).toBe(1150);
  expect(secondBody.product.specificationVersion).toBe(2);
  expect(secondBody.product.priceVersion).toBe(2);

  const audit = await request.get("/api/admin/audit");
  expect(audit.status()).toBe(200);
  const auditBody = (await audit.json()) as {
    auditLogs: Array<{ action: string; objectId: string }>;
  };
  expect(
    auditBody.auditLogs.some(
      (entry) =>
        entry.action === "catalog.product.updated" &&
        entry.objectId === productId,
    ),
  ).toBe(true);
  await signOut(request);

  await signIn(request, customerUsername, customerPassword);
  const projectId = "phase3_test_project";
  const conversation = await request.post(
    `/api/projects/${projectId}/advisor/conversations`,
    { data: { installationScenario: "OLD_BUILDING_ADDITION" } },
  );
  expect(conversation.status()).toBe(201);
  const conversationId = ((await conversation.json()) as {
    conversation: { id: string };
  }).conversation.id;
  const message = await request.post(
    `/api/projects/${projectId}/advisor/conversations/${conversationId}/messages`,
    {
      data: {
        content:
          "住宅旧楼加装，8层，层高约3米，预算40-50万，外装可以考虑，有图纸。",
      },
    },
  );
  expect(message.status()).toBe(201);
  const requirement = ((await message.json()) as {
    requirement: { id: string; version: number; missingFields: string[] };
  }).requirement;
  expect(requirement.missingFields).toHaveLength(0);
  const confirmed = await request.post(
    `/api/projects/${projectId}/requirements/confirm`,
    { data: { expectedVersion: requirement.version } },
  );
  expect(confirmed.status()).toBe(200);
  const confirmedRequirement = ((await confirmed.json()) as {
    requirement: { id: string; version: number };
  }).requirement;
  const selectionResponse = await request.post(
    `/api/projects/${projectId}/selection-runs`,
    {
      data: { requirementVersion: confirmedRequirement.version },
    },
  );
  expect(selectionResponse.status()).toBe(201);
  const selectionRun = ((await selectionResponse.json()) as {
    run: { id: string; requirementId: string; status: string };
  }).run;
  expect(selectionRun.requirementId).toBe(confirmedRequirement.id);
  expect(selectionRun.status).toBe("COMPLETED");

  const handoff = await request.post(
    `/api/projects/${projectId}/sales-handoff`,
    {
      data: {
        summary: "DEMO 客户已确认需求，请销售跟进预算。",
        budgetConcern: "客户预算接近上限。",
      },
    },
  );
  expect(handoff.status()).toBe(201);
  const handoffId = ((await handoff.json()) as { handoffId: string }).handoffId;
  await signOut(request);

  await signIn(request, salesUsername, customerPassword);
  expect(
    (
      await request.get(
        `/api/projects/${projectId}/advisor/conversations/${conversationId}`,
      )
    ).status(),
  ).toBe(403);
  const sales = await request.get("/api/admin/sales");
  expect(sales.status()).toBe(200);
  const salesBody = (await sales.json()) as {
    handoffs: Array<{
      id: string;
      projectId: string;
      requirement: { id: string; status: string } | null;
      selectionRun: {
        id: string;
        requirementId: string;
        status: string;
      } | null;
    }>;
  };
  const visible = salesBody.handoffs.find(
    (candidate) => candidate.projectId === projectId,
  );
  expect(visible?.id).toBe(handoffId);
  expect(visible?.requirement?.id).toBe(confirmedRequirement.id);
  expect(visible?.requirement?.status).toBe("CUSTOMER_CONFIRMED");
  expect(visible?.selectionRun?.status).toBe("COMPLETED");
  expect(visible?.selectionRun?.id).toBe(selectionRun.id);
  expect(visible?.selectionRun?.requirementId).toBe(
    confirmedRequirement.id,
  );
  expect(
    (
      await request.post(`/api/admin/sales/${handoffId}/notes`, {
        data: {
          status: "IN_FOLLOW_UP",
          contactStatus: "已电话联系",
          note: "DEMO 跟进备注，不构成报价。",
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (await request.get("/api/admin/projects/phase3_test_project_2")).status(),
  ).toBe(403);
  await signOut(request);

  await signIn(request, adminUsername, adminPassword);
  const deniedHandoff = await request.post(
    "/api/projects/phase3_test_project_2/sales-handoff",
    {
      data: {
        summary: "DEMO 未分配给当前销售的项目。",
      },
    },
  );
  expect(deniedHandoff.status()).toBe(201);
  const deniedHandoffId = ((await deniedHandoff.json()) as {
    handoffId: string;
  }).handoffId;
  await signOut(request);

  await signIn(request, salesUsername, customerPassword);
  expect(
    (
      await request.post(`/api/admin/sales/${deniedHandoffId}/notes`, {
        data: {
          status: "IN_FOLLOW_UP",
          contactStatus: "不应成功",
          note: "不应写入。",
        },
      })
    ).status(),
  ).toBe(403);
});

test("sales endpoint does not attach an old completed run to a newer requirement", async ({
  request,
}) => {
  expect(adminUsername).toBeTruthy();
  expect(adminPassword).toBeTruthy();
  expect(customerUsername).toBeTruthy();
  expect(customerPassword).toBeTruthy();

  await signIn(request, customerUsername, customerPassword);
  const createdProject = await request.post("/api/projects", {
    data: {
      name: `DEMO stale selection ${Date.now().toString(36)}`,
      address: "DEMO stale selection address",
      installationScenario: "OLD_BUILDING_ADDITION",
    },
  });
  expect(createdProject.status()).toBe(201);
  const projectId = ((await createdProject.json()) as {
    project: { id: string };
  }).project.id;

  const conversation = await request.post(
    `/api/projects/${projectId}/advisor/conversations`,
    { data: { installationScenario: "OLD_BUILDING_ADDITION" } },
  );
  expect(conversation.status()).toBe(201);
  const conversationId = ((await conversation.json()) as {
    conversation: { id: string };
  }).conversation.id;
  const message = await request.post(
    `/api/projects/${projectId}/advisor/conversations/${conversationId}/messages`,
    {
      data: {
        content:
          "住宅旧楼加装，8层，层高约3米，预算40-50万，外装可以考虑，有图纸。",
      },
    },
  );
  expect(message.status()).toBe(201);
  const originalRequirement = ((await message.json()) as {
    requirement: { id: string; version: number; missingFields: string[] };
  }).requirement;
  expect(originalRequirement.missingFields).toHaveLength(0);

  const confirmedOriginal = await request.post(
    `/api/projects/${projectId}/requirements/confirm`,
    { data: { expectedVersion: originalRequirement.version } },
  );
  expect(confirmedOriginal.status()).toBe(200);
  const originalConfirmed = ((await confirmedOriginal.json()) as {
    requirement: { id: string; version: number };
  }).requirement;
  const originalSelection = await request.post(
    `/api/projects/${projectId}/selection-runs`,
    { data: { requirementVersion: originalConfirmed.version } },
  );
  expect(originalSelection.status()).toBe(201);

  const handoff = await request.post(
    `/api/projects/${projectId}/sales-handoff`,
    {
      data: {
        summary: "DEMO original requirement handoff.",
      },
    },
  );
  expect(handoff.status()).toBe(201);

  const changed = await request.patch(
    `/api/projects/${projectId}/requirements`,
    { data: { floorCount: 9 } },
  );
  expect(changed.status()).toBe(200);
  const draftRequirement = ((await changed.json()) as {
    requirement: { id: string; version: number; status: string };
  }).requirement;
  expect(draftRequirement.id).not.toBe(originalConfirmed.id);
  expect(draftRequirement.status).toBe("DRAFT");
  const confirmedNew = await request.post(
    `/api/projects/${projectId}/requirements/confirm`,
    { data: { expectedVersion: draftRequirement.version } },
  );
  expect(confirmedNew.status()).toBe(200);
  const newestRequirement = ((await confirmedNew.json()) as {
    requirement: { id: string; status: string };
  }).requirement;
  expect(newestRequirement.id).toBe(draftRequirement.id);
  expect(newestRequirement.status).toBe("CUSTOMER_CONFIRMED");
  await signOut(request);

  await signIn(request, adminUsername, adminPassword);
  const sales = await request.get("/api/admin/sales");
  expect(sales.status()).toBe(200);
  const salesBody = (await sales.json()) as {
    handoffs: Array<{
      projectId: string;
      requirement: { id: string } | null;
      selectionRun: {
        requirementId: string;
        status: string;
      } | null;
    }>;
  };
  const visible = salesBody.handoffs.find(
    (candidate) => candidate.projectId === projectId,
  );
  expect(visible?.requirement?.id).toBe(newestRequirement.id);
  expect(visible?.selectionRun).toBeNull();
});
