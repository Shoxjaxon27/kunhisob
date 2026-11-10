import type { Db } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { fromLocalInputs, toLocalInputs } from "@/domain/time";
import { impliedRate } from "@/domain/money";
import { transferInputSchema, type TransferInput } from "@/lib/validation";
import { loadActiveAccount, parseAmount, parseWith } from "./shared";

/**
 * Hisoblar orasida pul o'tkazish. Daromad ham, xarajat ham emas.
 * Turli valyutada: foydalanuvchi qabul qilingan summani kiritadi — kurs o'ylab topilmaydi,
 * u ikkala summadan hisoblanib saqlanadi.
 */
async function resolve(db: Db, userId: string, data: TransferInput) {
  if (data.fromAccountId === data.toAccountId) {
    throw new AppError("validation", "Bir xil hisobga o‘tkazib bo‘lmaydi", {
      toAccountId: "Boshqa hisobni tanlang",
    });
  }
  const from = await loadActiveAccount(db, userId, data.fromAccountId, "fromAccountId");
  const to = await loadActiveAccount(db, userId, data.toAccountId, "toAccountId");

  const fromAmount = parseAmount(data.fromAmount, from.currency, "fromAmount");
  let toAmount = fromAmount;
  let rate: string | null = null;

  if (from.currency !== to.currency) {
    if (!data.toAmount || data.toAmount.trim() === "") {
      throw new AppError("validation", "Valyutalar har xil: qabul qilinadigan summani kiriting", {
        toAmount: "Qabul qilinadigan summani kiriting (kurs o‘ylab topilmaydi)",
      });
    }
    toAmount = parseAmount(data.toAmount, to.currency, "toAmount");
    rate = impliedRate(fromAmount, from.currency, toAmount, to.currency);
  }

  return { from, to, fromAmount, toAmount, rate, occurredAt: fromLocalInputs(data.date, data.time) };
}

export async function createTransfer(db: Db, userId: string, input: unknown): Promise<{ id: string }> {
  const data = parseWith(transferInputSchema, input);
  const r = await resolve(db, userId, data);
  return db.$transaction(async (tx) => {
    const row = await tx.transfer.create({
      data: {
        userId,
        fromAccountId: r.from.id,
        toAccountId: r.to.id,
        fromAmount: r.fromAmount,
        toAmount: r.toAmount,
        fromCurrency: r.from.currency,
        toCurrency: r.to.currency,
        rate: r.rate,
        occurredAt: r.occurredAt,
        note: data.note,
      },
    });
    await writeAudit(tx, userId, "transfer", row.id, "create", undefined, {
      from: r.from.id,
      to: r.to.id,
      fromAmount: r.fromAmount,
      toAmount: r.toAmount,
      rate: r.rate,
    });
    return { id: row.id };
  });
}

export async function updateTransfer(db: Db, userId: string, id: string, input: unknown): Promise<void> {
  const existing = await db.transfer.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new AppError("not_found", "O‘tkazma topilmadi");
  const data = parseWith(transferInputSchema, input);
  const r = await resolve(db, userId, data);
  await db.$transaction(async (tx) => {
    await tx.transfer.update({
      where: { id },
      data: {
        fromAccountId: r.from.id,
        toAccountId: r.to.id,
        fromAmount: r.fromAmount,
        toAmount: r.toAmount,
        fromCurrency: r.from.currency,
        toCurrency: r.to.currency,
        rate: r.rate,
        occurredAt: r.occurredAt,
        note: data.note,
      },
    });
    await writeAudit(
      tx,
      userId,
      "transfer",
      id,
      "update",
      {
        from: existing.fromAccountId,
        to: existing.toAccountId,
        fromAmount: existing.fromAmount,
        toAmount: existing.toAmount,
        rate: existing.rate,
      },
      { from: r.from.id, to: r.to.id, fromAmount: r.fromAmount, toAmount: r.toAmount, rate: r.rate },
    );
  });
}

export async function deleteTransfer(db: Db, userId: string, id: string): Promise<void> {
  const existing = await db.transfer.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) throw new AppError("not_found", "O‘tkazma topilmadi");
  await db.$transaction(async (tx) => {
    await tx.transfer.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(tx, userId, "transfer", id, "delete", {
      fromAmount: existing.fromAmount,
      toAmount: existing.toAmount,
    });
  });
}

export async function restoreTransfer(db: Db, userId: string, id: string): Promise<void> {
  const existing = await db.transfer.findFirst({ where: { id, userId, deletedAt: { not: null } } });
  if (!existing) throw new AppError("not_found", "Tiklanadigan o‘tkazma topilmadi");
  await db.$transaction(async (tx) => {
    await tx.transfer.update({ where: { id }, data: { deletedAt: null } });
    await writeAudit(tx, userId, "transfer", id, "restore");
  });
}

export type TransferEditDto = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmount: bigint;
  toAmount: bigint;
  date: string;
  time: string;
  note: string;
};

export async function getTransferForEdit(db: Db, userId: string, id: string): Promise<TransferEditDto> {
  const row = await db.transfer.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new AppError("not_found", "O‘tkazma topilmadi");
  const { date, time } = toLocalInputs(row.occurredAt);
  return {
    id: row.id,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    fromAmount: row.fromAmount,
    toAmount: row.toAmount,
    date,
    time,
    note: row.note,
  };
}
