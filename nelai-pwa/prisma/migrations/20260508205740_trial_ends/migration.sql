-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "trial_ends_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_documents" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);
