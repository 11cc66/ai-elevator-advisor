"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewAction = "CONFIRM" | "CORRECT" | "REJECT";

export function FieldReviewForm({
  endpoint,
  expectedReviewSequence,
  valueType,
  canConfirm,
  canCorrect,
  canReject,
  professional,
}: {
  endpoint: string;
  expectedReviewSequence: number;
  valueType: string;
  canConfirm: boolean;
  canCorrect: boolean;
  canReject: boolean;
  professional: boolean;
}) {
  const router = useRouter();
  const [correctedText, setCorrectedText] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: ReviewAction) {
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      let correctedRawValue: unknown;
      if (action === "CORRECT") {
        if (!correctedText.trim()) {
          throw new Error("请输入修正后的资料内容。");
        }

        if (valueType === "NUMBER") {
          const numericValue = Number(correctedText);
          if (!Number.isFinite(numericValue)) {
            throw new Error("请输入有效数字。");
          }
          correctedRawValue = numericValue;
        } else if (valueType === "BOOLEAN") {
          correctedRawValue = correctedText === "true";
        } else {
          correctedRawValue = correctedText.trim();
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...(action === "CORRECT" ? { correctedRawValue } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          expectedReviewSequence,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            error?: { message?: string };
          }
        | null;

      if (!response.ok) {
        throw new Error(
          body?.error?.message ?? "资料保存失败，请刷新后重试。",
        );
      }

      setCorrectedText("");
      setNote("");
      setMessage(
        professional
          ? "修正建议已提交，仍需专业人员核实。"
          : "资料状态已保存。",
      );
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "资料保存失败，请稍后重试。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {canCorrect ? (
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor={`corrected-${endpoint}`}
          >
            {professional ? "提交修正建议" : "修改后的资料"}
          </label>
          {valueType === "BOOLEAN" ? (
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              id={`corrected-${endpoint}`}
              onChange={(event) => setCorrectedText(event.target.value)}
              value={correctedText}
            >
              <option value="">请选择</option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          ) : (
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              id={`corrected-${endpoint}`}
              inputMode={valueType === "NUMBER" ? "decimal" : "text"}
              onChange={(event) => setCorrectedText(event.target.value)}
              placeholder={
                professional
                  ? "填写您了解到的信息"
                  : "填写正确的资料内容"
              }
              value={correctedText}
            />
          )}
        </div>
      ) : null}

      <div>
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor={`note-${endpoint}`}
        >
          备注（可选）
        </label>
        <textarea
          className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          id={`note-${endpoint}`}
          maxLength={1_000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="可以说明修改原因或补充信息"
          value={note}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {canConfirm ? (
          <button
            className="rounded-lg bg-cyan-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={pending}
            onClick={() => void submit("CONFIRM")}
            type="button"
          >
            信息正确，确认
          </button>
        ) : null}
        {canCorrect ? (
          <button
            className="rounded-lg border border-cyan-800 px-3 py-2 text-sm font-medium text-cyan-900 disabled:opacity-50"
            disabled={pending}
            onClick={() => void submit("CORRECT")}
            type="button"
          >
            {professional ? "提交修正建议" : "修改后确认"}
          </button>
        ) : null}
        {canReject ? (
          <button
            className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-50"
            disabled={pending}
            onClick={() => void submit("REJECT")}
            type="button"
          >
            标记为不准确
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
