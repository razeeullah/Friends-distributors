import { KeyRound, LogOut, MapPin, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";

import { AppBreadcrumbs } from "@/components/layout/app-breadcrumbs";
import { DesktopNavigation } from "@/components/layout/desktop-navigation";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { navigationItems } from "@/components/layout/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/features/auth/actions";
import type { AuthContext } from "@/features/auth/session";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell({
  context,
  children,
}: Readonly<{ context: AuthContext; children: React.ReactNode }>) {
  const visibleNavigationItems = navigationItems.filter((item) =>
    item.permissions.some((permission) => context.permissions.has(permission)),
  );

  return (
    <div className="bg-background min-h-dvh">
      <aside className="bg-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 border-r md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="bg-sidebar-primary text-sidebar-primary-foreground grid size-9 place-items-center rounded-lg">
            <Store className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold tracking-tight">Retail POS</p>
            <p className="text-muted-foreground truncate text-xs">
              {context.business.name}
            </p>
          </div>
        </div>
        <Separator />
        <DesktopNavigation items={visibleNavigationItems} />
        <div className="border-t p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <ShieldCheck className="text-primary size-4" aria-hidden="true" />
            Server-enforced access
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="bg-background/90 sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <MobileNavigation items={visibleNavigationItems} />
            <div>
              <p className="text-sm font-medium md:hidden">
                {context.business.name}
              </p>
              <p className="text-muted-foreground text-xs md:hidden">
                {context.business.currencyCode}
              </p>
            </div>
            <AppBreadcrumbs />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 gap-3 px-2"
                aria-label="Open account menu"
              >
                <Avatar className="size-8">
                  <AvatarFallback>
                    {initials(context.user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-44 truncate text-sm font-medium sm:block">
                  {context.user.displayName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="space-y-1">
                <p className="truncate font-medium">
                  {context.user.displayName}
                </p>
                <p className="text-muted-foreground truncate text-xs font-normal">
                  {context.user.email}
                </p>
                <p className="text-muted-foreground truncate text-xs font-normal">
                  @{context.user.username}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="space-y-1 px-2 py-2">
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {context.currentLocation?.name ?? "No assigned location"}
                </p>
              </div>
              <DropdownMenuSeparator />
              <div className="flex flex-wrap gap-1.5 px-2 py-2">
                {context.roles.map((role) => (
                  <Badge
                    key={role.code}
                    variant="secondary"
                    className="text-[10px]"
                  >
                    {role.name}
                  </Badge>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account/change-password">
                  <KeyRound className="size-4" aria-hidden="true" />
                  Change password
                </Link>
              </DropdownMenuItem>
              <form action={logoutAction} className="p-1">
                <Button
                  type="submit"
                  variant="ghost"
                  className="w-full justify-start"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Sign out
                </Button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
