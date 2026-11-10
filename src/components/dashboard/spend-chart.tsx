"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, type CurrencyCode } from "@/domain/money";
import { compactMoney } from "@/lib/format";
import { usePrefs } from "@/components/providers";
import type { SpendPoint } from "@/server/services/dashboard";

type TipProps = {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string | null }>;
  label?: string | number;
  currency: CurrencyCode;
};

function Tip({ active, payload, label, currency }: TipProps) {
  if (!active || !payload?.length) return null;
  const val = (key: string) => {
    const p = payload.find((x) => x.dataKey === key)?.value;
    return typeof p === "number" ? formatMoney(Math.round(p), currency) : "—";
  };
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="mb-1 font-semibold">{label}-kun</p>
      <p className="num text-ink">Joriy oy: <strong>{val("current")}</strong></p>
      <p className="num text-ink-3">Oldingi oy: {val("previous")}</p>
    </div>
  );
}

/** Joriy va oldingi oyning kunlik kumulyativ sof xarajati. Chiziq turi (to'liq/uzuq) rangdan mustaqil farq qiladi. */
export function SpendChart({ data, currency }: { data: SpendPoint[]; currency: CurrencyCode }) {
  const { motion } = usePrefs();
  const animate = motion === "FULL";
  return (
    <div className="h-60 w-full" role="img" aria-label="Oy davomida kunlik kumulyativ xarajat grafigi: joriy oy to‘liq chiziq, oldingi oy uzuq chiziq">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.32 }} />
              <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            width={84}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
            tickFormatter={(v: number) => compactMoney(v, currency)}
          />
          <Tooltip content={<Tip currency={currency} />} cursor={{ stroke: "var(--line-strong)" }} />
          <Area
            type="monotone"
            dataKey="previous"
            stroke="var(--ink-3)"
            strokeWidth={1.75}
            strokeDasharray="5 5"
            fill="none"
            dot={false}
            isAnimationActive={animate}
            animationDuration={500}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="current"
            stroke="var(--accent)"
            strokeWidth={2.5}
            fill="url(#spendFill)"
            dot={false}
            activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={animate}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
