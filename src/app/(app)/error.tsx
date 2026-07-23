"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>We couldn’t load this screen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Unexpected error</AlertTitle>
            <AlertDescription>
              Your data was not changed. Retry the request, or contact an
              administrator if it continues.
            </AlertDescription>
          </Alert>
          <Button onClick={reset}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
