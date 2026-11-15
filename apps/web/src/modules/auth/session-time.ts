export function isSessionExpired(expiresAt: Date | string): boolean {
  const expiresAtMs =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : new Date(expiresAt).getTime();

  return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
}
