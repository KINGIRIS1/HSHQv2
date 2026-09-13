-- =======================================================================
-- SQL BỔ SUNG CỘT LƯU THÀNH PHẦN HỒ SƠ VÀ FILE ĐÍNH KÈM THEO CÔNG ĐOẠN
-- Áp dụng cho 3 bảng: land_records (2.x), dangky_records (3.x), luutru_records (1.x)
-- =======================================================================

-- 1. Bảng Tổ Đo đạc (land_records - Nhóm 2.x)
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "dossierComponents" jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "attachedFiles" jsonb;

-- 2. Bảng Tổ Cấp giấy (dangky_records - Nhóm 3.x)
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "dossierComponents" jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "attachedFiles" jsonb;

-- 3. Bảng Tổ Lưu trữ (luutru_records - Nhóm 1.x)
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "dossierComponents" jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "attachedFiles" jsonb;
