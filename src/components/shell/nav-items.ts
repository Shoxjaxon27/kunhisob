import { CalendarDays, ArrowLeftRight, BarChart3, LayoutDashboard, Settings, Target, Wallet, type LucideIcon } from "lucide-react";
import { t } from "@/lib/i18n";

export type NavItem = { href: string; label: string; icon: LucideIcon; /** Telefonda pastki panelda ko'rinadimi; aks holda "Yana" menyusida. */ primary: boolean; /** Telefondagi pastki panel uchun qisqa yorliq. */ short?: string };

/** Faqat ishlaydigan sahifalar ko'rsatiladi. Yangi bo'limlar tayyor bo'lgach qo'shiladi. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Bugun", short: "Bugun", icon: LayoutDashboard, primary: true },
  { href: "/plans", label: "Rejalar", icon: CalendarDays, primary: true },
  { href: "/transactions", label: "Kirim va chiqim", short: "Yozuvlar", icon: ArrowLeftRight, primary: false },
  { href: "/accounts", label: t.nav.accounts, icon: Wallet, primary: false },
  { href: "/analytics", label: t.nav.analytics, icon: BarChart3, primary: false },
  { href: "/plan/goals", label: "Maqsadlar", icon: Target, primary: true },
  { href: "/settings", label: t.nav.settings, icon: Settings, primary: false },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
