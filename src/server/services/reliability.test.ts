import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { createTestDb, uniqueEmail } from "../test-utils";
import { registerUser } from "./auth";
import { completeOnboarding } from "./onboarding";
import { listAccounts } from "./accounts";
import { listCategories } from "./categories";
import { createTransaction } from "./transactions";
import { createTransfer } from "./transfers";
import { createDebt, addDebtPayment } from "./debts";
import { checkIntegrity } from "./integrity";
import { buildBackup } from "./backup";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ db, cleanup } = await createTestDb()));
afterAll(async () => cleanup());

async function setup() {
  const email = uniqueEmail();
  const { userId } = await registerUser(db, { name: "T", email, password: "password123" }, { allowRegistration: true });
  await completeOnboarding(db, userId, {
    name: "T", primaryCurrency: "UZS",
    accounts: [
      { name: "Naqd", type: "CASH", currency: "UZS", openingBalance: "1 000 000" },
      { name: "Karta", type: "CARD", currency: "UZS", openingBalance: "0" },
      { name: "Dollar", type: "CASH", currency: "USD", openingBalance: "100" },
    ],
    goal: null,
  } as never);
  const accs = await listAccounts(db, userId);
  const cats = await listCategories(db, userId);
  const id = (n: string) => accs.find((a) => a.name === n)!.id;
  return { userId, email, cash: id("Naqd"), card: id("Karta"), usd: id("Dollar"), food: cats.find((c) => c.name === "Oziq-ovqat")!.id };
}
type C = Awaited<ReturnType<typeof setup>>;
const tx = (c: C, amount: string, date = "2026-10-10") =>
  createTransaction(db, c.userId, { type: "EXPENSE", accountId: c.cash, categoryId: c.food, amount, date, time: "12:00", note: "", tags: [] });

describe("yaxlitlik tekshiruvi", () => {
  it("toza ma'lumotda muammo yo'q (tranzaksiya, o'tkazma, qarz)", async () => {
    const c = await setup();
    await tx(c, "100 000");
    await createTransfer(db, c.userId, { fromAccountId: c.cash, toAccountId: c.card, fromAmount: "50 000", toAmount: "", date: "2026-10-11", time: "10:00", note: "" } as never);
    const { id } = await createDebt(db, c.userId, { direction: "LENT", counterparty: "Ali", amount: "200 000", currency: "UZS", accountId: c.cash, startDate: "2026-10-12", dueDate: "", note: "" });
    await addDebtPayment(db, c.userId, { debtId: id, accountId: c.cash, amount: "50 000", date: "2026-10-13", note: "" });
    const r = await checkIntegrity(db, c.userId);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.checked.transactions).toBeGreaterThanOrEqual(3);
    expect(r.checked.transfers).toBe(1);
    expect(r.checked.debts).toBe(1);
  });

  it("buzilgan yozuvlarni topadi: valyuta, yo'nalish, summa, qarz holati", async () => {
    const c = await setup();
    const t = await tx(c, "100 000");
    if (t.status !== "created") throw new Error("kutilmagan");
    await db.transaction.update({ where: { id: t.id }, data: { currency: "USD" } });
    const t2 = await tx(c, "10 000", "2026-10-11");
    if (t2.status !== "created") throw new Error("kutilmagan");
    await db.transaction.update({ where: { id: t2.id }, data: { flow: "IN" } });
    const { id } = await createDebt(db, c.userId, { direction: "LENT", counterparty: "Vali", amount: "200 000", currency: "UZS", accountId: null, startDate: "2026-10-12", dueDate: "", note: "" });
    await db.debt.update({ where: { id }, data: { status: "PAID" } });

    const r = await checkIntegrity(db, c.userId);
    const codes = r.issues.map((i) => i.code);
    expect(r.ok).toBe(false);
    expect(codes).toContain("tx_currency");
    expect(codes).toContain("tx_flow");
    expect(codes).toContain("debt_status");
  });

  it("boshqa foydalanuvchi muammolari ko'rinmaydi", async () => {
    const a = await setup();
    const b = await setup();
    const t = await tx(a, "1 000");
    if (t.status !== "created") throw new Error("kutilmagan");
    await db.transaction.update({ where: { id: t.id }, data: { currency: "USD" } });
    expect((await checkIntegrity(db, a.userId)).ok).toBe(false);
    expect((await checkIntegrity(db, b.userId)).ok).toBe(true);
  });
});

describe("JSON nusxa", () => {
  it("summalar matn, parol/sessiya yo'q, faqat o'z ma'lumoti", async () => {
    const a = await setup();
    const b = await setup();
    await tx(a, "123 456");
    await tx(b, "999");
    const raw = await buildBackup(db, a.userId, new Date("2026-10-25T00:00:00Z"));
    const d = JSON.parse(raw);
    expect(d.app).toBe("FINOVA");
    expect(d.version).toBe(1);
    expect(d.exportedAt).toBe("2026-10-25T00:00:00.000Z");
    expect(d.user.email).toBe(a.email);
    expect(raw).not.toContain("passwordHash");
    expect(raw).not.toContain(b.email);
    expect(d.transactions).toHaveLength(1);
    expect(d.transactions[0].amount).toBe("12345600"); // matn, aniq
    expect(typeof d.transactions[0].amount).toBe("string");
    expect(d.accounts.find((x: { name: string }) => x.name === "Naqd").openingBalance).toBe("100000000");
    expect(Array.isArray(d.transactions[0].tagIds)).toBe(true);
  });
});
