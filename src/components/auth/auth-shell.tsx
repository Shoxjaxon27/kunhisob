import type { ReactNode } from "react";

/** Kirish va ro'yxatdan o'tish uchun umumiy maket: chapda brend paneli, o'ngda forma. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[88rem] lg:grid-cols-[1.1fr_1fr]">
      <section
        className="relative hidden overflow-hidden px-12 py-12 lg:flex lg:flex-col lg:gap-32"
        aria-label="KunHisob haqida"
      >
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-ink font-display text-lg font-bold text-bg">K</span>
          <span className="font-display text-xl font-semibold tracking-tight">KunHisob</span>
        </div>

        <div className="relative max-w-xl">
          
          <h1 className="font-display text-[4.2rem] font-semibold leading-[0.98] tracking-[-0.035em]">
            Bugun qancha<br />
            <span className="text-accent">sarflay olaman?</span>
          </h1>
          <p className="mt-6 max-w-sm text-lg text-ink-2">Kundalik xarajatlaringizni yozing va keyingi maoshgacha qancha pul qolishini ko‘ring.</p>
        </div>

        
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="card w-full max-w-md p-5 sm:p-8">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-ink font-display text-lg font-bold text-bg">K</span>
            <span className="font-display text-xl font-semibold tracking-tight">KunHisob</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
