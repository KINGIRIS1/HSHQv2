-- ====================================================================
-- SCRIPT ĐỒNG BỘ CSDL CHO HỢP ĐỒNG, THANH LÝ HỢP ĐỒNG & BẢNG LƯU TRỮ (POSTGRES / SUPABASE)
-- ====================================================================

-- 1. BẢNG CONTRACTS (Quản lý Hợp đồng & Thanh lý)
CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,                       -- Số/Mã hợp đồng
    "customerName" TEXT NOT NULL,                    -- Tên khách hàng (Bên A)
    "phoneNumber" TEXT,                              -- Số điện thoại
    cccd TEXT,                                       -- Số CCCD/CMND
    "customerAddress" TEXT,                          -- Mã biên nhận hồ sơ gốc / Địa chỉ dân
    ward TEXT,                                       -- Xã / Phường
    address TEXT,                                    -- Địa chỉ chi tiết
    "landPlot" TEXT,                                 -- Thửa đất số
    "mapSheet" TEXT,                                 -- Tờ bản đồ số
    area NUMERIC DEFAULT 0,                          -- Diện tích theo hợp đồng (m2)
    
    -- Phân loại nghiệp vụ
    "contractType" TEXT NOT NULL DEFAULT 'Đo đạc',  -- Loại HĐ (Đo đạc, Tách thửa, Cắm mốc, Trích lục)
    "serviceType" TEXT,                              -- Tên dịch vụ chi tiết
    "areaType" TEXT,                                 -- Loại khu vực (Đất đô thị / Nông thôn)
    "recordType" TEXT,                               -- Loại hồ sơ tiếp nhận liên kết
    
    -- Phân công & Ghi chú
    "assignedTo" TEXT,                               -- Cán bộ thụ lý / Kỹ thuật đo đạc
    notes TEXT,                                      -- Ghi chú bổ sung
    
    -- Chi tiết số lượng
    "plotCount" INT DEFAULT 1,                       -- Số thửa (cho Đo đạc)
    "markerCount" INT DEFAULT 1,                     -- Số mốc (cho Cắm mốc)
    "splitItems" JSONB DEFAULT '[]'::jsonb,           -- Danh sách tách thửa (dạng JSON)
    
    -- Tài chính (Thu 1 lần khi hoàn thành - Không tạm ứng)
    quantity NUMERIC DEFAULT 1,                      -- Số lượng tính tiền
    "unitPrice" NUMERIC DEFAULT 0,                   -- Đơn giá
    "vatRate" NUMERIC DEFAULT 8,                     -- % Thuế VAT
    "vatAmount" NUMERIC DEFAULT 0,                   -- Tiền thuế VAT
    "totalAmount" NUMERIC DEFAULT 0,                 -- Tổng giá trị hợp đồng
    deposit NUMERIC DEFAULT 0,                       -- Tiền tạm ứng (Mặc định = 0)
    content TEXT,                                    -- Trích yếu nội dung công việc
    
    "createdDate" DATE DEFAULT CURRENT_DATE,         -- Ngày lập hợp đồng
    status TEXT DEFAULT 'PENDING',                   -- Trạng thái (PENDING, COMPLETED)
    
    -- Thanh lý hợp đồng (Liên kết theo Mã HĐ / Mã Hồ sơ)
    "liquidationArea" NUMERIC DEFAULT 0,             -- Diện tích thanh lý thực tế
    "liquidationAmount" NUMERIC DEFAULT 0,           -- Giá trị thanh lý thực tế (tiền)
    "liquidationDate" DATE DEFAULT CURRENT_DATE,     -- Ngày thanh lý hợp đồng
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm các cột bổ sung nếu bảng contracts đã tồn tại sẵn từ trước
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "liquidationArea" NUMERIC DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "liquidationAmount" NUMERIC DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "liquidationDate" DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deposit NUMERIC DEFAULT 0;

-- 2. BẢNG LUUTRU_RECORDS (Tổ lưu trữ / Sao lộc / Vào sổ / Công văn)
CREATE TABLE IF NOT EXISTS luutru_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,                              -- 'saoluc', 'vaoso', 'congvan'
    status TEXT DEFAULT 'draft',                     -- 'draft', 'submitted', 'approved'
    so_hieu TEXT,                                    -- Số hiệu văn bản / Hồ sơ
    trich_yeu TEXT,                                  -- Trích yếu nội dung
    ngay_thang DATE,                                 -- Ngày văn bản
    noi_nhan_gui TEXT,                               -- Nơi nhận / Nơi gửi
    "created_by" TEXT,                               -- Người tạo
    data JSONB DEFAULT '{}'::jsonb,                  -- Dữ liệu mở rộng
    "exportBatch" TEXT,                              -- Đợt xuất
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm các cột bổ sung nếu bảng luutru_records đã có sẵn
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS price NUMERIC;

-- 3. BẢNG ARCHIVE_RECORDS (Kho lưu trữ tương thích)
CREATE TABLE IF NOT EXISTS archive_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    so_hieu TEXT,
    trich_yeu TEXT,
    ngay_thang DATE,
    noi_nhan_gui TEXT,
    "created_by" TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    "exportBatch" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS price NUMERIC;

-- 4. BẢNG LAND_RECORDS & DANGKY_RECORDS (Đồng bộ các trường thông tin tiếp nhận)
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;

ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;

-- Index tối ưu tìm kiếm theo loại và mã
CREATE INDEX IF NOT EXISTS idx_luutru_type ON luutru_records(type);
CREATE INDEX IF NOT EXISTS idx_archive_type ON archive_records(type);
