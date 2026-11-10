import type { Db } from "../db";
import { periodTotals, type TxType } from "@/domain/ledger";
import { computePulse, type Pulse } from "@/domain/pulse";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import { addDays, dayKeyOf, dayRange, monthKeyOf, monthRange } from "@/domain/time";
import { listAccounts } from "./accounts";
import { listBudgets } from "./budgets";
import { listDebts } from "./debts";

export type PulseData = { currency: CurrencyCode; pulse: Pulse };

/** Asosiy valyutadagi joriy oy ma'lumotlaridan Financial Pulse. Valyutalar aralashtirilmaydi. */
export async function getPulse(db: Db, userId: string, now: Date = new Date()): Promise<PulseData> {
  const settings = await db.settings.findUnique({ where: { userId } });
  const currency: CurrencyCode = settings && isCurrency(settings.primaryCurrency) ? settings.primaryCurrency : "UZS";
  const todayKey = dayKeyOf(now);
  const monthKey = monthKeyOf(now);
  const m = monthRange(monthKey);
  const last30 = dayRange(addDays(todayKey, -29), todayKey);

  const sumRows = (where: object) =>
    db.transaction.groupBy({ by: ["type"], where: { userId, deletedAt: null, currency, ...where }, _sum: { amount: true } });

  const [monthRows, last30Rows, accounts, budgets, debts] = await Promise.all([
    sumRows({ occurredAt: { gte: m.start, lt: m.end } }),
    sumRows({ type: { in: ["EXPENSE", "REFUND"] }, occurredAt: { gte: last30.start, lt: last30.end } }),
    listAccounts(db, userId),
    listBudgets(db, userId, monthKey, now),
    listDebts(db, userId, now),
  ]);

  const toInput = (rows: typeof monthRows) => rows.map((r) => ({ type: r.type as TxType, sum: r._sum.amount ?? 0n }));
  const month = periodTotals(toInput(monthRows));
  const spend30 = periodTotals(toInput(last30Rows)).netExpense;
  const balance = accounts.filter((a) => a.currency === currency).reduce((s, a) => s + a.balance, 0n);
  const cb = budgets.filter((b) => b.currency === currency);
  const borrowed = debts.filter((d) => d.currency === currency && d.direction === "BORROWED" && d.status !== "PAID");

  const pulse = computePulse({
    income: month.income,
    netExpense: month.netExpense,
    budgets: {
      total: cb.length,
      over: cb.filter((b) => b.progress.status === "over").length,
      warn: cb.filter((b) => b.progress.status === "warn").length,
    },
    borrowedDebts: { active: borrowed.length, overdue: borrowed.filter((d) => d.due === "overdue").length },
    balance,
    spend30: spend30 < 0n ? 0n : spend30,
  });
  return { currency, pulse };
}
