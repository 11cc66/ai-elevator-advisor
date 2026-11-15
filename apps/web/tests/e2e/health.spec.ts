import { expect, test } from "@playwright/test";

test("health endpoint reports web and database availability", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  const body = (await response.json()) as {
    status?: string;
    checks?: { database?: string };
  };

  expect(response.status()).toBe(200);
  expect(body.status).toBe("ok");
  expect(body.checks?.database).toBe("ok");
});
