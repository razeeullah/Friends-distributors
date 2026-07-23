import { ArrowRight, Plus, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { listRoles } from "@/features/users/queries";

export default async function RolesPage() {
  const context = await requirePermission("role.manage");
  const roles = await listRoles(context.business.id);
  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <PageTitle
        title="Roles and permissions"
        description="System identifiers are immutable. Custom roles support least-privilege permission sets."
        actions={
          <Button asChild>
            <Link href="/users/roles/new">
              <Plus />
              Create custom role
            </Link>
          </Button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                Role groups
              </p>
              <p className="mt-1 text-xl font-bold">{roles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <UsersRound className="size-6" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                Assigned users
              </p>
              <p className="mt-1 text-xl font-bold">
                {roles.reduce((sum, role) => sum + role._count.users, 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                Permission sets
              </p>
              <p className="mt-1 text-xl font-bold">
                {roles.reduce((sum, role) => sum + role._count.permissions, 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <CardContent className="p-3">
          {roles.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium">No roles found</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => (
                <article
                  key={role.id}
                  className="bg-card rounded-xl border p-4"
                >
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {role.name}
                      {role.isSystem ? (
                        <Badge variant="secondary">System</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {role.code} · {role._count.users} users ·{" "}
                      {role._count.permissions} permissions
                    </p>
                    {role.description ? (
                      <p className="text-muted-foreground mt-2 text-sm">
                        {role.description}
                      </p>
                    ) : null}
                  </div>
                  <Button asChild className="mt-4 w-full" variant="outline">
                    <Link href={`/users/roles/${role.id}/edit`}>
                      Edit permissions <ArrowRight />
                    </Link>
                  </Button>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
