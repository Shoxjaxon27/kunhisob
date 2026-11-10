import { notFound } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { requireOnboardedUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listUsersForAdmin } from "@/server/services/admin-users";
import { toLocalInputs } from "@/domain/time";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) => {
  if (!d) return "—";
  const l = toLocalInputs(d);
  return `${l.date} ${l.time}`;
};

export default async function AdminUsersPage() {
  const user = await requireOnboardedUser();
  if (user.role !== "ADMIN") notFound();
  const users = await listUsersForAdmin(getDb(), user.id);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          <Users size={24} aria-hidden="true" /> Foydalanuvchilar
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Faqat hisob ma’lumotlari ko‘rsatiladi. Hech kimning summalari, hisoblari va yozuvlari bu yerda ko‘rinmaydi. Vaqtlar Toshkent bo‘yicha.
        </p>
      </header>

      <section className="card overflow-x-auto p-2" aria-label="Foydalanuvchilar ro‘yxati">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-3">
              <th scope="col" className="px-3 py-2 font-medium">Foydalanuvchi</th>
              <th scope="col" className="px-3 py-2 font-medium">Rol</th>
              <th scope="col" className="px-3 py-2 font-medium">Ro‘yxatdan o‘tgan</th>
              <th scope="col" className="px-3 py-2 font-medium">Oxirgi kirish</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Faol sessiya</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-3 py-3">
                  <span className="block font-semibold">{u.name}{u.id === user.id && <span className="ml-2 text-xs font-normal text-ink-3">(siz)</span>}</span>
                  <span className="block text-xs text-ink-3">{u.email}{!u.onboarded && " · sozlash tugallanmagan"}</span>
                </td>
                <td className="px-3 py-3">
                  {u.role === "ADMIN" ? (
                    <span className="chip"><ShieldCheck size={13} aria-hidden="true" /> Administrator</span>
                  ) : (
                    "Foydalanuvchi"
                  )}
                </td>
                <td className="num px-3 py-3">{fmt(u.createdAt)}</td>
                <td className="num px-3 py-3">{fmt(u.lastLoginAt)}</td>
                <td className="num px-3 py-3 text-right">{u.activeSessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-ink-3">Jami: {users.length} ta foydalanuvchi. Yangi foydalanuvchi qo‘shish uchun serverda ALLOW_REGISTRATION="true" qo‘yiladi.</p>
    </div>
  );
}
