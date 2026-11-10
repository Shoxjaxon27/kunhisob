import type { Db } from "../db";
import { monthKeyOf } from "@/domain/time";
import { listBudgets, type BudgetDto } from "./budgets";
import { listDebts, type DebtDto } from "./debts";
import { listGoals, type GoalDto } from "./goals";

export type PlanSummary = {
  /** Eng band byudjetlar (foiz bo'yicha), ko'pi bilan 3 ta. */
  budgets: BudgetDto[];
  hasBudgets: boolean;
  /** Muddati o'tgan yoki yaqin ochiq qarzlar. */
  dueDebts: DebtDto[];
  /** Faol, bajarilmagan maqsadlar (ko'pi bilan 2 ta, foiz bo'yicha kamayish). */
  goals: GoalDto[];
};

export async function getPlanSummary(db: Db, userId: string, now: Date = new Date()): Promise<PlanSummary> {
  const [budgets, debts, goals] = await Promise.all([
    listBudgets(db, userId, monthKeyOf(now), now),
    listDebts(db, userId, now),
    listGoals(db, userId, { now }),
  ]);
  return {
    budgets: [...budgets].sort((a, b) => b.progress.pct - a.progress.pct).slice(0, 3),
    hasBudgets: budgets.length > 0,
    dueDebts: debts.filter((d) => d.due === "overdue" || d.due === "soon").slice(0, 3),
    goals: goals.filter((g) => !g.progress.completed).sort((a, b) => b.progress.pct - a.progress.pct).slice(0, 2),
  };
}
