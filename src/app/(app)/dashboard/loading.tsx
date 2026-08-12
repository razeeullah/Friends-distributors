import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return <div className="mx-auto max-w-[1600px] space-y-4"><Skeleton className="h-20 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32" />)}</div><div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div><div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-72" />)}</div></div>;
}
