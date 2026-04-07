-- 新建 TenantSyncSettings 默认回溯 90 天（与工单「最近更新时间」同步窗口一致）
ALTER TABLE "TenantSyncSettings" ALTER COLUMN "incrementalSyncDays" SET DEFAULT 90;
