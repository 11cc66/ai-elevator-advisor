import {
  createCustomerSchema,
  type CreateCustomerInput,
} from "@elevator/contracts";
import { NextResponse } from "next/server";

import {
  PERMISSIONS,
  type PermissionCode,
} from "@/modules/access/permissions";
import { requireGlobalPermission } from "@/modules/access/policy";
import { requireApiActor } from "@/modules/auth/api-session";
import {
  createCustomer,
  listCustomers,
} from "@/modules/projects/service";
import { parseJsonBody } from "@/server/http/body";
import { errorResponse } from "@/server/http/errors";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

async function authorize(
  request: Request,
  permission: PermissionCode,
) {
  const context = await requireApiActor(request);
  requireGlobalPermission(context.actor, permission);
  return context;
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);

  try {
    await authorize(request, PERMISSIONS.CUSTOMER_READ);
    return NextResponse.json(
      { customers: await listCustomers() },
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
    const { actor } = await authorize(
      request,
      PERMISSIONS.CUSTOMER_MANAGE,
    );
    const input: CreateCustomerInput = await parseJsonBody(
      request,
      createCustomerSchema,
    );
    const customer = await createCustomer(
      actor.userId,
      requestId,
      input,
    );

    return NextResponse.json(
      { customer },
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
