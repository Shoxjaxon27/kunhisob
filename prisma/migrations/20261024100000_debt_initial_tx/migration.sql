-- Qarzning dastlabki tranzaksiyasi (ixtiyoriy) bilan bog'lanishi.
ALTER TABLE "Debt" ADD COLUMN "transactionId" TEXT REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Debt_transactionId_key" ON "Debt"("transactionId");
