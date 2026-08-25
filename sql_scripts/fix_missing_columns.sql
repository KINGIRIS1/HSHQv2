-- ==========================================================
-- SCRIPT BỔ SUNG CỘT CƠ SỞ DỮ LIỆU CHO SUPABASE
-- Chạy đoạn script này tại SQL Editor trong trang quản trị Supabase
-- ==========================================================

-- 1. Bổ sung các cột cho bảng dangky_records (Tổ Đăng ký / Cấp giấy)
ALTER TABLE IF EXISTS dangky_records 
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "receivedDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "customerName" TEXT,
    ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT,
    ADD COLUMN IF NOT EXISTS cccd TEXT,
    ADD COLUMN IF NOT EXISTS "customerAddress" TEXT,
    ADD COLUMN IF NOT EXISTS ward TEXT,
    ADD COLUMN IF NOT EXISTS "landPlot" TEXT,
    ADD COLUMN IF NOT EXISTS "mapSheet" TEXT,
    ADD COLUMN IF NOT EXISTS area NUMERIC,
    ADD COLUMN IF NOT EXISTS "totalArea" NUMERIC,
    ADD COLUMN IF NOT EXISTS "residentialArea" NUMERIC,
    ADD COLUMN IF NOT EXISTS "issueNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "entryNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "issueDate" DATE,
    ADD COLUMN IF NOT EXISTS "recordType" TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Tiếp nhận mới',
    ADD COLUMN IF NOT EXISTS "receivedBy" TEXT,
    ADD COLUMN IF NOT EXISTS "assignedTo" TEXT,
    ADD COLUMN IF NOT EXISTS "checkedBy" TEXT,
    ADD COLUMN IF NOT EXISTS "submissionDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "approvalDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "completedDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "exportBatch" TEXT,
    ADD COLUMN IF NOT EXISTS "resultReturnedDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "appraisalDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "appraisalStaff" TEXT,
    ADD COLUMN IF NOT EXISTS "taxFormDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "taxFormStaff" TEXT,
    ADD COLUMN IF NOT EXISTS "taxKV7TransferDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "taxNoticeDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "taxPaymentReceiptDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "printDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "pendingCheckDate" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "feeAmount" NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "owners" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "transferees" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS "personalNotes" TEXT,
    ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMPTZ;

-- 2. Bổ sung các cột cho bảng land_records (Tổ Đo đạc)
ALTER TABLE IF EXISTS land_records 
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "assignedTo" TEXT,
    ADD COLUMN IF NOT EXISTS "receivedBy" TEXT,
    ADD COLUMN IF NOT EXISTS "completedWorkDate" DATE,
    ADD COLUMN IF NOT EXISTS "pendingCheckDate" DATE,
    ADD COLUMN IF NOT EXISTS "checkedDate" DATE,
    ADD COLUMN IF NOT EXISTS "approvalDate" DATE,
    ADD COLUMN IF NOT EXISTS "completedDate" DATE,
    ADD COLUMN IF NOT EXISTS "submissionDate" DATE,
    ADD COLUMN IF NOT EXISTS "exportBatch" TEXT,
    ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE,
    ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb;

-- 3. Bổ sung các cột cho bảng excerpt_history và trichdo_history (Trích lục & Trích đo)
ALTER TABLE IF EXISTS excerpt_history 
    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS trichdo_history 
    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
