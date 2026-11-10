import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { createTestDb, uniqueEmail } from "../test-utils";
import { registerUser } from "./auth";
import { completeOnboarding } from "./onboarding";
import { listAccounts } from "./accounts";
import { listCategories } from "./categories";
import { createTransaction } from "./transactions";
import { saveBudget } from "./budgets";
import { createDebt } from "./debts";
import { getPulse } from "./pulse";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ db, cleanup } = await createTestDb()));
afterAll(async () => cleanup());

const NOW = new Date("2026-10-24T09:00:00.000Z"); // Toshkent: 24-oktabr

async function setup() {
  const { userId } = await registerUser(db, { name: "T", email: uniqueEmail(), password: "password123" }, { allowRegistration: true });
  await completeOnboarding(db, userId, {
    name: "T", primaryCurrency: "UZS",
    accounts: [
      { name: "Naqd", type: "CASH", currency: "UZS", openingBalance: "1 000 000" },
      { name: "Dollar", type: "CASH", currency: "USD", openingBalance: "100" },
    ],
    goal: null,
  } as never);
  const cash = (await listAccounts(db, userId)).find((a) => a.name === "Naqd")!.id;
  const cats = await listCategories(db, userId);
  return { userId, cash, food: cats.find((c) => c.name === "Oziq-ovqat")!.id, salary: cats.find((c) => c.name === "Maosh")!.id };
}
const tx = (c: Awaited<ReturnType<typeof setup>>, type: string, amount: string, categoryId: string, date: string) =>
  createTransaction(db, c.userId, { type, accountId: c.cash, categoryId, amount, date, time: "12:00", note: "", tags: [] });

describe("Financial Pulse xizmati", () => {
  it("yangi foydalanuvchi: ball yo'q, sabablar ko'rsatiladi", async () => {
    const c = await setup();
    const { pulse } = await getPulse(db, c.userId, NOW);
    expect(pulse.score).toBeNull();
    expect(pulse.components).toHaveLength(0);
    expect(pulse.missing).toHaveLength(4);
  });

  it("haqiqiy ma'lumotdan to'rt qism va umumiy ball", async () => {
    const c = await setup();
    await tx(c, "INCOME", "1 000 000", c.salary, "2026-10-05");
    await tx(c, "EXPENSE", "700 000", c.food, "2026-10-10");
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: c.food, currency: "UZS", limit: "500 000" }); // oshgan
    await saveBudget(db, c.userId, { month: "2026-10", categoryId: null, currency: "UZS", limit: "2 000 000" }); // me'yorda
    await createDebt(db, c.userId, {
      direction: "BORROWED", counterparty: "Bank", amount: "100 000", currency: "UZS", accountId: null,
      startDate: "2026-10-01", dueDate: "2026-10-20", note: "",
    });
    const { currency, pulse } = await getPulse(db, c.userId, NOW);
    expect(currency).toBe("UZS");
    const by = Object.fromEntries(pulse.components.map((x) => [x.key, x.score]));
    expect(by.savings).toBe(100); // 30% ≥ 20%
    expect(by.budget).toBe(50); // 1 oshgan + 1 me'yorda
    expect(by.debt).toBe(50); // 1 muddati o'tgan
    expect(by.runway).toBe(62); // balans 1 300 000 / (700 000/30) ≈ 55,7 kun
    expect(pulse.score).toBe(66);
    expect(pulse.band).toBe("mid");
  });

  it("boshqa foydalanuvchi ma'lumoti ta'sir qilmaydi", async () => {
    const a = await setup();
    const b = await setup();
    await tx(a, "INCOME", "1 000 000", a.salary, "2026-10-05");
    await tx(a, "EXPENSE", "100 000", a.food, "2026-10-06");
    expect((await getPulse(db, b.userId, NOW)).pulse.components).toHaveLength(0);
  });
});
