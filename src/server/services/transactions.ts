import type { Db } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { adjustmentFor, flowForType } from "@/domain/ledger";
import { fromLocalInputs, toLocalInputs } from "@/domain/time";
import {
  adjustmentInputSchema,
  transactionInputSchema,
  type AdjustmentInput,
  type TransactionInput,
} from "@/lib/validation";
import { getAccountBalances } from "./accounts";
import { loadActiveAccount, normalizeTags, parseAmount, parseWith } from "./shared";

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export type CreateTransactionResult =
  | { status: "created"; id: string }
  | { status: "duplicate"; existing: { id: string; occurredAt: Date; note: string } };

async function validateCategory(
  db: Db,
  userId: string,
  categoryId: string | null,
  type: "INCOME" | "EXPENSE" | "REFUND",
): Promise<void> {
  if (!categoryId) return;
  const cat = await db.category.findFirst({ where: { id: categoryId, userId } });
  if (!cat) throw new AppError("not_found", "Kategoriya topilmadi", { categoryId: "Kategoriya topilmadi" });
  const expected = type === "INCOME" ? "INCOME" : "EXPENSE";
  if (cat.kind !== expected) {
    throw new AppError("validation", "Kategoriya turi tranzaksiya turiga mos emas", {
      categoryId: "Bu turdagi tranzaksiyaga mos kategoriya tanlang",
    });
  }
}

function tagConnect(userId: string, tags: string[]) {
  return tags.map((name) => ({
    where: { userId_name: { userId, name } },
    create: { userId, name },
  }));
}

export async function createTransaction(
  db: Db,
  userId: string,
  input: unknown,
  opts: { force?: boolean } = {},
): Promise<CreateTransactionResult> {
  const data: TransactionInput = parseWith(transactionInputSchema, input);
  const account = await loadActiveAccount(db, userId, data.accountId);
  await validateCategory(db, userId, data.categoryId, data.type);

  const amount = parseAmount(data.amount, account.currency, "amount");
  const occurredAt = fromLocalInputs(data.date, data.time);
  const tags = normalizeTags(data.tags);

  if (!opts.force) {
    const near = await db.transaction.findMany({
      where: {
        userId,
        accountId: account.id,
        type: data.type,
        amount,
        deletedAt: null,
        occurredAt: {
          gte: new Date(occurredAt.getTime() - DUPLICATE_WINDOW_MS),
          lte: new Date(occurredAt.getTime() + DUPLICATE_WINDOW_MS),
        },
      },
      orderBy: { occurredAt: "desc" },
      take: 5,
    });
    const sameNote = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    const hit = near.find((t) => sameNote(t.note, data.note) || t.categoryId === data.categoryId);
    if (hit) {
      return { status: "duplicate", existing: { id: hit.id, occurredAt: hit.occurredAt, note: hit.note } };
    }
  }

  const created = await db.$transaction(async (tx) => {
    const row = await tx.transaction.create({
      data: {
        userId,
        accountId: account.id,
        categoryId: data.categoryId,
        type: data.type,
        flow: flowForType(data.type),
        amount,
        currency: account.currency,
        occurredAt,
        note: data.note,
        tags: { connectOrCreate: tagConnect(userId, tags) },
      },
    });
    await writeAudit(tx, userId, "transaction", row.id, "create", undefined, {
      type: data.type,
      accountId: account.id,
      amount,
      occurredAt,
    });
    return row;
  });
  return { status: "created", id: created.id };
}

export async function updateTransaction(db: Db, userId: string, id: string, input: unknown): Promise<void> {
  const existing = await db.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    include: { tags: true },
  });
  if (!existing) throw new AppError("not_found", "Tranzaksiya topilmadi");

  if (existing.type === "ADJUSTMENT") {
    // Balans tuzatish: faqat izoh va sana o'zgaradi (summa — hisoblangan farq).
    const parsed = parseWith(
      adjustmentInputSchema.pick({ date: true, time: true, note: true }),
      input,
    );
    const occurredAt = fromLocalInputs(parsed.date, parsed.time);
    await db.$transaction(async (tx) => {
      await tx.transaction.update({ where: { id }, data: { occurredAt, note: parsed.note } });
      await writeAudit(
        tx,
        userId,
        "transaction",
        id,
        "update",
        { occurredAt: existing.occurredAt, note: existing.note },
        { occurredAt, note: parsed.note },
      );
    });
    return;
  }

  if (existing.type.startsWith("DEBT_")) {
    throw new AppError("conflict", "Qarz harakatlari qarzlar bo‘limida tahrirlanadi");
  }

  const data = parseWith(transactionInputSchema, input);
  const account = await loadActiveAccount(db, userId, data.accountId);
  await validateCategory(db, userId, data.categoryId, data.type);
  const amount = parseAmount(data.amount, account.currency, "amount");
  const occurredAt = fromLocalInputs(data.date, data.time);
  const tags = normalizeTags(data.tags);

  await db.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id },
      data: {
        accountId: account.id,
        categoryId: data.categoryId,
        type: data.type,
        flow: flowForType(data.type),
        amount,
        currency: account.currency,
        occurredAt,
        note: data.note,
        tags: { set: [] },
      },
    });
    if (tags.length) {
      await tx.transaction.update({
        where: { id },
        data: { tags: { connectOrCreate: tagConnect(userId, tags) } },
      });
    }
    await writeAudit(
      tx,
      userId,
      "transaction",
      id,
      "update",
      {
        type: existing.type,
        accountId: existing.accountId,
        categoryId: existing.categoryId,
        amount: existing.amount,
        occurredAt: existing.occurredAt,
        note: existing.note,
        tags: existing.tags.map((t) => t.name),
      },
      { type: data.type, accountId: account.id, categoryId: data.categoryId, amount, occurredAt, note: data.note, tags },
    );
  });
}

