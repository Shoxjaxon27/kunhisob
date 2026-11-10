import { resolveSqlitePath } from "../src/server/db";
import { runMigrations } from "../src/server/migrate";

const url = process.env.DATABASE_URL ?? "file:./data/finova.db";
const file = resolveSqlitePath(url);
const { applied, skipped } = runMigrations(file);

console.log(`Baza: ${file}`);
console.log(applied.length ? `Qo'llandi: ${applied.join(", ")}` : "Yangi migratsiya yo'q.");
if (skipped.length) console.log(`Avval qo'llangan: ${skipped.length} ta`);
