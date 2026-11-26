-- Optional, provider-hosted WebVTT captions. Existing lesson records are preserved.
ALTER TABLE "Lesson" ADD COLUMN "captionsUrl" TEXT;
