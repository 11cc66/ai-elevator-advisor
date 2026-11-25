import Link from "next/link";

import { requirePageSession } from "@/modules/auth/page-session";

import { ProjectCreateForm } from "./project-create-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requirePageSession("/projects/new");
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <Link className="text-sm text-cyan-800" href="/projects">← 返回项目列表</Link>
      <header className="mt-4">
        <p className="text-sm font-medium text-cyan-800">DEMO 项目</p>
        <h1 className="mt-2 text-3xl font-semibold">新建安装需求</h1>
        <p className="mt-2 text-slate-600">
          创建后进入 Mock AI 多轮需求采集。所有记录标记为 DEMO_MOCK。
        </p>
      </header>
      <div className="mt-7"><ProjectCreateForm /></div>
    </main>
  );
}
