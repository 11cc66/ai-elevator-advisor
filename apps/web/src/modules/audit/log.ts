import type { Prisma } from "@prisma/client";

export interface AuditEntry {
  actorUserId: string;
  action: string;
  objectType: string;
  objectId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  reason?: string;
  requestId: string;
}

export async function appendAuditLog(
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      reason: entry.reason,
      requestId: entry.requestId,
    },
  });
}
