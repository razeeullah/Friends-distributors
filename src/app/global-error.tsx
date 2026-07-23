"use client";

export default function GlobalError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="en-PK">
      <body className="grid min-h-dvh place-items-center bg-zinc-950 p-6 text-zinc-50">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">
            Retail POS is temporarily unavailable
          </h1>
          <p className="text-sm text-zinc-400">
            The request failed safely. No transaction was submitted from this
            screen.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
