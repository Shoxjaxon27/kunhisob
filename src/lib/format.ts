import { CURRENCIES, type CurrencyCode } from "@/domain/money";
import { UZ_MONTHS, UZ_WEEKDAYS, toLocalInputs } from "@/domain/time";

/** Grafik o'qlari uchun ixcham summa ("1,2 mln", "350 ming"). Faqat ko'rsatish uchun. */
export function compactMoney(minor: number, currency: CurrencyCode): string {
  const major = minor / 10 ** CURRENCIES[currency].minorUnit;
  const abs = Math.abs(major);
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", currency === "USD" ? "." : ",");
  if (currency === "USD") {
    if (abs >= 1_000_000) return `${fmt(major / 1_000_000)}M`;
    if (abs >= 1_000) return `${fmt(major / 1_000)}k`;
    return fmt(major);
  }
  if (abs >= 1_000_000_000) return `${fmt(major / 1_000_000_000)} mlrd`;
  if (abs >= 1_000_000) return `${fmt(major / 1_000_000)} mln`;
  if (abs >= 1_000) return `${fmt(major / 1_000)} ming`;
  return fmt(major);
}

/** Toshkent soatiga qarab salomlashish. */
export function greeting(now: Date): string {
  const h = Number(toLocalInputs(now).time.slice(0, 2));
  if (h < 5) return "Xayrli tun";
  if (h < 12) return "Xayrli tong";
  if (h < 18) return "Xayrli kun";
  return "Xayrli kech";
}

/** "Shanba, 24-oktabr" */
export function longDate(dayKey: string): string {
  const wd = UZ_WEEKDAYS[new Date(`${dayKey}T00:00:00.000Z`).getUTCDay()] ?? "";
  const mo = UZ_MONTHS[Number(dayKey.slice(5, 7)) - 1] ?? "";
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${Number(dayKey.slice(8, 10))}-${mo}`;
}
