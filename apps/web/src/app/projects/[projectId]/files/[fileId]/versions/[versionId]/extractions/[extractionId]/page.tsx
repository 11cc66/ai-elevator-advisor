import Link from "next/link";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPageAccess } from "@/modules/auth/page-session";
import { getExtractionDetails } from "@/modules/files/file-query-service";

import { FieldReviewForm } from "./field-review-form";

export const dynamic = "force-dynamic";

function formatFieldValue(value: unknown, unit?: string | null): string {
  if (value === null) {
    return "未提取";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return `${String(value)}${unit ? ` ${unit}` : ""}`;
  }
  return JSON.stringify(value);
}

function fieldStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    EXTRACTED: "待确认",
    CUSTOMER_CONFIRMED: "客户已确认",
    CUSTOMER_REJECTED: "客户已标记不准确",
    PENDING_VERIFICATION: "待专业人员核实",
    INVALIDATED: "已作废",
  };
  return labels[status] ?? "状态待确认";
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    CONFIRM: "确认资料",
    CORRECT: "提交修正",
    REJECT: "标记不准确",
  };
  return labels[action] ?? action;
}

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
        <h1 className="mt-2 text-3xl font-semibold">
          {extraction.fileVersion.file.displayName}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          文件版本 {extraction.fileVersion.versionNumber} · 识别版本{" "}
          {extraction.extractionVersion}
        </p>
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
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          客户确认只适用于普通资料，不替代现场勘察、测量、结构核查或专业工程审核。
        </p>
        {extraction.safeErrorCode ? (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {extraction.safeErrorCode}：{extraction.safeErrorMessage}
          </p>
        ) : null}
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">识别字段</h2>
            <p className="mt-1 text-sm text-slate-500">
              需要重新核对的字段请根据页面状态逐一处理。
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            共 {extraction.fieldSummary.total} 项 · 客户已确认{" "}
            {extraction.fieldSummary.customerConfirmed} 项 · 待专业核实{" "}
            {extraction.fieldSummary.awaitingProfessionalReview} 项
          </div>
        </div>

        {extraction.fields.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-sm leading-6 text-slate-600">
            当前识别版本没有结构化字段。系统目前只保留了文件文字或图片元数据，
            不会根据普通文本自动编造资料字段。
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {extraction.fields.map((field) => {
              const professional =
                field.fieldClassification === "PROFESSIONAL";
              const hasCustomerAction =
                field.availableActions.canConfirm ||
                field.availableActions.canCorrect ||
                field.availableActions.canReject;
              const endpoint =
                `/api/projects/${projectId}/files/${fileId}` +
                `/versions/${versionId}/extractions/${extractionId}` +
                `/fields/${field.id}/reviews`;

              return (
                <article
                  className="rounded-2xl border border-slate-200 p-5"
                  key={field.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {field.fieldLabel}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {professional
                          ? "专业工程信息"
                          : "普通资料"}
                        {field.pageNumber
                          ? ` · 来源第 ${field.pageNumber} 页`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        professional
                          ? "bg-amber-100 text-amber-900"
                          : "bg-cyan-100 text-cyan-900"
                      }`}
                    >
                      {fieldStatusLabel(field.effectiveStatus)}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">
                        文件识别结果
                      </dt>
                      <dd className="mt-1 break-words text-slate-900">
                        {formatFieldValue(
                          field.originalRawValue,
                          field.unit,
                        )}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">
                        识别置信度（仅供参考）
                      </dt>
                      <dd className="mt-1 text-slate-900">
                        {field.confidence ?? "未提供"}
                      </dd>
                    </div>
                  </dl>

                  {professional ? (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                      该字段影响工程判断，客户只能提交修正建议，仍需由专业人员在现场勘察、测量或审核后确认。
                    </p>
                  ) : null}

                  {hasCustomerAction ? (
                    <FieldReviewForm
                      canConfirm={field.availableActions.canConfirm}
                      canCorrect={field.availableActions.canCorrect}
                      canReject={field.availableActions.canReject}
                      endpoint={endpoint}
                      expectedReviewSequence={field.latestReviewSequence}
                      professional={professional}
                      valueType={field.valueType}
                    />
                  ) : (
                    <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
                      当前字段配置或状态不允许客户操作，请联系工作人员核实。
                    </p>
                  )}

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-700">
                      历史记录
                    </h4>
                    {field.reviews.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">
                        暂无确认或修改记录。
                      </p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {field.reviews.map((review) => (
                          <li
                            className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"
                            key={review.id}
                          >
                            <div className="font-medium text-slate-800">
                              {actionLabel(review.action)} ·{" "}
                              {review.actor.name}
                            </div>
                            {review.correctedRawValue !== null ? (
                              <div className="mt-1">
                                修改为：
                                {formatFieldValue(
                                  review.correctedRawValue,
                                  field.unit,
                                )}
                              </div>
                            ) : null}
                            {review.note ? (
                              <div className="mt-1">
                                备注：{review.note}
                              </div>
                            ) : null}
                            <div className="mt-1 text-xs text-slate-500">
                              {fieldStatusLabel(review.statusAfterReview)} ·{" "}
                              {review.createdAt.toLocaleString("zh-CN")}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
