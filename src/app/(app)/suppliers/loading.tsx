import { Skeleton } from "@/components/ui/skeleton";
export default function SuppliersLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
