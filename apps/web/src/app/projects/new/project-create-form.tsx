"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { FormFeedback } from "@/components/form-feedback";

interface CreateResult {
  project: { id: string };
}

export function ProjectCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    if (!name || !address) {
      setError("请填写项目名称和地址。");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          installationScenario: String(form.get("installationScenario") ?? ""),
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | CreateResult
        | { error?: { message?: string } }
        | null;
      if (!response.ok || !body || !("project" in body)) {
        throw new Error(
          body && "error" in body
            ? body.error?.message ?? "项目创建失败。"
            : "项目创建失败。",
        );
      }
      router.push(`/projects/${body.project.id}/advisor`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "项目创建失败。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6" onSubmit={submit}>
      <label className="space-y-2 text-sm font-medium">
        <span>项目名称</span>
        <input
          className="admin-input"
          disabled={pending}
          maxLength={160}
          name="name"
          required
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>项目地址</span>
        <input
          className="admin-input"
          disabled={pending}
          maxLength={300}
          name="address"
          required
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>安装场景</span>
        <select
          className="admin-input"
          defaultValue="OLD_BUILDING_ADDITION"
          disabled={pending}
          name="installationScenario"
        >
          <option value="OLD_BUILDING_ADDITION">旧楼加装电梯</option>
          <option value="EXISTING_ELEVATOR_RENOVATION">旧电梯更新</option>
          <option value="NEW_BUILDING_INSTALLATION">新楼安装电梯</option>
        </select>
      </label>
      <FormFeedback kind="error" message={error} />
      <button className="admin-button" disabled={pending} type="submit">
        {pending ? "正在创建…" : "创建并开始 AI 顾问"}
      </button>
    </form>
  );
}
