/**
 * Tahlil hisob-kitoblari (sof funksiyalar, bazadan mustaqil). Summalar bigint (minor unit).
 * Kunlar — Toshkent kun kalitlari ("YYYY-MM-DD"); oraliqlarning ikkala chekkasi ham kiradi.
 */
import { addDays, dayKeyOf, UZ_MONTHS, UZ_WEEKDAYS_SHORT, weekdayOf } from "./time";

export const MAX_RANGE_DAYS = 3660;

/** Oraliqdagi kunlar soni (ikkala chekka ham kiradi). to < from bo'lsa 0. */
export function rangeDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  const n = Math.round((b - a) / 86_400_000) + 1;
  return n > 0 ? n : 0;
}

/** Xuddi shu uzunlikdagi, darhol oldingi oraliq (taqqoslash uchun). */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const n = rangeDays(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

// ───────────────────────── Ko'rsatkichlar ─────────────────────────

/** Jamg'arma darajasi: (daromad − sof xarajat) / daromad, foizda. Daromad 0 bo'lsa null (ma'nosiz). */
export function savingsRate(income: bigint, netCashFlow: bigint): number | null {
  if (income <= 0n) return null;
  return Number((netCashFlow * 1000n) / income) / 10;
}

/** Foiz o'zgarishi, 0.1 aniqlikda. Oldingi qiymat 0 bo'lsa null (solishtirib bo'lmaydi). */
export function changePct(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  const base = previous < 0n ? -previous : previous;
  return Number(((current - previous) * 1000n) / base) / 10;
}

/** Kunlik o'rtacha (kunlar soniga bo'lib, pastga yaxlitlanadi). */
export function dailyAverage(total: bigint, days: number): bigint {
  if (days <= 0) return 0n;
  return total / BigInt(days);
}

// ───────────────────────── Vaqt bo'laklari ─────────────────────────

export type BucketKind = "day" | "week" | "month";

/** Oraliq uzunligiga qarab grafik bo'lagi: ≤62 kun — kun, ≤190 — hafta, undan ortiq — oy. */
export function bucketKind(days: number): BucketKind {
  if (days <= 62) return "day";
  if (days <= 190) return "week";
  return "month";
}

/** Hafta dushanbadan boshlanadi. */
export function weekStart(dayKey: string): string {
  const wd = weekdayOf(dayKey); // 0 = yakshanba
  return addDays(dayKey, -((wd + 6) % 7));
}

export function bucketKeyOf(dayKey: string, kind: BucketKind): string {
  if (kind === "day") return dayKey;
  if (kind === "week") return weekStart(dayKey);
  return dayKey.slice(0, 7);
}

export type Bucket = { key: string; label: string; from: string; to: string };

function bucketLabel(key: string, kind: BucketKind): string {
  if (kind === "month") return `${UZ_MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`.trim();
  const mo = UZ_MONTHS[Number(key.slice(5, 7)) - 1] ?? "";
  return `${Number(key.slice(8, 10))} ${mo.slice(0, 3)}`;
}

/** Oraliqni bo'laklarga ajratadi; birinchi/oxirgi bo'lak oraliq chegarasida kesiladi. */
export function buildBuckets(from: string, to: string, kind: BucketKind): Bucket[] {
  if (rangeDays(from, to) === 0) return [];
  const out: Bucket[] = [];
  let cursor = from;
  while (cursor <= to) {
    const key = bucketKeyOf(cursor, kind);
    let end: string;
    if (kind === "day") end = cursor;
    else if (kind === "week") end = addDays(key, 6);
    else {
      const y = Number(key.slice(0, 4));
      const m = Number(key.slice(5, 7));
      end = addDays(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10), -1);
    }
    const bucketTo = end < to ? end : to;
    out.push({ key, label: bucketLabel(key, kind), from: cursor, to: bucketTo });
    cursor = addDays(bucketTo, 1);
  }
  return out;
}

// ───────────────────────── Hafta kunlari ─────────────────────────

