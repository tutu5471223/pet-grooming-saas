-- Security remediation migration (additive + one data-preserving dedup).
-- Style mirrors the project's existing migrations: IF NOT EXISTS so it is safe
-- to (re)apply on a DB whose schema was partly created by manual SQL on the VPS.

-- ── M5: one Customer per (shopId, phone) ────────────────────────────────────
-- De-duplicate BEFORE adding the unique index so `migrate deploy` cannot abort
-- on an existing duplicate. No row is deleted and no financial data is touched;
-- only the phone STRING of the 2nd+ duplicate within a shop is suffixed so the
-- constraint can apply. Operators should merge the "-dupN" rows afterwards via
-- the existing customers/merge tool.
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "shopId", "phone"
           ORDER BY "createdAt" ASC, "id" ASC
         ) AS rn
  FROM "Customer"
)
UPDATE "Customer" c
SET "phone" = c."phone" || '-dup' || r.rn
FROM ranked r
WHERE c."id" = r."id" AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_shopId_phone_key"
  ON "Customer"("shopId", "phone");

-- ── M9: reminder cron idempotency marker ────────────────────────────────────
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

-- ── L4: composite index for sales list / daily settlement ───────────────────
CREATE INDEX IF NOT EXISTS "Sale_shopId_createdAt_idx" ON "Sale"("shopId", "createdAt");
