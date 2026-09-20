-- ==============================================================================
-- SCRIPT SQL BỔ SUNG ĐẦY ĐỦ TẤT CẢ CÁC BẢNG VÀ CỘT THIẾU CHO HỆ THỐNG
-- (ĐẶC BIỆT LÀ MODULE CẤP GIẤY, IN GCN, THUẾ, NIÊM YẾT VÀ BỔ SUNG HỒ SƠ)
-- 
-- HƯỚNG DẪN: Sao chép toàn bộ nội dung script này và dán vào tab "SQL Editor"
-- trên Supabase Dashboard, sau đó nhấn "RUN".
-- Script an toàn 100% (sử dụng IF NOT EXISTS), không ghi đè hay mất dữ liệu hiện có.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BẢNG dangky_records (MODULE CẤP GIẤY / TỔ ĐĂNG KÝ - NHÓM 3.x)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dangky_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thông tin khách hàng, thửa đất & phân loại thủ tục
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;

-- Mốc tiếp nhận & phân công thụ lý
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "assignedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'RECEIVED';
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;

-- Quy trình Cấp Giấy chuyên môn (Thẩm định, Niêm yết, Thuế, In GCN)
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "appraisalDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "postingDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "postingEndDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxTransferDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxKv7Date" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxPaymentDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printCertDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingHandoverDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "sourceTable" TEXT DEFAULT 'dangky_records';

-- Phân công In GCN & Tiến độ in phôi
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printStaffId" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS print_staff_id TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printStaffAssignedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS print_staff_assigned_at TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printAssignmentStatus" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS print_assignment_status TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printDeadlineStartAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS print_deadline_start_at TIMESTAMPTZ;

-- Giấy nộp tiền (GNT) & Biên lai thuế
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "paymentReceivedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "paymentReceiptDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS payment_receipt_date DATE;

-- Tạm dừng chờ công dân bổ sung hồ sơ & Phục hồi bước trước
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "previousStatus" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementReturnStatus" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementReason" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingSupplementReason" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementRequestedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementRequestedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementStartedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementCompletedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementCompletedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementConfirmedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementRequestDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementReturnedDate" DATE;

-- Tiến độ kiểm tra, trình duyệt & hoàn thành
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "checkedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "checkedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "completedWorkDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submissionDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submittedTo" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "approvalDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "completedDate" DATE;

-- Số phát hành GCN, Số vào sổ & Thông tin thửa đất bổ sung
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "entryNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "residentialArea" NUMERIC;

-- Tài chính, Biên lai & Trả kết quả công dân
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC DEFAULT 0;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnedPrice" NUMERIC DEFAULT 0;

-- Bàn giao & Đợt xuất
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "handoverWard" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnBatch" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnBatchDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnHandoverDept" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "isHandedOver" BOOLEAN DEFAULT FALSE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" TEXT;

-- Ghi chú, Giấy tờ đính kèm & Lịch sử thao tác
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authDocType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "otherDocs" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "privateNotes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "personalNotes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "dossierComponents" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "attachedFiles" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb;

-- Chỉnh lý & Nhắc nhở hạn giải quyết
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" BOOLEAN DEFAULT FALSE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "explanationPlan" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "deadlineReminded" BOOLEAN DEFAULT FALSE;

-- Cột thời gian tạo / cập nhật (hỗ trợ cả camelCase và snake_case)
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- Chuyển kiểu dữ liệu đồng bộ nếu trước đây tạo sai kiểu
ALTER TABLE IF EXISTS dangky_records ALTER COLUMN "exportBatch" TYPE text USING "exportBatch"::text;
ALTER TABLE IF EXISTS dangky_records ALTER COLUMN "archiveHandoverBatch" TYPE text USING "archiveHandoverBatch"::text;

-- Tạo Index tra cứu nhanh
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
CREATE INDEX IF NOT EXISTS idx_dangky_assigned ON dangky_records("assignedTo");
CREATE INDEX IF NOT EXISTS idx_dangky_print_staff ON dangky_records("printStaffId");
CREATE INDEX IF NOT EXISTS idx_dangky_created_at ON dangky_records(created_at DESC);


