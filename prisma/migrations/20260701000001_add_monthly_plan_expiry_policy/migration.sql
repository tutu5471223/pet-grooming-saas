-- Add expiryPolicy and graceDays to PetMonthlyPlan
ALTER TABLE "PetMonthlyPlan" ADD COLUMN "expiryPolicy" TEXT NOT NULL DEFAULT 'FORFEIT';
ALTER TABLE "PetMonthlyPlan" ADD COLUMN "graceDays" INTEGER NOT NULL DEFAULT 7;
