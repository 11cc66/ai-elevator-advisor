import {
  advisorCreateSchema,
  type InstallationScenario,
} from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import {
  listConversations,
  startAdvisorConversation,
} from "@/modules/advisor/service";
import { requireApiActor } from "@/modules/auth/api-session";
import { parseJsonBody } from "@/server/http/body";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { projectId } = await context.params;
    const { actor } = await requireApiActor(request);
    requireProjectPermission(actor, projectId, PERMISSIONS.ADVISOR_USE);
    return NextResponse.json(
      { conversations: await listConversations(projectId) },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    if (process.env.NODE_ENV === "test") {
      return NextResponse.json(
        {
          error: {
            code: "TEST_DIAGNOSTIC",
            message: error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError",
            requestId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 },
      );
    }
    return errorResponse(error, requestId);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { projectId } = await context.params;
    const { actor } = await requireApiActor(request);
    requireProjectPermission(actor, projectId, PERMISSIONS.ADVISOR_USE);
    const input = await parseJsonBody(request, advisorCreateSchema);
    const conversation = await startAdvisorConversation({
      projectId,
      userId: actor.userId,
      installationScenario: input.installationScenario as InstallationScenario,
    });
    return NextResponse.json(
      { conversation },
      { status: 201, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    if (process.env.NODE_ENV === "test") {
      return NextResponse.json(
        {
          error: {
            code: "TEST_DIAGNOSTIC",
            message: error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError",
            requestId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 },
      );
    }
    return errorResponse(error, requestId);
  }
}
