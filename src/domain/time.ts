/**
 * Asia/Tashkent vaqti bilan ishlash.
 *
 * O'zbekiston 1991-yildan beri yozgi vaqtga o'tmaydi (doim UTC+5), shuning uchun
 * ruxsat etilgan sana arifmetikasi uchun qat'iy ofset ishlatamiz.
 * Ma'lumotlar bazasida barcha vaqtlar UTC instant sifatida saqlanadi.
 * "Kun" kaliti — "YYYY-MM-DD" (Toshkent kuni), "oy" kaliti — "YYYY-MM".
 */

export const APP_TIMEZONE = "Asia/Tashkent";
export const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
] as const;

export const UZ_WEEKDAYS = [
  "yakshanba",
  "dushanba",
  "seshanba",
  "chorshanba",
  "payshanba",
  "juma",
  "shanba",
] as const;

export const UZ_WEEKDAYS_SHORT = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"] as const;

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(value: string): boolean {
  const m = DAY_KEY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** UTC instant → Toshkent kuni ("YYYY-MM-DD"). */
export function dayKeyOf(date: Date): string {
  return new Date(date.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthKeyOf(date: Date): string {
  return dayKeyOf(date).slice(0, 7);
}

/** Toshkent kunining boshlanishi (UTC instant). */
export function startOfDay(dayKey: string): Date {
  if (!isDayKey(dayKey)) throw new RangeError(`Noto'g'ri kun kaliti: ${dayKey}`);
  return new Date(Date.parse(`${dayKey}T00:00:00.000Z`) - TZ_OFFSET_MS);
}

export function addDays(dayKey: string, days: number): string {
  const t = Date.parse(`${dayKey}T00:00:00.000Z`) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** [start, end) — kun oralig'i. `toKey` kiritilsa, shu kun ham kiradi. */
export function dayRange(fromKey: string, toKey: string = fromKey): { start: Date; end: Date } {
  return { start: startOfDay(fromKey), end: startOfDay(addDays(toKey, 1)) };
}

export function monthRange(monthKey: string): { start: Date; end: Date; firstDay: string; lastDay: string; days: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) throw new RangeError(`Noto'g'ri oy kaliti: ${monthKey}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const firstDay = `${m[1]}-${m[2]}-01`;
  const nextFirst = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  const lastDay = addDays(nextFirst, -1);
  const days = Number(lastDay.slice(8, 10));
  return { start: startOfDay(firstDay), end: startOfDay(nextFirst), firstDay, lastDay, days };
}

export function addMonths(monthKey: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) throw new RangeError(`Noto'g'ri oy kaliti: ${monthKey}`);
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** Foydalanuvchi kiritgan Toshkent sanasi va vaqti ("2026-10-24", "10:31") → UTC instant. */
export function fromLocalInputs(dayKey: string, time: string = "00:00"): Date {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) throw new RangeError(`Noto'g'ri vaqt: ${time}`);
  return new Date(startOfDay(dayKey).getTime() + (Number(m[1]) * 60 + Number(m[2])) * 60 * 1000);
}

export function toLocalInputs(date: Date): { date: string; time: string } {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

export function weekdayOf(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00.000Z`).getUTCDay();
}

export function formatTime(date: Date): string {
  return toLocalInputs(date).time;
}

/** "24-oktabr" */
export function formatDayShort(dayKey: string): string {
  const mo = Number(dayKey.slice(5, 7)) - 1;
  return `${Number(dayKey.slice(8, 10))}-${UZ_MONTHS[mo]}`;
}

/** "Bugun", "Kecha" yoki "24-oktabr, juma" (boshqa yilda yil bilan). */
export function formatDayLabel(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return "Bugun";
  if (dayKey === addDays(todayKey, -1)) return "Kecha";
  const base = `${formatDayShort(dayKey)}, ${UZ_WEEKDAYS[weekdayOf(dayKey)]}`;
  return dayKey.slice(0, 4) === todayKey.slice(0, 4) ? base : `${dayKey.slice(0, 4)}-yil ${base}`;
}

export function formatMonthLabel(monthKey: string): string {
  const mo = Number(monthKey.slice(5, 7)) - 1;
  return `${monthKey.slice(0, 4)}-yil ${UZ_MONTHS[mo]}`;
}

export type RangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this-month"
  | "last-month"
  | "year";

export const RANGE_PRESETS: readonly RangePreset[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "this-month",
  "last-month",
  "year",
];

export function isRangePreset(v: string): v is RangePreset {
  return (RANGE_PRESETS as readonly string[]).includes(v);
}

/** Preset → kun kalitlari oralig'i (ikkala chekka ham kiradi). */
export function rangeForPreset(preset: RangePreset, now: Date): { from: string; to: string } {
  const today = dayKeyOf(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "this-month": {
      const r = monthRange(today.slice(0, 7));
      return { from: r.firstDay, to: today };
    }
    case "last-month": {
      const r = monthRange(addMonths(today.slice(0, 7), -1));
      return { from: r.firstDay, to: r.lastDay };
    }
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}
