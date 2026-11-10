"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, Info } from "lucide-react";
import type { Pulse, PulseBand } from "@/domain/pulse";
import { PULSE_MIN_COMPONENTS } from "@/domain/pulse";
import { cn } from "@/lib/cn";

const BAND: Record<PulseBand, { text: string; label: string; stroke: string }> = {
  good: { text: "text-income", label: "Yaxshi", stroke: "stroke-income" },
  mid: { text: "text-warn", label: "O‘rtacha", stroke: "stroke-warn" },
  low: { text: "text-expense", label: "E’tibor kerak", stroke: "stroke-expense" },
};

const R = 52;
const C = 2 * Math.PI * R;

/** Ball yoyi: yakuniy uzunlik darhol hisoblanadi, animatsiya faqat ko'rinish uchun. */
function Ring({ score, band }: { score: number | null; band: PulseBand | null }) {
  const pct = score ?? 0;
  return (
    <svg viewBox="0 0 128 128" className="size-32 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="64" cy="64" r={R} fill="none" strokeWidth="10" className="stroke-sunken" />
      {score !== null && band && (
        <motion.circle
          cx="64" cy="64" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
          className={BAND[band].stroke}
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct / 100) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </svg>
  );
}

export function PulseCard({ pulse }: { pulse: Pulse }) {
  const [open, setOpen] = useState(false);
  const { score, band } = pulse;
  const b = band ? BAND[band] : null;

  return (
    <section className="card p-5" aria-labelledby="pulse-h">
      <div className="flex items-center justify-between gap-2">
        <h2 id="pulse-h" className="font-display text-lg font-semibold">Financial Pulse</h2>
        <span className="text-xs text-ink-3">Shu oy</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-5">
        <div className="relative grid size-32 place-items-center">
          <div className="absolute inset-0"><Ring score={score} band={band} /></div>
          <div className="relative text-center">
            {score !== null && b ? (
              <>
                <p className="num text-3xl font-semibold leading-none" aria-label={`Ball: ${score} dan 100`}>{score}</p>
                <p className={cn("mt-1 text-xs font-semibold", b.text)}>{b.label}</p>
              </>
            ) : (
              <p className="px-3 text-xs font-medium text-ink-3">Ball yo‘q</p>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 basis-56">
          {score === null ? (
            <p className="text-sm text-ink-2">
              Ball hisoblash uchun kamida {PULSE_MIN_COMPONENTS} ta ko‘rsatkich uchun ma’lumot kerak. Quyida nima yetishmayotgani ko‘rsatilgan.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {pulse.components.map((c) => (
                <li key={c.key}>
                  <Link href={c.href} className="block rounded-lg hover:bg-sunken/60">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{c.label}</span>
                      <span className="num text-xs font-semibold text-ink-2">{c.score}/100</span>
                    </div>
                    <p className="text-xs text-ink-3">{c.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {score === null && pulse.components.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-3">
          {pulse.components.map((c) => <li key={c.key}>✓ {c.label}: {c.detail}</li>)}
        </ul>
      )}
      {pulse.missing.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-3">
          {pulse.missing.map((m) => <li key={m.key}>— {m.label}: {m.reason}</li>)}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="pulse-how"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        <Info size={13} aria-hidden="true" /> Qanday hisoblanadi
        <ChevronDown size={13} aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id="pulse-how" className="mt-2 rounded-xl bg-sunken/60 p-3 text-xs leading-relaxed text-ink-2">
          <p>Ball — mavjud ko‘rsatkichlarning oddiy o‘rtachasi (0–100). Ma’lumoti yo‘q ko‘rsatkich hisobga olinmaydi. 75+ yaxshi, 50–74 o‘rtacha, 50 dan past — e’tibor kerak.</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Jamg‘arma: oy daromadidan saqlangan ulush; 20% va undan ko‘pi = 100.</li>
            <li>Byudjet: me‘yordagi = 100, limitga yaqin = 50, oshgan = 0 (o‘rtacha).</li>
            <li>Qarz: olingan ochiq qarzlarda har bir muddati o‘tgani −50.</li>
            <li>Zaxira: balans oxirgi 30 kun sur’atida necha kunga yetishi (taxmin); 90+ kun = 100.</li>
          </ul>
          <p className="mt-2">Faqat asosiy valyutadagi ma’lumot ishlatiladi. Bu moliyaviy maslahat emas, sizning yozuvlaringizga asoslangan oddiy ko‘rsatkich.</p>
        </div>
      )}
    </section>
  );
}
