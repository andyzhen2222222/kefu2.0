-- 母系统 /v1/api/biz/platform-site/all：平台默认货币与语言
ALTER TABLE "Channel" ADD COLUMN "defaultCurrency" TEXT;
ALTER TABLE "Channel" ADD COLUMN "platformLanguage" TEXT;
