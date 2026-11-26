-- Add a published-job discovery index without changing any records.
CREATE INDEX "Opportunity_status_moderation_deadline_idx" ON "Opportunity"("status", "moderation", "deadline");
