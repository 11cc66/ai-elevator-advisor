"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";
import { FormFeedback } from "@/components/form-feedback";

export function BuildingForm({ projectId }: { projectId: string }) {
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
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      setError("请填写建筑名称。");
      return;
    }
    setPending(true);

    try {
      await postJson(`/api/admin/projects/${projectId}/buildings`, {
        name,
        usageType: String(form.get("usageType") ?? "").trim(),
        addressDetail: String(form.get("addressDetail") ?? "").trim(),
      });
      formElement.reset();
      setSuccess("建筑已创建。");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "创建建筑失败。",
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
        <span>建筑名称</span>
        <input
          className="admin-input"
          disabled={pending}
          maxLength={160}
          name="name"
          required
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>用途（可选）</span>
        <input
          className="admin-input"
          disabled={pending}
          maxLength={80}
          name="usageType"
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>详细地址（可选）</span>
        <input
          className="admin-input"
          disabled={pending}
          maxLength={300}
          name="addressDetail"
        />
      </label>
      <div className="md:col-span-3">
        <div className="mb-3 space-y-2">
          <FormFeedback kind="error" message={error} />
          <FormFeedback kind="success" message={success} />
        </div>
        <button className="admin-button" disabled={pending} type="submit">
          {pending ? "正在创建…" : "新增 DEMO 建筑"}
        </button>
      </div>
    </form>
  );
}
