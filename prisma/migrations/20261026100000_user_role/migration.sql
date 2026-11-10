-- Rol (USER | ADMIN) va oxirgi kirish vaqti. Eng birinchi foydalanuvchi — ADMIN.
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;
UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
UPDATE "User" SET "lastLoginAt" = (SELECT MAX("createdAt") FROM "Session" WHERE "Session"."userId" = "User"."id");
