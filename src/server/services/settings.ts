import type { Db } from "../db";
import { AppError } from "../errors";
import { writeAudit } from "../audit";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import { settingsSchema } from "@/lib/validation";
import { parseWith } from "./shared";

export type SettingsDto = {
  name: string;
  email: string;
  primaryCurrency: CurrencyCode;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  motion: "FULL" | "REDUCED" | "OFF";
  locale: string;
  timezone: string;
};

export async function getSettings(db: Db, userId: string): Promise<SettingsDto> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { settings: true } });
  if (!user) throw new AppError("not_found", "Foydalanuvchi topilmadi");
  const s = user.settings;
  return {
    name: user.name,
    email: user.email,
    primaryCurrency: s && isCurrency(s.primaryCurrency) ? s.primaryCurrency : "UZS",
    theme: s?.theme ?? "SYSTEM",
    motion: s?.motion ?? "FULL",
    locale: s?.locale ?? "uz",
    timezone: s?.timezone ?? "Asia/Tashkent",
  };
}

export async function updateSettings(db: Db, userId: string, input: unknown): Promise<SettingsDto> {
  const data = parseWith(settingsSchema, input);
  const before = await getSettings(db, userId);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name: data.name } });
    await tx.settings.upsert({
      where: { userId },
      update: { primaryCurrency: data.primaryCurrency, theme: data.theme, motion: data.motion },
      create: { userId, primaryCurrency: data.primaryCurrency, theme: data.theme, motion: data.motion },
    });
    await writeAudit(tx, userId, "settings", userId, "update", before, {
      name: data.name,
      primaryCurrency: data.primaryCurrency,
      theme: data.theme,
      motion: data.motion,
    });
  });
  return getSettings(db, userId);
}
