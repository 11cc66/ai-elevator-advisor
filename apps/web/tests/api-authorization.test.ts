import { beforeEach, describe, expect, it, vi } from "vitest";

const limitedActor = {
  userId: "limited-user",
  globalPermissions: new Set<string>(),
  projectPermissions: new Map<string, Set<string>>(),
};

vi.mock("../src/modules/auth/api-session", () => ({
  requireApiActor: vi.fn(async () => ({
    actor: limitedActor,
    session: {
      user: { id: "limited-user" },
      session: { id: "session-id" },
    },
  })),
}));

import { GET as getCustomers } from "../src/app/api/admin/customers/route";
import { GET as getProject } from "../src/app/api/admin/projects/[projectId]/route";

describe("server route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the actor lacks a global permission", async () => {
    const response = await getCustomers(
      new Request("http://localhost/api/admin/customers"),
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for a project outside the actor scope", async () => {
    const response = await getProject(
      new Request(
        "http://localhost/api/admin/projects/project-denied",
      ),
      {
        params: Promise.resolve({ projectId: "project-denied" }),
      },
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("PROJECT_ACCESS_DENIED");
  });
});
