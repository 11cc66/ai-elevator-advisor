"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FollowUpForm({ handoffId }: { handoffId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const response = await fetch(`/api/admin/sales/${handoffId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: String(formData.get("status") ?? ""),
        contactStatus: String(formData.get("contactStatus") ?? ""),
        note: String(formData.get("note") ?? ""),
      }),
    });
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    setMessage(response.ok ? "跟进已记录。" : body?.error?.message ?? "跟进保存失败。");
    if (response.ok) router.refresh();
  }

  return (
    <form
      className="mt-4 grid gap-2 md:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <select className="admin-input" name="status" defaultValue="IN_FOLLOW_UP">
        <option value="PENDING_FOLLOW_UP">待跟进</option>
        <option value="IN_FOLLOW_UP">跟进中</option>
        <option value="CUSTOMER_RESPONDED">客户已回复</option>
        <option value="CLOSED">已关闭</option>
      </select>
      <input className="admin-input" name="contactStatus" placeholder="联系结果" required />
      <input className="admin-input md:col-span-2" name="note" placeholder="跟进备注" required />
      <button className="admin-button-secondary md:col-span-4" type="submit">记录跟进</button>
      {message ? <p className="text-sm text-cyan-800 md:col-span-4">{message}</p> : null}
    </form>
  );
}
