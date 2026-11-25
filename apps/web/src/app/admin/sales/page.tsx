import { redirect } from "next/navigation";

import { loadActor } from "@/modules/access/actor";
import { PERMISSIONS } from "@/modules/access/permissions";
import { hasGlobalPermission } from "@/modules/access/policy";
import { requirePageSession } from "@/modules/auth/page-session";
import { listSalesHandoffs } from "@/modules/mvp/store";

import { FollowUpForm } from "./follow-up-form";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const session = await requirePageSession("/admin/sales");
  const actor = await loadActor(session.user.id);
  const hasScopedSalesAccess = [...actor.projectPermissions.values()].some(
    (permissions) => permissions.has(PERMISSIONS.SALES_MANAGE),
  );
  if (
    !hasGlobalPermission(actor, PERMISSIONS.SALES_MANAGE) &&
    !hasScopedSalesAccess
  ) {
    redirect("/admin/forbidden");
  }
  const all = await listSalesHandoffs();
  const handoffs = hasGlobalPermission(actor, PERMISSIONS.SALES_MANAGE)
    ? all
    : all.filter((handoff) =>
        actor.projectPermissions
          .get(handoff.projectId)
          ?.has(PERMISSIONS.SALES_MANAGE),
      );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-cyan-800">销售交接</p>
        <h1 className="mt-1 text-3xl font-semibold">待跟进项目</h1>
        <p className="mt-2 text-slate-600">仅记录内部跟进，不形成正式报价。</p>
      </header>
      {handoffs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-500">暂无销售交接。</p>
      ) : (
        handoffs.map((handoff) => (
          <section className="rounded-2xl border border-slate-200 bg-white p-6" key={handoff.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{handoff.projectName}</h2>
                <p className="mt-1 text-sm text-slate-500">{handoff.status}</p>
              </div>
              <span className="text-xs text-slate-500">{handoff.createdAt.toLocaleString("zh-CN")}</span>
            </div>
            <p className="mt-3 text-sm text-slate-700">{handoff.summary}</p>
            {handoff.budgetConcern ? <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">预算事项：{handoff.budgetConcern}</p> : null}
            {handoff.requirement ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium">客户需求 v{handoff.requirement.version} · {handoff.requirement.status}</p>
                <p className="mt-2">
                  {handoff.requirement.installationScenario} · {handoff.requirement.fields.buildingUse ?? "用途待确认"} ·
                  楼层 {handoff.requirement.fields.floorCount ?? "待确认"} ·
                  预算上限 {handoff.requirement.fields.budgetMax ? `¥${handoff.requirement.fields.budgetMax.toLocaleString("zh-CN")}` : "待确认"}
                </p>
                {handoff.requirement.missingFields.length > 0 ? (
                  <p className="mt-2 text-amber-800">待确认：{handoff.requirement.missingFields.join("、")}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">尚无结构化需求。</p>
            )}
            {handoff.selectionRun ? (
              <div className="mt-3 rounded-xl border border-slate-200 p-4 text-sm">
                <p className="font-medium">初步选型：{handoff.selectionRun.status}</p>
                {handoff.selectionRun.result.recommendations[0] ? (
                  <p className="mt-2 text-slate-700">
                    首选 {handoff.selectionRun.result.recommendations[0].product.manufacturer} ·
                    {handoff.selectionRun.result.recommendations[0].product.modelCode} ·
                    {handoff.selectionRun.result.recommendations[0].dataClassification}
                  </p>
                ) : (
                  <p className="mt-2 text-slate-500">当前没有有效推荐，需人工核对约束。</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">尚无初步选型记录。</p>
            )}
            {handoff.followUpNotes.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {handoff.followUpNotes.map((note) => <li key={note.id}>{note.contactStatus} · {note.note}</li>)}
              </ul>
            ) : null}
            <FollowUpForm handoffId={handoff.id} />
          </section>
        ))
      )}
    </div>
  );
}
