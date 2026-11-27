"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FormFeedback } from "@/components/form-feedback";

export function FollowUpForm({ handoffId }: { handoffId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<"error" | "success">(
    "success",
  );
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    if (pending) {
      return;
    }
    const contactStatus = String(formData.get("contactStatus") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (!contactStatus || !note) {
      setFeedbackKind("error");
      setMessage("请填写联系结果和跟进备注。");
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/sales/${handoffId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: String(formData.get("status") ?? ""),
          contactStatus,
          note,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setFeedbackKind(response.ok ? "success" : "error");
      setMessage(
        response.ok
          ? "跟进已记录，销售状态已更新。"
          : body?.error?.message ?? "跟进保存失败。",
      );
      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      setFeedbackKind("error");
      setMessage(error instanceof Error ? error.message : "跟进保存失败。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="mt-4 grid gap-2 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <select
        className="admin-input"
        defaultValue="IN_FOLLOW_UP"
        disabled={pending}
        name="status"
      >
        <option value="PENDING_FOLLOW_UP">待跟进</option>
        <option value="IN_FOLLOW_UP">跟进中</option>
        <option value="CUSTOMER_RESPONDED">客户已回复</option>
        <option value="CLOSED">已关闭</option>
      </select>
      <input
        className="admin-input"
        disabled={pending}
        maxLength={80}
        name="contactStatus"
        placeholder="联系结果"
        required
      />
      <input
        className="admin-input md:col-span-2"
        disabled={pending}
        maxLength={4_000}
        name="note"
        placeholder="跟进备注"
        required
      />
      <button
        className="admin-button-secondary md:col-span-4"
        disabled={pending}
        type="submit"
      >
        {pending ? "正在记录…" : "记录跟进"}
      </button>
      <div className="md:col-span-4">
        <FormFeedback kind={feedbackKind} message={message} />
      </div>
    </form>
  );
}
