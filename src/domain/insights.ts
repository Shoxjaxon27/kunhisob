import { formatMoney, type CurrencyCode } from "./money";

/**
 * Tekshiriladigan matematik qoidalar asosidagi xulosalar (AI emas).
 * Har bir qoida aniq: foizlar bigint arifmetikasi bilan hisoblanadi.
 */

export type DailySummary = {
  tone: "empty" | "calm" | "above" | "below" | "income" | "neutral";
  headline: string;
  detail: string;
};

export const DAILY_COMPARE_THRESHOLD_PCT = 20n;

export type DailySummaryInput = {
  currency: CurrencyCode;
  /** Bugungi sof xarajat (xarajat − refund). */
  todayNetExpense: bigint;
  todayIncome: bigint;
  /** Bugungi tranzaksiya va o'tkazmalar soni. */
  entryCount: number;
  /** Oldingi 7 kunning (bugunsiz) o'rtacha kunlik sof xarajati. */
  avgPrev7NetExpense: bigint;
};

export function dailySummary(i: DailySummaryInput): DailySummary {
  const fmt = (v: bigint) => formatMoney(v, i.currency);

  if (i.entryCount === 0) {
    return { tone: "empty", headline: "Bugun hali yozuv yo‘q", detail: "Birinchi tranzaksiyani qo‘shing." };
  }

  if (i.todayNetExpense > 0n) {
    if (i.avgPrev7NetExpense > 0n) {
      const pct = ((i.todayNetExpense - i.avgPrev7NetExpense) * 100n) / i.avgPrev7NetExpense;
      const abs = pct < 0n ? -pct : pct;
      if (pct >= DAILY_COMPARE_THRESHOLD_PCT) {
        return {
          tone: "above",
          headline: "Bugun odatdagidan ko‘p sarfladingiz",
          detail: `${fmt(i.todayNetExpense)} sarflandi — oxirgi 7 kunlik o‘rtacha kunlik sarfdan (${fmt(i.avgPrev7NetExpense)}) ${abs}% ko‘p.`,
        };
      }
      if (pct <= -DAILY_COMPARE_THRESHOLD_PCT) {
        return {
          tone: "below",
          headline: "Bugun tejamkor kun",
          detail: `${fmt(i.todayNetExpense)} sarflandi — oxirgi 7 kunlik o‘rtacha kunlik sarfdan (${fmt(i.avgPrev7NetExpense)}) ${abs}% kam.`,
        };
      }
      return {
        tone: "calm",
        headline: "Bugungi sarf odatdagi darajada",
        detail: `${fmt(i.todayNetExpense)} sarflandi; oxirgi 7 kunlik o‘rtacha kunlik sarf ${fmt(i.avgPrev7NetExpense)}.`,
      };
    }
    return {
      tone: "neutral",
      headline: `Bugun ${fmt(i.todayNetExpense)} sarfladingiz`,
      detail: "Taqqoslash uchun oldingi 7 kunda xarajat ma’lumoti yo‘q.",
    };
  }

  if (i.todayIncome > 0n) {
    return {
      tone: "income",
      headline: `Bugun ${fmt(i.todayIncome)} kirim bo‘ldi`,
      detail: "Hozircha xarajat yozilmagan.",
    };
  }

  return {
    tone: "neutral",
    headline: "Bugun daromad va xarajat yo‘q",
    detail: "Faqat o‘tkazma yoki balans tuzatish bo‘lgan.",
  };
}

/** Joriy va oldingi davr o'zgarishi (foiz, butun son). Oldingi 0 bo'lsa null. */
export function percentChange(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  return Number(((current - previous) * 100n) / previous);
}
