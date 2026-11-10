import Link from "next/link";
import { savePayday } from "@/app/actions/personal";
import { addDays, formatDayShort, startOfDay, dayRange, monthRange, formatMonthLabel } from "@/domain/time";
import { formatMoney, type CurrencyCode } from "@/domain/money";
import { getDb } from "@/server/db";
import { dayKeyOf } from "@/domain/time";
import { PurchaseCheck } from "./purchase-check";
import { Banknote, CalendarDays, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { ExpenseButton } from "./expense-button";

export async function TodayBudget({ userId, today, balance, currency, payday }: {
  userId: string; today: string; balance: bigint; currency: CurrencyCode; payday: string | null;
}) {
  const db = getDb();
  const { start, end } = dayRange(today);
  const monthKey = today.slice(0, 7);
  const month = monthRange(monthKey);
  const openPlans = { userId, completedAt: null };
  const [savings, plannedSum, debtRows, todayPlans, next, dailyRows, monthlyRows] = await Promise.all([
    db.goalContribution.aggregate({ where: { goal: { userId, currency, archivedAt: null } }, _sum: { amount: true } }),
    payday ? db.personalPlan.aggregate({ where: { ...openPlans, currency, date: { lt: payday } }, _sum: { estimate: true } }) : null,
    db.debt.findMany({ where: { userId, direction: "BORROWED", status: { not: "PAID" }, dueDate: { not: null } },
      select: { counterparty: true, principal: true, currency: true, dueDate: true, payments: { select: { amount: true } } },
      orderBy: { dueDate: "asc" } }),
    db.personalPlan.findMany({ where: { ...openPlans, date: today }, select: { id: true, title: true } }),
    db.personalPlan.findFirst({ where: { ...openPlans, date: { gt: today } }, orderBy: { date: "asc" }, select: { date: true, title: true } }),
    db.transaction.groupBy({ by: ["type"], where: { userId, currency, type: { in: ["INCOME", "EXPENSE"] }, deletedAt: null, occurredAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.transaction.groupBy({
      by: ["type"],
      where: { userId, currency, deletedAt: null, type: { in: ["INCOME", "EXPENSE"] }, occurredAt: { gte: month.start, lt: month.end } },
      _sum: { amount: true },
    }),
  ]);
  const amountFor = (rows: typeof dailyRows, type: "INCOME" | "EXPENSE") => rows.find(row => row.type === type)?._sum.amount ?? 0n;
  const monthFilter = `from=${month.firstDay}&to=${month.lastDay}`;
  const debts = debtRows.map(d => ({ ...d, dueKey: dayKeyOf(d.dueDate!),
    remaining: d.principal - d.payments.reduce((sum, payment) => sum + payment.amount, 0n) })).filter(d => d.remaining > 0n);
  const nextDebt = debts[0];
  const days = payday ? (startOfDay(payday).getTime() - startOfDay(today).getTime()) / 86400000 : 0;
  const reserved = savings._sum.amount ?? 0n;
  const planned = plannedSum?._sum.estimate ?? 0n;
  const due = debts.filter(d => d.currency === currency && payday && d.dueKey < payday).reduce((sum, d) => sum + d.remaining, 0n);
  const free = balance - reserved - planned - due;
  const money = (amount: bigint) => formatMoney(amount, currency);
  return <div className="mx-auto max-w-5xl space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-ink-3">{formatDayShort(today)}</p><h1 className="font-display text-3xl font-semibold">Bugun</h1></div>
      <ExpenseButton />
    </header>
    <section aria-label="Bugungi kirim va chiqim" className="grid gap-3 sm:grid-cols-2">
      <Link href={`/transactions?type=INCOME&from=${today}&to=${today}`} className="card stat-tile">
        <ArrowDownLeft aria-hidden="true" /><div><span>Bugungi daromad</span><strong>{money(amountFor(dailyRows, "INCOME"))}</strong></div>
      </Link>
      <Link href={`/transactions?type=EXPENSE&from=${today}&to=${today}`} className="card stat-tile">
        <ArrowUpRight aria-hidden="true" /><div><span>Bugungi xarajat</span><strong>{money(amountFor(dailyRows, "EXPENSE"))}</strong></div>
      </Link>
    </section>
    <section aria-labelledby="month-summary" className="space-y-3">
      <h2 id="month-summary" className="font-display text-xl font-semibold">{formatMonthLabel(monthKey)}</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        <Link href={`/transactions?type=INCOME&${monthFilter}`} className="card stat-tile">
          <ArrowDownLeft aria-hidden="true" /><div><span>Shu oydagi daromad</span><strong>{money(amountFor(monthlyRows, "INCOME"))}</strong></div>
        </Link>
        <Link href={`/transactions?type=EXPENSE&${monthFilter}`} className="card stat-tile">
          <ArrowUpRight aria-hidden="true" /><div><span>Shu oydagi xarajat</span><strong>{money(amountFor(monthlyRows, "EXPENSE"))}</strong></div>
        </Link>
        <Link href="/accounts" className="card stat-tile">
          <Banknote aria-hidden="true" /><div><span>Hisobdagi qoldiq</span><strong>{money(balance)}</strong></div>
        </Link>
      </div>
    </section>
    <section className="card budget-hero space-y-4 p-6 sm:p-8">
      <h2 className="font-semibold">Bir kunga qancha pulim bor?</h2>
      {days > 0 && payday ? <>
        <p className="font-display text-4xl font-semibold tracking-tight text-accent sm:text-5xl">{money(free > 0n ? free / BigInt(days) : 0n)}</p>
        <p>{formatDayShort(payday)}gacha {days} kun uchun kunlik o‘rtacha.</p>
        {free < 0n && <p className="text-expense">Rejalaringiz uchun {money(-free)} yetishmayapti.</p>}
        <details><summary className="cursor-pointer">Bu summa qanday hisoblandi?</summary>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <dt>Hisoblardagi pul</dt><dd>{money(balance)}</dd>
            <dt>Maqsadga ajratilgan</dt><dd>{money(reserved)}</dd>
            <dt>Rejadagi xarajatlar</dt><dd>{money(planned)}</dd>
            <dt>Muddati keladigan qarzlar</dt><dd>{money(due)}</dd>
            <dt>Erkin mablag‘</dt><dd>{money(free)}</dd>
          </dl>
        </details></> : <p>Kunlik summani hisoblash uchun keyingi maosh sanasini kiriting.</p>}
      <details open={days <= 0}><summary className="cursor-pointer text-accent">Maosh sanasini belgilash</summary>
        <form action={savePayday} className="mt-3 flex flex-wrap items-end gap-3">
          <label>Keyingi maosh<input className="field" name="payday" type="date" min={addDays(today, 1)} defaultValue={days > 0 ? payday! : ""} required /></label>
          <button className="btn btn-primary">Saqlash</button>
        </form>
      </details>
    </section>
    {days > 0 && <PurchaseCheck free={free} days={days} currency={currency} />}
    <section className="card space-y-2 p-5"><CalendarDays size={20} className="text-accent" aria-hidden="true" /><h2 className="font-semibold">Bugungi rejalar</h2>
      {todayPlans.length ? <ul>{todayPlans.map(p => <li key={p.id}>{p.title}</li>)}</ul> : <p>Bugunga reja kiritilmagan.</p>}
      {next && <p>Keyingi reja · {formatDayShort(next.date)} · {next.title}</p>}
      {nextDebt?.dueKey && <p>Qarz to‘lovi · {formatDayShort(nextDebt.dueKey)} · {nextDebt.counterparty} · {formatMoney(nextDebt.remaining, nextDebt.currency === "USD" ? "USD" : "UZS")}</p>}
      <Link href="/plans" className="text-accent underline">Rejalarni ochish</Link>
    </section>
  </div>;
}
