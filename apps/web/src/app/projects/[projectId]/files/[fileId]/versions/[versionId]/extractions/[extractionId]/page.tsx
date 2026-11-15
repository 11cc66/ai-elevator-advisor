import Link from "next/link";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPageAccess } from "@/modules/auth/page-session";
import { getExtractionDetails } from "@/modules/files/file-query-service";

export const dynamic = "force-dynamic";

export default async function ExtractionDetailPage({
  params,
}: {
  params: Promise<{
    projectId: string;
    fileId: string;
    versionId: string;
    extractionId: string;
  }>;
}) {
  const { projectId, fileId, versionId, extractionId } = await params;
  await requireProjectPageAccess(projectId, PERMISSIONS.FILE_READ);
  const extraction = await getExtractionDetails(
    projectId,
    fileId,
    versionId,
    extractionId,
  );
  const groups = new Map<number | null, typeof extraction.textBlocks>();

  for (const block of extraction.textBlocks) {
    const pageNumber = block.pageNumber ?? null;
    const pageBlocks = groups.get(pageNumber) ?? [];
    pageBlocks.push(block);
    groups.set(pageNumber, pageBlocks);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Link
        className="text-sm text-cyan-800"
        href={`/projects/${projectId}/files/${fileId}`}
      >
        ← 返回文件详情
      </Link>

      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-cyan-800">
          识别版本 {extraction.extractionVersion}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">文件提取结果</h1>
        <dl className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <div>状态：{extraction.status}</div>
          <div>页数：{extraction.pageCount ?? "不适用"}</div>
          <div>输出字符：{extraction.outputCharacterCount}</div>
          <div>解析器：{extraction.parserVersion ?? "未完成"}</div>
        </dl>
        <p className="mt-4 text-sm text-slate-600">
          {extraction.safetyNotes ??
            "提取内容仅来自文件本身，不代表工程数据已经核实。"}
        </p>
        {extraction.safeErrorCode ? (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {extraction.safeErrorCode}：{extraction.safeErrorMessage}
          </p>
        ) : null}
      </header>

      <section className="mt-6 space-y-5">
        {[...groups.entries()].map(([pageNumber, blocks]) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-6"
            key={pageNumber ?? "unknown"}
          >
            <h2 className="text-lg font-semibold">
              {pageNumber ? `第 ${pageNumber} 页` : "文件元数据"}
            </h2>
            {blocks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                没有可显示的文字块。
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {blocks.map((block) => (
                  <p
                    className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-7"
                    key={block.id}
                  >
                    {block.text}
                  </p>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
