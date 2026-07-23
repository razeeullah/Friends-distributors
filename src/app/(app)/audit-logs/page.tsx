import { PageTitle } from "@/components/layout/page-title";
import { requirePermission } from "@/features/auth/session";
import { listAuditLogs } from "@/features/audit/queries";
export default async function AuditLogsPage() {
  const context = await requirePermission("audit.view");
  const logs = await listAuditLogs(
    context.business.id,
    context.locations.map((location) => location.id),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title="Audit logs"
        description="Security-relevant, location-scoped activity. Sensitive values are redacted."
      />
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr className="border-t" key={log.id}>
                <td className="p-3">
                  {log.createdAt.toLocaleString("en-PK", {
                    timeZone: "Asia/Karachi",
                  })}
                </td>
                <td>{log.actor?.displayName ?? "System"}</td>
                <td>{log.action}</td>
                <td>{log.entityType}</td>
                <td>{log.summary ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground p-8 text-center"
                  colSpan={5}
                >
                  No audit events.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
