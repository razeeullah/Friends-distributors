import { Boxes, ImageIcon, Pencil } from "lucide-react";
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
import {
  requireLocationAccess,
  requirePermission,
} from "@/features/auth/session";
import { ArchiveProductButton } from "@/features/products/archive-product-button";
import {
  getProductActivity,
  getProductDetails,
} from "@/features/products/queries";
import { formatKarachiDateTime } from "@/lib/dates";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: SearchParams;
}) {
  const context = await requirePermission("product.view");
  const [{ productId }, raw] = await Promise.all([params, searchParams]);
  const requested = Array.isArray(raw.locationId)
    ? raw.locationId[0]
    : raw.locationId;
  if (requested && !context.locations.some(({ id }) => id === requested)) {
    await requireLocationAccess(requested);
  }
  const location =
    context.locations.find(({ id }) => id === requested) ??
    context.currentLocation;
  if (location === null) notFound();
  const [product, activity] = await Promise.all([
    getProductDetails(context.business.id, productId, location.id),
    getProductActivity(context.business.id, productId),
  ]);
  if (product === null) notFound();
  const canEdit =
    context.permissions.has("product.update") && product.archivedAt === null;
  const canArchive =
    context.permissions.has("product.archive") && product.archivedAt === null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title={product.name}
        description={`${product.sku} · ${product.category.name} · ${location.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button asChild variant="outline">
                <Link href={`/products/${product.id}/edit`}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
            ) : null}
            {canArchive ? (
              <ArchiveProductButton productId={product.id} />
            ) : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-4">
            <div className="bg-muted grid aspect-square place-items-center rounded-lg">
              <ImageIcon className="text-muted-foreground size-14" />
              <span className="sr-only">Product image placeholder</span>
            </div>
            <div className="flex flex-wrap gap-2">
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
              {product.trackInventory ? (
                <Badge variant="outline">Inventory tracked</Badge>
              ) : (
                <Badge variant="outline">Non-stock</Badge>
              )}
              {product.taxable ? (
                <Badge variant="outline">Tax {product.taxRate}%</Badge>
              ) : (
                <Badge variant="outline">Non-taxable</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Product details</CardTitle>
            <CardDescription>
              Stock shown below is calculated from inventory balances and cannot
              be edited here.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Category">{product.category.name}</Detail>
            <Detail label="Brand">{product.brand?.name ?? "No brand"}</Detail>
            <Detail label="Unit">
              {product.unit.name} ({product.unit.abbreviation})
            </Detail>
            <Detail label="Minimum stock">{product.minimumStock}</Detail>
            <Detail label="Negative stock">
              {product.allowNegativeStock ? "Allowed" : "Blocked"}
            </Detail>
            <Detail label="Created">
              {formatKarachiDateTime(product.createdAt)}
            </Detail>
            {product.description ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <Detail label="Description">{product.description}</Detail>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>
            Current stock at {location.name}. Stock mutations belong to
            purchases, returns, transfers, or adjustments.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b">
              <tr className="text-muted-foreground">
                <th className="px-6 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium">Barcode</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Selling</th>
                <th className="px-4 py-3 font-medium">Current stock</th>
                <th className="px-4 py-3 font-medium">Minimum</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {product.variants.map((variant) => (
                <tr key={variant.id}>
                  <td className="px-6 py-4">
                    <p className="font-medium">{variant.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {variant.sku}
                      {variant.size ? ` · ${variant.size}` : ""}
                      {variant.color ? ` · ${variant.color}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    {variant.barcodes[0]?.barcode ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    {formatMoney(parseMoneyToMinor(variant.costPrice))}
                  </td>
                  <td className="px-4 py-4 font-medium">
                    {formatMoney(parseMoneyToMinor(variant.sellingPrice))}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={
                        product.trackInventory &&
                        quantityAtOrBelow(
                          variant.currentStock,
                          variant.minimumStock,
                        )
                          ? "text-destructive font-semibold"
                          : "font-medium"
                      }
                    >
                      {variant.currentStock} {product.unit.abbreviation}
                    </span>
                  </td>
                  <td className="px-4 py-4">{variant.minimumStock}</td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        variant.archivedAt
                          ? "outline"
                          : variant.isActive
                            ? "default"
                            : "secondary"
                      }
                    >
                      {variant.archivedAt
                        ? "Archived"
                        : variant.isActive
                          ? "Active"
                          : "Inactive"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes />
            Product activity
          </CardTitle>
          <CardDescription>
            Immutable audit history for catalog changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium">No activity recorded</p>
            </div>
          ) : (
            <div className="divide-y">
              {activity.map((entry) => (
                <article
                  key={entry.id}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-muted-foreground text-xs">
                      By {entry.actor?.displayName ?? "System"}
                      {entry.actor?.username
                        ? ` (@${entry.actor.username})`
                        : ""}
                    </p>
                  </div>
                  <time className="text-muted-foreground text-xs">
                    {formatKarachiDateTime(entry.createdAt)}
                  </time>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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

function quantityAtOrBelow(value: string, threshold: string): boolean {
  const normalize = (input: string) => {
    const [whole = "0", fraction = ""] = input.split(".");
    return (
      BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0").slice(0, 4))
    );
  };
  return normalize(value) <= normalize(threshold);
}
