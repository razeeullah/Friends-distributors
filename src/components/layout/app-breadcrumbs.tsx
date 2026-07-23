"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { findNavigationItemBySegment } from "@/components/layout/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const segment = pathname.split("/").filter(Boolean)[0];
  const currentItem = segment
    ? findNavigationItemBySegment(segment)
    : undefined;
  const accountPageLabel =
    pathname === "/account/change-password" ? "Change password" : undefined;

  if ((!currentItem && !accountPageLabel) || currentItem?.href === "/dashboard") {
    return (
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb className="hidden sm:block">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentItem?.label ?? accountPageLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
