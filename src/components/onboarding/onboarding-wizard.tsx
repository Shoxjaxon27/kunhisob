"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { CURRENCIES, CURRENCY_CODES, tryParseMoney, type CurrencyCode } from "@/domain/money";
import { completeOnboardingAction } from "@/app/actions/data";
import { Field, FormError } from "@/components/ui/form";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type AccountDraft = {
  key: number;
  name: string;
  type: "CASH" | "CARD" | "SAVINGS" | "OTHER";
  currency: CurrencyCode;
  openingBalance: string;
};

const STEPS = ["Tanishuv", "Valyuta", "Hisoblar", "Maqsad"] as const;

export function OnboardingWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState<CurrencyCode>("UZS");
  const [nextKey, setNextKey] = useState(3);
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { key: 1, name: "Naqd pul", type: "CASH", currency: "UZS", openingBalance: "" },
    { key: 2, name: "Bank kartasi", type: "CARD", currency: "UZS", openingBalance: "" },
  ]);
  const [withGoal, setWithGoal] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrency, setGoalCurrency] = useState<CurrencyCode>("UZS");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setError(null);
    setStep(n);
  };

  const changeCurrency = (c: CurrencyCode) => {
    setCurrency(c);
    // Hali tegilmagan standart hisoblar valyutasi yangilanadi.
    setAccounts((xs) => xs.map((a) => (a.openingBalance === "" ? { ...a, currency: c } : a)));
    setGoalCurrency(c);
  };

  const validateStep = (): boolean => {
    const errs: Record<string, string> = {};
    if (step === 0 && name.trim() === "") errs.name = "Ismingizni kiriting";
    if (step === 2) {
      if (accounts.length === 0) errs.accounts = "Kamida bitta hisob kerak";
      accounts.forEach((a) => {
        if (a.name.trim() === "") errs[`name-${a.key}`] = "Nom kiriting";
        if (a.openingBalance.trim() !== "" && tryParseMoney(a.openingBalance, a.currency) === null) {
          errs[`bal-${a.key}`] = "Summa noto‘g‘ri";
        }
      });
    }
    if (step === 3 && withGoal) {
      if (goalName.trim() === "") errs.goalName = "Maqsad nomini kiriting";
      const v = tryParseMoney(goalTarget, goalCurrency);
      if (v === null || v <= 0n) errs.goalTarget = "Summani to‘g‘ri kiriting";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validateStep()) return;
    setError(null);
    startTransition(async () => {
      const res = await completeOnboardingAction({
        name,
        primaryCurrency: currency,
        accounts: accounts.map(({ name: n, type, currency: c, openingBalance }) => ({
          name: n,
          type,
          currency: c,
          openingBalance: openingBalance.trim() === "" ? "0" : openingBalance,
        })),
        goal: withGoal ? { name: goalName, target: goalTarget, currency: goalCurrency } : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/");
      router.refresh();
    });
  };

  const onEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    if (step < STEPS.length - 1) go(step + 1);
    else submit();
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-8 sm:py-14">
      <header className="mb-8 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-ink font-display text-lg font-bold text-bg">K</span>
        <span className="font-display text-xl font-semibold tracking-tight">KunHisob</span>
      </header>

      <nav aria-label="Bosqichlar" className="mb-8">
        <ol className="flex gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <div className="h-1.5 overflow-hidden rounded-full bg-line-strong">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={false}
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className={cn("mt-2 block text-xs font-semibold", i === step ? "text-ink" : "text-ink-3")}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <form onSubmit={onEnter} noValidate className="flex flex-1 flex-col">
        <div className="relative flex-1">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -28 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              {step === 0 && (
                <>
                  <div>
                    <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">Keling, tanishamiz.</h1>
                    <p className="mt-3 text-ink-2">Sizga qanday murojaat qilaylik?</p>
                  </div>
                  <Field label="Ismingiz" htmlFor="ob-name" error={fieldErrors.name}>
                    <input
                      id="ob-name"
                      className="field"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="given-name"
                      data-autofocus
                      autoFocus
                      aria-invalid={Boolean(fieldErrors.name)}
                    />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">Asosiy valyuta</h1>
                    <p className="mt-3 text-ink-2">
                      Bosh sahifadagi umumiy ko‘rsatkichlar shu valyutada chiqadi. Boshqa valyutadagi hisoblar alohida
                      hisoblanadi — kurs o‘ylab topilmaydi.
                    </p>
                  </div>
                  <div role="radiogroup" aria-label="Asosiy valyuta" className="grid gap-3 sm:grid-cols-2">
                    {CURRENCY_CODES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={currency === c}
                        onClick={() => changeCurrency(c)}
                        className={cn(
                          "card flex items-center gap-4 p-5 text-left",
                          currency === c && "!border-accent ring-2 ring-accent/30",
                        )}
                      >
                        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft font-display text-lg font-bold text-accent">
                          {c === "USD" ? "$" : "so‘m"}
                        </span>
                        <span>
                          <span className="block font-display text-lg font-semibold">{c}</span>
                          <span className="block text-sm text-ink-2">{CURRENCIES[c].name}</span>
                        </span>
                        {currency === c && <Check className="ml-auto text-accent" size={20} aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">Hisoblaringiz</h1>
                    <p className="mt-3 text-ink-2">
                      Hozir qancha pulingiz bor? Boshlang‘ich balansni kiriting — keyin hamma narsa shundan hisoblanadi.
                    </p>
                  </div>
                  {fieldErrors.accounts && <p className="field-error">{fieldErrors.accounts}</p>}
                  <ul className="space-y-3">
                    {accounts.map((a, idx) => (
                      <li key={a.key} className="card space-y-3 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Nomi" htmlFor={`acc-name-${a.key}`} error={fieldErrors[`name-${a.key}`]}>
                            <input
                              id={`acc-name-${a.key}`}
                              className="field"
                              value={a.name}
                              onChange={(e) => setAccounts((xs) => xs.map((x) => (x.key === a.key ? { ...x, name: e.target.value } : x)))}
                              aria-invalid={Boolean(fieldErrors[`name-${a.key}`])}
                            />
                          </Field>
                          <Field label="Turi" htmlFor={`acc-type-${a.key}`}>
                            <select
                              id={`acc-type-${a.key}`}
                              className="field"
                              value={a.type}
                              onChange={(e) =>
                                setAccounts((xs) => xs.map((x) => (x.key === a.key ? { ...x, type: e.target.value as AccountDraft["type"] } : x)))
                              }
                            >
                              {Object.entries(t.accountType).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                          <Field label="Hozirgi balans" htmlFor={`acc-bal-${a.key}`} error={fieldErrors[`bal-${a.key}`]}>
                            <input
                              id={`acc-bal-${a.key}`}
                              className="field num"
                              inputMode="decimal"
                              placeholder="0"
                              value={a.openingBalance}
                              onChange={(e) =>
                                setAccounts((xs) => xs.map((x) => (x.key === a.key ? { ...x, openingBalance: e.target.value } : x)))
                              }
                              aria-invalid={Boolean(fieldErrors[`bal-${a.key}`])}
                            />
                          </Field>
                          <div className="flex items-end gap-2">
                            <div>
                              <label className="label" htmlFor={`acc-cur-${a.key}`}>
                                Valyuta
                              </label>
                              <select
                                id={`acc-cur-${a.key}`}
                                className="field !w-24"
                                value={a.currency}
                                onChange={(e) =>
                                  setAccounts((xs) => xs.map((x) => (x.key === a.key ? { ...x, currency: e.target.value as CurrencyCode } : x)))
                                }
                              >
                                {CURRENCY_CODES.map((c) => (
                                  <option key={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon"
                              onClick={() => setAccounts((xs) => xs.filter((x) => x.key !== a.key))}
                              disabled={accounts.length === 1}
                              aria-label={`${a.name || `${idx + 1}-hisob`} ni olib tashlash`}
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {accounts.length < 6 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setAccounts((xs) => [...xs, { key: nextKey, name: "", type: "OTHER", currency, openingBalance: "" }]);
                        setNextKey((k) => k + 1);
                      }}
                    >
                      <Plus size={16} aria-hidden="true" /> Hisob qo‘shish
                    </button>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">Moliyaviy maqsad</h1>
                    <p className="mt-3 text-ink-2">Ixtiyoriy. Hohlasangiz, birinchi jamg‘arma maqsadingizni hozir belgilang.</p>
                  </div>
                  <label className="card flex cursor-pointer items-center gap-3 p-4">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--accent)]"
                      checked={withGoal}
                      onChange={(e) => setWithGoal(e.target.checked)}
                    />
                    <span className="font-medium">Maqsad qo‘shish</span>
                  </label>
                  {withGoal && (
                    <div className="space-y-4">
                      <Field label="Maqsad nomi" htmlFor="goal-name" error={fieldErrors.goalName}>
                        <input
                          id="goal-name"
                          className="field"
                          placeholder="Masalan: Yangi telefon"
                          value={goalName}
                          onChange={(e) => setGoalName(e.target.value)}
                          aria-invalid={Boolean(fieldErrors.goalName)}
                        />
                      </Field>
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <Field label="Kerakli summa" htmlFor="goal-target" error={fieldErrors.goalTarget}>
                          <input
                            id="goal-target"
                            className="field num"
                            inputMode="decimal"
                            value={goalTarget}
                            onChange={(e) => setGoalTarget(e.target.value)}
                            aria-invalid={Boolean(fieldErrors.goalTarget)}
                          />
                        </Field>
                        <div>
                          <label className="label" htmlFor="goal-cur">
                            Valyuta
                          </label>
                          <select id="goal-cur" className="field !w-24" value={goalCurrency} onChange={(e) => setGoalCurrency(e.target.value as CurrencyCode)}>
                            {CURRENCY_CODES.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
                        Maqsad saqlanadi, lekin jamg‘armalar bo‘limi keyingi yangilanishda ochiladi. Hozircha u ekranda ko‘rinmaydi.
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 space-y-4">
          <FormError message={error} />
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)} disabled={step === 0 || pending}>
              <ArrowLeft size={18} aria-hidden="true" /> Orqaga
            </button>
            {step < STEPS.length - 1 ? (
              <button type="submit" className="btn btn-primary">
                Davom etish <ArrowRight size={18} aria-hidden="true" />
              </button>
            ) : (
              <button type="submit" className="btn btn-lime" disabled={pending}>
                {pending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
                Boshlash
              </button>
            )}
          </div>
        </div>
      </form>
    </main>
  );
}
