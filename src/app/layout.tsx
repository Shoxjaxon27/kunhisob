import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PrefsProvider, ToastProvider } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KunHisob — Shaxsiy moliya tizimi", template: "%s · KunHisob" },
  description: "Kunlik hisob-kitob va moliyaviy boshqaruv uchun shaxsiy markaz.",
  applicationName: "KunHisob",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e10" },
  ],
};

/** Birinchi chizishdan oldin theme va animatsiya sozlamasini qo'llaydi (miltillashsiz). */
const INIT_SCRIPT = `(function(){try{
var d=document.documentElement,t=localStorage.getItem('finova-theme')||'SYSTEM',m=localStorage.getItem('finova-motion')||'FULL';
var dark=t==='DARK'||(t==='SYSTEM'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
d.dataset.theme=dark?'dark':'light';d.dataset.motion=m.toLowerCase();
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning data-theme="light" data-motion="full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
      </head>
      <body className="font-sans">
        <div className="atmosphere" aria-hidden="true" />
        <PrefsProvider>
          <ToastProvider>{children}</ToastProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
