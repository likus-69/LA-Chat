-- CreateTable
CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "duration_sec" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "media_assets_ownerId_status_idx" ON "media_assets"("owner_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "media_assets_status_expiresAt_idx" ON "media_assets"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "per_type" JSONB NOT NULL DEFAULT '{"message.new":{"inApp":true,"push":true},"announcement.new":{"inApp":true,"push":true}}',
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
