-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isNetworking" BOOLEAN NOT NULL DEFAULT false,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "allowOfflinePayment" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 1,
    "themeId" TEXT,
    "contactDetails" TEXT,
    "paymentInstructions" TEXT,
    "paymentImagePath" TEXT,
    "goingVisibility" TEXT NOT NULL DEFAULT 'CHANNEL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "Channel"("slug");

-- CreateIndex
CREATE INDEX "Channel_eventId_idx" ON "Channel"("eventId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing Event page/payment fields into a default channel per event
INSERT INTO "Channel" (
  "id",
  "eventId",
  "name",
  "slug",
  "summary",
  "description",
  "venue",
  "startsAt",
  "endsAt",
  "isNetworking",
  "isPaid",
  "priceCents",
  "currency",
  "allowOfflinePayment",
  "capacity",
  "maxPerOrder",
  "themeId",
  "contactDetails",
  "paymentInstructions",
  "paymentImagePath",
  "goingVisibility",
  "createdAt"
)
SELECT
  'ch_' || "id",
  "id",
  'Main',
  "slug",
  "summary",
  "description",
  "venue",
  "startsAt",
  "endsAt",
  "isNetworking",
  "isPaid",
  "priceCents",
  "currency",
  "allowOfflinePayment",
  "capacity",
  "maxPerOrder",
  "themeId",
  "contactDetails",
  "paymentInstructions",
  "paymentImagePath",
  'CHANNEL',
  "createdAt"
FROM "Event";

-- Registration: point at channel instead of event
ALTER TABLE "Registration" ADD COLUMN "channelId" TEXT;

UPDATE "Registration" r
SET "channelId" = 'ch_' || r."eventId";

ALTER TABLE "Registration" ALTER COLUMN "channelId" SET NOT NULL;

DROP INDEX IF EXISTS "Registration_eventId_userId_key";
ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_eventId_fkey";
ALTER TABLE "Registration" DROP COLUMN "eventId";

CREATE UNIQUE INDEX "Registration_channelId_userId_key" ON "Registration"("channelId", "userId");

ALTER TABLE "Registration" ADD CONSTRAINT "Registration_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Event: visibility replaces published; drop fields moved to Channel
ALTER TABLE "Event" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';

UPDATE "Event"
SET "visibility" = CASE WHEN "published" THEN 'PUBLIC' ELSE 'UNLISTED' END;

ALTER TABLE "Event" DROP COLUMN "slug";
ALTER TABLE "Event" DROP COLUMN "summary";
ALTER TABLE "Event" DROP COLUMN "description";
ALTER TABLE "Event" DROP COLUMN "venue";
ALTER TABLE "Event" DROP COLUMN "startsAt";
ALTER TABLE "Event" DROP COLUMN "endsAt";
ALTER TABLE "Event" DROP COLUMN "isNetworking";
ALTER TABLE "Event" DROP COLUMN "isPaid";
ALTER TABLE "Event" DROP COLUMN "priceCents";
ALTER TABLE "Event" DROP COLUMN "currency";
ALTER TABLE "Event" DROP COLUMN "allowOfflinePayment";
ALTER TABLE "Event" DROP COLUMN "published";
ALTER TABLE "Event" DROP COLUMN "capacity";
ALTER TABLE "Event" DROP COLUMN "maxPerOrder";
ALTER TABLE "Event" DROP COLUMN "themeId";
ALTER TABLE "Event" DROP COLUMN "contactDetails";
ALTER TABLE "Event" DROP COLUMN "paymentInstructions";
ALTER TABLE "Event" DROP COLUMN "paymentImagePath";
