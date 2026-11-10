import { createDb } from "../src/server/db";
import { checkIntegrity } from "../src/server/services/integrity";

/** Barcha foydalanuvchilar ma'lumotlari yaxlitligini tekshiradi (faqat o'qiydi). Foydalanish: npm run db:check */
async function main() {
  const db = createDb();
  const users = await db.user.findMany({ select: { id: true, email: true } });
  let bad = 0;
  for (const u of users) {
    const r = await checkIntegrity(db, u.id);
    console.log(`${u.email}: ${r.ok ? "OK" : `${r.issues.length} ta muammo`} (tranzaksiya ${r.checked.transactions}, o‘tkazma ${r.checked.transfers}, qarz ${r.checked.debts})`);
    for (const i of r.issues) console.log(`  - [${i.code}] ${i.message} (${i.ref})`);
    bad += r.issues.length;
  }
  await db.$disconnect();
  process.exit(bad ? 1 : 0);
}
main();
