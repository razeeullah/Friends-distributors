import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";

export interface AuditLogInput {
  businessId: string;
  locationId?: string | null;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  requestId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const sensitiveKey = /password|hash|token|secret|authorization|card|cvv/i;
function redact(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey.test(key)
          ? "[REDACTED]"
          : redact(item as Prisma.InputJsonValue),
      ]),
    );
  return value;
}

export async function writeAuditLog(
  transaction: Prisma.TransactionClient,
  input: AuditLogInput,
): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    businessId: input.businessId,
    locationId: input.locationId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    summary: input.summary?.slice(0, 500) ?? null,
    requestId: input.requestId ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    ...(input.before === undefined ? {} : { before: redact(input.before) }),
    ...(input.after === undefined ? {} : { after: redact(input.after) }),
    ...(input.metadata === undefined
      ? {}
      : { metadata: redact(input.metadata) }),
  };

  await transaction.auditLog.create({
    data,
  });
}
