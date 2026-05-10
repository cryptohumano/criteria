-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ;

-- Backfill: orgs en trial sin fecha → 14 días desde creación
UPDATE "organizations"
SET "trial_ends_at" = "created_at" + interval '14 days'
WHERE "plan" = 'trial' AND "trial_ends_at" IS NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_documents_organization_id_doc_id_key" ON "tenant_documents"("organization_id", "doc_id");
CREATE INDEX IF NOT EXISTS "tenant_documents_organization_id_created_at_idx" ON "tenant_documents"("organization_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_documents_organization_id_fkey'
  ) THEN
    ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
