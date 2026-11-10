import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Db } from "../db";
import { AppError } from "../errors";
import { changePasswordSchema, loginSchema, registerSchema } from "@/lib/validation";
import { parseWith } from "./shared";

export const SESSION_COOKIE = "finova_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_BELOW_MS = 15 * 24 * 60 * 60 * 1000;
const BCRYPT_COST = 12;

// Foydalanuvchi topilmaganda ham vaqt taxminan bir xil bo'lishi uchun (user enumeration'ga qarshi).
const DUMMY_HASH = bcrypt.hashSync("finova-dummy-password", 4);

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function registerUser(
  db: Db,
  input: unknown,
  opts: { allowRegistration: boolean; setupCode?: string },
): Promise<{ userId: string }> {
  const data = parseWith(registerSchema, input);

  const passwordHash = await hashPassword(data.password);
  const user = await db.$transaction(async (tx) => {
    const count = await tx.user.count();
    if (count === 0 && process.env.VERCEL === "1" &&
        (!process.env.ADMIN_SETUP_CODE || opts.setupCode !== process.env.ADMIN_SETUP_CODE)) {
      throw new AppError("unauthorized", "Administratorni yaratish uchun sozlash kodini kiriting");
    }
    if (count > 0 && !opts.allowRegistration) {
      throw new AppError("unauthorized", "Ro‘yxatdan o‘tish yopilgan. Mavjud hisob bilan kiring.");
    }
    const existing = await tx.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError("conflict", "Bu email allaqachon ro‘yxatdan o‘tgan", { email: "Bu email band" });
    const u = await tx.user.create({
      data: { email: data.email, name: data.name, passwordHash, role: count === 0 ? "ADMIN" : "USER" },
    });
    await tx.settings.create({ data: { userId: u.id } });
    return u;
  });
  return { userId: user.id };
}

export async function verifyLogin(db: Db, input: unknown): Promise<{ userId: string }> {
  const data = parseWith(loginSchema, input);
  const user = await db.user.findUnique({ where: { email: data.email } });
  const ok = await bcrypt.compare(data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new AppError("unauthorized", "Email yoki parol noto‘g‘ri");
  }
  return { userId: user.id };
}

export async function createSession(
  db: Db,
  userId: string,
  opts: { userAgent?: string | null; now?: Date } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const now = opts.now ?? new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: opts.userAgent ? opts.userAgent.slice(0, 200) : null,
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: now } });
  // Muddati o'tgan sessiyalarni vaqti-vaqti bilan tozalash.
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return { token, expiresAt };
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  onboarded: boolean;
  role: "USER" | "ADMIN";
};

/** Token bo'yicha sessiyani tekshiradi; muddati 15 kundan kam qolsa uzaytiradi. */
export async function resolveSession(
  db: Db,
  token: string | undefined,
  now: Date = new Date(),
): Promise<{ user: SessionUser; expiresAt: Date; renewed: boolean } | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= now.getTime()) return null;

  let expiresAt = session.expiresAt;
  let renewed = false;
  if (expiresAt.getTime() - now.getTime() < RENEW_BELOW_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } });
    renewed = true;
  }
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      onboarded: session.user.onboardedAt !== null,
      role: session.user.role === "ADMIN" ? "ADMIN" : "USER",
    },
    expiresAt,
    renewed,
  };
}

export async function destroySession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Parolni o'zgartiradi va joriy sessiyadan tashqari barcha sessiyalarni tugatadi. */
export async function changePassword(
  db: Db,
  userId: string,
  input: unknown,
  currentToken?: string,
): Promise<void> {
  const data = parseWith(changePasswordSchema, input);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("not_found", "Foydalanuvchi topilmadi");
  const ok = await bcrypt.compare(data.current, user.passwordHash);
  if (!ok) {
    throw new AppError("validation", "Joriy parol noto‘g‘ri", { current: "Joriy parol noto‘g‘ri" });
  }
  const passwordHash = await hashPassword(data.next);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.session.deleteMany({
      where: {
        userId,
        ...(currentToken ? { NOT: { tokenHash: hashToken(currentToken) } } : {}),
      },
    });
  });
}
