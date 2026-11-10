"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Plus, Trash2 } from "lucide-react";
import { formatMoney, minorToInput, type CurrencyCode } from "@/domain/money";
import { dayKeyOf, formatDayShort } from "@/domain/time";
import { daysUntil } from "@/domain/planning";
import type { DebtDto, DebtTotals } from "@/server/services/debts";
import {
  addDebtPaymentAction,
  createDebtAction,
  deleteDebtAction,
  deleteDebtPaymentAction,
} from "@/app/actions/plan";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormError } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/cn";
import { useSubmit } from "./use-submit";

type Acc = { id: string; name: string; currency: CurrencyCode };

type DebtForm = {
  direction: "LENT" | "BORROWED";
  counterparty: string;
  amount: string;
  currency: CurrencyCode;
  accountId: string;
  startDate: string;
  dueDate: string;
  note: string;
};
type PayForm = { debt: DebtDto; accountId: string; amount: string; date: string; note: string };

const DIR_LABEL = { LENT: "Men berdim", BORROWED: "Men oldim" } as const;

function dueText(d: DebtDto, todayKey: string): { text: string; cls: string } | null {
  if (!d.dueKey || d.status === "PAID") return null;
  const n = daysUntil(d.dueKey, todayKey);
  if (d.due === "overdue") return { text: `Muddat o‘tgan: ${-n} kun (${formatDayShort(d.dueKey)})`, cls: "bg-expense-soft text-expense" };
  if (d.due === "soon") return { text: n === 0 ? "Muddat: bugun" : `Muddatga ${n} kun qoldi`, cls: "bg-warn-soft text-warn" };
  return { text: `Muddat: ${formatDayShort(d.dueKey)}`, cls: "bg-sunken text-ink-2" };
}

