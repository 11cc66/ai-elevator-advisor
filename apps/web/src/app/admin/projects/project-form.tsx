"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";

interface CustomerOption {
  id: string;
  organizationName: string;
}

export function ProjectForm({
  customers,
}: {
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (customers.length === 0) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        请先创建客户，再建立项目。
      </p>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await postJson("/api/admin/projects", {
        customerId: String(form.get("customerId") ?? ""),
        name: String(form.get("name") ?? ""),
        address: String(form.get("address") ?? ""),
        projectType: String(form.get("projectType") ?? "OLD_BUILDING_ADDITION"),
      });
      formElement.reset();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "创建项目失败。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-2"
      onSubmit={submit}
    >
      <label className="space-y-2 text-sm font-medium">
        <span>所属客户</span>
        <select className="admin-input" name="customerId" required>
          <option value="">请选择</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.organizationName}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 text-sm font-medium">
        <span>项目名称</span>
        <input className="admin-input" name="name" required />
      </label>
      <label className="space-y-2 text-sm font-medium md:col-span-2">
        <span>项目地址</span>
        <input className="admin-input" name="address" required />
      </label>
      <label className="space-y-2 text-sm font-medium md:col-span-2">
        <span>安装场景</span>
        <select className="admin-input" defaultValue="OLD_BUILDING_ADDITION" name="projectType">
          <option value="OLD_BUILDING_ADDITION">旧楼加装</option>
          <option value="EXISTING_ELEVATOR_RENOVATION">现有电梯改造</option>
          <option value="NEW_BUILDING_INSTALLATION">新楼安装</option>
        </select>
      </label>
      <div className="md:col-span-2">
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <button className="admin-button" disabled={pending} type="submit">
          {pending ? "正在创建…" : "创建旧楼加装 DEMO 项目"}
        </button>
      </div>
    </form>
  );
}
