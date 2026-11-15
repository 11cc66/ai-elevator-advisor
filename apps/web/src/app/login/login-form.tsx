"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/sign-in/username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });

      if (!response.ok) {
        setError(
          response.status === 401 || response.status === 400
            ? "账号或密码错误。"
            : "登录服务暂时不可用，请稍后重试。",
        );
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("无法连接登录服务，请检查本地服务后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        <span>账号</span>
        <input
          autoComplete="username"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
          name="username"
          required
        />
      </label>
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        <span>密码</span>
        <input
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-100"
          name="password"
          required
          type="password"
        />
      </label>
      {error ? (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <button
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "正在登录…" : "登录"}
      </button>
    </form>
  );
}
