"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Plus, Receipt, Wallet } from "lucide-react";
import { formatMoney, type CurrencyCode } from "@/domain/money";
import { percentChange } from "@/domain/insights";
import type { PeriodTotals } from "@/domain/ledger";
import type { DashboardData } from "@/server/services/dashboard";
import { AnimatedMoney } from "@/components/ui/animated-money";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuickAdd } from "@/components/quick-add/quick-add";
import { TxRow } from "@/components/transactions/tx-row";
import { SpendChart } from "./spend-chart";
import { CategoryBars } from "./category-bars";
import { PlanWidget } from "./plan-widget";
import { PulseCard } from "./pulse-card";
import { Reveal } from "@/components/ui/reveal";
import type { PulseData } from "@/server/services/pulse";
import type { PlanSummary } from "@/server/services/plan-summary";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

const ZERO: PeriodTotals = { income: 0n, expense: 0n, refunds: 0n, netExpense: 0n, net: 0n };

function Stat({
  label,
  value,
  currency,
  href,
  tone,
}: {
  label: string;
  value: bigint;
  currency: CurrencyCode;
  href: string;
  tone: "income" | "expense" | "neutral";
}) {
  return (
    <Link href={href} className="card card-hover block p-4">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tracking-tight",
          tone === "income" && "text-income",
          tone === "expense" && "text-expense",
        )}
      >
        <AnimatedMoney value={value} currency={currency} />
      </p>
    </Link>
  );
}

