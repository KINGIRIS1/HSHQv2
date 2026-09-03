-- ==============================================================================
-- KỊCH BẢN SQL CHUẨN TƯƠNG THÍCH CAO: KHỬ TRÙNG & PHÂN LOẠI HỒ SƠ 1.x, 2.x, 3.x
-- ==============================================================================
-- Quy tắc:
--  * 1.x (Sao lục, Công văn, Cung cấp dữ liệu) -> Bảng luutru_records
--  * 2.x (Trích lục, Trích đo, Duyệt đơn, Cắm mốc, Tách-Hợp thửa) -> Bảng land_records
--  * 3.x (Đăng ký biến động, Cấp giấy GCN) -> Bảng dangky_records
-- ==============================================================================

-- BƯỚC 0: ĐỒNG BỘ ĐẦY ĐỦ CÁC CỘT CẦN THIẾT CHO CẢ 3 BẢNG
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "recordType" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receivedDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "deadline" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "privateNotes" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "personalNotes" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submittedTo" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedWorkDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authorizedBy" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authDocType" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "otherDocs" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportBatch" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "handoverWard" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "measurementNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "excerptNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiverName" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "reminderDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" boolean;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "explanationPlan" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "customerAddress" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "entryNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "residentialArea" numeric;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" text;

ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "recordType" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "deadline" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "privateNotes" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "personalNotes" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submittedTo" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "completedWorkDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "checkedDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedBy" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authDocType" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "otherDocs" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportBatch" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "handoverWard" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "measurementNumber" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "excerptNumber" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptNumber" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiverName" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "reminderDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" boolean;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "explanationPlan" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "customerAddress" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueNumber" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "entryNumber" text;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "residentialArea" numeric;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" date;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" text;

-- Đồng bộ cấu trúc luutru_records (Tổ Lưu Trữ) nếu bảng đang dùng schema chi tiết như land_records
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "code" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "customerName" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "phoneNumber" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "cccd" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "customerAddress" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "ward" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "landPlot" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "mapSheet" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "area" numeric;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "group" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "recordType" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receivedDate" date;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receivedBy" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "deadline" date;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "exportBatch" text;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "status" text;


-- ==============================================================================
-- BƯỚC 1: SAO CHÉP DỮ LIỆU ĐẾN ĐÚNG BẢNG MỤC TIÊU
-- ==============================================================================

-- 1.1 Sao chép hồ sơ 1.x từ land_records sang luutru_records
INSERT INTO luutru_records (id, code, "customerName", "phoneNumber", cccd, "customerAddress", ward, "landPlot", "mapSheet", area, address, "group", "content", "recordType", "receivedDate", "receivedBy", deadline, "exportBatch", status)
SELECT id, code, "customerName", "phoneNumber", cccd, "customerAddress", ward, "landPlot", "mapSheet", area, address, "group", "content", "recordType", "receivedDate", "receivedBy", deadline, "exportBatch", status
FROM land_records
WHERE (
    "recordType" LIKE '1.%' OR "recordType" ILIKE '%sao lục%' OR "recordType" ILIKE '%công văn%' OR "recordType" ILIKE '%cung cấp tài liệu%' OR "recordType" ILIKE '%cung cấp dữ liệu%'
    OR "content" LIKE '1.%' OR "content" ILIKE '%sao lục%' OR "content" ILIKE '%công văn%'
)
ON CONFLICT (id) DO UPDATE SET
    "recordType" = EXCLUDED."recordType",
    "content" = EXCLUDED."content";

-- 1.2 Sao chép hồ sơ 1.x từ dangky_records sang luutru_records
INSERT INTO luutru_records (id, code, "customerName", "phoneNumber", cccd, "customerAddress", ward, "landPlot", "mapSheet", area, address, "group", "content", "recordType", "receivedDate", "receivedBy", deadline, "exportBatch", status)
SELECT id, code, "customerName", "phoneNumber", cccd, "customerAddress", ward, "landPlot", "mapSheet", area, address, "group", "content", "recordType", "receivedDate", "receivedBy", deadline, "exportBatch", status
FROM dangky_records
WHERE (
    "recordType" LIKE '1.%' OR "recordType" ILIKE '%sao lục%' OR "recordType" ILIKE '%công văn%' OR "recordType" ILIKE '%cung cấp tài liệu%' OR "recordType" ILIKE '%cung cấp dữ liệu%'
    OR "content" LIKE '1.%' OR "content" ILIKE '%sao lục%' OR "content" ILIKE '%công văn%'
)
ON CONFLICT (id) DO UPDATE SET
    "recordType" = EXCLUDED."recordType",
    "content" = EXCLUDED."content";

-- 1.3 Sao chép hồ sơ 3.x từ land_records sang dangky_records
INSERT INTO dangky_records (id, code, "customerName", "phoneNumber", cccd, "customerAddress", ward, "landPlot", "mapSheet", area, address, "group", "content", "recordType", "receivedDate", "receivedBy", deadline, "exportBatch", status)
SELECT id, code, "customerName", "phoneNumber", cccd, "customerAddress", ward, "landPlot", "mapSheet", area, address, "group", "content", "recordType", "receivedDate", "receivedBy", deadline, "exportBatch", status
FROM land_records
WHERE (
    "recordType" LIKE '3.%' OR "recordType" ILIKE '%đăng ký biến động%' OR "recordType" ILIKE '%cấp giấy%' OR "recordType" ILIKE '%cấp đổi%'
    OR "content" LIKE '3.%' OR "content" ILIKE '%đăng ký biến động%'
)
ON CONFLICT (id) DO UPDATE SET
    "recordType" = EXCLUDED."recordType",
    "content" = EXCLUDED."content";

