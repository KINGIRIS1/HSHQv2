-- ====================================================================
-- SCRIPT CẬP NHẬT HOÀN CHỈNH CHO SUPABASE (DÙNG CHO SQL EDITOR)
-- Sao chép toàn bộ nội dung file này và dán vào SQL Editor trên Supabase,
-- sau đó bấm "Run" để cập nhật đầy đủ các cột và kiểu dữ liệu.
-- ====================================================================

-- 1. Cập nhật kiểu dữ liệu bảng EMPLOYEES (Nếu cột id đang là UUID làm lỗi NVxxx)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
        ALTER TABLE employees ALTER COLUMN id TYPE text USING id::text;
    END IF;
END $$;

-- 2. Đảm bảo bảng LAND_RECORDS có đầy đủ tất cả các cột mới nhất
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "customerAddress" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "entryNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "residentialArea" numeric;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" boolean;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "explanationPlan" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiverName" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "reminderDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "deadlineReminded" boolean;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "measurementNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "excerptNumber" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportBatch" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "handoverWard" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authorizedBy" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authDocType" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "otherDocs" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "privateNotes" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "personalNotes" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submittedTo" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedBy" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submissionDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "approvalDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedTo" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receivedBy" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedWorkDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "price" numeric;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "advancePayment" numeric;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "isHandedOver" boolean;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "statusLogs" jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "stepAssignments" jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "capGiaySubStep" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "thamDinhDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "thamDinhBy" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "chuyenThueDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "chuyenThueBy" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "hoanThienDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "hoanThienBy" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "initialAssignedTo" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "lastAssignedTo" text;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" text;

-- 3. Đổi kiểu dữ liệu các cột trong LAND_RECORDS về kiểu CHUỖI (text) tránh lỗi kiểu dữ liệu 22P02
ALTER TABLE land_records ALTER COLUMN "exportBatch" TYPE text USING "exportBatch"::text;
ALTER TABLE land_records ALTER COLUMN "archiveHandoverBatch" TYPE text USING "archiveHandoverBatch"::text;
ALTER TABLE land_records ALTER COLUMN "excerptNumber" TYPE text USING "excerptNumber"::text;
ALTER TABLE land_records ALTER COLUMN "measurementNumber" TYPE text USING "measurementNumber"::text;

-- 4. Nếu bảng ARCHIVE_RECORDS tồn tại, đảm bảo cột exportBatch là kiểu CHUỖI (text)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archive_records') THEN
        ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "exportBatch" text;
        ALTER TABLE archive_records ALTER COLUMN "exportBatch" TYPE text USING "exportBatch"::text;
    END IF;
END $$;
