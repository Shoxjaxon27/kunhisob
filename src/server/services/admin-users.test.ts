import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { createTestDb, uniqueEmail } from "../test-utils";
import { AppError } from "../errors";
import { createSession, registerUser } from "./auth";
import { listUsersForAdmin } from "./admin-users";

let db: Db;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ db, cleanup } = await createTestDb()));
afterAll(async () => cleanup());

const reg = (n: string) => registerUser(db, { name: n, email: uniqueEmail(), password: "password123" }, { allowRegistration: true });

describe("foydalanuvchilar ro'yxati (admin)", () => {
  it("birinchi foydalanuvchi ADMIN, keyingilar USER; oddiy foydalanuvchiga ruxsat yo'q", async () => {
    // Bo'sh bazada birinchi ro'yxatdan o'tgan — ADMIN bo'lishi uchun alohida baza kerak emas: count tekshiriladi.
    const first = await reg("Birinchi");
    const isFirstAdmin = (await db.user.findUniqueOrThrow({ where: { id: first.userId } })).role;
    // createTestDb har faylda yangi baza, lekin bu fayldagi birinchi testda birinchi foydalanuvchi:
    expect(isFirstAdmin).toBe("ADMIN");
    const second = await reg("Ikkinchi");
    expect((await db.user.findUniqueOrThrow({ where: { id: second.userId } })).role).toBe("USER");

    const e = await listUsersForAdmin(db, second.userId).then(() => null, (x: unknown) => x);
    expect(e).toBeInstanceOf(AppError);
    expect((e as AppError).code).toBe("forbidden");
  });

  it("admin ro'yxatni ko'radi: oxirgi kirish va faol sessiyalar; moliyaviy maydon yo'q", async () => {
    const admin = (await db.user.findFirstOrThrow({ where: { role: "ADMIN" } })).id;
    const u = await reg("Uchinchi");
    const t1 = new Date("2026-10-26T05:00:00Z");
    await createSession(db, u.userId, { now: t1 });
    await createSession(db, u.userId, { now: new Date("2026-10-26T06:00:00Z") });
    const list = await listUsersForAdmin(db, admin, new Date("2026-10-26T07:00:00Z"));
    const row = list.find((r) => r.id === u.userId)!;
    expect(row.activeSessions).toBe(2);
    expect(row.lastLoginAt?.toISOString()).toBe("2026-10-26T06:00:00.000Z");
    expect(list[0]!.role).toBe("ADMIN");
    expect(Object.keys(row).sort()).toEqual(["activeSessions", "createdAt", "email", "id", "lastLoginAt", "name", "onboarded", "role"]);
    expect(JSON.stringify(list)).not.toContain("passwordHash");
  });
});
