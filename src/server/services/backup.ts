import type { Db } from "../db";

export const BACKUP_VERSION = 1;

/** BigInt → matn (JSON bigint'ni bilmaydi; aniqlik yo'qolmasligi uchun son emas, matn). Date → ISO. */
function replacer(_k: string, v: unknown): unknown {
  return typeof v === "bigint" ? v.toString() : v;
}

/**
 * Foydalanuvchining barcha ma'lumotlari (o'qish uchun JSON nusxa). Parol xeshi, sessiyalar va boshqa
 * foydalanuvchilar ma'lumoti kirmaydi. Summalar — minor birlikdagi matn (UZS ×100, USD sent).
 * Bu eksport ma'lumotni saqlab qo'yish va ko'zdan kechirish uchun; ilovaga qayta yuklash (import) hali yo'q.
 */
export async function buildBackup(db: Db, userId: string, now: Date = new Date()): Promise<string> {
  const where = { userId };
  const [user, settings, accounts, categories, tags, transactions, transfers, budgets, debts, goals, notes, audit, personalPlans] =
    await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } }),
      db.settings.findUnique({ where: { userId } }),
      db.account.findMany({ where }),
      db.category.findMany({ where }),
      db.tag.findMany({ where }),
      db.transaction.findMany({ where, include: { tags: { select: { id: true } } }, orderBy: { occurredAt: "asc" } }),
      db.transfer.findMany({ where, orderBy: { occurredAt: "asc" } }),
      db.budget.findMany({ where }),
      db.debt.findMany({ where, include: { payments: true } }),
      db.savingsGoal.findMany({ where, include: { contributions: true } }),
      db.dailyNote.findMany({ where }),
      db.auditLog.findMany({ where, orderBy: { createdAt: "asc" } }),
      db.personalPlan.findMany({ where }),
    ]);

  const data = {
    app: "FINOVA",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    note: "Summalar minor birlikda (UZS ×100, USD sent), matn ko‘rinishida.",
    user, settings, accounts, categories, tags,
    transactions: transactions.map(({ tags: tg, ...t }) => ({ ...t, tagIds: tg.map((x) => x.id) })),
    transfers, budgets, debts, goals, dailyNotes: notes, auditLogs: audit, personalPlans,
  };
  return JSON.stringify(data, replacer, 2);
}
