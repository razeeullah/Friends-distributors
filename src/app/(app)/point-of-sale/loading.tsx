import { Skeleton } from "@/components/ui/skeleton";

export default function PointOfSaleLoading() {
  return <div className="mx-auto grid max-w-[1600px] gap-4 2xl:grid-cols-[minmax(0,1fr)_29rem]"><div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-14 w-full" /><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-72" />)}</div></div><Skeleton className="h-[700px]" /></div>;
}
