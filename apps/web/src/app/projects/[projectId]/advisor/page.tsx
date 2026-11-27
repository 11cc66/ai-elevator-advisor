import Link from "next/link";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPageAccess } from "@/modules/auth/page-session";
import { listConversations } from "@/modules/mvp/store";
import { getProjectDetails } from "@/modules/projects/service";
import {
  getAdvisorConversationStatusPresentation,
  getAdvisorProviderPresentation,
  getScenarioPresentation,
} from "@/modules/workbench/presentation";

import { StartConversationForm } from "./start-conversation-form";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";

export default async function AdvisorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await requireProjectPageAccess(projectId, PERMISSIONS.ADVISOR_USE);
  const [project, conversations] = await Promise.all([
    getProjectDetails(projectId),
    listConversations(projectId),
  ]);
  const projectType = String(project.projectType);
  const scenario =
    projectType === "EXISTING_ELEVATOR_RENOVATION"
      ? "EXISTING_ELEVATOR_RENOVATION"
      : projectType === "NEW_BUILDING_INSTALLATION"
        ? "NEW_BUILDING_INSTALLATION"
        : "OLD_BUILDING_ADDITION";

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <Link className="text-sm text-cyan-800" href={`/projects/${projectId}`}>
        ← 返回项目
      </Link>
      <header className="mt-4">
        <p className="text-sm font-medium text-cyan-800">AI 智能顾问 · MOCK</p>
        <h1 className="mt-2 text-3xl font-semibold">{project.name}</h1>
        <p className="mt-2 text-slate-600">
          采用确定性 Mock 回复，不访问外部模型。所有需求仍需客户确认和专业审核。
        </p>
      </header>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge
          label={getScenarioPresentation(project.projectType).label}
          tone={getScenarioPresentation(project.projectType).tone}
        />
        <StatusBadge label="演示顾问" tone="warning" />
      </div>

      <section className="mt-7 space-y-5">
        {conversations.length === 0 ? (
          <StartConversationForm
            installationScenario={scenario}
            projectId={projectId}
          />
        ) : null}
        {conversations.map((conversation) => {
          const status = getAdvisorConversationStatusPresentation(
            conversation.status,
          );
          const provider = getAdvisorProviderPresentation(
            conversation.provider,
          );

          return (
            <Link
              className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-cyan-300"
              href={`/projects/${projectId}/advisor/${conversation.id}`}
              key={conversation.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold">顾问会话</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {conversation.messageCount} 条消息 · {status.label}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label={provider.label} tone={provider.tone} />
                  <StatusBadge label={status.label} tone={status.tone} />
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                {conversation.latestMessage ?? "尚无消息"}
              </p>
            </Link>
          );
        })}
        {conversations.length > 0 ? (
          <StartConversationForm
            installationScenario={scenario}
            projectId={projectId}
          />
        ) : null}
      </section>
    </main>
  );
}
