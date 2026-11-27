export function isExplicitLocalObjectStorageEnvironment(
  nodeEnvironment: string | undefined,
): nodeEnvironment is "development" | "test" {
  return nodeEnvironment === "development" || nodeEnvironment === "test";
}

export function isObjectStorageAdapterAllowed(
  providerKind: string,
  nodeEnvironment: string | undefined,
): boolean {
  if (!providerKind || providerKind.trim() !== providerKind) {
    return false;
  }
  return (
    providerKind !== "LOCAL_DEVELOPMENT" ||
    isExplicitLocalObjectStorageEnvironment(nodeEnvironment)
  );
}
