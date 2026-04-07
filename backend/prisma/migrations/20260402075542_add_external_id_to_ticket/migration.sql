-- DropIndex
DROP INDEX "Ticket_subjectOriginal_trgm_idx";

-- DropIndex
DROP INDEX "Ticket_subject_trgm_idx";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "eanList" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "storeEntity" JSONB;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "externalId" TEXT;
