import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="bg-background min-h-dvh p-6" aria-busy="true">
      <span className="sr-only">Loading application</span>
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
