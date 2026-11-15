import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { loadActor } from "@/modules/access/actor";
import { PERMISSIONS } from "@/modules/access/permissions";
import { canAccessProject } from "@/modules/access/policy";
import { requirePageSession } from "@/modules/auth/page-session";
import { getProjectDetails } from "@/modules/projects/service";
import { AppError } from "@/server/http/errors";

import { BuildingForm } from "./building-form";
import { UnitForm } from "./unit-form";

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
          <span className="demo-badge">
            {project.dataClassification}
          </span>
        </div>
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
            <dt className="text-slate-500">项目状态</dt>
            <dd className="mt-1">{project.status}</dd>
          </div>
        </dl>
      </header>
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
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
                  {building.status}
                </span>
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
                        {unit.status}
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
