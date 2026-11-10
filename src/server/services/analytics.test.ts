import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { createTestDb, uniqueEmail } from "../test-utils";
import { AppError } from "../errors";
import { registerUser } from "./auth";
import { completeOnboarding } from "./onboarding";
import { listAccounts } from "./accounts";
import { listCategories } from "./categories";
import { createAdjustment, createTransaction, deleteTransaction } from "./transactions";
import { createTransfer } from "./transfers";
import { createDebt } from "./debts";
import { getAnalytics } from "./analytics";
import { csvCell, exportCsv } from "./export";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => {
  await cleanup();
});

const NOW = new Date("2026-10-24T09:00:00.000Z"); // Toshkent: shanba, 24-oktabr 14:00

async function setup() {
  const { userId } = await registerUser(db, { name: "T", email: uniqueEmail(), password: "password123" }, { allowRegistration: true });
  await completeOnboarding(db, userId, {
    name: "T",
    primaryCurrency: "UZS",
    accounts: [
      { name: "Naqd", type: "CASH", currency: "UZS", openingBalance: "1 000 000" },
      { name: "Karta", type: "CARD", currency: "UZS", openingBalance: "0" },
      { name: "Dollar", type: "CASH", currency: "USD", openingBalance: "100" },
    ],
    goal: null,
  });
  const accs = await listAccounts(db, userId);
  const cats = await listCategories(db, userId);
  const id = (n: string) => cats.find((c) => c.name === n)!.id;
  return {
    userId,
    cash: accs.find((a) => a.name === "Naqd")!.id,
    card: accs.find((a) => a.name === "Karta")!.id,
    usd: accs.find((a) => a.name === "Dollar")!.id,
    food: id("Oziq-ovqat"),
    transport: id("Transport"),
    salary: id("Maosh"),
  };
}
type C = Awaited<ReturnType<typeof setup>>;

const tx = (c: C, type: string, amount: string, date: string, categoryId: string | null, note = "", accountId = c.cash) =>
  createTransaction(db, c.userId, { type, accountId, categoryId, amount, date, time: "12:00", note, tags: [] });

/** Oktabr (joriy) va sentabr (oldingi) uchun ma'lum raqamli stsenariy. */
async function scenario() {
  const c = await setup();
  await tx(c, "INCOME", "2 000 000", "2026-10-01", c.salary, "Oylik");
  await tx(c, "EXPENSE", "300 000", "2026-10-05", c.food, "Bozor");
  await tx(c, "EXPENSE", "20 000", "2026-10-12", c.food, "Tushlik");
  await tx(c, "EXPENSE", "20 000", "2026-10-19", c.food, "tushlik "); // izoh katta-kichik harf va bo'sh joydan qat'i nazar bitta
  await tx(c, "EXPENSE", "100 000", "2026-10-06", c.transport, "Taksi");
  await tx(c, "REFUND", "50 000", "2026-10-07", c.food, "Bozor qaytim");
  await tx(c, "EXPENSE", "200 000", "2026-09-10", c.food, "Bozor"); // oldingi oy
  await tx(c, "INCOME", "1 000 000", "2026-09-01", c.salary, "Oylik");
  await tx(c, "EXPENSE", "10", "2026-10-08", c.food, "Dollar xarajat", c.usd);
  // Hisoblar orasidagi o'tkazma va qarz sarf/daromadga kirmasligi kerak:
  await createTransfer(db, c.userId, { fromAccountId: c.cash, toAccountId: c.card, fromAmount: "100 000", toAmount: "", date: "2026-10-09", time: "10:00", note: "" });
  await createTransfer(db, c.userId, { fromAccountId: c.cash, toAccountId: c.usd, fromAmount: "500 000", toAmount: "40", date: "2026-10-10", time: "10:00", note: "" });
  await createDebt(db, c.userId, { direction: "LENT", counterparty: "Ali", amount: "50 000", currency: "UZS", accountId: c.cash, startDate: "2026-10-11", dueDate: "", note: "" });
  return c;
}

const Q = { from: "2026-10-01", to: "2026-10-31", currency: "UZS" as const };

