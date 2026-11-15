"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";

export function BuildingForm({ projectId }: { projectId: string }) {
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
      await postJson(`/api/admin/projects/${projectId}/buildings`, {
        name: String(form.get("name") ?? ""),
        usageType: String(form.get("usageType") ?? ""),
        addressDetail: String(form.get("addressDetail") ?? ""),
      });
      formElement.reset();
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
        <input className="admin-input" name="name" required />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>用途（可选）</span>
        <input className="admin-input" name="usageType" />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>详细地址（可选）</span>
        <input className="admin-input" name="addressDetail" />
      </label>
      <div className="md:col-span-3">
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <button className="admin-button" disabled={pending} type="submit">
          {pending ? "正在创建…" : "新增 DEMO 建筑"}
        </button>
      </div>
    </form>
  );
}
