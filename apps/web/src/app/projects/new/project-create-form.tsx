"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface CreateResult {
  project: { id: string };
}

export function ProjectCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          address: String(form.get("address") ?? ""),
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
        <input className="admin-input" name="name" required />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>项目地址</span>
        <input className="admin-input" name="address" required />
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>安装场景</span>
        <select className="admin-input" name="installationScenario" defaultValue="OLD_BUILDING_ADDITION">
          <option value="OLD_BUILDING_ADDITION">旧楼加装</option>
          <option value="EXISTING_ELEVATOR_RENOVATION">现有电梯改造</option>
          <option value="NEW_BUILDING_INSTALLATION">新楼安装</option>
        </select>
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="admin-button" disabled={pending} type="submit">
        {pending ? "正在创建…" : "创建并开始 AI 顾问"}
      </button>
    </form>
  );
}