describe("tahlil: ko'rsatkichlar", () => {
  it("daromad, sof xarajat, oqim, jamg'arma darajasi; o'tkazma va qarz kirmaydi; boshqa valyuta aralashmaydi", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, Q, NOW);
    expect(a.totals.income).toBe(200_000_000n);
    expect(a.totals.expense).toBe(44_000_000n); // 300k + 20k + 20k + 100k = 440 000
    expect(a.totals.refunds).toBe(5_000_000n);
    expect(a.totals.netExpense).toBe(39_000_000n);
    expect(a.totals.net).toBe(161_000_000n);
    expect(a.savingsRatePct).toBe(80.5);
    expect(a.prevTotals.income).toBe(100_000_000n);
    expect(a.prevTotals.netExpense).toBe(20_000_000n);
    expect(a.expenseChangePct).toBe(95); // 390 000 vs 200 000
    expect(a.incomeChangePct).toBe(100);
    expect(a.txCount).toBe(6);
    expect(a.currencies.sort()).toEqual(["USD", "UZS"]);
  });

  it("kunlik o'rtacha o'tgan kunlar bo'yicha (kelajak kunlar suyultirmaydi)", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, Q, NOW);
    expect(a.query.days).toBe(31);
    expect(a.query.elapsedDays).toBe(24);
    expect(a.avgDailySpend).toBe(39_000_000n / 24n);
  });

  it("USD alohida: faqat USD yozuvlari", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, { ...Q, currency: "USD" }, NOW);
    expect(a.totals.netExpense).toBe(1000n);
    expect(a.totals.income).toBe(0n);
    expect(a.savingsRatePct).toBeNull();
  });

  it("daromad bo'lmasa jamg'arma darajasi null; ma'lumot yo'q oraliq bo'sh", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, { from: "2026-06-01", to: "2026-06-30", currency: "UZS" }, NOW);
    expect(a.hasData).toBe(false);
    expect(a.savingsRatePct).toBeNull();
    expect(a.expenseChangePct).toBeNull();
    expect(a.categories).toEqual([]);
    expect(a.insights).toEqual([]);
  });
});

describe("tahlil: grafiklar", () => {
  it("kunlik bo'laklar yig'indisi jami bilan teng", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, Q, NOW);
    expect(a.bucketKind).toBe("day");
    expect(a.flow).toHaveLength(31);
    expect(a.flow.reduce((s, p) => s + p.income, 0n)).toBe(a.totals.income);
    expect(a.flow.reduce((s, p) => s + p.netExpense, 0n)).toBe(a.totals.netExpense);
    expect(a.flow.find((p) => p.key === "2026-10-07")!.netExpense).toBe(-5_000_000n); // faqat qaytim
  });

  it("uzoq oraliq haftalik/oylik bo'laklarga bo'linadi va jami saqlanadi", async () => {
    const c = await scenario();
    const w = await getAnalytics(db, c.userId, { from: "2026-08-01", to: "2026-10-31", currency: "UZS" }, NOW);
    expect(w.bucketKind).toBe("week");
    expect(w.flow.reduce((s, p) => s + p.netExpense, 0n)).toBe(w.totals.netExpense);
    const m = await getAnalytics(db, c.userId, { from: "2026-01-01", to: "2026-10-31", currency: "UZS" }, NOW);
    expect(m.bucketKind).toBe("month");
    expect(m.flow.find((p) => p.key === "2026-10")!.income).toBe(200_000_000n);
    expect(m.flow.reduce((s, p) => s + p.income, 0n)).toBe(m.totals.income);
  });

  it("balans dinamikasi: oxirgi nuqta hisoblar balansi yig'indisiga teng; ichki o'tkazma uni o'zgartirmaydi", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, Q, NOW);
    const accs = await listAccounts(db, c.userId);
    const uzsTotal = accs.filter((x) => x.currency === "UZS").reduce((s, x) => s + x.balance, 0n);
    // Oxirgi bo'lak (31-oktabr) kelajakda, lekin hodisalar bugungacha — balans hozirgiga teng.
    expect(a.balance.at(-1)!.balance).toBe(uzsTotal);
    // 8-oktabr: ochilish 1 000 000 + oraliqdan OLDINGI sentabr (+1 000 000 − 200 000) + oktabr 1–8:
    // +2 000 000 − 300 000 − 100 000 + 50 000
    expect(a.balance.find((p) => p.key === "2026-10-08")!.balance).toBe(
      100_000_000n + (100_000_000n - 20_000_000n) + 200_000_000n - 30_000_000n - 10_000_000n + 5_000_000n,
    );
    // 9-oktabr: UZS→UZS o'tkazma jami balansni o'zgartirmaydi
    expect(a.balance.find((p) => p.key === "2026-10-09")!.balance).toBe(a.balance.find((p) => p.key === "2026-10-08")!.balance);
    // 10-oktabr: UZS→USD o'tkazma UZS balansini 500 000 ga kamaytiradi
    expect(a.balance.find((p) => p.key === "2026-10-10")!.balance).toBe(a.balance.find((p) => p.key === "2026-10-09")!.balance - 50_000_000n);
    // 11-oktabr: qarz berildi (−50 000) balansga ta'sir qiladi
    expect(a.balance.find((p) => p.key === "2026-10-11")!.balance).toBe(a.balance.find((p) => p.key === "2026-10-10")!.balance - 5_000_000n);
  });

  it("USD balans dinamikasi o'tkazma bilan kiritilgan summani ko'rsatadi", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, { ...Q, currency: "USD" }, NOW);
    expect(a.balance.find((p) => p.key === "2026-10-09")!.balance).toBe(10_000n - 1000n);
    expect(a.balance.find((p) => p.key === "2026-10-10")!.balance).toBe(10_000n - 1000n + 4000n);
  });
});

