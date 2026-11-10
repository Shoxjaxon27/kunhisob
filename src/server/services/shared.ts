import type { DbLike } from "../db";
import { AppError } from "../errors";
import { MoneyError, isCurrency, parseMoney, MAX_MINOR, type CurrencyCode } from "@/domain/money";
import type { ZodType } from "zod";
import { toFieldErrors } from "@/lib/validation";

export function parseWith<T>(schema: ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("validation", "Ma’lumotlar noto‘g‘ri", toFieldErrors(parsed.error));
  }
  return parsed.data;
}

/** Foydalanuvchi kiritgan summa matnini o'qiydi. `allowZero=false` bo'lsa 0 rad etiladi. */
export function parseAmount(text: string, currency: CurrencyCode, field: string, allowZero = false): bigint {
  try {
    const v = parseMoney(text, currency);
    if (!allowZero && v <= 0n) {
      throw new AppError("validation", "Summa noldan katta bo‘lsin", { [field]: "Summa noldan katta bo‘lsin" });
    }
    if (v > MAX_MINOR) {
      throw new AppError("validation", "Summa juda katta", { [field]: "Summa juda katta" });
    }
    return v;
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof MoneyError) {
      const messages: Record<string, string> = {
        empty: "Summani kiriting",
        negative: "Summa musbat bo‘lsin",
        too_many_decimals: "Kasr qismi ko‘pi bilan 2 xona bo‘lsin",
        too_large: "Summa juda katta",
        invalid: "Summa noto‘g‘ri kiritilgan",
        invalid_rate: "Kurs noto‘g‘ri",
      };
      const msg = messages[e.code] ?? "Summa noto‘g‘ri";
      throw new AppError("validation", msg, { [field]: msg });
    }
    throw e;
  }
}

export type ActiveAccount = { id: string; name: string; currency: CurrencyCode };

/** Foydalanuvchiga tegishli, arxivlanmagan hisobni qaytaradi. */
export async function loadActiveAccount(
  db: DbLike,
  userId: string,
  id: string,
  field = "accountId",
): Promise<ActiveAccount> {
  const acc = await db.account.findFirst({ where: { id, userId } });
  if (!acc) throw new AppError("not_found", "Hisob topilmadi", { [field]: "Hisob topilmadi" });
  if (acc.archivedAt) {
    throw new AppError("conflict", "Bu hisob arxivlangan", { [field]: "Hisob arxivlangan" });
  }
  if (!isCurrency(acc.currency)) {
    throw new AppError("internal", "Hisob valyutasi qo‘llab-quvvatlanmaydi");
  }
  return { id: acc.id, name: acc.name, currency: acc.currency };
}

export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const n = t.trim().replace(/^#+/, "").toLowerCase();
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}
