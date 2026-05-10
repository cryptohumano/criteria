-- Eliminamos `tenant_documents`: la cuota real del producto son tokens LLM,
-- no la cantidad de documentos. Cada conversación / pad de Etherpad es un
-- documento "gratuito" en sí mismo; el costo lo lleva el agente (tokens).

-- Quitamos primero la FK si existe (compatibilidad con instalaciones que ya tenían la tabla).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_documents_organization_id_fkey'
  ) THEN
    ALTER TABLE "tenant_documents" DROP CONSTRAINT "tenant_documents_organization_id_fkey";
  END IF;
END $$;

DROP TABLE IF EXISTS "tenant_documents";
