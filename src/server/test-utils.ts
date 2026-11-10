import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, type Db } from "./db";
import { runMigrations } from "./migrate";

/** Vaqtinchalik SQLite fayl + migratsiyalar bilan haqiqiy baza (testlar uchun). */
export async function createTestDb(): Promise<{ db: Db; cleanup: () => Promise<void> }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "finova-test-"));
  const file = path.join(dir, "test.db");
  runMigrations(file);
  const db = createDb(`file:${file}`);
  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

let counter = 0;
export function uniqueEmail(): string {
  counter += 1;
  return `user${counter}-${Date.now()}@test.local`;
}
