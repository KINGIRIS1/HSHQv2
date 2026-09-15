-- =========================================================================
-- SQL BỔ SUNG CÁC CỘT THIẾT YẾU CHO BẢNG dangky_records (TỔ ĐĂNG KÝ / CẤP GIẤY)
-- Chạy script này trên Supabase SQL Editor nếu bảng dangky_records đã tồn tại
-- =========================================================================

-- 1. Thời gian tiếp nhận & Hạn giải quyết
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "deadline" DATE;

-- 2. Phân loại thủ tục & Nội dung
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "content" TEXT;

-- 3. Ghi chú & Hồ sơ đính kèm
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "privateNotes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "personalNotes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "otherDocs" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "attachedFiles" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "dossierComponents" JSONB DEFAULT '[]'::jsonb;

-- 4. Người ủy quyền & Lãnh đạo trình duyệt
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authDocType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submittedTo" TEXT;

-- 5. Mốc tiến độ kiểm tra & hoàn thành chuyên môn
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "checkedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "checkedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "completedWorkDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submissionDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "approvalDate" DATE;

-- 6. Trả kết quả cho công dân & Biên lai / Hóa đơn
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnedPrice" NUMERIC;

-- 7. Giao nhận & Bàn giao theo đợt
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "handoverWard" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnBatch" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnBatchDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnHandoverDept" TEXT;

-- 8. Chỉnh lý & Nhắc nhở tiến độ
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" BOOLEAN DEFAULT FALSE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "explanationPlan" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "deadlineReminded" BOOLEAN DEFAULT FALSE;

-- 9. Tối ưu hóa Index tra cứu
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
CREATE INDEX IF NOT EXISTS idx_dangky_assigned ON dangky_records("assignedTo");
CREATE INDEX IF NOT EXISTS idx_dangky_created_at ON dangky_records("createdAt" DESC);

