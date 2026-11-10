"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { formatMoney, type CurrencyCode } from "@/domain/money";
import type { TopCategory } from "@/server/services/dashboard";

/** Eng ko'p sarflangan kategoriyalar. Har bir qatorda nom, summa va foiz matn bilan beriladi (rangga tayanmaydi). */
export function CategoryBars({
  items,
  currency,
  monthStart,
  today,
}: {
  items: TopCategory[];
  currency: CurrencyCode;
  monthStart: string;
  today: string;
}) {
  return (
    <ul className="space-y-4">
      {items.map((c, i) => {
        const href = c.id
          ? `/transactions?categoryId=${c.id}&from=${monthStart}&to=${today}`
          : `/transactions?type=EXPENSE&from=${monthStart}&to=${today}`;
        return (
          <li key={c.id ?? `rest-${i}`}>
            <Link href={href} className="group block rounded-xl outline-offset-4">
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden="true" />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="num shrink-0 text-ink-2">
                  <strong className="text-ink">{formatMoney(c.amount, currency)}</strong> · {c.sharePct.toFixed(c.sharePct % 1 === 0 ? 0 : 1)}%
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-sunken" role="presentation">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: c.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(c.sharePct, 1.5)}%` }}
                  transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
