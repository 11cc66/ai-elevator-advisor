import Link from "next/link";

import { PERMISSIONS } from "@/modules/access/permissions";
import { canAccessProject } from "@/modules/access/policy";
import { requireProjectPageAccess } from "@/modules/auth/page-session";
import {
  getLatestRequirement,
  listSelectionRuns,
} from "@/modules/mvp/store";
import { getProjectDetails } from "@/modules/projects/service";

import { CreateSalesHandoffForm } from "./project-actions";

export const dynamic = "force-dynamic";

const scenarioLabels: Record<string, string> = {
  OLD_BUILDING_ELEVATOR: "旧楼加装",
  OLD_BUILDING_ADDITION: "旧楼加装",
  EXISTING_ELEVATOR_RENOVATION: "现有电梯改造",
  NEW_BUILDING_INSTALLATION: "新楼安装",
};

export default async function CustomerProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { actor } = await requireProjectPageAccess(
    projectId,
    PERMISSIONS.PROJECT_READ,
  );
  const canUseAdvisor = canAccessProject(
    actor,
    projectId,
    PERMISSIONS.ADVISOR_USE,
  );
  const canCreateHandoff = canAccessProject(
    actor,
    projectId,
    PERMISSIONS.SALES_HANDOFF_CREATE,
  );
  const [project, requirement, runs] = await Promise.all([
    getProjectDetails(projectId),
    getLatestRequirement(projectId),
    listSelectionRuns(projectId),
  ]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Link className="text-sm text-cyan-800" href="/projects">← 返回项目列表</Link>
      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{project.projectCode}</p>
            <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
            <p className="mt-2 text-slate-600">
              {scenarioLabels[project.projectType] ?? project.projectType} · {project.address}
            </p>
          </div>
          <span className="demo-badge">{project.dataClassification}</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {canUseAdvisor ? (
            <Link className="admin-button" href={`/projects/${projectId}/advisor`}>AI 需求顾问</Link>
          ) : null}
          <Link className="admin-button-secondary" href={`/projects/${projectId}/files`}>项目资料</Link>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">需求摘要</h2>
              {requirement ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                  v{requirement.version} · {requirement.status}
                </span>
              ) : null}
            </div>
            {!requirement ? (
              <p className="mt-4 text-slate-500">尚未建立需求，请先从 AI 顾问开始。</p>
            ) : (
              <>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">建筑用途</dt><dd>{requirement.fields.buildingUse ?? "待确认"}</dd></div>
                  <div><dt className="text-slate-500">楼层</dt><dd>{requirement.fields.floorCount ?? "待确认"}</dd></div>
                  <div><dt className="text-slate-500">层高</dt><dd>{requirement.fields.floorHeight ? `${requirement.fields.floorHeight} m` : "待确认"}</dd></div>
                  <div><dt className="text-slate-500">预算上限</dt><dd>{requirement.fields.budgetMax ? `¥${requirement.fields.budgetMax.toLocaleString("zh-CN")}` : "待确认"}</dd></div>
                  <div><dt className="text-slate-500">外装条件</dt><dd>{requirement.fields.externalInstallationAllowed === undefined ? "待确认" : requirement.fields.externalInstallationAllowed ? "可以考虑" : "不允许"}</dd></div>
                  <div><dt className="text-slate-500">专业审核</dt><dd>{requirement.professionalReviewRequired ? "需要" : "不需要"}</dd></div>
                </dl>
                {requirement.missingFields.length > 0 ? (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    待补充：{requirement.missingFields.join("、")}
                  </p>
                ) : null}
              </>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">初步推荐历史</h2>
            {runs.length === 0 ? (
              <p className="mt-4 text-slate-500">尚无选型结果。</p>
            ) : (
              <div className="mt-4 space-y-5">
                {runs.map((run) => {
                  const candidates = [
                    ...run.result.recommendations,
                    ...run.result.alternatives,
                    ...run.result.improvementCandidates,
                  ];
                  return (
                  <section className="rounded-xl bg-slate-50 p-4" key={run.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{run.status === "COMPLETED" ? "初步匹配完成" : "无有效匹配"}</p>
                      <span className="text-xs text-slate-500">{run.createdAt.toLocaleString("zh-CN")}</span>
                    </div>
                    {candidates.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-600">
                        当前没有满足全部硬约束或预算条件的 DEMO 产品。
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {candidates.length > 1 ? (
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full min-w-[720px] text-left text-sm">
                              <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                  <th className="px-3 py-2">方案</th>
                                  <th className="px-3 py-2">预算</th>
                                  <th className="px-3 py-2">载重 / 速度</th>
                                  <th className="px-3 py-2">层数 / 行程</th>
                                  <th className="px-3 py-2">数据状态</th>
                                </tr>
                              </thead>
                              <tbody>
                                {candidates.map((candidate) => (
                                  <tr
                                    className="border-t border-slate-100"
                                    key={`compare-${run.id}-${candidate.product.productId}`}
                                  >
                                    <td className="px-3 py-2">
                                      {candidate.product.modelCode} · {candidate.recommendationType}
                                    </td>
                                    <td className="px-3 py-2">
                                      {candidate.budgetAssessment}
                                    </td>
                                    <td className="px-3 py-2">
                                      {candidate.product.specification.capacityKg ?? "待确认"} kg / {candidate.product.specification.speedMps ?? "待确认"} m/s
                                    </td>
                                    <td className="px-3 py-2">
                                      {candidate.product.specification.maxFloors ?? "待确认"} / {candidate.product.specification.maxTravelM ?? "待确认"} m
                                    </td>
                                    <td className="px-3 py-2">{candidate.dataClassification}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                        {candidates.map((candidate) => (
                          <div className="rounded-lg border border-slate-200 bg-white p-4" key={`${run.id}-${candidate.product.productId}-${candidate.recommendationType}`}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold">{candidate.product.manufacturer} · {candidate.product.brand} {candidate.product.modelCode}</p>
                                <p className="text-sm text-slate-500">{candidate.product.name}</p>
                              </div>
                              <span className="demo-badge">{candidate.dataClassification}</span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              预算判断：{candidate.budgetAssessment} · 参考价格：
                              {candidate.product.price?.minimumAmount
                                ? `¥${candidate.product.price.minimumAmount.toLocaleString("zh-CN")} 起`
                                : "待询价"}
                            </p>
                            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                              {candidate.matchingReasons.map((reason) => <li key={reason}>{reason}</li>)}
                              {candidate.warnings.map((warning) => <li className="text-amber-800" key={warning}>{warning}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {run.result.riskWarnings.join("；")} 规则版本：{run.rulesVersion}
                    </p>
                  </section>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <aside className="space-y-6">
          {canCreateHandoff ? <CreateSalesHandoffForm projectId={projectId} /> : null}
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <h2 className="font-semibold">专业边界</h2>
            <p className="mt-2">
              当前页面展示的是 DEMO_MOCK 的初步建议，不替代现场勘察、结构评估、正式技术审核或销售报价。
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
