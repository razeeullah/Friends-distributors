import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { getRoleEditorData } from "@/features/users/queries";
import { RoleForm } from "@/features/users/role-form";

export const metadata: Metadata = { title: "Edit role" };

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const context = await requirePermission("role.manage");
  const { roleId } = await params;
  const { permissions, role } = await getRoleEditorData(
    context.business.id,
    roleId,
  );
  if (role === null) notFound();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title={`Edit ${role.name}`}
        description="Permission changes take effect on the next authorized request."
      />
      <Card>
        <CardContent>
          <RoleForm
            mode="edit"
            permissions={permissions}
            role={{
              id: role.id,
              code: role.code,
              name: role.name,
              description: role.description,
              isSystem: role.isSystem,
              permissionIds: role.permissions.map(
                ({ permissionId }) => permissionId,
              ),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
