-- CreateTable
CREATE TABLE "platform_llm_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "secret_enc" TEXT NOT NULL,
    "last4" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "platform_llm_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_llm_credentials_provider_key" ON "platform_llm_credentials"("provider");
