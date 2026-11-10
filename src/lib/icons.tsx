import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Car,
  Clapperboard,
  Coins,
  CreditCard,
  GraduationCap,
  Gift,
  HeartPulse,
  Home,
  Landmark,
  PiggyBank,
  Scale,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Undo2,
  Users,
  Utensils,
  Wallet,
  Wifi,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  banknote: Banknote,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  landmark: Landmark,
  briefcase: Briefcase,
  coins: Coins,
  smartphone: Smartphone,
  "shopping-basket": ShoppingBasket,
  car: Car,
  home: Home,
  wifi: Wifi,
  "heart-pulse": HeartPulse,
  shirt: Shirt,
  "graduation-cap": GraduationCap,
  clapperboard: Clapperboard,
  utensils: Utensils,
  gift: Gift,
  users: Users,
  tag: Tag,
  "trending-up": TrendingUp,
  sparkles: Sparkles,
  transfer: ArrowLeftRight,
  refund: Undo2,
  adjustment: Scale,
};

export function iconByName(name: string): LucideIcon {
  return ICONS[name] ?? Tag;
}

export function Icon({ name, className, size = 18 }: { name: string; className?: string; size?: number }) {
  const C = iconByName(name);
  return <C className={className} size={size} aria-hidden="true" strokeWidth={2} />;
}
