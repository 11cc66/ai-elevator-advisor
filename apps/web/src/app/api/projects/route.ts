import { mvpProjectCreateSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireGlobalPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { listProjects } from "@/modules/projects/service";
import { createCustomerProject } from "@/modules/mvp/store";
import { errorResponse } from "@/server/http/errors";
import { parseJsonBody } from "@/server/http/body";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    return NextResponse.json(
      { projects: await listProjects(actor) },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    requireGlobalPermission(actor, PERMISSIONS.PROJECT_CREATE);
    const input = await parseJsonBody(request, mvpProjectCreateSchema);
    const project = await createCustomerProject({
      userId: actor.userId,
      requestId,
      data: input,
    });
    return NextResponse.json(
      { project },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
