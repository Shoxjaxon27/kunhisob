import type { Db } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import { dayKeyOf, startOfDay } from "@/domain/time";
import { debtStatusFor, dueState, type DebtStatusValue, type DueState } from "@/domain/planning";
import { debtInputSchema, debtPaymentSchema } from "@/lib/validation-plan";
import { loadActiveAccount, parseAmount, parseWith } from "./shared";

export type DebtPaymentDto = {
  id: string;
  amount: bigint;
  paidAt: Date;
  note: string;
  account: { id: string; name: string };
};

export type DebtDto = {
  id: string;
  direction: "LENT" | "BORROWED";
  counterparty: string;
  principal: bigint;
  paid: bigint;
  remaining: bigint;
  currency: CurrencyCode;
  startKey: string;
  dueKey: string | null;
  note: string;
  status: DebtStatusValue;
  due: DueState;
  /** Dastlabki harakat hisobga ta'sir qilganmi. */
  movedMoney: boolean;
  payments: DebtPaymentDto[];
};

const cur = (v: string): CurrencyCode => (isCurrency(v) ? v : "UZS");

function toDto(
  d: {
    id: string;
    direction: "LENT" | "BORROWED";
    counterparty: string;
    principal: bigint;
    currency: string;
    startDate: Date;
    dueDate: Date | null;
    note: string;
    transactionId: string | null;
    payments: Array<{ id: string; amount: bigint; paidAt: Date; note: string; account: { id: string; name: string } }>;
  },
  todayKey: string,
): DebtDto {
  const paid = d.payments.reduce((s, p) => s + p.amount, 0n);
  const status = debtStatusFor(d.principal, paid);
  const dueKey = d.dueDate ? dayKeyOf(d.dueDate) : null;
  return {
    id: d.id,
    direction: d.direction,
    counterparty: d.counterparty,
    principal: d.principal,
    paid,
    remaining: d.principal > paid ? d.principal - paid : 0n,
    currency: cur(d.currency),
    startKey: dayKeyOf(d.startDate),
    dueKey,
    note: d.note,
    status,
    due: dueState(dueKey, todayKey, status),
    movedMoney: d.transactionId !== null,
    payments: d.payments
      .map((p) => ({ id: p.id, amount: p.amount, paidAt: p.paidAt, note: p.note, account: p.account }))
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()),
  };
}

export async function listDebts(db: Db, userId: string, now: Date = new Date()): Promise<DebtDto[]> {
  const rows = await db.debt.findMany({
    where: { userId },
    include: { payments: { include: { account: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const todayKey = dayKeyOf(now);
  const list = rows.map((r) => toDto(r, todayKey));
  // Ochiqlar oldin (muddati yaqinlari birinchi), yopilganlar oxirida.
  const rank = (d: DebtDto) => (d.status === "PAID" ? 2 : 0);
  return list.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.dueKey && b.dueKey) return a.dueKey.localeCompare(b.dueKey);
    if (a.dueKey) return -1;
    if (b.dueKey) return 1;
    return 0;
  });
}

export async function createDebt(db: Db, userId: string, input: unknown): Promise<{ id: string }> {
  const data = parseWith(debtInputSchema, input);
  let currency: CurrencyCode = data.currency;
  let account: { id: string; name: string; currency: CurrencyCode } | null = null;
  if (data.accountId) {
    account = await loadActiveAccount(db, userId, data.accountId);
    if (account.currency !== data.currency) {
      throw new AppError("validation", "Hisob valyutasi qarz valyutasiga mos emas", {
        accountId: `Hisob valyutasi ${account.currency}, qarz valyutasi ${data.currency}`,
      });
    }
    currency = account.currency;
  }
  const principal = parseAmount(data.amount, currency, "amount");
  const startDate = startOfDay(data.startDate);
  let dueDate: Date | null = null;
  if (data.dueDate) {
    if (data.dueDate < data.startDate) {
      throw new AppError("validation", "Muddat boshlanish sanasidan oldin bo‘lmasin", {
        dueDate: "Muddat boshlanish sanasidan oldin bo‘lmasin",
      });
    }
    dueDate = startOfDay(data.dueDate);
  }

  return db.$transaction(async (tx) => {
    let transactionId: string | null = null;
    if (account) {
      const t = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          type: data.direction === "LENT" ? "DEBT_LEND" : "DEBT_BORROW",
          flow: data.direction === "LENT" ? "OUT" : "IN",
          amount: principal,
          currency,
          occurredAt: new Date(startDate.getTime() + 12 * 3_600_000), // kun o'rtasi: vaqt bilan chalkashmasin
          note: data.counterparty,
        },
      });
      transactionId = t.id;
    }
    const debt = await tx.debt.create({
      data: {
        userId,
        direction: data.direction,
        counterparty: data.counterparty,
        principal,
        currency,
        startDate,
        dueDate,
        note: data.note,
        transactionId,
      },
    });
    await writeAudit(tx, userId, "debt", debt.id, "create", undefined, {
      direction: data.direction,
      counterparty: data.counterparty,
      principal,
      currency,
      movedMoney: transactionId !== null,
    });
    return { id: debt.id };
  });
}

