-- 自动回复规则：正文落库；移除未使用的 templateId（若存在）
ALTER TABLE "AutoReplyRule" ADD COLUMN IF NOT EXISTS "replyContent" TEXT;
ALTER TABLE "AutoReplyRule" DROP COLUMN IF EXISTS "templateId";
