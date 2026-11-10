"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { adjustmentFor } from "@/domain/ledger";
import {
  CURRENCIES,
  formatMoney,
  impliedRate,
  minorToInput,
  tryParseMoney,
  type CurrencyCode,
} from "@/domain/money";
import { toLocalInputs, addDays } from "@/domain/time";
import type { QuickAddContext } from "@/server/services/quick-add";
import {
  createTransactionAction,
  deleteFeedItemAction,
  getEditDataAction,
  restoreFeedItemAction,
  updateTransactionAction,
  updateTransferAction,
  type FeedKind,
} from "@/app/actions/data";
import { useToast } from "@/components/providers";
import { FormError } from "@/components/ui/form";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

import type { QuickAddMode, OpenOptions } from "./quick-add";

const MODES: { mode: QuickAddMode; label: string }[] = [
  { mode: "EXPENSE", label: t.txType.EXPENSE! },
  { mode: "INCOME", label: t.txType.INCOME! },
];

const SAVED_LABEL: Record<QuickAddMode, string> = {
  EXPENSE: "Xarajat saqlandi",
  INCOME: "Daromad saqlandi",
  REFUND: "Qaytim saqlandi",
  TRANSFER: "O‘tkazma saqlandi",
  ADJUSTMENT: "Balans tuzatildi",
};

type TagsState = string[];

