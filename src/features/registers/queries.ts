import { db } from "@/lib/db";
export async function getRegisterData(
  businessId: string,
  locationId: string | null,
) {
  const [registers, active, history] = await Promise.all([
    db.register.findMany({
      where: {
        businessId,
        ...(locationId ? { locationId } : {}),
        isActive: true,
        archivedAt: null,
      },
      select: { id: true, name: true, code: true },
    }),
    locationId
      ? db.registerSession.findFirst({
          where: { businessId, locationId, status: "OPEN" },
          include: {
            register: true,
            movements: { orderBy: { createdAt: "desc" }, take: 20 },
          },
          orderBy: { openedAt: "desc" },
        })
      : null,
    db.registerSession.findMany({
      where: { businessId, ...(locationId ? { locationId } : {}) },
      include: { register: true },
      orderBy: { openedAt: "desc" },
      take: 30,
    }),
  ]);
  return { registers, active, history };
}
