import { LegacyStorageCleanupDisabledError } from "./errors.js";
import type { LegacyStorageCleanupCapability } from "./capabilities.js";

export class QuarantinedLegacyStorageCleanup
  implements LegacyStorageCleanupCapability
{
  async removeStaging(stagingKey: string): Promise<void> {
    void stagingKey;
    throw new LegacyStorageCleanupDisabledError("removeStaging");
  }

  async removeObject(objectKey: string): Promise<void> {
    void objectKey;
    throw new LegacyStorageCleanupDisabledError("removeObject");
  }

  async cleanupOrphanObjects(
    referencedObjectKeys: readonly string[],
    olderThanMs: number,
    onError?: (error: unknown) => void,
    beforeDelete?: (objectKey: string) => void | Promise<void>,
  ): Promise<number> {
    void referencedObjectKeys;
    void olderThanMs;
    void onError;
    void beforeDelete;
    throw new LegacyStorageCleanupDisabledError(
      "cleanupOrphanObjects",
    );
  }

  async cleanupTemp(
    olderThanMs: number,
    onError?: (error: unknown) => void,
    beforeDelete?: (storageKey: string) => void | Promise<void>,
  ): Promise<number> {
    void olderThanMs;
    void onError;
    void beforeDelete;
    throw new LegacyStorageCleanupDisabledError("cleanupTemp");
  }
}