-- ------------------------------------------------------------------------------
-- 2. BẢNG land_records (MODULE ĐO ĐẠC / NHÓM 2.x) - BỔ SUNG ĐỒNG BỘ
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS land_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receivedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'RECEIVED';
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "surveyorId" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "surveyAssignedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "fieldAssignedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "fieldCompletedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "drafterId" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "officeAssignedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "officeCompletedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedWorkDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submissionDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submittedTo" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "approvalDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "measurementNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "excerptNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "entryNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "residentialArea" NUMERIC;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC DEFAULT 0;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "handoverWard" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "isHandedOver" BOOLEAN DEFAULT FALSE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" BOOLEAN DEFAULT FALSE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "explanationPlan" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMPTZ;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" TIMESTAMPTZ;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "deadlineReminded" BOOLEAN DEFAULT FALSE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authDocType" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "otherDocs" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "privateNotes" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "personalNotes" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "dossierComponents" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "attachedFiles" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "appraisalDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "postingDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "postingEndDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "taxTransferDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "taxKv7Date" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "taxPaymentDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "printCertDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "pendingHandoverDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "sourceTable" TEXT DEFAULT 'land_records';
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "previousStatus" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementReturnStatus" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementReason" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementRequestedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementRequestedAt" TIMESTAMPTZ;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementStartedAt" TIMESTAMPTZ;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementCompletedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementCompletedAt" TIMESTAMPTZ;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementConfirmedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementRequestDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "supplementReturnedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_land_code ON land_records(code);
CREATE INDEX IF NOT EXISTS idx_land_status ON land_records(status);
CREATE INDEX IF NOT EXISTS idx_land_ward ON land_records(ward);


-- ------------------------------------------------------------------------------
-- 3. BẢNG luutru_records (MODULE LƯU TRỮ / NHÓM 1.x) - BỔ SUNG ĐỒNG BỘ
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS luutru_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receivedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "assignedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'RECEIVED';
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "checkedBy" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "checkedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "completedWorkDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "submissionDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "submittedTo" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "approvalDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "completedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "entryNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC DEFAULT 0;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "exportDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "handoverWard" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "isHandedOver" BOOLEAN DEFAULT FALSE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "privateNotes" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "personalNotes" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "dossierComponents" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "attachedFiles" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "sourceTable" TEXT DEFAULT 'luutru_records';
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_luutru_code ON luutru_records(code);
CREATE INDEX IF NOT EXISTS idx_luutru_status ON luutru_records(status);


-- ------------------------------------------------------------------------------
-- 4. BẢNG vao_so_sequences & RPC FUNCTION (MODULE VÔ SỐ GCN TỰ ĐỘNG)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vao_so_sequences (
    id TEXT PRIMARY KEY,
    book_type TEXT NOT NULL,
    year INT NOT NULL,
    current_val INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_vao_so_book_year UNIQUE (book_type, year)
);

CREATE OR REPLACE FUNCTION get_next_sequence_value(
    p_book_type TEXT,
    p_year INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_seq INT;
BEGIN
    INSERT INTO vao_so_sequences (id, book_type, year, current_val, updated_at)
    VALUES (
        p_book_type || '_' || p_year::TEXT,
        p_book_type,
        p_year,
        1,
        NOW()
    )
    ON CONFLICT (book_type, year)
    DO UPDATE SET
        current_val = vao_so_sequences.current_val + 1,
        updated_at = NOW()
    RETURNING current_val INTO v_seq;

    RETURN v_seq;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. BẢNG system_settings (CẤU HÌNH HỆ THỐNG & PHÂN QUYỀN)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 6. BẢNG map_sheet_conversions (CHUYỂN ĐỔI BẢN ĐỒ CŨ - MỚI)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS map_sheet_conversions (
    id TEXT PRIMARY KEY,
    ward TEXT NOT NULL,
    old_map_sheet TEXT NOT NULL,
    new_map_sheet TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 7. TẮT ROW LEVEL SECURITY (RLS) ĐỂ TRÁNH LỖI PHÂN QUYỀN SUPABASE
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS dangky_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS land_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS luutru_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vao_so_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS map_sheet_conversions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
