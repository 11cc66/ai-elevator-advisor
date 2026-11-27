import { expect, test, type APIRequestContext } from "@playwright/test";

const adminUsername = process.env.TEST_ADMIN_USERNAME;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const customerUsername = process.env.TEST_CUSTOMER_USERNAME;
const customerPassword = process.env.TEST_CUSTOMER_PASSWORD;

async function signIn(
  request: APIRequestContext,
  username: string | undefined,
  password: string | undefined,
): Promise<void> {
  if (!username || !password) {
    throw new Error("Test credentials are not configured.");
  }
  expect(
    (
      await request.post("/api/auth/sign-in/username", {
        data: { username, password },
      })
    ).status(),
  ).toBe(200);
}

test("authenticated MVP routes render the complete customer workflow", async ({
  request,
}) => {
  await signIn(request, adminUsername, adminPassword);
  const catalog = await request.get("/api/admin/catalog/products");
  expect(catalog.status()).toBe(200);
  const catalogBody = (await catalog.json()) as { products: unknown[] };
  if (catalogBody.products.length === 0) {
    expect((await request.post("/api/admin/catalog/seed-demo")).status()).toBe(
      201,
    );
  }
  expect((await request.post("/api/auth/sign-out", { data: {} })).status()).toBe(
    200,
  );

  await signIn(request, customerUsername, customerPassword);
  const catalogPage = await request.get(
    "/catalog?scenario=OLD_BUILDING_ADDITION",
  );
  expect(catalogPage.status()).toBe(200);
  const catalogHtml = await catalogPage.text();
  expect(catalogHtml).toContain("电梯产品目录");
  expect(catalogHtml).toContain("DEMO_MOCK");

  const newProjectPage = await request.get("/projects/new");
  expect(newProjectPage.status()).toBe(200);
  expect(await newProjectPage.text()).toContain("创建并开始 AI 顾问");

  const created = await request.post("/api/projects", {
    data: {
      name: `DEMO Route ${Date.now().toString(36)}`,
      address: "DEMO 路由测试地址",
      installationScenario: "OLD_BUILDING_ADDITION",
    },
  });
  expect(created.status()).toBe(201);
  const projectId = ((await created.json()) as {
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

  const advisorPage = await request.get(
    `/projects/${projectId}/advisor/${conversationId}`,
  );
  expect(advisorPage.status()).toBe(200);
  const advisorHtml = await advisorPage.text();
  expect(advisorHtml).toContain("结构化需求");
  expect(advisorHtml).toContain("Mock AI");

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
  const requirementVersion = ((await message.json()) as {
    requirement: { version: number };
  }).requirement.version;
  const confirmed = await request.post(
    `/api/projects/${projectId}/requirements/confirm`,
    { data: { expectedVersion: requirementVersion } },
  );
  expect(confirmed.status()).toBe(200);
  const confirmedVersion = ((await confirmed.json()) as {
    requirement: { version: number };
  }).requirement.version;
  expect(
    (
      await request.post(`/api/projects/${projectId}/selection-runs`, {
        data: { requirementVersion: confirmedVersion },
      })
    ).status(),
  ).toBe(201);

  const projectPage = await request.get(`/projects/${projectId}`);
  expect(projectPage.status()).toBe(200);
  const projectHtml = await projectPage.text();
  expect(projectHtml).toContain("需求摘要");
  expect(projectHtml).toContain("初步推荐历史");
  expect(projectHtml).toContain("初步匹配结果");
  expect(projectHtml).toContain("初步方案已生成");
  expect(projectHtml).toContain("不替代现场勘察");
});
