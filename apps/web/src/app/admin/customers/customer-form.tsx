"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";

export function CustomerForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await postJson("/api/admin/customers", {
        organizationName: String(form.get("organizationName") ?? ""),
        contactName: String(form.get("contactName") ?? ""),
        contactPhone: String(form.get("contactPhone") ?? ""),
      });
      formElement.reset();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "创建客户失败。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-3"
      onSubmit={submit}
    >
      <label className="space-y-2 text-sm font-medium">
        <span>客户 / 组织名称</span>
        <input className="admin-input" name="organizationName" required />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>联系人</span>
        <input className="admin-input" name="contactName" required />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>联系电话（可选）</span>
        <input className="admin-input" name="contactPhone" />
      </label>
      <div className="md:col-span-3">
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <button className="admin-button" disabled={pending} type="submit">
          {pending ? "正在创建…" : "创建 DEMO 客户"}
        </button>
      </div>
    </form>
  );
}
