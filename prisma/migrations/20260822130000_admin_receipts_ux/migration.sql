ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "paymentInstructions" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "paymentImagePath" TEXT;
ALTER TABLE "Event" ALTER COLUMN "summary" SET DEFAULT '';

ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "preferredName" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "titlePosition" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "introBio" TEXT;
ALTER TABLE "Registration" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Registration' AND column_name = 'bioHeadline'
  ) THEN
    UPDATE "Registration"
    SET
      "preferredName" = COALESCE("preferredName", (SELECT "name" FROM "User" WHERE "User"."id" = "Registration"."userId")),
      "titlePosition" = COALESCE("titlePosition", "bioHeadline"),
      "introBio" = COALESCE("introBio", "bioAbout"),
      "linkedinUrl" = COALESCE("linkedinUrl", "bioLinkedin");
    ALTER TABLE "Registration" DROP COLUMN "bioHeadline";
    ALTER TABLE "Registration" DROP COLUMN "bioAbout";
    ALTER TABLE "Registration" DROP COLUMN "bioCompany";
    ALTER TABLE "Registration" DROP COLUMN "bioLinkedin";
  END IF;
END $$;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundNote" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundAmountCents" INTEGER;

ALTER TABLE "Registration" DROP CONSTRAINT IF EXISTS "Registration_userId_fkey";
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
