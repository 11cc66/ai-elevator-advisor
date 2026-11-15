export const SELECTION_ENGINE_VERSION = "0.1.0";

export interface SelectionEngineDescriptor {
  name: "deterministic-selection-engine";
  version: string;
  implemented: false;
}

/**
 * Phase 1 only exposes stable package metadata. Business eligibility rules are
 * intentionally not implemented until the Phase 5 vertical slice.
 */
export function describeSelectionEngine(): SelectionEngineDescriptor {
  return {
    name: "deterministic-selection-engine",
    version: SELECTION_ENGINE_VERSION,
    implemented: false,
  };
}
