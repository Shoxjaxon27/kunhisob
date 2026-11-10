"use client";

import { useState } from "react";
import { formatMoney, tryParseMoney, type CurrencyCode } from "@/domain/money";

export function PurchaseCheck({ free, days, currency }: { free: bigint; days: number; currency: CurrencyCode }) {
  const [value, setValue] = useState("");
  const price = tryParseMoney(value, currency);
  const remaining = price === null ? null : free - price;
  return <details className="card p-5">
    <summary className="cursor-pointer font-semibold">Bu xarid budjetimga sig‘adimi?</summary>
    <div className="mt-4 grid items-end gap-4 sm:grid-cols-2">
      <label>Xarid narxi ({currency})<input className="field" inputMode="decimal" placeholder="Masalan, 150 000" value={value} onChange={event => setValue(event.target.value)} /></label>
      <p aria-live="polite" className="text-sm text-ink-2">{value.trim() && (remaining === null ? "Summani raqam bilan kiriting." :
        remaining < 0n ? `Xarid uchun ${formatMoney(-remaining, currency)} yetishmaydi.` :
        `Xariddan keyin maoshgacha kuniga ${formatMoney(remaining / BigInt(days), currency)} qoladi.`)}</p>
    </div>
  </details>;
}
