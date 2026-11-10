import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, PiggyBank, Target } from "lucide-react";
import { formatMoney } from "@/domain/money";
import { daysUntil } from "@/domain/planning";
import type { PlanSummary } from "@/server/services/plan-summary";
import { ProgressBar } from "@/components/ui/progress";

const BUDGET_TEXT = { ok: "Me’yorda", warn: "Limitga yaqin", over: "Limitdan oshdi" } as const;

/** Bosh sahifadagi qisqa reja xulosasi: faqat haqiqiy ma'lumot bo'lsa chiziladi. */
export function PlanWidget({ plan, todayKey }: { plan: PlanSummary; todayKey: string }) {
  if (plan.budgets.length === 0 && plan.dueDebts.length === 0 && plan.goals.length === 0) return null;
  return (
    <section className="card p-5" aria-labelledby="plan-h">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="plan-h" className="font-display text-lg font-semibold">Reja</h2>
        <Link href="/plan" className="text-sm font-medium text-accent hover:underline">Hammasi</Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-3 [&>*]:min-w-0">
        {plan.budgets.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-2"><PiggyBank size={15} aria-hidden="true" /> Byudjet</h3>
            <ul className="space-y-3">
              {plan.budgets.map((b) => (
                <li key={b.id}>
                  <Link href="/plan/budgets" className="block">
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                      <span className="truncate font-medium">{b.category?.name ?? "Umumiy"}</span>
                      <span className="num shrink-0 text-xs text-ink-2">{formatMoney(b.spent, b.currency)} / {formatMoney(b.limit, b.currency)}</span>
                    </div>
                    <ProgressBar pct={b.progress.pct} tone={b.progress.status} label={`${b.category?.name ?? "Umumiy"} byudjeti`} valueText={`${b.progress.pct}%, ${BUDGET_TEXT[b.progress.status]}`} />
                    {b.progress.status !== "ok" && (
                      <p className={b.progress.status === "over" ? "mt-1 flex items-center gap-1 text-xs font-semibold text-expense" : "mt-1 flex items-center gap-1 text-xs font-semibold text-warn"}>
                        <AlertTriangle size={12} aria-hidden="true" /> {BUDGET_TEXT[b.progress.status]}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan.dueDebts.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-2">Qarz muddatlari</h3>
            <ul className="space-y-2">
              {plan.dueDebts.map((d) => {
                const n = d.dueKey ? daysUntil(d.dueKey, todayKey) : 0;
                return (
                  <li key={d.id}>
                    <Link href="/plan/debts" className="flex items-center gap-2 text-sm">
                      {d.direction === "LENT" ? <ArrowUpRight size={15} className="shrink-0 text-income" aria-hidden="true" /> : <ArrowDownLeft size={15} className="shrink-0 text-expense" aria-hidden="true" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{d.counterparty}</span>
                        <span className={d.due === "overdue" ? "text-xs font-semibold text-expense" : "text-xs font-semibold text-warn"}>
                          {d.due === "overdue" ? `${-n} kun o‘tgan` : n === 0 ? "Bugun" : `${n} kun qoldi`}
                        </span>
                      </span>
                      <span className="num shrink-0 text-xs font-semibold">{formatMoney(d.remaining, d.currency)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {plan.goals.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-2"><Target size={15} aria-hidden="true" /> Maqsadlar</h3>
            <ul className="space-y-3">
              {plan.goals.map((g) => (
                <li key={g.id}>
                  <Link href="/plan/goals" className="block">
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="num shrink-0 text-xs text-ink-2">{g.progress.pct.toFixed(g.progress.pct % 1 === 0 ? 0 : 1)}%</span>
                    </div>
                    <ProgressBar pct={g.progress.pct} color={g.color} label={`${g.name} maqsadi`} valueText={`${g.progress.pct}% to‘plandi`} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
