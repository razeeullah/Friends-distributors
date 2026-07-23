"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSupplierAction } from "@/features/purchases/actions";
import {
  supplierSchema,
  type SupplierInput,
} from "@/features/purchases/schemas";

export function SupplierForm({
  initialValues,
}: Readonly<{ initialValues: SupplierInput }>) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SupplierInput>({ defaultValues: initialValues });

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    const parsed = supplierSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          setError(field as keyof SupplierInput, { message: issue.message });
        }
      }
      setMessage("Check the highlighted fields.");
      return;
    }
    const result = await saveSupplierAction(parsed.data);
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    if (result.redirectTo) router.push(result.redirectTo);
    router.refresh();
  });

  const fields = [
    ["code", "Supplier code"],
    ["name", "Supplier name"],
    ["contactName", "Contact name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["taxRegistrationNumber", "Tax / registration number"],
  ] as const;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to save</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        {fields.map(([name, label]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={`supplier-${name}`}>{label}</Label>
            <Input
              id={`supplier-${name}`}
              type={name === "email" ? "email" : "text"}
              aria-invalid={Boolean(errors[name])}
              {...register(name)}
            />
            {errors[name]?.message ? (
              <p className="text-destructive text-sm">
                {errors[name]?.message}
              </p>
            ) : null}
          </div>
        ))}
        <div className="space-y-2">
          <Label htmlFor="supplier-terms">Payment terms (days)</Label>
          <Input
            id="supplier-terms"
            type="number"
            min="0"
            {...register("paymentTermsDays")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier-opening-balance">
            Opening payable balance (PKR)
          </Label>
          <Input
            id="supplier-opening-balance"
            inputMode="decimal"
            {...register("openingBalance")}
          />
          {errors.openingBalance?.message ? (
            <p className="text-destructive text-sm">
              {errors.openingBalance.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="supplier-address">Address</Label>
          <textarea
            id="supplier-address"
            rows={4}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            {...register("address")}
          />
        </div>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" {...register("isActive")} /> Active supplier
        </label>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save supplier"}
      </Button>
    </form>
  );
}
