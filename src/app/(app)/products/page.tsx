import {
  Boxes,
  CircleDollarSign,
  Eye,
  ImageIcon,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Tags,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageTitle } from "@/components/layout/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  requireLocationAccess,
  requirePermission,
} from "@/features/auth/session";
import { getCatalogOptions, listProducts } from "@/features/products/queries";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(
  raw: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const item = single(value);
    if (item && key !== "page") parameters.set(key, item);
  }
  parameters.set("page", String(page));
  return `/products?${parameters.toString()}`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("product.view");
  const raw = await searchParams;
  const requestedLocationId = single(raw.locationId);
  if (
    requestedLocationId &&
    !context.locations.some(({ id }) => id === requestedLocationId)
  ) {
    await requireLocationAccess(requestedLocationId);
  }
  const location =
    context.locations.find(({ id }) => id === requestedLocationId) ??
    context.currentLocation;
  const canCreate = context.permissions.has("product.create");
  const canManageReferences = context.permissions.has("category.manage");

  if (location === null) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageTitle title="Products" />
        <Alert>
          <Boxes />
          <AlertTitle>No assigned location</AlertTitle>
          <AlertDescription>
            A location assignment is required to display current stock.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [{ items, query, pagination }, options, catalog, active, lowStock] =
    await Promise.all([
      listProducts(context.business.id, location.id, {
        search: single(raw.search),
        categoryId: single(raw.categoryId),
        brandId: single(raw.brandId),
        status: single(raw.status),
        lowStock: single(raw.lowStock),
        sort: single(raw.sort),
        page: single(raw.page),
        pageSize: single(raw.pageSize),
      }),
      getCatalogOptions(context.business.id),
      listProducts(context.business.id, location.id, {
        status: "all",
        page: "1",
        pageSize: "1",
      }),
      listProducts(context.business.id, location.id, {
        status: "active",
        page: "1",
        pageSize: "1",
      }),
      listProducts(context.business.id, location.id, {
        status: "active",
        lowStock: "true",
        page: "1",
        pageSize: "1",
      }),
    ]);
  const canUpdate = context.permissions.has("product.update");

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <PageTitle
        title="Products"
        description={`Manage your catalog and stock availability at ${location.name}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageReferences ? (
              <Button asChild variant="outline">
                <Link href="/products/categories">
                  <Tags />
                  Catalog settings
                </Link>
              </Button>
            ) : null}
            {canCreate ? (
              <Button asChild>
                <Link href="/products/new">
                  <Plus />
                  Create product
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProductMetric
          label="Total catalog items"
          value={catalog.pagination.totalItems.toLocaleString("en-PK")}
          detail="Including active and archived products"
          icon={<Boxes className="size-6" />}
          tone="blue"
        />
        <ProductMetric
          label="Active products"
          value={active.pagination.totalItems.toLocaleString("en-PK")}
          detail="Available to sell"
          icon={<PackageCheck className="size-6" />}
          tone="green"
        />
        <ProductMetric
          label="Low-stock products"
          value={lowStock.pagination.totalItems.toLocaleString("en-PK")}
          detail="Need replenishment attention"
          icon={<TriangleAlert className="size-6" />}
          tone="orange"
        />
        <ProductMetric
          label="Categories"
          value={options.categories.length.toLocaleString("en-PK")}
          detail="Organising the current catalog"
          icon={<CircleDollarSign className="size-6" />}
          tone="purple"
        />
      </section>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-3">
          <form
            method="get"
            className="grid gap-2 md:grid-cols-4 xl:grid-cols-[minmax(15rem,1.5fr)_repeat(5,minmax(8.5rem,1fr))_auto]"
          >
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="text-muted-foreground absolute top-3 left-3 size-4" />
              <Input
                name="search"
                defaultValue={query.search}
                placeholder="Search product, SKU, or barcode…"
                aria-label="Search products"
                className="h-10 pl-9"
              />
            </div>
            <select
              name="categoryId"
              defaultValue={query.categoryId ?? ""}
              aria-label="Filter category"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All categories</option>
              {options.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="brandId"
              defaultValue={query.brandId ?? ""}
              aria-label="Filter brand"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All brands</option>
              {options.brands.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={query.status}
              aria-label="Filter status"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
            <select
              name="lowStock"
              defaultValue={query.lowStock}
              aria-label="Filter low stock"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="false">All stock</option>
              <option value="true">Low stock only</option>
            </select>
            <select
              name="locationId"
              defaultValue={location.id}
              aria-label="Stock location"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              {context.locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={query.sort}
              aria-label="Sort products"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="price_asc">Price low–high</option>
              <option value="price_desc">Price high–low</option>
              <option value="stock_asc">Stock low–high</option>
              <option value="stock_desc">Stock high–low</option>
              <option value="created_desc">Newest</option>
              <option value="created_asc">Oldest</option>
            </select>
            <div className="flex gap-2 md:col-span-4 xl:col-span-1">
              <Button type="submit" className="rounded-lg">
                Filter
              </Button>
              <Button asChild variant="outline">
                <Link href="/products">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <CardContent className="overflow-x-auto px-0">
          {items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Boxes className="text-muted-foreground mx-auto mb-3 size-8" />
              <p className="font-medium">No products found</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Adjust the filters or create a product.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/45 text-xs">
                <tr className="text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Variants</th>
                  <th className="px-4 py-3 font-medium">Selling price</th>
                  <th className="px-4 py-3 font-medium">Current stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/25">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-slate-100 via-stone-50 to-slate-200">
                          <ImageIcon
                            className="text-muted-foreground size-5"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <Link
                            href={`/products/${product.id}?locationId=${location.id}`}
                            className="font-medium hover:underline"
                          >
                            {product.name}
                          </Link>
                          <p className="text-muted-foreground text-xs">
                            {product.sku} · {product.brandName ?? "No brand"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{product.categoryName}</td>
                    <td className="px-4 py-3">{product.variantCount}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatMoney(parseMoneyToMinor(product.sellingPrice))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          product.lowStock
                            ? "text-destructive font-semibold"
                            : "font-medium"
                        }
                      >
                        {product.currentStock} {product.unitAbbreviation}
                      </span>
                      {product.lowStock ? (
                        <Badge variant="destructive" className="ml-2">
                          Low
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          product.archivedAt
                            ? "outline"
                            : product.isActive
                              ? "default"
                              : "secondary"
                        }
                      >
                        {product.archivedAt
                          ? "Archived"
                          : product.isActive
                            ? "Active"
                            : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        asChild
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`View ${product.name}`}
                      >
                        <Link
                          href={`/products/${product.id}?locationId=${location.id}`}
                        >
                          <Eye />
                        </Link>
                      </Button>
                      {canUpdate ? (
                        <Button
                          asChild
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Link href={`/products/${product.id}/edit`}>
                            <Pencil />
                          </Link>
                        </Button>
                      ) : null}
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
          {pagination.totalItems} products · Page {pagination.page} of{" "}
          {Math.max(1, pagination.totalPages)}
        </p>
        <div className="flex gap-2">
          {pagination.hasPreviousPage ? (
            <Button asChild size="sm" variant="outline">
              <Link href={pageHref(raw, pagination.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Previous
            </Button>
          )}
          {pagination.hasNextPage ? (
            <Button asChild size="sm" variant="outline">
              <Link href={pageHref(raw, pagination.page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductMetric({
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
