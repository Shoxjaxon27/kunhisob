import { cn } from "@/lib/cn";

export type ProgressTone = "ok" | "warn" | "over" | "done" | "neutral";

const TONE: Record<ProgressTone, string> = {
  ok: "bg-income",
  warn: "bg-warn",
  over: "bg-expense",
  done: "bg-income",
  neutral: "bg-accent",
};

/**
 * Progress chizig'i. Rang yagona belgi emas: holat doim matn bilan ham beriladi (aria-valuetext va ko'rinadigan yorliq).
 */
export function ProgressBar({
  pct,
  tone = "neutral",
  label,
  valueText,
  color,
}: {
  pct: number;
  tone?: ProgressTone;
  label: string;
  valueText: string;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-valuetext={valueText}
      className="h-2.5 overflow-hidden rounded-full bg-sunken"
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", !color && TONE[tone])}
        style={{ width: `${Math.max(clamped, clamped > 0 ? 1.5 : 0)}%`, ...(color ? { background: color } : {}) }}
      />
    </div>
  );
}
