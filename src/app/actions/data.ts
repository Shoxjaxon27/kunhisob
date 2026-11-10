"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { run, type ActionResult } from "@/server/action-utils";
import { requireUserId } from "@/server/auth/current";
import { checkIntegrity, type IntegrityReport } from "@/server/services/integrity";
import { completeOnboarding } from "@/server/services/onboarding";
import {
  createAdjustment,
  createTransaction,
  deleteTransaction,
  getTransactionForEdit,
  restoreTransaction,
  updateTransaction,
  type CreateTransactionResult,
  type TransactionEditDto,
} from "@/server/services/transactions";
import {
  createTransfer,
  deleteTransfer,
  getTransferForEdit,
  restoreTransfer,
  updateTransfer,
  type TransferEditDto,
} from "@/server/services/transfers";
import {
  createAccount,
  deleteAccount,
  setAccountArchived,
  updateAccount,
} from "@/server/services/accounts";
import { createCategory, setCategoryArchived, updateCategory } from "@/server/services/categories";
import { updateSettings, type SettingsDto } from "@/server/services/settings";

function refresh(): void {
  revalidatePath("/", "layout");
}

// ───────────── Onboarding ─────────────

export async function completeOnboardingAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await completeOnboarding(getDb(), userId, input);
    refresh();
    return undefined;
  });
}

// ───────────── Tranzaksiyalar ─────────────

export async function createTransactionAction(
  input: unknown,
  force = false,
): Promise<ActionResult<CreateTransactionResult>> {
  return run(async () => {
    const userId = await requireUserId();
    const res = await createTransaction(getDb(), userId, input, { force });
    if (res.status === "created") refresh();
    return res;
  });
}

export async function updateTransactionAction(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await updateTransaction(getDb(), userId, id, input);
    refresh();
    return undefined;
  });
}

export async function createAdjustmentAction(
  input: unknown,
): Promise<ActionResult<{ status: "created"; id: string } | { status: "no_change" }>> {
  return run(async () => {
    const userId = await requireUserId();
    const res = await createAdjustment(getDb(), userId, input);
    if (res.status === "created") refresh();
    return res;
  });
}

export async function createTransferAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const userId = await requireUserId();
    const res = await createTransfer(getDb(), userId, input);
    refresh();
    return res;
  });
}

export async function updateTransferAction(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await updateTransfer(getDb(), userId, id, input);
    refresh();
    return undefined;
  });
}

export type FeedKind = "tx" | "transfer";

export async function deleteFeedItemAction(kind: FeedKind, id: string): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    if (kind === "transfer") await deleteTransfer(getDb(), userId, id);
    else await deleteTransaction(getDb(), userId, id);
    refresh();
    return undefined;
  });
}

/** O'chirishni bekor qilish (undo). */
export async function restoreFeedItemAction(kind: FeedKind, id: string): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    if (kind === "transfer") await restoreTransfer(getDb(), userId, id);
    else await restoreTransaction(getDb(), userId, id);
    refresh();
    return undefined;
  });
}

export type EditData =
  | { kind: "tx"; data: TransactionEditDto }
  | { kind: "transfer"; data: TransferEditDto };

export async function getEditDataAction(kind: FeedKind, id: string): Promise<ActionResult<EditData>> {
  return run(async () => {
    const userId = await requireUserId();
    if (kind === "transfer") return { kind: "transfer" as const, data: await getTransferForEdit(getDb(), userId, id) };
    return { kind: "tx" as const, data: await getTransactionForEdit(getDb(), userId, id) };
  });
}

// ───────────── Hisoblar ─────────────

export async function createAccountAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const userId = await requireUserId();
    const acc = await createAccount(getDb(), userId, input);
    refresh();
    return { id: acc.id };
  });
}

export async function updateAccountAction(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await updateAccount(getDb(), userId, id, input);
    refresh();
    return undefined;
  });
}

export async function setAccountArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await setAccountArchived(getDb(), userId, id, archived);
    refresh();
    return undefined;
  });
}

export async function deleteAccountAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await deleteAccount(getDb(), userId, id);
    refresh();
    return undefined;
  });
}

// ───────────── Kategoriyalar ─────────────

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await createCategory(getDb(), userId, input);
    refresh();
    return undefined;
  });
}

export async function updateCategoryAction(id: string, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await updateCategory(getDb(), userId, id, input);
    refresh();
    return undefined;
  });
}

export async function setCategoryArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await setCategoryArchived(getDb(), userId, id, archived);
    refresh();
    return undefined;
  });
}

// ───────────── Sozlamalar ─────────────

export async function updateSettingsAction(input: unknown): Promise<ActionResult<SettingsDto>> {
  return run(async () => {
    const userId = await requireUserId();
    const res = await updateSettings(getDb(), userId, input);
    refresh();
    return res;
  });
}

/** Foydalanuvchining o'z ma'lumotlari yaxlitligini tekshiradi (faqat o'qiydi). */
export async function checkIntegrityAction(): Promise<ActionResult<IntegrityReport>> {
  return run(async () => checkIntegrity(getDb(), await requireUserId()));
}
