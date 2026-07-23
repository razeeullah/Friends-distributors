import { KeyRound, MonitorSmartphone, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { getUserDetails } from "@/features/users/queries";
import { ResetPasswordForm } from "@/features/users/reset-password-form";
import { formatKarachiDateTime } from "@/lib/dates";

export default async function UserDetailsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const context = await requirePermission("user.view");
  const { userId } = await params;
  const user = await getUserDetails(context.business.id, userId);
  if (user === null) notFound();
  const canManage = context.permissions.has("user.manage");
  const defaultLocation = user.locations.find(
    ({ location }) => location.id === user.defaultLocationId,
  )?.location;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title={user.displayName}
        description={`${user.email} · @${user.username}`}
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href={`/users/${user.id}/sessions`}>
                  <MonitorSmartphone />
                  Sessions
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/users/${user.id}/edit`}>
                  <Pencil />
                  Edit user
                </Link>
              </Button>
            </div>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>
              Password hashes and session tokens are never exposed.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Detail label="Status">
              <Badge
                variant={
                  user.status === "ACTIVE"
                    ? "default"
                    : user.status === "DISABLED"
                      ? "destructive"
                      : "secondary"
                }
              >
                {user.status}
              </Badge>
            </Detail>
            <Detail label="Phone">{user.phone ?? "Not provided"}</Detail>
            <Detail label="Default location">
              {defaultLocation?.name ?? "Not set"}
            </Detail>
            <Detail label="Last login">
              {user.lastLoginAt
                ? formatKarachiDateTime(user.lastLoginAt)
                : "Never"}
            </Detail>
            <Detail label="Created">
              {formatKarachiDateTime(user.createdAt)}
            </Detail>
            <Detail label="Updated">
              {formatKarachiDateTime(user.updatedAt)}
            </Detail>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>
              Effective access is the union of assigned roles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Roles</p>
              <div className="flex flex-wrap gap-1">
                {user.roles.map(({ role }) => (
                  <Badge key={role.id} variant="outline">
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Locations</p>
              <div className="space-y-1 text-sm">
                {user.locations.map(({ location }) => (
                  <p key={location.id}>
                    {location.name}{" "}
                    <span className="text-muted-foreground">
                      ({location.code})
                    </span>
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound />
              Administrative password reset
            </CardTitle>
            <CardDescription>
              Use only after verifying the user through an approved business
              process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm userId={user.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
