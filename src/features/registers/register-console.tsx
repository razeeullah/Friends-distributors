"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  closeRegisterAction,
  openRegisterAction,
  recordCashMovementAction,
} from "@/features/registers/actions";
type Props = {
  registers: { id: string; name: string; code: string }[];
  active: {
    id: string;
    register: { name: string };
    openingCash: { toString(): string };
    movements: {
      id: string;
      amount: { toString(): string };
      movementType: string;
      notes: string | null;
    }[];
  } | null;
  history: {
    id: string;
    register: { name: string };
    status: string;
    openingCash: { toString(): string };
    expectedCash: { toString(): string } | null;
    closingCash: { toString(): string } | null;
    cashDifference: { toString(): string } | null;
    openedAt: Date;
  }[];
};
export function RegisterConsole({ registers, active, history }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const run = (action: () => Promise<{ success: boolean; message: string }>) =>
    startTransition(async () => setMessage((await action()).message));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">
          {active ? `Active: ${active.register.name}` : "Open register"}
        </h2>
        {active ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              Opening cash: {active.openingCash.toString()}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={pending}
                onClick={() => {
                  const amount = window.prompt("Cash in amount");
                  const reason = window.prompt("Reason");
                  if (amount && reason)
                    run(() =>
                      recordCashMovementAction({
                        registerSessionId: active.id,
                        type: "CASH_IN",
                        amount,
                        reason,
                      }),
                    );
                }}
              >
                Cash in
              </Button>
              <Button
                disabled={pending}
                variant="outline"
                onClick={() => {
                  const amount = window.prompt("Cash out amount");
                  const reason = window.prompt("Reason");
                  if (amount && reason)
                    run(() =>
                      recordCashMovementAction({
                        registerSessionId: active.id,
                        type: "CASH_OUT",
                        amount,
                        reason,
                      }),
                    );
                }}
              >
                Cash out
              </Button>
            </div>
            <Button
              disabled={pending}
              variant="destructive"
              onClick={() => {
                const countedCash = window.prompt("Counted cash");
                const notes = window.prompt("Closing notes") ?? undefined;
                if (countedCash)
                  run(() =>
                    closeRegisterAction({
                      registerSessionId: active.id,
                      countedCash,
                      notes,
                    }),
                  );
              }}
            >
              Close register
            </Button>
            <div className="text-sm">
              {active.movements.map((movement) => (
                <p key={movement.id}>
                  {movement.movementType}: {movement.amount.toString()} —{" "}
                  {movement.notes}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <OpenForm registers={registers} pending={pending} run={run} />
        )}
        {message ? (
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
        ) : null}
      </section>
      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">Session history</h2>
        <div className="mt-3 space-y-2 text-sm">
          {history.map((session) => (
            <div key={session.id} className="border-b pb-2">
              <b>{session.register.name}</b> · {session.status}
              <br />
              Opening {session.openingCash.toString()} · Expected{" "}
              {session.expectedCash?.toString() ?? "—"} · Difference{" "}
              {session.cashDifference?.toString() ?? "—"}
            </div>
          ))}
          {history.length === 0 ? (
            <p className="text-muted-foreground">No register sessions.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
function OpenForm({
  registers,
  pending,
  run,
}: {
  registers: Props["registers"];
  pending: boolean;
  run: (action: () => Promise<{ success: boolean; message: string }>) => void;
}) {
  const [registerId, setRegisterId] = useState(registers[0]?.id ?? "");
  const [openingCash, setOpeningCash] = useState("0");
  return (
    <div className="mt-4 space-y-3">
      <select
        className="w-full rounded border p-2"
        value={registerId}
        onChange={(event) => setRegisterId(event.target.value)}
      >
        {registers.map((register) => (
          <option value={register.id} key={register.id}>
            {register.name}
          </option>
        ))}
      </select>
      <Input
        value={openingCash}
        onChange={(event) => setOpeningCash(event.target.value)}
        placeholder="Opening cash"
      />
      <Button
        disabled={pending || !registerId}
        onClick={() =>
          run(() => openRegisterAction({ registerId, openingCash }))
        }
      >
        Open register
      </Button>
    </div>
  );
}
