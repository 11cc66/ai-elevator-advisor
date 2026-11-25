import {
  requirementDraftSchema,
  type InstallationScenario,
  type RequirementDraft,
} from "@elevator/contracts";

import { AppError } from "@/server/http/errors";

import {
  appendMessage,
  conversationBelongsToProject,
  createConversation,
  createRequirementVersion,
  getLatestRequirement,
  listConversations,
  listMessages,
} from "../mvp/store";
import { MockAIProvider } from "./mock-provider";

const provider = new MockAIProvider();

export async function startAdvisorConversation(input: {
  projectId: string;
  userId: string;
  installationScenario: InstallationScenario;
}) {
  const conversation = await createConversation({
    projectId: input.projectId,
    userId: input.userId,
  });
  const initialFields = requirementDraftSchema.parse({
    installationScenario: input.installationScenario,
    missingFields: [
      "buildingUse",
      "floorCount",
      "buildingHeightOrFloorHeight",
      "budgetMax",
      "externalInstallationAllowed",
    ],
    professionalReviewRequired: true,
    fieldSources: {},
  });
  await createRequirementVersion({
    projectId: input.projectId,
    conversationId: conversation.id,
    installationScenario: input.installationScenario,
    fields: initialFields,
    missingFields: initialFields.missingFields,
    createdById: input.userId,
    source: "MOCK_AI",
  });
  await appendMessage({
    conversationId: conversation.id,
    role: "ASSISTANT",
    provider: "MOCK",
    content:
      "您好，我是 Mock AI 电梯顾问。请描述建筑用途、楼层、层高、预算和外装条件。\n" +
      "以上信息仅用于初步沟通，最终方案仍需专业现场勘察。",
  });
  return conversation;
}

export async function sendAdvisorMessage(input: {
  projectId: string;
  conversationId: string;
  userId: string;
  installationScenario: InstallationScenario;
  content: string;
}) {
  const belongs = await conversationBelongsToProject(
    input.conversationId,
    input.projectId,
  );
  if (!belongs) {
    throw new AppError(
      "CONVERSATION_NOT_FOUND",
      "顾问会话不存在或不属于当前项目。",
      404,
    );
  }

  const current = await getLatestRequirement(input.projectId);
  const currentFields: Partial<RequirementDraft> =
    current?.conversationId === input.conversationId
      ? current.fields
      : { installationScenario: input.installationScenario };

  const userMessage = await appendMessage({
    conversationId: input.conversationId,
    role: "USER",
    provider: "MOCK",
    content: input.content,
  });
  const reply = await provider.reply({
    installationScenario: input.installationScenario,
    currentRequirement: currentFields,
    userMessage: userMessage.content,
  });

  const fields = requirementDraftSchema.parse({
    ...currentFields,
    ...reply.requirementPatch,
    installationScenario: input.installationScenario,
    missingFields: reply.missingFields,
    professionalReviewRequired: true,
    fieldSources: {
      ...currentFields.fieldSources,
      ...Object.fromEntries(
        Object.keys(reply.requirementPatch)
          .filter((key) => key !== "installationScenario")
          .map((key) => [key, `advisor-message:${userMessage.id}`]),
      ),
    },
  });
  const requirement = await createRequirementVersion({
    projectId: input.projectId,
    conversationId: input.conversationId,
    installationScenario: input.installationScenario,
    fields,
    missingFields: reply.missingFields,
    createdById: input.userId,
    source: "MOCK_AI",
  });
  const assistantMessage = await appendMessage({
    conversationId: input.conversationId,
    role: "ASSISTANT",
    provider: reply.provider,
    content: reply.answerText,
    structuredPayload: reply,
  });

  return { assistantMessage, requirement };
}

export async function getAdvisorConversation(input: {
  projectId: string;
  conversationId: string;
}) {
  const belongs = await conversationBelongsToProject(
    input.conversationId,
    input.projectId,
  );
  if (!belongs) {
    throw new AppError(
      "CONVERSATION_NOT_FOUND",
      "顾问会话不存在或不属于当前项目。",
      404,
    );
  }
  return {
    messages: await listMessages(input.conversationId),
    requirement: await getLatestRequirement(input.projectId),
  };
}

export { listConversations };
