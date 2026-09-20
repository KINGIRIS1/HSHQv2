-- ==============================================================================
-- SCRIPT SQL BỔ SUNG CỘT QUY TRÌNH CHO MODULE ĐĂNG KÝ / CẤP GIẤY (dangky_records)
-- Chạy trên Supabase SQL Editor (Database -> SQL Editor)
-- Script an toàn (Idempotent): Có thể chạy nhiều lần mà không mất dữ liệu
-- ==============================================================================

-- 1. Các mốc ngày quy trình Thẩm định, Niêm yết, Thuế & In GCN
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "appraisalDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "postingDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "postingEndDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxTransferDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxKv7Date" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "taxPaymentDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printCertDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingHandoverDate" DATE;

-- 2. Phân công In GCN & Giấy nộp tiền (GNT)
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printStaffId" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "print_staff_id" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printStaffAssignedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "print_staff_assigned_at" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printAssignmentStatus" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "print_assignment_status" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "printDeadlineStartAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "print_deadline_start_at" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "paymentReceivedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "payment_received_at" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "paymentReceiptDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "payment_receipt_date" DATE;

-- 3. Bổ sung hồ sơ & Phục hồi trạng thái
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "previousStatus" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementReturnStatus" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementReason" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementRequestDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementReturnedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementRequestedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementRequestedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementStartedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementCompletedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "supplementCompletedAt" TIMESTAMPTZ;

-- 4. Tạo Index hỗ trợ truy vấn nhanh cho Module Cấp giấy
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
CREATE INDEX IF NOT EXISTS idx_dangky_assigned ON dangky_records("assignedTo");
CREATE INDEX IF NOT EXISTS idx_dangky_print_staff ON dangky_records("printStaffId");
CREATE INDEX IF NOT EXISTS idx_dangky_created_at ON dangky_records("createdAt" DESC);
