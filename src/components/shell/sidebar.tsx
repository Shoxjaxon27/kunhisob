"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChevronsLeft, ChevronsRight, Plus, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, isActive } from "./nav-items";
import { useQuickAdd } from "@/components/quick-add/quick-add";

const STORAGE_KEY = "finova-sidebar";

export function Sidebar({ userName, onOpenCommand }: { userName: string; onOpenCommand: () => void }) {
  const pathname = usePathname();
  const { open } = useQuickAdd();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* e'tiborsiz */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {
        /* e'tiborsiz */
      }
      return !c;
    });
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 84 : 272 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="glass sticky top-0 z-30 m-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col overflow-hidden rounded-[1.75rem] p-3 md:flex"
      aria-label="Asosiy navigatsiya"
    >
      <div className={cn("flex items-center gap-3 px-2 pb-4 pt-2", collapsed && "justify-center px-0")}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink font-display text-lg font-bold text-bg">K</span>
        {!collapsed && <span className="font-display text-xl font-semibold tracking-tight">KunHisob</span>}
      </div>

      <button
        type="button"
        onClick={() => open()}
        className={cn("btn btn-lime mb-2 w-full", collapsed && "!px-0")}
        aria-label="Yangi yozuv (N)"
        aria-keyshortcuts="N"
      >
        <Plus size={20} aria-hidden="true" />
        {!collapsed && (
          <>
            <span>Yangi yozuv</span>
            <kbd className="ml-auto rounded-md bg-black/10 px-1.5 py-0.5 text-[0.7rem] font-bold">N</kbd>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onOpenCommand}
        className={cn("btn btn-ghost mb-4 w-full justify-start text-ink-2", collapsed && "justify-center !px-0")}
        aria-label="Buyruqlar paneli (Ctrl+K)"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search size={18} aria-hidden="true" />
        {!collapsed && (
          <>
            <span className="font-medium">Qidirish…</span>
            <kbd className="ml-auto rounded-md border border-line-strong px-1.5 py-0.5 text-[0.7rem] font-semibold text-ink-3">Ctrl K</kbd>
          </>
        )}
      </button>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Bo‘limlar">
        {NAV_ITEMS.map(({ href, label, icon: Ico }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold transition-colors",
                collapsed && "justify-center px-0",
                active ? "text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-raised shadow-[var(--shadow-card)] ring-1 ring-line"
                  transition={{ type: "spring", stiffness: 520, damping: 40 }}
                />
              )}
              <Ico size={20} className={cn("relative", active && "text-accent")} aria-hidden="true" />
              {!collapsed && <span className="relative">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("mt-2 flex items-center gap-3 rounded-xl p-2", collapsed && "justify-center")}>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-violet-soft text-sm font-bold text-violet"
          aria-hidden="true"
        >
          {userName.trim().charAt(0).toUpperCase() || "?"}
        </span>
        {!collapsed && <span className="min-w-0 flex-1 truncate text-sm font-semibold">{userName}</span>}
        <button
          type="button"
          onClick={toggle}
          className="btn btn-ghost btn-icon btn-sm shrink-0"
          aria-label={collapsed ? "Sidebarni kengaytirish" : "Sidebarni yig‘ish"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronsRight size={16} aria-hidden="true" /> : <ChevronsLeft size={16} aria-hidden="true" />}
        </button>
      </div>
    </motion.aside>
  );
}
