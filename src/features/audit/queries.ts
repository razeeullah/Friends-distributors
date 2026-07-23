import { db } from "@/lib/db";
export async function listAuditLogs(
  businessId: string,
  locationIds: readonly string[],
) {
  return db.auditLog.findMany({
    where: {
      businessId,
      OR: [{ locationId: null }, { locationId: { in: [...locationIds] } }],
    },
    include: {
      actor: { select: { displayName: true } },
      location: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
