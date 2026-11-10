import fs from "node:fs";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

export type Db = PrismaClient;
/** Oddiy client yoki interaktiv tranzaksiya ichidagi client. */
export type DbLike = PrismaClient | Prisma.TransactionClient;

const DEFAULT_URL = "file:./data/finova.db";

/** "file:./data/finova.db" → absolyut fayl yo'li (ildiz — loyiha papkasi). */
export function resolveSqlitePath(url: string): string {
  if (!url.startsWith("file:")) {
    throw new Error("Hozircha faqat SQLite (file:...) qo'llab-quvvatlanadi. PostgreSQL — keyingi bosqich.");
  }
  const p = url.slice("file:".length);
  return path.isAbsolute(p) ? p : path.resolve(/*turbopackIgnore: true*/ process.cwd(), p);
}

export function createDb(url: string = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_URL): Db {
  if (url.startsWith("libsql://") || url.startsWith("https://")) {
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!authToken) throw new Error("TURSO_AUTH_TOKEN sozlanmagan");
    return new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) });
  }
  if (process.env.VERCEL === "1") throw new Error("Vercel uchun TURSO_DATABASE_URL sozlanishi kerak");
  const file = resolveSqlitePath(url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const adapter = new PrismaBetterSqlite3({ url: `file:${file}` });
  return new PrismaClient({ adapter });
}

const globalForDb = globalThis as unknown as { __finovaDb?: Db };

/** Jarayon bo'yicha yagona client (dev rejimida HMR da qayta yaratilmaydi). */
export function getDb(): Db {
  globalForDb.__finovaDb ??= createDb();
  return globalForDb.__finovaDb;
}

export { Prisma };
