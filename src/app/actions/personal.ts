"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { dayKeyOf, isDayKey } from "@/domain/time";
import { isCurrency, parseMoney } from "@/domain/money";
import { writeAudit } from "@/server/audit";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export async function savePayday(form: FormData) {
  const { id: userId } = await requireOnboardedUser();
  const payday = field(form, "payday");
  if (!isDayKey(payday) || payday <= dayKeyOf(new Date())) throw new Error("Kelajakdagi sanani tanlang");
  await getDb().settings.upsert({ where: { userId }, create: { userId, payday }, update: { payday } });
  revalidatePath("/");
}

export async function addPlan(form: FormData) {
  const { id: userId } = await requireOnboardedUser();
  const date = field(form, "date");
  const title = field(form, "title");
  const currency = field(form, "currency");
  if (!title || title.length > 120 || !isDayKey(date) || !isCurrency(currency)) throw new Error("Reja ma’lumotlarini tekshiring");
  const estimate = parseMoney(field(form, "estimate") || "0", currency);
  await getDb().personalPlan.create({ data: { userId, title, date, currency, estimate } });
  revalidatePath("/", "layout");
}

export async function finishPlan(form: FormData) {
  const { id: userId } = await requireOnboardedUser();
  const id = field(form, "id");
  await getDb().$transaction(async tx => {
    const claimed = await tx.personalPlan.updateMany({ where: { id, userId, completedAt: null }, data: { completedAt: new Date() } });
    if (!claimed.count) return;
    const plan = await tx.personalPlan.findUniqueOrThrow({ where: { id } });
    if (!isCurrency(plan.currency)) throw new Error("Valyuta topilmadi");
    const amount = parseMoney(field(form, "actual"), plan.currency);
    if (amount === 0n) return;
    const account = await tx.account.findFirstOrThrow({ where: { id: field(form, "account"), userId, archivedAt: null, currency: plan.currency } });
    const entry = await tx.transaction.create({ data: {
      userId, accountId: account.id, currency: account.currency, amount, note: plan.title,
      type: "EXPENSE", flow: "OUT", occurredAt: new Date(),
    } });
    await tx.personalPlan.update({ where: { id }, data: { transactionId: entry.id } });
    await writeAudit(tx, userId, "transaction", entry.id, "create", undefined, { planId: id, amount });
  });
  revalidatePath("/", "layout");
}

export async function cancelPlan(form: FormData) {
  const { id: userId } = await requireOnboardedUser();
  await getDb().personalPlan.deleteMany({ where: { id: field(form, "id"), userId, completedAt: null } });
  revalidatePath("/", "layout");
}
