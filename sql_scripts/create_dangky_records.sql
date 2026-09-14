-- ====================================================================
-- SCRIPT TẠO BẢNG DANGKY_RECORDS ĐẦY ĐỦ CHO TỔ CẤP GIẤY / ĐĂNG KÝ
-- Dùng chạy trên Supabase SQL Editor (Database -> SQL Editor)
-- ====================================================================

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
    "recordType" TEXT,
    content TEXT,
    
    -- Thời gian & Hạn giải quyết
    "receivedDate" DATE,
    deadline DATE,
    "assignedDate" DATE,
    
    -- Thông tin cấp giấy & kết quả
    "issueNumber" TEXT,
    "entryNumber" TEXT,
    "issueDate" DATE,
    "residentialArea" NUMERIC,
    status TEXT DEFAULT 'RECEIVED',
    
    -- Quy trình & Tiến độ nhân sự
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
    
    -- Tài chính & Biên lai
    price NUMERIC,
    "advancePayment" NUMERIC,
    "receiptNumber" TEXT,
    "receiptType" TEXT,
    "receiverName" TEXT,
    "returnedBy" TEXT,
    "resultReturnedDate" DATE,
    "returnedPrice" NUMERIC,
    
    -- Bàn giao & Đợt xuất
    "exportBatch" TEXT,
    "exportDate" DATE,
    "handoverWard" TEXT,
    "returnBatch" NUMERIC,
    "returnBatchDate" DATE,
    "returnHandoverDept" TEXT,
    "isHandedOver" BOOLEAN DEFAULT FALSE,
    "archiveHandoverDate" DATE,
    "archiveHandoverBatch" TEXT,
    
    -- Ủy quyền, Ghi chú & Tệp đính kèm
    "authorizedBy" TEXT,
    "authDocType" TEXT,
    notes TEXT,
    "privateNotes" TEXT,
    "personalNotes" TEXT,
    "otherDocs" TEXT,
    "attachedFiles" JSONB DEFAULT '[]'::jsonb,
    "dossierComponents" JSONB DEFAULT '[]'::jsonb,
    "statusLogs" JSONB DEFAULT '[]'::jsonb,
    
    -- Chỉnh lý & Nhắc nhở
    "needsMapCorrection" BOOLEAN DEFAULT FALSE,
    "explanationPlan" TEXT,
    "reminderDate" TIMESTAMPTZ,
    "lastRemindedAt" TIMESTAMPTZ,
    "deadlineReminded" BOOLEAN DEFAULT FALSE,
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Index tối ưu hiệu năng tra cứu
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
CREATE INDEX IF NOT EXISTS idx_dangky_assigned ON dangky_records("assignedTo");
CREATE INDEX IF NOT EXISTS idx_dangky_created_at ON dangky_records("createdAt" DESC);

