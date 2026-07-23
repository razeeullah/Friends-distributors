"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStockAdjustmentAction } from "@/features/inventory/actions";
import { stockAdjustmentSchema } from "@/features/inventory/schemas";

interface AdjustmentFormValues {
  locationId: string;
  adjustmentType: "INCREASE" | "DECREASE";
  reason: string;
  notes: string;
  items: Array<{ productVariantId: string; countedQuantity: string }>;
}

interface VariantOption {
  id: string;
  label: string;
  sku: string;
  barcode: string;
  systemQuantity: string;
}

export function StockAdjustmentForm({
  locations,
  variantsByLocation,
  initialLocationId,
}: Readonly<{
  locations: readonly { id: string; name: string }[];
  variantsByLocation: Readonly<Record<string, readonly VariantOption[]>>;
  initialLocationId: string;
}>) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormValues>({
    defaultValues: {
      locationId: initialLocationId,
      adjustmentType: "INCREASE",
      reason: "",
      notes: "",
      items: [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
    keyName: "fieldKey",
  });
  const items = useWatch({ control, name: "items" });
  const selectedLocationId = useWatch({ control, name: "locationId" });
  const variants = useMemo(
    () => variantsByLocation[selectedLocationId] ?? [],
    [selectedLocationId, variantsByLocation],
  );
  const variantById = useMemo(
    () => new Map(variants.map((variant) => [variant.id, variant])),
    [variants],
  );
  const results = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("en");
    if (!needle) return variants;
    return variants.filter((variant) =>
      `${variant.label} ${variant.sku} ${variant.barcode}`
        .toLocaleLowerCase("en")
        .includes(needle),
    );
  }, [search, variants]);

  const addItem = (variantId: string) => {
    if (
      !variantId ||
      items.some((item) => item.productVariantId === variantId)
    ) {
      return;
    }
    const variant = variantById.get(variantId);
    if (!variant) return;
    append({
      productVariantId: variant.id,
      countedQuantity: variant.systemQuantity,
    });
    setSearch("");
  };

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    const parsed = stockAdjustmentSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          setError(field as keyof AdjustmentFormValues, {
            message: issue.message,
          });
        }
      }
      setMessage("Check the adjustment fields and counted quantities.");
      return;
    }
    const result = await createStockAdjustmentAction(parsed.data);
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    if (result.redirectTo) router.push(result.redirectTo);
    router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to create adjustment</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="adjustment-location">Location</Label>
          <select
            id="adjustment-location"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            {...register("locationId")}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            System quantities follow the selected location; posting always
            re-reads live stock.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adjustment-type">Adjustment direction</Label>
          <select
            id="adjustment-type"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            {...register("adjustmentType")}
          >
            <option value="INCREASE">Adjustment in</option>
            <option value="DECREASE">Adjustment out</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adjustment-reason">Reason</Label>
          <Input id="adjustment-reason" {...register("reason")} />
          {errors.reason?.message ? (
            <p className="text-destructive text-sm">{errors.reason.message}</p>
          ) : null}
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Counted items</h2>
          <p className="text-muted-foreground text-sm">
            A positive count difference is an adjustment in; a negative
            difference is an adjustment out.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_280px_auto]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, SKU or barcode"
            aria-label="Search inventory products"
          />
          <select
            aria-label="Matching product variant"
            defaultValue=""
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            onChange={(event) => {
              addItem(event.target.value);
              event.currentTarget.value = "";
            }}
          >
            <option value="">Select a match</option>
            {results.slice(0, 100).map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label} · {variant.sku}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => addItem(results[0]?.id ?? "")}
          >
            <Plus /> Add
          </Button>
        </div>
        {fields.length === 0 ? (
          <div className="border-border rounded-md border border-dashed p-8 text-center text-sm">
            No products selected.
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const variant = variantById.get(
                items[index]?.productVariantId ?? "",
              );
              return (
                <div
                  key={field.fieldKey}
                  className="grid items-end gap-3 rounded-md border p-4 md:grid-cols-[1fr_150px_180px_auto]"
                >
                  <div>
                    <p className="font-medium">
                      {variant?.label ?? "Product variant"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {variant?.sku}
                    </p>
                    <input
                      type="hidden"
                      {...register(`items.${index}.productVariantId`)}
                    />
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground block text-xs">
                      System quantity
                    </span>
                    {variant?.systemQuantity ?? "0"}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`adjustment-count-${field.fieldKey}`}>
                      Counted quantity
                    </Label>
                    <Input
                      id={`adjustment-count-${field.fieldKey}`}
                      inputMode="decimal"
                      {...register(`items.${index}.countedQuantity`)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Remove ${variant?.label ?? "item"}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <div className="space-y-2">
        <Label htmlFor="adjustment-notes">Notes</Label>
        <textarea
          id="adjustment-notes"
          rows={4}
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          {...register("notes")}
        />
      </div>
      <Button type="submit" disabled={isSubmitting || fields.length === 0}>
        {isSubmitting ? "Creating…" : "Create draft adjustment"}
      </Button>
    </form>
  );
}
