-- 发票：母系统 店铺→主体 + VAT 页，合并为 StoreEntity 形状 JSON
ALTER TABLE "Channel" ADD COLUMN "invoiceStoreEntity" JSONB;
