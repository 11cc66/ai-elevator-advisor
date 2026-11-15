import { randomUUID } from "node:crypto";

import {
  expect,
  test,
  type APIRequestContext,
} from "@playwright/test";

import { createTestPdf } from "../fixtures/test-pdf";

const customerOneUsername = process.env.TEST_CUSTOMER_USERNAME;
const customerTwoUsername = process.env.TEST_CUSTOMER_2_USERNAME;
const customerPassword = process.env.TEST_CUSTOMER_PASSWORD;
const projectOne = "phase3_test_project";
const projectTwo = "phase3_test_project_2";
const PDF_BYTES = createTestPdf(["Customer isolation test"]);

async function login(
  request: APIRequestContext,
  username: string | undefined,
) {
  const response = await request.post("/api/auth/sign-in/username", {
    data: {
      username,
      password: customerPassword,
    },
  });
  expect(response.status()).toBe(200);
}

test("customers cannot access files from another test customer", async ({
  request,
}) => {
  expect(customerOneUsername).toBeTruthy();
  expect(customerTwoUsername).toBeTruthy();
  expect(customerPassword).toBeTruthy();

  await login(request, customerOneUsername);

  const intent = await request.post(
    `/api/projects/${projectOne}/files/upload-intents`,
    {
      headers: { "Idempotency-Key": randomUUID() },
      data: {
        displayName: "DEMO customer one.pdf",
        originalFilename: "customer-one.pdf",
        declaredMimeType: "application/pdf",
        declaredSizeBytes: PDF_BYTES.byteLength,
        buildingId: "phase3_test_building",
        installationUnitId: "phase3_test_unit",
      },
    },
  );
  expect(intent.status()).toBe(201);
  const intentBody = (await intent.json()) as {
    uploadIntent: { uploadPath: string };
  };
  const upload = await request.put(intentBody.uploadIntent.uploadPath, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(PDF_BYTES.byteLength),
    },
    data: PDF_BYTES,
  });
  expect(upload.status()).toBe(201);
  const uploadBody = (await upload.json()) as {
    fileVersion: { id: string; fileId: string };
  };

  const ownList = await request.get(
    `/api/projects/${projectOne}/files`,
  );
  expect(ownList.status()).toBe(200);
  const ownDownload = await request.get(
    `/api/projects/${projectOne}/files/${uploadBody.fileVersion.fileId}/versions/${uploadBody.fileVersion.id}/content`,
  );
  expect(ownDownload.status()).toBe(200);

  await request.post("/api/auth/sign-out", { data: {} });
  await login(request, customerTwoUsername);

  const otherList = await request.get(
    `/api/projects/${projectOne}/files`,
  );
  expect(otherList.status()).toBe(403);
  const otherDetail = await request.get(
    `/api/projects/${projectOne}/files/${uploadBody.fileVersion.fileId}`,
  );
  expect(otherDetail.status()).toBe(403);
  const otherDownload = await request.get(
    `/api/projects/${projectOne}/files/${uploadBody.fileVersion.fileId}/versions/${uploadBody.fileVersion.id}/content`,
  );
  expect(otherDownload.status()).toBe(403);

  const ownProjectTwo = await request.get(
    `/api/projects/${projectTwo}/files`,
  );
  expect(ownProjectTwo.status()).toBe(200);

  const wrongFileInProjectTwo = await request.get(
    `/api/projects/${projectTwo}/files/${uploadBody.fileVersion.fileId}`,
  );
  expect(wrongFileInProjectTwo.status()).toBe(404);

  await request.post("/api/auth/sign-out", { data: {} });
});
