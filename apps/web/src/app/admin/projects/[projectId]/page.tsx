import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { loadActor } from "@/modules/access/actor";
import { PERMISSIONS } from "@/modules/access/permissions";
import { canAccessProject } from "@/modules/access/policy";
import { requirePageSession } from "@/modules/auth/page-session";
import {
  getLatestSalesHandoff,
  getLatestRequirement,
  listSelectionRuns,
} from "@/modules/mvp/store";
import { getProjectDetails } from "@/modules/projects/service";
import {
  buildProjectWorkbench,
  getBuildingStatusPresentation,
  getDataClassificationPresentation,
  getInstallationUnitStatusPresentation,
  getProjectRecordStatusLabel,
  getSalesStatusPresentation,
  getScenarioPresentation,
} from "@/modules/workbench/presentation";
import { loadVisibleWorkbenchSalesHandoff } from "@/modules/workbench/visibility";
import { AppError } from "@/server/http/errors";

import { BuildingForm } from "./building-form";
import { UnitForm } from "./unit-form";
import { ProjectWorkbenchSummary } from "@/components/project-workbench-summary";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requirePageSession(
    `/admin/projects/${projectId}`,
  );
  const actor = await loadActor(session.user.id);

  if (
    !canAccessProject(actor, projectId, PERMISSIONS.PROJECT_READ)
  ) {
    redirect("/admin/forbidden");
  }

  let project;

  try {
    project = await getProjectDetails(projectId);
  } catch (error) {
    if (error instanceof AppError && error.code === "PROJECT_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const canManage = canAccessProject(
    actor,
    projectId,
    PERMISSIONS.PROJECT_MANAGE,
  );
  const canUseAdvisor = canAccessProject(
    actor,
    projectId,
    PERMISSIONS.ADVISOR_USE,
  );
  const canManageSales = canAccessProject(
    actor,
    projectId,
    PERMISSIONS.SALES_MANAGE,
  );
  const canCreateHandoff = canAccessProject(
    actor,
    projectId,
    PERMISSIONS.SALES_HANDOFF_CREATE,
  );
  const [requirement, selectionRuns, salesHandoff] = await Promise.all([
    getLatestRequirement(projectId),
    listSelectionRuns(projectId),
    loadVisibleWorkbenchSalesHandoff({
      allowed: canManageSales,
      load: () => getLatestSalesHandoff(projectId),
    }),
  ]);
  const scenario = getScenarioPresentation(project.projectType);
  const projectRecordStatus = getProjectRecordStatusLabel(project.status);
  const classification = getDataClassificationPresentation(
    project.dataClassification,
  );
  const workbench = buildProjectWorkbench({
    projectStatus: project.status,
    requirement,
    selectionRuns,
    salesHandoff,
    salesVisible: canManageSales,
    canRequestSalesFollowUp: canCreateHandoff,
  });
  const actionHref =
    workbench.nextAction.target === "advisor" && canUseAdvisor
      ? `/projects/${project.id}/advisor`
      : workbench.nextAction.target === "sales" && canManageSales
        ? "/admin/sales"
        : workbench.nextAction.target === "sales" && canCreateHandoff
          ? `/projects/${project.id}#sales-handoff`
          : null;

  return (
    <div className="space-y-6">
      <Link className="text-sm text-cyan-800" href="/admin/projects">
        ← 返回项目列表
      </Link>
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{project.projectCode}</p>
            <h1 className="mt-1 text-3xl font-semibold">{project.name}</h1>
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
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {scenario.description}
        </p>
        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-slate-500">客户</dt>
            <dd className="mt-1">
              {project.customer.organizationName}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">联系人</dt>
            <dd className="mt-1">{project.customer.contactName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">地址</dt>
            <dd className="mt-1">{project.address}</dd>
          </div>
          <div>
            <dt className="text-slate-500">档案记录状态</dt>
            <dd className="mt-1">{projectRecordStatus}</dd>
          </div>
        </dl>
      </header>
      {!canManage ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
          当前账号对项目为只读状态。新增建筑、安装单元等按钮不会显示；实际写权限仍由服务端项目范围鉴权决定。
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {canUseAdvisor ? (
          <Link
            className="admin-button"
            href={`/projects/${project.id}/advisor`}
          >
            查看需求与初步方案
          </Link>
        ) : null}
        <Link
          className="admin-button-secondary"
          href={`/projects/${project.id}/files`}
        >
          查看项目资料文件
        </Link>
      </div>
      <ProjectWorkbenchSummary
        actionHref={actionHref}
        workbench={workbench}
      />
      {canManageSales ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">销售交接</h2>
              <p className="mt-1 text-sm text-slate-500">
                销售跟进不代表正式报价、合同或工程批准。
              </p>
            </div>
            {salesHandoff ? (
              <StatusBadge
                label={getSalesStatusPresentation(salesHandoff.status).label}
                tone={getSalesStatusPresentation(salesHandoff.status).tone}
              />
            ) : (
              <StatusBadge label="尚未提交" tone="neutral" />
            )}
          </div>
          {salesHandoff ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p>{salesHandoff.summary ?? "暂无销售交接摘要。"}</p>
              {salesHandoff.budgetConcern ? (
                <p className="mt-2 text-amber-900">
                  预算事项：{salesHandoff.budgetConcern}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                最近更新：{salesHandoff.updatedAt.toLocaleString("zh-CN")}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              尚无销售交接记录。
            </p>
          )}
        </section>
      ) : null}
      {canManage ? <BuildingForm projectId={project.id} /> : null}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">建筑与安装单元</h2>
        {project.buildings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-500">
            尚无建筑记录。
          </p>
        ) : (
          project.buildings.map((building) => (
            <article
              className="rounded-2xl border border-slate-200 bg-white p-6"
              key={building.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">
                    {building.buildingCode}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">
                    {building.name}
                  </h3>
                </div>
                <StatusBadge
                  label={getBuildingStatusPresentation(building.status).label}
                  tone={getBuildingStatusPresentation(building.status).tone}
                />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {building.addressDetail ?? "未填写详细地址"}
              </p>
              <div className="mt-4 space-y-2">
                {building.installationUnits.length === 0 ? (
                  <p className="text-sm text-slate-500">尚无安装单元。</p>
                ) : (
                  building.installationUnits.map((unit) => (
                    <div
                      className="rounded-lg bg-slate-50 px-4 py-3 text-sm"
                      key={unit.id}
                    >
                      <span className="font-medium">{unit.unitCode}</span>
                      <span className="ml-3 text-slate-500">
                        {unit.intendedLocation ?? "拟安装位置待确认"} ·{" "}
                        {
                          getInstallationUnitStatusPresentation(unit.status)
                            .label
                        }
                      </span>
                    </div>
                  ))
                )}
              </div>
              {canManage ? (
                <UnitForm
                  buildingId={building.id}
                  projectId={project.id}
                />
              ) : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
