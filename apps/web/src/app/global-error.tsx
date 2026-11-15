"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <main
          style={{
            alignItems: "center",
            display: "flex",
            fontFamily: "system-ui, sans-serif",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
          }}
        >
          <div style={{ maxWidth: "480px", textAlign: "center" }}>
            <h1>应用暂时无法运行</h1>
            <p>请稍后重试，或联系系统管理员检查服务日志。</p>
            <button onClick={reset} type="button">
              重新尝试
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
