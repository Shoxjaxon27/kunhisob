import type { Db } from "../db";
import { AppError } from "../errors";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  onboarded: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  activeSessions: number;
};

/**
 * Foydalanuvchilar ro'yxati — faqat ADMIN uchun. Faqat hisob ma'lumotlari (ism, email, rol, vaqtlar);
 * hech qanday moliyaviy ma'lumot (summa, hisob, tranzaksiya) bu yerda o'qilmaydi.
 */
export async function listUsersForAdmin(db: Db, requesterId: string, now: Date = new Date()): Promise<AdminUserRow[]> {
  const me = await db.user.findUnique({ where: { id: requesterId }, select: { role: true } });
  if (!me || me.role !== "ADMIN") throw new AppError("forbidden", "Bu bo‘lim faqat administrator uchun");
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, email: true, role: true, onboardedAt: true, createdAt: true, lastLoginAt: true,
      _count: { select: { sessions: { where: { expiresAt: { gt: now } } } } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role === "ADMIN" ? "ADMIN" : "USER",
    onboarded: u.onboardedAt !== null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    activeSessions: u._count.sessions,
  }));
}
