import { describe, expect, it, vi } from "vitest";

const downloadMocks = vi.hoisted(() => ({
  release: vi.fn(),
  reportInterruption: vi.fn(),
}));

vi.mock("@/modules/auth/api-session", () => ({
  requireApiActor: vi.fn(async () => ({
    actor: { userId: "download-route-user" },
  })),
}));

vi.mock("@/modules/access/policy", () => ({
  requireProjectPermission: vi.fn(),
}));

vi.mock("@/modules/files/download-service", () => ({
  prepareFileDownload: vi.fn(async () => ({
    fileName: "download.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8n,
    body: Buffer.from("verified"),
    release: downloadMocks.release,
    responseTimeoutMs: 10_000,
    reportInterruption: downloadMocks.reportInterruption,
  })),
}));

vi.mock("@/server/files/storage", () => ({
  getPrivateStorage: vi.fn(() => ({})),
  getObjectStorageAdapter: vi.fn(() => undefined),
}));

vi.mock("@/server/env", () => ({
  readWebEnv: vi.fn(() => ({})),
}));

import { GET } from "../src/app/api/projects/[projectId]/files/[fileId]/versions/[versionId]/content/route";

describe("download content route", () => {
  it("invalidates the Web response and releases once when the request aborts", async () => {
    const abortController = new AbortController();
    const request = new Request("http://localhost/download", {
      signal: abortController.signal,
    });
    const response = await GET(request, {
      params: Promise.resolve({
        projectId: "project-1",
        fileId: "file-1",
        versionId: "version-1",
      }),
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(response.status).toBe(200);
    expect(downloadMocks.release).not.toHaveBeenCalled();

    abortController.abort();
    await new Promise((resolve) => setImmediate(resolve));

    expect(downloadMocks.release).toHaveBeenCalledTimes(1);
    expect(downloadMocks.reportInterruption).toHaveBeenCalledTimes(1);
    expect(downloadMocks.reportInterruption).toHaveBeenCalledWith(
      "RESPONSE_STREAM_ABORTED",
    );

    const reader = response.body!.getReader();
    await expect(reader.read()).rejects.toThrow(
      "Download request was aborted.",
    );
  });
});
