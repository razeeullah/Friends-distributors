import {
  Eye,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/features/auth/session";
import {
  getUserAdministrationOptions,
  listUsers,
} from "@/features/users/queries";
import { formatKarachiDate } from "@/lib/dates";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function userStatusBadge(status: string) {
  return status === "ACTIVE"
    ? "default"
    : status === "DISABLED"
      ? "destructive"
      : "secondary";
}

function pageHref(
  query: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const item = single(value);
    if (item && key !== "page") parameters.set(key, item);
  }
  parameters.set("page", String(page));
  return `/users?${parameters.toString()}`;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("user.view");
  const raw = await searchParams;
  const queryInput = {
    search: single(raw.search),
    status: single(raw.status),
    roleId: single(raw.roleId),
    locationId: single(raw.locationId),
    sort: single(raw.sort),
    page: single(raw.page),
    pageSize: single(raw.pageSize),
  };
  const [{ items, query, pagination }, options] = await Promise.all([
    listUsers(context.business.id, queryInput),
    getUserAdministrationOptions(context.business.id),
  ]);
  const canManage = context.permissions.has("user.manage");

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <PageTitle
        title="Users"
        description="Manage staff access, role assignments, locations, and account status."
        actions={
          canManage ? (
            <div className="flex gap-2">
              {context.permissions.has("role.manage") ? (
                <Button asChild variant="outline">
                  <Link href="/users/roles">
                    <ShieldCheck />
                    Roles
                  </Link>
                </Button>
              ) : null}
              <Button asChild>
                <Link href="/users/new">
                  <Plus />
                  Create user
                </Link>
              </Button>
            </div>
          ) : null
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UserMetric
          label="Total users"
          value={pagination.totalItems.toLocaleString("en-PK")}
          detail="Matching the current filters"
          icon={<UsersRound className="size-6" />}
          tone="blue"
        />
        <UserMetric
          label="Active users"
          value={items
            .filter((user) => user.status === "ACTIVE")
            .length.toLocaleString("en-PK")}
          detail="On the current page"
          icon={<UserCheck className="size-6" />}
          tone="green"
        />
        <UserMetric
          label="Role groups"
          value={options.roles.length.toLocaleString("en-PK")}
          detail="Available role assignments"
          icon={<ShieldCheck className="size-6" />}
          tone="orange"
        />
        <UserMetric
          label="Pending invitations"
          value={items
            .filter((user) => user.status === "INVITED")
            .length.toLocaleString("en-PK")}
          detail="On the current page"
          icon={<Mail className="size-6" />}
          tone="purple"
        />
      </section>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-3">
          <form className="grid gap-3 md:grid-cols-6" method="get">
            <div className="relative md:col-span-2">
              <Search className="text-muted-foreground absolute top-3 left-3 size-4" />
              <Input
                name="search"
                defaultValue={query.search}
                placeholder="Search name, email, or username…"
                aria-label="Search users"
                className="h-10 pl-9"
              />
            </div>
            <select
              name="status"
              defaultValue={query.status ?? ""}
              aria-label="Filter by status"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
              <option value="INVITED">Invited</option>
            </select>
            <select
              name="roleId"
              defaultValue={query.roleId ?? ""}
              aria-label="Filter by role"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All roles</option>
              {options.roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            <select
              name="locationId"
              defaultValue={query.locationId ?? ""}
              aria-label="Filter by location"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All locations</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={query.sort}
              aria-label="Sort users"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
            </select>
            <div className="flex gap-2 md:col-span-6 md:justify-end">
              <Button type="submit" className="rounded-lg">
                Filter
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/users">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <CardContent className="overflow-x-auto px-0">
          {items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium">No users found</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Adjust the filters or create a user.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/45 text-xs">
                <tr className="text-muted-foreground">
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Locations</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/25">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                          {user.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <Link
                            href={`/users/${user.id}`}
                            className="font-medium hover:underline"
                          >
                            {user.displayName}
                          </Link>
                          <p className="text-muted-foreground text-xs">
                            {user.email} · @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={userStatusBadge(user.status)}>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map(({ role }) => (
                          <Badge key={role.id} variant="outline">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.locations
                        .map(({ location }) => location.name)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      {formatKarachiDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        asChild
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`View ${user.displayName}`}
                      >
                        <Link href={`/users/${user.id}`}>
                          <Eye />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {pagination.totalItems} users · Page {pagination.page} of{" "}
          {Math.max(pagination.totalPages, 1)}
        </p>
        <div className="flex gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            aria-disabled={!pagination.hasPreviousPage}
          >
            <Link
              href={
                pagination.hasPreviousPage
                  ? pageHref(raw, pagination.page - 1)
                  : "#"
              }
            >
              Previous
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            aria-disabled={!pagination.hasNextPage}
          >
            <Link
              href={
                pagination.hasNextPage
                  ? pageHref(raw, pagination.page + 1)
                  : "#"
              }
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function UserMetric({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: "blue" | "green" | "orange" | "purple";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-violet-50 text-violet-600",
  };
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-xl p-3 ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="mt-1 truncate text-xl font-bold tracking-tight">
            {value}
          </p>
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {detail}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
