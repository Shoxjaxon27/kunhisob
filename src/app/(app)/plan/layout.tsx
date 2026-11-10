import type { ReactNode } from "react";
import { PlanTabs } from "@/components/plan/plan-tabs";

export default function PlanLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Moliyaviy rejalar</h1>
      <PlanTabs />
      {children}
    </div>
  );
}
