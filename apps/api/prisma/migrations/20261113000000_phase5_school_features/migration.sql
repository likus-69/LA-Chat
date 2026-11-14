ALTER TABLE "announcements" ADD COLUMN "target_class_id" UUID;
ALTER TABLE "announcements" ADD COLUMN "target_stream_id" UUID;
CREATE INDEX IF NOT EXISTS "announcements_targetClassId_idx" ON "announcements"("target_class_id");
CREATE INDEX IF NOT EXISTS "announcements_targetStreamId_idx" ON "announcements"("target_stream_id");
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_class_id_fkey" FOREIGN KEY ("target_class_id") REFERENCES "classes"("id") ON DELETE SET NULL;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_target_stream_id_fkey" FOREIGN KEY ("target_stream_id") REFERENCES "streams"("id") ON DELETE SET NULL;
