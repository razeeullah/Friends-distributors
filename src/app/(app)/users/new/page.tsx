import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { getUserAdministrationOptions } from "@/features/users/queries";
import { UserForm } from "@/features/users/user-form";

export const metadata: Metadata = { title: "Create user" };

export default async function CreateUserPage() {
  const context = await requirePermission("user.manage");
  const options = await getUserAdministrationOptions(context.business.id);
  const defaultLocationId = options.locations[0]?.id ?? "";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageTitle
        title="Create user"
        description="Create a staff account and assign its least-privilege roles and locations."
      />
      <Card>
        <CardContent>
          <UserForm
            mode="create"
            roles={options.roles.map(({ id, code, name, isSystem }) => ({
              id,
              code,
              name,
              isSystem,
            }))}
            locations={options.locations}
            initialValues={{
              displayName: "",
              email: "",
              username: "",
              phone: "",
              password: "",
              roleIds: [],
              locationIds: defaultLocationId ? [defaultLocationId] : [],
              defaultLocationId,
              status: "ACTIVE",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
