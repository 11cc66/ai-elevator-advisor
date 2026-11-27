"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FormFeedback } from "@/components/form-feedback";

export function CreateSalesHandoffForm({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<
    "error" | "success"
  >("success");

  async function submit(formData: FormData) {
    if (pending) {
      return;
    }
    const summary = String(formData.get("summary") ?? "").trim();
    const budgetConcern =
      String(formData.get("budgetConcern") ?? "").trim() || undefined;
    if (!summary) {
      setFeedbackKind("error");
      setMessage("请填写需求与推荐摘要。");
      return;
    }
    if (summary.length > 4_000) {
      setFeedbackKind("error");
      setMessage("需求与推荐摘要不能超过 4000 个字符。");
      return;
    }
    if (budgetConcern && budgetConcern.length > 2_000) {
      setFeedbackKind("error");
      setMessage("预算事项不能超过 2000 个字符。");
      return;
    }

    setPending(true);
    setFeedbackKind("success");
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/sales-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          budgetConcern,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "销售交接创建失败。");
      }
      setFeedbackKind("success");
      setMessage("销售交接信息已提交或更新。");
      router.refresh();
    } catch (error) {
      setFeedbackKind("error");
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
      <h2 className="text-lg font-semibold">提交销售交接信息</h2>
      <p className="text-sm text-slate-500">
        仅创建或更新内部跟进记录，不生成报价或合同。价格异议由负责销售人员继续确认。
      </p>
      <label className="block text-sm font-medium">
        需求与推荐摘要
        <textarea
          className="admin-input mt-1 min-h-24"
          maxLength={4_000}
          name="summary"
          placeholder="说明客户需求、意向方案和需要销售确认的事项"
          required
        />
      </label>
      <label className="block text-sm font-medium">
        预算异议或待沟通事项（可选）
        <textarea
          className="admin-input mt-1 min-h-20"
          maxLength={2_000}
          name="budgetConcern"
          placeholder="例如：客户希望确认略超预算方案"
        />
      </label>
      <FormFeedback kind={feedbackKind} message={message} />
      <button className="admin-button" disabled={pending} type="submit">
        {pending ? "正在保存…" : "提交销售交接"}
      </button>
    </form>
  );
}
