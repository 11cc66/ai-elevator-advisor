let startupGatePromise: Promise<unknown> | null = null;

export async function register(): Promise<void> {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_RUNTIME !== "nodejs"
  ) {
    return;
  }

  const { runWebStartupGate } = await import(
    "@/server/security/startup-gate"
  );
  startupGatePromise ??= runWebStartupGate();
  await startupGatePromise;
}
