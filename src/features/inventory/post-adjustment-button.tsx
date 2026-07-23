"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { postStockAdjustmentAction } from "@/features/inventory/actions";

export function PostAdjustmentButton({
  adjustmentId,
}: Readonly<{ adjustmentId: string }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const post = () => {
    if (
      !window.confirm(
        "Post this adjustment? This creates permanent stock movements.",
      )
    )
      return;
    startTransition(async () => {
      const result = await postStockAdjustmentAction({ adjustmentId });
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
      <Button onClick={post} disabled={pending}>
        {pending ? "Posting…" : "Post adjustment"}
      </Button>
    </div>
  );
}
