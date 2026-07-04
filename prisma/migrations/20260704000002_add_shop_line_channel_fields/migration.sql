-- Add per-shop LINE Channel ID and Channel Secret for multi-tenant LINE integration
ALTER TABLE "Shop" ADD COLUMN "lineChannelId"     TEXT;
ALTER TABLE "Shop" ADD COLUMN "lineChannelSecret"  TEXT;
