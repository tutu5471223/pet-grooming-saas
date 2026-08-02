-- 訂閱到期生命週期欄位（皆為 nullable，相容既有資料）
ALTER TABLE "Shop" ADD COLUMN "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN "dataPurgeMarkedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "graceReminderSentAt" TIMESTAMP(3);
