BEGIN;

ALTER TABLE "users" RENAME COLUMN "passwordResetToken" TO "passwordResetDigest";
UPDATE "users"
SET "passwordResetDigest" = NULL, "passwordResetExpires" = NULL
WHERE "passwordResetDigest" IS NOT NULL OR "passwordResetExpires" IS NOT NULL;

COMMIT;
