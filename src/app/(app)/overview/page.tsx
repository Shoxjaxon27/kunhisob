import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getDashboard } from "@/server/services/dashboard";
import { getPulse } from "@/server/services/pulse";
import { getPlanSummary } from "@/server/services/plan-summary";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { greeting, longDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireOnboardedUser();
  const now = new Date();
  const db = getDb();
  const [data, plan, pulse] = await Promise.all([
    getDashboard(db, user.id, now),
    getPlanSummary(db, user.id, now),
    getPulse(db, user.id, now),
  ]);
  return (
    <DashboardView
      data={data}
      plan={plan}
      pulse={pulse}
      userName={user.name}
      greetingText={greeting(now)}
      dateText={longDate(data.todayKey)}
    />
  );
}
