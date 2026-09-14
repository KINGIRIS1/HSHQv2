-- ==============================================================================
-- BỔ SUNG CÁC CỘT SQL CÒN THIẾU CHO CHUYỂN BƯỚC VÀ LƯU TRỮ HỒ SƠ
-- Chạy script này trên Supabase SQL Editor để đảm bảo đầy đủ các cột cho 3 bảng
-- ==============================================================================

-- 1. BẢNG HỒ SƠ ĐO ĐẠC (land_records)
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "dossierComponents" jsonb;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "attachedFiles" jsonb;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "statusLogs" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "exportBatch" text;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "exportDate" date;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "handoverWard" text;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "checkedBy" text;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "checkedDate" date;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "submittedTo" text;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "approvalDate" date;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "handoverDate" date;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "reminderDate" timestamp with time zone;
ALTER TABLE IF EXISTS land_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp with time zone;

-- 2. BẢNG HỒ SƠ LƯU TRỮ (luutru_records)
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "dossierComponents" jsonb;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "attachedFiles" jsonb;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "statusLogs" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "isHandedOver" boolean DEFAULT false;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" date;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" text;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "exportBatch" text;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "exportDate" date;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "handoverWard" text;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "checkedBy" text;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "checkedDate" date;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "submittedTo" text;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "approvalDate" date;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "reminderDate" timestamp with time zone;
ALTER TABLE IF EXISTS luutru_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp with time zone;

-- 3. BẢNG HỒ SƠ ĐĂNG KÝ / CẤP GIẤY (dangky_records)
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "dossierComponents" jsonb;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "attachedFiles" jsonb;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "statusLogs" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "exportBatch" text;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "exportDate" date;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "handoverWard" text;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "checkedBy" text;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "checkedDate" date;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "submittedTo" text;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "approvalDate" date;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "reminderDate" timestamp with time zone;
ALTER TABLE IF EXISTS dangky_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp with time zone;
