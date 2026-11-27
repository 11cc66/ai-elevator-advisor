import { describe, expect, it, vi } from "vitest";

import { loadVisibleWorkbenchSalesHandoff } from "../src/modules/workbench/visibility";

describe("loadVisibleWorkbenchSalesHandoff", () => {
  it("does not execute the sales query without permission", async () => {
    const load = vi.fn(async () => ({ status: "IN_FOLLOW_UP" }));

    const result = await loadVisibleWorkbenchSalesHandoff({
      allowed: false,
      load,
    });

    expect(result).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("executes the sales query when permission is present", async () => {
    const load = vi.fn(async () => ({ status: "IN_FOLLOW_UP" }));

    const result = await loadVisibleWorkbenchSalesHandoff({
      allowed: true,
      load,
    });

    expect(result).toEqual({ status: "IN_FOLLOW_UP" });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
