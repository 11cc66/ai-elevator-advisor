import Link from "next/link";

import type {
  ProjectWorkbench,
  WorkbenchStepState,
} from "@/modules/workbench/presentation";

import { StatusBadge } from "./status-badge";

const STEP_CLASSES: Record<WorkbenchStepState, string> = {
  COMPLETE: "border-emerald-200 bg-emerald-50 text-emerald-900",
  CURRENT: "border-cyan-300 bg-cyan-50 text-cyan-950",
  PENDING: "border-slate-200 bg-slate-50 text-slate-600",
  ATTENTION: "border-amber-300 bg-amber-50 text-amber-950",
  RESTRICTED: "border-slate-300 bg-slate-100 text-slate-700",
};

const STEP_LABELS: Record<WorkbenchStepState, string> = {
  COMPLETE: "已完成",
  CURRENT: "当前",
  PENDING: "待开始",
  ATTENTION: "需处理",
  RESTRICTED: "权限受限",
};

export function ProjectWorkbenchSummary({
  workbench,
  actionHref,
}: {
  workbench: ProjectWorkbench;
  actionHref: string | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-cyan-800">项目进展</p>
          <h2 className="mt-1 text-xl font-semibold">当前处理路径</h2>
        </div>
        <StatusBadge
          label={`已记录 ${workbench.completedCount}/4 个阶段`}
          tone="info"
        />
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {workbench.steps.map((step, index) => (
          <li
            className={`rounded-xl border p-4 ${STEP_CLASSES[step.state]}`}
            key={step.id}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
                步骤 {index + 1}
              </span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium">
                {STEP_LABELS[step.state]}
              </span>
            </div>
            <p className="mt-3 font-semibold">{step.title}</p>
            <p className="mt-1 text-sm leading-6 opacity-80">{step.detail}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
            下一步
          </p>
          <p className="mt-2 font-semibold text-cyan-950">
            {workbench.nextAction.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-cyan-900">
            {workbench.nextAction.description}
          </p>
          {actionHref && workbench.nextAction.actionLabel ? (
            <Link className="admin-button mt-4 inline-block" href={actionHref}>
              {workbench.nextAction.actionLabel}
            </Link>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <h3 className="font-semibold">已完成</h3>
            {workbench.completedItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">暂无已记录事项。</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {workbench.completedItems.map((item) => (
                  <li key={item}>✓ {item}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <h3 className="font-semibold">待处理</h3>
            {workbench.pendingItems.length === 0 ? (
              <p className="mt-2 text-sm text-amber-900">
                当前记录中没有待处理事项。
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-amber-950">
                {workbench.pendingItems.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        {workbench.professionalReviewNote}
      </p>
    </section>
  );
}
