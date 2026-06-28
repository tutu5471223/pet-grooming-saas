-- Rename consentPhoto -> consentPhotoRecord
ALTER TABLE "Pet" RENAME COLUMN "consentPhoto" TO "consentPhotoRecord";

-- Add new consentPhotoSocial column
ALTER TABLE "Pet" ADD COLUMN "consentPhotoSocial" BOOLEAN NOT NULL DEFAULT false;
