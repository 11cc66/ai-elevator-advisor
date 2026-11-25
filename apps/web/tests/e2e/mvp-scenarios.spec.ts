import { expect, test, type APIRequestContext } from "@playwright/test";

const adminUsername = process.env.TEST_ADMIN_USERNAME;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const customerUsername = process.env.TEST_CUSTOMER_USERNAME;
const customerPassword = process.env.TEST_CUSTOMER_PASSWORD;
const customer2Username = process.env.TEST_CUSTOMER_2_USERNAME;

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

async function ensureCatalog(request: APIRequestContext): Promise<void> {
  const catalog = await request.get("/api/admin/catalog/products");
  expect(catalog.status()).toBe(200);
  const body = (await catalog.json()) as { products: unknown[] };
  if (body.products.length === 0) {
    const seeded = await request.post("/api/admin/catalog/seed-demo");
    expect(seeded.status()).toBe(201);
  }
}

async function completeScenario(
  request: APIRequestContext,
  scenario: string,
  message: string,
): Promise<string> {
  const project = await request.post("/api/projects", {
    data: {
      name: `DEMO Scenario ${scenario} ${Date.now().toString(36)}`,
      address: "DEMO 三场景测试地址",
      installationScenario: scenario,
    },
  });
  expect(project.status()).toBe(201);
  const projectId = ((await project.json()) as {
    project: { id: string };
  }).project.id;

  const conversation = await request.post(
    `/api/projects/${projectId}/advisor/conversations`,
    { data: { installationScenario: scenario } },
  );
  expect(conversation.status()).toBe(201);
  const conversationId = ((await conversation.json()) as {
    conversation: { id: string };
  }).conversation.id;

  const reply = await request.post(
    `/api/projects/${projectId}/advisor/conversations/${conversationId}/messages`,
    { data: { content: message } },
  );
  expect(reply.status()).toBe(201);
  const requirement = ((await reply.json()) as {
    requirement: { version: number; missingFields: string[] };
  }).requirement;
  expect(requirement.missingFields).toHaveLength(0);

  const confirmed = await request.post(
    `/api/projects/${projectId}/requirements/confirm`,
    { data: { expectedVersion: requirement.version } },
  );
  expect(confirmed.status()).toBe(200);
  const confirmedVersion = ((await confirmed.json()) as {
    requirement: { version: number; status: string };
  }).requirement;
  expect(confirmedVersion.status).toBe("CUSTOMER_CONFIRMED");

  const selection = await request.post(
    `/api/projects/${projectId}/selection-runs`,
    { data: { requirementVersion: confirmedVersion.version } },
  );
  expect(selection.status()).toBe(201);
  const run = ((await selection.json()) as {
    run: {
      status: string;
      result: {
        recommendations: Array<{ dataClassification: string }>;
        missingInformation: string[];
        professionalReviewRequired: boolean;
      };
    };
  }).run;
  expect(run.status).toBe("COMPLETED");
  expect(run.result.recommendations.length).toBeGreaterThan(0);
  expect(run.result.recommendations[0]?.dataClassification).toBe("DEMO_MOCK");
  expect(run.result.professionalReviewRequired).toBe(true);
  return projectId;
}

test("all three MVP scenarios complete and reject cross-customer access", async ({
  request,
}) => {
  expect(adminUsername).toBeTruthy();
  expect(adminPassword).toBeTruthy();
  expect(customerUsername).toBeTruthy();
  expect(customerPassword).toBeTruthy();
  expect(customer2Username).toBeTruthy();

  await signIn(request, adminUsername, adminPassword);
  await ensureCatalog(request);
  expect((await request.post("/api/auth/sign-out", { data: {} })).status()).toBe(200);

  await signIn(request, customerUsername, customerPassword);
  const catalog = await request.get("/api/catalog/products");
  expect(catalog.status()).toBe(200);
  const catalogBody = (await catalog.json()) as {
    products: Array<{ verificationStatus: string }>;
  };
  expect(catalogBody.products.length).toBeGreaterThan(0);
  expect(
    catalogBody.products.every((product) =>
      ["DEMO_MOCK", "VERIFIED"].includes(product.verificationStatus),
    ),
  ).toBe(true);
  expect((await request.get("/api/admin/sales")).status()).toBe(403);
  const oldBuildingProject = await completeScenario(
    request,
    "OLD_BUILDING_ADDITION",
    "住宅旧楼加装，8层，层高约3米，预算40-50万，外装可以考虑，有图纸。",
  );
  const renovationProject = await completeScenario(
    request,
    "EXISTING_ELEVATOR_RENOVATION",
    "办公旧梯改造，10层，层高约3.5米，预算60-70万，外装不允许，旧梯载重800公斤，希望更新改造。",
  );
  const newBuildingProject = await completeScenario(
    request,
    "NEW_BUILDING_INSTALLATION",
    "学校新楼安装，12层，层高约3米，预算45-55万，外装可以考虑，有图纸。",
  );

  expect(new Set([oldBuildingProject, renovationProject, newBuildingProject]).size).toBe(3);
  expect(
    (await request.get("/api/admin/projects/phase3_test_project_2")).status(),
  ).toBe(403);
  expect(
    (
      await request.post(
        "/api/projects/phase3_test_project_2/advisor/conversations",
        { data: { installationScenario: "OLD_BUILDING_ADDITION" } },
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch("/api/projects/phase3_test_project_2/requirements", {
        data: { floorCount: 99 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.post("/api/auth/sign-out", { data: {} })).status(),
  ).toBe(200);

  await signIn(request, customer2Username, customerPassword);
  expect(
    (await request.get(`/api/admin/projects/${oldBuildingProject}`)).status(),
  ).toBe(403);
});
