"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArchiveRestore, Download, LogOut, Pencil, Plus, ShieldCheck, Users } from "lucide-react";
import type { SettingsDto } from "@/server/services/settings";
import type { CategoryDto } from "@/server/services/categories";
import {
  createCategoryAction,
  setCategoryArchivedAction,
  updateCategoryAction,
  updateSettingsAction,
  checkIntegrityAction,
} from "@/app/actions/data";
import type { IntegrityReport } from "@/server/services/integrity";
import { changePasswordAction, logoutAction } from "@/app/actions/auth";
import { CATEGORY_ICONS } from "@/lib/validation";
import { Modal } from "@/components/ui/modal";
import { Field, FormError } from "@/components/ui/form";
import { useToast, usePrefs, type MotionPref, type ThemePref } from "@/components/providers";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

const COLORS = ["#e5484d", "#f08a24", "#e0b400", "#0f9d6b", "#0ea5b7", "#2f6bff", "#6340d8", "#d6409f", "#64748b"];

type CatForm = { id?: string; name: string; kind: "INCOME" | "EXPENSE"; color: string; icon: string };

export function SettingsView({ settings, categories, isAdmin = false }: { settings: SettingsDto; categories: CategoryDto[]; isAdmin?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const prefs = usePrefs();

  // ── Ma'lumotlar yaxlitligi ──
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [integrityBusy, setIntegrityBusy] = useState(false);
  const [integrityErr, setIntegrityErr] = useState<string | null>(null);
  const runIntegrity = async () => {
    setIntegrityBusy(true);
    setIntegrityErr(null);
    const r = await checkIntegrityAction();
    setIntegrityBusy(false);
    if (r.ok) setIntegrity(r.data);
    else setIntegrityErr(r.error);
  };

  // ── Profil ──
  const [name, setName] = useState(settings.name);
  const [currency, setCurrency] = useState(settings.primaryCurrency);
  const [profErr, setProfErr] = useState<string | null>(null);
  const [profFields, setProfFields] = useState<Record<string, string>>({});
  const [profBusy, setProfBusy] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfBusy(true); setProfErr(null); setProfFields({});
    const res = await updateSettingsAction({ name, primaryCurrency: currency, theme: prefs.theme, motion: prefs.motion });
    setProfBusy(false);
    if (!res.ok) { setProfErr(res.error); setProfFields(res.fields ?? {}); return; }
    toast({ message: "Saqlandi", tone: "success" });
  };

  // Ko'rinish: darhol qo'llanadi va serverga saqlanadi.
  const savePrefs = async (theme: ThemePref, motion: MotionPref) => {
    prefs.setTheme(theme);
    prefs.setMotion(motion);
    const res = await updateSettingsAction({ name: settings.name, primaryCurrency: settings.primaryCurrency, theme, motion });
    if (!res.ok) toast({ message: res.error, tone: "error" });
  };

  // ── Parol ──
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwFields, setPwFields] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true); setPwErr(null); setPwFields({});
    const res = await changePasswordAction(pw);
    setPwBusy(false);
    if (!res.ok) { setPwErr(res.error); setPwFields(res.fields ?? {}); return; }
    setPw({ current: "", next: "" });
    toast({ message: "Parol almashtirildi", tone: "success" });
  };

  // ── Kategoriyalar ──
  const [cat, setCat] = useState<CatForm | null>(null);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [catFields, setCatFields] = useState<Record<string, string>>({});
  const [catBusy, setCatBusy] = useState(false);

  const openCat = (c?: CategoryDto) => {
    setCatErr(null); setCatFields({});
    setCat(c ? { id: c.id, name: c.name, kind: c.kind, color: c.color, icon: c.icon } : { name: "", kind: "EXPENSE", color: COLORS[5]!, icon: "tag" });
  };
  const saveCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cat) return;
    setCatBusy(true); setCatErr(null); setCatFields({});
    const payload = { name: cat.name, kind: cat.kind, color: cat.color, icon: cat.icon };
    const res = cat.id ? await updateCategoryAction(cat.id, payload) : await createCategoryAction(payload);
    setCatBusy(false);
    if (!res.ok) { setCatErr(res.error); setCatFields(res.fields ?? {}); return; }
    toast({ message: cat.id ? "Kategoriya yangilandi" : "Kategoriya qo‘shildi", tone: "success" });
    setCat(null);
  };
  const toggleCat = async (c: CategoryDto) => {
    const res = await setCategoryArchivedAction(c.id, !c.archived);
    toast(res.ok ? { message: c.archived ? "Kategoriya qaytarildi" : "Kategoriya arxivlandi", tone: "success" } : { message: res.error, tone: "error" });
  };

  const logout = async () => {
    await logoutAction();
    router.replace("/login");
    router.refresh();
  };

  const group = (kind: "EXPENSE" | "INCOME", title: string) => (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink-2">{title}</h3>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {categories.filter((c) => c.kind === kind).map((c) => (
          <li key={c.id} className={cn("flex items-center gap-3 px-3 py-2", c.archived && "opacity-60")}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full text-white" style={{ background: c.color }} aria-hidden="true"><Icon name={c.icon} size={15} /></span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}{c.archived && <span className="ml-2 text-xs text-ink-3">arxivda</span>}</span>
            <button type="button" className="btn btn-icon btn-sm" onClick={() => openCat(c)} aria-label={`${c.name} ni tahrirlash`}><Pencil size={15} aria-hidden="true" /></button>
            <button type="button" className="btn btn-icon btn-sm" onClick={() => toggleCat(c)} aria-label={c.archived ? `${c.name} ni qaytarish` : `${c.name} ni arxivlash`}>
              {c.archived ? <ArchiveRestore size={15} aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t.nav.settings}</h1>

      <section className="card p-5" aria-labelledby="prof-h">
        <h2 id="prof-h" className="mb-4 font-display text-lg font-semibold">Profil</h2>
        <form onSubmit={saveProfile} className="space-y-4" noValidate>
          <FormError message={profErr} />
          <Field label="Ism" htmlFor="set-name" error={profFields.name}>
            <input id="set-name" className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="set-email" hint="Email o‘zgartirilmaydi.">
            <input id="set-email" className="field" value={settings.email} readOnly />
          </Field>
          <Field label="Asosiy valyuta" htmlFor="set-cur" hint="Bosh sahifadagi asosiy ko‘rsatkichlar shu valyutada. Kurs hisoblanmaydi.">
            <select id="set-cur" className="field" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
              <option value="UZS">UZS — so‘m</option>
              <option value="USD">USD — dollar</option>
            </select>
          </Field>
          <p className="text-xs text-ink-3">Vaqt mintaqasi: {settings.timezone}</p>
          <button type="submit" className="btn btn-primary" disabled={profBusy}>{profBusy ? t.common.loading : t.common.save}</button>
        </form>
      </section>

      <section className="card space-y-5 p-5" aria-labelledby="look-h">
        <h2 id="look-h" className="font-display text-lg font-semibold">Ko‘rinish</h2>
        <div>
          <p className="label">Mavzu</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Mavzu">
            {(["LIGHT", "DARK", "SYSTEM"] as const).map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={prefs.theme === v} onClick={() => savePrefs(v, prefs.motion)}>{t.theme[v]}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Animatsiyalar</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Animatsiyalar">
            {(["FULL", "REDUCED", "OFF"] as const).map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={prefs.motion === v} onClick={() => savePrefs(prefs.theme, v)}>{t.motion[v]}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="card space-y-5 p-5" aria-labelledby="cat-h">
        <div className="flex items-center justify-between">
          <h2 id="cat-h" className="font-display text-lg font-semibold">Kategoriyalar</h2>
          <button type="button" className="btn btn-sm" onClick={() => openCat()}><Plus size={16} aria-hidden="true" /> Qo‘shish</button>
        </div>
        {group("EXPENSE", "Xarajat")}
        {group("INCOME", "Daromad")}
        <p className="text-xs text-ink-3">Arxivlangan kategoriya yangi yozuvlarda chiqmaydi, eski yozuvlar saqlanadi.</p>
      </section>

      <section className="card p-5" aria-labelledby="pw-h">
        <h2 id="pw-h" className="mb-4 font-display text-lg font-semibold">Parolni almashtirish</h2>
        <form onSubmit={changePw} className="space-y-4" noValidate>
          <FormError message={pwErr} />
          <Field label="Joriy parol" htmlFor="pw-cur" error={pwFields.current}>
            <input id="pw-cur" type="password" autoComplete="current-password" className="field" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="Yangi parol" htmlFor="pw-new" error={pwFields.next}>
            <input id="pw-new" type="password" autoComplete="new-password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <button type="submit" className="btn" disabled={pwBusy}>{pwBusy ? t.common.loading : "Almashtirish"}</button>
        </form>
      </section>

      <section className="card space-y-4 p-5" aria-labelledby="data-h">
        <h2 id="data-h" className="font-display text-lg font-semibold">Ma’lumotlar va zaxira</h2>
        <p className="text-sm text-ink-2">
          Barcha yozuvlaringizning JSON nusxasini yuklab oling (parol va sessiyalar kirmaydi). Bu nusxa saqlab qo‘yish uchun;
          ilovaga qayta yuklash (import) hali yo‘q.
        </p>
        <a className="btn" href="/api/backup" download><Download size={16} aria-hidden="true" /> JSON nusxa yuklab olish</a>
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-sm text-ink-2">Yaxlitlik tekshiruvi yozuvlardagi nomuvofiqliklarni (valyuta, yo‘nalish, qarz holati) qidiradi. Hech narsani o‘zgartirmaydi.</p>
          <button type="button" className="btn" onClick={runIntegrity} disabled={integrityBusy}>
            <ShieldCheck size={16} aria-hidden="true" /> {integrityBusy ? t.common.loading : "Tekshirish"}
          </button>
          <div aria-live="polite" className="mt-3 text-sm">
            {integrityErr && <p className="text-expense">{integrityErr}</p>}
            {integrity && (
              <>
                <p className={integrity.ok ? "font-semibold text-income" : "font-semibold text-expense"}>
                  {integrity.ok ? "Muammo topilmadi" : `${integrity.issues.length} ta muammo topildi`}
                  <span className="ml-2 font-normal text-ink-3"> 
                    (tranzaksiya {integrity.checked.transactions}, o‘tkazma {integrity.checked.transfers}, qarz {integrity.checked.debts})
                  </span>
                </p>
                {integrity.issues.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
                    {integrity.issues.slice(0, 20).map((i) => <li key={`${i.code}-${i.ref}`}>{i.message}</li>)}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="card p-5" aria-labelledby="adm-h">
          <h2 id="adm-h" className="mb-2 font-display text-lg font-semibold">Administrator</h2>
          <p className="mb-3 text-sm text-ink-2">Ilovadan kimlar foydalanayotganini ko‘rish (faqat hisob ma’lumotlari).</p>
          <Link href="/admin/users" className="btn"><Users size={16} aria-hidden="true" /> Foydalanuvchilar ro‘yxati</Link>
        </section>
      )}

      <section className="card p-5">
        <button type="button" className="btn btn-danger" onClick={logout}><LogOut size={16} aria-hidden="true" /> Chiqish</button>
      </section>

      <Modal open={cat !== null} onClose={() => setCat(null)} title={cat?.id ? "Kategoriyani tahrirlash" : "Yangi kategoriya"}>
        {cat && (
          <form onSubmit={saveCat} className="space-y-4" noValidate>
            <FormError message={catErr} />
            <Field label="Nomi" htmlFor="cat-name" error={catFields.name}>
              <input id="cat-name" data-autofocus className="field" value={cat.name} maxLength={40} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
            </Field>
            <Field label="Turi" htmlFor="cat-kind" hint={cat.id ? "Mavjud kategoriyaning turi o‘zgarmaydi" : undefined}>
              <select id="cat-kind" className="field" value={cat.kind} disabled={Boolean(cat.id)} onChange={(e) => setCat({ ...cat, kind: e.target.value as CatForm["kind"] })}>
                <option value="EXPENSE">Xarajat</option>
                <option value="INCOME">Daromad</option>
              </select>
            </Field>
            <fieldset>
              <legend className="label">Rang</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-pressed={cat.color === c} aria-label={`Rang ${c}`} onClick={() => setCat({ ...cat, color: c })}
                    className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface", cat.color === c && "ring-2 ring-ink")} style={{ background: c }} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Belgi</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ICONS.map((ic) => (
                  <button key={ic} type="button" aria-pressed={cat.icon === ic} aria-label={ic} onClick={() => setCat({ ...cat, icon: ic })} className="chip !size-10 !p-0 justify-center">
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={() => setCat(null)}>{t.common.cancel}</button>
              <button type="submit" className="btn btn-primary" disabled={catBusy}>{catBusy ? t.common.loading : t.common.save}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
