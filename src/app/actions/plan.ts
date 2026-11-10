"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { run, type ActionResult } from "@/server/action-utils";
import { requireUserId } from "@/server/auth/current";
import { copyBudgetsFromPreviousMonth, deleteBudget, saveBudget } from "@/server/services/budgets";
import { addDebtPayment, createDebt, deleteDebt, deleteDebtPayment } from "@/server/services/debts";
import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  deleteGoalContribution,
  setGoalArchived,
  updateGoal,
} from "@/server/services/goals";

function refresh(): void {
  revalidatePath("/", "layout");
}

/** Har bir action sessiyani o'zi tekshiradi (layout tekshiruvi action'larni himoya qilmaydi). */
async function act<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  return run(async () => {
    const userId = await requireUserId();
    const res = await fn(userId);
    refresh();
    return res;
  });
}

// ───────────── Byudjet ─────────────
export async function saveBudgetAction(input: unknown) {
  return act((u) => saveBudget(getDb(), u, input));
}
export async function deleteBudgetAction(id: string) {
  return act(async (u) => void (await deleteBudget(getDb(), u, id)));
}
export async function copyBudgetsAction(month: string) {
  return act((u) => copyBudgetsFromPreviousMonth(getDb(), u, month));
}

// ───────────── Qarzlar ─────────────
export async function createDebtAction(input: unknown) {
  return act((u) => createDebt(getDb(), u, input));
}
export async function addDebtPaymentAction(input: unknown) {
  return act((u) => addDebtPayment(getDb(), u, input));
}
export async function deleteDebtPaymentAction(id: string) {
  return act(async (u) => void (await deleteDebtPayment(getDb(), u, id)));
}
export async function deleteDebtAction(id: string) {
  return act(async (u) => void (await deleteDebt(getDb(), u, id)));
}

// ───────────── Maqsadlar ─────────────
export async function createGoalAction(input: unknown) {
  return act((u) => createGoal(getDb(), u, input));
}
export async function updateGoalAction(id: string, input: unknown) {
  return act(async (u) => void (await updateGoal(getDb(), u, id, input)));
}
export async function setGoalArchivedAction(id: string, archived: boolean) {
  return act(async (u) => void (await setGoalArchived(getDb(), u, id, archived)));
}
export async function deleteGoalAction(id: string) {
  return act(async (u) => void (await deleteGoal(getDb(), u, id)));
}
export async function addGoalContributionAction(input: unknown) {
  return act((u) => addGoalContribution(getDb(), u, input));
}
export async function deleteGoalContributionAction(id: string) {
  return act(async (u) => void (await deleteGoalContribution(getDb(), u, id)));
}
