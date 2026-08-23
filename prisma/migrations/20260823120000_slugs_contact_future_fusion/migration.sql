-- AlterTable
ALTER TABLE "Event" ADD COLUMN "contactDetails" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ALTER COLUMN "siteThemeId" SET DEFAULT 'future-fusion';

UPDATE "SiteSettings"
SET "siteThemeId" = 'future-fusion'
WHERE "id" = 'default' AND "siteThemeId" = 'wisdom-bamboo';
