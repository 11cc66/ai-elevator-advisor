import { describe, expect, it } from "vitest";

import { createDemoCode } from "../src/modules/projects/demo-code";

describe("DEMO resource codes", () => {
  it("marks server-generated resource codes as DEMO", () => {
    const code = createDemoCode("PROJECT");

    expect(code).toMatch(/^DEMO-PROJECT-[A-F0-9]{8}$/);
  });
});
