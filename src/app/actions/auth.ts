"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db";
import { run, type ActionResult } from "@/server/action-utils";
import { AppError } from "@/server/errors";
import { loginLimiter } from "@/server/rate-limit";
import {
  clearSessionCookie,
  getSessionToken,
  requireUserId,
  setSessionCookie,
} from "@/server/auth/current";
import {
  changePassword,
  createSession,
  destroySession,
  registerUser,
  verifyLogin,
} from "@/server/services/auth";
import { loginSchema } from "@/lib/validation";

export type AuthResult = { onboarded: boolean };

async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}

export async function registerAction(input: unknown): Promise<ActionResult<AuthResult>> {
  return run(async () => {
    const db = getDb();
    const { userId } = await registerUser(db, input, {
      allowRegistration: process.env.ALLOW_REGISTRATION === "true",
    });
    const { token, expiresAt } = await createSession(db, userId, { userAgent: await userAgent() });
    await setSessionCookie(token, expiresAt);
    return { onboarded: false };
  });
}

export async function loginAction(input: unknown): Promise<ActionResult<AuthResult>> {
  return run(async () => {
    const db = getDb();
    const parsed = loginSchema.safeParse(input);
    const key = parsed.success ? parsed.data.email : "invalid";
    if (!loginLimiter.hit(key)) {
      const min = Math.ceil(loginLimiter.retryAfterMs(key) / 60000);
      throw new AppError("rate_limited", `Urinishlar ko‘p. ${min} daqiqadan keyin qayta urinib ko‘ring.`);
    }
    const { userId } = await verifyLogin(db, input);
    loginLimiter.reset(key);
    const { token, expiresAt } = await createSession(db, userId, { userAgent: await userAgent() });
    await setSessionCookie(token, expiresAt);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { onboardedAt: true } });
    return { onboarded: user.onboardedAt !== null };
  });
}

export async function logoutAction(): Promise<ActionResult> {
  return run(async () => {
    await destroySession(getDb(), await getSessionToken());
    await clearSessionCookie();
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const userId = await requireUserId();
    await changePassword(getDb(), userId, input, await getSessionToken());
    return undefined;
  });
}
