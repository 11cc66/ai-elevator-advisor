"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";

export function UnitForm({
  projectId,
  buildingId,
}: {
  projectId: string;
  buildingId: string;
}) {
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
      await postJson(
        `/api/admin/projects/${projectId}/buildings/${buildingId}/installation-units`,
        {
          intendedLocation: String(
            form.get("intendedLocation") ?? "",
          ),
        },
      );
      formElement.reset();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "创建安装单元失败。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={submit}>
      <input
        className="admin-input"
        name="intendedLocation"
        placeholder="拟安装位置（可选）"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="admin-button-secondary" disabled={pending} type="submit">
        {pending ? "正在创建…" : "新增 DEMO 安装单元"}
      </button>
    </form>
  );
}
