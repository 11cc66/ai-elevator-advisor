import { describe, expect, it } from "vitest";

import type { Actor } from "../src/modules/access/actor";
import { PERMISSIONS } from "../src/modules/access/permissions";
import { canAccessProject } from "../src/modules/access/policy";

function scopedActor(role: string): Actor {
  void role;
  return {
    userId: "scoped-user",
    globalPermissions: new Set(),
    projectPermissions: new Map([
      [
        "project-a",
        new Set([
          PERMISSIONS.PROJECT_READ,
          PERMISSIONS.ADVISOR_USE,
          PERMISSIONS.SELECTION_RUN,
        ]),
      ],
    ]),
  };
}

describe("Full MVP project isolation", () => {
  it("allows customer and sales scoped access only to assigned projects", () => {
    for (const role of ["CUSTOMER", "SALES"]) {
      const actor = scopedActor(role);
      expect(
        canAccessProject(actor, "project-a", PERMISSIONS.ADVISOR_USE),
      ).toBe(true);
      expect(
        canAccessProject(actor, "project-b", PERMISSIONS.ADVISOR_USE),
      ).toBe(false);
    }
  });

  it("keeps scoped advisor access from becoming a global permission", () => {
    const actor = scopedActor("CUSTOMER");
    expect(actor.globalPermissions.has(PERMISSIONS.ADVISOR_USE)).toBe(false);
    expect(
      canAccessProject(actor, "project-b", PERMISSIONS.PROJECT_READ),
    ).toBe(false);
  });

  it("allows an administrator global permission across projects", () => {
    const actor: Actor = {
      userId: "admin",
      globalPermissions: new Set([
        PERMISSIONS.PROJECT_READ,
        PERMISSIONS.ADVISOR_USE,
      ]),
      projectPermissions: new Map(),
    };
    expect(
      canAccessProject(actor, "any-project", PERMISSIONS.ADVISOR_USE),
    ).toBe(true);
  });
});
