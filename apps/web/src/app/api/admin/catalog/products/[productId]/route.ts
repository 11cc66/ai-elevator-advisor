import { productUpdateSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireGlobalPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import {
  getCatalogProduct,
  updateCatalogProduct,
} from "@/modules/mvp/store";
import { parseJsonBody } from "@/server/http/body";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    requireGlobalPermission(actor, PERMISSIONS.CATALOG_MANAGE);
    const { productId } = await context.params;
    const product = await getCatalogProduct(productId);
    if (!product) {
      throw new AppError("PRODUCT_NOT_FOUND", "产品不存在。", 404);
    }
    return NextResponse.json(
      { product },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    requireGlobalPermission(actor, PERMISSIONS.CATALOG_MANAGE);
    const { productId } = await context.params;
    const input = await parseJsonBody(request, productUpdateSchema);
    await updateCatalogProduct(productId, input, {
      actorUserId: actor.userId,
      requestId,
    });
    return NextResponse.json(
      { saved: true },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
