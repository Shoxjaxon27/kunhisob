import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { AppError } from "../errors";
import { SESSION_COOKIE, resolveSession, type SessionUser } from "../services/auth";

/** Joriy so'rov uchun sessiya (bir so'rovda bir marta hisoblanadi). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const res = await resolveSession(getDb(), token);
  return res?.user ?? null;
});

export async function getSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

/** Sahifalar uchun: kirmagan bo'lsa /login ga yo'naltiradi. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Asosiy ilova sahifalari uchun: onboarding tugamagan bo'lsa /onboarding ga yo'naltiradi. */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  return user;
}

/**
 * Server action'lar uchun: layout tekshiruvi action'larni himoya QILMAYDI,
 * shuning uchun har bir action o'zi sessiyani tekshiradi.
 */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new AppError("unauthorized", "Sessiya tugagan. Qaytadan kiring.");
  return user.id;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // HTTPS orqali ishlatilganda COOKIE_SECURE="true" qo'ying.
    secure: process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
