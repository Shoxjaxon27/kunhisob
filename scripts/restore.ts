import fs from "node:fs";
import Database from "better-sqlite3";
import { resolveSqlitePath } from "../src/server/db";

/**
 * Nusxadan tiklash. Foydalanish: npm run db:restore -- <nusxa.db>
 * Ilovani (server) to'xtatib ishlating. Joriy baza avval `.before-restore` nomi bilan saqlanadi.
 */
const src = process.argv[2];
if (!src) { console.error("Foydalanish: npm run db:restore -- <nusxa.db>"); process.exit(1); }
if (!fs.existsSync(src)) { console.error(`Fayl topilmadi: ${src}`); process.exit(1); }

// Nusxa haqiqiy SQLite va bizning jadvallarimiz bormligini tekshiramiz.
let probe: Database.Database | undefined;
try {
  probe = new Database(src, { readonly: true });
  const ok = probe.pragma("integrity_check", { simple: true });
  const has = probe.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='Transaction'`).get();
  if (ok !== "ok" || !has) throw new Error("Bu FINOVA bazasi nusxasi emas yoki buzilgan.");
} catch {
  console.error("Bu FINOVA bazasi nusxasi emas yoki buzilgan.");
  process.exit(1);
} finally {
  probe?.close();
}

const dest = resolveSqlitePath(process.env.DATABASE_URL ?? "file:./data/finova.db");
if (fs.existsSync(dest)) fs.copyFileSync(dest, `${dest}.before-restore`);
for (const ext of ["-wal", "-shm"]) fs.rmSync(dest + ext, { force: true });
fs.copyFileSync(src, dest);
console.log(`Tiklandi: ${dest}${fs.existsSync(`${dest}.before-restore`) ? ` (eski baza: ${dest}.before-restore)` : ""}`);
