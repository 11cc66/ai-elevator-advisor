import { selectionRequestSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import {
  listSelectionRuns,
  runPreliminarySelection,
} from "@/modules/selection/service";
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
    requireProjectPermission(actor, projectId, PERMISSIONS.PROJECT_READ);
    return NextResponse.json(
      { runs: await listSelectionRuns(projectId) },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
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
    requireProjectPermission(actor, projectId, PERMISSIONS.SELECTION_RUN);
    const input = await parseJsonBody(request, selectionRequestSchema);
    const run = await runPreliminarySelection({
      projectId,
      userId: actor.userId,
      requirementVersion: input.requirementVersion,
    });
    return NextResponse.json(
      { run },
      { status: 201, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
