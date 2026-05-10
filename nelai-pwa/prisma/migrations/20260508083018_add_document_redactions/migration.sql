-- CreateTable
CREATE TABLE "document_redactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "placeholder" TEXT NOT NULL,
    "original_enc" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restored_at" TIMESTAMP(3),

    CONSTRAINT "document_redactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_redactions_organization_id_doc_id_created_at_idx" ON "document_redactions"("organization_id", "doc_id", "created_at");

-- CreateIndex
CREATE INDEX "document_redactions_organization_id_doc_id_restored_at_idx" ON "document_redactions"("organization_id", "doc_id", "restored_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_redactions_organization_id_doc_id_placeholder_key" ON "document_redactions"("organization_id", "doc_id", "placeholder");
