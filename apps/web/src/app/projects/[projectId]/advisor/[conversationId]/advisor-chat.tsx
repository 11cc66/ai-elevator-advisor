"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [pending, setPending] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setPending(true);
    setError(null);
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
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "发送失败。");
    } finally {
      setPending(false);
    }
  }

  async function saveRequirement(form: FormData) {
    const payload = {
      buildingUse: String(form.get("buildingUse") ?? "") || undefined,
      buildingType: String(form.get("buildingType") ?? "") || undefined,
      floorCount: form.get("floorCount") ? Number(form.get("floorCount")) : undefined,
      floorHeight: form.get("floorHeight") ? Number(form.get("floorHeight")) : undefined,
      buildingHeight: form.get("buildingHeight") ? Number(form.get("buildingHeight")) : undefined,
      budgetMin: form.get("budgetMin") ? Number(form.get("budgetMin")) : undefined,
      budgetMax: form.get("budgetMax") ? Number(form.get("budgetMax")) : undefined,
      externalInstallationAllowed:
        form.get("externalInstallationAllowed") === ""
          ? undefined
          : form.get("externalInstallationAllowed") === "true",
      buildingDescription:
        String(form.get("buildingDescription") ?? "") || undefined,
      siteConditions: String(form.get("siteConditions") ?? "") || undefined,
      drawingStatus:
        String(form.get("drawingStatus") ?? "") || undefined,
      existingElevatorDescription:
        String(form.get("existingElevatorDescription") ?? "") || undefined,
      renovationGoal:
        String(form.get("renovationGoal") ?? "") || undefined,
    };
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
    router.refresh();
  }

  async function confirmRequirement() {
    if (!requirement) return;
    const response = await fetch(`/api/projects/${projectId}/requirements/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: requirement.version }),
    });
    const body = (await response.json().catch(() => null)) as
      | { requirement?: Requirement; error?: { message?: string } }
      | null;
    if (!response.ok || !body?.requirement) {
      throw new Error(body?.error?.message ?? "需求确认失败。");
    }
    setRequirement(body.requirement);
    router.refresh();
  }

  async function runSelection() {
    if (!requirement) return;
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
                  {message.provider === "MOCK" ? "Mock AI" : "Real Provider"}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <textarea
            className="admin-input min-h-28"
            onChange={(event) => setText(event.target.value)}
            placeholder="例如：住宅旧楼加装，8层，层高约3米，预算40-50万，外装可以考虑。"
            value={text}
          />
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          <button className="admin-button mt-3" disabled={pending} onClick={() => void send()} type="button">
            {pending ? "Mock AI 正在整理…" : "发送"}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">结构化需求</h2>
          {requirement ? (
            <p className="mt-1 text-xs text-slate-500">
              版本 {requirement.version} · {requirement.status}
            </p>
          ) : null}
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveRequirement(new FormData(event.currentTarget)).catch((saveError: unknown) => {
                setError(saveError instanceof Error ? saveError.message : "需求保存失败。");
              });
            }}
          >
            <label className="block text-sm font-medium">
              建筑用途
              <input className="admin-input mt-1" defaultValue={requirement?.fields.buildingUse ?? ""} name="buildingUse" />
            </label>
            <label className="block text-sm font-medium">
              建筑类型
              <input className="admin-input mt-1" defaultValue={requirement?.fields.buildingType ?? ""} name="buildingType" />
            </label>
            <label className="block text-sm font-medium">
              楼层
              <input className="admin-input mt-1" defaultValue={requirement?.fields.floorCount ?? ""} min="1" name="floorCount" type="number" />
            </label>
            <label className="block text-sm font-medium">
              层高（米）
              <input className="admin-input mt-1" defaultValue={requirement?.fields.floorHeight ?? ""} min="1" name="floorHeight" step="0.1" type="number" />
            </label>
            <label className="block text-sm font-medium">
              建筑总高（米，可选）
              <input className="admin-input mt-1" defaultValue={requirement?.fields.buildingHeight ?? ""} min="1" name="buildingHeight" step="0.1" type="number" />
            </label>
            <label className="block text-sm font-medium">
              参考预算下限（元，可选）
              <input className="admin-input mt-1" defaultValue={requirement?.fields.budgetMin ?? ""} min="0" name="budgetMin" type="number" />
            </label>
            <label className="block text-sm font-medium">
              参考预算上限（元）
              <input className="admin-input mt-1" defaultValue={requirement?.fields.budgetMax ?? ""} min="0" name="budgetMax" type="number" />
            </label>
            <label className="block text-sm font-medium">
              是否允许外装
              <select className="admin-input mt-1" defaultValue={requirement?.fields.externalInstallationAllowed === undefined ? "" : String(requirement.fields.externalInstallationAllowed)} name="externalInstallationAllowed">
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
              <textarea className="admin-input mt-1 min-h-20" defaultValue={requirement?.fields.buildingDescription ?? ""} name="buildingDescription" />
            </label>
            <label className="block text-sm font-medium">
              现场条件
              <textarea className="admin-input mt-1 min-h-20" defaultValue={requirement?.fields.siteConditions ?? ""} name="siteConditions" />
            </label>
            <label className="block text-sm font-medium">
              原有电梯情况（旧梯改造）
              <textarea className="admin-input mt-1 min-h-20" defaultValue={requirement?.fields.existingElevatorDescription ?? ""} name="existingElevatorDescription" />
            </label>
            <label className="block text-sm font-medium">
              改造目标（旧梯改造）
              <textarea className="admin-input mt-1 min-h-20" defaultValue={requirement?.fields.renovationGoal ?? ""} name="renovationGoal" />
            </label>
            <button className="admin-button-secondary" type="submit">保存修改</button>
          </form>

          {requirement?.missingFields.length ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              待补充：{requirement.missingFields.join("、")}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="admin-button-secondary"
              onClick={() => void confirmRequirement().catch((confirmError: unknown) => setError(confirmError instanceof Error ? confirmError.message : "需求确认失败。"))}
              type="button"
            >
              确认需求
            </button>
            <button
              className="admin-button"
              disabled={requirement?.status !== "CUSTOMER_CONFIRMED"}
              onClick={() => void runSelection().catch((selectionError: unknown) => setError(selectionError instanceof Error ? selectionError.message : "选型失败。"))}
              type="button"
            >
              初步选型
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
