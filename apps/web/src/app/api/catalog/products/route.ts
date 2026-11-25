import { NextResponse } from "next/server";

import { PERMISSIONS } from "@/modules/access/permissions";
import { hasPermissionInAnyScope } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import { listCatalogProducts } from "@/modules/mvp/store";
import { AppError, errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  try {
    const { actor } = await requireApiActor(request);
    if (!hasPermissionInAnyScope(actor, PERMISSIONS.CATALOG_READ)) {
      throw new AppError("CATALOG_ACCESS_DENIED", "没有查看产品目录的权限。", 403);
    }
    const products = (await listCatalogProducts()).filter(
      (product) =>
        product.verificationStatus === "DEMO_MOCK" ||
        product.verificationStatus === "VERIFIED",
    );
    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
