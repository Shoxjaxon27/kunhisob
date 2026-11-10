import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { createTestDb, uniqueEmail } from "../test-utils";
import { RateLimiter } from "../rate-limit";
import {
  SESSION_TTL_MS,
  changePassword,
  createSession,
  destroySession,
  hashToken,
  registerUser,
  resolveSession,
  verifyLogin,
} from "./auth";

let db: Db;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterAll(async () => {
  await cleanup();
});

describe("ro'yxatdan o'tish", () => {
  it("parolni bcrypt bilan xeshlaydi (ochiq matn saqlanmaydi) va sozlamalarni yaratadi", async () => {
    const email = uniqueEmail();
    const { userId } = await registerUser(db, { name: "Ali", email, password: "supersecret1" }, { allowRegistration: true });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } });
    expect(user.passwordHash).not.toContain("supersecret1");
    expect(user.passwordHash.startsWith("$2")).toBe(true);
    expect(user.settings?.primaryCurrency).toBe("UZS");
    expect(user.settings?.timezone).toBe("Asia/Tashkent");
  });

  it("emailni kichik harfga keltiradi va takrorni rad etadi", async () => {
    const email = uniqueEmail();
    await registerUser(db, { name: "A", email: email.toUpperCase(), password: "password123" }, { allowRegistration: true });
    await expect(
      registerUser(db, { name: "B", email, password: "password123" }, { allowRegistration: true }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("qisqa parol va noto'g'ri emailni rad etadi", async () => {
    await expect(
      registerUser(db, { name: "A", email: uniqueEmail(), password: "short" }, { allowRegistration: true }),
    ).rejects.toMatchObject({ code: "validation", fields: { password: expect.any(String) } });
    await expect(
      registerUser(db, { name: "A", email: "not-an-email", password: "password123" }, { allowRegistration: true }),
    ).rejects.toMatchObject({ code: "validation", fields: { email: expect.any(String) } });
  });

  it("foydalanuvchi bor bo'lsa va ro'yxatdan o'tish yopiq bo'lsa — rad etadi", async () => {
    await registerUser(db, { name: "A", email: uniqueEmail(), password: "password123" }, { allowRegistration: true });
    await expect(
      registerUser(db, { name: "B", email: uniqueEmail(), password: "password123" }, { allowRegistration: false }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});

describe("kirish", () => {
  it("to'g'ri parol bilan kiradi, noto'g'ri parol va noma'lum emailda bir xil xabar beradi", async () => {
    const email = uniqueEmail();
    const { userId } = await registerUser(db, { name: "A", email, password: "password123" }, { allowRegistration: true });
    await expect(verifyLogin(db, { email, password: "password123" })).resolves.toEqual({ userId });

    const wrongPass = await verifyLogin(db, { email, password: "wrongpass" }).catch((e) => e);
    const noUser = await verifyLogin(db, { email: "nobody@test.local", password: "password123" }).catch((e) => e);
    expect(wrongPass).toMatchObject({ code: "unauthorized" });
    expect(noUser).toMatchObject({ code: "unauthorized" });
    expect(wrongPass.message).toBe(noUser.message);
  });
});

describe("sessiyalar", () => {
  it("token bazada faqat xesh ko'rinishida saqlanadi", async () => {
    const { userId } = await registerUser(db, { name: "A", email: uniqueEmail(), password: "password123" }, { allowRegistration: true });
    const { token } = await createSession(db, userId);
    const rows = await db.session.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashToken(token));
    expect(rows[0]!.tokenHash).not.toBe(token);
  });

  it("amaldagi sessiya foydalanuvchini qaytaradi; noto'g'ri, bo'sh va muddati o'tgan token — null", async () => {
    const { userId } = await registerUser(db, { name: "Vali", email: uniqueEmail(), password: "password123" }, { allowRegistration: true });
    const t0 = new Date("2026-10-24T00:00:00.000Z");
    const { token } = await createSession(db, userId, { now: t0 });

    const ok = await resolveSession(db, token, new Date(t0.getTime() + 1000));
    expect(ok?.user.id).toBe(userId);
    expect(ok?.user.name).toBe("Vali");
    expect(ok?.user.onboarded).toBe(false);

    expect(await resolveSession(db, "bogus", t0)).toBeNull();
    expect(await resolveSession(db, undefined, t0)).toBeNull();
    expect(await resolveSession(db, token, new Date(t0.getTime() + SESSION_TTL_MS + 1))).toBeNull();
  });

  it("muddati 15 kundan kam qolganda uzaytiriladi", async () => {
    const { userId } = await registerUser(db, { name: "A", email: uniqueEmail(), password: "password123" }, { allowRegistration: true });
    const t0 = new Date("2026-10-01T00:00:00.000Z");
    const { token } = await createSession(db, userId, { now: t0 });
    const later = new Date(t0.getTime() + 20 * 24 * 60 * 60 * 1000);
    const r = await resolveSession(db, token, later);
    expect(r?.renewed).toBe(true);
    expect(r!.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);
  });

  it("chiqish sessiyani o'chiradi", async () => {
    const { userId } = await registerUser(db, { name: "A", email: uniqueEmail(), password: "password123" }, { allowRegistration: true });
    const { token } = await createSession(db, userId);
    await destroySession(db, token);
    expect(await resolveSession(db, token)).toBeNull();
  });
});

describe("parolni o'zgartirish", () => {
  it("joriy parol noto'g'ri bo'lsa rad etadi; muvaffaqiyatda boshqa sessiyalarni tugatadi", async () => {
    const email = uniqueEmail();
    const { userId } = await registerUser(db, { name: "A", email, password: "oldpassword1" }, { allowRegistration: true });
    const current = await createSession(db, userId);
    const other = await createSession(db, userId);

    await expect(changePassword(db, userId, { current: "WRONG", next: "newpassword1" }, current.token)).rejects.toMatchObject({
      code: "validation",
      fields: { current: expect.any(String) },
    });

    await changePassword(db, userId, { current: "oldpassword1", next: "newpassword1" }, current.token);
    expect(await resolveSession(db, current.token)).not.toBeNull();
    expect(await resolveSession(db, other.token)).toBeNull();
    await expect(verifyLogin(db, { email, password: "oldpassword1" })).rejects.toMatchObject({ code: "unauthorized" });
    await expect(verifyLogin(db, { email, password: "newpassword1" })).resolves.toEqual({ userId });
  });
});

describe("RateLimiter", () => {
  it("limitdan keyin bloklaydi, oyna tugagach qayta ochadi", () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.hit("k", 0)).toBe(true);
    expect(rl.hit("k", 1)).toBe(true);
    expect(rl.hit("k", 2)).toBe(true);
    expect(rl.hit("k", 3)).toBe(false);
    expect(rl.retryAfterMs("k", 500)).toBe(500);
    expect(rl.hit("other", 3)).toBe(true);
    expect(rl.hit("k", 1001)).toBe(true);
  });

  it("reset hisoblagichni tozalaydi", () => {
    const rl = new RateLimiter(1, 1000);
    rl.hit("k", 0);
    expect(rl.hit("k", 1)).toBe(false);
    rl.reset("k");
    expect(rl.hit("k", 2)).toBe(true);
  });
});
