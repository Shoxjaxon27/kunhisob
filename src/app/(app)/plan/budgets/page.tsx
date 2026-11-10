import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listBudgets } from "@/server/services/budgets";
import { listCategories } from "@/server/services/categories";
import { listAccounts } from "@/server/services/accounts";
import { monthKeyOf } from "@/domain/time";
import { BudgetsView } from "@/components/plan/budgets-view";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireOnboardedUser();
  const sp = await searchParams;
  const now = new Date();
  const currentMonth = monthKeyOf(now);
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : currentMonth;
  const db = getDb();
  const [budgets, categories, accounts] = await Promise.all([
    listBudgets(db, user.id, month, now),
    listCategories(db, user.id),
    listAccounts(db, user.id),
  ]);
  const currencies = [...new Set(accounts.map((a) => a.currency))];
  return (
    <BudgetsView
      month={month}
      currentMonth={currentMonth}
      budgets={budgets}
      categories={categories.filter((c) => c.kind === "EXPENSE").map((c) => ({ id: c.id, name: c.name }))}
      currencies={currencies.length ? currencies : ["UZS"]}
    />
  );
}
