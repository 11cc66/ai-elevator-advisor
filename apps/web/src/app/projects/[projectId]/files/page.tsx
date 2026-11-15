import Link from "next/link";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPageAccess } from "@/modules/auth/page-session";
import { listProjectFiles } from "@/modules/files/file-query-service";

export const dynamic = "force-dynamic";

function formatSize(sizeBytes: string | undefined): string {
  if (!sizeBytes) {
    return "无版本";
  }

  const bytes = Number(sizeBytes);
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
    : `${Math.ceil(bytes / 1024)} KiB`;
}

export default async function ProjectFilesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectPageAccess(projectId, PERMISSIONS.FILE_READ);
  const files = await listProjectFiles(projectId);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cyan-800">项目资料</p>
          <h1 className="mt-2 text-3xl font-semibold">文件与版本</h1>
          <p className="mt-2 text-slate-600">
            仅展示数据库记录的安全状态。未扫描文件不会显示为已清洁。
          </p>
        </div>
        <Link className="text-sm text-cyan-800" href={`/admin/projects/${projectId}`}>
          返回项目详情
        </Link>
      </header>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {files.length === 0 ? (
          <p className="p-6 text-slate-500">当前项目尚无文件。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">文件名</th>
                  <th className="px-4 py-3">当前版本</th>
                  <th className="px-4 py-3">大小</th>
                  <th className="px-4 py-3">基础校验</th>
                  <th className="px-4 py-3">病毒扫描</th>
                  <th className="px-4 py-3">完整性</th>
                  <th className="px-4 py-3">版本数</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr className="border-t border-slate-100" key={file.id}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium text-cyan-800"
                        href={`/projects/${projectId}/files/${file.id}`}
                      >
                        {file.displayName}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {file.dataClassification}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {file.currentVersion?.versionNumber ?? "无"}
                    </td>
                    <td className="px-4 py-3">
                      {formatSize(file.currentVersion?.sizeBytes)}
                    </td>
                    <td className="px-4 py-3">
                      {file.currentVersion?.validationStatus ?? "无"}
                    </td>
                    <td className="px-4 py-3">
                      {file.currentVersion?.malwareScanStatus ?? "无"}
                    </td>
                    <td className="px-4 py-3">
                      {file.currentVersion?.integrityStatus ?? "无"}
                    </td>
                    <td className="px-4 py-3">{file._count.versions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