export function DashboardView({ data, plan, pulse, userName, greetingText, dateText }: {
  data: DashboardData;
  plan: PlanSummary;
  pulse: PulseData;
  userName: string;
  greetingText: string;
  dateText: string;
}) {
  const { open } = useQuickAdd();
  const { primary, todayKey, monthKey } = data;
  const monthStart = `${monthKey}-01`;
  const today = data.today[primary] ?? ZERO;
  const month = data.month[primary] ?? ZERO;
  const prev = data.prevMonth[primary] ?? ZERO;
  const change = percentChange(data.monthSpendToDate, data.prevMonthSpendToSameDay);

  const dayLink = (type: string) => `/transactions?type=${type}&from=${todayKey}&to=${todayKey}`;
  const monthLink = (type: string) => `/transactions?type=${type}&from=${monthStart}&to=${todayKey}`;

  const otherCurrencies = data.balances.filter((b) => b.currency !== primary);
  const primaryBalance = data.balances.find((b) => b.currency === primary);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-3">{dateText}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {greetingText}, {userName}
          </h1>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => open()}>
          <Plus size={18} aria-hidden="true" /> {t.nav.add}
          <kbd className="ml-1 hidden rounded border border-white/30 px-1 text-[0.7rem] sm:inline">N</kbd>
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        {/* Hero balans */}
        <section className="card relative overflow-hidden p-6 lg:col-span-2" aria-labelledby="bal-h">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
          <h2 id="bal-h" className="flex items-center gap-2 text-sm font-medium text-ink-2">
            <Wallet size={16} aria-hidden="true" /> Umumiy balans · {primary}
          </h2>
          <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            <AnimatedMoney value={primaryBalance?.balance ?? 0n} currency={primary} countUp />
          </p>
          <p className="mt-1 text-sm text-ink-3">
            {primaryBalance ? `${primaryBalance.accountCount} ta hisob` : "Bu valyutada hisob yo‘q"}
          </p>
          {otherCurrencies.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {otherCurrencies.map((b) => (
                <li key={b.currency} className="chip">
                  <span className="text-ink-3">{b.currency}</span>
                  <AnimatedMoney value={b.balance} currency={b.currency} className="font-semibold" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-ink-3">Valyutalar aralashtirilmaydi: kurs taxmin qilinmaydi.</p>
        </section>

        {/* Kunlik xulosa */}
        <section className="card p-6" aria-labelledby="sum-h">
          <h2 id="sum-h" className="text-sm font-medium text-ink-2">Bugungi xulosa</h2>
          <p className="mt-2 font-display text-lg font-semibold leading-snug">{data.summary.headline}</p>
          <p className="mt-1 text-sm text-ink-2">{data.summary.detail}</p>
        </section>
      </div>

      {/* Ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bugun · xarajat" value={today.netExpense} currency={primary} href={dayLink("EXPENSE")} tone="expense" />
        <Stat label="Bugun · daromad" value={today.income} currency={primary} href={dayLink("INCOME")} tone="income" />
        <Stat label="Oy · xarajat" value={month.netExpense} currency={primary} href={monthLink("EXPENSE")} tone="expense" />
        <Stat label="Oy · daromad" value={month.income} currency={primary} href={monthLink("INCOME")} tone="income" />
      </div>

      <Reveal index={1}><PulseCard pulse={pulse.pulse} /></Reveal>

      {!data.hasData ? (
        <section className="card">
          <EmptyState
            icon={Receipt}
            title="Hali yozuv yo‘q"
            description="Birinchi xarajat yoki daromadingizni qo‘shing — grafiklar va xulosa shundan keyin paydo bo‘ladi."
            action={
              <button type="button" className="btn btn-primary" onClick={() => open()}>
                <Plus size={18} aria-hidden="true" /> Birinchi yozuvni qo‘shish
              </button>
            }
          />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <section className="card p-5 lg:col-span-2" aria-labelledby="chart-h">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="chart-h" className="font-display text-lg font-semibold">Oylik xarajat dinamikasi</h2>
              <p className="text-xs text-ink-3">
                <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-accent" aria-hidden="true" /> Joriy oy</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-ink-3" aria-hidden="true" /> Oldingi oy</span>
              </p>
            </div>
            <p className="mb-2 text-sm text-ink-2">
              Oy boshidan: <strong className="num">{formatMoney(data.monthSpendToDate, primary)}</strong>
              {change !== null && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-ink-3">
                  {change >= 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
                  {change >= 0 ? "+" : "−"}{Math.abs(change)}% oldingi oyning shu kuniga nisbatan
                </span>
              )}
              {change === null && prev.netExpense === 0n && (
                <span className="ml-2 text-ink-3">· taqqoslash uchun oldingi oy ma’lumoti yo‘q</span>
              )}
            </p>
            <SpendChart data={data.spendSeries} currency={primary} />
          </section>

          <section className="card p-5 lg:self-start" aria-labelledby="cat-h">
            <h2 id="cat-h" className="mb-4 font-display text-lg font-semibold">Kategoriyalar · oy</h2>
            {data.topCategories.length === 0 ? (
              <p className="text-sm text-ink-3">Bu oyda xarajat yo‘q.</p>
            ) : (
              <CategoryBars items={data.topCategories} currency={primary} monthStart={monthStart} today={todayKey} />
            )}
          </section>
        </div>
      )}

      <PlanWidget plan={plan} todayKey={todayKey} />

      <Reveal index={3} className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <section className="card p-5 lg:col-span-2" aria-labelledby="rec-h">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="rec-h" className="font-display text-lg font-semibold">So‘nggi harakatlar</h2>
            <Link href="/transactions" className="text-sm font-medium text-accent hover:underline">Hammasi</Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">Hali harakat yo‘q.</p>
          ) : (
            <div className="-mx-2">
              {data.recent.map((it) => (
                <TxRow key={`${it.kind}-${it.id}`} item={it} compact />
              ))}
            </div>
          )}
        </section>

        <section className="card p-5" aria-labelledby="acc-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="acc-h" className="font-display text-lg font-semibold">Hisoblar</h2>
            <Link href="/accounts" className="text-sm font-medium text-accent hover:underline">Boshqarish</Link>
          </div>
          <ul className="space-y-1">
            {data.accounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/transactions?accountId=${a.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sunken/70"
                >
                  <span className="grid size-9 place-items-center rounded-full text-white" style={{ background: a.color }} aria-hidden="true">
                    <Icon name={a.icon} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.name}</span>
                    <span className="block text-xs text-ink-3">{t.accountType[a.type] ?? a.type}</span>
                  </span>
                  <span className="num text-sm font-semibold">{formatMoney(a.balance, a.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>
    </div>
  );
}
