"use client";

import { Menu, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { NavigationItem } from "@/components/layout/navigation";
import { isNavigationItemActive } from "@/components/layout/navigation";
import { NavigationIcon } from "@/components/layout/navigation-icon";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function MobileNavigation({
  items,
}: Readonly<{ items: readonly NavigationItem[] }>) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b p-5 text-left">
          <SheetTitle className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-lg">
              <Store className="size-4" />
            </span>
            Retail POS
          </SheetTitle>
        </SheetHeader>
        <nav className="space-y-1 p-3" aria-label="Mobile navigation">
          {items.map((item) => {
            const isActive = isNavigationItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive && "bg-accent text-accent-foreground",
                )}
              >
                <NavigationIcon icon={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
