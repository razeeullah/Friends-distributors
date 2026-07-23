import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/features/auth/session";
import { getBusinessSettings } from "@/features/settings/services";
import type { CSSProperties } from "react";

const accentColors = {
  blue: "#2563eb",
  green: "#16a34a",
  violet: "#7c3aed",
  orange: "#f97316",
  red: "#dc2626",
  teal: "#0d9488",
} as const;

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireUser();
  const data = await getBusinessSettings(context.business.id);
  const pos = (data.settings.pos ?? {}) as Record<string, unknown>;
  const theme = pos.themeMode === "dark" ? "dark" : "light";
  const accent =
    typeof pos.accentColor === "string" && pos.accentColor in accentColors
      ? (pos.accentColor as keyof typeof accentColors)
      : "blue";
  return (
    <div
      className={theme === "dark" ? "dark" : undefined}
      style={{ "--primary": accentColors[accent] } as CSSProperties}
    >
      <AppShell context={context}>{children}</AppShell>
    </div>
  );
}
