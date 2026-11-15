import { describe, expect, it } from "vitest";

import type { Actor } from "../src/modules/access/actor";
import { PERMISSIONS } from "../src/modules/access/permissions";
import {
  canAccessProject,
  hasGlobalPermission,
} from "../src/modules/access/policy";

function actorWithAccess(): Actor {
  return {
    userId: "limited-user",
    globalPermissions: new Set(),
    projectPermissions: new Map([
      [
        "project-allowed",
        new Set([PERMISSIONS.PROJECT_READ]),
      ],
    ]),
  };
}

describe("resource access policy", () => {
  it("allows a project-scoped read only for the assigned project", () => {
    const actor = actorWithAccess();

    expect(
      canAccessProject(
        actor,
        "project-allowed",
        PERMISSIONS.PROJECT_READ,
      ),
    ).toBe(true);
    expect(
      canAccessProject(
        actor,
        "project-denied",
        PERMISSIONS.PROJECT_READ,
      ),
    ).toBe(false);
  });

  it("does not turn project access into a global permission", () => {
    const actor = actorWithAccess();

    expect(
      hasGlobalPermission(actor, PERMISSIONS.PROJECT_READ),
    ).toBe(false);
    expect(
      canAccessProject(
        actor,
        "project-allowed",
        PERMISSIONS.PROJECT_MANAGE,
      ),
    ).toBe(false);
  });
});