export default function QuickAddForm({ ctx, opts, onClose }: { ctx: QuickAddContext; opts: OpenOptions; onClose: () => void }) {
  const toast = useToast();
  const editing = opts.edit ?? null;
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editing));
  const [editLocked, setEditLocked] = useState<"transfer" | "adjustment" | null>(null);

  const nowLocal = useMemo(() => toLocalInputs(new Date()), []);
  const defaultMode: QuickAddMode = opts.mode ?? "EXPENSE";
  const [mode, setMode] = useState<QuickAddMode>(defaultMode);
  const [amount, setAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [accountId, setAccountId] = useState<string>(
    () => opts.accountId ?? ctx.lastAccountByType[defaultMode === "EXPENSE" || defaultMode === "INCOME" || defaultMode === "REFUND" ? defaultMode : "EXPENSE"] ?? ctx.accounts[0]?.id ?? "",
  );
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showAllCats, setShowAllCats] = useState(false);
  const [note, setNote] = useState("");
  const [noteFocused, setNoteFocused] = useState(false);
  const [tags, setTags] = useState<TagsState>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTags, setShowTags] = useState(false);
  const [dateKey, setDateKey] = useState(ctx.todayKey);
  const [time, setTime] = useState(nowLocal.time);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [duplicate, setDuplicate] = useState<{ time: string; note: string } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const account = ctx.accounts.find((a) => a.id === accountId) ?? null;
  const toAccount = ctx.accounts.find((a) => a.id === toAccountId) ?? null;
  const currency: CurrencyCode = account?.currency ?? "UZS";
  const isTransfer = mode === "TRANSFER";
  const isAdjust = mode === "ADJUSTMENT";
  const crossCurrency = isTransfer && account && toAccount && account.currency !== toAccount.currency;

  // Tahrirlash: mavjud yozuvni yuklash
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    (async () => {
      const res = await getEditDataAction(editing.kind, editing.id);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setLoadingEdit(false);
        return;
      }
      if (res.data.kind === "transfer") {
        const d = res.data.data;
        setMode("TRANSFER");
        setEditLocked("transfer");
        setAccountId(d.fromAccountId);
        setToAccountId(d.toAccountId);
        const fromCur = ctx.accounts.find((a) => a.id === d.fromAccountId)?.currency ?? "UZS";
        const toCur = ctx.accounts.find((a) => a.id === d.toAccountId)?.currency ?? "UZS";
        setAmount(minorToInput(d.fromAmount, fromCur));
        setToAmount(minorToInput(d.toAmount, toCur));
        setDateKey(d.date);
        setTime(d.time);
        setNote(d.note);
      } else {
        const d = res.data.data;
        if (d.type === "ADJUSTMENT") {
          setMode("ADJUSTMENT");
          setEditLocked("adjustment");
        } else if (d.type === "INCOME" || d.type === "EXPENSE" || d.type === "REFUND") {
          setMode(d.type);
        }
        setAccountId(d.accountId);
        const cur = ctx.accounts.find((a) => a.id === d.accountId)?.currency ?? "UZS";
        setAmount(minorToInput(d.amount, cur));
        setCategoryId(d.categoryId);
        setDateKey(d.date);
        setTime(d.time);
        setNote(d.note);
        setTags(d.tags);
        setShowTags(d.tags.length > 0);
      }
      setLoadingEdit(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tur o'zgarganda: oxirgi ishlatilgan hisobni tanlash (yangi yozuvda) va kategoriyani tozalash
  const switchMode = (m: QuickAddMode) => {
    if (m === mode) return;
    setMode(m);
    setError(null);
    setFields({});
    setDuplicate(null);
    setCategoryId(null);
    if (!editing && (m === "EXPENSE" || m === "INCOME" || m === "REFUND")) {
      const last = ctx.lastAccountByType[m];
      if (last) setAccountId(last);
    }
    if (m === "TRANSFER" && !toAccountId) {
      const other = ctx.accounts.find((a) => a.id !== accountId);
      if (other) setToAccountId(other.id);
    }
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  const categories = mode === "INCOME" ? ctx.incomeCategories : ctx.expenseCategories;
  const visibleCats = showAllCats ? categories : categories.slice(0, 8);

  const hints = useMemo(() => {
    const q = note.trim().toLowerCase();
    if (!noteFocused || !q || isTransfer || isAdjust) return [];
    return ctx.hints
      .filter((h) => h.type === mode && h.note.toLowerCase().includes(q) && h.note.toLowerCase() !== q)
      .slice(0, 4);
  }, [ctx.hints, mode, note, noteFocused, isTransfer, isAdjust]);

  const applyHint = (h: QuickAddContext["hints"][number]) => {
    setNote(h.note);
    if (h.categoryId && categories.some((c) => c.id === h.categoryId)) setCategoryId(h.categoryId);
    if (ctx.accounts.some((a) => a.id === h.accountId) && !editing) setAccountId(h.accountId);
  };

  // Balans tuzatish: hisoblangan balans va farq
  const adjustPreview = useMemo(() => {
    if (!isAdjust || !account) return null;
    const actual = tryParseMoney(amount, account.currency);
    if (actual === null) return { computed: account.balance, diff: null as bigint | null };
    const adj = adjustmentFor(actual, account.balance);
    return { computed: account.balance, diff: adj ? (adj.flow === "IN" ? adj.amount : -adj.amount) : 0n };
  }, [isAdjust, account, amount]);

  const rate = useMemo(() => {
    if (!crossCurrency || !account || !toAccount) return null;
    const a = tryParseMoney(amount, account.currency);
    const b = tryParseMoney(toAmount, toAccount.currency);
    if (a === null || b === null) return null;
    // Ko'rsatish: kuchli valyuta (USD) asos qilinadi: "1 USD = 12 500 UZS".
    const base = account.currency === "USD" ? "from" : "to";
    const r = base === "from"
      ? impliedRate(a, account.currency, b, toAccount.currency)
      : impliedRate(b, toAccount.currency, a, account.currency);
    if (r === null) return null;
    const [i = "0", f] = r.split(".");
    const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    const text = f ? `${grouped},${f.slice(0, 4)}` : grouped;
    return base === "from"
      ? `1 ${account.currency} = ${text} ${toAccount.currency}`
      : `1 ${toAccount.currency} = ${text} ${account.currency}`;
  }, [crossCurrency, account, toAccount, amount, toAmount]);

  const setDay = (offset: number) => setDateKey(addDays(ctx.todayKey, offset));

  const commitTag = () => {
    const v = tagInput.trim().replace(/^#+/, "").toLowerCase();
    if (v && !tags.includes(v) && tags.length < 8) setTags((xs) => [...xs, v]);
    setTagInput("");
  };

  const reset = () => {
    setAmount("");
    setToAmount("");
    setNote("");
    setTags([]);
    setCategoryId(null);
    setDuplicate(null);
    setError(null);
    setFields({});
    requestAnimationFrame(() => amountRef.current?.focus());
  };

  const undoable = (kind: FeedKind, id: string, label: string) =>
    toast({
      message: label,
      action: {
        label: t.common.undo,
        onClick: async () => {
          const res = await deleteFeedItemAction(kind, id);
          toast(res.ok ? { message: "Bekor qilindi", tone: "info" } : { message: res.error, tone: "error" });
        },
      },
    });

  const submit = async (opts: { another?: boolean; force?: boolean } = {}) => {
    if (pending) return;
    setError(null);
    setFields({});

    // Tezkor mijoz tekshiruvi (asosiy tekshiruv serverda)
    const local: Record<string, string> = {};
    if (!account) local.accountId = "Hisobni tanlang";
    if (isTransfer && !toAccount) local.toAccountId = "Qabul qiluvchi hisobni tanlang";
    if (isTransfer && account && toAccount && account.id === toAccount.id) local.toAccountId = "Boshqa hisobni tanlang";
    if (account) {
      const v = tryParseMoney(amount, account.currency);
      if (amount.trim() === "") local.amount = isAdjust ? "Haqiqiy balansni kiriting" : "Summani kiriting";
      else if (v === null) local.amount = "Summa noto‘g‘ri kiritilgan";
      else if (!isAdjust && v <= 0n) local.amount = "Summa noldan katta bo‘lsin";
    }
    if (crossCurrency && toAccount && tryParseMoney(toAmount, toAccount.currency) === null) {
      local.toAmount = "Qabul qilinadigan summani kiriting";
    }
    if (Object.keys(local).length) {
      setFields(local);
      return;
    }

    setPending(true);
    try {
      if (editing) {
        // ───── Tahrirlash
        if (editLocked === "transfer") {
          const res = await updateTransferAction(editing.id, {
            fromAccountId: accountId,
            toAccountId,
            fromAmount: amount,
            toAmount: crossCurrency ? toAmount : undefined,
            date: dateKey,
            time,
            note,
          });
          if (!res.ok) return fail(res);
        } else if (editLocked === "adjustment") {
          const res = await updateTransactionAction(editing.id, { date: dateKey, time, note });
          if (!res.ok) return fail(res);
        } else {
          const res = await updateTransactionAction(editing.id, {
            type: mode,
            accountId,
            categoryId,
            amount,
            date: dateKey,
            time,
            note,
            tags,
          });
          if (!res.ok) return fail(res);
        }
        toast({ message: "Yozuv yangilandi" });
        onClose();
        return;
      }

      // ───── Yangi yozuv
      if (mode !== "INCOME" && mode !== "EXPENSE") return;
      const res = await createTransactionAction(
        { type: mode, accountId, categoryId, amount, date: dateKey, time, note, tags },
        opts.force ?? false,
      );
      if (!res.ok) return fail(res);
      if (res.data.status === "duplicate") {
        setDuplicate({
          time: toLocalInputs(res.data.existing.occurredAt).time,
          note: res.data.existing.note,
        });
        return;
      }
      undoable("tx", res.data.id, SAVED_LABEL[mode]);

      if (opts.another) reset();
      else onClose();
    } finally {
      setPending(false);
    }
  };

  function fail(res: { ok: false; error: string; fields?: Record<string, string> }) {
    setError(res.error);
    if (res.fields) setFields(res.fields);
  }

  const remove = async () => {
    if (!editing) return;
    setPending(true);
    const res = await deleteFeedItemAction(editing.kind, editing.id);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast({
      message: "Yozuv o‘chirildi",
      action: {
        label: t.common.undo,
        onClick: async () => {
          const r = await restoreFeedItemAction(editing.kind, editing.id);
          toast(r.ok ? { message: "Tiklandi", tone: "info" } : { message: r.error, tone: "error" });
        },
      },
    });
    onClose();
  };

  const tone =
    mode === "EXPENSE" ? "text-expense" : mode === "INCOME" || mode === "REFUND" ? "text-income" : "text-ink";

  const onFormKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit({ another: !editing });
      return;
    }
    if (e.altKey && /^[1-2]$/.test(e.key) && !editing) {
      e.preventDefault();
      const m = MODES[Number(e.key) - 1];
      if (m) switchMode(m.mode);
    }
  };

  if (loadingEdit) {
    return (
      <div className="space-y-4 py-4" aria-busy="true" aria-label={t.common.loading}>
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-12 w-2/3" />
        <div className="skeleton h-12 w-full" />
      </div>
    );
  }

  const modeTabsDisabled = Boolean(editing && (editLocked !== null));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={onFormKey}
      noValidate
      className="space-y-5"
      aria-label={editing ? "Yozuvni tahrirlash" : "Yangi yozuv qo‘shish"}
    >
      {/* Tur tanlash */}
      <div role="tablist" aria-label="Yozuv turi" className="scroll-x -mx-1 flex gap-1.5 rounded-2xl bg-sunken p-1.5">
        {(editing && !MODES.some(tab => tab.mode === mode) ? [{ mode, label: t.txType[mode]! }] : MODES).map(({ mode: m, label }, i) => {
          const disabled = modeTabsDisabled || Boolean(editing && !["EXPENSE", "INCOME", "REFUND"].includes(m));
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              aria-keyshortcuts={`Alt+${i + 1}`}
              disabled={disabled && mode !== m}
              onClick={() => switchMode(m)}
              className={cn(
                "min-h-10 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors",
                mode === m ? "bg-raised text-ink shadow-sm" : "text-ink-2 hover:text-ink",
                disabled && mode !== m && "cursor-not-allowed opacity-40",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <FormError message={error} />

      {/* Summa */}
      <div>
        <label htmlFor="qa-amount" className="label">
          {isAdjust ? "Haqiqiy balans" : isTransfer ? "Yuboriladigan summa" : "Summa"}
        </label>
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border bg-raised px-4 transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/25",
            fields.amount ? "border-danger" : "border-line-strong",
          )}
        >
          <input
            id="qa-amount"
            ref={amountRef}
            data-autofocus
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setDuplicate(null);
            }}
            disabled={editLocked === "adjustment"}
            aria-invalid={Boolean(fields.amount)}
            aria-describedby={fields.amount ? "qa-amount-error" : undefined}
            className={cn(
              "num min-w-0 flex-1 bg-transparent py-3 font-display text-[2.6rem] font-semibold leading-none tracking-tight outline-none placeholder:text-ink-3/60 disabled:opacity-60",
              tone,
            )}
          />
          <span className="rounded-lg bg-sunken px-2.5 py-1 text-sm font-bold text-ink-2" aria-label={CURRENCIES[currency].name}>
            {currency}
          </span>
        </div>
        {fields.amount && (
          <p id="qa-amount-error" className="field-error" role="alert">
            {fields.amount}
          </p>
        )}
        {isAdjust && account && adjustPreview && (
          <p className="mt-2 text-sm text-ink-2" aria-live="polite">
            Hisoblangan balans: <strong className="num text-ink">{formatMoney(adjustPreview.computed, currency)}</strong>
            {adjustPreview.diff !== null && adjustPreview.diff !== 0n && (
              <>
                {" · "}Farq:{" "}
                <strong className={cn("num", adjustPreview.diff > 0n ? "text-income" : "text-expense")}>
                  {formatMoney(adjustPreview.diff, currency, { sign: "always" })}
                </strong>
              </>
            )}
            {adjustPreview.diff === 0n && " · Farq yo‘q"}
          </p>
        )}
      </div>

      {/* Hisob(lar) */}
      <AccountPicker
        label={isTransfer ? "Qaysi hisobdan" : "Hisob"}
        accounts={ctx.accounts}
        value={accountId}
        onChange={(id) => {
          setAccountId(id);
          if (id === toAccountId) setToAccountId("");
        }}
        error={fields.accountId ?? fields.fromAccountId}
        disabled={editLocked === "adjustment"}
      />
      {isTransfer && (
        <>
          <AccountPicker
            label="Qaysi hisobga"
            accounts={ctx.accounts.filter((a) => a.id !== accountId)}
            value={toAccountId}
            onChange={setToAccountId}
            error={fields.toAccountId}
          />
          {crossCurrency && toAccount && (
            <div>
              <label htmlFor="qa-to-amount" className="label">
                Qabul qilinadigan summa ({toAccount.currency})
              </label>
              <input
                id="qa-to-amount"
                inputMode="decimal"
                autoComplete="off"
                className="field num"
                placeholder="0"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                aria-invalid={Boolean(fields.toAmount)}
              />
              {fields.toAmount && (
                <p className="field-error" role="alert">
                  {fields.toAmount}
                </p>
              )}
              <p className="mt-1.5 text-xs text-ink-3" aria-live="polite">
                {rate && account
                  ? `Kurs: ${rate} (kiritilgan ikki summadan hisoblandi)`
                  : "Valyutalar har xil. Kurs o‘ylab topilmaydi — qabul qilingan summani o‘zingiz kiriting."}
              </p>
            </div>
          )}
        </>
      )}

      {/* Kategoriya */}
      {!isTransfer && !isAdjust && (
        <div>
          <span className="label" id="qa-cat-label">
            Kategoriya
          </span>
          <div role="group" aria-labelledby="qa-cat-label" className="flex flex-wrap gap-2">
            {visibleCats.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId((cur) => (cur === c.id ? null : c.id))}
              >
                <span
                  className="grid size-5 place-items-center rounded-full"
                  style={{ background: c.color, color: "#fff" }}
                  aria-hidden="true"
                >
                  <Icon name={c.icon} size={12} />
                </span>
                {c.name}
              </button>
            ))}
            {categories.length > 8 && (
              <button type="button" className="chip border-dashed" onClick={() => setShowAllCats((v) => !v)}>
                {showAllCats ? "Kamroq" : `Yana ${categories.length - 8} ta`}
              </button>
            )}
          </div>
          {fields.categoryId && <p className="field-error">{fields.categoryId}</p>}
        </div>
      )}

      {/* Izoh */}
      <div>
        <label htmlFor="qa-note" className="label">
          Izoh
        </label>
        <input
          id="qa-note"
          className="field"
          value={note}
          maxLength={200}
          autoComplete="off"
          placeholder={isAdjust ? "Masalan: Hisob-kitobdan keyin" : "Masalan: Tushlik"}
          onChange={(e) => setNote(e.target.value)}
          onFocus={() => setNoteFocused(true)}
          onBlur={() => setTimeout(() => setNoteFocused(false), 120)}
        />
        {hints.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" role="listbox" aria-label="Avvalgi izohlar">
            {hints.map((h) => (
              <button
                key={`${h.type}-${h.note}`}
                type="button"
                role="option"
                aria-selected={false}
                className="chip !min-h-8 text-xs"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyHint(h)}
              >
                {h.note}
                <span className="text-ink-3">· {h.count}×</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sana va vaqt */}
      <div>
        <span className="label" id="qa-date-label">
          Sana va vaqt
        </span>
        <div role="group" aria-labelledby="qa-date-label" className="flex flex-wrap items-center gap-2">
          <button type="button" className="chip" aria-pressed={dateKey === ctx.todayKey} onClick={() => setDay(0)}>
            Bugun
          </button>
          <button type="button" className="chip" aria-pressed={dateKey === addDays(ctx.todayKey, -1)} onClick={() => setDay(-1)}>
            Kecha
          </button>
          <input
            type="date"
            className="field !w-auto !min-h-10"
            value={dateKey}
            onChange={(e) => e.target.value && setDateKey(e.target.value)}
            aria-label="Sana"
          />
          <input
            type="time"
            className="field num !w-auto !min-h-10"
            value={time}
            onChange={(e) => e.target.value && setTime(e.target.value)}
            aria-label="Vaqt"
          />
        </div>
        {fields.date && <p className="field-error">{fields.date}</p>}
      </div>

      {/* Teglar */}
      {!isTransfer && !isAdjust && (
        <div>
          {!showTags ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTags(true)}>
              <Plus size={14} aria-hidden="true" /> Teg qo‘shish
            </button>
          ) : (
            <>
              <label htmlFor="qa-tag" className="label">
                Teglar
              </label>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-strong bg-raised p-2">
                {tags.map((tg) => (
                  <span key={tg} className="pill bg-violet-soft text-violet">
                    #{tg}
                    <button
                      type="button"
                      onClick={() => setTags((xs) => xs.filter((x) => x !== tg))}
                      aria-label={`${tg} tegini olib tashlash`}
                      className="grid size-4 place-items-center rounded-full hover:bg-violet/20"
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  id="qa-tag"
                  className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
                  placeholder={tags.length ? "" : "teg yozing va Enter bosing"}
                  value={tagInput}
                  maxLength={24}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      e.stopPropagation();
                      commitTag();
                    } else if (e.key === "Backspace" && tagInput === "" && tags.length) {
                      setTags((xs) => xs.slice(0, -1));
                    }
                  }}
                  onBlur={commitTag}
                />
              </div>
            </>
          )}
        </div>
      )}

      {duplicate && (
        <div role="alert" className="rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          <p className="font-semibold">Xuddi shunday yozuv allaqachon bor ({duplicate.time}).</p>
          <p className="mt-1 opacity-90">Adashib ikki marta kiritmadingizmi?</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void submit({ force: true })}>
              Baribir qo‘shish
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDuplicate(null)}>
              Yo‘q, tahrirlayman
            </button>
          </div>
        </div>
      )}

      {/* Harakatlar */}
      <div className="sticky bottom-[calc(-1.25rem-env(safe-area-inset-bottom))] md:-bottom-6 -mx-5 -mb-[calc(1.25rem+env(safe-area-inset-bottom))] flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 md:-mx-6 md:-mb-6 md:px-6 md:pb-5">
        {editing && (
          <button type="button" className="btn btn-danger btn-icon" onClick={remove} disabled={pending} aria-label={t.common.delete}>
            <Trash2 size={18} aria-hidden="true" />
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!editing && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void submit({ another: true })}
              disabled={pending}
              aria-keyshortcuts="Control+Enter"
              title="Ctrl+Enter"
            >
              Saqlash va yana
            </button>
          )}
          <button type="submit" className="btn btn-primary min-w-32" disabled={pending}>
            {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {t.common.save}
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-ink-3">
        <kbd className="rounded border border-line-strong px-1">Enter</kbd> saqlash ·{" "}
        <kbd className="rounded border border-line-strong px-1">Ctrl</kbd>+<kbd className="rounded border border-line-strong px-1">Enter</kbd>{" "}
        saqlash va yana · <kbd className="rounded border border-line-strong px-1">Esc</kbd> yopish
      </p>
    </form>
  );
}

function AccountPicker({
  label,
  accounts,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  accounts: QuickAddContext["accounts"];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useMemoId(label);
  return (
    <div>
      <span className="label" id={id}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="scroll-x -mx-1 flex gap-2 px-1 pb-1">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={value === a.id}
            disabled={disabled}
            className="chip shrink-0"
            onClick={() => onChange(a.id)}
          >
            <span
              className="grid size-5 place-items-center rounded-full"
              style={{ background: a.color, color: "#fff" }}
              aria-hidden="true"
            >
              <Icon name={a.icon} size={12} />
            </span>
            {a.name}
            <span className="num text-xs opacity-70">{formatMoney(a.balance, a.currency, { symbol: false })}</span>
          </button>
        ))}
        {accounts.length === 0 && <p className="text-sm text-ink-3">Hisob topilmadi</p>}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function useMemoId(label: string): string {
  return useMemo(() => `qa-${label.replace(/\s+/g, "-").toLowerCase()}`, [label]);
}
