import { TodayBudget } from "@/components/dashboard/today-budget";
import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listAccounts } from "@/server/services/accounts";
import { dayKeyOf } from "@/domain/time";
import { isCurrency } from "@/domain/money";

export default async function HomePage() {
  const user = await requireOnboardedUser();
  const db = getDb();
  const [settings, accounts] = await Promise.all([
    db.settings.findUnique({ where: { userId: user.id } }),
    listAccounts(db, user.id),
  ]);
  const currency = isCurrency(settings?.primaryCurrency) ? settings.primaryCurrency : "UZS";
  const balance = accounts.filter(a => a.currency === currency).reduce((sum, a) => sum + a.balance, 0n);
  return <TodayBudget userId={user.id} today={dayKeyOf(new Date())} currency={currency} payday={settings?.payday ?? null} balance={balance} />;
}
