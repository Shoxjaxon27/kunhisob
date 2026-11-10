import type { Db } from "../db";
import { addDays, dayKeyOf, startOfDay } from "@/domain/time";
import { listAccounts, type AccountDto } from "./accounts";
import { listCategories, type CategoryDto } from "./categories";

export type NoteHint = {
  note: string;
  type: "INCOME" | "EXPENSE" | "REFUND";
  categoryId: string | null;
  accountId: string;
  count: number;
};

export type QuickAddContext = {
  accounts: AccountDto[];
  /** Eng ko'p ishlatilganlari birinchi. */
  expenseCategories: CategoryDto[];
  incomeCategories: CategoryDto[];
  hints: NoteHint[];
  lastAccountByType: Partial<Record<"INCOME" | "EXPENSE" | "REFUND", string>>;
  todayKey: string;
};

/**
 * Tez kiritish uchun kontekst: hisoblar, kategoriyalar (ishlatilish chastotasi bo'yicha),
 * avvalgi izohlar asosida takliflar va turi bo'yicha oxirgi ishlatilgan hisob.
 */
export async function getQuickAddContext(db: Db, userId: string, now: Date = new Date()): Promise<QuickAddContext> {
  const since = startOfDay(addDays(dayKeyOf(now), -90));
  const [accounts, categories, recent, lastByType] = await Promise.all([
    listAccounts(db, userId),
    listCategories(db, userId),
    db.transaction.findMany({
      where: { userId, deletedAt: null, occurredAt: { gte: since }, type: { in: ["INCOME", "EXPENSE", "REFUND"] } },
      orderBy: { occurredAt: "desc" },
      take: 600,
      select: { note: true, type: true, categoryId: true, accountId: true },
    }),
    db.transaction.findMany({
      where: { userId, deletedAt: null, type: { in: ["INCOME", "EXPENSE", "REFUND"] } },
      orderBy: { occurredAt: "desc" },
      distinct: ["type"],
      take: 3,
      select: { type: true, accountId: true },
    }),
  ]);

  const usage = new Map<string, number>();
  for (const r of recent) {
    if (r.categoryId) usage.set(r.categoryId, (usage.get(r.categoryId) ?? 0) + 1);
  }
  const byUsage = (a: CategoryDto, b: CategoryDto) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0);

  const hintMap = new Map<string, NoteHint>();
  for (const r of recent) {
    const note = r.note.trim();
    if (!note || (r.type !== "INCOME" && r.type !== "EXPENSE" && r.type !== "REFUND")) continue;
    const key = `${r.type}|${note.toLowerCase()}`;
    const existing = hintMap.get(key);
    if (existing) existing.count += 1;
    else hintMap.set(key, { note, type: r.type, categoryId: r.categoryId, accountId: r.accountId, count: 1 });
  }

  const activeIds = new Set(accounts.map((a) => a.id));
  const lastAccountByType: QuickAddContext["lastAccountByType"] = {};
  for (const r of lastByType) {
    if ((r.type === "INCOME" || r.type === "EXPENSE" || r.type === "REFUND") && activeIds.has(r.accountId)) {
      lastAccountByType[r.type] = r.accountId;
    }
  }

  return {
    accounts,
    expenseCategories: categories.filter((c) => c.kind === "EXPENSE").sort(byUsage),
    incomeCategories: categories.filter((c) => c.kind === "INCOME").sort(byUsage),
    hints: [...hintMap.values()].sort((a, b) => b.count - a.count).slice(0, 80),
    lastAccountByType,
    todayKey: dayKeyOf(now),
  };
}
