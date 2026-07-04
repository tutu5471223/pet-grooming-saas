-- Add permissions JSON field to User for granular STAFF access control
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;
