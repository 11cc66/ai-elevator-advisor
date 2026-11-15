"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);

    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } finally {
      router.replace("/login");
      router.refresh();
      setPending(false);
    }
  }

  return (
    <button
      className="text-slate-600 hover:text-slate-950 disabled:opacity-50"
      disabled={pending}
      onClick={logout}
      type="button"
    >
      {pending ? "正在退出…" : "退出登录"}
    </button>
  );
}
