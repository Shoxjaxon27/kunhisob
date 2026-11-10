import { describe, expect, it } from "vitest";
import {
  balanceTimeline,
  bucketKind,
  buildBuckets,
  buildInsights,
  changePct,
  dailyAverage,
  previousRange,
  rangeDays,
  savingsRate,
  weekStart,
  weekdayStats,
} from "./analytics";

describe("oraliq", () => {
  it("kunlar soni ikkala chekkani qo'shib sanaydi", () => {
    expect(rangeDays("2026-10-01", "2026-10-01")).toBe(1);
    expect(rangeDays("2026-10-01", "2026-10-31")).toBe(31);
    expect(rangeDays("2026-10-05", "2026-10-01")).toBe(0);
  });
  it("oldingi oraliq xuddi shu uzunlikda va darhol oldin", () => {
    expect(previousRange("2026-10-01", "2026-10-31")).toEqual({ from: "2026-08-31", to: "2026-09-30" });
    expect(previousRange("2026-10-24", "2026-10-24")).toEqual({ from: "2026-10-23", to: "2026-10-23" });
    expect(previousRange("2026-10-18", "2026-10-24")).toEqual({ from: "2026-10-11", to: "2026-10-17" });
  });
});

describe("ko'rsatkichlar", () => {
  it("jamg'arma darajasi: daromad 0 bo'lsa null; manfiy bo'lishi mumkin", () => {
    expect(savingsRate(1000n, 250n)).toBe(25);
    expect(savingsRate(1000n, -500n)).toBe(-50);
    expect(savingsRate(0n, 100n)).toBeNull();
  });
  it("foiz o'zgarishi: oldingi 0 bo'lsa null", () => {
    expect(changePct(150n, 100n)).toBe(50);
    expect(changePct(50n, 100n)).toBe(-50);
    expect(changePct(10n, 0n)).toBeNull();
    expect(changePct(-50n, -100n)).toBe(50);
  });
  it("kunlik o'rtacha", () => {
    expect(dailyAverage(1000n, 3)).toBe(333n);
    expect(dailyAverage(1000n, 0)).toBe(0n);
  });
});

