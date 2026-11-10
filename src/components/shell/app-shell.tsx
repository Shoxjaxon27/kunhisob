"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QuickAddProvider } from "@/components/quick-add/quick-add";
import { usePrefs, type MotionPref, type ThemePref } from "@/components/providers";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { CommandBar } from "./command-bar";

/** Serverdagi (DB) sozlamalarni brauzer holatiga sinxronlaydi. */
function PrefsSync({ theme, motion }: { theme: ThemePref; motion: MotionPref }) {
  const prefs = usePrefs();
  const { setTheme, setMotion } = prefs;
  useEffect(() => setTheme(theme), [theme, setTheme]);
  useEffect(() => setMotion(motion), [motion, setMotion]);
  return null;
}

export function AppShell({
  children,
  userName,
  theme,
  motion,
}: {
  children: ReactNode;
  userName: string;
  theme: ThemePref;
  motion: MotionPref;
}) {
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <QuickAddProvider>
      <PrefsSync theme={theme} motion={motion} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
      >
        Asosiy mazmunga o‘tish
      </a>
      <div className="mx-auto flex min-h-dvh w-full max-w-[100rem]">
        <Sidebar userName={userName} onOpenCommand={() => setCommandOpen(true)} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-32 pt-6 outline-none sm:px-6 md:px-6 md:pb-12 md:pt-8 lg:px-10">
          {children}
        </main>
      </div>
      <BottomNav />
      <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
    </QuickAddProvider>
  );
}
