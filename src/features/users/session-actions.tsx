"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/features/users/actions";

export function RevokeSessionButton({
  userId,
  sessionId,
  disabled,
}: Readonly<{ userId: string; sessionId: string; disabled: boolean }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-1 text-right">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || pending}
        onClick={() => {
          if (!window.confirm("Revoke this session immediately?")) return;
          startTransition(async () => {
            const result = await revokeSessionAction({ userId, sessionId });
            setMessage(result.message);
            router.refresh();
          });
        }}
      >
        {pending ? "Revoking…" : disabled ? "Revoked" : "Revoke"}
      </Button>
      {message ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function RevokeOtherSessionsButton({
  userId,
}: Readonly<{ userId: string }>) {
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
            !window.confirm("Revoke all other active sessions for this user?")
          )
            return;
          startTransition(async () => {
            const result = await revokeOtherSessionsAction({ userId });
            setMessage(result.message);
            router.refresh();
          });
        }}
      >
        {pending ? "Revoking…" : "Revoke all other sessions"}
      </Button>
      {message ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
