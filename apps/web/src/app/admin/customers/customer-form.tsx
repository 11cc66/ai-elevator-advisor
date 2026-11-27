"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";
import { FormFeedback } from "@/components/form-feedback";

export function CustomerForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setSuccess(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const organizationName = String(
      form.get("organizationName") ?? "",
    ).trim();
    const contactName = String(form.get("contactName") ?? "").trim();
    if (!organizationName || !contactName) {
      setError("请填写客户名称和联系人。");
      return;
    }
    setPending(true);

    try {
      await postJson("/api/admin/customers", {
        organizationName,
        contactName,
        contactPhone: String(form.get("contactPhone") ?? "").trim(),
      });
      formElement.reset();
      setSuccess("客户档案已创建。");
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
        <input
          className="admin-input"
          disabled={pending}
          maxLength={160}
          name="organizationName"
          required
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>联系人</span>
        <input
          className="admin-input"
          disabled={pending}
          maxLength={120}
          name="contactName"
          required
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>联系电话（可选）</span>
        <input
          className="admin-input"
          disabled={pending}
          maxLength={40}
          name="contactPhone"
        />
      </label>
      <div className="md:col-span-3">
        <div className="mb-3 space-y-2">
          <FormFeedback kind="error" message={error} />
          <FormFeedback kind="success" message={success} />
        </div>
        <button className="admin-button" disabled={pending} type="submit">
          {pending ? "正在创建…" : "创建 DEMO 客户"}
        </button>
      </div>
    </form>
  );
}
