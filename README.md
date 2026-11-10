# KunHisob

Finova asosidagi shaxsiy rejalashtirish ilovasi. Windows’da start.bat faylini oching. Birinchi ishga tushirishda Node.js va paketlarni yuklash uchun internet kerak.

**Bugun** sahifasida keyingi maosh sanasini kiriting. Kunlik o‘rtacha summa asosiy valyutadagi balansdan maqsadlarga ajratilgan pul, maoshdan oldingi bajarilmagan rejalar va shu davrda to‘lanadigan qarzlar ayrilgandan keyin hisoblanadi. Maosh kuni yangi davrga kiradi.

**Rejalar** orqali uchrashuv yoki to‘lov kiriting. Bajarishda haqiqiy summa va hisobni tanlang. Bepul rejani 0 bilan yakunlash mumkin.

**Maqsadlar** orqali jamg‘armani va muddatgacha kerak bo‘ladigan oylik summani kuzating.

Next.js (App Router) · TypeScript · Tailwind · Prisma 7 + SQLite · Zod · Recharts · Motion.

## Ishga tushirish tartibi
```bash
npm install
cp .env.example .env        # DATABASE_URL, ALLOW_REGISTRATION
npm run db:migrate          # bazani yaratadi (src/server/migrate.ts)
npm run dev                 # http://localhost:3000
```
Birinchi foydalanuvchi `/register` orqali yaratiladi; keyin ro'yxatdan o'tish yopiladi
(`ALLOW_REGISTRATION=true` bilan ochiladi). HTTPS orqasida `COOKIE_SECURE=true` qo'ying.

## Testlar va tekshiruv
```bash
npm test            # vitest: pul, vaqt, balans hisobi, servislar, auth (haqiqiy SQLite)
npm run typecheck
npm run build
```
Testlar: `src/domain/*.test.ts`, `src/server/**/*.test.ts`.

## Hozir ishlaydi (Sprint 1–3)
Ro'yxatdan o'tish/kirish/chiqish, onboarding, hisoblar (CRUD, arxiv), kategoriyalar,
xarajat/daromad/qaytim/tuzatish/o'tkazma (valyutalararo — qabul qilingan summa qo'lda kiritiladi, kurs o'ylab topilmaydi),
tahrirlash, o'chirish + qaytarish, dublikat ogohlantirishi, filtr va qidiruv, haqiqiy dashboard, sozlamalar, light/dark.

