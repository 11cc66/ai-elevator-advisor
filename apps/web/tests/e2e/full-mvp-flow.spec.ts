import { expect, test } from "@playwright/test";

const adminUsername = process.env.TEST_ADMIN_USERNAME;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const customerUsername = process.env.TEST_CUSTOMER_USERNAME;
const customerPassword = process.env.TEST_CUSTOMER_PASSWORD;

test("Full MVP demo flow: advisor, requirements, selection and sales handoff", async ({
  request,
}) => {
  expect(adminUsername).toBeTruthy();
  expect(adminPassword).toBeTruthy();
  expect(customerUsername).toBeTruthy();
  expect(customerPassword).toBeTruthy();

  const adminLogin = await request.post("/api/auth/sign-in/username", {
    data: { username: adminUsername, password: adminPassword },
  });
  expect(adminLogin.status()).toBe(200);

  const catalog = await request.get("/api/admin/catalog/products");
  expect(catalog.status()).toBe(200);
  const catalogBody = (await catalog.json()) as { products: unknown[] };
  if (catalogBody.products.length === 0) {
    const seeded = await request.post("/api/admin/catalog/seed-demo");
    expect(seeded.status()).toBe(201);
  }

  const adminLogout = await request.post("/api/auth/sign-out", { data: {} });
  expect(adminLogout.status()).toBe(200);

  const customerLogin = await request.post("/api/auth/sign-in/username", {
    data: { username: customerUsername, password: customerPassword },
  });
  expect(customerLogin.status()).toBe(200);

  const suffix = Date.now().toString(36).toUpperCase();
  const projectResponse = await request.post("/api/projects", {
    data: {
      name: `DEMO Full MVP ${suffix}`,
      address: "DEMO 测试地址",
      installationScenario: "OLD_BUILDING_ADDITION",
    },
  });
  expect(projectResponse.status()).toBe(201);
  const projectBody = (await projectResponse.json()) as {
    project: { id: string };
  };
  const projectId = projectBody.project.id;

  const conversationResponse = await request.post(
    `/api/projects/${projectId}/advisor/conversations`,
    { data: { installationScenario: "OLD_BUILDING_ADDITION" } },
  );
  const conversationText = await conversationResponse.text();
  expect(conversationResponse.status(), conversationText).toBe(201);
  const conversationBody = JSON.parse(conversationText) as {
    conversation: { id: string };
  };
  const conversationId = conversationBody.conversation.id;

  const messageResponse = await request.post(
    `/api/projects/${projectId}/advisor/conversations/${conversationId}/messages`,
    {
      data: {
        content:
          "住宅旧楼加装，8层，层高约3米，预算40-50万，外装可以考虑，有图纸。",
      },
    },
  );
  expect(messageResponse.status()).toBe(201);
  const messageBody = (await messageResponse.json()) as {
    requirement: {
      version: number;
      missingFields: string[];
      fields: { floorCount: number; budgetMax: number };
    };
  };
  expect(messageBody.requirement.missingFields).toHaveLength(0);
  expect(messageBody.requirement.fields.floorCount).toBe(8);
  expect(messageBody.requirement.fields.budgetMax).toBe(500_000);

  const confirmResponse = await request.post(
    `/api/projects/${projectId}/requirements/confirm`,
    { data: { expectedVersion: messageBody.requirement.version } },
  );
  expect(confirmResponse.status()).toBe(200);
  const confirmBody = (await confirmResponse.json()) as {
    requirement: { version: number; status: string };
  };
  expect(confirmBody.requirement.status).toBe("CUSTOMER_CONFIRMED");

  const selectionResponse = await request.post(
    `/api/projects/${projectId}/selection-runs`,
    { data: { requirementVersion: confirmBody.requirement.version } },
  );
  expect(selectionResponse.status()).toBe(201);
  const selectionBody = (await selectionResponse.json()) as {
    run: {
      status: string;
      result: {
        recommendations: Array<{ dataClassification: string }>;
      };
    };
  };
  expect(selectionBody.run.status).toBe("COMPLETED");
  expect(selectionBody.run.result.recommendations[0]?.dataClassification).toBe(
    "DEMO_MOCK",
  );

  const handoffResponse = await request.post(
    `/api/projects/${projectId}/sales-handoff`,
    {
      data: {
        summary: "DEMO 客户已确认需求并查看初步推荐。",
        budgetConcern: "希望销售确认略超预算方案。",
      },
    },
  );
  expect(handoffResponse.status()).toBe(201);

  const customerLogout = await request.post("/api/auth/sign-out", { data: {} });
  expect(customerLogout.status()).toBe(200);

  const secondAdminLogin = await request.post("/api/auth/sign-in/username", {
    data: { username: adminUsername, password: adminPassword },
  });
  expect(secondAdminLogin.status()).toBe(200);
  const salesResponse = await request.get("/api/admin/sales");
  expect(salesResponse.status()).toBe(200);
  const salesBody = (await salesResponse.json()) as {
    handoffs: Array<{ projectId: string; summary: string }>;
  };
  expect(
    salesBody.handoffs.some((handoff) => handoff.projectId === projectId),
  ).toBe(true);
});
