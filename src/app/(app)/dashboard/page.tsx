import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePermission } from "@/features/auth/session";

const DashboardExperience = dynamic(
  () => import("@/features/dashboard/dashboard-experience").then((mod) => mod.DashboardExperience),
  { ssr: false } // Recharts relies heavily on client-side rendering
);

export const metadata: Metadata = { title: "Dashboard" };
export default async function DashboardPage() {
  await requirePermission("dashboard.view");
  return <DashboardExperience />;
}
