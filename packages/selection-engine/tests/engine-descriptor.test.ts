import { describe, expect, it } from "vitest";

import {
  SELECTION_ENGINE_VERSION,
  describeSelectionEngine,
} from "../src/index.js";

describe("selection engine package boundary", () => {
  it("returns deterministic metadata without model input", () => {
    expect(describeSelectionEngine()).toEqual({
      name: "deterministic-selection-engine",
      version: SELECTION_ENGINE_VERSION,
      implemented: false,
    });
  });
});
