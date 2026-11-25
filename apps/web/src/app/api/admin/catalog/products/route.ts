import { productCreateSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { requireGlobalPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import {
  createCatalogProduct,
  listCatalogProducts,
} from "@/modules/mvp/store";
import { parseJsonBody } from "@/server/http/body";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    requireGlobalPermission(actor, PERMISSIONS.CATALOG_MANAGE);
    return NextResponse.json(
      { products: await listCatalogProducts() },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    requireGlobalPermission(actor, PERMISSIONS.CATALOG_MANAGE);
    const input = await parseJsonBody(request, productCreateSchema);
    const productId = await createCatalogProduct(input, {
      actorUserId: actor.userId,
      requestId,
    });
    return NextResponse.json(
      { productId },
      { status: 201, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
