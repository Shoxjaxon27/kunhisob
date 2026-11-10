import type { Db } from "../db";
import { AppError } from "../errors";
import { periodTotals, type PeriodTotals, type TxType } from "@/domain/ledger";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import { dayKeyOf, dayRange, isDayKey } from "@/domain/time";
import {
  MAX_RANGE_DAYS,
  balanceTimeline,
  bucketKeyOf,
  bucketKind,
  buildBuckets,
  buildInsights,
  changePct,
  dailyAverage,
  previousRange,
  rangeDays,
  savingsRate,
  weekdayStats,
  type BalanceEvent,
  type BucketKind,
  type Insight,
  type WeekdayStat,
} from "@/domain/analytics";

export type AnalyticsQuery = { from: string; to: string; currency: CurrencyCode };

export type FlowPoint = { key: string; label: string; from: string; to: string; income: bigint; netExpense: bigint };
export type BalancePoint = { key: string; label: string; balance: bigint };
export type CategoryStat = {
  id: string | null;
  name: string;
  color: string;
  icon: string;
  amount: bigint;
  sharePct: number;
  prevAmount: bigint;
  /** Oldingi davrga nisbatan, %. Oldingi 0 bo'lsa null. */
  changePct: number | null;
};
export type IncomeSource = { id: string | null; name: string; color: string; amount: bigint; sharePct: number };
export type TopExpense = {
  id: string;
  note: string;
  category: string | null;
  amount: bigint;
  dayKey: string;
};
export type TopNote = { note: string; total: bigint; count: number };

export type AnalyticsData = {
  query: AnalyticsQuery & { days: number; elapsedDays: number };
  prev: { from: string; to: string };
  currencies: CurrencyCode[];
  hasData: boolean;
  txCount: number;
  totals: PeriodTotals;
  prevTotals: PeriodTotals;
  savingsRatePct: number | null;
  avgDailySpend: bigint;
  prevAvgDailySpend: bigint;
  expenseChangePct: number | null;
  incomeChangePct: number | null;
  bucketKind: BucketKind;
  flow: FlowPoint[];
  balance: BalancePoint[];
  categories: CategoryStat[];
  incomeSources: IncomeSource[];
  weekdays: WeekdayStat[];
  busiestWeekday: WeekdayStat | null;
  topExpenses: TopExpense[];
  topNotes: TopNote[];
  insights: Insight[];
};

const TOP_CATEGORIES = 8;

export function validateRange(from: string, to: string): void {
  if (!isDayKey(from) || !isDayKey(to)) throw new AppError("validation", "Sana noto‘g‘ri");
  if (to < from) throw new AppError("validation", "Tugash sanasi boshlanishdan oldin bo‘lmasin");
  if (rangeDays(from, to) > MAX_RANGE_DAYS) throw new AppError("validation", "Oraliq juda uzun (ko‘pi bilan 10 yil)");
}

