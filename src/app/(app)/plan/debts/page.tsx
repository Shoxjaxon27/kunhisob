import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { debtTotals, listDebts } from "@/server/services/debts";
import { listAccounts } from "@/server/services/accounts";
import { dayKeyOf } from "@/domain/time";
import { DebtsView } from "@/components/plan/debts-view";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const user = await requireOnboardedUser();
  const now = new Date();
  const db = getDb();
  const [debts, accounts] = await Promise.all([listDebts(db, user.id, now), listAccounts(db, user.id)]);
  return (
    <DebtsView
      debts={debts}
      totals={debtTotals(debts)}
      todayKey={dayKeyOf(now)}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
    />
  );
}
