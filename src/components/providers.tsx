"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ThemePref = "LIGHT" | "DARK" | "SYSTEM";
export type MotionPref = "FULL" | "REDUCED" | "OFF";

type Prefs = {
  theme: ThemePref;
  motion: MotionPref;
  resolvedTheme: "light" | "dark";
  setTheme: (t: ThemePref) => void;
  setMotion: (m: MotionPref) => void;
};

const PrefsContext = createContext<Prefs | null>(null);

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs: PrefsProvider topilmadi");
  return ctx;
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  } catch {
    /* localStorage mavjud emas */
  }
  return fallback;
}

export function PrefsProvider({
  children,
  initialTheme,
  initialMotion,
}: {
  children: ReactNode;
  /** Server (DB) dagi qiymat; yo'q bo'lsa localStorage ishlatiladi. */
  initialTheme?: ThemePref;
  initialMotion?: MotionPref;
}) {
  const [theme, setThemeState] = useState<ThemePref>(
    () => initialTheme ?? readStored("finova-theme", ["LIGHT", "DARK", "SYSTEM"] as const, "SYSTEM"),
  );
  const [motionPref, setMotionState] = useState<MotionPref>(
    () => initialMotion ?? readStored("finova-motion", ["FULL", "REDUCED", "OFF"] as const, "FULL"),
  );
  // Holat DOMga to'g'ridan-to'g'ri chizilmaydi, shuning uchun boshlang'ich qiymatni
  // brauzerdan o'qish gidratsiya xatosiga olib kelmaydi va birinchi chizishda miltillash bo'lmaydi.
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: "light" | "dark" = theme === "SYSTEM" ? (systemDark ? "dark" : "light") : theme === "DARK" ? "dark" : "light";

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    try {
      localStorage.setItem("finova-theme", theme);
    } catch {
      /* e'tiborsiz */
    }
  }, [theme, resolvedTheme]);

  useEffect(() => {
    document.documentElement.dataset.motion = motionPref.toLowerCase();
    try {
      localStorage.setItem("finova-motion", motionPref);
    } catch {
      /* e'tiborsiz */
    }
  }, [motionPref]);

  const value = useMemo<Prefs>(
    () => ({ theme, motion: motionPref, resolvedTheme, setTheme: setThemeState, setMotion: setMotionState }),
    [theme, motionPref, resolvedTheme],
  );

  return (
    <PrefsContext.Provider value={value}>
      <MotionConfig
        reducedMotion="user"
        transition={motionPref === "OFF" ? { duration: 0 } : motionPref === "REDUCED" ? { duration: 0.08 } : undefined}
      >
        {children}
      </MotionConfig>
    </PrefsContext.Provider>
  );
}

// ───────────────────────── Toast ─────────────────────────

type ToastTone = "success" | "error" | "info";
type ToastInput = {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void | Promise<void> };
  durationMs?: number;
};
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast(): (t: ToastInput) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast: ToastProvider topilmadi");
  return ctx.toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      setItems((xs) => [...xs.slice(-2), { ...input, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), input.durationMs ?? (input.action ? 7000 : 4000)),
      );
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6"
        role="region"
        aria-label="Bildirishnomalar"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const tone = item.tone ?? "success";
            const Ico = tone === "success" ? CheckCircle2 : tone === "error" ? TriangleAlert : Info;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                role={tone === "error" ? "alert" : "status"}
                className="glass pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-[var(--shadow-pop)]"
              >
                <Ico
                  size={18}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0",
                    tone === "success" && "text-income",
                    tone === "error" && "text-danger",
                    tone === "info" && "text-ink-2",
                  )}
                />
                <p className="min-w-0 flex-1 text-sm font-medium">{item.message}</p>
                {item.action && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      dismiss(item.id);
                      await item.action?.onClick();
                    }}
                  >
                    {item.action.label}
                  </button>
                )}
                <button type="button" className="btn btn-icon btn-sm text-ink-3" onClick={() => dismiss(item.id)} aria-label="Yopish">
                  <X size={16} aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
