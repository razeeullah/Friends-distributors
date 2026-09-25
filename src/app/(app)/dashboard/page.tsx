import type { Metadata } from "next";
import { requirePermission } from "@/features/auth/session";
import { DashboardExperience } from "@/features/dashboard/dashboard-experience";

export const metadata: Metadata = { title: "Dashboard" };
export default async function DashboardPage() {
  await requirePermission("dashboard.view");
  return <DashboardExperience />;
}
