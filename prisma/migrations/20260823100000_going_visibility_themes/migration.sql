-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "siteThemeId" TEXT NOT NULL DEFAULT 'wisdom-bamboo',

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "themeId" TEXT;

-- AlterTable
ALTER TABLE "Spot" ADD COLUMN "showOnGoing" BOOLEAN NOT NULL DEFAULT true;

-- Seed default site settings
INSERT INTO "SiteSettings" ("id", "siteThemeId") VALUES ('default', 'wisdom-bamboo');
