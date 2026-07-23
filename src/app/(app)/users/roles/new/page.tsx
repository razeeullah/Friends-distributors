import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { getRoleEditorData } from "@/features/users/queries";
import { RoleForm } from "@/features/users/role-form";

export const metadata: Metadata = { title: "Create custom role" };

export default async function CreateRolePage() {
  const context = await requirePermission("role.manage");
  const { permissions } = await getRoleEditorData(context.business.id);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title="Create custom role"
        description="A stable custom identifier is generated when the role is created."
      />
      <Card>
        <CardContent>
          <RoleForm mode="create" role={null} permissions={permissions} />
        </CardContent>
      </Card>
    </div>
  );
}
