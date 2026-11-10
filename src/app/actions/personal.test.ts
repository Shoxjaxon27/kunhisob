import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDb } from "@/server/test-utils";
import type { Db } from "@/server/db";
import { addPlan, finishPlan } from "./personal";

let db: Db;
let cleanup: () => Promise<void>;
let userId: string;
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/current", () => ({ requireOnboardedUser: async () => ({ id: userId }) }));
vi.mock("@/server/db", async importOriginal => ({
  ...await importOriginal<typeof import("@/server/db")>(), getDb: () => db,
}));

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
  const user = await db.user.create({ data: { email: "plan@test.local", name: "Test", passwordHash: "x" } });
  userId = user.id;
});
afterAll(async () => { await cleanup(); });

it("reja faqat bajarilganda haqiqiy summada bir marta hisobga yoziladi", async () => {
  const form = new FormData();
  form.set("title", "Uchrashuv");
  form.set("date", "2026-11-14");
  form.set("estimate", "150000");
  form.set("currency", "UZS");
  await addPlan(form);
  const plan = await db.personalPlan.findFirstOrThrow({ where: { userId } });
  expect(plan.estimate).toBe(15000000n);
  expect(await db.transaction.count()).toBe(0);
  form.set("id", plan.id);
  form.set("actual", "120000");
  await expect(finishPlan(form)).rejects.toThrow();
  expect((await db.personalPlan.findUniqueOrThrow({ where: { id: plan.id } })).completedAt).toBeNull();
  const account = await db.account.create({ data: { name: "Karta", currency: "UZS", userId } });
  form.set("account", account.id);
  await finishPlan(form);
  await finishPlan(form);
  const entries = await db.transaction.findMany({ where: { userId } });
  expect(entries).toHaveLength(1);
  expect(entries[0]?.amount).toBe(12000000n);
  expect((await db.personalPlan.findUniqueOrThrow({ where: { id: plan.id } })).transactionId).toBe(entries[0]?.id);
});
