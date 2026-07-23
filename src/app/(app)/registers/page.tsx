import { PageTitle } from "@/components/layout/page-title";
import { requireAnyPermission } from "@/features/auth/session";
import { RegisterConsole } from "@/features/registers/register-console";
import { getRegisterData } from "@/features/registers/queries";
export default async function RegistersPage() {
  const context = await requireAnyPermission([
    "register.open",
    "register.close",
    "register.cash_movement",
    "register.view_all",
  ]);
  const data = await getRegisterData(
    context.business.id,
    context.currentLocation?.id ?? null,
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageTitle
        title="Cash Register"
        description="Open, balance, and close register sessions."
      />
      <RegisterConsole {...data} />
    </div>
  );
}
