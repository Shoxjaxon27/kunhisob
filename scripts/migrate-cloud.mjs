import { createClient } from "@libsql/client";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function migrate() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("TURSO_DATABASE_URL va TURSO_AUTH_TOKEN kerak");
  const client = createClient({ url, authToken });
  try {
    await client.execute('CREATE TABLE IF NOT EXISTS "_finova_migrations" ("name" TEXT PRIMARY KEY NOT NULL, "appliedAt" TEXT NOT NULL)');
    const root = path.resolve("prisma/migrations");
    const entries = await readdir(root, { withFileTypes: true });
    for (const name of entries.filter(e => e.isDirectory()).map(e => e.name).sort()) {
      const sql = await readFile(path.join(root, name, "migration.sql"), "utf8");
      const tx = await client.transaction("write");
      try {
        const applied = await tx.execute({ sql: "SELECT name FROM _finova_migrations WHERE name = ?", args: [name] });
        if (!applied.rows.length) {
          await tx.executeMultiple(sql);
          await tx.execute({ sql: "INSERT INTO _finova_migrations (name, appliedAt) VALUES (?, ?)", args: [name, new Date().toISOString()] });
        }
        await tx.commit();
      } finally {
        tx.close();
      }
    }
  } finally {
    client.close();
  }
}

migrate().catch(error => {
  console.error("Bulut bazasi migratsiyasi bajarilmadi:", error.code ?? error.name);
  process.exitCode = 1;
});
