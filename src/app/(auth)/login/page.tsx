import { LockKeyhole, ShieldCheck, Store } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/features/auth/login-form";
import { getAuthContext } from "@/features/auth/session";

export const metadata: Metadata = { title: "Sign in" };

interface LoginPageProps {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}

function safeReturnPath(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value;
  return path !== undefined && path.startsWith("/") && !path.startsWith("//")
    ? path.slice(0, 500)
    : "/dashboard";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [context, query] = await Promise.all([getAuthContext(), searchParams]);
  if (context !== null) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-3">
        <div className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-xl shadow-lg shadow-black/20">
          <Store className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold tracking-tight">Retail POS</p>
          <p className="text-muted-foreground text-xs">
            Secure business operations
          </p>
        </div>
      </div>

      <Card className="border-border/80 shadow-2xl shadow-black/20">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <Badge variant="secondary" className="gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Protected access
            </Badge>
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in with your staff email or username to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm returnTo={safeReturnPath(query.returnTo)} />
        </CardContent>
      </Card>

      <p className="text-muted-foreground flex items-center justify-center gap-2 text-center text-xs">
        <LockKeyhole className="size-3.5" aria-hidden="true" />
        Sessions expire automatically and all sign-in activity is audited.
      </p>
    </div>
  );
}
