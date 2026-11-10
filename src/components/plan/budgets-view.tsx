"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { formatMoney, minorToInput, type CurrencyCode } from "@/domain/money";
import { addMonths, formatMonthLabel, monthRange } from "@/domain/time";
import type { BudgetDto } from "@/server/services/budgets";
import { copyBudgetsAction, deleteBudgetAction, saveBudgetAction } from "@/app/actions/plan";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormError } from "@/components/ui/form";
import { ProgressBar, type ProgressTone } from "@/components/ui/progress";
import { useToast } from "@/components/providers";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { useSubmit } from "./use-submit";

const STATUS_TEXT = { ok: "Me’yorda", warn: "Limitga yaqin", over: "Limitdan oshdi" } as const;
const STATUS_STYLE = {
  ok: "bg-income-soft text-income",
  warn: "bg-warn-soft text-warn",
  over: "bg-expense-soft text-expense",
} as const;

type Form = { categoryId: string; currency: CurrencyCode; limit: string; editing: boolean };

export function BudgetsView({
  month,
  currentMonth,
  budgets,
  categories,
  currencies,
}: {
  month: string;
  currentMonth: string;
  budgets: BudgetDto[];
  categories: { id: string; name: string }[];
  currencies: string[];
}) {
  const toast = useToast();
  const { busy, error, fields, submit, reset } = useSubmit();
  const [form, setForm] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<BudgetDto | null>(null);
  const isCurrent = month === currentMonth;

  const openNew = () => {
    reset();
    setForm({ categoryId: "", currency: (currencies[0] as CurrencyCode) ?? "UZS", limit: "", editing: false });
  };
  const openEdit = (b: BudgetDto) => {
    reset();
    setForm({ categoryId: b.categoryId ?? "", currency: b.currency, limit: minorToInput(b.limit, b.currency), editing: true });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const res = await submit(() =>
      saveBudgetAction({ month, categoryId: form.categoryId || null, currency: form.currency, limit: form.limit }),
    );
    if (res.ok) {
      toast({ message: form.editing ? "Byudjet yangilandi" : "Byudjet saqlandi", tone: "success" });
      setForm(null);
    }
  };

  const copy = async () => {
    const res = await copyBudgetsAction(month);
    if (!res.ok) return toast({ message: res.error, tone: "error" });
    toast({
      message: res.data > 0 ? `${res.data} ta byudjet ko‘chirildi` : "Ko‘chiriladigan yangi byudjet yo‘q",
      tone: res.data > 0 ? "success" : "info",
    });
  };

  const remove = async () => {
    if (!confirm) return;
    const res = await deleteBudgetAction(confirm.id);
    setConfirm(null);
    toast(res.ok ? { message: "Byudjet o‘chirildi", tone: "success" } : { message: res.error, tone: "error" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={`/plan/budgets?month=${addMonths(month, -1)}`} className="btn btn-icon" aria-label="Oldingi oy" scroll={false}>
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
          <p className="min-w-40 text-center font-display text-lg font-semibold" aria-live="polite">
            {formatMonthLabel(month)}
          </p>
          <Link href={`/plan/budgets?month=${addMonths(month, 1)}`} className="btn btn-icon" aria-label="Keyingi oy" scroll={false}>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          {!isCurrent && (
            <Link href="/plan/budgets" className="btn btn-sm ml-2">Joriy oy</Link>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm" onClick={copy}>
            <Copy size={15} aria-hidden="true" /> Oldingi oydan ko‘chirish
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>
            <Plus size={16} aria-hidden="true" /> Byudjet
          </button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={PiggyBank}
            title="Bu oy uchun byudjet yo‘q"
            description="Umumiy yoki kategoriya bo‘yicha oylik limit belgilang. Sarf haqiqiy xarajatlardan avtomatik hisoblanadi."
            action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Byudjet qo‘shish</button>}
          />
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {budgets.map((b) => {
            const over = b.progress.remaining < 0n;
            const tone: ProgressTone = b.progress.status;
            const name = b.category?.name ?? "Umumiy byudjet";
            return (
              <li key={b.id} className="card p-5">
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full text-white"
                    style={{ background: b.category?.color ?? "var(--accent)" }}
                    aria-hidden="true"
                  >
                    <Icon name={b.category?.icon ?? "wallet"} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{name}</p>
                    <p className="text-xs text-ink-3">{b.currency}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[b.progress.status])}>
                    {STATUS_TEXT[b.progress.status]}
                  </span>
                </div>

                <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-sm">
                  <strong className="num text-xl">{formatMoney(b.spent, b.currency)}</strong>
                  <span className="text-ink-3">/ <span className="num">{formatMoney(b.limit, b.currency)}</span></span>
                  <span className="num ml-auto font-semibold">{b.progress.pct.toFixed(b.progress.pct % 1 === 0 ? 0 : 1)}%</span>
                </p>
                <div className="mt-2">
                  <ProgressBar
                    pct={b.progress.pct}
                    tone={tone}
                    label={`${name} byudjeti`}
                    valueText={`${b.progress.pct}% sarflandi, ${STATUS_TEXT[b.progress.status]}`}
                  />
                </div>

                <p className={cn("mt-3 text-sm", over ? "font-semibold text-expense" : "text-ink-2")}>
                  {over
                    ? `Limitdan ${formatMoney(-b.progress.remaining, b.currency)} oshib ketdi`
                    : `Qoldi: ${formatMoney(b.progress.remaining, b.currency)}`}
                </p>
                {b.dailyAllowance !== null && !over && b.dailyAllowance > 0n && (
                  <p className="text-xs text-ink-3">Oy oxirigacha kuniga ≈ {formatMoney(b.dailyAllowance, b.currency)}</p>
                )}
                {b.projected !== null && (
                  <p className="text-xs text-ink-3">
                    Prognoz (hozirgi sur’at saqlansa): {formatMoney(b.projected, b.currency)}
                    {b.projected > b.limit && !over ? " — limitdan oshishi mumkin" : ""}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Link
                    href={`/transactions?type=EXPENSE${b.categoryId ? `&categoryId=${b.categoryId}` : ""}&from=${month}-01&to=${monthRange(month).lastDay}`}
                    className="btn btn-sm"
                  >
                    Xarajatlar
                  </Link>
                  <button type="button" className="btn btn-icon btn-sm" onClick={() => openEdit(b)} aria-label={`${name} limitini o‘zgartirish`}>
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button type="button" className="btn btn-icon btn-sm hover:text-danger" onClick={() => setConfirm(b)} aria-label={`${name} byudjetini o‘chirish`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-ink-3">
        Sarf = xarajatlar − qaytimlar. Qarz harakatlari, o‘tkazmalar va balans tuzatishlar sarfga kirmaydi. Valyutalar aralashtirilmaydi.
      </p>

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.editing ? "Byudjetni o‘zgartirish" : "Yangi byudjet"} description={formatMonthLabel(month)}>
        {form && (
          <form onSubmit={save} className="space-y-4" noValidate>
            <FormError message={error} />
            <Field label="Kategoriya" htmlFor="bud-cat" error={fields.categoryId}>
              <select id="bud-cat" className="field" value={form.categoryId} disabled={form.editing} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Umumiy byudjet (barcha xarajatlar)</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Oylik limit" htmlFor="bud-limit" error={fields.limit}>
                  <input id="bud-limit" data-autofocus className="field num" inputMode="decimal" autoComplete="off" placeholder="0" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} aria-invalid={Boolean(fields.limit)} />
                </Field>
              </div>
              <Field label="Valyuta" htmlFor="bud-cur">
                <select id="bud-cur" className="field" value={form.currency} disabled={form.editing} onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}>
                  {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={() => setForm(null)}>Bekor qilish</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Yuklanmoqda…" : "Saqlash"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Byudjetni o‘chirish" size="sm"
        description="Faqat limit o‘chiriladi, xarajatlaringizga tegilmaydi.">
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirm(null)}>Bekor qilish</button>
          <button type="button" className="btn btn-danger" onClick={remove}>O‘chirish</button>
        </div>
      </Modal>
    </div>
  );
}
