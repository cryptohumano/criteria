-- OAuth Google: subject opcional; contraseña opcional para usuarios solo-Google.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_sub" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_key" ON "users"("google_sub");
