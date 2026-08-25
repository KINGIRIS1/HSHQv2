-- ====================================================================
-- SCRIPT CẬP NHẬT HOÀN CHỈNH 100% CỘT CHO MODULE ĐĂNG KÝ (DANGKY_RECORDS)
-- Chạy script này trên Supabase SQL Editor để đảm bảo không bị thiếu cột
-- ====================================================================

-- 1. TẠO BẢNG DANGKY_RECORDS NẾU CHƯA CÓ
CREATE TABLE IF NOT EXISTS dangky_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'Tiếp nhận mới',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. BỔ SUNG ĐẦY ĐỦ TẤT CẢ CÁC CỘT (CẢ DẠNG CAMELCASE VÀ SNAKE_CASE ĐỂ TƯƠNG THÍCH HOÀN TOÀN)

-- Thông tin Chủ sử dụng & Chuyển quyền
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "owners" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "transferees" JSONB DEFAULT '[]'::jsonb;

-- Thông tin Người nộp hồ sơ
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantPhone" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantCccd" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantAddress" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "applicantIsOwner" BOOLEAN DEFAULT FALSE;

-- Thông tin Người được ủy quyền
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedPersonName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedPersonId" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedPersonPhone" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedPersonAddress" TEXT;

-- Thông tin Khách hàng / Người nộp (Fallback)
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submitterName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submitterPhone" TEXT;

-- Thửa đất & Giấy chứng nhận (GCN)
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

-- Tiến độ Quy trình & Cán bộ các bước (14 bước quy trình)
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

-- Tài chính & Biên lai
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "feeAmount" NUMERIC DEFAULT 0;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnedPrice" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC DEFAULT 0;

-- Ghi chú, Giấy tờ kèm theo & Lịch sử
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

-- Thời gian tạo / cập nhật
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();

-- 3. CHUYỂN ĐỔI AN TOÀN CÁC CỘT JSON NẾU TRƯỚC ĐÓ ĐANG LÀ KIỂU TEXT
DO $$
BEGIN
    -- Chuyển đổi owners sang jsonb nếu đang là text/varchar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dangky_records' AND column_name = 'owners' AND data_type IN ('text', 'character varying')
    ) THEN
        ALTER TABLE dangky_records 
        ALTER COLUMN owners TYPE JSONB 
        USING (
            CASE 
                WHEN owners IS NULL OR trim(owners::text) = '' THEN '[]'::jsonb
                WHEN trim(owners::text) LIKE '[%' OR trim(owners::text) LIKE '{%' THEN (
                    CASE WHEN jsonb_typeof(owners::jsonb) IS NOT NULL THEN owners::jsonb ELSE '[]'::jsonb END
                )
                ELSE jsonb_build_array(jsonb_build_object('name', owners::text))
            END
        );
    END IF;

    -- Chuyển đổi transferees sang jsonb nếu đang là text/varchar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dangky_records' AND column_name = 'transferees' AND data_type IN ('text', 'character varying')
    ) THEN
        ALTER TABLE dangky_records 
        ALTER COLUMN transferees TYPE JSONB 
        USING (
            CASE 
                WHEN transferees IS NULL OR trim(transferees::text) = '' THEN '[]'::jsonb
                WHEN trim(transferees::text) LIKE '[%' OR trim(transferees::text) LIKE '{%' THEN (
                    CASE WHEN jsonb_typeof(transferees::jsonb) IS NOT NULL THEN transferees::jsonb ELSE '[]'::jsonb END
                )
                ELSE jsonb_build_array(jsonb_build_object('name', transferees::text))
            END
        );
    END IF;

    -- Chuyển đổi statusLogs sang jsonb nếu đang là text/varchar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dangky_records' AND column_name = 'statusLogs' AND data_type IN ('text', 'character varying')
    ) THEN
        ALTER TABLE dangky_records 
        ALTER COLUMN "statusLogs" TYPE JSONB 
        USING (
            CASE 
                WHEN "statusLogs" IS NULL OR trim("statusLogs"::text) = '' THEN '[]'::jsonb
                WHEN trim("statusLogs"::text) LIKE '[%' THEN "statusLogs"::jsonb
                ELSE '[]'::jsonb
            END
        );
    END IF;
END $$;

-- 4. TẠO INDEXES TỐI ƯU TRA CỨU AN TOÀN
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
CREATE INDEX IF NOT EXISTS idx_dangky_applicant ON dangky_records("applicantName");
CREATE INDEX IF NOT EXISTS idx_dangky_created_at ON dangky_records("createdAt");

-- Tạo GIN index cho JSONB nếu cột đúng định dạng jsonb
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dangky_records' AND column_name = 'owners' AND data_type = 'jsonb'
    ) THEN
        DROP INDEX IF EXISTS idx_dangky_owners;
        CREATE INDEX idx_dangky_owners ON dangky_records USING gin (owners);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'dangky_records' AND column_name = 'transferees' AND data_type = 'jsonb'
    ) THEN
        DROP INDEX IF EXISTS idx_dangky_transferees;
        CREATE INDEX idx_dangky_transferees ON dangky_records USING gin (transferees);
    END IF;
END $$;

-- 5. BẬT BẢO MẬT ROW LEVEL SECURITY (RLS)
ALTER TABLE dangky_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cho phép tất cả thao tác trên dangky_records" ON dangky_records;
CREATE POLICY "Cho phép tất cả thao tác trên dangky_records" ON dangky_records FOR ALL USING (true);

-- 6. TẠO BẢNG RECORD_HISTORY (NẾU CHƯA CÓ) ĐỂ TRÁNH LỖI 42P01
CREATE TABLE IF NOT EXISTS record_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    record_id TEXT,
    record_code TEXT,
    action TEXT,
    changes JSONB DEFAULT '{}'::jsonb,
    performed_by TEXT,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE record_history ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE record_history ADD COLUMN IF NOT EXISTS record_code TEXT;
ALTER TABLE record_history ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE record_history ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE record_history ADD COLUMN IF NOT EXISTS performed_by TEXT;
ALTER TABLE record_history ADD COLUMN IF NOT EXISTS performed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE record_history ADD COLUMN IF NOT EXISTS record_module VARCHAR(50) DEFAULT 'records';
ALTER TABLE record_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cho phép tất cả thao tác trên record_history" ON record_history;
CREATE POLICY "Cho phép tất cả thao tác trên record_history" ON record_history FOR ALL USING (true);
