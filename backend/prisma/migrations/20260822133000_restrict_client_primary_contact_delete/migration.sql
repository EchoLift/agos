ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_primaryContactUserId_fkey";

ALTER TABLE "clients"
ADD CONSTRAINT "clients_primaryContactUserId_fkey"
FOREIGN KEY ("primaryContactUserId")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
