-- =========================================================================
-- SQL SCRIPT: Thêm cột lưu trữ danh sách Chủ hồ sơ (Người đứng tên Giấy chứng nhận)
-- Áp dụng cho các bảng trong hệ thống Supabase / PostgreSQL (bảng dangky_records, land_records, luutru_records, archive_records)
-- Cột certificate_owners / "certificateOwners" lưu dạng JSONB chứa mảng 5 thuộc tính:
-- 1. STT (#)
-- 2. Họ tên chủ hồ sơ (Người đứng tên GCN) *
-- 3. Giấy CMND / CCCD *
-- 4. Số điện thoại
-- 5. Địa chỉ chủ sử dụng
-- =========================================================================

-- 1. Thêm cột cho bảng dangky_records (Module Đăng ký / Cấp giấy 3.x)
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS certificate_owners jsonb DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "certificateOwners" jsonb DEFAULT '[]'::jsonb;

-- 2. Thêm cột cho bảng land_records (Module Đo đạc)
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS certificate_owners jsonb DEFAULT '[]'::jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "certificateOwners" jsonb DEFAULT '[]'::jsonb;

-- 3. Thêm cột cho bảng luutru_records (Module Lưu trữ)
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS certificate_owners jsonb DEFAULT '[]'::jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "certificateOwners" jsonb DEFAULT '[]'::jsonb;

-- 4. Thêm cột cho bảng archive_records
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS certificate_owners jsonb DEFAULT '[]'::jsonb;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "certificateOwners" jsonb DEFAULT '[]'::jsonb;

-- Thông báo hoàn hoàn tất
COMMENT ON COLUMN dangky_records.certificate_owners IS 'Danh sách Chủ hồ sơ (Người đứng tên Giấy chứng nhận) gồm 5 cột: STT, Họ tên, CMND/CCCD, SĐT, Địa chỉ';
