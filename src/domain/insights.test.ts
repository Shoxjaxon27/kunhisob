import { describe, expect, it } from "vitest";
import { dailySummary, percentChange } from "./insights";

const base = { currency: "UZS" as const, todayIncome: 0n, entryCount: 1, avgPrev7NetExpense: 0n, todayNetExpense: 0n };

describe("dailySummary", () => {
  it("yozuv bo'lmasa — empty", () => {
    expect(dailySummary({ ...base, entryCount: 0 }).tone).toBe("empty");
  });

  it("o'rtachadan 20% va undan ko'p — above", () => {
    const s = dailySummary({ ...base, todayNetExpense: 15_000_000n, avgPrev7NetExpense: 10_000_000n });
    expect(s.tone).toBe("above");
    expect(s.detail).toContain("50%");
  });

  it("o'rtachadan 20% va undan kam — below", () => {
    const s = dailySummary({ ...base, todayNetExpense: 5_000_000n, avgPrev7NetExpense: 10_000_000n });
    expect(s.tone).toBe("below");
    expect(s.detail).toContain("50%");
  });

  it("chegara ichida — calm", () => {
    expect(dailySummary({ ...base, todayNetExpense: 11_000_000n, avgPrev7NetExpense: 10_000_000n }).tone).toBe("calm");
    expect(dailySummary({ ...base, todayNetExpense: 8_100_000n, avgPrev7NetExpense: 10_000_000n }).tone).toBe("calm");
  });

  it("aynan 20% — above (chegara kiradi)", () => {
    expect(dailySummary({ ...base, todayNetExpense: 12_000_000n, avgPrev7NetExpense: 10_000_000n }).tone).toBe("above");
  });

  it("taqqoslash ma'lumoti yo'q bo'lsa — neutral, o'ylab topmaydi", () => {
    const s = dailySummary({ ...base, todayNetExpense: 5_000n });
    expect(s.tone).toBe("neutral");
    expect(s.detail).toContain("ma’lumoti yo‘q");
  });

  it("faqat kirim — income", () => {
    expect(dailySummary({ ...base, todayIncome: 100_000n }).tone).toBe("income");
  });

  it("faqat o'tkazma/tuzatish — neutral", () => {
    expect(dailySummary(base).tone).toBe("neutral");
  });
});

describe("percentChange", () => {
  it("oldingi 0 bo'lsa null", () => {
    expect(percentChange(100n, 0n)).toBeNull();
  });
  it("foizni butun sonda hisoblaydi", () => {
    expect(percentChange(150n, 100n)).toBe(50);
    expect(percentChange(50n, 100n)).toBe(-50);
  });
});
