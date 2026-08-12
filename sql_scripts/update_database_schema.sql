-- ====================================================================
-- SCRIPT CẬP NHẬT HOÀN CHỈNH CHO 3 BẢNG (DANGKY, LAND, LUUTRU) TRÊN SUPABASE
-- ====================================================================

-- 1. Cập nhật kiểu dữ liệu bảng EMPLOYEES (Nếu cột id đang là UUID làm lỗi NVxxx)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
        ALTER TABLE employees ALTER COLUMN id TYPE text USING id::text;
    END IF;
END $$;

-- 2. Đảm bảo bảng LAND_RECORDS (Tổ Đo đạc) có đầy đủ tất cả các cột
CREATE TABLE IF NOT EXISTS land_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    cccd TEXT,
    "customerAddress" TEXT,
    ward TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    address TEXT,
    "group" TEXT,
    status TEXT DEFAULT 'RECEIVED',
    "measurementNumber" TEXT,
    "excerptNumber" TEXT,
    "needsMapCorrection" BOOLEAN,
    "checkedBy" TEXT,
    "checkedDate" DATE,
    "completedWorkDate" DATE,
    "receivedBy" TEXT,
    "assignedTo" TEXT,
    "submissionDate" DATE,
    "approvalDate" DATE,
    "completedDate" DATE,
    price NUMERIC,
    "advancePayment" NUMERIC,
    "isHandedOver" BOOLEAN DEFAULT FALSE,
    "statusLogs" JSONB DEFAULT '[]'::jsonb,
    "archiveHandoverDate" DATE,
    "archiveHandoverBatch" TEXT,
    "exportBatch" TEXT,
    "exportDate" DATE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

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
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" date;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" text;

-- 3. Đảm bảo bảng DANGKY_RECORDS (Tổ Cấp giấy) được tạo và cập nhật đầy đủ
CREATE TABLE IF NOT EXISTS dangky_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    cccd TEXT,
    "customerAddress" TEXT,
    ward TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    address TEXT,
    "group" TEXT,
    "issueNumber" TEXT,
    "entryNumber" TEXT,
    "issueDate" DATE,
    "residentialArea" NUMERIC,
    status TEXT DEFAULT 'RECEIVED',
    "receivedBy" TEXT,
    "assignedTo" TEXT,
    "checkedBy" TEXT,
    "submissionDate" DATE,
    "approvalDate" DATE,
    "completedDate" DATE,
    price NUMERIC,
    "advancePayment" NUMERIC,
    "statusLogs" JSONB DEFAULT '[]'::jsonb,
    "isHandedOver" BOOLEAN DEFAULT FALSE,
    "archiveHandoverDate" DATE,
    "archiveHandoverBatch" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Đảm bảo bảng LUUTRU_RECORDS và ARCHIVE_RECORDS (Tổ Lưu trữ)
CREATE TABLE IF NOT EXISTS luutru_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    so_hieu TEXT,
    trich_yeu TEXT,
    ngay_thang DATE,
    noi_nhan_gui TEXT,
    "created_by" TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    "exportBatch" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archive_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    so_hieu TEXT,
    trich_yeu TEXT,
    ngay_thang DATE,
    noi_nhan_gui TEXT,
    "created_by" TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    "exportBatch" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Đồng bộ kiểu dữ liệu text
ALTER TABLE land_records ALTER COLUMN "exportBatch" TYPE text USING "exportBatch"::text;
ALTER TABLE land_records ALTER COLUMN "archiveHandoverBatch" TYPE text USING "archiveHandoverBatch"::text;
ALTER TABLE land_records ALTER COLUMN "excerptNumber" TYPE text USING "excerptNumber"::text;
ALTER TABLE land_records ALTER COLUMN "measurementNumber" TYPE text USING "measurementNumber"::text;

