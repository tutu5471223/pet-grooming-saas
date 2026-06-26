-- AlterTable: add refundedAmount column to Payment
-- Uses DOUBLE PRECISION to match Prisma Float (consistent with the existing `amount` column).
-- If the column was previously created manually as INTEGER (e.g. via direct SQL on VPS),
-- the second statement converts it to DOUBLE PRECISION.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ALTER COLUMN "refundedAmount" TYPE DOUBLE PRECISION;
