import { describe, expect, it } from "vitest";
import {
  budgetProgress,
  dailyAllowance,
  daysUntil,
  debtStatusFor,
  dueState,
  goalProgress,
  projectMonthSpend,
} from "./planning";

describe("budgetProgress", () => {
  it("holatlar: ok / warn (80%) / over", () => {
    expect(budgetProgress(1000n, 500n).status).toBe("ok");
    expect(budgetProgress(1000n, 799n).status).toBe("ok");
    expect(budgetProgress(1000n, 800n).status).toBe("warn");
    expect(budgetProgress(1000n, 1000n).status).toBe("warn"); // aynan limit — hali oshmagan
    expect(budgetProgress(1000n, 1001n).status).toBe("over");
  });
  it("qoldiq manfiy bo'lishi mumkin (oshgan summa ko'rinadi)", () => {
    expect(budgetProgress(1000n, 1250n).remaining).toBe(-250n);
    expect(budgetProgress(1000n, 1250n).pct).toBe(125);
  });
  it("katta summalarda aniq (float yo'q)", () => {
    const limit = 9_007_199_254_740_994n;
    expect(budgetProgress(limit, limit / 2n).pct).toBe(50);
  });
  it("manfiy sarf (qaytim ko'p) 0 deb olinadi; limit musbat bo'lishi shart", () => {
    expect(budgetProgress(1000n, -50n).pct).toBe(0);
    expect(() => budgetProgress(0n, 1n)).toThrow(RangeError);
  });
});

describe("prognoz va kunlik ruxsat", () => {
  it("prognoz: sur'at saqlansa oy yakuni", () => {
    expect(projectMonthSpend(1000n, 10, 30)).toBe(3000n);
  });
  it("oyning dastlabki kunlarida yoki sarfsiz — null", () => {
    expect(projectMonthSpend(1000n, 2, 30)).toBeNull();
    expect(projectMonthSpend(0n, 15, 30)).toBeNull();
  });
  it("kunlik ruxsat: qoldiq / qolgan kunlar (bugun ham kiradi)", () => {
    expect(dailyAllowance(3000n, 21, 30)).toBe(300n); // 10 kun qoldi
    expect(dailyAllowance(-5n, 21, 30)).toBe(0n);
    expect(dailyAllowance(100n, 30, 30)).toBe(100n);
  });
});

describe("qarz", () => {
  it("holat to'langan summaga qarab", () => {
    expect(debtStatusFor(1000n, 0n)).toBe("OPEN");
    expect(debtStatusFor(1000n, 1n)).toBe("PARTIAL");
    expect(debtStatusFor(1000n, 1000n)).toBe("PAID");
  });
  it("muddat holati", () => {
    expect(dueState(null, "2026-10-24", "OPEN")).toBe("none");
    expect(dueState("2026-10-23", "2026-10-24", "OPEN")).toBe("overdue");
    expect(dueState("2026-10-24", "2026-10-24", "OPEN")).toBe("soon");
    expect(dueState("2026-10-27", "2026-10-24", "PARTIAL")).toBe("soon");
    expect(dueState("2026-10-28", "2026-10-24", "OPEN")).toBe("later");
    expect(dueState("2026-10-01", "2026-10-24", "PAID")).toBe("none");
  });
  it("daysUntil", () => {
    expect(daysUntil("2026-10-27", "2026-10-24")).toBe(3);
    expect(daysUntil("2026-10-20", "2026-10-24")).toBe(-4);
  });
});

describe("goalProgress", () => {
  it("foiz va qoldiq", () => {
    const g = goalProgress(1000n, 250n, "2026-10-24", null, null);
    expect(g.pct).toBe(25);
    expect(g.remaining).toBe(750n);
    expect(g.completed).toBe(false);
    expect(g.requiredMonthly).toBeNull();
  });
  it("maqsad bajarilgan: foiz 100 dan oshmaydi, qoldiq 0", () => {
    const g = goalProgress(1000n, 1500n, "2026-10-24", "2027-01-01", 100n);
    expect(g.completed).toBe(true);
    expect(g.pct).toBe(100);
    expect(g.remaining).toBe(0n);
    expect(g.requiredMonthly).toBeNull();
    expect(g.monthsAtPlan).toBeNull();
  });
  it("muddatgacha oyiga kerak bo'lgan summa (yuqoriga yaxlitlanadi, joriy oy hisobda)", () => {
    // oktabr, noyabr, dekabr, yanvar = 4 oy; qoldiq 1000 → 250
    const g = goalProgress(1000n, 0n, "2026-10-24", "2027-01-15", null);
    expect(g.monthsLeft).toBe(4);
    expect(g.requiredMonthly).toBe(250n);
    expect(goalProgress(1000n, 0n, "2026-10-24", "2027-01-15", null).requiredMonthly).toBe(250n);
    expect(goalProgress(1001n, 0n, "2026-10-24", "2027-01-15", null).requiredMonthly).toBe(251n);
  });
  it("muddat shu oyda bo'lsa — 1 oy; o'tgan bo'lsa — null", () => {
    expect(goalProgress(900n, 0n, "2026-10-24", "2026-10-30", null).monthsLeft).toBe(1);
    expect(goalProgress(900n, 0n, "2026-10-24", "2026-10-30", null).requiredMonthly).toBe(900n);
    expect(goalProgress(900n, 0n, "2026-10-24", "2026-10-01", null).monthsLeft).toBeNull();
  });
  it("oylik reja bo'yicha necha oy kerak", () => {
    expect(goalProgress(1000n, 0n, "2026-10-24", null, 300n).monthsAtPlan).toBe(4);
    expect(goalProgress(1000n, 700n, "2026-10-24", null, 300n).monthsAtPlan).toBe(1);
  });
  it("target musbat bo'lishi shart", () => {
    expect(() => goalProgress(0n, 0n, "2026-10-24", null, null)).toThrow(RangeError);
  });
});
