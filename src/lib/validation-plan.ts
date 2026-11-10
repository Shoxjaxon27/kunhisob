import { z } from "zod";
import { CURRENCY_CODES, type CurrencyCode } from "@/domain/money";
import { isDayKey } from "@/domain/time";

/** Byudjet, qarz va maqsad formalari uchun sxemalar (Sprint 3). Summalar matn; serverda parseMoney bilan o'qiladi. */

const cuid = z.string().min(1).max(40);
const dayKey = z.string().refine(isDayKey, "Sana noto‘g‘ri");
const optionalDay = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isDayKey(v), "Sana noto‘g‘ri");
const moneyText = z.string().trim().min(1, "Summani kiriting").max(40, "Summa juda uzun");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Rang HEX ko‘rinishida bo‘lishi kerak");
const currency = z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]], {
  message: "Valyuta UZS yoki USD bo‘lishi kerak",
});

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Oy noto‘g‘ri");

export const budgetInputSchema = z.object({
  month: monthKeySchema,
  /** null — umumiy oylik byudjet */
  categoryId: cuid.nullable(),
  currency,
  limit: moneyText,
});
export type BudgetInput = z.infer<typeof budgetInputSchema>;

export const debtInputSchema = z.object({
  direction: z.enum(["LENT", "BORROWED"]),
  counterparty: z.string().trim().min(1, "Ism yoki tashkilotni kiriting").max(60, "60 belgidan oshmasin"),
  amount: moneyText,
  currency,
  /** Berilsa — pul shu hisobga ta'sir qiladi (valyuta hisobniki bo'lishi shart). */
  accountId: cuid.nullable(),
  startDate: dayKey,
  dueDate: optionalDay,
  note: z.string().trim().max(200, "Izoh 200 belgidan oshmasin").default(""),
});
export type DebtInput = z.infer<typeof debtInputSchema>;

export const debtPaymentSchema = z.object({
  debtId: cuid,
  accountId: cuid,
  amount: moneyText,
  date: dayKey,
  note: z.string().trim().max(200).default(""),
});
export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;

export const goalInputSchema = z.object({
  name: z.string().trim().min(1, "Maqsad nomini kiriting").max(60, "60 belgidan oshmasin"),
  target: moneyText,
  currency,
  deadline: optionalDay,
  monthlyPlan: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  color: hex,
});
export type GoalInput = z.infer<typeof goalInputSchema>;

export const goalContributionSchema = z.object({
  goalId: cuid,
  amount: moneyText,
  date: dayKey,
  note: z.string().trim().max(200).default(""),
});
export type GoalContributionInput = z.infer<typeof goalContributionSchema>;