describe("tahlil: kategoriyalar va ro'yxatlar", () => {
  it("kategoriya = xarajat − qaytim; ulush va oldingi davr bilan o'zgarish", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, Q, NOW);
    const food = a.categories.find((x) => x.id === c.food)!;
    const tr = a.categories.find((x) => x.id === c.transport)!;
    expect(food.amount).toBe(29_000_000n); // 340 000 − 50 000
    expect(tr.amount).toBe(10_000_000n);
    expect(a.categories[0]!.id).toBe(c.food);
    expect(food.sharePct + tr.sharePct).toBeCloseTo(100, 0);
    expect(food.prevAmount).toBe(20_000_000n);
    expect(food.changePct).toBe(45);
    expect(tr.changePct).toBeNull(); // oldingi davrda yo'q
  });

  it("daromad manbalari ulushi", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, Q, NOW);
    expect(a.incomeSources).toHaveLength(1);
    expect(a.incomeSources[0]!.name).toBe("Maosh");
    expect(a.incomeSources[0]!.sharePct).toBe(100);
  });

  it("yirik xarajatlar kamayish tartibida; izohlar katta-kichik harfdan qat'i nazar guruhlanadi", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, Q, NOW);
    expect(a.topExpenses.map((t) => t.amount)).toEqual([30_000_000n, 10_000_000n, 2_000_000n, 2_000_000n]);
    expect(a.topExpenses[0]!.note).toBe("Bozor");
    const lunch = a.topNotes.find((n) => n.note.toLowerCase() === "tushlik")!;
    expect(lunch.count).toBe(2);
    expect(lunch.total).toBe(4_000_000n);
    expect(a.topNotes[0]!.note).toBe("Bozor");
  });

  it("hafta kunlari: sarf bo'lgan kun eng band; kelajak kunlar hisobga olinmaydi", async () => {
    const c = await scenario();
    const a = await getAnalytics(db, c.userId, Q, NOW);
    // 1–24 oktabr oralig'ida dushanbalar: 5, 12, 19 (26-si kelajakda — hisobga olinmaydi)
    const mon = a.weekdays[0]!;
    expect(mon.label).toBe("Dush");
    expect(mon.occurrences).toBe(3);
    expect(mon.total).toBe(30_000_000n + 2_000_000n + 2_000_000n); // Bozor + 2 ta tushlik
    expect(a.busiestWeekday).not.toBeNull();
    expect(a.weekdays.reduce((s, w) => s + w.total, 0n)).toBe(a.totals.netExpense);
  });

  it("o'chirilgan tranzaksiya tahlilga kirmaydi", async () => {
    const c = await setup();
    const t = await tx(c, "EXPENSE", "100 000", "2026-10-05", c.food, "X");
    expect((await getAnalytics(db, c.userId, Q, NOW)).totals.netExpense).toBe(10_000_000n);
    if (t.status === "created") await deleteTransaction(db, c.userId, t.id);
    const a = await getAnalytics(db, c.userId, Q, NOW);
    expect(a.totals.netExpense).toBe(0n);
    expect(a.topExpenses).toEqual([]);
  });

  it("balans tuzatish xarajat/daromad emas, lekin balansga kiradi", async () => {
    const c = await setup();
    await createAdjustment(db, c.userId, { accountId: c.cash, actualBalance: "1 200 000", date: "2026-10-05", time: "10:00", note: "" });
    const a = await getAnalytics(db, c.userId, Q, NOW);
    expect(a.totals.income).toBe(0n);
    expect(a.totals.netExpense).toBe(0n);
    expect(a.balance.find((p) => p.key === "2026-10-05")!.balance).toBe(120_000_000n);
  });
});

