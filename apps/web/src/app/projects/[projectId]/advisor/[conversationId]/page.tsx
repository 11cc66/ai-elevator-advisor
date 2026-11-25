import Link from "next/link";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPageAccess } from "@/modules/auth/page-session";
import { getAdvisorConversation } from "@/modules/advisor/service";

import { AdvisorChat } from "./advisor-chat";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ projectId: string; conversationId: string }>;
}) {
  const { projectId, conversationId } = await params;
  await requireProjectPageAccess(projectId, PERMISSIONS.ADVISOR_USE);
  const conversation = await getAdvisorConversation({ projectId, conversationId });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Link className="text-sm text-cyan-800" href={`/projects/${projectId}/advisor`}>
        ← 返回顾问会话列表
      </Link>
      <header className="mt-4 mb-6">
        <p className="text-sm font-medium text-cyan-800">Mock AI 顾问</p>
        <h1 className="mt-2 text-3xl font-semibold">建筑需求对话</h1>
      </header>
      <AdvisorChat
        conversationId={conversationId}
        initialMessages={conversation.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        }))}
        initialRequirement={
          conversation.requirement
            ? {
                id: conversation.requirement.id,
                installationScenario:
                  conversation.requirement.installationScenario,
                version: conversation.requirement.version,
                status: conversation.requirement.status,
                missingFields: conversation.requirement.missingFields,
                fields: conversation.requirement.fields,
              }
            : null
        }
        projectId={projectId}
      />
    </main>
  );
}
