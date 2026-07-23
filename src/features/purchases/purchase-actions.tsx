"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelPurchaseAction,
  markPurchaseOrderedAction,
  receivePurchaseAction,
  recordPurchasePaymentAction,
} from "@/features/purchases/actions";
import type {
  PurchasePaymentInput,
  ReceivePurchaseInput,
} from "@/features/purchases/schemas";

interface ReceivableItem {
  id: string;
  label: string;
  ordered: string;
  received: string;
  remaining: string;
}

export function PurchaseStateActions({
  purchaseId,
  canOrder,
  canCancel,
}: Readonly<{
  purchaseId: string;
  canOrder: boolean;
  canCancel: boolean;
}>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (kind: "order" | "cancel") => {
    if (
      kind === "cancel" &&
      !window.confirm("Cancel this unreceived purchase?")
    )
      return;
    startTransition(async () => {
      const result =
        kind === "order"
          ? await markPurchaseOrderedAction({ purchaseId })
          : await cancelPurchaseAction({ purchaseId });
      setMessage(result.message);
      if (result.success) router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canOrder ? (
          <Button disabled={pending} onClick={() => run("order")}>
            Mark ordered
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            disabled={pending}
            variant="destructive"
            onClick={() => run("cancel")}
          >
            Cancel purchase
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ReceivePurchaseForm({
  purchaseId,
  items,
}: Readonly<{ purchaseId: string; items: readonly ReceivableItem[] }>) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ReceivePurchaseInput>({
    defaultValues: {
      purchaseId,
      items: items.map((item) => ({ purchaseItemId: item.id, quantity: "0" })),
    },
  });

  const submit = handleSubmit(async (values) => {
    const result = await receivePurchaseAction(values);
    setMessage(result.message);
    if (result.success) router.refresh();
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {items.map((item, index) => (
        <div
          key={item.id}
          className="grid items-end gap-3 md:grid-cols-[1fr_120px_120px_180px]"
        >
          <div>
            <p className="font-medium">{item.label}</p>
            <p className="text-muted-foreground text-xs">
              Remaining {item.remaining}
            </p>
          </div>
          <div className="text-sm">Ordered {item.ordered}</div>
          <div className="text-sm">Received {item.received}</div>
          <div className="space-y-1">
            <Label htmlFor={`receive-${item.id}`}>Receive now</Label>
            <input
              type="hidden"
              {...register(`items.${index}.purchaseItemId`)}
            />
            <Input
              id={`receive-${item.id}`}
              inputMode="decimal"
              aria-label={`Receive quantity for ${item.label}`}
              {...register(`items.${index}.quantity`)}
            />
          </div>
        </div>
      ))}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Receiving…" : "Receive stock"}
      </Button>
    </form>
  );
}

export function PurchasePaymentForm({
  purchaseId,
  balance,
}: Readonly<{ purchaseId: string; balance: string }>) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PurchasePaymentInput>({
    defaultValues: {
      purchaseId,
      paymentMethod: "CASH",
      amount: balance,
      reference: "",
    },
  });
  const submit = handleSubmit(async (values) => {
    const result = await recordPurchasePaymentAction(values);
    setMessage(result.message);
    if (result.success) router.refresh();
  });
  return (
    <form onSubmit={submit} className="space-y-4">
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="payment-method">Payment method</Label>
          <select
            id="payment-method"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            {...register("paymentMethod")}
          >
            {[
              "CASH",
              "CARD",
              "BANK_TRANSFER",
              "MOBILE_WALLET",
              "STORE_CREDIT",
              "OTHER",
            ].map((method) => (
              <option key={method} value={method}>
                {method.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="payment-amount">Amount (PKR)</Label>
          <Input
            id="payment-amount"
            inputMode="decimal"
            {...register("amount")}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payment-reference">Reference</Label>
          <Input id="payment-reference" {...register("reference")} />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
