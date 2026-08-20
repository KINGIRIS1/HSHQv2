-- ====================================================================
-- SCRIPT TẠO BẢNG DANGKY_RECORDS CHO MODULE ĐĂNG KÝ HỒ SƠ
-- Chạy trên Supabase SQL Editor
-- ====================================================================

CREATE TABLE IF NOT EXISTS dangky_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL UNIQUE,                                -- Mã hồ sơ
    
    -- Đa chủ sử dụng & Đa người nhận (Kiểu JSONB)
    owners JSONB DEFAULT '[]'::jsonb,                        -- [{name, cccd, address}]
    transferees JSONB DEFAULT '[]'::jsonb,                   -- [{name, cccd, address}]
    
    -- Người ủy quyền
    "authorizedPersonName" TEXT,                             -- Họ và tên người ủy quyền
    "authorizedPersonId" TEXT,                               -- CCCD người ủy quyền
    "authorizedPersonAddress" TEXT,                          -- Địa chỉ người ủy quyền
    
    -- Thửa đất & Giấy chứng nhận
    "issueNumber" TEXT,                                      -- Số phát hành GCN
    "entryNumber" TEXT,                                      -- Số vào sổ
    "totalArea" NUMERIC,                                     -- Tổng diện tích (m2)
    "residentialArea" NUMERIC,                               -- Diện tích ONT/ODT (m2)
    ward TEXT,                                               -- Xã/Phường
    "recordType" TEXT,                                       -- Loại hồ sơ
    
    -- Tiến độ Quy trình & Cán bộ
    "receivedDate" TIMESTAMPTZ,                              -- Ngày nhận
    deadline TIMESTAMPTZ,                                    -- Hẹn trả
    "appraisalDate" TIMESTAMPTZ,                             -- Ngày Thẩm định
    "appraisalStaff" TEXT,                                   -- NV Thẩm định
    "taxFormDate" TIMESTAMPTZ,                               -- Ngày Phiếu chuyển thuế
    "taxFormStaff" TEXT,                                     -- NV Phiếu chuyển
    "taxKV7TransferDate" TIMESTAMPTZ,                        -- Ngày Chuyển Thuế KV7
    "taxNoticeDate" TIMESTAMPTZ,                             -- Ngày TBT (Thông báo thuế)
    "taxPaymentReceiptDate" TIMESTAMPTZ,                    -- Ngày GNT (Giấy nộp tiền)
    "printDate" TIMESTAMPTZ,                                 -- Ngày In GCN
    "pendingCheckDate" TIMESTAMPTZ,                          -- Ngày Trình KT
    "checkedBy" TEXT,                                        -- Người Kiểm tra
    "submissionDate" TIMESTAMPTZ,                            -- Ngày Trình ký
    "submittedTo" TEXT,                                      -- Người ký
    "completedDate" TIMESTAMPTZ,                             -- Hoàn thành
    "exportBatch" TEXT,                                      -- Đợt xuất
    "resultReturnedDate" TIMESTAMPTZ,                        -- Ngày Trả kết quả
    
    -- Tài chính
    "receiptNumber" TEXT,                                    -- Số Biên lai
    "invoiceNumber" TEXT,                                    -- Số Hóa đơn
    "feeAmount" NUMERIC DEFAULT 0,                           -- Số tiền thu (VNĐ)
    
    status TEXT DEFAULT 'Tiếp nhận mới',                    -- Trạng thái (1 trong 14 bước)
    notes TEXT,                                              -- Ghi chú
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Index tối ưu tra cứu
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
CREATE INDEX IF NOT EXISTS idx_dangky_owners ON dangky_records USING gin (owners);
CREATE INDEX IF NOT EXISTS idx_dangky_transferees ON dangky_records USING gin (transferees);