describe("tahlil: xavfsizlik va tekshiruv", () => {
  it("boshqa foydalanuvchi ma'lumoti ko'rinmaydi", async () => {
    const a = await scenario();
    const b = await setup();
    const res = await getAnalytics(db, b.userId, Q, NOW);
    expect(res.totals.income).toBe(0n);
    expect(res.hasData).toBe(false);
    expect(a.userId).not.toBe(b.userId);
  });

  it("noto'g'ri oraliq rad etiladi", async () => {
    const c = await setup();
    for (const q of [
      { from: "2026-10-31", to: "2026-10-01", currency: "UZS" as const },
      { from: "2026-02-30", to: "2026-03-01", currency: "UZS" as const },
      { from: "2000-01-01", to: "2026-10-01", currency: "UZS" as const },
    ]) {
      const e = await getAnalytics(db, c.userId, q, NOW).then(() => null, (x: unknown) => x);
      expect(e).toBeInstanceOf(AppError);
    }
  });
});

describe("CSV eksport", () => {
  it("formula in'ektsiyasidan va noto'g'ri tirnoqdan himoya", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+998901234567")).toBe("'+998901234567");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@sum")).toBe("'@sum");
    expect(csvCell("a;b")).toBe("\"a;b\"");
    expect(csvCell("ikki\nqator")).toBe("\"ikki\nqator\"");
    expect(csvCell("oddiy matn")).toBe("oddiy matn");
  });

  it("tranzaksiya va o'tkazmalar sana bo'yicha tartiblangan, aniq summalar bilan; faqat o'z ma'lumoti", async () => {
    const c = await scenario();
    const other = await setup();
    await tx(other, "EXPENSE", "777", "2026-10-05", other.food, "BEGONA");
    const csv = await exportCsv(db, c.userId, "2026-10-01", "2026-10-31");
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toContain("Sana;Vaqt;Tur");
    expect(lines.length).toBe(1 + 10); // 8 tranzaksiya (qarz va USD xarajat ham) + 2 o'tkazma
    expect(csv).not.toContain("BEGONA");
    expect(csv).toContain("2026-10-05;12:00;Xarajat;Chiqim;300000;UZS;Naqd");
    expect(csv).toContain("O‘tkazma;O‘tkazma;500000;UZS;Naqd;Dollar;40;USD");
    const dates = lines.slice(1).map((l) => l.slice(0, 10));
    expect([...dates].sort()).toEqual(dates);
  });

  it("noto'g'ri oraliq rad etiladi", async () => {
    const c = await setup();
    await expect(exportCsv(db, c.userId, "2026-10-31", "2026-10-01")).rejects.toBeInstanceOf(AppError);
  });
});
