import type { Db } from "../db";
import { periodTotals, type PeriodTotals, type TxType } from "@/domain/ledger";
import { dailySummary, type DailySummary } from "@/domain/insights";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import { addDays, addMonths, dayKeyOf, dayRange, monthKeyOf, monthRange } from "@/domain/time";
import { listAccounts, type AccountDto } from "./accounts";
import { listFeed, type FeedItem } from "./feed";

export type CurrencyBalance = { currency: CurrencyCode; balance: bigint; accountCount: number };

export type SpendPoint = { day: number; current: number | null; previous: number | null };

export type TopCategory = {
  id: string | null;
  name: string;
  color: string;
  amount: bigint;
  /** 0..100 (ko'rsatish uchun) */
  sharePct: number;
};

export type DashboardData = {
  nowIso: string;
  todayKey: string;
  monthKey: string;
  primary: CurrencyCode;
  hasData: boolean;
  accounts: AccountDto[];
  balances: CurrencyBalance[];
  /** Valyuta → davr natijalari. Hisobi bor valyutalar uchun. */
  today: Record<string, PeriodTotals>;
  month: Record<string, PeriodTotals>;
  prevMonth: Record<string, PeriodTotals>;
  todayEntryCount: number;
  recent: FeedItem[];
  spendSeries: SpendPoint[];
  monthSpendToDate: bigint;
  prevMonthSpendToSameDay: bigint;
  topCategories: TopCategory[];
  summary: DailySummary;
};

