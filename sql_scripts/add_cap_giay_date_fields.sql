-- =============================================================
-- SCRIPT BỔ SUNG CÁC MỐC NGÀY CHUYÊN BIỆT CHO HỒ SƠ CẤP GIẤY
-- 1. tax_transfer_date (Ngày chuyển thuế)
-- 2. tax_notice_date (Ngày nhận TB Thuế KV7)
-- 3. tax_paid_date (Ngày nộp thuế / Giấy nộp tiền)
-- 4. printed_date (Ngày in & hoàn thiện)
-- =============================================================

-- 1. Bổ sung cột vào bảng dangky_records (Dành cho Tab Cấp Giấy)
ALTER TABLE IF EXISTS dangky_records 
  ADD COLUMN IF NOT EXISTS tax_transfer_date DATE,
  ADD COLUMN IF NOT EXISTS tax_notice_date DATE,
  ADD COLUMN IF NOT EXISTS tax_paid_date DATE,
  ADD COLUMN IF NOT EXISTS printed_date DATE;

-- 2. Bổ sung cột vào bảng cap_giay_records
ALTER TABLE IF EXISTS cap_giay_records 
  ADD COLUMN IF NOT EXISTS tax_transfer_date DATE,
  ADD COLUMN IF NOT EXISTS tax_notice_date DATE,
  ADD COLUMN IF NOT EXISTS tax_paid_date DATE,
  ADD COLUMN IF NOT EXISTS printed_date DATE;

-- 3. Bổ sung cột vào bảng land_records
ALTER TABLE IF EXISTS land_records 
  ADD COLUMN IF NOT EXISTS tax_transfer_date DATE,
  ADD COLUMN IF NOT EXISTS tax_notice_date DATE,
  ADD COLUMN IF NOT EXISTS tax_paid_date DATE,
  ADD COLUMN IF NOT EXISTS printed_date DATE;

-- Chú thích các cột dữ liệu mới
COMMENT ON COLUMN dangky_records.tax_transfer_date IS 'Ngày chuyển thuế sang cơ quan thuế';
COMMENT ON COLUMN dangky_records.tax_notice_date IS 'Ngày nhận Thông báo thuế KV7';
COMMENT ON COLUMN dangky_records.tax_paid_date IS 'Ngày công dân nộp thuế / Giấy nộp tiền';
COMMENT ON COLUMN dangky_records.printed_date IS 'Ngày in & hoàn thiện GCN';
