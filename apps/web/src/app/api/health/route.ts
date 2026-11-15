import { healthCheckSchema } from "@elevator/contracts";
import { NextResponse } from "next/server";

import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { getRequestId } from "@/server/http/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const startedAt = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.systemMetadata.count();

    const response = healthCheckSchema.parse({
      status: "ok",
      service: "web",
      timestamp: new Date().toISOString(),
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      checks: {
        database: "ok",
      },
    });

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        event: "health.database_unavailable",
        requestId,
      },
      "Database health check failed",
    );

    const response = healthCheckSchema.parse({
      status: "degraded",
      service: "web",
      timestamp: new Date().toISOString(),
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      checks: {
        database: "unavailable",
      },
    });

    return NextResponse.json(response, {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  }
}
