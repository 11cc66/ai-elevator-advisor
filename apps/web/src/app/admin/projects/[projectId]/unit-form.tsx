"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { postJson } from "@/lib/api-client";
import { FormFeedback } from "@/components/form-feedback";

export function UnitForm({
  projectId,
  buildingId,
}: {
  projectId: string;
  buildingId: string;
}) {
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
    setPending(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      await postJson(
        `/api/admin/projects/${projectId}/buildings/${buildingId}/installation-units`,
        {
          intendedLocation: String(
            form.get("intendedLocation") ?? "",
          ).trim(),
        },
      );
      formElement.reset();
      setSuccess("安装单元已创建。");
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
        disabled={pending}
        maxLength={200}
        name="intendedLocation"
        placeholder="拟安装位置（可选）"
      />
      <FormFeedback kind="error" message={error} />
      <FormFeedback kind="success" message={success} />
      <button className="admin-button-secondary" disabled={pending} type="submit">
        {pending ? "正在创建…" : "新增 DEMO 安装单元"}
      </button>
    </form>
  );
}
