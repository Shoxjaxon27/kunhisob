import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { getDb } from "@/server/db";
import { requireOnboardedUser } from "@/server/auth/current";
import { getSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireOnboardedUser();
  const db = getDb();
  const settings = await getSettings(db, user.id);

  return (
    <AppShell userName={settings.name} theme={settings.theme} motion={settings.motion}>
      {children}
    </AppShell>
  );
}
