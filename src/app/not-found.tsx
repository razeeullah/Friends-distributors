import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 py-10 text-center">
          <div className="bg-muted mx-auto grid size-12 place-items-center rounded-full">
            <SearchX className="text-muted-foreground size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Page not found</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              The requested POS screen does not exist or is not available yet.
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Return to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
