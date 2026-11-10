import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Ico,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="relative grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent">
        <span className="absolute inset-0 rounded-3xl border border-accent/20" aria-hidden="true" />
        <Ico size={28} aria-hidden="true" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Xatolik yuz berdi", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-expense-soft text-expense" aria-hidden="true">
        <span className="font-display text-3xl font-bold">!</span>
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
