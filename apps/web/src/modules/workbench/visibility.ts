export async function loadVisibleWorkbenchSalesHandoff<T>(input: {
  allowed: boolean;
  load: () => Promise<T>;
}): Promise<T | null> {
  if (!input.allowed) {
    return null;
  }
  return input.load();
}
