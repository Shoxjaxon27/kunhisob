"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, CornerDownLeft, Plus, Search, TrendingUp, Undo2, Scale, TrendingDown, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useQuickAdd, type QuickAddMode } from "@/components/quick-add/quick-add";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/cn";

type Command = { id: string; label: string; group: string; icon: LucideIcon; run: () => void; keywords?: string };

/** Ctrl/Cmd+K: tez harakatlar va sahifalarga o'tish, tranzaksiyalardan qidirish. */
export function CommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Buyruqlar paneli" hideTitle size="md">
      <CommandList onClose={onClose} />
    </Modal>
  );
}

function CommandList({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { open: openQuickAdd } = useQuickAdd();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const add = (mode: QuickAddMode, label: string, icon: LucideIcon, keywords: string): Command => ({
      id: `add-${mode}`,
      label,
      group: "Yangi yozuv",
      icon,
      keywords,
      run: () => {
        onClose();
        openQuickAdd({ mode });
      },
    });
    return [
      add("EXPENSE", "Yangi xarajat", TrendingDown, "xarajat chiqim sarf"),
      add("INCOME", "Yangi daromad", TrendingUp, "daromad kirim maosh"),
      add("TRANSFER", "Hisoblar orasida o‘tkazma", ArrowLeftRight, "otkazma perevod"),
      add("REFUND", "Qaytim (refund)", Undo2, "qaytim refund"),
      add("ADJUSTMENT", "Balansni tuzatish", Scale, "tuzatish balans"),
      ...NAV_ITEMS.map<Command>((n) => ({
        id: `nav-${n.href}`,
        label: n.label,
        group: "Sahifalar",
        icon: n.icon,
        run: () => {
          onClose();
          router.push(n.href);
        },
      })),
    ];
  }, [onClose, openQuickAdd, router]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, q]);

  const items = useMemo<Command[]>(() => {
    if (!q) return filtered;
    return [
      ...filtered,
      {
        id: "search",
        label: `Tranzaksiyalardan qidirish: “${query.trim()}”`,
        group: "Qidiruv",
        icon: Search,
        run: () => {
          onClose();
          router.push(`/transactions?q=${encodeURIComponent(query.trim())}`);
        },
      },
    ];
  }, [filtered, q, query, onClose, router]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  };

  let lastGroup = "";
  return (
    <div onKeyDown={onKey}>
      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          ref={inputRef}
          data-autofocus
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
          aria-label="Buyruq yoki qidiruv"
          className="field !pl-10"
          placeholder="Buyruq yozing yoki qidiring…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul id={listId} role="listbox" className="max-h-[50dvh] space-y-0.5 overflow-y-auto">
        {items.map((c, i) => {
          const header = c.group !== lastGroup ? c.group : null;
          lastGroup = c.group;
          return (
            <li key={c.id} role="presentation">
              {header && <p className="eyebrow px-3 pb-1 pt-3">{header}</p>}
              <button
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={c.run}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium",
                  i === active ? "bg-sunken text-ink" : "text-ink-2",
                )}
              >
                {c.group === "Yangi yozuv" ? <Plus size={16} className="text-accent" aria-hidden="true" /> : null}
                <c.icon size={18} aria-hidden="true" className={c.group === "Yangi yozuv" ? "hidden" : "text-ink-3"} />
                <span className="flex-1">{c.label}</span>
                {i === active && <CornerDownLeft size={14} className="text-ink-3" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
        {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-3">Hech narsa topilmadi</li>}
      </ul>
    </div>
  );
}