/** Balans tuzatish: haqiqiy balansni kiritasiz, tizim farqni ADJUSTMENT sifatida yozadi. */
export async function createAdjustment(
  db: Db,
  userId: string,
  input: unknown,
): Promise<{ status: "created"; id: string } | { status: "no_change" }> {
  const data: AdjustmentInput = parseWith(adjustmentInputSchema, input);
  const account = await loadActiveAccount(db, userId, data.accountId);
  const actual = parseAmount(data.actualBalance, account.currency, "actualBalance", true);
  const occurredAt = fromLocalInputs(data.date, data.time);

  return db.$transaction(async (tx) => {
    const row = await tx.account.findFirstOrThrow({ where: { id: account.id, userId } });
    const balances = await getAccountBalances(tx, userId, [row]);
    const computed = balances.get(row.id) ?? row.openingBalance;
    const adj = adjustmentFor(actual, computed);
    if (!adj) return { status: "no_change" as const };

    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type: "ADJUSTMENT",
        flow: adj.flow,
        amount: adj.amount,
        currency: account.currency,
        occurredAt,
        note: data.note || "Balansni tuzatish",
      },
    });
    await writeAudit(tx, userId, "transaction", created.id, "create", undefined, {
      type: "ADJUSTMENT",
      accountId: account.id,
      from: computed,
      to: actual,
    });
    return { status: "created" as const, id: created.id };
  });
}

export async function deleteTransaction(db: Db, userId: string, id: string): Promise<void> {
  const existing = await db.transaction.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new AppError("not_found", "Tranzaksiya topilmadi");
  if (existing.type.startsWith("DEBT_")) {
    throw new AppError("conflict", "Qarz harakatlari qarzlar bo‘limida o‘chiriladi");
  }
  await db.$transaction(async (tx) => {
    await tx.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(tx, userId, "transaction", id, "delete", {
      type: existing.type,
      amount: existing.amount,
      accountId: existing.accountId,
    });
  });
}

/** O'chirishni bekor qilish (undo). */
export async function restoreTransaction(db: Db, userId: string, id: string): Promise<void> {
  const existing = await db.transaction.findFirst({ where: { id, userId, deletedAt: { not: null } } });
  if (!existing) throw new AppError("not_found", "Tiklanadigan tranzaksiya topilmadi");
  await db.$transaction(async (tx) => {
    await tx.transaction.update({ where: { id }, data: { deletedAt: null } });
    await writeAudit(tx, userId, "transaction", id, "restore");
  });
}

export type TransactionEditDto = {
  id: string;
  type: "INCOME" | "EXPENSE" | "REFUND" | "ADJUSTMENT" | string;
  accountId: string;
  categoryId: string | null;
  amount: bigint;
  flow: "IN" | "OUT";
  date: string;
  time: string;
  note: string;
  tags: string[];
};

export async function getTransactionForEdit(db: Db, userId: string, id: string): Promise<TransactionEditDto> {
  const row = await db.transaction.findFirst({
    where: { id, userId, deletedAt: null },
    include: { tags: true },
  });
  if (!row) throw new AppError("not_found", "Tranzaksiya topilmadi");
  const { date, time } = toLocalInputs(row.occurredAt);
  return {
    id: row.id,
    type: row.type,
    accountId: row.accountId,
    categoryId: row.categoryId,
    amount: row.amount,
    flow: row.flow,
    date,
    time,
    note: row.note,
    tags: row.tags.map((t) => t.name).sort(),
  };
}
