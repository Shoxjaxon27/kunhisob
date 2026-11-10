import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { createTestDb, uniqueEmail } from "../test-utils";
import { AppError } from "../errors";
import { registerUser } from "./auth";
import { completeOnboarding } from "./onboarding";
import { getAccount, listAccounts } from "./accounts";
import { listCategories } from "./categories";
import { createTransaction, deleteTransaction, updateTransaction } from "./transactions";
import { listFeed } from "./feed";
import { copyBudgetsFromPreviousMonth, deleteBudget, listBudgets, saveBudget } from "./budgets";
import { addDebtPayment, createDebt, debtTotals, deleteDebt, deleteDebtPayment, listDebts } from "./debts";
import {
  addGoalContribution,
  createGoal,
  deleteGoalContribution,
  listGoals,
  setGoalArchived,
  updateGoal,
} from "./goals";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => {
  await cleanup();
});

const NOW = new Date("2026-10-24T09:00:00.000Z"); // Toshkent: 24-oktabr 14:00

async function setup() {
  const { userId } = await registerUser(
    db,
    { name: "T", email: uniqueEmail(), password: "password123" },
    { allowRegistration: true },
  );
  await completeOnboarding(db, userId, {
    name: "T",
    primaryCurrency: "UZS",
    accounts: [
      { name: "Naqd", type: "CASH", currency: "UZS", openingBalance: "1 000 000" },
      { name: "Dollar", type: "CASH", currency: "USD", openingBalance: "100" },
    ],
    goal: { name: "Telefon", target: "5 000 000", currency: "UZS" },
  });
  const accounts = await listAccounts(db, userId);
  const cats = await listCategories(db, userId);
  return {
    userId,
    cash: accounts.find((a) => a.name === "Naqd")!.id,
    usd: accounts.find((a) => a.name === "Dollar")!.id,
    food: cats.find((c) => c.name === "Oziq-ovqat")!.id,
    transport: cats.find((c) => c.name === "Transport")!.id,
    salary: cats.find((c) => c.name === "Maosh")!.id,
  };
}
type C = Awaited<ReturnType<typeof setup>>;

const spend = (c: C, amount: string, categoryId: string, date = "2026-10-20", type = "EXPENSE") =>
  createTransaction(db, c.userId, { type, accountId: c.cash, categoryId, amount, date, time: "12:00", note: "", tags: [] });

const bal = async (c: C, id: string) => (await getAccount(db, c.userId, id)).balance;
const rejects = async (p: Promise<unknown>, code?: string) => {
  const e = await p.then(() => null, (x: unknown) => x);
  expect(e).toBeInstanceOf(AppError);
  if (code) expect((e as AppError).code).toBe(code);
  return e as AppError;
};

