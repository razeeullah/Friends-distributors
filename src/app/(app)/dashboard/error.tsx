"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <div className="grid min-h-[60dvh] place-items-center"><div className="rounded-xl border bg-card p-6 text-center shadow-sm"><AlertTriangle className="mx-auto size-8 text-destructive" /><h2 className="mt-3 font-semibold">Unable to load dashboard data</h2><p className="mt-1 text-sm text-muted-foreground">Please try loading the dashboard again.</p><Button className="mt-4" onClick={reset}>Retry</Button></div></div>;
}
