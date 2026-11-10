"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Receipt, Search, X } from "lucide-react";
import { formatDayLabel, dayKeyOf, monthRange } from "@/domain/time";
import type { FeedItem } from "@/server/services/feed";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuickAdd } from "@/components/quick-add/quick-add";
import { TxRow } from "./tx-row";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";

type Filters = { q: string; type: string; accountId: string; categoryId: string; from: string; to: string; range: string };

const PRESETS: { id: string; label: string }[] = [
  { id: "today", label: "Bugun" },
  { id: "yesterday", label: "Kecha" },
  { id: "7d", label: "7 kun" },
  { id: "30d", label: "30 kun" },
  { id: "this-month", label: "Shu oy" },
  { id: "last-month", label: "O‘tgan oy" },
  { id: "year", label: "Shu yil" },
];
const TYPES = ["INCOME", "EXPENSE", "REFUND", "TRANSFER", "ADJUSTMENT"];

export function TransactionsView({
  items,
  hasMore,
  limit,
  todayKey,
  accounts,
  categories,
  filters,
}: {
  items: FeedItem[];
  hasMore: boolean;
  limit: number;
  todayKey: string;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; kind: string }[];
  filters: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { open } = useQuickAdd();
  const [pending, startTransition] = useTransition();
  const [unit, setUnit] = useState<"date" | "month">("date");
  const [q, setQ] = useState(filters.q);

  useEffect(() => setQ(filters.q), [filters.q]);

  const push = (patch: Partial<Filters> & { limit?: number }) => {
    const next = { ...filters, ...patch };
    // Preset tanlansa qo'lda sana tozalanadi va aksincha.
    if (patch.range !== undefined) { next.from = ""; next.to = ""; }
    if (patch.from !== undefined || patch.to !== undefined) next.range = "";
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.type) p.set("type", next.type);
    if (next.accountId) p.set("accountId", next.accountId);
    if (next.categoryId) p.set("categoryId", next.categoryId);
    if (next.range) p.set("range", next.range);
    else {
      if (next.from) p.set("from", next.from);
      if (next.to) p.set("to", next.to);
    }
    if (patch.limit && patch.limit > 40) p.set("limit", String(patch.limit));
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Qidiruv: yozishdan keyin biroz kutib URLga yoziladi.
  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => push({ q: q.trim() }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = Boolean(filters.q || filters.type || filters.accountId || filters.categoryId || filters.from || filters.to || filters.range);

  const groups = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const it of items) {
      const k = dayKeyOf(it.occurredAt);
      const arr = map.get(k);
      if (arr) arr.push(it);
      else map.set(k, [it]);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t.nav.transactions}</h1>
        <button type="button" className="btn btn-primary" onClick={() => open()}>
          <Plus size={18} aria-hidden="true" /> Tranzaksiya qo‘shish
        </button>
      </header>

      <section className="card space-y-3 p-4" aria-label="Filtrlar">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            className="field pl-9"
            placeholder="Izoh, kategoriya, hisob yoki #teg bo‘yicha qidirish"
            aria-label="Qidirish"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Tur">
          <button type="button" className={cn("chip", !filters.type && "chip-active")} aria-pressed={!filters.type} onClick={() => push({ type: "" })}>
            {t.common.all}
          </button>
          {TYPES.map((ty) => (
            <button key={ty} type="button" className={cn("chip", filters.type === ty && "chip-active")} aria-pressed={filters.type === ty} onClick={() => push({ type: ty })}>
              {t.txType[ty]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Davr">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={cn("chip", filters.range === p.id && "chip-active")} aria-pressed={filters.range === p.id} onClick={() => push({ range: filters.range === p.id ? "" : p.id })}>
              {p.label}
            </button>
          ))}
        </div>

        <form className="space-y-3" onSubmit={event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const first = String(data.get("from") || "");
          const last = String(data.get("to") || "");
          if (first && last && first > last) {
            const input = event.currentTarget.elements.namedItem("to") as HTMLInputElement;
            input.setCustomValidity("Tugash muddati boshlanishidan oldin bo‘lishi mumkin emas.");
            input.reportValidity();
            return;
          }
          push({
            from: unit === "month" && first ? monthRange(first).firstDay : first,
            to: unit === "month" && last ? monthRange(last).lastDay : last,
          });
        }} onInput={event => {
          const input = event.currentTarget.elements.namedItem("to") as HTMLInputElement;
          input.setCustomValidity("");
        }}>
          <div className="flex gap-2" role="group" aria-label="Oraliq turi">
            <button type="button" className={cn("chip", unit === "date" && "chip-active")} aria-pressed={unit === "date"} onClick={() => setUnit("date")}>Sanadan sanagacha</button>
            <button type="button" className={cn("chip", unit === "month" && "chip-active")} aria-pressed={unit === "month"} onClick={() => setUnit("month")}>Oydan oygacha</button>
          </div>
          <div key={`${unit}-${filters.from}-${filters.to}`} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label>{unit === "month" ? "Boshlanish oyi" : "Boshlanish sanasi"}
              <input name="from" type={unit} className="field mt-1" defaultValue={unit === "month" ? filters.from.slice(0, 7) : filters.from} />
            </label>
            <label>{unit === "month" ? "Tugash oyi" : "Tugash sanasi"}
              <input name="to" type={unit} className="field mt-1" defaultValue={unit === "month" ? filters.to.slice(0, 7) : filters.to} />
            </label>
            <button className="btn btn-primary" type="submit">Tranzaksiyalarni ko‘rsatish</button>
          </div>
        </form>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-ink-3">
            Hisob
            <select className="field mt-1" value={filters.accountId} onChange={(e) => push({ accountId: e.target.value })}>
              <option value="">{t.common.all}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-3">
            Kategoriya
            <select className="field mt-1" value={filters.categoryId} onChange={(e) => push({ categoryId: e.target.value })}>
              <option value="">{t.common.all}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        {active && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(""); startTransition(() => router.replace(pathname, { scroll: false })); }}>
            <X size={14} aria-hidden="true" /> Filtrlarni tozalash
          </button>
        )}
      </section>

      <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {groups.length === 0 ? (
          <section className="card">
            {active ? (
              <EmptyState icon={Search} title="Hech narsa topilmadi" description="Filtrlarni o‘zgartirib ko‘ring yoki tozalang." />
            ) : (
              <EmptyState
                icon={Receipt}
                title="Hali yozuv yo‘q"
                description="Birinchi xarajat yoki daromadni qo‘shing."
                action={<button type="button" className="btn btn-primary" onClick={() => open()}><Plus size={18} aria-hidden="true" /> Tranzaksiya qo‘shish</button>}
              />
            )}
          </section>
        ) : (
          <div className="space-y-4">
            {groups.map(([day, rows]) => (
              <section key={day} className="card p-3" aria-label={formatDayLabel(day, todayKey)}>
                <h2 className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{formatDayLabel(day, todayKey)}</h2>
                {rows.map((it) => <TxRow key={`${it.kind}-${it.id}`} item={it} />)}
              </section>
            ))}
            {hasMore && (
              <div className="flex justify-center">
                <button type="button" className="btn" disabled={pending} onClick={() => push({ limit: Math.min(limit + 40, 500) })}>
                  Yana yuklash
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
