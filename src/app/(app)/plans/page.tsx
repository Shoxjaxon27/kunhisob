import Link from "next/link";
import { addPlan, cancelPlan, finishPlan } from "@/app/actions/personal";
import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { formatMoney, isCurrency, minorToInput } from "@/domain/money";
import { dayKeyOf, formatDayShort } from "@/domain/time";

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const query = await searchParams;
  const done = query.status === "done";
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.page) || 1)));
  const pageSize = 20;
  const listUrl = (index: number) => `/plans?status=${done ? "done" : "open"}&page=${index}`;
  const { id: userId } = await requireOnboardedUser();
  const db = getDb();
  const [plans, accounts, settings] = await Promise.all([
    db.personalPlan.findMany({ where: { userId, completedAt: done ? { not: null } : null }, orderBy: [{ date: done ? "desc" : "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize + 1 }),
    db.account.findMany({ where: { userId, archivedAt: null }, orderBy: { name: "asc" } }),
    db.settings.findUnique({ where: { userId } }),
  ]);
  const currency = settings?.primaryCurrency ?? "UZS";
  return <div className="space-y-5">
    <h1 className="font-display text-3xl font-semibold">Rejalar</h1>
    <form action={addPlan} className="card grid gap-4 p-5 sm:grid-cols-2">
      <label>Reja nomi<input className="field" name="title" required maxLength={120} placeholder="Masalan, do‘stlar bilan uchrashuv" /></label>
      <label>Sana<input className="field" type="date" name="date" required defaultValue={dayKeyOf(new Date())} /></label>
      <label>Taxminiy xarajat ({currency})<input className="field" type="number" name="estimate" min="0" max="10000000000000" step=".01" placeholder="0" /></label>
      <input type="hidden" name="currency" value={currency} />
      <button className="btn btn-primary self-end">Reja qo‘shish</button>
    </form>
    <nav aria-label="Rejalarni saralash" className="flex gap-2">
      <Link href="/plans" className={done ? "btn" : "btn btn-primary"}>Kutilayotgan</Link>
      <Link href="/plans?status=done" className={done ? "btn btn-primary" : "btn"}>Bajarilgan</Link>
    </nav>
    {plans.length === 0 && <p>{done ? "Bajarilgan rejalar yo‘q." : "Bu yerda kutilayotgan rejalar yo‘q."}</p>}
    {plans.slice(0, pageSize).map(p => {
      if (!isCurrency(p.currency)) return null;
      return <article key={p.id} className="card space-y-3 p-5">
        <p className="text-sm text-ink-3">{formatDayShort(p.date)} · {p.completedAt ? "Bajarilgan" : "Rejalashtirilgan"}</p>
        <h2 className="text-xl font-semibold">{p.title}</h2>
        <p>Taxminiy xarajat · {formatMoney(p.estimate, p.currency)}</p>
        {!p.completedAt && <><details><summary className="cursor-pointer font-semibold text-accent">Bajarildi deb belgilash</summary>
          <form action={finishPlan} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={p.id} />
            <label>Haqiqiy xarajat ({p.currency})<input className="field" type="number" min="0" max="10000000000000" step=".01" name="actual" required defaultValue={minorToInput(p.estimate, p.currency)} /></label>
            <label>Hisob<select className="field" name="account">{accounts.filter(a => a.currency === p.currency).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <button className="btn btn-primary self-end">Bajarishni tasdiqlash</button>
          </form></details><form action={cancelPlan}><input type="hidden" name="id" value={p.id} /><button className="text-sm text-ink-3 underline">Rejani bekor qilish</button></form></>}
      </article>;
    })}
    <nav className="flex gap-4" aria-label="Sahifalar">
      {page > 1 && <Link className="text-accent underline" href={listUrl(page - 1)}>Oldingi sahifa</Link>}
      {plans.length > pageSize && <Link className="text-accent underline" href={listUrl(page + 1)}>Keyingi sahifa</Link>}
    </nav>
  </div>;
}
