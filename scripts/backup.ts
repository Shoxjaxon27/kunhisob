import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { resolveSqlitePath } from "../src/server/db";

/** Ishlayotgan bazadan ham xavfsiz SQLite nusxa (SQLite backup API). Foydalanish: npm run db:backup [papka] */
async function main() {
  const file = resolveSqlitePath(process.env.DATABASE_URL ?? "file:./data/finova.db");
  if (!fs.existsSync(file)) throw new Error(`Baza topilmadi: ${file}`);
  const dir = path.resolve(process.argv[2] ?? path.join(path.dirname(file), "backups"));
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(dir, `finova-${stamp}.db`);
  const db = new Database(file, { readonly: true });
  try {
    await db.backup(dest);
  } finally {
    db.close();
  }
  console.log(`Nusxa saqlandi: ${dest}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
