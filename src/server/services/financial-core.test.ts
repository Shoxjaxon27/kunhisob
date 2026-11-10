import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { createTestDb, uniqueEmail } from "../test-utils";
import { AppError } from "../errors";
import { registerUser } from "./auth";
import { completeOnboarding } from "./onboarding";
import { createAccount, deleteAccount, getAccount, listAccounts, setAccountArchived, updateAccount } from "./accounts";
import { listCategories, createCategory } from "./categories";
import {
  createAdjustment,
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from "./transactions";
import { createTransfer, deleteTransfer, restoreTransfer, updateTransfer } from "./transfers";
import { listFeed } from "./feed";
import { getDashboard } from "./dashboard";
import { getQuickAddContext } from "./quick-add";
import { parseMoney } from "@/domain/money";

let db: Db;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => {
  await cleanup();
});

type Ctx = {
  userId: string;
  cash: string;
  card: string;
  usd: string;
  food: string;
  salary: string;
  transport: string;
};

async function setup(opts: { cashOpening?: string } = {}): Promise<Ctx> {
  const { userId } = await registerUser(
    db,
    { name: "Test", email: uniqueEmail(), password: "password123" },
    { allowRegistration: true },
  );
  await completeOnboarding(db, userId, {
    name: "Test",
    primaryCurrency: "UZS",
    accounts: [
      { name: "Naqd", type: "CASH", currency: "UZS", openingBalance: opts.cashOpening ?? "1 000 000" },
      { name: "Karta", type: "CARD", currency: "UZS", openingBalance: "0" },
      { name: "Dollar", type: "CASH", currency: "USD", openingBalance: "100" },
    ],
    goal: null,
  });
  const accounts = await listAccounts(db, userId);
  const cats = await listCategories(db, userId);
  const byName = (n: string) => cats.find((c) => c.name === n)!.id;
  return {
    userId,
    cash: accounts.find((a) => a.name === "Naqd")!.id,
    card: accounts.find((a) => a.name === "Karta")!.id,
    usd: accounts.find((a) => a.name === "Dollar")!.id,
    food: byName("Oziq-ovqat"),
    transport: byName("Transport"),
    salary: byName("Maosh"),
  };
}

const bal = async (c: Ctx, id: string) => (await getAccount(db, c.userId, id)).balance;

const expense = (c: Ctx, amount: string, over: Record<string, unknown> = {}) =>
  createTransaction(db, c.userId, {
    type: "EXPENSE",
    accountId: c.cash,
    categoryId: c.food,
    amount,
    date: "2026-10-24",
    time: "10:00",
    note: "",
    tags: [],
    ...over,
  });