describe("byudjet", () => {
  it("sarf: xarajat − qaytim; boshqa oy va boshqa kategoriya hisobga kirmaydi", async () => {
    const c = await setup();
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: c.food, currency: "UZS", limit: "500 000" });
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: null, currency: "UZS", limit: "2 000 000" });
    await spend(c, "300 000", c.food);
    await spend(c, "50 000", c.food, "2026-10-21", "REFUND");
    await spend(c, "100 000", c.transport);
    await spend(c, "999 000", c.food, "2026-09-30"); // o'tgan oy
    await spend(c, "10 000", c.salary, "2026-10-22", "INCOME"); // daromad xarajat emas

    const list = await listBudgets(db, c.userId, "2026-10", NOW);
    const overall = list.find((b) => b.categoryId === null)!;
    const food = list.find((b) => b.categoryId === c.food)!;
    expect(food.spent).toBe(25_000_000n); // (300 000 − 50 000) so'm tiyinda
    expect(overall.spent).toBe(35_000_000n); // 250 000 + 100 000
    expect(food.progress.status).toBe("ok");
    expect(food.progress.pct).toBe(50);
    expect(list[0]!.categoryId).toBeNull(); // umumiy birinchi
  });

  it("limitdan oshsa 'over', qoldiq manfiy; o'chirilgan harakat hisobga kirmaydi", async () => {
    const c = await setup();
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: c.food, currency: "UZS", limit: "100 000" });
    const t = await spend(c, "120 000", c.food);
    let b = (await listBudgets(db, c.userId, "2026-10", NOW))[0]!;
    expect(b.progress.status).toBe("over");
    expect(b.progress.remaining).toBe(-2_000_000n);
    expect(b.dailyAllowance).toBe(0n);
    if (t.status === "created") await deleteTransaction(db, c.userId, t.id);
    b = (await listBudgets(db, c.userId, "2026-10", NOW))[0]!;
    expect(b.spent).toBe(0n);
    expect(b.progress.status).toBe("ok");
  });

  it("bir xil oy+kategoriya+valyuta — yangi yozuv emas, limit yangilanadi", async () => {
    const c = await setup();
    const a = await saveBudget(db, c.userId, { month: "2026-10", categoryId: c.food, currency: "UZS", limit: "100 000" });
    const b = await saveBudget(db, c.userId, { month: "2026-10", categoryId: c.food, currency: "UZS", limit: "200 000" });
    expect(b.id).toBe(a.id);
    const list = await listBudgets(db, c.userId, "2026-10", NOW);
    expect(list).toHaveLength(1);
    expect(list[0]!.limit).toBe(20_000_000n);
  });

  it("UZS va USD byudjetlari alohida; USD sarfi UZS ga qo'shilmaydi", async () => {
    const c = await setup();
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: null, currency: "UZS", limit: "1 000 000" });
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: null, currency: "USD", limit: "50" });
    await createTransaction(db, c.userId, {
      type: "EXPENSE", accountId: c.usd, categoryId: c.food, amount: "20", date: "2026-10-22", time: "10:00", note: "", tags: [],
    });
    const list = await listBudgets(db, c.userId, "2026-10", NOW);
    expect(list.find((b) => b.currency === "UZS")!.spent).toBe(0n);
    expect(list.find((b) => b.currency === "USD")!.spent).toBe(2000n);
  });

  it("noto'g'ri kiritishlar rad etiladi (daromad kategoriyasi, begona kategoriya, 0 limit, noto'g'ri oy)", async () => {
    const c = await setup();
    const other = await setup();
    await rejects(saveBudget(db, c.userId, { month: "2026-10", categoryId: c.salary, currency: "UZS", limit: "100" }), "validation");
    await rejects(saveBudget(db, c.userId, { month: "2026-10", categoryId: other.food, currency: "UZS", limit: "100" }), "not_found");
    await rejects(saveBudget(db, c.userId, { month: "2026-10", categoryId: null, currency: "UZS", limit: "0" }), "validation");
    await rejects(saveBudget(db, c.userId, { month: "2026-13", categoryId: null, currency: "UZS", limit: "100" }), "validation");
  });

  it("oldingi oy byudjetini nusxalash mavjudlarga tegmaydi; o'chirish faqat egasiga", async () => {
    const c = await setup();
    const other = await setup();
    await saveBudget(db, c.userId, { month: "2026-09", categoryId: c.food, currency: "UZS", limit: "100 000" });
    await saveBudget(db, c.userId, { month: "2026-09", categoryId: c.transport, currency: "UZS", limit: "50 000" });
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: c.food, currency: "UZS", limit: "999 000" });
    expect(await copyBudgetsFromPreviousMonth(db, c.userId, "2026-10")).toBe(1);
    expect(await copyBudgetsFromPreviousMonth(db, c.userId, "2026-10")).toBe(0);
    const list = await listBudgets(db, c.userId, "2026-10", NOW);
    expect(list).toHaveLength(2);
    expect(list.find((b) => b.categoryId === c.food)!.limit).toBe(99_900_000n);
    await rejects(deleteBudget(db, other.userId, list[0]!.id), "not_found");
    await deleteBudget(db, c.userId, list[0]!.id);
    expect(await listBudgets(db, c.userId, "2026-10", NOW)).toHaveLength(1);
  });

  it("yopilgan o'tgan oy: prognoz va kunlik ruxsat yo'q", async () => {
    const c = await setup();
    await saveBudget(db, c.userId, { month: "2026-09", categoryId: null, currency: "UZS", limit: "1 000 000" });
    const b = (await listBudgets(db, c.userId, "2026-09", NOW))[0]!;
    expect(b.projected).toBeNull();
    expect(b.dailyAllowance).toBeNull();
  });
});

