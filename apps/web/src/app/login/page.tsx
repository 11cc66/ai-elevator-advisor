import { redirect } from "next/navigation";

import { getCurrentSession } from "@/modules/auth/session";
import { safeAdminNextPath } from "@/modules/auth/page-session";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentSession()) {
    redirect("/admin");
  }

  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-cyan-800">开发环境账号</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          登录 AI 电梯选型顾问
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          当前阶段不开放注册、验证码或密码找回。请使用本地 Seed
          创建的开发管理员账号。
        </p>
        <LoginForm nextPath={safeAdminNextPath(next)} />
      </section>
    </main>
  );
}
