import { notFound } from "next/navigation";
import { PageTitle } from "@/components/layout/page-title";
import { findNavigationItemBySegment } from "@/components/layout/navigation";
import { requireAnyPermission } from "@/features/auth/session";
export default async function ModulePlaceholderPage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const item = findNavigationItemBySegment(module);
  if (!item || item.href === "/dashboard") notFound();
  await requireAnyPermission(item.permissions);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle title={item.label} description={item.description} />
      <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
        This module is not active yet.
      </div>
    </div>
  );
}
