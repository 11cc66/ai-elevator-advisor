import {
  requirementDraftSchema,
  requirementUpdateSchema,
} from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireProjectPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { deriveMissingRequirementFields } from "@/modules/advisor/missing-fields";
import {
  createRequirementVersion,
  getLatestRequirement,
} from "@/modules/mvp/store";
import { parseJsonBody } from "@/server/http/body";
import { AppError, errorResponse } from "@/server/http/errors";
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
      { requirement: await getLatestRequirement(projectId) },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { projectId } = await context.params;
    const { actor } = await requireApiActor(request);
    requireProjectPermission(actor, projectId, PERMISSIONS.ADVISOR_USE);
    const current = await getLatestRequirement(projectId);
    if (!current) {
      throw new AppError("REQUIREMENT_NOT_FOUND", "需求草稿不存在。", 404);
    }
    const input = await parseJsonBody(request, requirementUpdateSchema);
    const mergedFields = {
      ...current.fields,
      ...input,
      installationScenario:
        input.installationScenario ?? current.installationScenario,
      professionalReviewRequired: true,
    };
    const missingFields = deriveMissingRequirementFields(
      mergedFields.installationScenario,
      mergedFields,
    );
    const fields = requirementDraftSchema.parse({
      ...mergedFields,
      missingFields,
    });
    const updated = await createRequirementVersion({
      projectId,
      conversationId: current.conversationId,
      installationScenario: fields.installationScenario,
      fields,
      missingFields,
      createdById: actor.userId,
      source: "USER_EDIT",
    });
    return NextResponse.json(
      { requirement: updated },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
