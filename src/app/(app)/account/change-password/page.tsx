import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/features/auth/change-password-form";
import { requireUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        title="Change password"
        description="Rotate your credentials and revoke other active sessions."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password security</CardTitle>
          <CardDescription>
            Your current session will be securely rotated after the change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
