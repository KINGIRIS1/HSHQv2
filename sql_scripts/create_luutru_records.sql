-- ====================================================================
-- SCRIPT TẠO BẢNG LUUTRU_RECORDS CHO TỔ LƯU TRỮ TRÊN SUPABASE
-- ====================================================================

CREATE TABLE IF NOT EXISTS luutru_records (
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
    content TEXT,
    "recordType" TEXT,
    
    -- Mốc thời gian & Trạng thái
    "receivedDate" DATE,
    deadline DATE,
    "assignedDate" DATE,
    status TEXT DEFAULT 'RECEIVED',
    
    -- Nhân sự & Tiến độ
    "receivedBy" TEXT,
    "assignedTo" TEXT,
    "pendingCheckDate" DATE,
    "checkedBy" TEXT,
    "checkedDate" DATE,
    "completedWorkDate" DATE,
    "submissionDate" DATE,
    "submittedTo" TEXT,
    "approvalDate" DATE,
    "completedDate" DATE,
    
    -- Số trích đo / trích lục
    "measurementNumber" TEXT,
    "excerptNumber" TEXT,
    "issueNumber" TEXT,
    "entryNumber" TEXT,
    "issueDate" DATE,
    "residentialArea" NUMERIC,
    
    -- Tài chính & Trả kết quả
    price NUMERIC,
    "advancePayment" NUMERIC,
    "receiptNumber" TEXT,
    "receiverName" TEXT,
    "resultReturnedDate" DATE,
    
    -- Đợt xuất & Bàn giao
    "exportBatch" TEXT,
    "exportDate" DATE,
    "handoverWard" TEXT,
    "isHandedOver" BOOLEAN DEFAULT FALSE,
    "archiveHandoverDate" DATE,
    "archiveHandoverBatch" TEXT,
    
    -- Chỉnh lý & Nhắc nhở
    "needsMapCorrection" BOOLEAN DEFAULT FALSE,
    "explanationPlan" TEXT,
    "reminderDate" TIMESTAMPTZ,
    "lastRemindedAt" TIMESTAMPTZ,
    "deadlineReminded" BOOLEAN DEFAULT FALSE,
    
    -- Ghi chú & Thành phần hồ sơ
    "authorizedBy" TEXT,
    "authDocType" TEXT,
    "otherDocs" TEXT,
    notes TEXT,
    "privateNotes" TEXT,
    "personalNotes" TEXT,
    "dossierComponents" JSONB DEFAULT '[]'::jsonb,
    "attachedFiles" JSONB DEFAULT '[]'::jsonb,
    "statusLogs" JSONB DEFAULT '[]'::jsonb,
    
    -- Các trường mở rộng
    type TEXT,
    so_hieu TEXT,
    trich_yeu TEXT,
    ngay_thang DATE,
    noi_nhan_gui TEXT,
    created_by TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Tắt Row-Level Security để hệ thống có quyền ghi dữ liệu
ALTER TABLE luutru_records DISABLE ROW LEVEL SECURITY;

-- Tạo index tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_luutru_code ON luutru_records(code);
CREATE INDEX IF NOT EXISTS idx_luutru_status ON luutru_records(status);

