/**
 * Byudjet, qarz va maqsad hisob-kitoblari (sof funksiyalar, bazadan mustaqil).
 * Barcha summalar bigint (minor unit). Foizlar faqat ko'rsatish uchun number.
 */
import { addDays } from "./time";

// ───────────────────────── Byudjet ─────────────────────────

export const BUDGET_WARN_PCT = 80;

export type BudgetStatus = "ok" | "warn" | "over";

export type BudgetProgress = {
  /** Sarflangan ulush, foiz (limitdan oshsa 100 dan katta bo'lishi mumkin). 0.1 aniqlikda. */
  pct: number;
  /** limit − sarflangan. Manfiy bo'lsa — limitdan oshgan. */
  remaining: bigint;
  status: BudgetStatus;
};

/** Sarf (sof xarajat = xarajat − qaytim) limitga nisbatan. `limit` musbat bo'lishi kerak. */
export function budgetProgress(limit: bigint, spent: bigint): BudgetProgress {
  if (limit <= 0n) throw new RangeError("Byudjet limiti musbat bo'lishi kerak");
  const s = spent < 0n ? 0n : spent;
  const pct = Number((s * 1000n) / limit) / 10;
  const status: BudgetStatus = s > limit ? "over" : pct >= BUDGET_WARN_PCT ? "warn" : "ok";
  return { pct, remaining: limit - s, status };
}

/**
 * Oy oxirigacha bashorat: hozirgi sur'at saqlansa, oy yakunidagi sarf.
 * Bu taxmin (prognoz), haqiqat emas — UI'da shunday belgilanadi. Oyning 1-kunida ishonchsiz, shuning uchun null.
 */
export function projectMonthSpend(spent: bigint, dayOfMonth: number, daysInMonth: number): bigint | null {
  if (dayOfMonth < 3 || spent <= 0n) return null;
  return (spent * BigInt(daysInMonth)) / BigInt(dayOfMonth);
}

/** Oyning qolgan kunlariga (bugun ham kiradi) bo'lingan kunlik ruxsat etilgan sarf. Limit oshgan bo'lsa 0. */
export function dailyAllowance(remaining: bigint, dayOfMonth: number, daysInMonth: number): bigint {
  const daysLeft = daysInMonth - dayOfMonth + 1;
  if (remaining <= 0n || daysLeft <= 0) return 0n;
  return remaining / BigInt(daysLeft);
}

// ───────────────────────── Qarz ─────────────────────────

export type DebtStatusValue = "OPEN" | "PARTIAL" | "PAID";

export function debtStatusFor(principal: bigint, paid: bigint): DebtStatusValue {
  if (paid >= principal) return "PAID";
  if (paid > 0n) return "PARTIAL";
  return "OPEN";
}

export type DueState = "none" | "overdue" | "soon" | "later";
export const DUE_SOON_DAYS = 3;

/** Muddat holati. Yopilgan (PAID) qarz uchun doim "none". Kunlar Toshkent kun kalitlari ("YYYY-MM-DD"). */
export function dueState(dueKey: string | null, todayKey: string, status: DebtStatusValue): DueState {
  if (!dueKey || status === "PAID") return "none";
  if (dueKey < todayKey) return "overdue";
  if (dueKey <= addDays(todayKey, DUE_SOON_DAYS)) return "soon";
  return "later";
}

/** Muddatgacha (yoki o'tgan) kunlar: musbat — hali bor, manfiy — o'tib ketgan. */
export function daysUntil(dueKey: string, todayKey: string): number {
  const a = Date.parse(`${dueKey}T00:00:00Z`);
  const b = Date.parse(`${todayKey}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

// ───────────────────────── Maqsad ─────────────────────────

export type GoalProgress = {
  pct: number;
  remaining: bigint;
  completed: boolean;
  /** Muddatgacha qolgan to'liq oylar (muddat bo'lmasa yoki o'tgan bo'lsa null). */
  monthsLeft: number | null;
  /** Muddatga yetish uchun oyiga kerak bo'lgan summa (yuqoriga yaxlitlangan). */
  requiredMonthly: bigint | null;
  /** Oylik reja bo'yicha tugash uchun kerak bo'lgan oylar (reja bo'lmasa null). */
  monthsAtPlan: number | null;
};

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

/** Ikki oy kaliti orasidagi to'liq oylar ("2026-10" → "2027-01" = 3). */
function monthsBetween(fromKey: string, toKey: string): number {
  const f = Number(fromKey.slice(0, 4)) * 12 + Number(fromKey.slice(5, 7));
  const t = Number(toKey.slice(0, 4)) * 12 + Number(toKey.slice(5, 7));
  return t - f;
}

export function goalProgress(
  target: bigint,
  saved: bigint,
  todayKey: string,
  deadlineKey: string | null,
  monthlyPlan: bigint | null,
): GoalProgress {
  if (target <= 0n) throw new RangeError("Maqsad summasi musbat bo'lishi kerak");
  const s = saved < 0n ? 0n : saved;
  const completed = s >= target;
  const remaining = completed ? 0n : target - s;
  const pct = Number(((s > target ? target : s) * 1000n) / target) / 10;

  let monthsLeft: number | null = null;
  let requiredMonthly: bigint | null = null;
  if (deadlineKey && !completed) {
    const m = monthsBetween(todayKey.slice(0, 7), deadlineKey.slice(0, 7));
    // Joriy oy ham hisobga olinadi: muddat shu oyda bo'lsa 1 oy qoladi.
    monthsLeft = deadlineKey < todayKey ? null : Math.max(m, 0) + 1;
    if (monthsLeft !== null) requiredMonthly = ceilDiv(remaining, BigInt(monthsLeft));
  }
  const monthsAtPlan =
    monthlyPlan && monthlyPlan > 0n && !completed ? Number(ceilDiv(remaining, monthlyPlan)) : null;

  return { pct, remaining, completed, monthsLeft, requiredMonthly, monthsAtPlan };
}
