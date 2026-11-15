import Link from "next/link";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPageAccess } from "@/modules/auth/page-session";
import { getProjectFileDetails } from "@/modules/files/file-query-service";

export const dynamic = "force-dynamic";

function formatSize(sizeBytes: string): string {
  const bytes = Number(sizeBytes);
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
    : `${Math.ceil(bytes / 1024)} KiB`;
}

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; fileId: string }>;
}) {
  const { projectId, fileId } = await params;
  await requireProjectPageAccess(projectId, PERMISSIONS.FILE_READ);
  const file = await getProjectFileDetails(projectId, fileId);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Link
        className="text-sm text-cyan-800"
        href={`/projects/${projectId}/files`}
      >
        ← 返回文件列表
      </Link>

      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{file.displayName}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {file.customer.organizationName} · {file.dataClassification}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
            {file.status}
          </span>
        </div>
      </header>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold">版本历史</h2>
          <p className="mt-1 text-sm text-slate-500">
            历史版本保持不变；当前版本使用明确标识。
          </p>
        </div>
        {file.versions.length === 0 ? (
          <p className="p-6 text-slate-500">尚无已完成文件版本。</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {file.versions.map((version) => {
              const current = version.id === file.currentVersionId;

              return (
                <article className="p-6" key={version.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        版本 {version.versionNumber}
                        {current ? (
                          <span className="ml-2 rounded-full bg-cyan-100 px-2 py-1 text-xs text-cyan-900">
                            当前版本
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {version.originalFilename} ·{" "}
                        {version.detectedMimeType ?? "类型未知"} ·{" "}
                        {formatSize(version.sizeBytes)}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        SHA-256: {version.checksumSha256}
                      </p>
                    </div>
                    <a
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                      href={`/api/projects/${projectId}/files/${file.id}/versions/${version.id}/content`}
                    >
                      受控下载
                    </a>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                    <div>上传：{version.uploadStatus}</div>
                    <div>校验：{version.validationStatus}</div>
                    <div>病毒扫描：{version.malwareScanStatus}</div>
                    <div>完整性：{version.integrityStatus}</div>
                  </dl>
                  <p className="mt-3 text-xs text-slate-500">
                    完成时间：{version.finalizedAt?.toISOString() ?? "未完成"}
                  </p>
                  {version.extractions[0] ? (
                    <Link
                      className="mt-3 inline-block text-sm text-cyan-800"
                      href={`/projects/${projectId}/files/${file.id}/versions/${version.id}/extractions/${version.extractions[0].id}`}
                    >
                      查看最新识别结果
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
