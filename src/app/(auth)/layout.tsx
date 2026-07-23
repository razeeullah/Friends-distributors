export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        className="bg-primary/10 pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">{children}</div>
    </main>
  );
}
