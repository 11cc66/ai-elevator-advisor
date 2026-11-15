import Link from "next/link";

import { requirePageSession } from "@/modules/auth/page-session";

import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePageSession("/admin");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link className="font-semibold" href="/admin">
            AI 电梯选型顾问 · 开发后台
          </Link>
          <nav className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
            <Link href="/admin/customers">客户</Link>
            <Link href="/admin/projects">项目</Link>
            <span>{session.user.name}</span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