Sprint 3 (`/plan`): oylik byudjet (umumiy va kategoriya bo'yicha, prognoz va kunlik ruxsat), qarzlar
(berilgan/olingan, qisman to'lov, muddat holati, hisob balansiga to'g'ri ta'sir) va jamg'arma maqsadlari
(foiz, muddatgacha oyiga kerak summa). Maqsadga qo'shilgan summa hisob balansini o'zgartirmaydi.

## Cheklovlar
Chek/fayl biriktirish va takroriy yozuvlar UI'si hali yo'q. Bildirishnomalar (byudjet/muddat) hali yo'q — ogohlantirishlar faqat sahifalarda ko'rinadi. Prisma Migrate o'rniga oddiy SQL migrator ishlatiladi.

## Sprint 4 — Tahlil (Analytics)

- `/analytics` — davr (7/30 kun, shu oy, o‘tgan oy, shu yil yoki o‘z oralig‘ingiz, ko‘pi bilan 3660 kun) va valyuta bo‘yicha tahlil.
- Ko‘rsatkichlar oldingi teng uzunlikdagi davr bilan solishtiriladi; valyutalar hech qachon aralashtirilmaydi.
- Grafiklar: kirim/chiqim, balans dinamikasi, hafta kunlari; har biri "Jadval ko‘rinishi"ga ega.
- Kategoriyalar, daromad manbalari, eng katta xarajatlar va izohlar, qoidaga asoslangan xulosalar.
- `GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD` — CSV (`;` ajratuvchi, UTF-8 BOM, formula-injection himoyasi). Faqat kirgan foydalanuvchi ma’lumoti.
- Testlar: `src/domain/analytics.test.ts`, `src/server/services/analytics.test.ts`.

## Sprint 5 — Premium (Financial Pulse, harakat)

- Bosh sahifada **Financial Pulse** (0–100): jamg‘arma darajasi, byudjet intizomi, qarz intizomi va zaxira (balans necha kunlik xarajatga yetishi — taxmin) ning oddiy o‘rtachasi. Ma’lumoti yo‘q ko‘rsatkich hisobga olinmaydi; kamida 2 ta bo‘lmasa ball ko‘rsatilmaydi va nima yetishmayotgani yoziladi. "Qanday hisoblanadi" bo‘limida formulalar ochiq. Moliyaviy maslahat emas.
- Faqat asosiy valyuta; valyutalar aralashtirilmaydi.
- Harakat: ball halqasi, bo‘limlarning ketma-ket paydo bo‘lishi (`Reveal`). Sozlamalardagi "Harakat" (To‘liq/Kamaytirilgan/O‘chirilgan) va tizim reduced-motion hurmat qilinadi.
- Telefon pastki panelida qisqa yorliqlar ("Bosh", "Yozuvlar").
- Fayllar: `src/domain/pulse.ts`, `src/server/services/pulse.ts`, `src/components/dashboard/pulse-card.tsx`, `src/components/ui/reveal.tsx`. Testlar: `src/domain/pulse.test.ts`, `src/server/services/pulse.test.ts`.

## Sprint 6 — Ishonchlilik (Reliability)

- **Zaxira (baza)**: `npm run db:backup [papka]` — ishlayotgan SQLite bazadan xavfsiz nusxa (`data/backups/`). `npm run db:restore -- <nusxa.db>` — tiklash (avval serverni to‘xtating; eski baza `.before-restore` bo‘lib qoladi; buzuq/begona fayl rad etiladi).
- **JSON nusxa**: Sozlamalar → "Ma’lumotlar va zaxira" yoki `GET /api/backup` (faqat o‘z ma’lumotingiz; parol xeshi va sessiyalar kirmaydi; summalar matn). Ilovaga qayta yuklash (import) **hali yo‘q**.
- **Yaxlitlik tekshiruvi** (faqat o‘qiydi): Sozlamalarda "Tekshirish" yoki `npm run db:check` (barcha foydalanuvchilar). Valyuta/yo‘nalish/summa nomuvofiqligi, o‘tkazma va qarz holati xatolarini topadi.
- `GET /api/health` — tiriklik tekshiruvi (bazaga `SELECT 1`, sirsiz).
- Xavfsizlik sarlavhalari: `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Testlar: `src/server/services/reliability.test.ts`.

## Foydalanuvchilar ro‘yxati (administrator)

- Yangi `role` (USER/ADMIN) va `lastLoginAt` maydonlari (migratsiya `20261026100000_user_role`; `npm run db:migrate`). Eng birinchi foydalanuvchi avtomatik ADMIN (mavjud bazada ham).
- Administrator: Sozlamalar → "Foydalanuvchilar ro‘yxati" (`/admin/users`): ism, email, rol, ro‘yxatdan o‘tgan va oxirgi kirish vaqti (Toshkent), faol sessiyalar soni. Moliyaviy ma’lumot o‘qilmaydi; oddiy foydalanuvchi uchun sahifa "topilmadi", xizmat ham `forbidden` qaytaradi.
- Yangi foydalanuvchi qo‘shish: serverda `ALLOW_REGISTRATION="true"`.
- Test: `src/server/services/admin-users.test.ts`.

## Windows: tez ishga tushirish

`start.bat` ni ikki marta bosing: kerak bo‘lsa paketlarni o‘rnatadi, `.env` ni yaratadi, bazani yangilaydi va brauzerda `http://localhost:3000` ni ochadi. Node.js 20.19+, 22.12+ yoki 24+ (LTS) o‘rnatilgan bo‘lishi kerak.


## Vercel’da ishga tushirish

Production muhiti uchun Turso bazasini ulang. Vercel sozlamalarida `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` va birinchi administratorni ro‘yxatdan o‘tkazish uchun maxfiy `ADMIN_SETUP_CODE` bo‘lishi kerak. Har bir joylashda build avval yetishmayotgan SQL migratsiyalarini bajaradi. Preview joylashlar uchun alohida sinov bazasi kerak.

Birinchi administrator /register sahifasida o‘z emailini, parolini va sozlash kodini kiritadi. Brauzer sessiyasi HTTPS orqali uzatiladi. Mahalliy ishga tushirish avvalgidek SQLite faylidan foydalanadi.
