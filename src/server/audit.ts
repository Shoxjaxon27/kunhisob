import type { DbLike } from "./db";

function toJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
}

/**
 * O'zgarishlar tarixi. Maxfiy ma'lumotlar (parol, token) bu yerga HECH QACHON uzatilmaydi.
 * Tahrirlash, o'chirish va tiklashlar shu yerda qayd etiladi.
 */
export async function writeAudit(
  db: DbLike,
  userId: string,
  entity: "transaction" | "transfer" | "account" | "category" | "settings" | "budget" | "debt" | "debt_payment" | "goal" | "goal_contribution",
  entityId: string,
  action: "create" | "update" | "delete" | "restore" | "archive" | "unarchive" | "copy",
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId,
      entity,
      entityId,
      action,
      before: before === undefined ? null : toJson(before),
      after: after === undefined ? null : toJson(after),
    },
  });
}
