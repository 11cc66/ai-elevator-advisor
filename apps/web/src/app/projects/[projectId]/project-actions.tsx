"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateSalesHandoffForm({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/sales-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: String(formData.get("summary") ?? ""),
          budgetConcern: String(formData.get("budgetConcern") ?? "") || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "销售交接创建失败。");
      }
      setMessage("已创建或更新销售交接。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "销售交接创建失败。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <h2 className="text-lg font-semibold">交给销售人员跟进</h2>
      <p className="text-sm text-slate-500">
        仅创建内部跟进记录，不生成报价或合同。
      </p>
      <textarea className="admin-input min-h-24" name="summary" placeholder="需求与推荐摘要" required />
      <input className="admin-input" name="budgetConcern" placeholder="预算异议或待沟通事项（可选）" />
      {message ? <p className="text-sm text-cyan-800">{message}</p> : null}
      <button className="admin-button" disabled={pending} type="submit">
        {pending ? "正在创建…" : "创建销售交接"}
      </button>
    </form>
  );
}