describe("qarz", () => {
  const debtInput = (c: C, over: Record<string, unknown> = {}) => ({
    direction: "LENT", counterparty: "Ali", amount: "400 000", currency: "UZS", accountId: c.cash,
    startDate: "2026-10-20", dueDate: "2026-10-26", note: "", ...over,
  });
  const pay = (c: C, debtId: string, amount: string, over: Record<string, unknown> = {}) =>
    addDebtPayment(db, c.userId, { debtId, accountId: c.cash, amount, date: "2026-10-23", note: "", ...over });

  it("qarz berildi: hisobdan chiqadi; to'lovlar qaytaradi; holatlar OPEN→PARTIAL→PAID", async () => {
    const c = await setup();
    const { id } = await createDebt(db, c.userId, debtInput(c));
    expect(await bal(c, c.cash)).toBe(100_000_000n - 40_000_000n);
    let d = (await listDebts(db, c.userId, NOW))[0]!;
    expect(d.status).toBe("OPEN");
    expect(d.remaining).toBe(40_000_000n);

    await pay(c, id, "150 000");
    d = (await listDebts(db, c.userId, NOW))[0]!;
    expect(d.status).toBe("PARTIAL");
    expect(d.paid).toBe(15_000_000n);
    expect(d.remaining).toBe(25_000_000n);
    expect(await bal(c, c.cash)).toBe(100_000_000n - 40_000_000n + 15_000_000n);

    await pay(c, id, "250 000");
    d = (await listDebts(db, c.userId, NOW))[0]!;
    expect(d.status).toBe("PAID");
    expect(d.remaining).toBe(0n);
    expect(d.due).toBe("none");
    expect(await bal(c, c.cash)).toBe(100_000_000n); // hammasi qaytdi
  });

  it("qarz olindi: hisobga kiradi; to'lov hisobdan chiqadi", async () => {
    const c = await setup();
    const { id } = await createDebt(db, c.userId, debtInput(c, { direction: "BORROWED", counterparty: "Bank", amount: "1 000 000" }));
    expect(await bal(c, c.cash)).toBe(200_000_000n);
    await pay(c, id, "300 000");
    expect(await bal(c, c.cash)).toBe(170_000_000n);
  });

  it("ortiqcha to'lash, yopilgan qarzga to'lash, valyuta nomosligi rad etiladi", async () => {
    const c = await setup();
    const { id } = await createDebt(db, c.userId, debtInput(c, { amount: "100 000" }));
    const e = await rejects(pay(c, id, "100 001"), "validation");
    expect(e.fields?.amount).toBeTruthy();
    await rejects(pay(c, id, "50 000", { accountId: c.usd }), "validation");
    await pay(c, id, "100 000");
    await rejects(pay(c, id, "1"), "conflict");
    expect(await bal(c, c.cash)).toBe(100_000_000n);
  });

  it("hisobsiz qarz (eski qarzni qayd etish) balansga ta'sir qilmaydi", async () => {
    const c = await setup();
    await createDebt(db, c.userId, debtInput(c, { accountId: null }));
    expect(await bal(c, c.cash)).toBe(100_000_000n);
    const d = (await listDebts(db, c.userId, NOW))[0]!;
    expect(d.movedMoney).toBe(false);
  });

  it("to'lovni o'chirish balansni va holatni tiklaydi; qarz o'chirilsa dastlabki harakat ham ketadi", async () => {
    const c = await setup();
    const { id } = await createDebt(db, c.userId, debtInput(c));
    const { id: payId } = await pay(c, id, "100 000");
    await rejects(deleteDebt(db, c.userId, id), "conflict"); // to'lovi bor
    await deleteDebtPayment(db, c.userId, payId);
    let d = (await listDebts(db, c.userId, NOW))[0]!;
    expect(d.status).toBe("OPEN");
    expect(await bal(c, c.cash)).toBe(100_000_000n - 40_000_000n);
    await deleteDebt(db, c.userId, id);
    expect(await listDebts(db, c.userId, NOW)).toHaveLength(0);
    expect(await bal(c, c.cash)).toBe(100_000_000n);
  });

  it("muddat holatlari: kechikkan / yaqin; jami qoldiq valyutalar bo'yicha", async () => {
    const c = await setup();
    await createDebt(db, c.userId, debtInput(c, { counterparty: "Eski", dueDate: "2026-10-21", amount: "100 000" }));
    await createDebt(db, c.userId, debtInput(c, { counterparty: "Yaqin", dueDate: "2026-10-26", amount: "200 000" }));
    await createDebt(db, c.userId, debtInput(c, { direction: "BORROWED", counterparty: "Dollar", currency: "USD", accountId: c.usd, dueDate: "2026-12-01", amount: "30" }));
    const list = await listDebts(db, c.userId, NOW);
    expect(list.find((d) => d.counterparty === "Eski")!.due).toBe("overdue");
    expect(list.find((d) => d.counterparty === "Yaqin")!.due).toBe("soon");
    expect(list.find((d) => d.counterparty === "Dollar")!.due).toBe("later");
    expect(list[0]!.counterparty).toBe("Eski"); // muddati eng yaqin birinchi
    const totals = debtTotals(list);
    expect(totals.UZS).toEqual({ lent: 30_000_000n, borrowed: 0n });
    expect(totals.USD).toEqual({ lent: 0n, borrowed: 3000n });
  });

  it("noto'g'ri kiritish: muddat boshlanishdan oldin, valyuta hisobga mos emas, begona hisob", async () => {
    const c = await setup();
    const other = await setup();
    await rejects(createDebt(db, c.userId, debtInput(c, { dueDate: "2026-10-01" })), "validation");
    await rejects(createDebt(db, c.userId, debtInput(c, { currency: "USD" })), "validation");
    await rejects(createDebt(db, c.userId, debtInput(c, { accountId: other.cash })), "not_found");
  });

  it("boshqa foydalanuvchining qarzi/to'lovi ko'rinmaydi va o'zgarmaydi", async () => {
    const a = await setup();
    const b = await setup();
    const { id } = await createDebt(db, a.userId, debtInput(a));
    const { id: payId } = await pay(a, id, "10 000");
    expect(await listDebts(db, b.userId, NOW)).toHaveLength(0);
    await rejects(addDebtPayment(db, b.userId, { debtId: id, accountId: b.cash, amount: "1", date: "2026-10-23", note: "" }), "not_found");
    await rejects(deleteDebtPayment(db, b.userId, payId), "not_found");
    await rejects(deleteDebt(db, b.userId, id), "not_found");
  });

  it("qarz harakatlari tranzaksiya sifatida tahrirlanmaydi va statistikaga (xarajat) kirmaydi", async () => {
    const c = await setup();
    await createDebt(db, c.userId, debtInput(c));
    const feed = await listFeed(db, c.userId, {});
    const item = feed.items.find((i) => i.kind === "tx" && i.type === "DEBT_LEND")!;
    await rejects(deleteTransaction(db, c.userId, item.id), "conflict");
    await rejects(
      updateTransaction(db, c.userId, item.id, { type: "EXPENSE", accountId: c.cash, categoryId: c.food, amount: "1", date: "2026-10-20", time: "10:00", note: "", tags: [] }),
      "conflict",
    );
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: null, currency: "UZS", limit: "1 000 000" });
    expect((await listBudgets(db, c.userId, "2026-10", NOW))[0]!.spent).toBe(0n);
  });
});

