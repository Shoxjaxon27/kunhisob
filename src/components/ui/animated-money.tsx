"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatMoney, type CurrencyCode, type FormatOptions } from "@/domain/money";
import { usePrefs } from "@/components/providers";

type Props = {
  value: bigint;
  currency: CurrencyCode;
  sign?: FormatOptions["sign"];
  symbol?: boolean;
  className?: string;
  /** Birinchi chizishda 0 dan sanab chiqadi. */
  countUp?: boolean;
};

/**
 * Silliq o'zgaradigan summa. Animatsiya faqat ko'rsatish uchun: oxirgi kadrda aniq bigint qiymat
 * chiqadi. Ekran o'qish dasturlari uchun faqat yakuniy qiymat e'lon qilinadi.
 */
export function AnimatedMoney({ value, currency, sign, symbol = true, className, countUp = false }: Props) {
  const { motion: pref } = usePrefs();
  const systemReduced = useReducedMotion();
  const instant = pref === "OFF" || pref === "REDUCED" || systemReduced;
  const [display, setDisplay] = useState<bigint>(countUp && !instant ? 0n : value);
  const prev = useRef<bigint>(countUp && !instant ? 0n : value);

  useEffect(() => {
    if (instant || prev.current === value) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const from = Number(prev.current);
    const to = Number(value);
    const controls = animate(0, 1, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (p) => setDisplay(BigInt(Math.round(from + (to - from) * p))),
      onComplete: () => setDisplay(value),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, instant]);

  const opts = { sign, symbol };
  return (
    <>
      <span className={`num ${className ?? ""}`} aria-hidden="true">
        {formatMoney(display, currency, opts)}
      </span>
      <span className="sr-only">{formatMoney(value, currency, opts)}</span>
    </>
  );
}
