import { MonitorSmartphone } from "lucide-react";
import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { getUserDetails, summarizeUserAgent } from "@/features/users/queries";
import {
  RevokeOtherSessionsButton,
  RevokeSessionButton,
} from "@/features/users/session-actions";
import { formatKarachiDateTime } from "@/lib/dates";

export default async function UserSessionsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const context = await requirePermission("user.manage");
  const { userId } = await params;
  const user = await getUserDetails(context.business.id, userId);
  if (user === null) notFound();
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title={`${user.displayName}'s sessions`}
        description="Review devices and revoke access immediately. Only session hashes exist in storage."
        actions={<RevokeOtherSessionsButton userId={user.id} />}
      />
      <Card>
        <CardContent className="px-0">
          {user.sessions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <MonitorSmartphone className="text-muted-foreground mx-auto mb-3 size-8" />
              <p className="font-medium">No sessions found</p>
            </div>
          ) : (
            <div className="divide-y">
              {user.sessions.map((session) => {
                const active =
                  session.revokedAt === null && session.expiresAt > now;
                const current = session.id === context.sessionId;
                return (
                  <article
                    key={session.id}
                    className="grid gap-4 px-6 py-5 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {summarizeUserAgent(session.userAgent)}
                        {current ? (
                          <Badge variant="secondary">Current session</Badge>
                        ) : null}
                        <Badge variant={active ? "default" : "outline"}>
                          {active
                            ? "Active"
                            : session.revokedAt
                              ? "Revoked"
                              : "Expired"}
                        </Badge>
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        IP {session.ipAddress ?? "not available"}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">
                        Last activity
                      </p>
                      <p>{formatKarachiDateTime(session.lastSeenAt)}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Created {formatKarachiDateTime(session.createdAt)}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground text-xs">Expires</p>
                      <p>{formatKarachiDateTime(session.expiresAt)}</p>
                    </div>
                    <RevokeSessionButton
                      userId={user.id}
                      sessionId={session.id}
                      disabled={!active}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
