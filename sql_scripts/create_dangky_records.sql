-- ====================================================================
-- SCRIPT TẠO BẢNG DANGKY_RECORDS CHO TỔ CẤP GIẤY / ĐĂNG KÝ
-- Dùng cho dự án Supabase riêng (ví dụ: https://lrnfdksqepztnihrkgrr.supabase.co)
-- hoặc chạy trên Supabase chung.
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
    
    -- Thông tin cấp giấy & kết quả
    "issueNumber" TEXT,
    "entryNumber" TEXT,
    "issueDate" DATE,
    "residentialArea" NUMERIC,
    status TEXT DEFAULT 'RECEIVED',
    
    -- Quy trình & Nhân sự
    "receivedBy" TEXT,
    "assignedTo" TEXT,
    "checkedBy" TEXT,
    "submissionDate" DATE,
    "approvalDate" DATE,
    "completedDate" DATE,
    "assignedDate" DATE,
    
    -- Tài chính
    price NUMERIC,
    "advancePayment" NUMERIC,
    
    -- Lịch sử & Bàn giao
    "statusLogs" JSONB DEFAULT '[]'::jsonb,
    "isHandedOver" BOOLEAN DEFAULT FALSE,
    "archiveHandoverDate" DATE,
    "archiveHandoverBatch" TEXT,
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Index tối ưu tra cứu
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