-- 1.4 Sao chép hồ sơ 2.x từ dangky_records sang land_records
INSERT INTO land_records (id, code, "customerName", "phoneNumber", cccd, "customerAddress", ward, "landPlot", "mapSheet", area, address, "group", "content", "recordType", "receivedDate", "receivedBy", deadline, "exportBatch", status)
SELECT id, code, "customerName", "phoneNumber", cccd, "customerAddress", ward, "landPlot", "mapSheet", area, address, "group", "content", "recordType", "receivedDate", "receivedBy", deadline, "exportBatch", status
FROM dangky_records
WHERE (
    "recordType" LIKE '2.%' OR "recordType" ILIKE '%trích lục%' OR "recordType" ILIKE '%trích đo%' OR "recordType" ILIKE '%duyệt đơn%' OR "recordType" ILIKE '%cắm mốc%' OR "recordType" ILIKE '%tách%' OR "recordType" ILIKE '%hợp thửa%'
    OR "content" LIKE '2.%' OR "content" ILIKE '%trích lục%' OR "content" ILIKE '%trích đo%'
)
ON CONFLICT (id) DO UPDATE SET
    "recordType" = EXCLUDED."recordType",
    "content" = EXCLUDED."content";


-- ==============================================================================
-- BƯỚC 2: XÓA TRIỆT ĐỂ BẢN GHI LƯU SAI BẢNG & TRÙNG LẶP
-- ==============================================================================

-- 2.1 Xóa khỏi land_records các hồ sơ 1.x (Lưu trữ) và 3.x (Đăng ký)
DELETE FROM land_records
WHERE (
    -- Hồ sơ 1.x
    "recordType" LIKE '1.%' 
    OR "recordType" ILIKE '%sao lục%' 
    OR "recordType" ILIKE '%công văn%' 
    OR "recordType" ILIKE '%cung cấp tài liệu%' 
    OR "recordType" ILIKE '%cung cấp dữ liệu%'
    OR "content" LIKE '1.%'
    OR "content" ILIKE '%sao lục%'
    OR "content" ILIKE '%công văn%'
    -- Hồ sơ 3.x
    OR "recordType" LIKE '3.%'
    OR "recordType" ILIKE '%đăng ký biến động%'
    OR "recordType" ILIKE '%cấp giấy%'
    OR "recordType" ILIKE '%cấp đổi%'
    OR "content" LIKE '3.%'
    OR "content" ILIKE '%đăng ký biến động%'
);

-- 2.2 Xóa khỏi dangky_records các hồ sơ 1.x (Lưu trữ) và 2.x (Đo đạc)
DELETE FROM dangky_records
WHERE (
    -- Hồ sơ 1.x
    "recordType" LIKE '1.%' 
    OR "recordType" ILIKE '%sao lục%' 
    OR "recordType" ILIKE '%công văn%' 
    OR "recordType" ILIKE '%cung cấp tài liệu%' 
    OR "recordType" ILIKE '%cung cấp dữ liệu%'
    OR "content" LIKE '1.%'
    -- Hồ sơ 2.x
    OR "recordType" LIKE '2.%'
    OR "recordType" ILIKE '%trích lục%'
    OR "recordType" ILIKE '%trích đo%'
    OR "recordType" ILIKE '%duyệt đơn%'
    OR "recordType" ILIKE '%cắm mốc%'
    OR "recordType" ILIKE '%tách%'
    OR "recordType" ILIKE '%hợp thửa%'
    OR "content" LIKE '2.%'
    OR "content" ILIKE '%trích lục%'
    OR "content" ILIKE '%trích đo%'
);

-- 2.3 Xóa khỏi luutru_records các hồ sơ 2.x (Đo đạc) và 3.x (Đăng ký)
DELETE FROM luutru_records
WHERE (
    -- Hồ sơ 2.x
    "recordType" LIKE '2.%'
    OR "recordType" ILIKE '%trích lục%'
    OR "recordType" ILIKE '%trích đo%'
    OR "recordType" ILIKE '%duyệt đơn%'
    OR "recordType" ILIKE '%cắm mốc%'
    OR "recordType" ILIKE '%tách%'
    OR "recordType" ILIKE '%hợp thửa%'
    -- Hồ sơ 3.x
    OR "recordType" LIKE '3.%'
    OR "recordType" ILIKE '%đăng ký biến động%'
    OR "recordType" ILIKE '%cấp giấy%'
    OR "recordType" ILIKE '%cấp đổi%'
);

-- BƯỚC 3: KIỂM TRA SỐ LƯỢNG HỒ SƠ SAU KHI PHÂN CHIA CHUẨN
SELECT 'luutru_records (1.x - Lưu trữ)' AS bang, count(*) AS so_luong FROM luutru_records
UNION ALL
SELECT 'land_records (2.x - Đo đạc)' AS bang, count(*) AS so_luong FROM land_records
UNION ALL
SELECT 'dangky_records (3.x - Đăng ký)' AS bang, count(*) AS so_luong FROM dangky_records;
