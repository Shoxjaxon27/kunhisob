import { AppError } from "./errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string>; code?: string };

/**
 * Server action tanasini o'raydi: AppError — foydalanuvchiga tushunarli xabar,
 * boshqa xatolar — umumiy xabar (ichki tafsilot va maxfiy ma'lumotlar logga yozilmaydi).
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) {
      return { ok: false, error: e.message, fields: e.fields, code: e.code };
    }
    // Faqat xato turi va xabari: kiruvchi ma'lumotlar, parol, token yozilmaydi.
    const name = e instanceof Error ? e.name : "UnknownError";
    const message = e instanceof Error ? e.message.slice(0, 300) : "";
    console.error(`[action] kutilmagan xato: ${name}: ${message}`);
    return { ok: false, error: "Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring.", code: "internal" };
  }
}
