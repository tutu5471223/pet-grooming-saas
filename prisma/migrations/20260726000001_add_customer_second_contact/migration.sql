-- 客戶第二聯絡人（後台新增客人與自助建檔皆為必填，於應用層強制；
-- 欄位本身可為 NULL 以相容既有資料）
ALTER TABLE "Customer" ADD COLUMN "secondContactName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "secondContactPhone" TEXT;
