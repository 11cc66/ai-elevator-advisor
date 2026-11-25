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

import { ProjectForm } from "./project-form";

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
        <h1 className="mt-1 text-3xl font-semibold">旧楼加装 DEMO 项目</h1>
        <p className="mt-2 text-slate-600">
          项目编号由服务端生成。当前没有工程硬条件或正式选型结果。
        </p>
      </header>
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
          projects.map((project) => (
            <Link
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-cyan-300"
              href={`/admin/projects/${project.id}`}
              key={project.id}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{project.name}</h2>
                <span className="demo-badge">
                  {project.dataClassification}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {project.projectCode}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                {project.customer.organizationName} · {project.address}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                建筑 {project._count.buildings} 栋
              </p>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