export type WeekdayStat = {
  /** 1 = dushanba … 7 = yakshanba */
  index: number;
  label: string;
  total: bigint;
  /** Oraliqda shu hafta kuni necha marta uchraydi. */
  occurrences: number;
  /** Shu hafta kunining o'rtacha sarfi (jami / uchrashlar soni). */
  average: bigint;
};

/** Kunlik sof xarajatdan hafta kunlari bo'yicha o'rtacha (dushanba → yakshanba). */
export function weekdayStats(perDay: ReadonlyMap<string, bigint>, from: string, to: string): WeekdayStat[] {
  const stats: WeekdayStat[] = Array.from({ length: 7 }, (_, i) => ({
    index: i + 1,
    label: UZ_WEEKDAYS_SHORT[(i + 1) % 7] ?? "",
    total: 0n,
    occurrences: 0,
    average: 0n,
  }));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const idx = (weekdayOf(d) + 6) % 7; // dushanba = 0
    const s = stats[idx]!;
    s.occurrences += 1;
    s.total += perDay.get(d) ?? 0n;
  }
  for (const s of stats) s.average = s.occurrences > 0 ? s.total / BigInt(s.occurrences) : 0n;
  return stats;
}

// ───────────────────────── Balans dinamikasi ─────────────────────────

export type BalanceEvent = { at: Date; delta: bigint };

/**
 * Har bir bo'lak oxiridagi balans. `opening` — barcha hodisalardan oldingi balans (ochilish balanslari yig'indisi);
 * hodisalar: kirim/chiqim va o'tkazmalar (signed delta). Bo'lak oxiri — shu kunning oxirigacha (kun kaliti bo'yicha).
 */
export function balanceTimeline(opening: bigint, events: readonly BalanceEvent[], buckets: readonly Bucket[]): bigint[] {
  const sorted = [...events]
    .map((e) => ({ day: dayKeyOf(e.at), delta: e.delta }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  let i = 0;
  let running = opening;
  const out: bigint[] = [];
  for (const b of buckets) {
    while (i < sorted.length && sorted[i]!.day <= b.to) {
      running += sorted[i]!.delta;
      i += 1;
    }
    out.push(running);
  }
  return out;
}

// ───────────────────────── Xulosa gaplari ─────────────────────────

export type Insight = { tone: "good" | "warn" | "info"; text: string };

/**
 * Qoidaga asoslangan qisqa xulosalar. Faqat haqiqiy raqamlarga tayanadi; ma'lumot kam bo'lsa jim turadi.
 * Matnlar summani o'zida emas, foiz va nom bilan beriladi (summa kartalarda ko'rinadi).
 */
export function buildInsights(input: {
  income: bigint;
  netExpense: bigint;
  prevNetExpense: bigint;
  savingsRatePct: number | null;
  topCategory: { name: string; sharePct: number } | null;
  expenseChangePct: number | null;
}): Insight[] {
  const out: Insight[] = [];
  const { expenseChangePct: ch } = input;
  if (ch !== null && input.prevNetExpense > 0n && Math.abs(ch) >= 10) {
    out.push(
      ch > 0
        ? { tone: "warn", text: `Xarajat oldingi davrga nisbatan ${Math.round(ch)}% oshgan.` }
        : { tone: "good", text: `Xarajat oldingi davrga nisbatan ${Math.round(-ch)}% kamaygan.` },
    );
  }
  if (input.savingsRatePct !== null) {
    const r = input.savingsRatePct;
    if (r < 0) out.push({ tone: "warn", text: "Bu davrda xarajat daromaddan oshgan." });
    else if (r >= 20) out.push({ tone: "good", text: `Daromadning ${Math.round(r)}% qismi saqlab qolingan.` });
  }
  if (input.topCategory && input.topCategory.sharePct >= 35) {
    out.push({
      tone: "info",
      text: `“${input.topCategory.name}” xarajatning ${Math.round(input.topCategory.sharePct)}% ini tashkil qiladi.`,
    });
  }
  return out;
}
