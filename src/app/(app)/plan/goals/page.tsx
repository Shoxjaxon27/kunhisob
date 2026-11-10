import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listGoals } from "@/server/services/goals";
import { dayKeyOf } from "@/domain/time";
import { GoalsView } from "@/components/plan/goals-view";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await requireOnboardedUser();
  const now = new Date();
  const goals = await listGoals(getDb(), user.id, { includeArchived: true, now });
  return <GoalsView goals={goals} todayKey={dayKeyOf(now)} />;
}
