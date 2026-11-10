"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Menu, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { NAV_ITEMS, isActive, type NavItem } from "./nav-items";
import { useQuickAdd } from "@/components/quick-add/quick-add";

const ITEM_CLASS =
  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition-colors";

/**
 * Telefon uchun ixcham pastki navigatsiya: markazda katta "Qo'shish" tugmasi.
 * Asosiy bo'limlar panelda, qolganlari ("Hisoblar", "Sozlamalar") "Yana" menyusida.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { open } = useQuickAdd();
  const [moreOpen, setMoreOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const primary = NAV_ITEMS.filter((n) => n.primary);
  const secondary = NAV_ITEMS.filter((n) => !n.primary);
  const left = primary.slice(0, 2);
  const right = primary.slice(2);
  const secondaryActive = secondary.some((n) => isActive(pathname, n.href));

  // Sahifa almashsa yoki tashqariga bosilsa / Esc bosilsa menyu yopiladi.
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const indicator = (
    <motion.span
      layoutId="bottom-nav-active"
      className="absolute top-0 h-1 w-8 rounded-full bg-accent"
      transition={{ type: "spring", stiffness: 520, damping: 40 }}
    />
  );

  const renderItem = ({ href, label, short, icon: Ico }: NavItem) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(ITEM_CLASS, active ? "text-ink" : "text-ink-3")}
      >
        {active && indicator}
        <Ico size={22} aria-hidden="true" className={active ? "text-accent" : undefined} />
        <span aria-hidden={short ? "true" : undefined}>{short ?? label}</span>
        {short && <span className="sr-only">{label}</span>}
      </Link>
    );
  };

  return (
    <div ref={rootRef} className="md:hidden">
      {moreOpen && (
        <div
          id="more-menu"
          className="fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] right-3 z-40 w-52 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]"
        >
          <ul>
            {secondary.map(({ href, label, icon: Ico }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold hover:bg-sunken",
                      active ? "text-ink" : "text-ink-2",
                    )}
                  >
                    <Ico size={19} aria-hidden="true" className={active ? "text-accent" : undefined} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <nav
        aria-label="Asosiy navigatsiya"
        className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center rounded-[1.6rem] px-1 shadow-[var(--shadow-pop)]"
      >
        {left.map(renderItem)}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => open()}
            className="btn btn-lime -mt-7 size-14 rounded-full !p-0 shadow-[var(--shadow-pop)]"
            aria-label="Yangi yozuv qo‘shish"
          >
            <Plus size={26} aria-hidden="true" strokeWidth={2.4} />
          </button>
        </div>
        {right.map(renderItem)}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-controls="more-menu"
          className={cn(ITEM_CLASS, secondaryActive || moreOpen ? "text-ink" : "text-ink-3")}
        >
          {secondaryActive && indicator}
          <Menu size={22} aria-hidden="true" className={secondaryActive || moreOpen ? "text-accent" : undefined} />
          <span>{t.nav.more}</span>
        </button>
      </nav>
    </div>
  );
}
