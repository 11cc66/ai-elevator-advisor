"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartConversationForm({
  projectId,
  installationScenario,
}: {
  projectId: string;
  installationScenario: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/advisor/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationScenario }),
      });
      const body = (await response.json().catch(() => null)) as
        | { conversation?: { id: string }; error?: { message?: string } }
        | null;
      if (!response.ok || !body?.conversation) {
        throw new Error(body?.error?.message ?? "无法创建顾问会话。");
      }
      router.push(`/projects/${projectId}/advisor/${body.conversation.id}`);
      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "无法创建顾问会话。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
      <h2 className="text-xl font-semibold">开始 Mock AI 顾问</h2>
      <p className="mt-2 text-sm leading-6 text-cyan-950">
        顾问会通过多轮问题整理楼层、层高、预算和现场条件。不会调用真实模型。
      </p>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button className="admin-button mt-4" disabled={pending} onClick={() => void start()} type="button">
        {pending ? "正在创建…" : "开始需求对话"}
      </button>
    </div>
  );
}
