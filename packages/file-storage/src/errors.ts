export class PrivateStorageError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PrivateStorageError";
  }
}

export class LegacyStorageCleanupDisabledError extends Error {
  constructor(public readonly operation: string) {
    super("Legacy storage cleanup is disabled pending P13 cleanup proof.");
    this.name = "LegacyStorageCleanupDisabledError";
  }
}
