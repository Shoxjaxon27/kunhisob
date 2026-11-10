import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getSettings } from "@/server/services/settings";
import { listCategories } from "@/server/services/categories";
import { SettingsView } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const db = getDb();
  const [settings, categories] = await Promise.all([
    getSettings(db, user.id),
    listCategories(db, user.id, { includeArchived: true }),
  ]);
  return <SettingsView settings={settings} categories={categories} isAdmin={user.role === "ADMIN"} />;
}