async function totalsFor(db: Db, userId: string, currency: CurrencyCode, from: string, to: string): Promise<PeriodTotals> {
  const { start, end } = dayRange(from, to);
  const rows = await db.transaction.groupBy({
    by: ["type"],
    where: { userId, currency, deletedAt: null, occurredAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  return periodTotals(rows.map((r) => ({ type: r.type as TxType, sum: r._sum.amount ?? 0n })));
}

/** Kategoriya → sof xarajat (xarajat − qaytim). */
async function netByCategory(db: Db, userId: string, currency: CurrencyCode, from: string, to: string) {
  const { start, end } = dayRange(from, to);
  const rows = await db.transaction.groupBy({
    by: ["categoryId", "type"],
    where: {
      userId,
      currency,
      deletedAt: null,
      type: { in: ["EXPENSE", "REFUND"] },
      occurredAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });
  const out = new Map<string | null, bigint>();
  for (const r of rows) {
    const v = r._sum.amount ?? 0n;
    out.set(r.categoryId, (out.get(r.categoryId) ?? 0n) + (r.type === "EXPENSE" ? v : -v));
  }
  return out;
}

const pct = (part: bigint, whole: bigint): number => (whole > 0n ? Number((part * 1000n) / whole) / 10 : 0);

export async function getAnalytics(
  db: Db,
  userId: string,
  query: AnalyticsQuery,
  now: Date = new Date(),
): Promise<AnalyticsData> {
  validateRange(query.from, query.to);
  const { from, to, currency } = query;
  const days = rangeDays(from, to);
  const todayKey = dayKeyOf(now);
  const effectiveTo = to < todayKey ? to : todayKey;
  const elapsedDays = from > effectiveTo ? 0 : rangeDays(from, effectiveTo);
  const prev = previousRange(from, to);
  const { start, end } = dayRange(from, to);

  const accounts = await db.account.findMany({ where: { userId } });
  const currencies = [...new Set(accounts.filter((a) => !a.archivedAt).map((a) => a.currency))].filter(isCurrency);
  const accIds = accounts.filter((a) => a.currency === currency).map((a) => a.id);

  const [totals, prevTotals, rows, catNow, catPrev, topRows, cats, balanceTx, balanceFrom, balanceTo] =
    await Promise.all([
      totalsFor(db, userId, currency, from, to),
      totalsFor(db, userId, currency, prev.from, prev.to),
      db.transaction.findMany({
        where: {
          userId,
          currency,
          deletedAt: null,
          type: { in: ["INCOME", "EXPENSE", "REFUND"] },
          occurredAt: { gte: start, lt: end },
        },
        select: { type: true, amount: true, occurredAt: true, categoryId: true, note: true },
      }),
      netByCategory(db, userId, currency, from, to),
      netByCategory(db, userId, currency, prev.from, prev.to),
      db.transaction.findMany({
        where: { userId, currency, deletedAt: null, type: "EXPENSE", occurredAt: { gte: start, lt: end } },
        orderBy: [{ amount: "desc" }, { occurredAt: "desc" }],
        take: 5,
        include: { category: true },
      }),
      db.category.findMany({ where: { userId } }),
      db.transaction.findMany({
        where: { userId, deletedAt: null, accountId: { in: accIds }, occurredAt: { lt: end } },
        select: { occurredAt: true, flow: true, amount: true },
      }),
      db.transfer.findMany({
        where: { userId, deletedAt: null, fromAccountId: { in: accIds }, occurredAt: { lt: end } },
        select: { occurredAt: true, fromAmount: true },
      }),
      db.transfer.findMany({
        where: { userId, deletedAt: null, toAccountId: { in: accIds }, occurredAt: { lt: end } },
        select: { occurredAt: true, toAmount: true },
      }),
    ]);

  // Kunlik yig'indilar → grafik bo'laklari, hafta kunlari, kategoriya/izoh yig'indilari.
  const kind = bucketKind(days);
  const buckets = buildBuckets(from, to, kind);
  const flowMap = new Map(buckets.map((b) => [b.key, { income: 0n, netExpense: 0n }]));
  const perDay = new Map<string, bigint>();
  const incomeByCat = new Map<string | null, bigint>();
  const notes = new Map<string, { note: string; total: bigint; count: number }>();

  for (const r of rows) {
    const day = dayKeyOf(r.occurredAt);
    const slot = flowMap.get(bucketKeyOf(day, kind));
    if (!slot) continue;
    if (r.type === "INCOME") {
      slot.income += r.amount;
      incomeByCat.set(r.categoryId, (incomeByCat.get(r.categoryId) ?? 0n) + r.amount);
    } else {
      const delta = r.type === "EXPENSE" ? r.amount : -r.amount;
      slot.netExpense += delta;
      perDay.set(day, (perDay.get(day) ?? 0n) + delta);
      const key = r.note.trim().toLowerCase();
      if (r.type === "EXPENSE" && key) {
        const n = notes.get(key) ?? { note: r.note.trim(), total: 0n, count: 0 };
        n.total += r.amount;
        n.count += 1;
        notes.set(key, n);
      }
    }
  }
  const flow: FlowPoint[] = buckets.map((b) => ({ ...b, ...flowMap.get(b.key)! }));

  // Balans dinamikasi (bu valyutadagi barcha hisoblar bo'yicha).
  const opening = accounts.filter((a) => a.currency === currency).reduce((s, a) => s + a.openingBalance, 0n);
  const events: BalanceEvent[] = [
    ...balanceTx.map((t) => ({ at: t.occurredAt, delta: t.flow === "IN" ? t.amount : -t.amount })),
    ...balanceFrom.map((t) => ({ at: t.occurredAt, delta: -t.fromAmount })),
    ...balanceTo.map((t) => ({ at: t.occurredAt, delta: t.toAmount })),
  ];
  const balances = balanceTimeline(opening, events, buckets);
  const balance: BalancePoint[] = buckets.map((b, i) => ({ key: b.key, label: b.label, balance: balances[i]! }));

  // Kategoriyalar (xarajat) va daromad manbalari.
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const positive = [...catNow.entries()].filter(([, v]) => v > 0n).sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
  const grand = positive.reduce((s, [, v]) => s + v, 0n);
  const mkCat = (id: string | null, amount: bigint): CategoryStat => {
    const c = id ? catMap.get(id) : undefined;
    const prevAmount = catPrev.get(id) ?? 0n;
    return {
      id,
      name: c?.name ?? "Kategoriyasiz",
      color: c?.color ?? "#94a3b8",
      icon: c?.icon ?? "tag",
      amount,
      sharePct: pct(amount, grand),
      prevAmount: prevAmount > 0n ? prevAmount : 0n,
      changePct: prevAmount > 0n ? changePct(amount, prevAmount) : null,
    };
  };
  const categories = positive.slice(0, TOP_CATEGORIES).map(([id, v]) => mkCat(id, v));
  const rest = positive.slice(TOP_CATEGORIES).reduce((s, [, v]) => s + v, 0n);
  if (rest > 0n) {
    categories.push({ id: null, name: "Boshqalar", color: "#cbd5e1", icon: "tag", amount: rest, sharePct: pct(rest, grand), prevAmount: 0n, changePct: null });
  }

  const incomeTotal = totals.income;
  const incomeSources: IncomeSource[] = [...incomeByCat.entries()]
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
    .map(([id, amount]) => {
      const c = id ? catMap.get(id) : undefined;
      return { id, name: c?.name ?? "Kategoriyasiz", color: c?.color ?? "#94a3b8", amount, sharePct: pct(amount, incomeTotal) };
    });

  const weekdays = elapsedDays > 0 ? weekdayStats(perDay, from, effectiveTo) : weekdayStats(new Map(), from, from).map((s) => ({ ...s, occurrences: 0 }));
  const busiest = weekdays.reduce<WeekdayStat | null>((best, s) => (s.average > (best?.average ?? 0n) ? s : best), null);

  const avgDailySpend = dailyAverage(totals.netExpense, elapsedDays);
  const prevDays = rangeDays(prev.from, prev.to);
  const prevAvgDailySpend = dailyAverage(prevTotals.netExpense, prevDays);
  const expenseChange = changePct(totals.netExpense, prevTotals.netExpense);
  const sr = savingsRate(totals.income, totals.net);
  const topCat = categories.find((c) => c.id !== null) ?? null;

  const txCount = rows.length;
  return {
    query: { from, to, currency, days, elapsedDays },
    prev,
    currencies: currencies.length ? currencies : [currency],
    hasData: txCount > 0,
    txCount,
    totals,
    prevTotals,
    savingsRatePct: sr,
    avgDailySpend,
    prevAvgDailySpend,
    expenseChangePct: expenseChange,
    incomeChangePct: changePct(totals.income, prevTotals.income),
    bucketKind: kind,
    flow,
    balance,
    categories,
    incomeSources,
    weekdays,
    busiestWeekday: busiest,
    topExpenses: topRows.map((t) => ({
      id: t.id,
      note: t.note,
      category: t.category?.name ?? null,
      amount: t.amount,
      dayKey: dayKeyOf(t.occurredAt),
    })),
    topNotes: [...notes.values()]
      .filter((n) => n.count >= 2 || n.total > 0n)
      .sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0))
      .slice(0, 5),
    insights: buildInsights({
      income: totals.income,
      netExpense: totals.netExpense,
      prevNetExpense: prevTotals.netExpense,
      savingsRatePct: sr,
      topCategory: topCat ? { name: topCat.name, sharePct: topCat.sharePct } : null,
      expenseChangePct: expenseChange,
    }),
  };
}
