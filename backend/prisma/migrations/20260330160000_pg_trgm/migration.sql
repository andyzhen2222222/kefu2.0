-- 可选：与 PG_TRGM_SEARCH=1 配合使用（工单 subject 模糊/相似度搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Ticket_subject_trgm_idx" ON "Ticket" USING gin (subject gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ticket_subjectOriginal_trgm_idx" ON "Ticket" USING gin ("subjectOriginal" gin_trgm_ops);
