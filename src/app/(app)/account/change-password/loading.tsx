import { Skeleton } from "@/components/ui/skeleton";

export default function ChangePasswordLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true">
      <span className="sr-only">Loading password settings</span>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
