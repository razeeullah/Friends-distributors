"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveBrandAction,
  saveCategoryAction,
  saveUnitAction,
} from "@/features/products/actions";
import {
  brandSchema,
  categorySchema,
  unitSchema,
} from "@/features/products/schemas";

interface ReferenceRecord {
  id: string;
  name: string;
  description?: string | null;
  abbreviation?: string;
  precision?: number;
  isActive: boolean;
  productCount: number;
}

interface ReferenceValues {
  name: string;
  description: string;
  abbreviation: string;
  precision: number;
  isActive: boolean;
}

export function ReferenceManager({
  kind,
  records,
}: Readonly<{
  kind: "category" | "brand" | "unit";
  records: readonly ReferenceRecord[];
}>) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReferenceValues>({
    defaultValues: {
      name: "",
      description: "",
      abbreviation: "",
      precision: 0,
      isActive: true,
    },
  });

  const beginEdit = (record: ReferenceRecord) => {
    setEditingId(record.id);
    setMessage(null);
    reset({
      name: record.name,
      description: record.description ?? "",
      abbreviation: record.abbreviation ?? "",
      precision: record.precision ?? 0,
      isActive: record.isActive,
    });
  };

  const clearForm = () => {
    setEditingId(null);
    reset({
      name: "",
      description: "",
      abbreviation: "",
      precision: 0,
      isActive: true,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-xl border">
        {records.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">No records yet</p>
            <p className="text-muted-foreground text-sm">
              Create the first {kind} using the form.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {records.map((record) => (
              <article
                key={record.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {record.name}
                    {record.abbreviation ? (
                      <Badge variant="outline">{record.abbreviation}</Badge>
                    ) : null}
                    <Badge variant={record.isActive ? "default" : "secondary"}>
                      {record.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {record.productCount} products
                    {record.precision === undefined
                      ? ""
                      : ` · ${record.precision} decimal places`}
                  </p>
                  {record.description ? (
                    <p className="text-muted-foreground mt-2 text-sm">
                      {record.description}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => beginEdit(record)}
                >
                  Edit
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>

      <form
        className="h-fit space-y-4 rounded-xl border p-5"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setMessage(null);
          const payload = {
            ...values,
            ...(editingId ? { id: editingId } : {}),
          };
          const parsed =
            kind === "unit"
              ? unitSchema.safeParse(payload)
              : kind === "category"
                ? categorySchema.safeParse(payload)
                : brandSchema.safeParse(payload);
          if (!parsed.success) {
            for (const issue of parsed.error.issues) {
              const field = issue.path[0];
              if (typeof field === "string" && field in values) {
                setError(field as keyof ReferenceValues, {
                  message: issue.message,
                });
              }
            }
            setMessage({ type: "error", text: "Check the form values." });
            return;
          }
          const result =
            kind === "unit"
              ? await saveUnitAction(unitSchema.parse(payload))
              : kind === "category"
                ? await saveCategoryAction(categorySchema.parse(payload))
                : await saveBrandAction(brandSchema.parse(payload));
          setMessage({
            type: result.success ? "success" : "error",
            text: result.message,
          });
          if (result.success) {
            clearForm();
            router.refresh();
          }
        })}
      >
        <div>
          <h2 className="font-semibold">
            {editingId ? `Edit ${kind}` : `Create ${kind}`}
          </h2>
          <p className="text-muted-foreground text-xs">
            Changes are audited and business-scoped.
          </p>
        </div>
        {message ? (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertTitle>
              {message.type === "error" ? "Unable to save" : "Saved"}
            </AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="reference-name">Name</Label>
          <Input
            id="reference-name"
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
          {errors.name?.message ? (
            <FieldError>{errors.name.message}</FieldError>
          ) : null}
        </div>
        {kind === "unit" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="reference-abbreviation">Abbreviation</Label>
              <Input
                id="reference-abbreviation"
                aria-invalid={Boolean(errors.abbreviation)}
                {...register("abbreviation")}
              />
              {errors.abbreviation?.message ? (
                <FieldError>{errors.abbreviation.message}</FieldError>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-precision">Quantity precision</Label>
              <Input
                id="reference-precision"
                type="number"
                min={0}
                max={4}
                aria-invalid={Boolean(errors.precision)}
                {...register("precision", { valueAsNumber: true })}
              />
              {errors.precision?.message ? (
                <FieldError>{errors.precision.message}</FieldError>
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="reference-description">Description</Label>
            <textarea
              id="reference-description"
              rows={3}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              {...register("description")}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" {...register("isActive")} />
          Active
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editingId ? "Save changes" : "Create"}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={clearForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
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
