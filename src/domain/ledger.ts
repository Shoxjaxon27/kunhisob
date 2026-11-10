/**
 * Hisob-kitob qoidalari (sof funksiyalar, bazadan mustaqil).
 *
 * 1) Hisob balansi saqlanmaydi — har doim ma'lumotlardan hisoblanadi:
 *      opening + Σ(IN) − Σ(OUT) + Σ(transfer.toAmount) − Σ(transfer.fromAmount)
 * 2) O'tkazma (Transfer) daromad ham, xarajat ham emas.
 * 3) Qarz harakatlari (DEBT_*) va balans tuzatish (ADJUSTMENT) balansga ta'sir qiladi,
 *    lekin daromad/xarajat statistikasiga kirmaydi.
 * 4) Refund — xarajat toifasidagi qaytim: daromad emas, sof xarajatni kamaytiradi.
 */

export type Flow = "IN" | "OUT";

export type TxType =
  | "INCOME"
  | "EXPENSE"
  | "REFUND"
  | "ADJUSTMENT"
  | "DEBT_LEND"
  | "DEBT_BORROW"
  | "DEBT_REPAY_IN"
  | "DEBT_REPAY_OUT";

/** Foydalanuvchi Sprint 2 da yarata oladigan turlar. Qarz turlari Sprint 3 da ochiladi. */
export const CREATABLE_TX_TYPES = ["INCOME", "EXPENSE", "REFUND", "ADJUSTMENT"] as const;
export type CreatableTxType = (typeof CREATABLE_TX_TYPES)[number];

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

/** Tranzaksiya turi → pul yo'nalishi. ADJUSTMENT uchun yo'nalish alohida beriladi. */
export function flowForType(type: TxType, adjustmentFlow?: Flow): Flow {
  switch (type) {
    case "INCOME":
    case "REFUND":
    case "DEBT_BORROW":
    case "DEBT_REPAY_IN":
      return "IN";
    case "EXPENSE":
    case "DEBT_LEND":
    case "DEBT_REPAY_OUT":
      return "OUT";
    case "ADJUSTMENT":
      if (!adjustmentFlow) throw new LedgerError("Balans tuzatish uchun yo'nalish kerak");
      return adjustmentFlow;
  }
}

export type BalanceInputs = {
  opening: bigint;
  txIn: bigint;
  txOut: bigint;
  transferIn: bigint;
  transferOut: bigint;
};

export function computeBalance(i: BalanceInputs): bigint {
  return i.opening + i.txIn - i.txOut + i.transferIn - i.transferOut;
}

export type AccountOpening = { id: string; openingBalance: bigint };
export type TxAggregate = { accountId: string; flow: Flow; sum: bigint };
export type TransferAggregate = { accountId: string; direction: "in" | "out"; sum: bigint };

/** Hisoblar bo'yicha aggregatlardan balanslarni yig'adi. */
export function computeBalances(
  accounts: readonly AccountOpening[],
  txAggregates: readonly TxAggregate[],
  transferAggregates: readonly TransferAggregate[],
): Map<string, bigint> {
  const inputs = new Map<string, BalanceInputs>();
  for (const a of accounts) {
    inputs.set(a.id, { opening: a.openingBalance, txIn: 0n, txOut: 0n, transferIn: 0n, transferOut: 0n });
  }
  for (const t of txAggregates) {
    const row = inputs.get(t.accountId);
    if (!row) continue;
    if (t.flow === "IN") row.txIn += t.sum;
    else row.txOut += t.sum;
  }
  for (const t of transferAggregates) {
    const row = inputs.get(t.accountId);
    if (!row) continue;
    if (t.direction === "in") row.transferIn += t.sum;
    else row.transferOut += t.sum;
  }
  const out = new Map<string, bigint>();
  for (const [id, row] of inputs) out.set(id, computeBalance(row));
  return out;
}

// ───────────────────────── Statistika qoidalari ─────────────────────────

export type PeriodTotalsInput = { type: TxType; sum: bigint };

export type PeriodTotals = {
  income: bigint;
  /** Yalpi xarajat (refundsiz). */
  expense: bigint;
  refunds: bigint;
  /** Sof xarajat = xarajat − refund. */
  netExpense: bigint;
  /** Operatsion sof pul oqimi = daromad − sof xarajat. Qarz va tuzatishlar kirmaydi. */
  net: bigint;
};

export function periodTotals(rows: readonly PeriodTotalsInput[]): PeriodTotals {
  let income = 0n;
  let expense = 0n;
  let refunds = 0n;
  for (const r of rows) {
    if (r.type === "INCOME") income += r.sum;
    else if (r.type === "EXPENSE") expense += r.sum;
    else if (r.type === "REFUND") refunds += r.sum;
  }
  const netExpense = expense - refunds;
  return { income, expense, refunds, netExpense, net: income - netExpense };
}

/** Tuzatish summasi: haqiqiy balans va hisoblangan balans farqi. null — farq yo'q. */
export function adjustmentFor(actual: bigint, computed: bigint): { flow: Flow; amount: bigint } | null {
  const diff = actual - computed;
  if (diff === 0n) return null;
  return diff > 0n ? { flow: "IN", amount: diff } : { flow: "OUT", amount: -diff };
}

/** Tranzaksiya yo'nalishining balansga ta'siri (belgili). */
export function signedEffect(flow: Flow, amount: bigint): bigint {
  return flow === "IN" ? amount : -amount;
}
