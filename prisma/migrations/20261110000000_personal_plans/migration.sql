ALTER TABLE "Settings" ADD COLUMN "payday" TEXT;
CREATE TABLE "PersonalPlan" (
  "id" TEXT PRIMARY KEY NOT NULL, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL, "date" TEXT NOT NULL, "estimate" BIGINT NOT NULL,
  "currency" TEXT NOT NULL, "completedAt" DATETIME, "transactionId" TEXT UNIQUE
);
CREATE INDEX "PersonalPlan_userId_date_idx" ON "PersonalPlan" ("userId", "date");
