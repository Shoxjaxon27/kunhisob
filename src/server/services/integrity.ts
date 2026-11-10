import type { Db } from "../db";
import { flowForType } from "@/domain/ledger";
import { debtStatusFor } from "@/domain/planning";

export type IntegrityIssue = { code: string; message: string; ref: string };
export type IntegrityReport = {
  ok: boolean;
  issues: IntegrityIssue[];
  checked: { transactions: number; transfers: number; debts: number };
};

/**
 * Foydalanuvchi ma'lumotlarining ichki mosligini tekshiradi (faqat o'qiydi, hech narsani o'zgartirmaydi).
 * Ilova qoidalari buzilgan yozuvlarni topadi: noto'g'ri valyuta, manfiy summa, yo'nalish va tur mos emasligi,
 * qarz to'lovlari va holat nomosligi. Balanslar saqlanmaydi (hisoblanadi), shuning uchun ularni tekshirish shart emas.
 */
export async function checkIntegrity(db: Db, userId: string): Promise<IntegrityReport> {
  const [accounts, txs, trs, debts] = await Promise.all([
    db.account.findMany({ where: { userId }, select: { id: true, currency: true } }),
    db.transaction.findMany({
      where: { userId, deletedAt: null },
      select: { id: true, accountId: true, type: true, flow: true, amount: true, currency: true },
    }),
    db.transfer.findMany({ where: { userId, deletedAt: null } }),
    db.debt.findMany({
      where: { userId },
      include: { payments: { include: { transaction: { select: { deletedAt: true } } } }, transaction: true },
    }),
  ]);
  const cur = new Map(accounts.map((a) => [a.id, a.currency]));
  const issues: IntegrityIssue[] = [];
  const add = (code: string, message: string, ref: string) => issues.push({ code, message, ref });

  for (const t of txs) {
    if (t.amount <= 0n) add("tx_amount", "Tranzaksiya summasi musbat emas", t.id);
    if (cur.get(t.accountId) !== t.currency) add("tx_currency", "Tranzaksiya valyutasi hisob valyutasiga mos emas", t.id);
    if (t.type !== "ADJUSTMENT" && flowForType(t.type) !== t.flow) add("tx_flow", "Tranzaksiya turi va yo‘nalishi mos emas", t.id);
  }

  for (const t of trs) {
    if (t.fromAmount <= 0n || t.toAmount <= 0n) add("tr_amount", "O‘tkazma summasi musbat emas", t.id);
    if (t.fromAccountId === t.toAccountId) add("tr_same", "O‘tkazma bir xil hisobga", t.id);
    if (cur.get(t.fromAccountId) !== t.fromCurrency || cur.get(t.toAccountId) !== t.toCurrency) {
      add("tr_currency", "O‘tkazma valyutasi hisob valyutasiga mos emas", t.id);
    }
    if (t.fromCurrency === t.toCurrency && t.fromAmount !== t.toAmount) add("tr_same_cur", "Bir valyutadagi o‘tkazmada summalar teng emas", t.id);
  }

  for (const d of debts) {
    const paid = d.payments.reduce((s, p) => s + p.amount, 0n);
    if (paid > d.principal) add("debt_overpaid", "Qarz to‘lovlari asosiy summadan oshgan", d.id);
    if (d.status !== debtStatusFor(d.principal, paid)) add("debt_status", "Qarz holati to‘lovlarga mos emas", d.id);
    if (d.transaction && (d.transaction.amount !== d.principal || d.transaction.currency !== d.currency)) {
      add("debt_initial", "Qarzning dastlabki harakati summa/valyutasi mos emas", d.id);
    }
    for (const p of d.payments) {
      if (p.transaction?.deletedAt) add("debt_payment_tx", "Qarz to‘lovining bog‘liq harakati o‘chirilgan", p.id);
    }
  }

  return { ok: issues.length === 0, issues, checked: { transactions: txs.length, transfers: trs.length, debts: debts.length } };
}
