"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type UseFormRegisterReturn,
} from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProductAction,
  updateProductAction,
} from "@/features/products/actions";
import {
  type CatalogActionResult,
  createProductSchema,
  updateProductSchema,
} from "@/features/products/schemas";

export interface ProductFormValues {
  name: string;
  description: string;
  sku: string;
  categoryId: string;
  brandId: string;
  unitId: string;
  taxable: boolean;
  taxRate: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  minimumStock: string;
  isActive: boolean;
  variants: Array<{
    id?: string;
    name: string;
    sku: string;
    barcode: string;
    size: string;
    color: string;
    costPrice: string;
    sellingPrice: string;
    minimumStock: string;
    isActive: boolean;
  }>;
}

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  initialValues: ProductFormValues;
  categories: readonly { id: string; name: string }[];
  brands: readonly { id: string; name: string }[];
  units: readonly {
    id: string;
    name: string;
    abbreviation: string;
    precision: number;
  }[];
}

const EMPTY_VARIANT: ProductFormValues["variants"][number] = {
  name: "Default",
  sku: "",
  barcode: "",
  size: "",
  color: "",
  costPrice: "0.00",
  sellingPrice: "0.00",
  minimumStock: "0",
  isActive: true,
};

export function ProductForm({
  mode,
  productId,
  initialValues,
  categories,
  brands,
  units,
}: Readonly<ProductFormProps>) {
  const router = useRouter();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({ defaultValues: initialValues });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
    keyName: "fieldKey",
  });
  const taxable = useWatch({ control, name: "taxable" });
  const trackInventory = useWatch({ control, name: "trackInventory" });

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    const candidate =
      mode === "create"
        ? createProductSchema.safeParse(values)
        : updateProductSchema.safeParse({ ...values, productId });
    if (!candidate.success) {
      for (const issue of candidate.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          setError(field as keyof ProductFormValues, {
            message: issue.message,
          });
        }
      }
      setMessage({ type: "error", text: "Check the highlighted fields." });
      return;
    }

    let result: CatalogActionResult;
    if (mode === "create") {
      result = await createProductAction(createProductSchema.parse(values));
    } else {
      result = await updateProductAction(
        updateProductSchema.parse({ ...values, productId }),
      );
    }
    if (!result.success) {
      setMessage({ type: "error", text: result.message });
      return;
    }
    setMessage({ type: "success", text: result.message });
    if (result.redirectTo) router.push(result.redirectTo);
    router.refresh();
  });

  return (
    <form className="space-y-8" onSubmit={onSubmit} noValidate>
      {message ? (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <AlertTitle>
            {message.type === "error" ? "Unable to save" : "Saved"}
          </AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-5">
        <div>
          <h2 className="font-semibold">Product information</h2>
          <p className="text-muted-foreground text-sm">
            Stock is intentionally read-only here and changes only through
            inventory workflows.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Product name"
            htmlFor="product-name"
            error={errors.name?.message}
          >
            <Input
              id="product-name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
          </Field>
          <Field
            label="Base SKU"
            htmlFor="product-sku"
            error={errors.sku?.message}
          >
            <Input
              id="product-sku"
              autoCapitalize="characters"
              aria-invalid={Boolean(errors.sku)}
              {...register("sku")}
            />
          </Field>
          <Field
            label="Category"
            htmlFor="product-category"
            error={errors.categoryId?.message}
          >
            <select
              id="product-category"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              {...register("categoryId")}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Brand"
            htmlFor="product-brand"
            error={errors.brandId?.message}
          >
            <select
              id="product-brand"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              {...register("brandId")}
            >
              <option value="">No brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Unit"
            htmlFor="product-unit"
            error={errors.unitId?.message}
          >
            <select
              id="product-unit"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              {...register("unitId")}
            >
              <option value="">Select unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({unit.abbreviation})
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Minimum stock"
            htmlFor="product-minimum-stock"
            error={errors.minimumStock?.message}
          >
            <Input
              id="product-minimum-stock"
              inputMode="decimal"
              aria-invalid={Boolean(errors.minimumStock)}
              {...register("minimumStock")}
            />
          </Field>
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-description">Description</Label>
          <textarea
            id="product-description"
            rows={4}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            {...register("description")}
          />
          {errors.description?.message ? (
            <FieldError>{errors.description.message}</FieldError>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border p-5 md:grid-cols-2 lg:grid-cols-3">
        <Toggle
          label="Taxable"
          description="Apply the configured percentage to future sales."
          registration={register("taxable")}
        />
        <Field
          label="Tax rate (%)"
          htmlFor="product-tax-rate"
          error={errors.taxRate?.message}
        >
          <Input
            id="product-tax-rate"
            inputMode="decimal"
            disabled={!taxable}
            aria-invalid={Boolean(errors.taxRate)}
            {...register("taxRate")}
          />
        </Field>
        <Toggle
          label="Track inventory"
          description="Maintain balances and stock ledger entries."
          registration={register("trackInventory")}
        />
        <Toggle
          label="Allow negative stock"
          description="Allow transactions to move stock below zero."
          disabled={!trackInventory}
          registration={register("allowNegativeStock")}
        />
        <Toggle
          label="Active product"
          description="Inactive products remain in history but cannot be sold."
          registration={register("isActive")}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">Variants</h2>
            <p className="text-muted-foreground text-sm">
              Use a single “Default” variant for products without options.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ ...EMPTY_VARIANT })}
          >
            <Plus />
            Add variant
          </Button>
        </div>
        {errors.variants?.message ? (
          <FieldError>{errors.variants.message}</FieldError>
        ) : null}
        {fields.length === 0 ? (
          <Alert>
            <AlertTitle>Default variant will be created</AlertTitle>
            <AlertDescription>
              A zero-priced default variant using the base SKU will be created
              by the server.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-4">
          {fields.map((field, index) => (
            <fieldset
              key={field.fieldKey}
              className="space-y-4 rounded-lg border p-5"
            >
              <legend className="px-1 font-semibold">
                Variant {index + 1}
              </legend>
              <input type="hidden" {...register(`variants.${index}.id`)} />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Variant name"
                  htmlFor={`variant-${index}-name`}
                  error={errors.variants?.[index]?.name?.message}
                >
                  <Input
                    id={`variant-${index}-name`}
                    {...register(`variants.${index}.name`)}
                  />
                </Field>
                <Field
                  label="SKU"
                  htmlFor={`variant-${index}-sku`}
                  error={errors.variants?.[index]?.sku?.message}
                >
                  <Input
                    id={`variant-${index}-sku`}
                    autoCapitalize="characters"
                    {...register(`variants.${index}.sku`)}
                  />
                </Field>
                <Field
                  label="Barcode"
                  htmlFor={`variant-${index}-barcode`}
                  error={errors.variants?.[index]?.barcode?.message}
                >
                  <Input
                    id={`variant-${index}-barcode`}
                    {...register(`variants.${index}.barcode`)}
                  />
                </Field>
                <Field
                  label="Size"
                  htmlFor={`variant-${index}-size`}
                  error={errors.variants?.[index]?.size?.message}
                >
                  <Input
                    id={`variant-${index}-size`}
                    {...register(`variants.${index}.size`)}
                  />
                </Field>
                <Field
                  label="Color"
                  htmlFor={`variant-${index}-color`}
                  error={errors.variants?.[index]?.color?.message}
                >
                  <Input
                    id={`variant-${index}-color`}
                    {...register(`variants.${index}.color`)}
                  />
                </Field>
                <Field
                  label="Cost price (PKR)"
                  htmlFor={`variant-${index}-cost`}
                  error={errors.variants?.[index]?.costPrice?.message}
                >
                  <Input
                    id={`variant-${index}-cost`}
                    inputMode="decimal"
                    {...register(`variants.${index}.costPrice`)}
                  />
                </Field>
                <Field
                  label="Selling price (PKR)"
                  htmlFor={`variant-${index}-selling`}
                  error={errors.variants?.[index]?.sellingPrice?.message}
                >
                  <Input
                    id={`variant-${index}-selling`}
                    inputMode="decimal"
                    {...register(`variants.${index}.sellingPrice`)}
                  />
                </Field>
                <Field
                  label="Minimum stock"
                  htmlFor={`variant-${index}-minimum`}
                  error={errors.variants?.[index]?.minimumStock?.message}
                >
                  <Input
                    id={`variant-${index}-minimum`}
                    inputMode="decimal"
                    {...register(`variants.${index}.minimumStock`)}
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Toggle
                  label="Active variant"
                  description="Inactive variants remain available to transaction history."
                  registration={register(`variants.${index}.isActive`)}
                />
                {field.id ? (
                  <p className="text-muted-foreground text-xs">
                    Existing variants cannot be removed; mark inactive instead.
                  </p>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                    Remove
                  </Button>
                )}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Create product"
              : "Save product"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: Readonly<{
  label: string;
  htmlFor: string;
  error: string | undefined;
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

function FieldError({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="text-destructive text-xs" role="alert">
      {children}
    </p>
  );
}

function Toggle({
  label,
  description,
  registration,
  disabled = false,
}: Readonly<{
  label: string;
  description: string;
  registration: UseFormRegisterReturn;
  disabled?: boolean;
}>) {
  return (
    <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <input
        type="checkbox"
        disabled={disabled}
        className="mt-0.5 size-4"
        {...registration}
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-muted-foreground mt-1 block text-xs">
          {description}
        </span>
      </span>
    </label>
  );
}
