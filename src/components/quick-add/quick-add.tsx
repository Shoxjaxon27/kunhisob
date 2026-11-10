"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/ui/modal";
import { loadQuickAdd } from "@/app/actions/quick-add";
import type { QuickAddContext } from "@/server/services/quick-add";
import type { FeedKind } from "@/app/actions/data";

const QuickAddForm = dynamic(() => import("./quick-add-form"), { loading: () => <p role="status">Forma ochilmoqda…</p> });
export type QuickAddMode = "EXPENSE" | "INCOME" | "REFUND" | "TRANSFER" | "ADJUSTMENT";
export type OpenOptions = {
  mode?: Extract<QuickAddMode, "EXPENSE" | "INCOME">;
  accountId?: string;
  edit?: { kind: FeedKind; id: string };
};

type QuickAddApi = { open: (opts?: OpenOptions) => void };
const QuickAddCtx = createContext<QuickAddApi | null>(null);

export function useQuickAdd(): QuickAddApi {
  const v = useContext(QuickAddCtx);
  if (!v) throw new Error("useQuickAdd: QuickAddProvider topilmadi");
  return v;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; opts: OpenOptions }>({ open: false, opts: {} });
  const [ctx, setContext] = useState<QuickAddContext | null>(null);
  const [failed, setFailed] = useState(false);
  const sequence = useRef(0);
  const openRef = useRef(false);
  openRef.current = state.open;

  const open = useCallback((opts: OpenOptions = {}) => {
    const request = ++sequence.current;
    setContext(null);
    setFailed(false);
    setState({ open: true, opts });
    loadQuickAdd().then(data => {
      if (sequence.current === request) setContext(data);
    }).catch(() => {
      if (sequence.current === request) setFailed(true);
    });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  // "N" — istalgan joydan tez kiritish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target) || openRef.current) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const api = useMemo<QuickAddApi>(() => ({ open }), [open]);

  return (
    <QuickAddCtx.Provider value={api}>
      {children}
      <Modal
        open={state.open}
        onClose={close}
        title={state.opts.edit ? "Yozuvni tahrirlash" : "Yangi yozuv"}
        hideTitle
        size="md"
      >
        {ctx ? <QuickAddForm ctx={ctx} opts={state.opts} onClose={close} /> : failed ?
          <button className="btn" onClick={() => open(state.opts)}>Yuklab bo‘lmadi. Qayta urinish</button> :
          <p role="status">Hisoblar yuklanmoqda…</p>}
      </Modal>
    </QuickAddCtx.Provider>
  );
}

