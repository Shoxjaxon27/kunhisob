import type { Db } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import { dayKeyOf, startOfDay } from "@/domain/time";
import { goalProgress, type GoalProgress } from "@/domain/planning";
import { goalContributionSchema, goalInputSchema } from "@/lib/validation-plan";
import { parseAmount, parseWith } from "./shared";

export type GoalContributionDto = { id: string; amount: bigint; dateKey: string; note: string };

export type GoalDto = {
  id: string;
  name: string;
  currency: CurrencyCode;
  target: bigint;
  saved: bigint;
  deadlineKey: string | null;
  monthlyPlan: bigint | null;
  color: string;
  archived: boolean;
  progress: GoalProgress;
  contributions: GoalContributionDto[];
};

const cur = (v: string): CurrencyCode => (isCurrency(v) ? v : "UZS");

/**
 * Maqsadga qo'shilgan summa hisob balansini O'ZGARTIRMAYDI: u faqat ajratib qo'yilgan summani qayd etadi.
 * (Pul hisobda turaveradi; maqsad — "shuncha summani bu maqsad uchun ajratdim" degan belgi.)
 */
export async function listGoals(
  db: Db,
  userId: string,
  opts: { includeArchived?: boolean; now?: Date } = {},
): Promise<GoalDto[]> {
  const rows = await db.savingsGoal.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    include: { contributions: true },
    orderBy: { createdAt: "asc" },
  });
  const todayKey = dayKeyOf(opts.now ?? new Date());
  return rows.map((g): GoalDto => {
    const saved = g.contributions.reduce((s, c) => s + c.amount, 0n);
    const deadlineKey = g.deadline ? dayKeyOf(g.deadline) : null;
    return {
      id: g.id,
      name: g.name,
      currency: cur(g.currency),
      target: g.target,
      saved,
      deadlineKey,
      monthlyPlan: g.monthlyPlan,
      color: g.color,
      archived: g.archivedAt !== null,
      progress: goalProgress(g.target, saved, todayKey, deadlineKey, g.monthlyPlan),
      contributions: g.contributions
        .map((c) => ({ id: c.id, amount: c.amount, dateKey: dayKeyOf(c.contributedAt), note: c.note }))
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    };
  });
}

function prepare(input: unknown) {
  const data = parseWith(goalInputSchema, input);
  const target = parseAmount(data.target, data.currency, "target");
  const monthlyPlan = data.monthlyPlan ? parseAmount(data.monthlyPlan, data.currency, "monthlyPlan") : null;
  return { data, target, monthlyPlan, deadline: data.deadline ? startOfDay(data.deadline) : null };
}

export async function createGoal(db: Db, userId: string, input: unknown): Promise<{ id: string }> {
  const { data, target, monthlyPlan, deadline } = prepare(input);
  return db.$transaction(async (tx) => {
    const g = await tx.savingsGoal.create({
      data: { userId, name: data.name, target, currency: data.currency, deadline, monthlyPlan, color: data.color },
    });
    await writeAudit(tx, userId, "goal", g.id, "create", undefined, { name: data.name, target });
    return { id: g.id };
  });
}

export async function updateGoal(db: Db, userId: string, id: string, input: unknown): Promise<void> {
  const existing = await db.savingsGoal.findFirst({ where: { id, userId } });
  if (!existing) throw new AppError("not_found", "Maqsad topilmadi");
  const { data, target, monthlyPlan, deadline } = prepare(input);
  if (data.currency !== existing.currency) {
    const n = await db.goalContribution.count({ where: { goalId: id } });
    if (n > 0) {
      throw new AppError("conflict", "Qo‘shilgan summalari bor maqsad valyutasini o‘zgartirib bo‘lmaydi", {
        currency: "Valyutani o‘zgartirib bo‘lmaydi",
      });
    }
  }
  await db.$transaction(async (tx) => {
    await tx.savingsGoal.update({
      where: { id },
      data: { name: data.name, target, currency: data.currency, deadline, monthlyPlan, color: data.color },
    });
    await writeAudit(tx, userId, "goal", id, "update", { name: existing.name, target: existing.target }, { name: data.name, target });
  });
}

export async function setGoalArchived(db: Db, userId: string, id: string, archived: boolean): Promise<void> {
  const g = await db.savingsGoal.findFirst({ where: { id, userId } });
  if (!g) throw new AppError("not_found", "Maqsad topilmadi");
  await db.$transaction(async (tx) => {
    await tx.savingsGoal.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await writeAudit(tx, userId, "goal", id, archived ? "archive" : "unarchive");
  });
}

export async function deleteGoal(db: Db, userId: string, id: string): Promise<void> {
  const g = await db.savingsGoal.findFirst({ where: { id, userId } });
  if (!g) throw new AppError("not_found", "Maqsad topilmadi");
  await db.$transaction(async (tx) => {
    await tx.savingsGoal.delete({ where: { id } });
    await writeAudit(tx, userId, "goal", id, "delete", { name: g.name, target: g.target });
  });
}

export async function addGoalContribution(db: Db, userId: string, input: unknown): Promise<{ id: string }> {
  const data = parseWith(goalContributionSchema, input);
  const goal = await db.savingsGoal.findFirst({ where: { id: data.goalId, userId } });
  if (!goal) throw new AppError("not_found", "Maqsad topilmadi");
  if (goal.archivedAt) throw new AppError("conflict", "Arxivlangan maqsadga qo‘shib bo‘lmaydi");
  const amount = parseAmount(data.amount, cur(goal.currency), "amount");
  return db.$transaction(async (tx) => {
    const c = await tx.goalContribution.create({
      data: {
        goalId: goal.id,
        amount,
        contributedAt: new Date(startOfDay(data.date).getTime() + 12 * 3_600_000),
        note: data.note,
      },
    });
    await writeAudit(tx, userId, "goal_contribution", c.id, "create", undefined, { goalId: goal.id, amount });
    return { id: c.id };
  });
}

export async function deleteGoalContribution(db: Db, userId: string, id: string): Promise<void> {
  const c = await db.goalContribution.findFirst({ where: { id, goal: { userId } } });
  if (!c) throw new AppError("not_found", "Yozuv topilmadi");
  await db.$transaction(async (tx) => {
    await tx.goalContribution.delete({ where: { id } });
    await writeAudit(tx, userId, "goal_contribution", id, "delete", { goalId: c.goalId, amount: c.amount });
  });
}
