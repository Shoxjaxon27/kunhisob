"use client";

import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { formatMoney } from "@/domain/money";
import { formatTime } from "@/domain/time";
import type { FeedItem } from "@/server/services/feed";
import { deleteFeedItemAction, restoreFeedItemAction } from "@/app/actions/data";
import { useQuickAdd } from "@/components/quick-add/quick-add";
import { useToast } from "@/components/providers";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

function amountTone(type: string, flow: "IN" | "OUT"): string {
  if (type === "INCOME" || type === "REFUND") return "text-income";
  if (type === "EXPENSE") return "text-expense";
  return flow === "IN" ? "text-income" : "text-ink";
}

/**
 * Tranzaksiya qatori. Bosilganda tahrirlash oynasi ochiladi.
 * Summa rangi yagona belgi emas: doim +/− belgisi va tur nomi ham bor.
 */
export function TxRow({ item, compact = false }: { item: FeedItem; compact?: boolean }) {
  const { open } = useQuickAdd();
  const toast = useToast();

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await deleteFeedItemAction(item.kind, item.id);
    if (!res.ok) {
      toast({ message: res.error, tone: "error" });
      return;
    }
    toast({
      message: "Yozuv o‘chirildi",
      action: {
        label: t.common.undo,
        onClick: async () => {
          const r = await restoreFeedItemAction(item.kind, item.id);
          toast(r.ok ? { message: "Tiklandi", tone: "info" } : { message: r.error, tone: "error" });
        },
      },
    });
  };

  let iconName: string;
  let color: string;
  let title: string;
  let meta: string;
  let amountNode: React.ReactNode;
  let typeLabel: string;

  if (item.kind === "tx") {
    typeLabel = t.txType[item.type] ?? item.type;
    iconName = item.category?.icon ?? (item.type === "REFUND" ? "refund" : item.type === "ADJUSTMENT" ? "adjustment" : item.type.startsWith("DEBT_") ? "coins" : "tag");
    color = item.category?.color ?? "#64748b";
    title = item.note || item.category?.name || typeLabel;
    const parts = [
      item.note && item.category ? item.category.name : null,
      item.type === "REFUND" || item.type === "ADJUSTMENT" || item.type.startsWith("DEBT_") ? typeLabel : null,
      item.account.name,
      formatTime(item.occurredAt),
    ].filter(Boolean);
    meta = parts.join(" · ");
    amountNode = (
      <span className={cn("num font-semibold", amountTone(item.type, item.flow))}>
        {formatMoney(item.flow === "IN" ? item.amount : -item.amount, item.currency, { sign: "always" })}
      </span>
    );
  } else {
    typeLabel = t.txType.TRANSFER!;
    iconName = "transfer";
    color = "#6340d8";
    title = `${item.from.name} → ${item.to.name}`;
    meta = [item.note, typeLabel, formatTime(item.occurredAt)].filter(Boolean).join(" · ");
    const cross = item.fromCurrency !== item.toCurrency;
    amountNode = (
      <span className="num flex flex-col items-end font-semibold text-ink">
        <span>{formatMoney(item.fromAmount, item.fromCurrency)}</span>
        {cross && (
          <span className="flex items-center gap-1 text-xs font-medium text-ink-3">
            <ArrowRight size={11} aria-hidden="true" />
            {formatMoney(item.toAmount, item.toCurrency)}
          </span>
        )}
      </span>
    );
  }

  const tags = item.kind === "tx" ? item.tags : [];
  const isDebt = item.kind === "tx" && item.type.startsWith("DEBT_");

  // Qarz harakatlari faqat qarzlar bo'limida boshqariladi.
  const Wrapper = (isDebt ? Link : "button") as React.ElementType;

  return (
    <div
      className="group relative flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-sunken/70 focus-within:bg-sunken/70"
    >
      <Wrapper
        {...(isDebt
          ? { href: "/plan/debts", "aria-label": `${title}, ${typeLabel}. Qarzlar bo‘limida ko‘rish` }
          : { type: "button" as const, onClick: () => open({ edit: { kind: item.kind, id: item.id } }), "aria-label": `${title}, ${typeLabel}. Tahrirlash` })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-offset-4"
      >
        <span
          className={cn("grid shrink-0 place-items-center rounded-full text-white", compact ? "size-9" : "size-11")}
          style={{ background: color }}
          aria-hidden="true"
        >
          <Icon name={iconName} size={compact ? 16 : 19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold leading-tight">{title}</span>
          <span className="mt-0.5 block truncate text-[0.8rem] text-ink-3">
            {meta}
            {tags.length > 0 && <span className="text-violet"> {tags.map((x) => `#${x}`).join(" ")}</span>}
          </span>
        </span>
        <span className="shrink-0 text-right text-[0.95rem]">{amountNode}</span>
      </Wrapper>
      {!isDebt && <button
        type="button"
        onClick={remove}
        className="btn btn-icon btn-sm hidden shrink-0 text-ink-3 opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 md:inline-flex"
        aria-label={`${title} ni o‘chirish`}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>}
    </div>
  );
}
