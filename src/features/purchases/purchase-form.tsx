"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPurchaseAction,
  updatePurchaseAction,
} from "@/features/purchases/actions";
import {
  createPurchaseSchema,
  updatePurchaseSchema,
} from "@/features/purchases/schemas";

export interface PurchaseFormValues {
  supplierId: string;
  locationId: string;
  supplierInvoiceNumber: string;
  purchaseDate: string;
  notes: string;
  items: Array<{
    productVariantId: string;
    quantity: string;
    unitCost: string;
    discount: string;
    tax: string;
  }>;
}

interface PurchaseFormProps {
  mode: "create" | "edit";
  purchaseId?: string;
  initialValues: PurchaseFormValues;
  suppliers: readonly { id: string; code: string; name: string }[];
  locations: readonly { id: string; name: string }[];
  variants: readonly {
    id: string;
    sku: string;
    barcode: string;
    label: string;
    unitCost: string;
  }[];
}

const EMPTY_ITEM: PurchaseFormValues["items"][number] = {
  productVariantId: "",
  quantity: "1",
  unitCost: "0.00",
  discount: "0.00",
  tax: "0.00",
};

export function PurchaseForm({
  mode,
  purchaseId,
  initialValues,
  suppliers,
  locations,
  variants,
}: Readonly<PurchaseFormProps>) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormValues>({ defaultValues: initialValues });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
    keyName: "fieldKey",
  });
  const watchedItems = useWatch({ control, name: "items" });
  const variantById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );
  const filteredVariants = useMemo(() => {
    const search = productSearch.trim().toLocaleLowerCase("en");
    if (!search) return variants;
    return variants.filter((variant) =>
      `${variant.label} ${variant.sku} ${variant.barcode}`
        .toLocaleLowerCase("en")
        .includes(search),
    );
  }, [productSearch, variants]);

  const addVariant = (variantId: string) => {
    if (
      !variantId ||
      watchedItems.some((item) => item.productVariantId === variantId)
    ) {
      return;
    }
    const variant = variantById.get(variantId);
    if (!variant) return;
    append({
      ...EMPTY_ITEM,
      productVariantId: variant.id,
      unitCost: variant.unitCost,
    });
    setProductSearch("");
  };

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    const candidate =
      mode === "create"
        ? createPurchaseSchema.safeParse(values)
        : updatePurchaseSchema.safeParse({ ...values, purchaseId });
    if (!candidate.success) {
      for (const issue of candidate.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          setError(field as keyof PurchaseFormValues, {
            message: issue.message,
          });
        }
      }
      setMessage("Check the purchase fields and item amounts.");
      return;
    }
    const result =
      mode === "create"
        ? await createPurchaseAction(createPurchaseSchema.parse(values))
        : await updatePurchaseAction(
            updatePurchaseSchema.parse({ ...values, purchaseId }),
          );
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    if (result.redirectTo) router.push(result.redirectTo);
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to save purchase</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="purchase-supplier">Supplier</Label>
          <select
            id="purchase-supplier"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            {...register("supplierId")}
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name} ({supplier.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase-location">Receiving location</Label>
          <select
            id="purchase-location"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            {...register("locationId")}
          >
            <option value="">Select location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase-invoice">Supplier invoice number</Label>
          <Input id="purchase-invoice" {...register("supplierInvoiceNumber")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase-date">Purchase date</Label>
          <Input id="purchase-date" type="date" {...register("purchaseDate")} />
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Purchase items</h2>
          <p className="text-muted-foreground text-sm">
            Search by product, SKU, or barcode. Totals are recalculated on the
            server.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_280px_auto]">
          <Input
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Search product, SKU or barcode"
            aria-label="Search purchase products"
          />
          <select
            aria-label="Matching product variant"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            defaultValue=""
            onChange={(event) => {
              addVariant(event.target.value);
              event.currentTarget.value = "";
            }}
          >
            <option value="">Select a match</option>
            {filteredVariants.slice(0, 100).map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label} · {variant.sku}
                {variant.barcode ? ` · ${variant.barcode}` : ""}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => addVariant(filteredVariants[0]?.id ?? "")}
          >
            <Plus /> Add
          </Button>
        </div>
        {fields.length === 0 ? (
          <div className="border-border rounded-md border border-dashed p-8 text-center text-sm">
            No items added.
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const selected = variantById.get(
                watchedItems[index]?.productVariantId ?? "",
              );
              return (
                <div
                  key={field.fieldKey}
                  className="grid gap-3 rounded-md border p-4 md:grid-cols-[2fr_repeat(4,1fr)_auto]"
                >
                  <div>
                    <p className="font-medium">
                      {selected?.label ?? "Product variant"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {selected?.sku}
                    </p>
                    <input
                      type="hidden"
                      {...register(`items.${index}.productVariantId`)}
                    />
                  </div>
                  {(["quantity", "unitCost", "discount", "tax"] as const).map(
                    (name) => (
                      <div key={name} className="space-y-1">
                        <Label
                          htmlFor={`purchase-item-${index}-${name}`}
                          className="capitalize"
                        >
                          {name === "unitCost" ? "Unit cost" : name}
                        </Label>
                        <Input
                          id={`purchase-item-${index}-${name}`}
                          inputMode="decimal"
                          {...register(`items.${index}.${name}`)}
                        />
                      </div>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Remove ${selected?.label ?? "item"}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {errors.items?.message ? (
          <p className="text-destructive text-sm">{errors.items.message}</p>
        ) : null}
      </section>

      <div className="space-y-2">
        <Label htmlFor="purchase-notes">Notes</Label>
        <textarea
          id="purchase-notes"
          rows={4}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          {...register("notes")}
        />
      </div>
      <Button type="submit" disabled={isSubmitting || fields.length === 0}>
        {isSubmitting
          ? "Saving…"
          : mode === "create"
            ? "Save draft"
            : "Update draft"}
      </Button>
    </form>
  );
}