describe("bo'laklar", () => {
  it("bo'lak turi uzunlikka qarab", () => {
    expect(bucketKind(7)).toBe("day");
    expect(bucketKind(62)).toBe("day");
    expect(bucketKind(63)).toBe("week");
    expect(bucketKind(190)).toBe("week");
    expect(bucketKind(191)).toBe("month");
  });
  it("hafta dushanbadan boshlanadi", () => {
    expect(weekStart("2026-10-24")).toBe("2026-10-19"); // shanba → dushanba
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // yakshanba
  });
  it("kunlik bo'laklar to'liq va uzluksiz", () => {
    const b = buildBuckets("2026-10-30", "2026-11-02", "day");
    expect(b.map((x) => x.key)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
  it("haftalik bo'laklar chegarada kesiladi, bo'shliq va ustma-ust tushish yo'q", () => {
    const b = buildBuckets("2026-10-21", "2026-11-03", "week");
    expect(b.map((x) => [x.from, x.to])).toEqual([
      ["2026-10-21", "2026-10-25"],
      ["2026-10-26", "2026-11-01"],
      ["2026-11-02", "2026-11-03"],
    ]);
  });
  it("oylik bo'laklar (kabisa yili fevral ham)", () => {
    const b = buildBuckets("2027-12-15", "2028-03-10", "month");
    expect(b.map((x) => [x.key, x.from, x.to])).toEqual([
      ["2027-12", "2027-12-15", "2027-12-31"],
      ["2028-01", "2028-01-01", "2028-01-31"],
      ["2028-02", "2028-02-01", "2028-02-29"],
      ["2028-03", "2028-03-01", "2028-03-10"],
    ]);
  });
  it("bo'sh oraliq — bo'sh ro'yxat", () => {
    expect(buildBuckets("2026-10-05", "2026-10-01", "day")).toEqual([]);
  });
});

describe("hafta kunlari", () => {
  it("o'rtacha = jami / uchrashlar soni (bo'sh kunlar ham hisobda)", () => {
    // 2026-10-19 dushanba … 2026-11-01 yakshanba: har bir hafta kuni 2 marta
    const per = new Map<string, bigint>([
      ["2026-10-19", 100n],
      ["2026-10-26", 300n],
      ["2026-10-24", 50n], // shanba
    ]);
    const s = weekdayStats(per, "2026-10-19", "2026-11-01");
    expect(s).toHaveLength(7);
    expect(s[0]!.occurrences).toBe(2);
    expect(s[0]!.total).toBe(400n);
    expect(s[0]!.average).toBe(200n);
    expect(s[5]!.average).toBe(25n); // shanba
    expect(s[6]!.total).toBe(0n);
    expect(s.map((x) => x.label)).toEqual(["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan", "Yak"]);
  });
  it("qisqa oraliqda uchramagan kunlar occurrences 0, average 0", () => {
    const s = weekdayStats(new Map(), "2026-10-24", "2026-10-24");
    expect(s[5]!.occurrences).toBe(1);
    expect(s[0]!.occurrences).toBe(0);
    expect(s[0]!.average).toBe(0n);
  });
});

describe("balans dinamikasi", () => {
  it("bo'lak oxiridagi balans; bo'lakdan oldingi hodisalar ham hisoblanadi", () => {
    const buckets = buildBuckets("2026-10-10", "2026-10-12", "day");
    const events = [
      { at: new Date("2026-10-05T07:00:00Z"), delta: 500n }, // oraliqdan oldin
      { at: new Date("2026-10-10T07:00:00Z"), delta: -100n },
      { at: new Date("2026-10-12T07:00:00Z"), delta: 40n },
    ];
    expect(balanceTimeline(1000n, events, buckets)).toEqual([1400n, 1400n, 1440n]);
  });
  it("Toshkent kunlik chegarasi: 23:30 UTC (ertasi kun 04:30) keyingi kunga tegishli", () => {
    const buckets = buildBuckets("2026-10-10", "2026-10-11", "day");
    const events = [{ at: new Date("2026-10-10T20:00:00Z"), delta: 7n }]; // Toshkent: 11-oktabr 01:00
    expect(balanceTimeline(0n, events, buckets)).toEqual([0n, 7n]);
  });
  it("hodisalarning tartibi muhim emas", () => {
    const buckets = buildBuckets("2026-10-10", "2026-10-11", "day");
    const a = { at: new Date("2026-10-10T07:00:00Z"), delta: 1n };
    const b = { at: new Date("2026-10-11T07:00:00Z"), delta: 2n };
    expect(balanceTimeline(0n, [b, a], buckets)).toEqual(balanceTimeline(0n, [a, b], buckets));
  });
});

describe("xulosalar", () => {
  const base = { income: 1000n, netExpense: 500n, prevNetExpense: 400n, savingsRatePct: 50, topCategory: null, expenseChangePct: 25 };
  it("xarajat oshganda ogohlantiradi, kamayganda ijobiy", () => {
    expect(buildInsights(base).some((i) => i.tone === "warn" && i.text.includes("25%"))).toBe(true);
    const down = buildInsights({ ...base, expenseChangePct: -30 });
    expect(down.some((i) => i.tone === "good" && i.text.includes("30%"))).toBe(true);
  });
  it("kichik o'zgarish yoki oldingi ma'lumot yo'q bo'lsa jim", () => {
    expect(buildInsights({ ...base, expenseChangePct: 5, savingsRatePct: 10 })).toEqual([]);
    expect(buildInsights({ ...base, prevNetExpense: 0n, expenseChangePct: null, savingsRatePct: null })).toEqual([]);
  });
  it("daromaddan ko'p sarf va yirik kategoriya", () => {
    const r = buildInsights({ ...base, expenseChangePct: null, savingsRatePct: -20, topCategory: { name: "Oziq-ovqat", sharePct: 62.4 } });
    expect(r.map((i) => i.text)).toEqual(["Bu davrda xarajat daromaddan oshgan.", "“Oziq-ovqat” xarajatning 62% ini tashkil qiladi."]);
  });
});
