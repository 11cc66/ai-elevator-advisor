import Link from "next/link";

import {
  PERMISSIONS,
} from "@/modules/access/permissions";
import { loadActor } from "@/modules/access/actor";
import { hasGlobalPermission } from "@/modules/access/policy";
import { requirePageSession } from "@/modules/auth/page-session";
import {
  listCustomers,
  listProjects,
} from "@/modules/projects/service";
import {
  getDataClassificationPresentation,
  getProjectRecordStatusLabel,
  getScenarioPresentation,
} from "@/modules/workbench/presentation";

import { ProjectForm } from "./project-form";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await requirePageSession("/admin/projects");
  const actor = await loadActor(session.user.id);
  const canManage = hasGlobalPermission(
    actor,
    PERMISSIONS.PROJECT_MANAGE,
  );
  const projects = await listProjects(actor);
  const customers = canManage ? await listCustomers() : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-cyan-800">项目</p>
        <h1 className="mt-1 text-3xl font-semibold">项目工作台</h1>
        <p className="mt-2 text-slate-600">
          统一查看旧楼加装电梯、旧电梯更新和新楼安装电梯项目；工程条件与正式方案仍需专业审核。
        </p>
      </header>
      {!canManage ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          当前账号为只读查看状态。新增项目和建筑等操作由项目维护权限控制，页面隐藏操作不代表替代服务端鉴权。
        </p>
      ) : null}
      {canManage ? (
        <ProjectForm
          customers={customers.map((customer) => ({
            id: customer.id,
            organizationName: customer.organizationName,
          }))}
        />
      ) : null}
      <section className="grid gap-4 md:grid-cols-2">
        {projects.length === 0 ? (
          <p className="text-slate-500">尚无项目记录。</p>
        ) : (
          projects.map((project) => {
            const scenario = getScenarioPresentation(project.projectType);
            const status = getProjectRecordStatusLabel(project.status);
            const classification = getDataClassificationPresentation(
              project.dataClassification,
            );

            return (
              <Link
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-300"
                href={`/admin/projects/${project.id}`}
                key={project.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-semibold">{project.name}</h2>
                  <StatusBadge label={status} tone="neutral" />
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {project.projectCode}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge label={scenario.label} tone={scenario.tone} />
                  <StatusBadge
                    label={classification.label}
                    tone={classification.tone}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {project.customer.organizationName} · {project.address}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  建筑 {project._count.buildings} 栋
                </p>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
