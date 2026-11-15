import type { ApiError } from "@elevator/contracts";

export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiError
    | T
    | null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error?.message === "string"
        ? payload.error.message
        : "操作失败，请稍后重试。";
    throw new Error(message);
  }

  return payload as T;
}
