import { expect, test } from "@playwright/test";

const username = process.env.TEST_CUSTOMER_USERNAME;
const password = process.env.TEST_CUSTOMER_PASSWORD;
const assignedProjectId = "phase3_test_project";

test("test customer is limited to the assigned project", async ({
  request,
}) => {
  expect(
    username,
    "TEST_CUSTOMER_USERNAME must be configured in .env.test",
  ).toBeTruthy();
  expect(
    password,
    "TEST_CUSTOMER_PASSWORD must be configured in .env.test",
  ).toBeTruthy();

  const login = await request.post("/api/auth/sign-in/username", {
    data: {
      username,
      password,
    },
  });
  expect(login.status()).toBe(200);

  const assignedProject = await request.get(
    `/api/admin/projects/${assignedProjectId}`,
  );
  expect(assignedProject.status()).toBe(200);

  const projects = await request.get("/api/admin/projects");
  expect(projects.status()).toBe(200);
  const projectBody = (await projects.json()) as {
    projects: Array<{ id: string }>;
  };
  expect(
    projectBody.projects.every(
      (project) => project.id === assignedProjectId,
    ),
  ).toBe(true);

  const unassignedProject = await request.get(
    "/api/admin/projects/project-not-assigned",
  );
  expect(unassignedProject.status()).toBe(403);

  const customers = await request.get("/api/admin/customers");
  expect(customers.status()).toBe(403);

  const createProject = await request.post("/api/admin/projects", {
    data: {
      customerId: "phase3_test_customer",
      name: "不应创建",
      address: "不应创建",
      projectType: "OLD_BUILDING_ELEVATOR",
    },
  });
  expect(createProject.status()).toBe(403);

  const audit = await request.get("/api/admin/audit");
  expect(audit.status()).toBe(403);

  const logout = await request.post("/api/auth/sign-out", {
    data: {},
  });
  expect(logout.status()).toBe(200);
});
