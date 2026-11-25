"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SeedDemoButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function seed() {
    setPending(true);
    try {
      const response = await fetch("/api/admin/catalog/seed-demo", { method: "POST" });
      const body = (await response.json().catch(() => null)) as
        | { seededProducts?: number; error?: { message?: string } }
        | null;
      setMessage(
        response.ok
          ? `已载入 ${body?.seededProducts ?? 0} 个 DEMO_MOCK 产品。`
          : body?.error?.message ?? "载入失败。",
      );
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button className="admin-button-secondary" disabled={pending} onClick={() => void seed()} type="button">
        {pending ? "正在载入…" : "载入蓝图 DEMO_MOCK 产品"}
      </button>
      {message ? <p className="mt-2 text-sm text-cyan-800">{message}</p> : null}
    </div>
  );
}
