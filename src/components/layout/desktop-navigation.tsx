"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavigationItem } from "@/components/layout/navigation";
import { isNavigationItemActive } from "@/components/layout/navigation";
import { NavigationIcon } from "@/components/layout/navigation-icon";
import { cn } from "@/lib/utils";

export function DesktopNavigation({
  items,
}: Readonly<{ items: readonly NavigationItem[] }>) {
  const pathname = usePathname();

  return (
    <nav
      className="flex-1 space-y-1 overflow-y-auto p-3"
      aria-label="Primary navigation"
    >
      {items.map((item) => {
        const isActive = isNavigationItemActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <NavigationIcon icon={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
