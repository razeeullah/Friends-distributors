"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { archiveProductAction } from "@/features/products/actions";

export function ArchiveProductButton({
  productId,
}: Readonly<{ productId: string }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-1 text-right">
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Archive this product? It will no longer be available for new sales.",
            )
          )
            return;
          startTransition(async () => {
            const result = await archiveProductAction({ productId });
            setMessage(result.message);
            if (result.success) {
              router.push("/products?status=archived");
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Archiving…" : "Archive product"}
      </Button>
      {message ? (
        <p
          className="text-muted-foreground max-w-sm text-xs"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
