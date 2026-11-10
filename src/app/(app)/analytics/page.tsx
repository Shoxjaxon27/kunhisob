import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getAnalytics } from "@/server/services/analytics";
import { getSettings } from "@/server/services/settings";
import { dayKeyOf, isDayKey, isRangePreset, rangeForPreset, type RangePreset } from "@/domain/time";
import { MAX_RANGE_DAYS, rangeDays } from "@/domain/analytics";
import { isCurrency, type CurrencyCode } from "@/domain/money";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireOnboardedUser();
  const sp = await searchParams;
  const db = getDb();
  const now = new Date();

  // Davr: preset yoki qo'lda kiritilgan sanalar; noto'g'ri qiymatlar jimgina "shu oy"ga qaytariladi.
  const presetRaw = one(sp.range);
  let preset: RangePreset | "custom" = isRangePreset(presetRaw) ? presetRaw : "this-month";
  const base: RangePreset = isRangePreset(presetRaw) ? presetRaw : "this-month";
  let { from, to } = rangeForPreset(base, now);
  const fromRaw = one(sp.from);
  const toRaw = one(sp.to);
  if (!presetRaw && isDayKey(fromRaw) && isDayKey(toRaw) && fromRaw <= toRaw && rangeDays(fromRaw, toRaw) <= MAX_RANGE_DAYS) {
    from = fromRaw;
    to = toRaw;
    preset = "custom";
  }

  const settings = await getSettings(db, user.id);
  const curRaw = one(sp.currency);
  const currency: CurrencyCode = isCurrency(curRaw) ? curRaw : settings.primaryCurrency;

  const data = await getAnalytics(db, user.id, { from, to, currency }, now);
  return <AnalyticsView data={data} preset={preset} todayKey={dayKeyOf(now)} />;
}