export function DebtsView({
  debts,
  totals,
  todayKey,
  accounts,
}: {
  debts: DebtDto[];
  totals: DebtTotals;
  todayKey: string;
  accounts: Acc[];
}) {
  const toast = useToast();
  const create = useSubmit();
  const pay = useSubmit();
  const [form, setForm] = useState<DebtForm | null>(null);
  const [payForm, setPayForm] = useState<PayForm | null>(null);
  const [confirm, setConfirm] = useState<DebtDto | null>(null);
  const [delPay, setDelPay] = useState<{ debt: DebtDto; id: string } | null>(null);

  const open = debts.filter((d) => d.status !== "PAID");
  const closed = debts.filter((d) => d.status === "PAID");
  const accountsFor = (c: CurrencyCode) => accounts.filter((a) => a.currency === c);
  const currencies = [...new Set(accounts.map((a) => a.currency))];

  const openNew = () => {
    create.reset();
    const currency = currencies[0] ?? "UZS";
    setForm({
      direction: "LENT", counterparty: "", amount: "", currency,
      accountId: accountsFor(currency)[0]?.id ?? "", startDate: todayKey, dueDate: "", note: "",
    });
  };

  const saveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const res = await create.submit(() =>
      createDebtAction({ ...form, accountId: form.accountId || null }),
    );
    if (res.ok) {
      toast({ message: "Qarz qayd etildi", tone: "success" });
      setForm(null);
    }
  };

  const openPay = (d: DebtDto) => {
    pay.reset();
    setPayForm({
      debt: d,
      accountId: accountsFor(d.currency)[0]?.id ?? "",
      amount: minorToInput(d.remaining, d.currency),
      date: todayKey,
      note: "",
    });
  };

  const savePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm) return;
    const res = await pay.submit(() =>
      addDebtPaymentAction({ debtId: payForm.debt.id, accountId: payForm.accountId, amount: payForm.amount, date: payForm.date, note: payForm.note }),
    );
    if (res.ok) {
      toast({ message: "To‘lov qayd etildi", tone: "success" });
      setPayForm(null);
    }
  };

  const removeDebt = async () => {
    if (!confirm) return;
    const res = await deleteDebtAction(confirm.id);
    setConfirm(null);
    toast(res.ok ? { message: "Qarz o‘chirildi", tone: "success" } : { message: res.error, tone: "error" });
  };
  const removePay = async () => {
    if (!delPay) return;
    const res = await deleteDebtPaymentAction(delPay.id);
    setDelPay(null);
    toast(res.ok ? { message: "To‘lov o‘chirildi", tone: "success" } : { message: res.error, tone: "error" });
  };

  const card = (d: DebtDto) => {
    const pct = Number((d.paid * 1000n) / d.principal) / 10;
    const lent = d.direction === "LENT";
    const due = dueText(d, todayKey);
    return (
      <li key={d.id} className={cn("card p-5", d.status === "PAID" && "opacity-75")}>
        <div className="flex items-start gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", lent ? "bg-income-soft text-income" : "bg-expense-soft text-expense")} aria-hidden="true">
            {lent ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{d.counterparty}</p>
            <p className="text-xs text-ink-3">
              {DIR_LABEL[d.direction]} · {formatDayShort(d.startKey)}{d.movedMoney ? "" : " · hisobga ta’sir qilmagan"}
            </p>
          </div>
          {d.status === "PAID" ? (
            <span className="shrink-0 rounded-full bg-income-soft px-2.5 py-1 text-xs font-semibold text-income">Yopilgan</span>
          ) : due ? (
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", due.cls)}>{due.text}</span>
          ) : null}
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-sm">
          <strong className="num text-xl">{formatMoney(d.remaining, d.currency)}</strong>
          <span className="text-ink-3">qoldi · jami <span className="num">{formatMoney(d.principal, d.currency)}</span></span>
        </p>
        <div className="mt-2">
          <ProgressBar pct={pct} tone={d.status === "PAID" ? "done" : "neutral"} label={`${d.counterparty} qarzi`} valueText={`${pct}% to‘langan`} />
        </div>
        <p className="mt-1 text-xs text-ink-3">To‘langan: <span className="num">{formatMoney(d.paid, d.currency)}</span> ({pct.toFixed(pct % 1 === 0 ? 0 : 1)}%)</p>
        {d.note && <p className="mt-2 text-sm text-ink-2">{d.note}</p>}

        {d.payments.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-accent">To‘lovlar ({d.payments.length})</summary>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {d.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="num font-semibold">{formatMoney(p.amount, d.currency)}</span>
                    <span className="block truncate text-xs text-ink-3">{formatDayShort(dayKeyOf(p.paidAt))} · {p.account.name}{p.note ? ` · ${p.note}` : ""}</span>
                  </span>
                  <button type="button" className="btn btn-icon btn-sm hover:text-danger" aria-label="To‘lovni o‘chirish" onClick={() => setDelPay({ debt: d, id: p.id })}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1">
          {d.status !== "PAID" && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openPay(d)}>
              {lent ? "Qaytarib oldim" : "To‘lov qildim"}
            </button>
          )}
          <button type="button" className="btn btn-icon btn-sm hover:text-danger" onClick={() => setConfirm(d)} aria-label={`${d.counterparty} qarzini o‘chirish`}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </li>
    );
  };

  const formAccounts = form ? accountsFor(form.currency) : [];
  const payAccounts = payForm ? accountsFor(payForm.debt.currency) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.entries(totals) as [CurrencyCode, { lent: bigint; borrowed: bigint }][]).flatMap(([cur, v]) => [
            v.lent > 0n && (
              <span key={`${cur}-l`} className="chip">
                <ArrowUpRight size={14} className="text-income" aria-hidden="true" /> Menga qaytishi kerak
                <strong className="num">{formatMoney(v.lent, cur)}</strong>
              </span>
            ),
            v.borrowed > 0n && (
              <span key={`${cur}-b`} className="chip">
                <ArrowDownLeft size={14} className="text-expense" aria-hidden="true" /> Men qaytarishim kerak
                <strong className="num">{formatMoney(v.borrowed, cur)}</strong>
              </span>
            ),
          ])}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} aria-hidden="true" /> Qarz qo‘shish
        </button>
      </div>

      {debts.length === 0 ? (
        <section className="card">
          <EmptyState icon={HandCoins} title="Qarzlar yo‘q" description="Kimga qarz berganingiz yoki kimdan olganingizni qayd eting. To‘lovlar hisob balansiga to‘g‘ri ta’sir qiladi."
            action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Qarz qo‘shish</button>} />
        </section>
      ) : (
        <>
          {open.length > 0 && <ul className="grid gap-4 md:grid-cols-2">{open.map(card)}</ul>}
          {closed.length > 0 && (
            <section aria-labelledby="closed-h" className="space-y-3">
              <h2 id="closed-h" className="font-display text-lg font-semibold text-ink-2">Yopilganlar</h2>
              <ul className="grid gap-4 md:grid-cols-2">{closed.map(card)}</ul>
            </section>
          )}
        </>
      )}
      <p className="text-xs text-ink-3">Qarz harakatlari daromad yoki xarajat hisoblanmaydi; faqat hisob balansini o‘zgartiradi.</p>

      <Modal open={form !== null} onClose={() => setForm(null)} title="Yangi qarz">
        {form && (
          <form onSubmit={saveDebt} className="space-y-4" noValidate>
            <FormError message={create.error} />
            <div role="radiogroup" aria-label="Qarz turi" className="grid grid-cols-2 gap-2">
              {(["LENT", "BORROWED"] as const).map((dir) => (
                <button key={dir} type="button" role="radio" aria-checked={form.direction === dir} className="chip justify-center" onClick={() => setForm({ ...form, direction: dir })}>
                  {DIR_LABEL[dir]}
                </button>
              ))}
            </div>
            <Field label={form.direction === "LENT" ? "Kimga berdingiz" : "Kimdan oldingiz"} htmlFor="debt-who" error={create.fields.counterparty}>
              <input id="debt-who" data-autofocus className="field" maxLength={60} value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Summa" htmlFor="debt-amt" error={create.fields.amount}>
                  <input id="debt-amt" className="field num" inputMode="decimal" autoComplete="off" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </Field>
              </div>
              <Field label="Valyuta" htmlFor="debt-cur">
                <select id="debt-cur" className="field" value={form.currency} onChange={(e) => {
                  const c = e.target.value as CurrencyCode;
                  setForm({ ...form, currency: c, accountId: accountsFor(c)[0]?.id ?? "" });
                }}>
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Hisob" htmlFor="debt-acc" error={create.fields.accountId} hint={form.accountId ? (form.direction === "LENT" ? "Summa shu hisobdan chiqadi." : "Summa shu hisobga kiradi.") : "Hisobga ta’sir qilmaydi — faqat eslatma sifatida saqlanadi."}>
              <select id="debt-acc" className="field" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                <option value="">Hisobga ta’sir qilmasin</option>
                {formAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sana" htmlFor="debt-start" error={create.fields.startDate}>
                <input id="debt-start" type="date" className="field" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </Field>
              <Field label="Qaytarish muddati" htmlFor="debt-due" error={create.fields.dueDate}>
                <input id="debt-due" type="date" className="field" value={form.dueDate} min={form.startDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </Field>
            </div>
            <Field label="Izoh" htmlFor="debt-note" error={create.fields.note}>
              <input id="debt-note" className="field" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={() => setForm(null)}>Bekor qilish</button>
              <button type="submit" className="btn btn-primary" disabled={create.busy}>{create.busy ? "Yuklanmoqda…" : "Saqlash"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={payForm !== null} onClose={() => setPayForm(null)} title={payForm?.debt.direction === "LENT" ? "Qaytarib olingan summa" : "To‘lov"}
        description={payForm ? `${payForm.debt.counterparty} · qoldi ${formatMoney(payForm.debt.remaining, payForm.debt.currency)}` : undefined}>
        {payForm && (
          <form onSubmit={savePay} className="space-y-4" noValidate>
            <FormError message={pay.error} />
            <Field label="Summa" htmlFor="pay-amt" error={pay.fields.amount}>
              <input id="pay-amt" data-autofocus className="field num" inputMode="decimal" autoComplete="off" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </Field>
            <Field label="Hisob" htmlFor="pay-acc" error={pay.fields.accountId} hint={payForm.debt.direction === "LENT" ? "Pul shu hisobga kiradi." : "Pul shu hisobdan chiqadi."}>
              <select id="pay-acc" className="field" value={payForm.accountId} onChange={(e) => setPayForm({ ...payForm, accountId: e.target.value })}>
                {payAccounts.length === 0 && <option value="">{payForm.debt.currency} hisob yo‘q</option>}
                {payAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Sana" htmlFor="pay-date" error={pay.fields.date}>
              <input id="pay-date" type="date" className="field" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
            </Field>
            <Field label="Izoh" htmlFor="pay-note">
              <input id="pay-note" className="field" maxLength={200} value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={() => setPayForm(null)}>Bekor qilish</button>
              <button type="submit" className="btn btn-primary" disabled={pay.busy || payAccounts.length === 0}>{pay.busy ? "Yuklanmoqda…" : "Saqlash"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Qarzni o‘chirish" size="sm"
        description={confirm?.movedMoney ? "Qarz berilganda/olinganda hisobga ta’sir qilgan harakat ham hisobdan olib tashlanadi. To‘lovlari bor qarzni avval to‘lovlarini o‘chirib keyin o‘chirish mumkin." : "To‘lovlari bor qarzni avval to‘lovlarini o‘chirib keyin o‘chirish mumkin."}>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirm(null)}>Bekor qilish</button>
          <button type="button" className="btn btn-danger" onClick={removeDebt}>O‘chirish</button>
        </div>
      </Modal>

      <Modal open={delPay !== null} onClose={() => setDelPay(null)} title="To‘lovni o‘chirish" size="sm" description="To‘lov hisob balansidan ham olib tashlanadi, qarz qoldig‘i qayta hisoblanadi.">
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setDelPay(null)}>Bekor qilish</button>
          <button type="button" className="btn btn-danger" onClick={removePay}>O‘chirish</button>
        </div>
      </Modal>
    </div>
  );
}
