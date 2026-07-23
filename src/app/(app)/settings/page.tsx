import { PageTitle } from "@/components/layout/page-title";
import { requirePermission } from "@/features/auth/session";
import { SettingsForm } from "@/features/settings/settings-form";
import { getBusinessSettings } from "@/features/settings/services";
export default async function SettingsPage() {
  const context = await requirePermission("settings.manage");
  const data = await getBusinessSettings(context.business.id);
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageTitle
        title="Settings"
        description="Manage business preferences, POS defaults, invoice presentation, and operational controls."
      />
      <SettingsForm data={data} />
    </div>
  );
}
