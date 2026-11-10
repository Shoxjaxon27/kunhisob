"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { formatMoney, minorToInput, type CurrencyCode } from "@/domain/money";
import { formatDayShort } from "@/domain/time";
import type { GoalDto } from "@/server/services/goals";
import {
  addGoalContributionAction,
  createGoalAction,
  deleteGoalAction,
  deleteGoalContributionAction,
  setGoalArchivedAction,
  updateGoalAction,
} from "@/app/actions/plan";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormError } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/cn";
import { useSubmit } from "./use-submit";

const COLORS = ["#8b5cf6", "#2f6bff", "#0f9d6b", "#e5484d", "#f08a24", "#0ea5b7", "#d6409f", "#64748b"];

type Form = { id?: string; name: string; target: string; currency: CurrencyCode; deadline: string; monthlyPlan: string; color: string; locked: boolean };
type Contrib = { goal: GoalDto; amount: string; date: string; note: string };

export function GoalsView({ goals, todayKey }: { goals: GoalDto[]; todayKey: string }) {
  const toast = useToast();
  const edit = useSubmit();
  const add = useSubmit();
  const [form, setForm] = useState<Form | null>(null);
  const [contrib, setContrib] = useState<Contrib | null>(null);
  const [confirm, setConfirm] = useState<GoalDto | null>(null);

  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  const openNew = () => {
    edit.reset();
    setForm({ name: "", target: "", currency: "UZS", deadline: "", monthlyPlan: "", color: COLORS[0]!, locked: false });
  };
  const openEdit = (g: GoalDto) => {
    edit.reset();
    setForm({
      id: g.id, name: g.name, target: minorToInput(g.target, g.currency), currency: g.currency,
      deadline: g.deadlineKey ?? "", monthlyPlan: g.monthlyPlan ? minorToInput(g.monthlyPlan, g.currency) : "",
      color: g.color, locked: g.contributions.length > 0,
    });
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const payload = { name: form.name, target: form.target, currency: form.currency, deadline: form.deadline, monthlyPlan: form.monthlyPlan, color: form.color };
    const res = await edit.submit(() => (form.id ? updateGoalAction(form.id, payload) : createGoalAction(payload)));
    if (res.ok) {
      toast({ message: form.id ? "Maqsad yangilandi" : "Maqsad qo‘shildi", tone: "success" });
      setForm(null);
    }
  };

  const openContrib = (g: GoalDto) => {
    add.reset();
    setContrib({ goal: g, amount: "", date: todayKey, note: "" });
  };
  const saveContrib = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contrib) return;
    const res = await add.submit(() =>
      addGoalContributionAction({ goalId: contrib.goal.id, amount: contrib.amount, date: contrib.date, note: contrib.note }),
    );
    if (res.ok) {
      toast({ message: "Summa maqsadga qo‘shildi", tone: "success" });
      setContrib(null);
    }
  };

  const archive = async (g: GoalDto) => {
    const res = await setGoalArchivedAction(g.id, !g.archived);
    toast(res.ok ? { message: g.archived ? "Maqsad qaytarildi" : "Maqsad arxivlandi", tone: "success" } : { message: res.error, tone: "error" });
  };
  const removeGoal = async () => {
    if (!confirm) return;
    const res = await deleteGoalAction(confirm.id);
    setConfirm(null);
    toast(res.ok ? { message: "Maqsad o‘chirildi", tone: "success" } : { message: res.error, tone: "error" });
  };
  const removeContrib = async (id: string) => {
    const res = await deleteGoalContributionAction(id);
    toast(res.ok ? { message: "Yozuv o‘chirildi", tone: "success" } : { message: res.error, tone: "error" });
  };

  const card = (g: GoalDto) => {
    const p = g.progress;
    const pctText = `${p.pct.toFixed(p.pct % 1 === 0 ? 0 : 1)}%`;
    return (
      <li key={g.id} className={cn("card p-5", g.archived && "opacity-70")}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ background: g.color }} aria-hidden="true">
            <Target size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{g.name}</p>
            <p className="text-xs text-ink-3">
              {g.currency}{g.deadlineKey ? ` · muddat ${formatDayShort(g.deadlineKey)}` : ""}{g.archived ? " · arxivda" : ""}
            </p>
          </div>
          {p.completed && <span className="shrink-0 rounded-full bg-income-soft px-2.5 py-1 text-xs font-semibold text-income">Bajarildi</span>}
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-sm">
          <strong className="num text-xl">{formatMoney(g.saved, g.currency)}</strong>
          <span className="text-ink-3">/ <span className="num">{formatMoney(g.target, g.currency)}</span></span>
          <span className="num ml-auto font-semibold">{pctText}</span>
        </p>
        <div className="mt-2">
          <ProgressBar pct={p.pct} color={p.completed ? undefined : g.color} tone={p.completed ? "done" : "neutral"} label={`${g.name} maqsadi`} valueText={`${pctText} to‘plandi`} />
        </div>

        {!p.completed && (
          <ul className="mt-3 space-y-0.5 text-sm text-ink-2">
            <li>Yetishmaydi: <strong className="num">{formatMoney(p.remaining, g.currency)}</strong></li>
            {p.requiredMonthly !== null && p.monthsLeft !== null && (
              <li>Muddatgacha ({p.monthsLeft} oy) oyiga kerak: <strong className="num">{formatMoney(p.requiredMonthly, g.currency)}</strong></li>
            )}
            {g.deadlineKey && g.deadlineKey < todayKey && <li className="font-semibold text-expense">Muddat o‘tib ketgan</li>}
            {p.monthsAtPlan !== null && g.monthlyPlan && (
              <li className="text-ink-3">Oylik reja ({formatMoney(g.monthlyPlan, g.currency)}) bilan ≈ {p.monthsAtPlan} oy</li>
            )}
          </ul>
        )}

        {g.contributions.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-accent">Qo‘shilgan summalar ({g.contributions.length})</summary>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {g.contributions.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="num font-semibold">{formatMoney(c.amount, g.currency)}</span>
                    <span className="block truncate text-xs text-ink-3">{formatDayShort(c.dateKey)}{c.note ? ` · ${c.note}` : ""}</span>
                  </span>
                  <button type="button" className="btn btn-icon btn-sm hover:text-danger" aria-label="Yozuvni o‘chirish" onClick={() => removeContrib(c.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1">
          {!g.archived && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openContrib(g)}>
              <Plus size={15} aria-hidden="true" /> Summa qo‘shish
            </button>
          )}
          <button type="button" className="btn btn-icon btn-sm" onClick={() => openEdit(g)} aria-label={`${g.name} ni tahrirlash`}><Pencil size={15} aria-hidden="true" /></button>
          <button type="button" className="btn btn-icon btn-sm" onClick={() => archive(g)} aria-label={g.archived ? `${g.name} ni qaytarish` : `${g.name} ni arxivlash`}>
            {g.archived ? <ArchiveRestore size={15} aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn-icon btn-sm hover:text-danger" onClick={() => setConfirm(g)} aria-label={`${g.name} ni o‘chirish`}><Trash2 size={15} aria-hidden="true" /></button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          Maqsadga qo‘shilgan summa hisob balansini <strong>o‘zgartirmaydi</strong>: u faqat shu maqsad uchun ajratib qo‘ygan summangizni qayd etadi.
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={openNew}><Plus size={16} aria-hidden="true" /> Maqsad</button>
      </div>

      {active.length === 0 && archived.length === 0 ? (
        <section className="card">
          <EmptyState icon={Target} title="Maqsad yo‘q" description="Yangi telefon, ta’til yoki zaxira jamg‘armasi uchun maqsad qo‘ying va yig‘ilgan summani kuzating."
            action={<button type="button" className="btn btn-primary" onClick={openNew}><Plus size={18} aria-hidden="true" /> Maqsad qo‘shish</button>} />
        </section>
      ) : (
        <>
          {active.length > 0 && <ul className="grid gap-4 md:grid-cols-2">{active.map(card)}</ul>}
          {archived.length > 0 && (
            <section aria-labelledby="arch-goals" className="space-y-3">
              <h2 id="arch-goals" className="font-display text-lg font-semibold text-ink-2">Arxiv</h2>
              <ul className="grid gap-4 md:grid-cols-2">{archived.map(card)}</ul>
            </section>
          )}
        </>
      )}

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.id ? "Maqsadni tahrirlash" : "Yangi maqsad"}>
        {form && (
          <form onSubmit={save} className="space-y-4" noValidate>
            <FormError message={edit.error} />
            <Field label="Nomi" htmlFor="goal-name" error={edit.fields.name}>
              <input id="goal-name" data-autofocus className="field" maxLength={60} placeholder="Masalan: Yangi telefon" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Kerakli summa" htmlFor="goal-target" error={edit.fields.target}>
                  <input id="goal-target" className="field num" inputMode="decimal" autoComplete="off" placeholder="0" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                </Field>
              </div>
              <Field label="Valyuta" htmlFor="goal-cur" error={edit.fields.currency} hint={form.locked ? "Summalar bor" : undefined}>
                <select id="goal-cur" className="field" value={form.currency} disabled={form.locked} onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}>
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Muddat (ixtiyoriy)" htmlFor="goal-deadline" error={edit.fields.deadline}>
                <input id="goal-deadline" type="date" className="field" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </Field>
              <Field label="Oylik reja (ixtiyoriy)" htmlFor="goal-plan" error={edit.fields.monthlyPlan}>
                <input id="goal-plan" className="field num" inputMode="decimal" autoComplete="off" placeholder="0" value={form.monthlyPlan} onChange={(e) => setForm({ ...form, monthlyPlan: e.target.value })} />
              </Field>
            </div>
            <fieldset>
              <legend className="label">Rang</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-pressed={form.color === c} aria-label={`Rang ${c}`} onClick={() => setForm({ ...form, color: c })}
                    className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface", form.color === c && "ring-2 ring-ink")} style={{ background: c }} />
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={() => setForm(null)}>Bekor qilish</button>
              <button type="submit" className="btn btn-primary" disabled={edit.busy}>{edit.busy ? "Yuklanmoqda…" : "Saqlash"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={contrib !== null} onClose={() => setContrib(null)} title="Maqsadga summa qo‘shish"
        description={contrib ? `${contrib.goal.name} · yetishmaydi ${formatMoney(contrib.goal.progress.remaining, contrib.goal.currency)}` : undefined}>
        {contrib && (
          <form onSubmit={saveContrib} className="space-y-4" noValidate>
            <FormError message={add.error} />
            <Field label={`Summa (${contrib.goal.currency})`} htmlFor="gc-amt" error={add.fields.amount}>
              <input id="gc-amt" data-autofocus className="field num" inputMode="decimal" autoComplete="off" placeholder="0" value={contrib.amount} onChange={(e) => setContrib({ ...contrib, amount: e.target.value })} />
            </Field>
            <Field label="Sana" htmlFor="gc-date" error={add.fields.date}>
              <input id="gc-date" type="date" className="field" value={contrib.date} onChange={(e) => setContrib({ ...contrib, date: e.target.value })} />
            </Field>
            <Field label="Izoh" htmlFor="gc-note">
              <input id="gc-note" className="field" maxLength={200} value={contrib.note} onChange={(e) => setContrib({ ...contrib, note: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={() => setContrib(null)}>Bekor qilish</button>
              <button type="submit" className="btn btn-primary" disabled={add.busy}>{add.busy ? "Yuklanmoqda…" : "Qo‘shish"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="Maqsadni o‘chirish" size="sm"
        description="Maqsad va unga qo‘shilgan summalar yozuvi o‘chadi. Hisoblaringizdagi pulga ta’sir qilmaydi.">
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => setConfirm(null)}>Bekor qilish</button>
          <button type="button" className="btn btn-danger" onClick={removeGoal}>O‘chirish</button>
        </div>
      </Modal>
    </div>
  );
}
