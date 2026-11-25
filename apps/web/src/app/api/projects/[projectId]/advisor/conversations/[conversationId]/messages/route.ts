import { advisorMessageRequestSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { sendAdvisorMessage } from "@/modules/advisor/service";
import { requireApiActor } from "@/modules/auth/api-session";
import { getLatestRequirement } from "@/modules/mvp/store";
import { parseJsonBody } from "@/server/http/body";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; conversationId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { projectId, conversationId } = await context.params;
    const { actor } = await requireApiActor(request);
    requireProjectPermission(actor, projectId, PERMISSIONS.ADVISOR_USE);
    const input = await parseJsonBody(request, advisorMessageRequestSchema);
    const existing = await getLatestRequirement(projectId);
    if (!existing) {
      throw new AppError(
        "REQUIREMENT_SCENARIO_MISSING",
        "请先建立需求草稿并选择安装场景。",
        409,
      );
    }
    const result = await sendAdvisorMessage({
      projectId,
      conversationId,
      userId: actor.userId,
      installationScenario: existing.installationScenario,
      content: input.content,
    });
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
