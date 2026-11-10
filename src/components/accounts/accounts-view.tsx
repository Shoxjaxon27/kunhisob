"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { formatMoney, minorToInput, type CurrencyCode } from "@/domain/money";
import type { AccountDto } from "@/server/services/accounts";
import {
  createAccountAction,
  deleteAccountAction,
  setAccountArchivedAction,
  updateAccountAction,
} from "@/app/actions/data";
import { ACCOUNT_ICONS } from "@/lib/validation";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormError } from "@/components/ui/form";
import { AnimatedMoney } from "@/components/ui/animated-money";
import { useToast } from "@/components/providers";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

const COLORS = ["#2f6bff", "#0f9d6b", "#6340d8", "#e5484d", "#f08a24", "#0ea5b7", "#d6409f", "#64748b"];
const TYPES = ["CASH", "CARD", "SAVINGS", "OTHER"] as const;

type FormState = {
  id?: string;
  name: string;
  type: (typeof TYPES)[number];
  currency: CurrencyCode;
  openingBalance: string;
  color: string;
  icon: string;
};

const blank: FormState = { name: "", type: "CASH", currency: "UZS", openingBalance: "0", color: COLORS[0]!, icon: "wallet" };

export function AccountsView({ accounts }: { accounts: AccountDto[] }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<AccountDto | null>(null);

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const totals = new Map<CurrencyCode, bigint>();
  for (const a of active) totals.set(a.currency, (totals.get(a.currency) ?? 0n) + a.balance);

  const openNew = () => { setError(null); setFields({}); setForm({ ...blank }); };
  const openEdit = (a: AccountDto) => {
    setError(null); setFields({});
    setForm({ id: a.id, name: a.name, type: a.type, currency: a.currency, openingBalance: minorToInput(a.openingBalance, a.currency), color: a.color, icon: a.icon });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || busy) return;
    setBusy(true); setError(null); setFields({});
    const payload = { name: form.name, type: form.type, currency: form.currency, openingBalance: form.openingBalance, color: form.color, icon: form.icon };
    const res = form.id ? await updateAccountAction(form.id, payload) : await createAccountAction(payload);
    setBusy(false);
    if (!res.ok) { setError(res.error); setFields(res.fields ?? {}); return; }
    toast({ message: form.id ? "Hisob yangilandi" : "Hisob qo‘shildi", tone: "success" });
    setForm(null);
  };

  const toggleArchive = async (a: AccountDto) => {
    const res = await setAccountArchivedAction(a.id, !a.archived);
    toast(res.ok ? { message: a.archived ? "Hisob qaytarildi" : "Hisob arxivlandi", tone: "success" } : { message: res.error, tone: "error" });
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const res = await deleteAccountAction(confirmDelete.id);
    setConfirmDelete(null);
    toast(res.ok ? { message: "Hisob o‘chirildi", tone: "success" } : { message: res.error, tone: "error" });
  };

  const card = (a: AccountDto) => (
    <li key={a.id} className={cn("card p-4", a.archived && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: a.color }} aria-hidden="true">
          <Icon name={a.icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{a.name}</p>
          <p className="text-xs text-ink-3">{t.accountType[a.type] ?? a.type} · {a.currency}{a.archived ? " · arxivda" : ""}</p>
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">
        {a.archived ? <span className="num">{formatMoney(a.balance, a.currency)}</span> : <AnimatedMoney value={a.balance} currency={a.currency} />}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <Link href={`/transactions?accountId=${a.id}`} className="btn btn-sm">Harakatlar</Link>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => openEdit(a)} aria-label={`${a.name} ni tahrirlash`}><Pencil size={16} aria-hidden="true" /></button>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => toggleArchive(a)} aria-label={a.archived ? `${a.name} ni qaytarish` : `${a.name} ni arxivlash`}>
          {a.archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
        </button>
        <button type="button" className="btn btn-icon btn-sm hover:text-danger" onClick={() => setConfirmDelete(a)} aria-label={`${a.name} ni o‘chirish`}><Trash2 size={16} aria-hidden="true" /></button>
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t.nav.accounts}</h1>
          {totals.size > 0 && (
            <p className="mt-1 text-sm text-ink-2">
              Jami:{" "}
              {[...totals.entries()].map(([c, v], i) => (
                <span key={c}>{i > 0 && " · "}<strong className="num">{formatMoney(v, c)}</strong></span>
              ))}
            </p>
          )}
        </div>
        <button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Hisob qo‘shish</button>
      </header>

      {active.length === 0 ? (
        <section className="card"><EmptyState icon={Wallet} title="Faol hisob yo‘q" description="Naqd pul yoki karta hisobini qo‘shing." action={<button type="button" className="btn btn-primary" onClick={openNew}>Hisob qo‘shish</button>} /></section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{active.map(card)}</ul>
      )}

      {archived.length > 0 && (
        <section aria-labelledby="arch-h" className="space-y-3">
          <h2 id="arch-h" className="font-display text-lg font-semibold text-ink-2">Arxiv</h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{archived.map(card)}</ul>
        </section>
      )}

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.id ? "Hisobni tahrirlash" : "Yangi hisob"}>
        {form && (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormError message={error} />
            <Field label="Nomi" htmlFor="acc-name" error={fields.name}>
              <input id="acc-name" data-autofocus className="field" value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={Boolean(fields.name)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Turi" htmlFor="acc-type">
                <select id="acc-type" className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FormState["type"] })}>
                  {TYPES.map((x) => <option key={x} value={x}>{t.accountType[x]}</option>)}
                </select>
              </Field>
              <Field label="Valyuta" htmlFor="acc-cur" error={fields.currency} hint={form.id ? "Harakatlar bo‘lsa o‘zgartirib bo‘lmaydi" : undefined}>
                <select id="acc-cur" className="field" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}>
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
            </div>
            <Field label="Boshlang‘ich balans" htmlFor="acc-open" error={fields.openingBalance} hint="Hisobda hozir bor summa. Manfiy ham bo‘lishi mumkin.">
              <input id="acc-open" className="field num" inputMode="decimal" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} aria-invalid={Boolean(fields.openingBalance)} />
            </Field>
            <fieldset>
              <legend className="label">Rang</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-pressed={form.color === c} aria-label={`Rang ${c}`} onClick={() => setForm({ ...form, color: c })}
                    className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface", form.color === c && "ring-2 ring-ink")} style={{ background: c }} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Belgi</legend>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_ICONS.map((ic) => (
                  <button key={ic} type="button" aria-pressed={form.icon === ic} aria-label={ic} onClick={() => setForm({ ...form, icon: ic })} className="chip !size-10 !p-0 justify-center">
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={() => setForm(null)}>{t.common.cancel}</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t.common.loading : t.common.save}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Hisobni o‘chirish" size="sm"
        description={confirmDelete ? `“${confirmDelete.name}” butunlay o‘chiriladi. Harakatlari bor hisobni o‘chirib bo‘lmaydi — uni arxivlang.` : undefined}>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirmDelete(null)}>{t.common.cancel}</button>
          <button type="button" className="btn btn-danger" onClick={doDelete}>{t.common.delete}</button>
        </div>
      </Modal>
    </div>
  );
}
