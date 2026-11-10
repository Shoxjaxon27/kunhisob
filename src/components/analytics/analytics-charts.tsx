"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, type CurrencyCode } from "@/domain/money";
import { compactMoney } from "@/lib/format";
import { usePrefs } from "@/components/providers";
import type { BalancePoint, FlowPoint } from "@/server/services/analytics";
import type { WeekdayStat } from "@/domain/analytics";

const AXIS = { fill: "var(--ink-3)", fontSize: 11 } as const;

type Row = Record<string, number | string | null>;
type TipProps = {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string | null }>;
  label?: string | number;
  currency: CurrencyCode;
  lines: Array<{ key: string; name: string }>;
};

function Tip({ active, payload, label, currency, lines }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="mb-1 font-semibold">{label}</p>
      {lines.map((l) => {
        const v = payload.find((p) => p.dataKey === l.key)?.value;
        return (
          <p key={l.key} className="num">
            {l.name}: <strong>{typeof v === "number" ? formatMoney(Math.round(v), currency) : "—"}</strong>
          </p>
        );
      })}
    </div>
  );
}

function useAnimate() {
  return usePrefs().motion === "FULL";
}

/** Kirim va chiqim ustunlari. Rangdan tashqari ustunlar ketma-ketligi va legenda matni bilan farqlanadi. */
export function FlowChart({ data, currency }: { data: FlowPoint[]; currency: CurrencyCode }) {
  const animate = useAnimate();
  const rows: Row[] = data.map((p) => ({
    label: p.label,
    income: Number(p.income),
    expense: Math.max(Number(p.netExpense), 0),
  }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Davr bo‘yicha daromad va sof xarajat ustunli grafigi. Jadval ko‘rinishi pastda.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" minTickGap={16} />
          <YAxis width={84} tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(v: number) => compactMoney(v, currency)} />
          <Tooltip
            cursor={{ fill: "var(--sunken)", opacity: 0.6 }}
            content={<Tip currency={currency} lines={[{ key: "income", name: "Daromad" }, { key: "expense", name: "Xarajat" }]} />}
          />
          <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} isAnimationActive={animate} maxBarSize={22} />
          <Bar dataKey="expense" fill="var(--expense)" radius={[4, 4, 0, 0]} isAnimationActive={animate} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceChart({ data, currency }: { data: BalancePoint[]; currency: CurrencyCode }) {
  const animate = useAnimate();
  const rows: Row[] = data.map((p) => ({ label: p.label, balance: Number(p.balance) }));
  return (
    <div className="h-56 w-full" role="img" aria-label="Davr davomida umumiy balans dinamikasi grafigi">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.28 }} />
              <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" minTickGap={16} />
          <YAxis width={84} tickLine={false} axisLine={false} tick={AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => compactMoney(v, currency)} />
          <Tooltip cursor={{ stroke: "var(--line-strong)" }} content={<Tip currency={currency} lines={[{ key: "balance", name: "Balans" }]} />} />
          <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2.5} fill="url(#balFill)" dot={false} activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={animate} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Hafta kunlari bo'yicha o'rtacha sarf; eng yuqori ustun to'qroq. */
export function WeekdayChart({ stats, currency }: { stats: WeekdayStat[]; currency: CurrencyCode }) {
  const animate = useAnimate();
  const max = stats.reduce((m, s) => (s.average > m ? s.average : m), 0n);
  const rows: Row[] = stats.map((s) => ({ label: s.label, average: Number(s.average) }));
  return (
    <div className="h-52 w-full" role="img" aria-label="Hafta kunlari bo‘yicha o‘rtacha xarajat grafigi">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis width={84} tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(v: number) => compactMoney(v, currency)} />
          <Tooltip cursor={{ fill: "var(--sunken)", opacity: 0.6 }} content={<Tip currency={currency} lines={[{ key: "average", name: "O‘rtacha" }]} />} />
          <Bar dataKey="average" radius={[4, 4, 0, 0]} isAnimationActive={animate} maxBarSize={36}>
            {stats.map((s) => (
              <Cell key={s.index} fill={max > 0n && s.average === max ? "var(--expense)" : "var(--ink-3)"} fillOpacity={max > 0n && s.average === max ? 1 : 0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