export async function addDebtPayment(db: Db, userId: string, input: unknown): Promise<{ id: string }> {
  const data = parseWith(debtPaymentSchema, input);
  const debt = await db.debt.findFirst({ where: { id: data.debtId, userId }, include: { payments: true } });
  if (!debt) throw new AppError("not_found", "Qarz topilmadi");
  const account = await loadActiveAccount(db, userId, data.accountId);
  const currency = cur(debt.currency);
  if (account.currency !== currency) {
    throw new AppError("validation", "Hisob valyutasi qarz valyutasiga mos emas", {
      accountId: `Qarz ${currency}da, hisob ${account.currency}da`,
    });
  }
  const amount = parseAmount(data.amount, currency, "amount");

  return db.$transaction(async (tx) => {
    // Tranzaksiya ichida qayta o'qiladi: ketma-ket to'lovlar ortiqcha to'lashga olib kelmasin.
    const paidRows = await tx.debtPayment.aggregate({ where: { debtId: debt.id }, _sum: { amount: true } });
    const paid = paidRows._sum.amount ?? 0n;
    const remaining = debt.principal - paid;
    if (remaining <= 0n) {
      throw new AppError("conflict", "Bu qarz allaqachon to‘liq yopilgan");
    }
    if (amount > remaining) {
      throw new AppError("validation", "To‘lov qolgan qarzdan oshib ketdi", {
        amount: "Qolgan qarzdan ko‘p to‘lab bo‘lmaydi",
      });
    }
    const paidAt = new Date(startOfDay(data.date).getTime() + 12 * 3_600_000);
    const t = await tx.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type: debt.direction === "LENT" ? "DEBT_REPAY_IN" : "DEBT_REPAY_OUT",
        flow: debt.direction === "LENT" ? "IN" : "OUT",
        amount,
        currency,
        occurredAt: paidAt,
        note: debt.counterparty,
      },
    });
    const p = await tx.debtPayment.create({
      data: { debtId: debt.id, accountId: account.id, transactionId: t.id, amount, paidAt, note: data.note },
    });
    const status = debtStatusFor(debt.principal, paid + amount);
    await tx.debt.update({ where: { id: debt.id }, data: { status } });
    await writeAudit(tx, userId, "debt_payment", p.id, "create", undefined, { debtId: debt.id, amount, status });
    return { id: p.id };
  });
}

export async function deleteDebtPayment(db: Db, userId: string, paymentId: string): Promise<void> {
  const p = await db.debtPayment.findFirst({ where: { id: paymentId, debt: { userId } }, include: { debt: true } });
  if (!p) throw new AppError("not_found", "To‘lov topilmadi");
  await db.$transaction(async (tx) => {
    if (p.transactionId) {
      await tx.transaction.update({ where: { id: p.transactionId }, data: { deletedAt: new Date() } });
    }
    await tx.debtPayment.delete({ where: { id: p.id } });
    const sum = await tx.debtPayment.aggregate({ where: { debtId: p.debtId }, _sum: { amount: true } });
    await tx.debt.update({
      where: { id: p.debtId },
      data: { status: debtStatusFor(p.debt.principal, sum._sum.amount ?? 0n) },
    });
    await writeAudit(tx, userId, "debt_payment", p.id, "delete", { debtId: p.debtId, amount: p.amount });
  });
}

/** To'lovlari yo'q qarzni o'chiradi (dastlabki harakat ham hisobdan olib tashlanadi). */
export async function deleteDebt(db: Db, userId: string, id: string): Promise<void> {
  const d = await db.debt.findFirst({ where: { id, userId }, include: { _count: { select: { payments: true } } } });
  if (!d) throw new AppError("not_found", "Qarz topilmadi");
  if (d._count.payments > 0) {
    throw new AppError("conflict", "To‘lovlari bor qarzni o‘chirib bo‘lmaydi — avval to‘lovlarni o‘chiring");
  }
  await db.$transaction(async (tx) => {
    if (d.transactionId) {
      await tx.transaction.update({ where: { id: d.transactionId }, data: { deletedAt: new Date() } });
    }
    await tx.debt.delete({ where: { id } });
    await writeAudit(tx, userId, "debt", id, "delete", { counterparty: d.counterparty, principal: d.principal });
  });
}

export type DebtTotals = Partial<Record<CurrencyCode, { lent: bigint; borrowed: bigint }>>;

/** Ochiq qarzlar bo'yicha jami qoldiq (valyutalar aralashtirilmaydi). */
export function debtTotals(debts: readonly DebtDto[]): DebtTotals {
  const out: DebtTotals = {};
  for (const d of debts) {
    if (d.status === "PAID") continue;
    const row = (out[d.currency] ??= { lent: 0n, borrowed: 0n });
    if (d.direction === "LENT") row.lent += d.remaining;
    else row.borrowed += d.remaining;
  }
  return out;
}
