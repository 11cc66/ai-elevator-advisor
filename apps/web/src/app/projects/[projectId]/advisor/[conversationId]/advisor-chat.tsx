"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FormFeedback } from "@/components/form-feedback";
import { StatusBadge } from "@/components/status-badge";
import {
  validateRequirementForm,
  type RequirementNumericField,
} from "@/modules/advisor/form-validation";
import {
  getAdvisorProviderPresentation,
  getMissingFieldLabels,
  getRequirementStatusPresentation,
  getScenarioPresentation,
} from "@/modules/workbench/presentation";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  provider: "MOCK" | "REAL_PROVIDER";
  createdAt: string;
}

interface Requirement {
  id: string;
  installationScenario:
    | "OLD_BUILDING_ADDITION"
    | "EXISTING_ELEVATOR_RENOVATION"
    | "NEW_BUILDING_INSTALLATION";
  version: number;
  status: "DRAFT" | "CUSTOMER_CONFIRMED";
  missingFields: string[];
  fields: {
    buildingUse?: string;
    buildingType?: string;
    floorCount?: number;
    floorHeight?: number;
    buildingHeight?: number;
    budgetMin?: number;
    budgetMax?: number;
    externalInstallationAllowed?: boolean;
    buildingDescription?: string;
    siteConditions?: string;
    drawingStatus?: "NONE" | "AVAILABLE_NOT_ANALYZED" | "ANALYSIS_UNAVAILABLE";
    existingElevatorDescription?: string;
    renovationGoal?: string;
  };
}

