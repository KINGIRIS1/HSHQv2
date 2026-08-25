-- ============================================================
-- SCRIPT ĐỒNG BỘ TOÀN BỘ CỘT CƠ SỞ DỮ LIỆU (SCHEMA SYNCHRONIZATION)
-- Áp dụng cho cả 3 Module: Đo đạc (land_records), Lưu trữ (luutru_records), Đăng ký (dang_ky_records)
-- ============================================================

-- ------------------------------------------------------------
-- 1. BẢNG HỒ SƠ ĐO ĐẠC & HỒ SƠ CHUNG (land_records)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS land_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT,
    status TEXT DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

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
CREATE TABLE IF NOT EXISTS luutru_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT DEFAULT 'saoluc',
    status TEXT DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

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

-- Thông tin ủy quyền
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "authorizedPersonAddress" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "authorizedPersonName" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "authorizedPersonId" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "authorizedPersonPhone" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "authDocType" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "otherDocs" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS authorized_person_address TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS authorized_person_name TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS authorized_person_id TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS authorized_person_phone TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS authorized_by TEXT;


-- ------------------------------------------------------------
-- 3. BẢNG HỒ SƠ ĐĂNG KÝ ĐẤT ĐAI (dangky_records)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dangky_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'Tiếp nhận mới',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "owners" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "transferees" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantPhone" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantCccd" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantAddress" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantIsOwner" BOOLEAN DEFAULT FALSE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedPersonName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedPersonId" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedPersonPhone" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedPersonAddress" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submitterName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submitterPhone" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "entryNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "totalArea" NUMERIC DEFAULT 0;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS area NUMERIC DEFAULT 0;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "residentialArea" NUMERIC DEFAULT 0;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "nonBoundaryWard" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "isNonBoundary" BOOLEAN DEFAULT FALSE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "assignedDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "appraisalDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "appraisalStaff" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxFormDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxFormNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxFormStaff" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxKV7TransferDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxKV7Staff" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxNoticeDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxNoticeStaff" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxPaymentReceiptDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printStaff" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "checkedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submissionDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submittedTo" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "approvalDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "completedDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "handoverWard" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "deliveryDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "feeAmount" NUMERIC DEFAULT 0;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnedPrice" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC DEFAULT 0;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Tiếp nhận mới';
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "personalNotes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "privateNotes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "otherDocs" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "attachedDocs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "attachedDocuments" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "explanationPlan" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------
-- 4. BẢNG PHỤ TRỢ (Lịch sử thao tác & Bình luận)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS record_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    record_id TEXT,
    action TEXT,
    performed_by TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS record_notes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    record_id TEXT,
    author TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE record_history ADD COLUMN IF NOT EXISTS record_module VARCHAR(50) DEFAULT 'records';
ALTER TABLE record_notes ADD COLUMN IF NOT EXISTS record_module VARCHAR(50) DEFAULT 'records';
