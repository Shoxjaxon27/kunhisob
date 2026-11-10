import type { Db } from "../db";
import { AppError } from "../errors";
import { onboardingSchema } from "@/lib/validation";
import { seedDefaultCategories } from "./categories";
import { parseAmount, parseWith } from "./shared";

const ACCOUNT_STYLE = {
  CASH: { color: "#10b981", icon: "banknote" },
  CARD: { color: "#8b5cf6", icon: "credit-card" },
  SAVINGS: { color: "#84cc16", icon: "piggy-bank" },
  OTHER: { color: "#64748b", icon: "wallet" },
} as const;

/**
 * Birinchi sozlash: ism, asosiy valyuta, hisoblar (boshlang'ich balans bilan),
 * standart kategoriyalar va ixtiyoriy jamg'arma maqsadi. Hammasi bitta tranzaksiyada.
 */
export async function completeOnboarding(db: Db, userId: string, input: unknown): Promise<void> {
  const data = parseWith(onboardingSchema, input);

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("not_found", "Foydalanuvchi topilmadi");
  if (user.onboardedAt) throw new AppError("conflict", "Boshlang‘ich sozlash allaqachon bajarilgan");

  const accounts = data.accounts.map((a, i) => {
    const opening = parseAmount(a.openingBalance === "" ? "0" : a.openingBalance, a.currency, `accounts.${i}.openingBalance`, true);
    return { ...a, opening };
  });
  const goal = data.goal
    ? { ...data.goal, target: parseAmount(data.goal.target, data.goal.currency, "goal.target") }
    : null;

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name: data.name, onboardedAt: new Date() } });
    await tx.settings.upsert({
      where: { userId },
      update: { primaryCurrency: data.primaryCurrency },
      create: { userId, primaryCurrency: data.primaryCurrency },
    });
    let order = 0;
    for (const a of accounts) {
      const style = ACCOUNT_STYLE[a.type];
      await tx.account.create({
        data: {
          userId,
          name: a.name,
          type: a.type,
          currency: a.currency,
          openingBalance: a.opening,
          color: style.color,
          icon: style.icon,
          sortOrder: order++,
        },
      });
    }
    await seedDefaultCategories(tx, userId);
    if (goal) {
      // Maqsadlar bo'limi keyingi sprintda ochiladi; ma'lumot hozirdan saqlanadi.
      await tx.savingsGoal.create({
        data: { userId, name: goal.name, target: goal.target, currency: goal.currency },
      });
    }
  });
}