export function AdvisorChat({
  projectId,
  conversationId,
  initialMessages,
  initialRequirement,
}: {
  projectId: string;
  conversationId: string;
  initialMessages: Message[];
  initialRequirement: Requirement | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [requirement, setRequirement] = useState(initialRequirement);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorScope, setErrorScope] = useState<"chat" | "form" | null>(
    null,
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<RequirementNumericField, string>>
  >({});
  const [operation, setOperation] = useState<
    "idle" | "sending" | "saving" | "confirming" | "selecting"
  >("idle");
  const pending = operation !== "idle";
  const scenario = requirement
    ? getScenarioPresentation(requirement.installationScenario)
    : null;

  async function send() {
    if (pending || !text.trim()) return;
    if (text.trim().length > 4_000) {
      setErrorScope("chat");
      setError("消息不能超过 4000 个字符。");
      return;
    }
    setOperation("sending");
    setError(null);
    setErrorScope(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/advisor/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text.trim() }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | {
            assistantMessage?: Message;
            requirement?: Requirement;
            error?: { message?: string };
          }
        | null;
      if (!response.ok || !body?.assistantMessage || !body.requirement) {
        throw new Error(body?.error?.message ?? "发送失败。");
      }
      setMessages((current) => [
        ...current,
        {
          id: `local-user-${Date.now()}`,
          role: "USER",
          content: text.trim(),
          provider: "MOCK",
          createdAt: new Date().toISOString(),
        },
        body.assistantMessage as Message,
      ]);
      setRequirement(body.requirement);
      setText("");
      setSuccess("Mock AI 已更新结构化需求。");
    } catch (sendError) {
      setErrorScope("chat");
      setError(sendError instanceof Error ? sendError.message : "发送失败。");
    } finally {
      setOperation("idle");
    }
  }

  async function saveRequirement(form: FormData) {
    if (pending) {
      return;
    }
    const validation = validateRequirementForm({
      floorCount: String(form.get("floorCount") ?? ""),
      floorHeight: String(form.get("floorHeight") ?? ""),
      buildingHeight: String(form.get("buildingHeight") ?? ""),
      budgetMin: String(form.get("budgetMin") ?? ""),
      budgetMax: String(form.get("budgetMax") ?? ""),
    });
    setFieldErrors(validation.errors);
    if (!validation.valid) {
      setErrorScope("form");
      setError("请先修正标红的数值字段。");
      setSuccess(null);
      return;
    }

    const payload = {
      buildingUse: String(form.get("buildingUse") ?? "").trim() || undefined,
      buildingType: String(form.get("buildingType") ?? "").trim() || undefined,
      ...validation.values,
      externalInstallationAllowed:
        form.get("externalInstallationAllowed") === ""
          ? undefined
          : form.get("externalInstallationAllowed") === "true",
      buildingDescription:
        String(form.get("buildingDescription") ?? "").trim() || undefined,
      siteConditions:
        String(form.get("siteConditions") ?? "").trim() || undefined,
      drawingStatus:
        String(form.get("drawingStatus") ?? "") || undefined,
      existingElevatorDescription:
        String(form.get("existingElevatorDescription") ?? "").trim() ||
        undefined,
      renovationGoal:
        String(form.get("renovationGoal") ?? "").trim() || undefined,
    };
    setOperation("saving");
    setError(null);
    setErrorScope(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | { requirement?: Requirement; error?: { message?: string } }
        | null;
      if (!response.ok || !body?.requirement) {
        throw new Error(body?.error?.message ?? "需求保存失败。");
      }
      setRequirement(body.requirement);
      setSuccess("需求修改已保存。");
      router.refresh();
    } finally {
      setOperation("idle");
    }
  }

  async function confirmRequirement() {
    if (!requirement || pending) return;
    setOperation("confirming");
    setError(null);
    setErrorScope(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/requirements/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedVersion: requirement.version }),
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { requirement?: Requirement; error?: { message?: string } }
        | null;
      if (!response.ok || !body?.requirement) {
        throw new Error(body?.error?.message ?? "需求确认失败。");
      }
      setRequirement(body.requirement);
      setSuccess("需求已由客户确认。工程条件仍需专业审核。");
      router.refresh();
    } finally {
      setOperation("idle");
    }
  }

  async function runSelection() {
    if (!requirement || pending) return;
    setOperation("selecting");
    setError(null);
    setErrorScope(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/selection-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementVersion: requirement.version }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "选型失败。");
      }
      router.push(`/projects/${projectId}`);
      router.refresh();
    } finally {
      setOperation("idle");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              className={`rounded-xl p-4 ${
                message.role === "USER"
                  ? "ml-10 bg-cyan-800 text-white"
                  : "mr-6 bg-slate-100 text-slate-800"
              }`}
              key={message.id}
            >
              <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
              {message.role === "ASSISTANT" ? (
                <p className="mt-2 text-[11px] uppercase tracking-wide opacity-60">
                  {getAdvisorProviderPresentation(message.provider).label}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <textarea
            className="admin-input min-h-28"
            disabled={pending}
            maxLength={4_000}
            onChange={(event) => setText(event.target.value)}
            placeholder="例如：住宅旧楼加装，8层，层高约3米，预算40-50万，外装可以考虑。"
            value={text}
          />
          <div className="mt-2">
            <FormFeedback
              kind="error"
              message={errorScope === "chat" ? error : null}
            />
          </div>
          <button className="admin-button mt-3" disabled={pending} onClick={() => void send()} type="button">
            {operation === "sending" ? "Mock AI 正在整理…" : "发送"}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">结构化需求</h2>
          {scenario ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={scenario.label} tone={scenario.tone} />
                {requirement ? (
                  <StatusBadge
                    label={
                      getRequirementStatusPresentation(requirement.status).label
                    }
                    tone={
                      getRequirementStatusPresentation(requirement.status).tone
                    }
                  />
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {scenario.description}
              </p>
            </div>
          ) : null}
          {requirement ? (
            <p className="mt-1 text-xs text-slate-500">
              版本 {requirement.version} · 客户确认不替代工程专业审核
            </p>
          ) : null}
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveRequirement(new FormData(event.currentTarget)).catch((saveError: unknown) => {
                setErrorScope("form");
                setError(saveError instanceof Error ? saveError.message : "需求保存失败。");
              });
            }}
          >
            <label className="block text-sm font-medium">
              建筑用途
              <input
                className="admin-input mt-1"
                defaultValue={requirement?.fields.buildingUse ?? ""}
                disabled={pending}
                maxLength={80}
                name="buildingUse"
              />
            </label>
            <label className="block text-sm font-medium">
              建筑类型
              <input
                className="admin-input mt-1"
                defaultValue={requirement?.fields.buildingType ?? ""}
                disabled={pending}
                maxLength={80}
                name="buildingType"
              />
            </label>
            <label className="block text-sm font-medium">
              楼层
              <input
                aria-describedby={
                  fieldErrors.floorCount ? "floor-count-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.floorCount)}
                className="admin-input mt-1"
                defaultValue={requirement?.fields.floorCount ?? ""}
                disabled={pending}
                max="200"
                min="1"
                name="floorCount"
                step="1"
                type="number"
              />
              {fieldErrors.floorCount ? (
                <span
                  className="mt-1 block text-xs text-red-700"
                  id="floor-count-error"
                >
                  {fieldErrors.floorCount}
                </span>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              层高（米）
              <input
                aria-describedby={
                  fieldErrors.floorHeight ? "floor-height-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.floorHeight)}
                className="admin-input mt-1"
                defaultValue={requirement?.fields.floorHeight ?? ""}
                disabled={pending}
                max="20"
                min="0.1"
                name="floorHeight"
                step="0.1"
                type="number"
              />
              {fieldErrors.floorHeight ? (
                <span
                  className="mt-1 block text-xs text-red-700"
                  id="floor-height-error"
                >
                  {fieldErrors.floorHeight}
                </span>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              建筑总高（米，可选）
              <input
                aria-describedby={
                  fieldErrors.buildingHeight
                    ? "building-height-error"
                    : undefined
                }
                aria-invalid={Boolean(fieldErrors.buildingHeight)}
                className="admin-input mt-1"
                defaultValue={requirement?.fields.buildingHeight ?? ""}
                disabled={pending}
                max="1000"
                min="0.1"
                name="buildingHeight"
                step="0.1"
                type="number"
              />
              {fieldErrors.buildingHeight ? (
                <span
                  className="mt-1 block text-xs text-red-700"
                  id="building-height-error"
                >
                  {fieldErrors.buildingHeight}
                </span>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              参考预算下限（元，可选）
              <input
                aria-describedby={
                  fieldErrors.budgetMin ? "budget-min-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.budgetMin)}
                className="admin-input mt-1"
                defaultValue={requirement?.fields.budgetMin ?? ""}
                disabled={pending}
                max="1000000000"
                min="0"
                name="budgetMin"
                step="1"
                type="number"
              />
              {fieldErrors.budgetMin ? (
                <span
                  className="mt-1 block text-xs text-red-700"
                  id="budget-min-error"
                >
                  {fieldErrors.budgetMin}
                </span>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              参考预算上限（元）
              <input
                aria-describedby={
                  fieldErrors.budgetMax ? "budget-max-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.budgetMax)}
                className="admin-input mt-1"
                defaultValue={requirement?.fields.budgetMax ?? ""}
                disabled={pending}
                max="1000000000"
                min="1"
                name="budgetMax"
                step="1"
                type="number"
              />
              {fieldErrors.budgetMax ? (
                <span
                  className="mt-1 block text-xs text-red-700"
                  id="budget-max-error"
                >
                  {fieldErrors.budgetMax}
                </span>
              ) : null}
            </label>
            <label className="block text-sm font-medium">
              是否允许外装
              <select
                className="admin-input mt-1"
                defaultValue={
                  requirement?.fields.externalInstallationAllowed === undefined
                    ? ""
                    : String(requirement.fields.externalInstallationAllowed)
                }
                disabled={pending}
                name="externalInstallationAllowed"
              >
                <option value="">待确认</option>
                <option value="true">可以</option>
                <option value="false">不可以</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              图纸状态
              <select
                className="admin-input mt-1"
                defaultValue={requirement?.fields.drawingStatus ?? ""}
                disabled={pending}
                name="drawingStatus"
              >
                <option value="">未填写</option>
                <option value="NONE">暂无图纸</option>
                <option value="AVAILABLE_NOT_ANALYZED">有图纸，尚未解析</option>
                <option value="ANALYSIS_UNAVAILABLE">图纸解析暂不可用</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              建筑情况说明
              <textarea
                className="admin-input mt-1 min-h-20"
                defaultValue={requirement?.fields.buildingDescription ?? ""}
                disabled={pending}
                maxLength={4_000}
                name="buildingDescription"
              />
            </label>
            <label className="block text-sm font-medium">
              现场条件
              <textarea
                className="admin-input mt-1 min-h-20"
                defaultValue={requirement?.fields.siteConditions ?? ""}
                disabled={pending}
                maxLength={4_000}
                name="siteConditions"
              />
            </label>
            <label className="block text-sm font-medium">
              原有电梯情况（旧电梯更新）
              <textarea
                className="admin-input mt-1 min-h-20"
                defaultValue={
                  requirement?.fields.existingElevatorDescription ?? ""
                }
                disabled={pending}
                maxLength={4_000}
                name="existingElevatorDescription"
              />
            </label>
            <label className="block text-sm font-medium">
              改造目标（旧电梯更新）
              <textarea
                className="admin-input mt-1 min-h-20"
                defaultValue={requirement?.fields.renovationGoal ?? ""}
                disabled={pending}
                maxLength={2_000}
                name="renovationGoal"
              />
            </label>
            <button
              className="admin-button-secondary"
              disabled={pending}
              type="submit"
            >
              {operation === "saving" ? "正在保存…" : "保存修改"}
            </button>
          </form>

          {requirement?.missingFields.length ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              待补充：
              {getMissingFieldLabels(requirement.missingFields).join("、")}
            </p>
          ) : null}
          <div className="mt-3 space-y-2">
            <FormFeedback
              kind="error"
              message={errorScope === "form" ? error : null}
            />
            <FormFeedback kind="success" message={success} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="admin-button-secondary"
              disabled={
                pending ||
                !requirement ||
                requirement.missingFields.length > 0 ||
                requirement.status === "CUSTOMER_CONFIRMED"
              }
              onClick={() =>
                void confirmRequirement().catch((confirmError: unknown) => {
                  setErrorScope("form");
                  setError(
                    confirmError instanceof Error
                      ? confirmError.message
                      : "需求确认失败。",
                  );
                })
              }
              type="button"
            >
              {operation === "confirming"
                ? "正在确认…"
                : requirement?.status === "CUSTOMER_CONFIRMED"
                  ? "需求已确认"
                  : "确认需求"}
            </button>
            <button
              className="admin-button"
              disabled={
                pending || requirement?.status !== "CUSTOMER_CONFIRMED"
              }
              onClick={() =>
                void runSelection().catch((selectionError: unknown) => {
                  setErrorScope("form");
                  setError(
                    selectionError instanceof Error
                      ? selectionError.message
                      : "选型失败。",
                  );
                })
              }
              type="button"
            >
              {operation === "selecting" ? "正在生成…" : "生成初步方案"}
            </button>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            需求确认只表示客户提供了基础信息，不表示工程条件已经专业确认。
          </p>
          {requirement?.installationScenario === "NEW_BUILDING_INSTALLATION" ? (
            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              图纸解析 Adapter 尚未接入真实解析服务。本页只记录图纸是否存在及其状态，不生成虚构识别结果。
            </p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