describe("onboarding", () => {
  it("hisoblar, boshlang'ich balans va standart kategoriyalarni yaratadi", async () => {
    const c = await setup();
    expect(await bal(c, c.cash)).toBe(parseMoney("1000000", "UZS"));
    expect(await bal(c, c.usd)).toBe(10_000n);
    const cats = await listCategories(db, c.userId);
    expect(cats.filter((x) => x.kind === "EXPENSE").length).toBeGreaterThanOrEqual(10);
    expect(cats.filter((x) => x.kind === "INCOME").length).toBeGreaterThanOrEqual(4);
  });

  it("ikkinchi marta bajarilmaydi", async () => {
    const c = await setup();
    await expect(
      completeOnboarding(db, c.userId, {
        name: "X",
        primaryCurrency: "UZS",
        accounts: [{ name: "A", type: "CASH", currency: "UZS", openingBalance: "0" }],
        goal: null,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("noto'g'ri boshlang'ich balansda hech narsa yaratilmaydi (atomik)", async () => {
    const { userId } = await registerUser(
      db,
      { name: "T", email: uniqueEmail(), password: "password123" },
      { allowRegistration: true },
    );
    await expect(
      completeOnboarding(db, userId, {
        name: "T",
        primaryCurrency: "UZS",
        accounts: [
          { name: "Yaxshi", type: "CASH", currency: "UZS", openingBalance: "100" },
          { name: "Yomon", type: "CARD", currency: "UZS", openingBalance: "abc" },
        ],
        goal: null,
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(await db.account.count({ where: { userId } })).toBe(0);
    expect((await db.user.findUnique({ where: { id: userId } }))?.onboardedAt).toBeNull();
  });
});

describe("tranzaksiyalar va balans", () => {
  it("daromad balansni oshiradi, xarajat kamaytiradi", async () => {
    const c = await setup();
    await createTransaction(db, c.userId, {
      type: "INCOME",
      accountId: c.cash,
      categoryId: c.salary,
      amount: "5 000 000",
      date: "2026-10-24",
      time: "09:00",
    });
    await expense(c, "250 000,50");
    expect(await bal(c, c.cash)).toBe(parseMoney("1000000", "UZS") + parseMoney("5000000", "UZS") - parseMoney("250000.50", "UZS"));
  });

  it("USD hisobda cent aniqligi saqlanadi (floating xato yo'q)", async () => {
    const c = await setup();
    await expense(c, "0.10", { accountId: c.usd, categoryId: null });
    await expense(c, "0.20", { accountId: c.usd, categoryId: null, note: "boshqa" });
    expect(await bal(c, c.usd)).toBe(10_000n - 30n);
  });

  it("noto'g'ri summa va kategoriya turini rad etadi", async () => {
    const c = await setup();
    await expect(expense(c, "0")).rejects.toMatchObject({ code: "validation" });
    await expect(expense(c, "-5")).rejects.toMatchObject({ code: "validation" });
    await expect(expense(c, "abc")).rejects.toMatchObject({ code: "validation" });
    await expect(expense(c, "1,2345")).rejects.toMatchObject({ code: "validation" });
    // Daromad kategoriyasi xarajatga mos emas
    await expect(expense(c, "100", { categoryId: c.salary })).rejects.toMatchObject({ code: "validation" });
  });

  it("tahrirlash balansni qayta to'g'ri hisoblaydi (summa va hisob o'zgarganda)", async () => {
    const c = await setup();
    const r = await expense(c, "100 000");
    expect(r.status).toBe("created");
    const id = r.status === "created" ? r.id : "";
    expect(await bal(c, c.cash)).toBe(parseMoney("900000", "UZS"));

    await updateTransaction(db, c.userId, id, {
      type: "EXPENSE",
      accountId: c.card,
      categoryId: c.transport,
      amount: "40 000",
      date: "2026-10-24",
      time: "10:00",
      note: "taksi",
      tags: ["Ish", "#ish", "yo'l"],
    });
    expect(await bal(c, c.cash)).toBe(parseMoney("1000000", "UZS"));
    expect(await bal(c, c.card)).toBe(-parseMoney("40000", "UZS"));
    const feed = await listFeed(db, c.userId, {});
    const item = feed.items.find((i) => i.id === id);
    expect(item?.kind === "tx" && item.tags).toEqual(["ish", "yo'l"]);
  });

  it("turni xarajatdan daromadga o'zgartirish yo'nalishni almashtiradi", async () => {
    const c = await setup();
    const r = await expense(c, "100 000", { categoryId: null });
    const id = r.status === "created" ? r.id : "";
    await updateTransaction(db, c.userId, id, {
      type: "INCOME",
      accountId: c.cash,
      categoryId: c.salary,
      amount: "100 000",
      date: "2026-10-24",
      time: "10:00",
    });
    expect(await bal(c, c.cash)).toBe(parseMoney("1100000", "UZS"));
  });

  it("o'chirish va undo balansni qaytaradi", async () => {
    const c = await setup();
    const r = await expense(c, "300 000");
    const id = r.status === "created" ? r.id : "";
    await deleteTransaction(db, c.userId, id);
    expect(await bal(c, c.cash)).toBe(parseMoney("1000000", "UZS"));
    expect((await listFeed(db, c.userId, {})).items).toHaveLength(0);
    await restoreTransaction(db, c.userId, id);
    expect(await bal(c, c.cash)).toBe(parseMoney("700000", "UZS"));
    // ikki marta o'chirish/tiklash xato beradi, balansni buzmaydi
    await expect(restoreTransaction(db, c.userId, id)).rejects.toMatchObject({ code: "not_found" });
    await deleteTransaction(db, c.userId, id);
    await expect(deleteTransaction(db, c.userId, id)).rejects.toMatchObject({ code: "not_found" });
    expect(await bal(c, c.cash)).toBe(parseMoney("1000000", "UZS"));
  });

  it("o'zgarishlar audit jurnaliga yoziladi", async () => {
    const c = await setup();
    const r = await expense(c, "10 000");
    const id = r.status === "created" ? r.id : "";
    await deleteTransaction(db, c.userId, id);
    await restoreTransaction(db, c.userId, id);
    const actions = (await db.auditLog.findMany({ where: { entity: "transaction", entityId: id }, orderBy: { createdAt: "asc" } })).map(
      (a) => a.action,
    );
    expect(actions).toEqual(["create", "delete", "restore"]);
  });

  it("takroriy tranzaksiyani aniqlaydi va force bilan o'tkazadi", async () => {
    const c = await setup();
    await expense(c, "50 000", { note: "Non" });
    const dup = await expense(c, "50 000", { note: "non" });
    expect(dup.status).toBe("duplicate");
    expect(await bal(c, c.cash)).toBe(parseMoney("950000", "UZS"));
    const forced = await createTransaction(
      db,
      c.userId,
      { type: "EXPENSE", accountId: c.cash, categoryId: c.food, amount: "50 000", date: "2026-10-24", time: "10:00", note: "non" },
      { force: true },
    );
    expect(forced.status).toBe("created");
    expect(await bal(c, c.cash)).toBe(parseMoney("900000", "UZS"));
    // boshqa kunda — takror emas
    const other = await expense(c, "50 000", { note: "non", date: "2026-10-25" });
    expect(other.status).toBe("created");
  });
});

describe("refund va balans tuzatish", () => {
  it("refund balansni oshiradi, lekin daromad emas — sof xarajatni kamaytiradi", async () => {
    const c = await setup();
    await expense(c, "200 000");
    await createTransaction(db, c.userId, {
      type: "REFUND",
      accountId: c.cash,
      categoryId: c.food,
      amount: "50 000",
      date: "2026-10-24",
      time: "12:00",
    });
    expect(await bal(c, c.cash)).toBe(parseMoney("850000", "UZS"));
    const d = await getDashboard(db, c.userId, new Date("2026-10-24T08:00:00.000Z"));
    const t = d.today["UZS"]!;
    expect(t.income).toBe(0n);
    expect(t.expense).toBe(parseMoney("200000", "UZS"));
    expect(t.refunds).toBe(parseMoney("50000", "UZS"));
    expect(t.netExpense).toBe(parseMoney("150000", "UZS"));
    expect(d.topCategories[0]?.amount).toBe(parseMoney("150000", "UZS"));
  });

  it("balansni tuzatish haqiqiy qiymatga tenglaydi, farq bo'lmasa hech narsa yozmaydi", async () => {
    const c = await setup();
    await expense(c, "100 000");
    const res = await createAdjustment(db, c.userId, {
      accountId: c.cash,
      actualBalance: "1 500 000",
      date: "2026-10-24",
      time: "13:00",
    });
    expect(res.status).toBe("created");
    expect(await bal(c, c.cash)).toBe(parseMoney("1500000", "UZS"));

    const again = await createAdjustment(db, c.userId, { accountId: c.cash, actualBalance: "1 500 000", date: "2026-10-24" });
    expect(again.status).toBe("no_change");

    // kamaytirish
    await createAdjustment(db, c.userId, { accountId: c.cash, actualBalance: "200 000", date: "2026-10-24" });
    expect(await bal(c, c.cash)).toBe(parseMoney("200000", "UZS"));

    // tuzatish daromad/xarajat statistikasiga kirmaydi
    const d = await getDashboard(db, c.userId, new Date("2026-10-24T08:00:00.000Z"));
    expect(d.today["UZS"]!.income).toBe(0n);
    expect(d.today["UZS"]!.expense).toBe(parseMoney("100000", "UZS"));
  });
});

describe("o'tkazmalar", () => {
  it("bir valyutada: bir hisobdan ayirib, ikkinchisiga qo'shadi; daromad/xarajatga kirmaydi", async () => {
    const c = await setup();
    await createTransfer(db, c.userId, {
      fromAccountId: c.cash,
      toAccountId: c.card,
      fromAmount: "400 000",
      date: "2026-10-24",
      time: "11:00",
    });
    expect(await bal(c, c.cash)).toBe(parseMoney("600000", "UZS"));
    expect(await bal(c, c.card)).toBe(parseMoney("400000", "UZS"));
    const d = await getDashboard(db, c.userId, new Date("2026-10-24T08:00:00.000Z"));
    expect(d.today["UZS"]!.income).toBe(0n);
    expect(d.today["UZS"]!.expense).toBe(0n);
    expect(d.balances.find((b) => b.currency === "UZS")!.balance).toBe(parseMoney("1000000", "UZS"));
    expect(d.todayEntryCount).toBe(1);
  });

  it("turli valyutada qabul qilinadigan summa majburiy, kurs ikkala summadan hisoblanadi", async () => {
    const c = await setup();
    await expect(
      createTransfer(db, c.userId, { fromAccountId: c.usd, toAccountId: c.cash, fromAmount: "50", date: "2026-10-24" }),
    ).rejects.toMatchObject({ code: "validation", fields: { toAmount: expect.any(String) } });

    await createTransfer(db, c.userId, {
      fromAccountId: c.usd,
      toAccountId: c.cash,
      fromAmount: "50",
      toAmount: "632 500",
      date: "2026-10-24",
    });
    expect(await bal(c, c.usd)).toBe(5_000n);
    expect(await bal(c, c.cash)).toBe(parseMoney("1632500", "UZS"));
    const tr = await db.transfer.findFirstOrThrow({ where: { userId: c.userId } });
    expect(tr.rate).toBe("12650");
    expect(tr.fromCurrency).toBe("USD");
    expect(tr.toCurrency).toBe("UZS");
    expect(tr.fromAmount).toBe(5_000n);
    expect(tr.toAmount).toBe(63_250_000n);
  });

  it("bir xil hisob, arxivlangan hisob va begona hisobni rad etadi; hech narsa yozilmaydi", async () => {
    const c = await setup();
    const other = await setup();
    await expect(
      createTransfer(db, c.userId, { fromAccountId: c.cash, toAccountId: c.cash, fromAmount: "1", date: "2026-10-24" }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      createTransfer(db, c.userId, { fromAccountId: c.cash, toAccountId: other.cash, fromAmount: "1", date: "2026-10-24" }),
    ).rejects.toMatchObject({ code: "not_found" });
    await setAccountArchived(db, c.userId, c.card, true);
    await expect(
      createTransfer(db, c.userId, { fromAccountId: c.cash, toAccountId: c.card, fromAmount: "1", date: "2026-10-24" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await db.transfer.count({ where: { userId: c.userId } })).toBe(0);
  });

  it("tahrirlash, o'chirish va undo balanslarni to'g'ri qayta hisoblaydi", async () => {
    const c = await setup();
    const { id } = await createTransfer(db, c.userId, {
      fromAccountId: c.cash,
      toAccountId: c.card,
      fromAmount: "100 000",
      date: "2026-10-24",
    });
    await updateTransfer(db, c.userId, id, {
      fromAccountId: c.cash,
      toAccountId: c.card,
      fromAmount: "250 000",
      date: "2026-10-24",
    });
    expect(await bal(c, c.cash)).toBe(parseMoney("750000", "UZS"));
    expect(await bal(c, c.card)).toBe(parseMoney("250000", "UZS"));

    await deleteTransfer(db, c.userId, id);
    expect(await bal(c, c.cash)).toBe(parseMoney("1000000", "UZS"));
    expect(await bal(c, c.card)).toBe(0n);

    await restoreTransfer(db, c.userId, id);
    expect(await bal(c, c.cash)).toBe(parseMoney("750000", "UZS"));
  });
});

describe("avtorizatsiya: ma'lumotlar faqat egasiga ko'rinadi", () => {
  it("begona foydalanuvchi tranzaksiyani ko'ra, o'zgartira va o'chira olmaydi", async () => {
    const a = await setup();
    const b = await setup();
    const r = await expense(a, "10 000");
    const id = r.status === "created" ? r.id : "";

    await expect(deleteTransaction(db, b.userId, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(restoreTransaction(db, b.userId, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(
      updateTransaction(db, b.userId, id, {
        type: "EXPENSE",
        accountId: b.cash,
        categoryId: null,
        amount: "1",
        date: "2026-10-24",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect((await listFeed(db, b.userId, {})).items).toHaveLength(0);
    expect((await listFeed(db, a.userId, {})).items).toHaveLength(1);
  });

  it("begona hisob yoki kategoriya bilan tranzaksiya yaratib bo'lmaydi", async () => {
    const a = await setup();
    const b = await setup();
    await expect(expense(a, "1000", { accountId: b.cash })).rejects.toMatchObject({ code: "not_found" });
    await expect(expense(a, "1000", { categoryId: b.food })).rejects.toMatchObject({ code: "not_found" });
    await expect(getAccount(db, a.userId, b.cash)).rejects.toMatchObject({ code: "not_found" });
    await expect(setAccountArchived(db, a.userId, b.cash, true)).rejects.toMatchObject({ code: "not_found" });
  });

  it("dashboard va balanslar faqat o'z ma'lumotlarini hisoblaydi", async () => {
    const a = await setup({ cashOpening: "1 000 000" });
    const b = await setup({ cashOpening: "7 000 000" });
    await expense(b, "1 000 000");
    const d = await getDashboard(db, a.userId, new Date("2026-10-24T08:00:00.000Z"));
    expect(d.balances.find((x) => x.currency === "UZS")!.balance).toBe(parseMoney("1000000", "UZS"));
    expect(d.month["UZS"]!.expense).toBe(0n);
  });
});

describe("hisoblar", () => {
  it("valyutani harakatlar bo'lgach o'zgartirib bo'lmaydi; harakatli hisobni o'chirib bo'lmaydi", async () => {
    const c = await setup();
    await expense(c, "1000");
    const acc = await getAccount(db, c.userId, c.cash);
    await expect(
      updateAccount(db, c.userId, c.cash, {
        name: acc.name,
        type: "CASH",
        currency: "USD",
        openingBalance: "0",
        color: "#10b981",
        icon: "wallet",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(deleteAccount(db, c.userId, c.cash)).rejects.toMatchObject({ code: "conflict" });
  });

  it("yangi hisob yaratish va harakatsiz hisobni o'chirish", async () => {
    const c = await setup();
    const acc = await createAccount(db, c.userId, {
      name: "Jamg‘arma",
      type: "SAVINGS",
      currency: "UZS",
      openingBalance: "2 000 000",
      color: "#84cc16",
      icon: "piggy-bank",
    });
    expect(acc.balance).toBe(parseMoney("2000000", "UZS"));
    await deleteAccount(db, c.userId, acc.id);
    expect((await listAccounts(db, c.userId)).some((a) => a.id === acc.id)).toBe(false);
  });

  it("oxirgi faol hisobni arxivlab bo'lmaydi", async () => {
    const { userId } = await registerUser(db, { name: "S", email: uniqueEmail(), password: "password123" }, { allowRegistration: true });
    await completeOnboarding(db, userId, {
      name: "S",
      primaryCurrency: "UZS",
      accounts: [{ name: "Yagona", type: "CASH", currency: "UZS", openingBalance: "0" }],
      goal: null,
    });
    const [only] = await listAccounts(db, userId);
    await expect(setAccountArchived(db, userId, only!.id, true)).rejects.toMatchObject({ code: "conflict" });
  });

  it("kategoriya nomi takrorlansa tushunarli xato beradi", async () => {
    const c = await setup();
    await expect(
      createCategory(db, c.userId, { name: "Oziq-ovqat", kind: "EXPENSE", color: "#ffffff", icon: "tag" }),
    ).rejects.toMatchObject({ code: "conflict", fields: { name: expect.any(String) } });
  });
});

describe("lenta: qidiruv, filtr, Toshkent kunlari", () => {
  it("sana bo'yicha filtr Toshkent kunlariga tayanadi (UTC emas)", async () => {
    const c = await setup();
    // 23:30 Toshkent = 18:30 UTC (hali shu kun); 00:30 Toshkent = 19:30 UTC (oldingi kuni UTC bo'yicha)
    await expense(c, "1 000", { date: "2026-10-23", time: "23:30", note: "kech" });
    await expense(c, "2 000", { date: "2026-10-24", time: "00:30", note: "erta" });

    const day23 = await listFeed(db, c.userId, { from: "2026-10-23", to: "2026-10-23" });
    const day24 = await listFeed(db, c.userId, { from: "2026-10-24", to: "2026-10-24" });
    expect(day23.items.map((i) => (i.kind === "tx" ? i.note : ""))).toEqual(["kech"]);
    expect(day24.items.map((i) => (i.kind === "tx" ? i.note : ""))).toEqual(["erta"]);
  });

  it("qidiruv izoh, kategoriya, hisob va teg bo'yicha; tur va hisob filtri; o'tkazmalar bilan", async () => {
    const c = await setup();
    await expense(c, "10 000", { note: "Tushlik osh", tags: ["ish"] });
    await expense(c, "20 000", { note: "Benzin", categoryId: c.transport });
    await createTransfer(db, c.userId, { fromAccountId: c.cash, toAccountId: c.card, fromAmount: "5 000", date: "2026-10-24", note: "kartaga" });

    expect((await listFeed(db, c.userId, { q: "osh" })).items).toHaveLength(1);
    expect((await listFeed(db, c.userId, { q: "Transport" })).items).toHaveLength(1);
    expect((await listFeed(db, c.userId, { q: "#ish" })).items).toHaveLength(1);
    expect((await listFeed(db, c.userId, { q: "kartaga" })).items.map((i) => i.kind)).toEqual(["transfer"]);
    expect((await listFeed(db, c.userId, { type: "TRANSFER" })).items).toHaveLength(1);
    expect((await listFeed(db, c.userId, { type: "EXPENSE" })).items).toHaveLength(2);
    expect((await listFeed(db, c.userId, { accountId: c.card })).items.map((i) => i.kind)).toEqual(["transfer"]);
    expect((await listFeed(db, c.userId, { categoryId: c.transport })).items).toHaveLength(1);
  });

  it("limit va hasMore", async () => {
    const c = await setup();
    for (let i = 1; i <= 5; i++) await expense(c, `${i}000`, { time: `0${i}:00`, note: `n${i}` });
    const page = await listFeed(db, c.userId, { limit: 3 });
    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(true);
    expect((await listFeed(db, c.userId, { limit: 10 })).hasMore).toBe(false);
    // eng yangisi birinchi
    expect(page.items[0]!.kind === "tx" && page.items[0]!.note).toBe("n5");
  });
});

describe("dashboard", () => {
  it("bugun/oy statistikasi, valyutalar alohida, top kategoriyalar va oylik dinamika", async () => {
    const c = await setup();
    const now = new Date("2026-10-24T08:00:00.000Z"); // Toshkent: 24-oktabr 13:00

    await createTransaction(db, c.userId, { type: "INCOME", accountId: c.cash, categoryId: c.salary, amount: "6 000 000", date: "2026-10-01", time: "09:00" });
    await expense(c, "300 000", { date: "2026-10-24", time: "09:00", note: "bozor" });
    await expense(c, "100 000", { date: "2026-10-10", categoryId: c.transport, note: "yo'l" });
    await expense(c, "50 000", { date: "2026-09-10", note: "o'tgan oy" });
    await expense(c, "5", { accountId: c.usd, categoryId: null, date: "2026-10-24", note: "usd" });

    const d = await getDashboard(db, c.userId, now);
    expect(d.primary).toBe("UZS");
    expect(d.todayKey).toBe("2026-10-24");
    expect(d.today["UZS"]!.expense).toBe(parseMoney("300000", "UZS"));
    expect(d.today["USD"]!.expense).toBe(500n);
    expect(d.month["UZS"]!.income).toBe(parseMoney("6000000", "UZS"));
    expect(d.month["UZS"]!.expense).toBe(parseMoney("400000", "UZS"));
    expect(d.month["UZS"]!.net).toBe(parseMoney("5600000", "UZS"));
    expect(d.prevMonth["UZS"]!.expense).toBe(parseMoney("50000", "UZS"));

    // Valyutalar aralashtirilmaydi
    expect(d.balances.map((b) => b.currency)).toEqual(["UZS", "USD"]);
    expect(d.balances[1]!.balance).toBe(9_500n);

    expect(d.topCategories.map((t) => t.name)).toEqual(["Oziq-ovqat", "Transport"]);
    expect(d.topCategories[0]!.sharePct).toBe(75);

    // Kunlik kumulyativ dinamika
    expect(d.spendSeries).toHaveLength(31);
    expect(d.spendSeries[9]!.current).toBe(Number(parseMoney("100000", "UZS")));
    expect(d.spendSeries[23]!.current).toBe(Number(parseMoney("400000", "UZS")));
    expect(d.spendSeries[24]!.current).toBeNull();
    expect(d.monthSpendToDate).toBe(parseMoney("400000", "UZS"));
    expect(d.prevMonthSpendToSameDay).toBe(parseMoney("50000", "UZS"));
    expect(d.recent.length).toBeGreaterThan(0);
    expect(d.summary.headline.length).toBeGreaterThan(0);
  });

  it("bo'sh holat: ma'lumot yo'q", async () => {
    const c = await setup();
    const d = await getDashboard(db, c.userId, new Date("2026-10-24T08:00:00.000Z"));
    expect(d.hasData).toBe(false);
    expect(d.summary.tone).toBe("empty");
    expect(d.topCategories).toEqual([]);
  });
});

describe("tez kiritish konteksti", () => {
  it("kategoriyalar ishlatilish chastotasi bo'yicha, oxirgi hisob va izoh takliflari", async () => {
    const c = await setup();
    const now = new Date("2026-10-24T08:00:00.000Z");
    await expense(c, "1000", { categoryId: c.transport, note: "Taksi", date: "2026-10-20" });
    await expense(c, "2000", { categoryId: c.transport, note: "taksi", date: "2026-10-21" });
    await expense(c, "3000", { categoryId: c.food, note: "Non", accountId: c.card, date: "2026-10-22" });

    const ctx = await getQuickAddContext(db, c.userId, now);
    expect(ctx.expenseCategories[0]!.id).toBe(c.transport);
    expect(ctx.hints[0]).toMatchObject({ note: expect.stringMatching(/taksi/i), count: 2, categoryId: c.transport });
    expect(ctx.lastAccountByType.EXPENSE).toBe(c.card);
    expect(ctx.accounts).toHaveLength(3);
  });
});
