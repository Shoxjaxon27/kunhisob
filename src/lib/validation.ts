import { z } from "zod";
import { CURRENCY_CODES, isCurrency, tryParseMoney, type CurrencyCode } from "@/domain/money";
import { isDayKey } from "@/domain/time";

/**
 * Kiruvchi ma'lumotlar sxemalari. Brauzer (forma) va server (action) uchun umumiy.
 * Summalar matn ko'rinishida keladi va valyutaga qarab serverda `parseMoney` bilan o'qiladi.
 */

export const ACCOUNT_ICONS = ["wallet", "banknote", "credit-card", "piggy-bank", "landmark", "briefcase", "coins", "smartphone"] as const;
export const CATEGORY_ICONS = [
  "shopping-basket",
  "car",
  "home",
  "wifi",
  "heart-pulse",
  "shirt",
  "graduation-cap",
  "clapperboard",
  "utensils",
  "gift",
  "users",
  "tag",
  "briefcase",
  "banknote",
  "trending-up",
  "sparkles",
] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Rang HEX ko‘rinishida bo‘lishi kerak");
const cuid = z.string().min(1).max(40);
const dayKey = z.string().refine(isDayKey, "Sana noto‘g‘ri");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqt SS:DD ko‘rinishida bo‘lsin");

export const currencySchema = z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]], {
  message: "Valyuta UZS yoki USD bo‘lishi kerak",
});

const moneyText = z.string().trim().min(1, "Summani kiriting").max(40, "Summa juda uzun");

// ───────────────────────── Hisob ─────────────────────────

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, "Hisob nomini kiriting").max(40, "Nom 40 belgidan oshmasin"),
  type: z.enum(["CASH", "CARD", "SAVINGS", "OTHER"]),
  currency: currencySchema,
  openingBalance: z.string().trim().max(40).default("0"),
  color: hexColor,
  icon: z.enum(ACCOUNT_ICONS),
});
export type AccountInput = z.infer<typeof accountInputSchema>;

// ───────────────────────── Kategoriya ─────────────────────────

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Kategoriya nomini kiriting").max(40, "Nom 40 belgidan oshmasin"),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: hexColor,
  icon: z.enum(CATEGORY_ICONS),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

// ───────────────────────── Tranzaksiya ─────────────────────────

const tags = z
  .array(z.string().trim().min(1).max(24, "Teg 24 belgidan oshmasin"))
  .max(8, "Ko‘pi bilan 8 ta teg")
  .default([]);

export const transactionInputSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "REFUND"]),
  accountId: cuid,
  categoryId: cuid.nullable().default(null),
  amount: moneyText,
  date: dayKey,
  time: time.default("00:00"),
  note: z.string().trim().max(200, "Izoh 200 belgidan oshmasin").default(""),
  tags,
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const adjustmentInputSchema = z.object({
  accountId: cuid,
  actualBalance: z.string().trim().min(1, "Haqiqiy balansni kiriting").max(40),
  date: dayKey,
  time: time.default("00:00"),
  note: z.string().trim().max(200).default(""),
});
export type AdjustmentInput = z.infer<typeof adjustmentInputSchema>;

export const transferInputSchema = z.object({
  fromAccountId: cuid,
  toAccountId: cuid,
  fromAmount: moneyText,
  /** Valyutalar har xil bo'lsa majburiy: kurs o'ylab topilmaydi. */
  toAmount: z.string().trim().max(40).optional(),
  date: dayKey,
  time: time.default("00:00"),
  note: z.string().trim().max(200).default(""),
});
export type TransferInput = z.infer<typeof transferInputSchema>;

// ───────────────────────── Auth ─────────────────────────

export const emailSchema = z.string().trim().toLowerCase().email("Email noto‘g‘ri").max(120);
export const passwordSchema = z
  .string()
  .min(8, "Parol kamida 8 belgidan iborat bo‘lsin")
  .max(200, "Parol juda uzun");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Ismingizni kiriting").max(60),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Parolni kiriting").max(200),
});

export const changePasswordSchema = z.object({
  current: z.string().min(1, "Joriy parolni kiriting").max(200),
  next: passwordSchema,
});

// ───────────────────────── Onboarding va sozlamalar ─────────────────────────

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Ismingizni kiriting").max(60),
  primaryCurrency: currencySchema,
  accounts: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Hisob nomini kiriting").max(40),
        type: z.enum(["CASH", "CARD", "SAVINGS", "OTHER"]),
        currency: currencySchema,
        openingBalance: z.string().trim().max(40).default("0"),
      }),
    )
    .min(1, "Kamida bitta hisob kerak")
    .max(10),
  goal: z
    .object({
      name: z.string().trim().min(1).max(60),
      target: moneyText,
      currency: currencySchema,
    })
    .nullable()
    .default(null),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const settingsSchema = z.object({
  name: z.string().trim().min(1, "Ismingizni kiriting").max(60),
  primaryCurrency: currencySchema,
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]),
  motion: z.enum(["FULL", "REDUCED", "OFF"]),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

// ───────────────────────── Ro'yxat filtrlari ─────────────────────────

export const FEED_TYPES = ["INCOME", "EXPENSE", "REFUND", "ADJUSTMENT", "TRANSFER"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

export type FieldErrors = Record<string, string>;

/** Zod xatolarini { maydon: xabar } ko'rinishiga keltiradi. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Summa matnini tekshiradi (forma uchun tezkor tekshiruv). */
export function isValidMoneyText(text: string, currency: CurrencyCode): boolean {
  if (!isCurrency(currency)) return false;
  const v = tryParseMoney(text, currency);
  return v !== null;
}
