import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import {
  getUserAdministrationOptions,
  getUserDetails,
} from "@/features/users/queries";
import { UserForm } from "@/features/users/user-form";

export const metadata: Metadata = { title: "Edit user" };

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const context = await requirePermission("user.manage");
  const { userId } = await params;
  const [user, options] = await Promise.all([
    getUserDetails(context.business.id, userId),
    getUserAdministrationOptions(context.business.id),
  ]);
  if (user === null) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageTitle
        title={`Edit ${user.displayName}`}
        description="Changes to disabled accounts immediately revoke active sessions."
      />
      <Card>
        <CardContent>
          <UserForm
            mode="edit"
            userId={user.id}
            roles={options.roles.map(({ id, code, name, isSystem }) => ({
              id,
              code,
              name,
              isSystem,
            }))}
            locations={options.locations}
            initialValues={{
              displayName: user.displayName,
              email: user.email,
              username: user.username,
              phone: user.phone ?? "",
              password: "",
              roleIds: user.roles.map(({ role }) => role.id),
              locationIds: user.locations.map(({ location }) => location.id),
              defaultLocationId:
                user.defaultLocationId ?? user.locations[0]?.location.id ?? "",
              status: user.status === "ARCHIVED" ? "DISABLED" : user.status,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
