import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { createTestDb, uniqueEmail } from "./test-utils";

/**
 * Migratsiya SQL i Prisma sxemasi bilan mos ekanini tekshiradi: har bir model uchun
 * bitta yozuv yaratiladi (Sprint 3+ modellari ham). Ustun/jadval nomi mos kelmasa — test yiqiladi.
 */
let db: Db;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => {
  await cleanup();
});

describe("sxema va migratsiya mosligi", () => {
  it("barcha modellar yoziladi va o'qiladi", async () => {
    const user = await db.user.create({ data: { email: uniqueEmail(), name: "S", passwordHash: "x" } });
    const userId = user.id;
    const now = new Date("2026-10-24T05:00:00.000Z");

    await db.settings.create({ data: { userId } });
    await db.session.create({ data: { userId, tokenHash: "h1", expiresAt: now } });
    const account = await db.account.create({ data: { userId, name: "A", currency: "UZS", openingBalance: 123n } });
    const account2 = await db.account.create({ data: { userId, name: "B", currency: "USD" } });
    const category = await db.category.create({ data: { userId, name: "C", kind: "EXPENSE" } });
    const tag = await db.tag.create({ data: { userId, name: "t" } });

    const rule = await db.recurringRule.create({
      data: {
        userId,
        accountId: account.id,
        categoryId: category.id,
        type: "EXPENSE",
        amount: 100n,
        currency: "UZS",
        frequency: "MONTHLY",
        startsOn: now,
        nextRunAt: now,
      },
    });
    const tx = await db.transaction.create({
      data: {
        userId,
        accountId: account.id,
        categoryId: category.id,
        type: "EXPENSE",
        flow: "OUT",
        amount: 9_007_199_254_740_993n, // Number.MAX_SAFE_INTEGER dan katta — BigInt aniq saqlanishi kerak
        currency: "UZS",
        occurredAt: now,
        recurringId: rule.id,
        tags: { connect: { id: tag.id } },
      },
      include: { tags: true },
    });
    expect(tx.amount).toBe(9_007_199_254_740_993n);
    expect(tx.tags).toHaveLength(1);

    const refund = await db.transaction.create({
      data: {
        userId,
        accountId: account.id,
        type: "REFUND",
        flow: "IN",
        amount: 1n,
        currency: "UZS",
        occurredAt: now,
        refundOfId: tx.id,
      },
    });
    expect(refund.refundOfId).toBe(tx.id);

    await db.transfer.create({
      data: {
        userId,
        fromAccountId: account.id,
        toAccountId: account2.id,
        fromAmount: 100n,
        toAmount: 1n,
        fromCurrency: "UZS",
        toCurrency: "USD",
        rate: "0.01",
        occurredAt: now,
      },
    });
    await db.budget.create({ data: { userId, month: "2026-10", categoryId: category.id, currency: "UZS", limit: 1000n } });
    const debt = await db.debt.create({
      data: { userId, direction: "LENT", counterparty: "Ali", principal: 500n, currency: "UZS", startDate: now },
    });
    await db.debtPayment.create({ data: { debtId: debt.id, accountId: account.id, amount: 100n, paidAt: now } });
    const goal = await db.savingsGoal.create({ data: { userId, name: "Mashina", target: 1_000_000n, currency: "UZS" } });
    await db.goalContribution.create({ data: { goalId: goal.id, amount: 10n, contributedAt: now } });
    await db.dailyNote.create({ data: { userId, date: "2026-10-24", content: "n" } });
    await db.notification.create({ data: { userId, kind: "budget", title: "t", dedupeKey: "k1" } });
    await db.auditLog.create({ data: { userId, entity: "transaction", entityId: tx.id, action: "create" } });

    expect(await db.dailyNote.count({ where: { userId } })).toBe(1);
  });

  it("noyob cheklovlar ishlaydi (email, kategoriya nomi, kundalik qayd, bildirishnoma)", async () => {
    const u = await db.user.create({ data: { email: uniqueEmail(), name: "U", passwordHash: "x" } });
    await expect(
      db.user.create({ data: { email: u.email, name: "U2", passwordHash: "x" } }),
    ).rejects.toMatchObject({ code: "P2002" });

    await db.category.create({ data: { userId: u.id, name: "Bir", kind: "EXPENSE" } });
    await expect(db.category.create({ data: { userId: u.id, name: "Bir", kind: "EXPENSE" } })).rejects.toMatchObject({
      code: "P2002",
    });
    // Boshqa turda bir xil nom mumkin
    await expect(db.category.create({ data: { userId: u.id, name: "Bir", kind: "INCOME" } })).resolves.toBeTruthy();
  });

  it("tashqi kalit cheklovlari: harakatli hisobni o'chirib bo'lmaydi, foydalanuvchi o'chsa hammasi o'chadi", async () => {
    const u = await db.user.create({ data: { email: uniqueEmail(), name: "U", passwordHash: "x" } });
    const acc = await db.account.create({ data: { userId: u.id, name: "A", currency: "UZS" } });
    await db.transaction.create({
      data: { userId: u.id, accountId: acc.id, type: "INCOME", flow: "IN", amount: 1n, currency: "UZS", occurredAt: new Date() },
    });
    await expect(db.account.delete({ where: { id: acc.id } })).rejects.toBeTruthy();
    await db.user.delete({ where: { id: u.id } });
    expect(await db.account.count({ where: { userId: u.id } })).toBe(0);
    expect(await db.transaction.count({ where: { userId: u.id } })).toBe(0);
  });
});
