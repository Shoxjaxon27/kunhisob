import type { Db } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import { addMonths, monthRange } from "@/domain/time";
import { budgetProgress, dailyAllowance, projectMonthSpend, type BudgetProgress } from "@/domain/planning";
import { budgetInputSchema, monthKeySchema } from "@/lib/validation-plan";
import { parseAmount, parseWith } from "./shared";

export type BudgetDto = {
  id: string;
  month: string;
  categoryId: string | null;
  /** Umumiy byudjet uchun null. */
  category: { id: string; name: string; color: string; icon: string } | null;
  currency: CurrencyCode;
  limit: bigint;
  spent: bigint;
  progress: BudgetProgress;
  /** Faqat joriy oy uchun. */
  projected: bigint | null;
  dailyAllowance: bigint | null;
};

const cur = (v: string): CurrencyCode => (isCurrency(v) ? v : "UZS");

/** Ko'rsatish uchun taxminiy summalarni so'mda butun songa tushiradi (tiyin kerak emas); USD o'zgarmaydi. */
const nullable = (v: bigint | null, c: CurrencyCode): bigint | null => (v === null ? null : wholeUnits(v, c));
const wholeUnits = (v: bigint, c: CurrencyCode): bigint => (c === "UZS" ? v - (v % 100n) : v);

/**
 * Oy bo'yicha sof xarajat (xarajat − qaytim) — kategoriya va valyuta kesimida.
 * Kalit: `${categoryId ?? ""}|${currency}`; umumiy sarf "|currency" kalitida ham yig'iladi.
 */
async function spentByKey(db: Db, userId: string, month: string): Promise<Map<string, bigint>> {
  const { start, end } = monthRange(month);
  const rows = await db.transaction.groupBy({
    by: ["categoryId", "currency", "type"],
    where: { userId, deletedAt: null, type: { in: ["EXPENSE", "REFUND"] }, occurredAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  const out = new Map<string, bigint>();
  const add = (k: string, v: bigint) => out.set(k, (out.get(k) ?? 0n) + v);
  for (const r of rows) {
    const v = (r._sum.amount ?? 0n) * (r.type === "EXPENSE" ? 1n : -1n);
    add(`${r.categoryId ?? ""}|${r.currency}`, v);
    add(`|${r.currency}`, v);
  }
  return out;
}

export async function listBudgets(db: Db, userId: string, month: string, now: Date = new Date()): Promise<BudgetDto[]> {
  parseWith(monthKeySchema, month);
  const [rows, spent] = await Promise.all([
    db.budget.findMany({ where: { userId, month }, include: { category: true }, orderBy: { createdAt: "asc" } }),
    spentByKey(db, userId, month),
  ]);

  const { days } = monthRange(month);
  const curMonth = monthRange(month);
  const nowMs = now.getTime();
  const isCurrent = nowMs >= curMonth.start.getTime() && nowMs < curMonth.end.getTime();
  // Toshkent bo'yicha oy ichidagi kun raqami.
  const dayOfMonth = isCurrent ? Math.floor((nowMs - curMonth.start.getTime()) / 86_400_000) + 1 : days;

  const list = rows.map((b): BudgetDto => {
    const currency = cur(b.currency);
    const s = spent.get(`${b.categoryId ?? ""}|${b.currency}`) ?? 0n;
    const progress = budgetProgress(b.limit, s);
    return {
      id: b.id,
      month: b.month,
      categoryId: b.categoryId,
      category: b.category
        ? { id: b.category.id, name: b.category.name, color: b.category.color, icon: b.category.icon }
        : null,
      currency,
      limit: b.limit,
      spent: s < 0n ? 0n : s,
      progress,
      projected: isCurrent ? nullable(projectMonthSpend(s, dayOfMonth, days), currency) : null,
      dailyAllowance: isCurrent ? wholeUnits(dailyAllowance(progress.remaining, dayOfMonth, days), currency) : null,
    };
  });
  // Umumiy byudjet birinchi, keyin foiz bo'yicha kamayish.
  return list.sort((a, b) => {
    if ((a.categoryId === null) !== (b.categoryId === null)) return a.categoryId === null ? -1 : 1;
    return b.progress.pct - a.progress.pct;
  });
}

/** Byudjetni yaratadi yoki (oy + kategoriya + valyuta bir xil bo'lsa) limitini yangilaydi. */
export async function saveBudget(db: Db, userId: string, input: unknown): Promise<{ id: string }> {
  const data = parseWith(budgetInputSchema, input);
  const limit = parseAmount(data.limit, data.currency, "limit");
  if (data.categoryId) {
    const cat = await db.category.findFirst({ where: { id: data.categoryId, userId } });
    if (!cat) throw new AppError("not_found", "Kategoriya topilmadi", { categoryId: "Kategoriya topilmadi" });
    if (cat.kind !== "EXPENSE") {
      throw new AppError("validation", "Byudjet faqat xarajat kategoriyasi uchun", {
        categoryId: "Xarajat kategoriyasini tanlang",
      });
    }
  }
  return db.$transaction(async (tx) => {
    const existing = await tx.budget.findFirst({
      where: { userId, month: data.month, categoryId: data.categoryId, currency: data.currency },
    });
    if (existing) {
      await tx.budget.update({ where: { id: existing.id }, data: { limit } });
      await writeAudit(tx, userId, "budget", existing.id, "update", { limit: existing.limit }, { limit });
      return { id: existing.id };
    }
    const created = await tx.budget.create({
      data: { userId, month: data.month, categoryId: data.categoryId, currency: data.currency, limit },
    });
    await writeAudit(tx, userId, "budget", created.id, "create", undefined, { month: data.month, limit });
    return { id: created.id };
  });
}

export async function deleteBudget(db: Db, userId: string, id: string): Promise<void> {
  const b = await db.budget.findFirst({ where: { id, userId } });
  if (!b) throw new AppError("not_found", "Byudjet topilmadi");
  await db.$transaction(async (tx) => {
    await tx.budget.delete({ where: { id } });
    await writeAudit(tx, userId, "budget", id, "delete", { month: b.month, limit: b.limit });
  });
}

/** Oldingi oy byudjetlarini shu oyga ko'chiradi; shu oyda bor bo'lganlarga tegmaydi. Nusxalangan sonni qaytaradi. */
export async function copyBudgetsFromPreviousMonth(db: Db, userId: string, month: string): Promise<number> {
  parseWith(monthKeySchema, month);
  const prev = addMonths(month, -1);
  return db.$transaction(async (tx) => {
    const [src, dst] = await Promise.all([
      tx.budget.findMany({ where: { userId, month: prev } }),
      tx.budget.findMany({ where: { userId, month } }),
    ]);
    const have = new Set(dst.map((b) => `${b.categoryId ?? ""}|${b.currency}`));
    let n = 0;
    for (const b of src) {
      if (have.has(`${b.categoryId ?? ""}|${b.currency}`)) continue;
      const created = await tx.budget.create({
        data: { userId, month, categoryId: b.categoryId, currency: b.currency, limit: b.limit },
      });
      await writeAudit(tx, userId, "budget", created.id, "copy", { from: prev }, { month, limit: b.limit });
      n += 1;
    }
    return n;
  });
}
