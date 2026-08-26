-- ============================================================
-- SCRIPT ĐỒNG BỘ TOÀN BỘ CỘT CƠ SỞ DỮ LIỆU (SCHEMA SYNCHRONIZATION)
-- Áp dụng cho cả 3 Module: Đo đạc (land_records), Lưu trữ (luutru_records), Đăng ký (dang_ky_records)
-- ============================================================

-- ------------------------------------------------------------
-- 1. BẢNG HỒ SƠ ĐO ĐẠC & HỒ SƠ CHUNG (land_records)
-- ------------------------------------------------------------
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS procedure_id VARCHAR(20);
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS original_appointment_date DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS actual_return_date DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS total_fee DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS is_extended BOOLEAN DEFAULT FALSE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS extension_days INT DEFAULT 0;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS extension_reason TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50);
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS sourceType VARCHAR(50) DEFAULT 'truc_tiep';

-- Thông tin trả kết quả & Lưu trữ
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS return_receipt_number VARCHAR(100);
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS return_recipient_name VARCHAR(255);
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS return_recipient_phone VARCHAR(50);
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS return_note TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS archive_code VARCHAR(100);

-- Các trường mở rộng người yêu cầu
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS requester_name VARCHAR(255);
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS requester_phone VARCHAR(50);
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS requester_id_card VARCHAR(50);
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS content_request TEXT;


-- ------------------------------------------------------------
-- 2. BẢNG HỒ SƠ LƯU TRỮ (luutru_records)
-- ------------------------------------------------------------
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS group_name VARCHAR(100);
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS procedure_id VARCHAR(20);
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS original_appointment_date DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS actual_return_date DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS total_fee DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS is_extended BOOLEAN DEFAULT FALSE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS extension_days INT DEFAULT 0;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS extension_reason TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50);
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS sourceType VARCHAR(50) DEFAULT 'truc_tiep';

-- Thông tin trả kết quả & Lưu trữ
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS return_receipt_number VARCHAR(100);
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS return_recipient_name VARCHAR(255);
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS return_recipient_phone VARCHAR(50);
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS return_note TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;


-- ------------------------------------------------------------
-- 3. BẢNG HỒ SƠ ĐĂNG KÝ ĐẤT ĐAI (dang_ky_records)
-- ------------------------------------------------------------
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS address VARCHAR(255);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS group_name VARCHAR(100);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS procedure_id VARCHAR(20);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS original_appointment_date DATE;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS actual_return_date DATE;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS price DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS total_fee DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS is_extended BOOLEAN DEFAULT FALSE;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS extension_days INT DEFAULT 0;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS extension_reason TEXT;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS sourceType VARCHAR(50) DEFAULT 'truc_tiep';

-- Thông tin trả kết quả & Lưu trữ
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS return_receipt_number VARCHAR(100);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS return_recipient_name VARCHAR(255);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS return_recipient_phone VARCHAR(50);
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS return_note TEXT;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE dang_ky_records ADD COLUMN IF NOT EXISTS archive_code VARCHAR(100);

-- ------------------------------------------------------------
-- 4. BẢNG PHỤ TRỢ (Lịch sử thao tác & Bình luận)
-- ------------------------------------------------------------
ALTER TABLE record_history ADD COLUMN IF NOT EXISTS record_module VARCHAR(50) DEFAULT 'records';
ALTER TABLE record_notes ADD COLUMN IF NOT EXISTS record_module VARCHAR(50) DEFAULT 'records';
