-- ====================================================================
-- SCRIPT TẠO BẢNG DANGKY_RECORDS CHO MODULE ĐĂNG KÝ HỒ SƠ (ĐẦY ĐỦ 100% CỘT)
-- Chạy trên Supabase SQL Editor
-- ====================================================================

CREATE TABLE IF NOT EXISTS dangky_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL UNIQUE,                                -- Mã hồ sơ
    
    -- 1. Đa chủ sử dụng & Đa người nhận (Kiểu JSONB: [{name, cccd, address, phone}])
    owners JSONB DEFAULT '[]'::jsonb,                        -- Chủ sử dụng
    transferees JSONB DEFAULT '[]'::jsonb,                   -- Người nhận chuyển quyền
    
    -- 2. Thông tin Người nộp hồ sơ
    "applicantName" TEXT,                                    -- Họ tên người nộp
    "applicantPhone" TEXT,                                   -- SĐT người nộp
    "applicantCccd" TEXT,                                    -- CCCD người nộp
    "applicantAddress" TEXT,                                 -- Địa chỉ người nộp
    "applicantIsOwner" BOOLEAN DEFAULT FALSE,                -- Người nộp là chủ hồ sơ
    
    -- 3. Thông tin Người được ủy quyền
    "authorizedPersonName" TEXT,                             -- Họ và tên người ủy quyền
    "authorizedPersonId" TEXT,                               -- CCCD người ủy quyền
    "authorizedPersonPhone" TEXT,                            -- SĐT người ủy quyền
    "authorizedPersonAddress" TEXT,                          -- Địa chỉ người ủy quyền
    
    -- 4. Thông tin Thửa đất & Giấy chứng nhận (GCN)
    "landPlot" TEXT,                                         -- Số thửa đất
    "mapSheet" TEXT,                                         -- Số tờ bản đồ
    "issueNumber" TEXT,                                      -- Số phát hành GCN (Phôi seri)
    "entryNumber" TEXT,                                      -- Số vào sổ cấp GCN
    "issueDate" TIMESTAMPTZ,                                 -- Ngày cấp GCN
    "totalArea" NUMERIC DEFAULT 0,                           -- Tổng diện tích (m2)
    "residentialArea" NUMERIC DEFAULT 0,                     -- Diện tích ONT/ODT (m2)
    ward TEXT,                                               -- Xã/Phường
    "nonBoundaryWard" TEXT,                                  -- Phi địa giới xã
    "isNonBoundary" BOOLEAN DEFAULT FALSE,                   -- Cờ phi địa giới
    "recordType" TEXT,                                       -- Loại hồ sơ / Mã thủ tục
    
    -- 5. Tiến độ Quy trình 14 bước & Cán bộ phân công
    "receivedDate" TIMESTAMPTZ,                              -- Ngày tiếp nhận
    "receivedBy" TEXT,                                       -- Cán bộ tiếp nhận
    "assignedDate" TIMESTAMPTZ,                              -- Ngày giao NV
    "assignedTo" TEXT,                                       -- Cán bộ xử lý
    deadline TIMESTAMPTZ,                                    -- Hạn trả kết quả
    "appraisalDate" TIMESTAMPTZ,                             -- Ngày Thẩm định
    "appraisalStaff" TEXT,                                   -- NV Thẩm định
    "taxFormDate" TIMESTAMPTZ,                               -- Ngày Phiếu chuyển thuế
    "taxFormNumber" TEXT,                                    -- Số phiếu chuyển thuế
    "taxFormStaff" TEXT,                                     -- NV Phiếu chuyển thuế
    "taxKV7TransferDate" TIMESTAMPTZ,                        -- Ngày Chuyển Thuế KV7
    "taxKV7Staff" TEXT,                                      -- NV Thuế KV7
    "taxNoticeDate" TIMESTAMPTZ,                             -- Ngày TBT (Thông báo thuế)
    "taxNoticeStaff" TEXT,                                   -- NV Thông báo thuế
    "taxPaymentReceiptDate" TIMESTAMPTZ,                    -- Ngày GNT (Giấy nộp tiền)
    "printDate" TIMESTAMPTZ,                                 -- Ngày In GCN
    "printStaff" TEXT,                                       -- NV In GCN
    "pendingCheckDate" TIMESTAMPTZ,                          -- Ngày Trình KT
    "checkedBy" TEXT,                                        -- Người Kiểm tra
    "submissionDate" TIMESTAMPTZ,                            -- Ngày Trình ký
    "submittedTo" TEXT,                                      -- Người ký
    "approvalDate" TIMESTAMPTZ,                              -- Ngày Ký duyệt
    "completedDate" TIMESTAMPTZ,                             -- Hoàn thành
    "exportBatch" TEXT,                                      -- Đợt xuất
    "exportDate" TIMESTAMPTZ,                                -- Ngày xuất bàn giao
    "handoverWard" TEXT,                                     -- Nơi giao trả kết quả
    "deliveryDate" TIMESTAMPTZ,                              -- Ngày giao trả kết quả
    "resultReturnedDate" TIMESTAMPTZ,                        -- Ngày Trả kết quả
    "receiverName" TEXT,                                     -- Người nhận kết quả
    
    -- 6. Tài chính & Biên lai
    "receiptNumber" TEXT,                                    -- Số Biên lai
    "invoiceNumber" TEXT,                                    -- Số Hóa đơn
    "receiptType" TEXT,                                      -- Loại chứng từ (Biên Lai / Hóa Đơn)
    "feeAmount" NUMERIC DEFAULT 0,                           -- Số tiền thu (VNĐ)
    price NUMERIC,                                           -- Đơn giá
    "returnedPrice" NUMERIC,                                 -- Tiền thực tế trả kết quả
    "advancePayment" NUMERIC DEFAULT 0,                      -- Tiền tạm ứng
    
    -- 7. Trạng thái, Giấy tờ đính kèm & Ghi chú
    status TEXT DEFAULT 'Tiếp nhận mới',                    -- Trạng thái quy trình
    "statusLogs" JSONB DEFAULT '[]'::jsonb,                  -- Lịch sử chuyển trạng thái
    notes TEXT,                                              -- Ghi chú chung
    "personalNotes" TEXT,                                    -- Ghi chú cá nhân
    "privateNotes" TEXT,                                     -- Ghi chú nội bộ
    "reminderDate" TIMESTAMPTZ,                              -- Hẹn giờ nhắc việc
    "otherDocs" TEXT,                                        -- Giấy tờ khác / chi tiết
    "attachedDocs" JSONB DEFAULT '[]'::jsonb,                -- Danh sách giấy tờ kèm theo
    "attachedDocuments" JSONB DEFAULT '[]'::jsonb,           -- Giấy tờ kèm theo khác
    "explanationPlan" TEXT,                                  -- Phương án giải trình
    
    -- 8. Fallback / Đồng bộ tương thích
    "customerName" TEXT,                                     -- Tên khách hàng (fallback)
    "phoneNumber" TEXT,                                      -- SĐT liên hệ (fallback)
    cccd TEXT,                                               -- CCCD (fallback)
    "customerAddress" TEXT,                                  -- Địa chỉ khách hàng (fallback)
    address TEXT,                                            -- Địa chỉ thửa đất / nơi cư trú
    "submitterName" TEXT,                                    -- Tên người nộp (alias)
    "submitterPhone" TEXT,                                   -- SĐT người nộp (alias)
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Index tối ưu tra cứu nhanh
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

-- Cấu hình Row Level Security (RLS) cho Supabase
ALTER TABLE dangky_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cho phép tất cả thao tác trên dangky_records" ON dangky_records;
CREATE POLICY "Cho phép tất cả thao tác trên dangky_records" ON dangky_records FOR ALL USING (true);
