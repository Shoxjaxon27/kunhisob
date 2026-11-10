"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/plan/budgets", label: "Byudjet" },
  { href: "/plan/debts", label: "Qarzlar" },
  { href: "/plan/goals", label: "Maqsadlar" },
];

export function PlanTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Reja bo‘limlari" className="scroll-x -mx-1 flex gap-1.5 rounded-2xl bg-sunken p-1.5">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors",
              active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