async function totalsByCurrency(
  db: Db,
  userId: string,
  start: Date,
  end: Date,
  currencies: CurrencyCode[],
): Promise<Record<string, PeriodTotals>> {
  const rows = await db.transaction.groupBy({
    by: ["currency", "type"],
    where: { userId, deletedAt: null, occurredAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const out: Record<string, PeriodTotals> = {};
  for (const c of currencies) {
    out[c] = periodTotals(
      rows.filter((r) => r.currency === c).map((r) => ({ type: r.type as TxType, sum: r._sum.amount ?? 0n })),
    );
  }
  return out;
}

export async function getDashboard(db: Db, userId: string, now: Date = new Date()): Promise<DashboardData> {
  const settings = await db.settings.findUnique({ where: { userId } });
  const primary: CurrencyCode = settings && isCurrency(settings.primaryCurrency) ? settings.primaryCurrency : "UZS";

  const accounts = await listAccounts(db, userId);

  // Valyutalar aralashtirilmaydi: har bir valyuta alohida yig'iladi (kurs o'ylab topilmaydi).
  const byCurrency = new Map<CurrencyCode, CurrencyBalance>();
  for (const a of accounts) {
    const row = byCurrency.get(a.currency) ?? { currency: a.currency, balance: 0n, accountCount: 0 };
    row.balance += a.balance;
    row.accountCount += 1;
    byCurrency.set(a.currency, row);
  }
  const balances = [...byCurrency.values()].sort((a, b) => (a.currency === primary ? -1 : b.currency === primary ? 1 : 0));
  const currencies = balances.map((b) => b.currency);
  if (!currencies.includes(primary)) currencies.unshift(primary);

  const todayKey = dayKeyOf(now);
  const monthKey = monthKeyOf(now);
  const prevMonthKey = addMonths(monthKey, -1);
  const monthR = monthRange(monthKey);
  const prevR = monthRange(prevMonthKey);
  const todayR = dayRange(todayKey);

  // Oldingi oyning shu kungacha bo'lgan qismi (taqqoslash uchun adolatli oraliq).
  const dayOfMonth = Number(todayKey.slice(8, 10));
  const prevSameDay = Math.min(dayOfMonth, prevR.days);

  const [today, month, prevMonth, todayTx, todayTr, prev7, recent, spendRows, catRows, anyTx, anyTr] =
    await Promise.all([
      totalsByCurrency(db, userId, todayR.start, todayR.end, currencies),
      totalsByCurrency(db, userId, monthR.start, monthR.end, currencies),
      totalsByCurrency(db, userId, prevR.start, prevR.end, currencies),
      db.transaction.count({ where: { userId, deletedAt: null, occurredAt: { gte: todayR.start, lt: todayR.end } } }),
      db.transfer.count({ where: { userId, deletedAt: null, occurredAt: { gte: todayR.start, lt: todayR.end } } }),
      totalsByCurrency(db, userId, dayRange(addDays(todayKey, -7)).start, todayR.start, [primary]),
      listFeed(db, userId, { limit: 8 }),
      db.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          currency: primary,
          type: { in: ["EXPENSE", "REFUND"] },
          occurredAt: { gte: prevR.start, lt: monthR.end },
        },
        select: { type: true, amount: true, occurredAt: true },
      }),
      db.transaction.groupBy({
        by: ["categoryId", "type"],
        where: {
          userId,
          deletedAt: null,
          currency: primary,
          type: { in: ["EXPENSE", "REFUND"] },
          occurredAt: { gte: monthR.start, lt: monthR.end },
        },
        _sum: { amount: true },
      }),
      db.transaction.count({ where: { userId, deletedAt: null } }),
      db.transfer.count({ where: { userId, deletedAt: null } }),
    ]);

  // Kunlik kumulyativ sof xarajat: joriy oy va oldingi oy.
  const perDay = new Map<string, bigint>();
  for (const r of spendRows) {
    const k = dayKeyOf(r.occurredAt);
    const delta = r.type === "EXPENSE" ? r.amount : -r.amount;
    perDay.set(k, (perDay.get(k) ?? 0n) + delta);
  }
  const maxDays = Math.max(monthR.days, prevR.days);
  const spendSeries: SpendPoint[] = [];
  let curCum = 0n;
  let curToDate = 0n;
  let prevCum = 0n;
  let prevToDate = 0n;
  for (let d = 1; d <= maxDays; d++) {
    const dd = String(d).padStart(2, "0");
    let current: number | null = null;
    let previous: number | null = null;
    if (d <= monthR.days) {
      curCum += perDay.get(`${monthKey}-${dd}`) ?? 0n;
      current = d <= dayOfMonth ? Number(curCum) : null;
      if (d === dayOfMonth) curToDate = curCum;
    }
    if (d <= prevR.days) {
      prevCum += perDay.get(`${prevMonthKey}-${dd}`) ?? 0n;
      previous = Number(prevCum);
      if (d <= prevSameDay) prevToDate = prevCum;
    }
    spendSeries.push({ day: d, current, previous });
  }

  // Eng ko'p xarajat qilingan kategoriyalar (sof: xarajat − refund).
  const net = new Map<string | null, bigint>();
  for (const r of catRows) {
    const v = r._sum.amount ?? 0n;
    net.set(r.categoryId, (net.get(r.categoryId) ?? 0n) + (r.type === "EXPENSE" ? v : -v));
  }
  const positive = [...net.entries()].filter(([, v]) => v > 0n).sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
  const catIds = positive.map(([id]) => id).filter((id): id is string => id !== null);
  const cats = catIds.length ? await db.category.findMany({ where: { userId, id: { in: catIds } } }) : [];
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const grand = positive.reduce((s, [, v]) => s + v, 0n);
  const TOP = 6;
  const topCategories: TopCategory[] = positive.slice(0, TOP).map(([id, amount]) => {
    const c = id ? catMap.get(id) : undefined;
    return {
      id,
      name: c?.name ?? "Kategoriyasiz",
      color: c?.color ?? "#94a3b8",
      amount,
      sharePct: grand > 0n ? Number((amount * 1000n) / grand) / 10 : 0,
    };
  });
  const rest = positive.slice(TOP).reduce((s, [, v]) => s + v, 0n);
  if (rest > 0n) {
    topCategories.push({
      id: null,
      name: "Boshqalar",
      color: "#cbd5e1",
      amount: rest,
      sharePct: grand > 0n ? Number((rest * 1000n) / grand) / 10 : 0,
    });
  }

  const emptyTotals = periodTotals([]);
  const todayPrimary = today[primary] ?? emptyTotals;
  const avgPrev7 = (prev7[primary]?.netExpense ?? 0n) / 7n;
  const todayEntryCount = todayTx + todayTr;

  return {
    nowIso: now.toISOString(),
    todayKey,
    monthKey,
    primary,
    hasData: anyTx + anyTr > 0,
    accounts,
    balances,
    today,
    month,
    prevMonth,
    todayEntryCount,
    recent: recent.items,
    spendSeries,
    monthSpendToDate: curToDate,
    prevMonthSpendToSameDay: prevToDate,
    topCategories,
    summary: dailySummary({
      currency: primary,
      todayNetExpense: todayPrimary.netExpense,
      todayIncome: todayPrimary.income,
      entryCount: todayEntryCount,
      avgPrev7NetExpense: avgPrev7 > 0n ? avgPrev7 : 0n,
    }),
  };
}
