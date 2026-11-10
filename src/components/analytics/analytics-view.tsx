"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, BarChart3, Download, Lightbulb, TriangleAlert } from "lucide-react";
import { formatMoney, type CurrencyCode } from "@/domain/money";
import { formatDayShort, type RangePreset } from "@/domain/time";
import type { AnalyticsData } from "@/server/services/analytics";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { BalanceChart, FlowChart, WeekdayChart } from "./analytics-charts";

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "7d", label: "7 kun" },
  { id: "30d", label: "30 kun" },
  { id: "this-month", label: "Shu oy" },
  { id: "last-month", label: "O‘tgan oy" },
  { id: "year", label: "Shu yil" },
];

const pctText = (n: number) => `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;

/** O'zgarish ko'rsatkichi: yo'nalish strelka va ishora bilan beriladi (rang yagona belgi emas). */
function Delta({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null) return <span className="text-xs text-ink-3">oldingi davrda ma’lumot yo‘q</span>;
  if (value === 0) return <span className="text-xs text-ink-3">oldingi davr bilan bir xil</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", good ? "text-income" : "text-expense")}>
      <Arrow size={13} aria-hidden="true" />
      {up ? "+" : "−"}{pctText(Math.abs(value))}
      <span className="ml-1 font-normal text-ink-3">oldingi davrga nisbatan</span>
    </span>
  );
}

function Kpi({ label, value, children, tone }: { label: string; value: string; children?: React.ReactNode; tone?: "income" | "expense" }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className={cn("num mt-1 text-xl font-semibold tracking-tight", tone === "income" && "text-income", tone === "expense" && "text-expense")}>{value}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function AnalyticsView({ data, preset, todayKey }: { data: AnalyticsData; preset: RangePreset | "custom"; todayKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const { from, to, currency, days, elapsedDays } = data.query;
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const go = (params: Record<string, string>) => {
    const p = new URLSearchParams(params);
    startTransition(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const withCurrency = (extra: Record<string, string>, cur: CurrencyCode = currency) => ({ ...extra, currency: cur });
  const rangeParams = (): Record<string, string> => (preset === "custom" ? { from, to } : { range: preset });

  const t = data.totals;
  const flowTotal = t.net;
  const customValid = customFrom && customTo && customFrom <= customTo;
  const customChanged = customFrom !== from || customTo !== to || preset !== "custom";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Tahlil</h1>
          <p className="mt-1 text-sm text-ink-2">
            {formatDayShort(from)} — {formatDayShort(to)} · {days} kun{from.slice(0, 4) !== to.slice(0, 4) || from.slice(0, 4) !== todayKey.slice(0, 4) ? ` · ${from.slice(0, 4)}${from.slice(0, 4) !== to.slice(0, 4) ? `–${to.slice(0, 4)}` : ""}` : ""}
          </p>
        </div>
        <a href={`/api/export?from=${from}&to=${to}`} className="btn btn-sm" download>
          <Download size={15} aria-hidden="true" /> CSV yuklab olish
        </a>
      </header>

      <section className="card space-y-3 p-4" aria-label="Davr va valyuta">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Davr">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={preset === p.id} onClick={() => go(withCurrency({ range: p.id }))}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-3">
            Boshlanish
            <input type="date" className="field mt-1" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label className="text-xs text-ink-3">
            Tugash
            <input type="date" className="field mt-1" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
          <button type="button" className="btn btn-sm" disabled={!customValid || !customChanged} onClick={() => go(withCurrency({ from: customFrom, to: customTo }))}>
            Qo‘llash
          </button>
          {data.currencies.length > 1 && (
            <div className="ml-auto flex gap-2" role="group" aria-label="Valyuta">
              {data.currencies.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={currency === c} onClick={() => go(withCurrency(rangeParams(), c))}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className={cn("space-y-5 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {!data.hasData ? (
          <section className="card">
            <EmptyState icon={BarChart3} title="Bu davrda yozuv yo‘q" description={`${currency} bo‘yicha tanlangan davrda daromad yoki xarajat topilmadi. Boshqa davrni tanlang.`} />
          </section>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Daromad" value={formatMoney(t.income, currency)} tone="income">
                <Delta value={data.incomeChangePct} goodWhenUp />
              </Kpi>
              <Kpi label="Sof xarajat" value={formatMoney(t.netExpense, currency)} tone="expense">
                <Delta value={data.expenseChangePct} goodWhenUp={false} />
              </Kpi>
              <Kpi label="Sof oqim (daromad − xarajat)" value={formatMoney(flowTotal, currency, { sign: "always" })} tone={flowTotal >= 0n ? "income" : "expense"}>
                <span className="text-xs text-ink-3">
                  {data.savingsRatePct === null ? "Daromad yo‘q — jamg‘arma darajasi hisoblanmaydi" : `Jamg‘arma darajasi: ${pctText(data.savingsRatePct)}`}
                </span>
              </Kpi>
              <Kpi label="Kunlik o‘rtacha xarajat" value={formatMoney(data.avgDailySpend, currency)}>
                <span className="text-xs text-ink-3">
                  {elapsedDays < days ? `${elapsedDays} o‘tgan kun bo‘yicha` : `${days} kun bo‘yicha`}
                  {data.prevAvgDailySpend > 0n ? ` · oldingi: ${formatMoney(data.prevAvgDailySpend, currency)}` : ""}
                </span>
              </Kpi>
            </div>

            {data.insights.length > 0 && (
              <section className="card p-4" aria-label="Xulosalar">
                <ul className="space-y-2">
                  {data.insights.map((i) => (
                    <li key={i.text} className="flex items-start gap-2 text-sm">
                      {i.tone === "warn" ? (
                        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
                      ) : (
                        <Lightbulb size={16} className={cn("mt-0.5 shrink-0", i.tone === "good" ? "text-income" : "text-accent")} aria-hidden="true" />
                      )}
                      <span>{i.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card p-5" aria-labelledby="flow-h">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="flow-h" className="font-display text-lg font-semibold">Daromad va xarajat</h2>
                <p className="flex gap-3 text-xs text-ink-3">
                  <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-income" aria-hidden="true" /> Daromad (chapdagi ustun)</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-expense" aria-hidden="true" /> Sof xarajat (o‘ngdagi ustun)</span>
                </p>
              </div>
              <FlowChart data={data.flow} currency={currency} />
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-accent">Jadval ko‘rinishi</summary>
                <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-sunken text-left text-xs text-ink-3">
                      <tr><th className="px-3 py-2 font-medium">Davr</th><th className="px-3 py-2 text-right font-medium">Daromad</th><th className="px-3 py-2 text-right font-medium">Sof xarajat</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.flow.map((p) => (
                        <tr key={p.key}>
                          <td className="px-3 py-1.5">{p.from === p.to ? formatDayShort(p.from) : `${formatDayShort(p.from)} – ${formatDayShort(p.to)}`}</td>
                          <td className="num px-3 py-1.5 text-right">{formatMoney(p.income, currency)}</td>
                          <td className="num px-3 py-1.5 text-right">{formatMoney(p.netExpense, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>

            <section className="card p-5" aria-labelledby="bal-h">
              <h2 id="bal-h" className="mb-1 font-display text-lg font-semibold">Balans dinamikasi · {currency}</h2>
              <p className="mb-3 text-xs text-ink-3">Shu valyutadagi barcha hisoblar yig‘indisi (o‘tkazmalar va qarzlar ham hisobda).</p>
              <BalanceChart data={data.balance} currency={currency} />
            </section>

            <div className="grid items-start gap-5 lg:grid-cols-2 [&>*]:min-w-0">
              <section className="card p-5" aria-labelledby="cat-h">
                <h2 id="cat-h" className="mb-4 font-display text-lg font-semibold">Xarajat kategoriyalari</h2>
                {data.categories.length === 0 ? (
                  <p className="text-sm text-ink-3">Bu davrda xarajat yo‘q.</p>
                ) : (
                  <ul className="space-y-4">
                    {data.categories.map((c) => (
                      <li key={c.id ?? "rest"}>
                        <Link href={c.id ? `/transactions?categoryId=${c.id}&from=${from}&to=${to}` : `/transactions?type=EXPENSE&from=${from}&to=${to}`} className="block rounded-xl outline-offset-4">
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2 font-semibold">
                              <span className="grid size-6 shrink-0 place-items-center rounded-full text-white" style={{ background: c.color }} aria-hidden="true"><Icon name={c.icon} size={12} /></span>
                              <span className="truncate">{c.name}</span>
                            </span>
                            <span className="num shrink-0 text-ink-2"><strong className="text-ink">{formatMoney(c.amount, currency)}</strong> · {pctText(c.sharePct)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-sunken" role="presentation">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(c.sharePct, 1.5)}%`, background: c.color }} />
                          </div>
                          {c.id !== null && <div className="mt-1"><Delta value={c.changePct} goodWhenUp={false} /></div>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="space-y-5">
                <section className="card p-5" aria-labelledby="inc-h">
                  <h2 id="inc-h" className="mb-4 font-display text-lg font-semibold">Daromad manbalari</h2>
                  {data.incomeSources.length === 0 ? (
                    <p className="text-sm text-ink-3">Bu davrda daromad yo‘q.</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.incomeSources.map((s) => (
                        <li key={s.id ?? "none"}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2 font-semibold"><span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" /><span className="truncate">{s.name}</span></span>
                            <span className="num shrink-0 text-ink-2"><strong className="text-ink">{formatMoney(s.amount, currency)}</strong> · {pctText(s.sharePct)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-sunken" role="presentation"><div className="h-full rounded-full" style={{ width: `${Math.max(s.sharePct, 1.5)}%`, background: s.color }} /></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="card p-5" aria-labelledby="wd-h">
                  <h2 id="wd-h" className="mb-1 font-display text-lg font-semibold">Hafta kunlari bo‘yicha</h2>
                  <p className="mb-3 text-xs text-ink-3">
                    O‘rtacha sof xarajat{data.busiestWeekday && data.busiestWeekday.average > 0n ? ` · eng yuqori: ${data.busiestWeekday.label} (${formatMoney(data.busiestWeekday.average, currency)})` : ""}
                  </p>
                  <WeekdayChart stats={data.weekdays} currency={currency} />
                </section>
              </div>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-2 [&>*]:min-w-0">
              <section className="card p-5" aria-labelledby="top-h">
                <h2 id="top-h" className="mb-3 font-display text-lg font-semibold">Eng yirik xarajatlar</h2>
                {data.topExpenses.length === 0 ? <p className="text-sm text-ink-3">Xarajat yo‘q.</p> : (
                  <ol className="divide-y divide-line">
                    {data.topExpenses.map((e, i) => (
                      <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-ink-2">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{e.note || e.category || "Xarajat"}</span>
                          <span className="block truncate text-xs text-ink-3">{[e.category, formatDayShort(e.dayKey)].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="num shrink-0 font-semibold text-expense">{formatMoney(-e.amount, currency)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="card p-5" aria-labelledby="notes-h">
                <h2 id="notes-h" className="mb-3 font-display text-lg font-semibold">Eng ko‘p sarflangan joylar</h2>
                {data.topNotes.length === 0 ? <p className="text-sm text-ink-3">Izohli xarajat yo‘q — izoh yozsangiz, bu yerda guruhlanadi.</p> : (
                  <ul className="divide-y divide-line">
                    {data.topNotes.map((n) => (
                      <li key={n.note}>
                        <Link href={`/transactions?q=${encodeURIComponent(n.note)}&from=${from}&to=${to}`} className="flex items-center gap-3 py-2.5 text-sm">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{n.note}</span>
                            <span className="text-xs text-ink-3">{n.count} marta</span>
                          </span>
                          <span className="num shrink-0 font-semibold">{formatMoney(n.total, currency)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-ink-3">
        Sof xarajat = xarajat − qaytim. O‘tkazmalar, qarz harakatlari va balans tuzatishlar daromad/xarajatga kirmaydi.
        Valyutalar aralashtirilmaydi — har biri alohida ko‘rsatiladi.
      </p>
    </div>
  );
}
