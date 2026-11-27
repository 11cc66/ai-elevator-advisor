import Link from "next/link";
import { notFound } from "next/navigation";

import { PERMISSIONS } from "@/modules/access/permissions";
import { canAccessProject } from "@/modules/access/policy";
import { requireProjectPageAccess } from "@/modules/auth/page-session";
import {
  getLatestSalesHandoff,
  getLatestRequirement,
  listSelectionRuns,
} from "@/modules/mvp/store";
import { getProjectDetails } from "@/modules/projects/service";
import {
  buildProjectWorkbench,
  getBudgetAssessmentPresentation,
  getDataClassificationPresentation,
  getMissingFieldLabels,
  getProjectRecordStatusLabel,
  getRecommendationTypePresentation,
  getRequirementStatusPresentation,
  getSalesStatusPresentation,
  getScenarioPresentation,
  getSelectionStatusPresentation,
} from "@/modules/workbench/presentation";
import { loadVisibleWorkbenchSalesHandoff } from "@/modules/workbench/visibility";
import { AppError } from "@/server/http/errors";

import { CreateSalesHandoffForm } from "./project-actions";
import { StatusBadge } from "@/components/status-badge";
import { ProjectWorkbenchSummary } from "@/components/project-workbench-summary";

export const dynamic = "force-dynamic";

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
  const canManageSales = canAccessProject(
    actor,
    projectId,
    PERMISSIONS.SALES_MANAGE,
  );
  let project: Awaited<ReturnType<typeof getProjectDetails>>;
  let requirement: Awaited<ReturnType<typeof getLatestRequirement>>;
  let runs: Awaited<ReturnType<typeof listSelectionRuns>>;
  let salesHandoff: Awaited<ReturnType<typeof getLatestSalesHandoff>>;

  try {
    [project, requirement, runs, salesHandoff] = await Promise.all([
      getProjectDetails(projectId),
      getLatestRequirement(projectId),
      listSelectionRuns(projectId),
      loadVisibleWorkbenchSalesHandoff({
        allowed: canManageSales,
        load: () => getLatestSalesHandoff(projectId),
      }),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.code === "PROJECT_NOT_FOUND") {
      notFound();
    }
    throw error;
  }
  const scenario = getScenarioPresentation(project.projectType);
  const projectRecordStatus = getProjectRecordStatusLabel(project.status);
  const classification = getDataClassificationPresentation(
    project.dataClassification,
  );
  const workbench = buildProjectWorkbench({
    projectStatus: project.status,
    requirement,
    selectionRuns: runs,
    salesHandoff,
    salesVisible: canManageSales,
    canRequestSalesFollowUp: canCreateHandoff,
  });
  const actionHref =
    workbench.nextAction.target === "advisor" && canUseAdvisor
      ? `/projects/${projectId}/advisor`
      : workbench.nextAction.target === "sales" && canManageSales
        ? "/admin/sales"
        : workbench.nextAction.target === "sales" && canCreateHandoff
          ? "#sales-handoff"
          : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Link className="text-sm text-cyan-800" href="/projects">← 返回项目列表</Link>
      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{project.projectCode}</p>
            <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
            <p className="mt-2 text-slate-600">{project.address}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={scenario.label} tone={scenario.tone} />
            <StatusBadge label={projectRecordStatus} tone="neutral" />
            <StatusBadge
              label={classification.label}
              tone={classification.tone}
            />
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {scenario.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {canUseAdvisor ? (
            <Link className="admin-button" href={`/projects/${projectId}/advisor`}>AI 需求顾问</Link>
          ) : null}
          <Link className="admin-button-secondary" href={`/projects/${projectId}/files`}>项目资料</Link>
        </div>
      </header>

      <div className="mt-6">
        <ProjectWorkbenchSummary
          actionHref={actionHref}
          workbench={workbench}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">需求摘要</h2>
              {requirement ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                    v{requirement.version}
                  </span>
                  <StatusBadge
                    label={getRequirementStatusPresentation(requirement.status).label}
                    tone={getRequirementStatusPresentation(requirement.status).tone}
                  />
                </div>
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
                    待补充：
                    {getMissingFieldLabels(requirement.missingFields).join("、")}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">初步匹配结果</p>
                        <StatusBadge
                          label={getSelectionStatusPresentation(run.status).label}
                          tone={getSelectionStatusPresentation(run.status).tone}
                        />
                      </div>
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
                                  <th className="px-3 py-2">适用场景</th>
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
                                      {candidate.product.modelCode} ·{" "}
                                      {
                                        getRecommendationTypePresentation(
                                          candidate.recommendationType,
                                        ).label
                                      }
                                    </td>
                                    <td className="px-3 py-2">
                                      {
                                        getBudgetAssessmentPresentation(
                                          candidate.budgetAssessment,
                                        ).label
                                      }
                                    </td>
                                    <td className="px-3 py-2">
                                      {candidate.product.specification.capacityKg ?? "待确认"} kg / {candidate.product.specification.speedMps ?? "待确认"} m/s
                                    </td>
                                    <td className="px-3 py-2">
                                      {candidate.product.specification.maxFloors ?? "待确认"} / {candidate.product.specification.maxTravelM ?? "待确认"} m
                                    </td>
                                    <td className="px-3 py-2">
                                      {candidate.product.applicableScenarios
                                        .map(
                                          (item) =>
                                            getScenarioPresentation(item).label,
                                        )
                                        .join("、") || "待确认"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {
                                        getDataClassificationPresentation(
                                          candidate.dataClassification,
                                        ).label
                                      }
                                    </td>
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
                              <StatusBadge
                                label={
                                  getRecommendationTypePresentation(
                                    candidate.recommendationType,
                                  ).label
                                }
                                tone={
                                  getRecommendationTypePresentation(
                                    candidate.recommendationType,
                                  ).tone
                                }
                              />
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              预算判断：
                              {
                                getBudgetAssessmentPresentation(
                                  candidate.budgetAssessment,
                                ).label
                              }{" "}
                              · 参考价格：
                              {candidate.product.price?.minimumAmount
                                ? `¥${candidate.product.price.minimumAmount.toLocaleString("zh-CN")} 起`
                                : "待询价"}
                            </p>
                            <p className="mt-2 text-sm text-slate-600">
                              数据状态：
                              {
                                getDataClassificationPresentation(
                                  candidate.dataClassification,
                                ).label
                              }
                            </p>
                            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                              {candidate.matchingReasons.map((reason) => <li key={reason}>{reason}</li>)}
                              {candidate.warnings.map((warning) => <li className="text-amber-800" key={warning}>{warning}</li>)}
                            </ul>
                            <p className="mt-3 text-xs leading-5 text-slate-500">
                              数据来源：
                              {candidate.sourceReferences.join("；") ||
                                "待补充"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {run.result.missingInformation.length > 0 ? (
                      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                        尚缺信息：
                        {getMissingFieldLabels(
                          run.result.missingInformation,
                        ).join("、")}
                      </p>
                    ) : null}
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
          {canManageSales ? (
            <section
              className="rounded-2xl border border-slate-200 bg-white p-5"
              id="sales-progress"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">销售进展</h2>
                {salesHandoff ? (
                  <StatusBadge
                    label={
                      getSalesStatusPresentation(salesHandoff.status).label
                    }
                    tone={getSalesStatusPresentation(salesHandoff.status).tone}
                  />
                ) : (
                  <StatusBadge label="尚未提交" tone="neutral" />
                )}
              </div>
              {salesHandoff ? (
                <>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {salesHandoff.summary ?? "暂无销售交接摘要。"}
                  </p>
                  {salesHandoff.budgetConcern ? (
                    <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                      预算事项：{salesHandoff.budgetConcern}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-slate-500">
                    最近更新：{salesHandoff.updatedAt.toLocaleString("zh-CN")}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  尚无销售交接记录。
                </p>
              )}
            </section>
          ) : null}
          {canCreateHandoff ? (
            <div id="sales-handoff">
              <CreateSalesHandoffForm projectId={projectId} />
            </div>
          ) : null}
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
