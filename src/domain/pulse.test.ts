import { describe, expect, it } from "vitest";
import { bandFor, computePulse, runwayDays, type PulseInput } from "./pulse";

const base: PulseInput = {
  income: 1_000_000n, netExpense: 800_000n,
  budgets: { total: 0, over: 0, warn: 0 },
  borrowedDebts: { active: 0, overdue: 0 },
  balance: 0n, spend30: 0n,
};

describe("runwayDays", () => {
  it("balans / kunlik o'rtacha; xarajat yo'q bo'lsa null; manfiy balans 0", () => {
    expect(runwayDays(3000n, 3000n)).toBe(30);
    expect(runwayDays(1500n, 3000n)).toBe(15);
    expect(runwayDays(5000n, 0n)).toBeNull();
    expect(runwayDays(-5n, 3000n)).toBe(0);
  });
});

describe("bandFor", () => {
  it("chegaralar", () => {
    expect(bandFor(75)).toBe("good");
    expect(bandFor(74)).toBe("mid");
    expect(bandFor(50)).toBe("mid");
    expect(bandFor(49)).toBe("low");
  });
});

describe("computePulse", () => {
  it("ma'lumot yetarli bo'lmasa ball yo'q (faqat 1 qism)", () => {
    const p = computePulse(base);
    expect(p.score).toBeNull();
    expect(p.band).toBeNull();
    expect(p.components.map((c) => c.key)).toEqual(["savings"]);
    expect(p.missing.map((m) => m.key).sort()).toEqual(["budget", "debt", "runway"]);
  });
  it("daromad yo'q — jamg'arma qismi hisobga olinmaydi", () => {
    const p = computePulse({ ...base, income: 0n });
    expect(p.components).toHaveLength(0);
    expect(p.missing.find((m) => m.key === "savings")).toBeTruthy();
  });
  it("jamg'arma: 20% = 100, 10% = 50, manfiy = 0", () => {
    const s = (net: bigint) => computePulse({ ...base, netExpense: net, budgets: { total: 1, over: 0, warn: 0 } }).components[0]!.score;
    expect(s(800_000n)).toBe(100);
    expect(s(900_000n)).toBe(50);
    expect(s(1_300_000n)).toBe(0);
  });
  it("byudjet: oshgan 0, yaqin 50, me'yorda 100", () => {
    const p = computePulse({ ...base, netExpense: 800_000n, budgets: { total: 4, over: 1, warn: 1 } });
    const b = p.components.find((c) => c.key === "budget")!;
    expect(b.score).toBe(63); // (2*100 + 1*50) / 4 = 62.5 → 63
    expect(b.detail).toContain("4 ta byudjetdan 1 tasi oshgan");
  });
  it("qarz: har bir muddati o'tgan -50", () => {
    const d = (overdue: number) =>
      computePulse({ ...base, borrowedDebts: { active: 3, overdue } }).components.find((c) => c.key === "debt")!.score;
    expect(d(0)).toBe(100);
    expect(d(1)).toBe(50);
    expect(d(5)).toBe(0);
  });
  it("zaxira: 90 kun = 100; 45 kun = 50; taxmin ekani matnda", () => {
    const r = computePulse({ ...base, balance: 90n * 1000n, spend30: 30_000n }).components.find((c) => c.key === "runway")!;
    expect(r.score).toBe(100);
    const h = computePulse({ ...base, balance: 45n * 1000n, spend30: 30_000n }).components.find((c) => c.key === "runway")!;
    expect(h.score).toBe(50);
    expect(h.detail).toContain("Taxminan 45 kun");
  });
  it("umumiy ball — mavjud qismlarning o'rtachasi va tarmoq", () => {
    const p = computePulse({
      ...base,
      budgets: { total: 2, over: 0, warn: 0 }, // 100
      borrowedDebts: { active: 1, overdue: 1 }, // 50
    }); // savings 100, budget 100, debt 50 → 83.3 → 83
    expect(p.score).toBe(83);
    expect(p.band).toBe("good");
  });
});
