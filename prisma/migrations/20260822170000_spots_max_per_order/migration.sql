-- AlterTable
ALTER TABLE "Event" ADD COLUMN "maxPerOrder" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Spot" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHolder" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Spot_pkey" PRIMARY KEY ("id")
);

-- Backfill one holder spot per registration
INSERT INTO "Spot" ("id", "registrationId", "name", "isHolder", "status", "createdAt")
SELECT
    'spot_' || r."id",
    r."id",
    COALESCE(NULLIF(r."preferredName", ''), u."name"),
    true,
    r."status",
    r."createdAt"
FROM "Registration" r
JOIN "User" u ON u."id" = r."userId";

-- Move payments onto holder spots
ALTER TABLE "Payment" ADD COLUMN "spotId" TEXT;

UPDATE "Payment" SET "spotId" = 'spot_' || "registrationId";

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_registrationId_fkey";
DROP INDEX "Payment_registrationId_key";
ALTER TABLE "Payment" DROP COLUMN "registrationId";

ALTER TABLE "Payment" ALTER COLUMN "spotId" SET NOT NULL;
CREATE UNIQUE INDEX "Payment_spotId_key" ON "Payment"("spotId");

-- Foreign keys
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_spotId_fkey" FOREIGN KEY ("spotId") REFERENCES "Spot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
