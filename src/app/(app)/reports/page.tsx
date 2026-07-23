import { PageTitle } from "@/components/layout/page-title";
import { requirePermission } from "@/features/auth/session";
export default async function ReportsPage() {
  await requirePermission("report.sales");
  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        title="Reports"
        description="Location-scoped reports are generated server-side. Detailed report views will be added incrementally."
      />
    </div>
  );
}