describe("maqsadlar", () => {
  const goalInput = (over: Record<string, unknown> = {}) => ({
    name: "Mashina", target: "10 000 000", currency: "UZS", deadline: "2027-01-15", monthlyPlan: "", color: "#8b5cf6", ...over,
  });

  it("onboardingdagi maqsad ko'rinadi", async () => {
    const c = await setup();
    const goals = await listGoals(db, c.userId, { now: NOW });
    expect(goals).toHaveLength(1);
    expect(goals[0]!.name).toBe("Telefon");
    expect(goals[0]!.target).toBe(500_000_000n);
  });

  it("qo'shilgan summa foiz va oylik kerakli summani o'zgartiradi; hisob balansiga ta'sir qilmaydi", async () => {
    const c = await setup();
    const { id } = await createGoal(db, c.userId, goalInput());
    await addGoalContribution(db, c.userId, { goalId: id, amount: "2 500 000", date: "2026-10-24", note: "" });
    const g = (await listGoals(db, c.userId, { now: NOW })).find((x) => x.id === id)!;
    expect(g.saved).toBe(250_000_000n);
    expect(g.progress.pct).toBe(25);
    expect(g.progress.monthsLeft).toBe(4);
    expect(g.progress.requiredMonthly).toBe(187_500_000n); // 7 500 000 / 4
    expect(await bal(c, c.cash)).toBe(100_000_000n);
  });

  it("maqsadga yetganda completed; yozuvni o'chirish qaytaradi", async () => {
    const c = await setup();
    const { id } = await createGoal(db, c.userId, goalInput({ target: "1 000", deadline: "" }));
    const { id: cid } = await addGoalContribution(db, c.userId, { goalId: id, amount: "1 200", date: "2026-10-24", note: "" });
    let g = (await listGoals(db, c.userId, { now: NOW })).find((x) => x.id === id)!;
    expect(g.progress.completed).toBe(true);
    expect(g.progress.pct).toBe(100);
    await deleteGoalContribution(db, c.userId, cid);
    g = (await listGoals(db, c.userId, { now: NOW })).find((x) => x.id === id)!;
    expect(g.progress.completed).toBe(false);
    expect(g.saved).toBe(0n);
  });

  it("arxivlangan maqsadga qo'shib bo'lmaydi; ro'yxatda yashirinadi", async () => {
    const c = await setup();
    const { id } = await createGoal(db, c.userId, goalInput());
    await setGoalArchived(db, c.userId, id, true);
    await rejects(addGoalContribution(db, c.userId, { goalId: id, amount: "1", date: "2026-10-24", note: "" }), "conflict");
    expect((await listGoals(db, c.userId, { now: NOW })).some((g) => g.id === id)).toBe(false);
    expect((await listGoals(db, c.userId, { now: NOW, includeArchived: true })).some((g) => g.id === id)).toBe(true);
  });

  it("valyutani faqat qo'shilgan summa bo'lmaganda o'zgartirish mumkin; begona foydalanuvchi o'zgartira olmaydi", async () => {
    const a = await setup();
    const b = await setup();
    const { id } = await createGoal(db, a.userId, goalInput());
    await updateGoal(db, a.userId, id, goalInput({ currency: "USD", target: "1 000" }));
    await addGoalContribution(db, a.userId, { goalId: id, amount: "10", date: "2026-10-24", note: "" });
    await rejects(updateGoal(db, a.userId, id, goalInput({ currency: "UZS" })), "conflict");
    await rejects(updateGoal(db, b.userId, id, goalInput()), "not_found");
    await rejects(addGoalContribution(db, b.userId, { goalId: id, amount: "1", date: "2026-10-24", note: "" }), "not_found");
  });

  it("noto'g'ri kiritish rad etiladi", async () => {
    const c = await setup();
    await rejects(createGoal(db, c.userId, goalInput({ target: "0" })), "validation");
    await rejects(createGoal(db, c.userId, goalInput({ name: "  " })), "validation");
    await rejects(createGoal(db, c.userId, goalInput({ deadline: "2027-02-30" })), "validation");
    await rejects(createGoal(db, c.userId, goalInput({ color: "red" })), "validation");
  });
});
