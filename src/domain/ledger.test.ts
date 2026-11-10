import { describe, expect, it } from "vitest";
import {
  LedgerError,
  adjustmentFor,
  computeBalance,
  computeBalances,
  flowForType,
  periodTotals,
  signedEffect,
} from "./ledger";

describe("flowForType", () => {
  it("turlarga mos yo'nalish beradi", () => {
    expect(flowForType("INCOME")).toBe("IN");
    expect(flowForType("REFUND")).toBe("IN");
    expect(flowForType("EXPENSE")).toBe("OUT");
    expect(flowForType("DEBT_LEND")).toBe("OUT");
    expect(flowForType("DEBT_BORROW")).toBe("IN");
    expect(flowForType("DEBT_REPAY_IN")).toBe("IN");
    expect(flowForType("DEBT_REPAY_OUT")).toBe("OUT");
  });

  it("ADJUSTMENT yo'nalishsiz bo'lmaydi", () => {
    expect(() => flowForType("ADJUSTMENT")).toThrow(LedgerError);
    expect(flowForType("ADJUSTMENT", "OUT")).toBe("OUT");
  });
});

describe("computeBalance / computeBalances", () => {
  it("boshlang'ich balans + kirim − chiqim ± o'tkazma", () => {
    expect(
      computeBalance({ opening: 1000n, txIn: 500n, txOut: 200n, transferIn: 50n, transferOut: 30n }),
    ).toBe(1320n);
  });

  it("o'tkazma bir hisobdan ayirilib, ikkinchisiga qo'shiladi — umumiy yig'indi o'zgarmaydi", () => {
    const balances = computeBalances(
      [
        { id: "cash", openingBalance: 1_000_000n },
        { id: "card", openingBalance: 0n },
      ],
      [],
      [
        { accountId: "cash", direction: "out", sum: 400_000n },
        { accountId: "card", direction: "in", sum: 400_000n },
      ],
    );
    expect(balances.get("cash")).toBe(600_000n);
    expect(balances.get("card")).toBe(400_000n);
    expect((balances.get("cash") ?? 0n) + (balances.get("card") ?? 0n)).toBe(1_000_000n);
  });

  it("noma'lum hisob aggregatlarini e'tiborsiz qoldiradi", () => {
    const b = computeBalances([{ id: "a", openingBalance: 10n }], [{ accountId: "zzz", flow: "IN", sum: 99n }], []);
    expect(b.get("a")).toBe(10n);
    expect(b.has("zzz")).toBe(false);
  });
});

describe("periodTotals", () => {
  it("refund daromad emas, sof xarajatni kamaytiradi", () => {
    const t = periodTotals([
      { type: "INCOME", sum: 5_000n },
      { type: "EXPENSE", sum: 2_000n },
      { type: "REFUND", sum: 500n },
    ]);
    expect(t).toEqual({ income: 5_000n, expense: 2_000n, refunds: 500n, netExpense: 1_500n, net: 3_500n });
  });

  it("qarz va tuzatishlar daromad/xarajatga kirmaydi", () => {
    const t = periodTotals([
      { type: "DEBT_BORROW", sum: 9_999n },
      { type: "DEBT_LEND", sum: 8_888n },
      { type: "ADJUSTMENT", sum: 7_777n },
    ]);
    expect(t.income).toBe(0n);
    expect(t.expense).toBe(0n);
    expect(t.net).toBe(0n);
  });
});

describe("adjustmentFor", () => {
  it("haqiqiy balans katta bo'lsa — IN, kichik bo'lsa — OUT, teng bo'lsa — null", () => {
    expect(adjustmentFor(1_000n, 800n)).toEqual({ flow: "IN", amount: 200n });
    expect(adjustmentFor(800n, 1_000n)).toEqual({ flow: "OUT", amount: 200n });
    expect(adjustmentFor(500n, 500n)).toBeNull();
  });

  it("tuzatishdan keyin balans haqiqiy qiymatga teng bo'ladi", () => {
    const computed = 1_234n;
    const actual = 5_000n;
    const adj = adjustmentFor(actual, computed);
    expect(adj).not.toBeNull();
    expect(computed + signedEffect(adj!.flow, adj!.amount)).toBe(actual);
  });
});
