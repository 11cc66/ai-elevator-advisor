"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";
import { FormFeedback } from "@/components/form-feedback";

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
  const [success, setSuccess] = useState<string | null>(null);
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
    if (pending) {
      return;
    }
    setError(null);
    setSuccess(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const customerId = String(form.get("customerId") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    if (!customerId || !name || !address) {
      setError("请选择客户，并填写项目名称和地址。");
      return;
    }
    setPending(true);

    try {
      await postJson("/api/admin/projects", {
        customerId,
        name,
        address,
        projectType: String(form.get("projectType") ?? "OLD_BUILDING_ADDITION"),
      });
      formElement.reset();
      setSuccess("项目已创建。");
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
        <select
          className="admin-input"
          disabled={pending}
          name="customerId"
          required
        >
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
        <input
          className="admin-input"
          disabled={pending}
          maxLength={160}
          name="name"
          required
        />
      </label>
      <label className="space-y-2 text-sm font-medium md:col-span-2">
        <span>项目地址</span>
        <input
          className="admin-input"
          disabled={pending}
          maxLength={300}
          name="address"
          required
        />
      </label>
      <label className="space-y-2 text-sm font-medium md:col-span-2">
        <span>安装场景</span>
        <select
          className="admin-input"
          defaultValue="OLD_BUILDING_ADDITION"
          disabled={pending}
          name="projectType"
        >
          <option value="OLD_BUILDING_ADDITION">旧楼加装电梯</option>
          <option value="EXISTING_ELEVATOR_RENOVATION">旧电梯更新</option>
          <option value="NEW_BUILDING_INSTALLATION">新楼安装电梯</option>
        </select>
      </label>
      <div className="md:col-span-2">
        <div className="mb-3 space-y-2">
          <FormFeedback kind="error" message={error} />
          <FormFeedback kind="success" message={success} />
        </div>
        <button className="admin-button" disabled={pending} type="submit">
          {pending ? "正在创建…" : "创建演示项目"}
        </button>
      </div>
    </form>
  );
}
