import type { Db } from "../db";
import { isCurrency, minorToInput } from "@/domain/money";
import { dayRange, toLocalInputs } from "@/domain/time";
import { validateRange } from "./analytics";

/**
 * CSV maydonini xavfsiz yozadi: tirnoq/vergul/yangi qatorni o'raydi va jadval formulasi
 * sifatida ochilishi mumkin bo'lgan qiymatlarni (=, +, -, @, tab) apostrof bilan boshlaydi (CSV injection himoyasi).
 */
export function csvCell(value: string): string {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\n\r;]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

const HEADER = ["Sana", "Vaqt", "Tur", "Yo‘nalish", "Summa", "Valyuta", "Hisob", "Qaysi hisobga", "Qabul summasi", "Qabul valyutasi", "Kategoriya", "Izoh", "Teglar"];

const TYPE_LABEL: Record<string, string> = {
  INCOME: "Daromad",
  EXPENSE: "Xarajat",
  REFUND: "Qaytim",
  ADJUSTMENT: "Tuzatish",
  DEBT_LEND: "Qarz berildi",
  DEBT_BORROW: "Qarz olindi",
  DEBT_REPAY_IN: "Qarz qaytdi",
  DEBT_REPAY_OUT: "Qarz qaytarildi",
  TRANSFER: "O‘tkazma",
};

/** Tanlangan oraliqdagi (Toshkent kunlari, ikkala chekka ham kiradi) barcha yozuvlar: tranzaksiya va o'tkazmalar. */
export async function exportCsv(db: Db, userId: string, from: string, to: string): Promise<string> {
  validateRange(from, to);
  const { start, end } = dayRange(from, to);
  const [txs, trs] = await Promise.all([
    db.transaction.findMany({
      where: { userId, deletedAt: null, occurredAt: { gte: start, lt: end } },
      include: { account: true, category: true, tags: true },
    }),
    db.transfer.findMany({
      where: { userId, deletedAt: null, occurredAt: { gte: start, lt: end } },
      include: { fromAccount: true, toAccount: true },
    }),
  ]);

  type Row = { at: Date; cells: string[] };
  const rows: Row[] = [];
  const amt = (minor: bigint, cur: string) => (isCurrency(cur) ? minorToInput(minor, cur) : minor.toString());

  for (const t of txs) {
    const l = toLocalInputs(t.occurredAt);
    rows.push({
      at: t.occurredAt,
      cells: [
        l.date, l.time, TYPE_LABEL[t.type] ?? t.type, t.flow === "IN" ? "Kirim" : "Chiqim",
        amt(t.amount, t.currency), t.currency, t.account.name, "", "", "",
        t.category?.name ?? "", t.note, t.tags.map((x) => x.name).sort().join(" "),
      ],
    });
  }
  for (const t of trs) {
    const l = toLocalInputs(t.occurredAt);
    rows.push({
      at: t.occurredAt,
      cells: [
        l.date, l.time, TYPE_LABEL.TRANSFER!, "O‘tkazma",
        amt(t.fromAmount, t.fromCurrency), t.fromCurrency, t.fromAccount.name, t.toAccount.name,
        amt(t.toAmount, t.toCurrency), t.toCurrency, "", t.note, "",
      ],
    });
  }
  rows.sort((a, b) => a.at.getTime() - b.at.getTime());

  const lines = [HEADER, ...rows.map((r) => r.cells)].map((cells) => cells.map(csvCell).join(";"));
  // BOM: Excel UTF-8 ni to'g'ri taniydi. Ajratuvchi ";" — o'zbek/rus mintaqasidagi Excel uchun mos.
  return `﻿${lines.join("\r\n")}\r\n`;
}
