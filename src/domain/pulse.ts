/**
 * Financial Pulse — oylik moliyaviy holatning qoidaga asoslangan ko'rsatkichi (0–100).
 * Bu mashina o'rganishi yoki moliyaviy maslahat emas: har bir tarkibiy qism ochiq formula bilan
 * hisoblanadi va foydalanuvchiga sababi bilan ko'rsatiladi. Ma'lumoti yo'q qism ishtirok etmaydi
 * (o'ylab topilmaydi); kamida 2 ta qism bo'lmasa ball berilmaydi.
 */
import { savingsRate } from "./analytics";

export const PULSE_SAVINGS_TARGET_PCT = 20;
export const PULSE_RUNWAY_TARGET_DAYS = 90;
export const PULSE_MIN_COMPONENTS = 2;

export type PulseInput = {
  /** Joriy oy daromadi va sof xarajati (asosiy valyutada). */
  income: bigint;
  netExpense: bigint;
  /** Joriy oy byudjetlari holati (asosiy valyutada). */
  budgets: { total: number; over: number; warn: number };
  /** Olingan (BORROWED) ochiq qarzlar: muddati o'tganlar soni. */
  borrowedDebts: { active: number; overdue: number };
  /** Hozirgi umumiy balans va oxirgi 30 kunlik sof xarajat. */
  balance: bigint;
  spend30: bigint;
};

export type PulseKey = "savings" | "budget" | "debt" | "runway";
export type PulseBand = "good" | "mid" | "low";

export type PulseComponent = {
  key: PulseKey;
  label: string;
  /** 0..100 */
  score: number;
  detail: string;
  href: string;
};

export type Pulse = {
  score: number | null;
  band: PulseBand | null;
  components: PulseComponent[];
  /** Ma'lumot yo'qligi sababli hisobga olinmagan qismlar (sabab matni bilan). */
  missing: { key: PulseKey; label: string; reason: string }[];
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function bandFor(score: number): PulseBand {
  return score >= 75 ? "good" : score >= 50 ? "mid" : "low";
}

/** Balans taxminan necha kunlik xarajatga yetishi (oxirgi 30 kun sur'ati bilan). null — xarajat yo'q. */
export function runwayDays(balance: bigint, spend30: bigint): number | null {
  if (spend30 < 30n) return null; // kuniga 1 minor birlikdan kam — mazmunsiz
  if (balance <= 0n) return 0;
  const daily = spend30 / 30n;
  return Number((balance * 10n) / daily) / 10;
}

export function computePulse(i: PulseInput): Pulse {
  const components: PulseComponent[] = [];
  const missing: Pulse["missing"] = [];

  // 1. Jamg'arma darajasi
  const rate = savingsRate(i.income, i.income - i.netExpense);
  if (rate === null) {
    missing.push({ key: "savings", label: "Jamg‘arma", reason: "Bu oyda daromad yozilmagan" });
  } else {
    components.push({
      key: "savings",
      label: "Jamg‘arma darajasi",
      score: clamp((rate / PULSE_SAVINGS_TARGET_PCT) * 100),
      detail: `Daromadning ${rate}% i saqlangan (maqsad ${PULSE_SAVINGS_TARGET_PCT}% va undan ko‘p)`,
      href: "/analytics",
    });
  }

  // 2. Byudjet intizomi: limitdan oshgan 0, yaqinlashgan 50, me'yordagi 100 ball
  if (i.budgets.total === 0) {
    missing.push({ key: "budget", label: "Byudjet", reason: "Bu oyga byudjet belgilanmagan" });
  } else {
    const ok = i.budgets.total - i.budgets.over - i.budgets.warn;
    components.push({
      key: "budget",
      label: "Byudjet intizomi",
      score: clamp(((ok * 100 + i.budgets.warn * 50) / i.budgets.total)),
      detail: `${i.budgets.total} ta byudjetdan ${i.budgets.over} tasi oshgan, ${i.budgets.warn} tasi limitga yaqin`,
      href: "/plan/budgets",
    });
  }

  // 3. Olingan qarzlar bo'yicha to'lov intizomi
  if (i.borrowedDebts.active === 0) {
    missing.push({ key: "debt", label: "Qarzlar", reason: "Ochiq olingan qarz yo‘q" });
  } else {
    components.push({
      key: "debt",
      label: "Qarz intizomi",
      score: clamp(100 - 50 * i.borrowedDebts.overdue),
      detail:
        i.borrowedDebts.overdue === 0
          ? `${i.borrowedDebts.active} ta ochiq qarz, muddati o‘tgani yo‘q`
          : `${i.borrowedDebts.active} ta ochiq qarzdan ${i.borrowedDebts.overdue} tasining muddati o‘tgan`,
      href: "/plan/debts",
    });
  }

  // 4. Zaxira: balans necha kunlik xarajatga yetadi (taxmin)
  const days = runwayDays(i.balance, i.spend30);
  if (days === null) {
    missing.push({ key: "runway", label: "Zaxira", reason: "Oxirgi 30 kunda xarajat yo‘q" });
  } else {
    components.push({
      key: "runway",
      label: "Zaxira",
      score: clamp((days / PULSE_RUNWAY_TARGET_DAYS) * 100),
      detail:
        i.balance <= 0n
          ? "Balans nolga yoki undan past"
          : `Taxminan ${days >= 365 ? "365+" : Math.floor(days)} kunlik xarajatga yetadi (maqsad ${PULSE_RUNWAY_TARGET_DAYS}+ kun)`,
      href: "/accounts",
    });
  }

  if (components.length < PULSE_MIN_COMPONENTS) return { score: null, band: null, components, missing };
  const score = clamp(components.reduce((s, c) => s + c.score, 0) / components.length);
  return { score, band: bandFor(score), components, missing };
}
