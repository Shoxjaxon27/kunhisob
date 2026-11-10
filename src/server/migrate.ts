import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Oddiy SQL migrator: prisma/migrations/<nom>/migration.sql fayllarini tartib bilan qo'llaydi
 * va `_finova_migrations` jadvalida belgilab boradi. Ikki marta qo'llamaydi.
 */
export function runMigrations(
  dbFile: string,
  migrationsDir: string = path.resolve(process.cwd(), "prisma/migrations"),
): { applied: string[]; skipped: string[] } {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const sqlite = new Database(dbFile);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS "_finova_migrations" (
         "name" TEXT NOT NULL PRIMARY KEY,
         "appliedAt" TEXT NOT NULL
       )`,
    );

    const done = new Set(
      (sqlite.prepare(`SELECT "name" FROM "_finova_migrations"`).all() as { name: string }[]).map((r) => r.name),
    );

    const names = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(migrationsDir, d.name, "migration.sql")))
      .map((d) => d.name)
      .sort();

    const applied: string[] = [];
    const skipped: string[] = [];
    for (const name of names) {
      if (done.has(name)) {
        skipped.push(name);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      const apply = sqlite.transaction(() => {
        sqlite.exec(sql);
        sqlite
          .prepare(`INSERT INTO "_finova_migrations" ("name", "appliedAt") VALUES (?, ?)`)
          .run(name, new Date().toISOString());
      });
      apply();
      applied.push(name);
    }
    return { applied, skipped };
  } finally {
    sqlite.close();
  }
}
