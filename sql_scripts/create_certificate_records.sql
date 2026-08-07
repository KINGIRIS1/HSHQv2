-- ====================================================================
-- SCRIPT TẠO BẢNG CHUYÊN BIỆT CHO TAB CẤP GIẤY (VÀO SỐ)
-- Sao chép toàn bộ nội dung file này và chạy trong SQL Editor trên Supabase.
-- ====================================================================

-- 1. Tạo bảng certificate_records lưu dữ liệu của tab Cấp giấy (Vào số) độc lập
CREATE TABLE IF NOT EXISTS certificate_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    
    -- Thông tin hồ sơ & chủ sử dụng
    code TEXT NOT NULL UNIQUE,                       -- Mã hồ sơ / Mã vào số
    customer_name TEXT NOT NULL,                     -- Tên chủ sử dụng / Tên khách hàng
    phone_number TEXT,                               -- Số điện thoại liên hệ
    cccd TEXT,                                       -- Số CCCD/CMND
    customer_address TEXT,                           -- Địa chỉ thường trú / Địa chỉ chủ sử dụng
    
    -- Thông tin thửa đất
    ward TEXT,                                       -- Xã / Phường / Thị trấn (Địa danh thửa đất)
    land_plot TEXT,                                  -- Số hiệu thửa đất
    map_sheet TEXT,                                  -- Số tờ bản đồ
    area NUMERIC,                                    -- Diện tích tổng thể (m2)
    residential_area NUMERIC,                        -- Diện tích đất ở (m2)
    
    -- Thông tin kết quả cấp giấy (Đặc thù tab Vào số)
    loai_gcn TEXT,                                   -- Loại Giấy chứng nhận
    so_vao_so TEXT,                                  -- Số vào sổ cấp GCN
    so_phat_hanh TEXT,                               -- Số phát hành GCN (Số seri)
    ngay_ky_gcn DATE,                                -- Ngày ký GCN
    ngay_ky_phieu_tk DATE,                           -- Ngày chuyển Scan / 1 Cửa (ngày ký phiếu thiết kế)
    
    -- Trạng thái & Ghi chú
    status TEXT DEFAULT 'pending_entry',            -- Trạng thái xử lý (vd: pending_entry, completed_entry, scanned)
    notes TEXT,                                      -- Ghi chú chung
    data JSONB DEFAULT '{}'::jsonb,                  -- Trường mở rộng dạng JSON để lưu trữ thông tin linh hoạt phát sinh
    
    -- Các bước xử lý quy trình con phụ trợ của Cấp giấy (Nếu cần đồng bộ quy trình)
    cap_giay_sub_step TEXT,                          -- Bước nhỏ cấp giấy (tham_dinh, phieu_chuyen_thue, cho_nop_thue...)
    tham_dinh_date DATE,                             -- Ngày thẩm định
    tham_dinh_by TEXT,                               -- Người thực hiện thẩm định
    chuyen_thue_date DATE,                           -- Ngày chuyển cơ quan thuế
    chuyen_thue_by TEXT,                             -- Người thực hiện chuyển thuế
    hoan_thien_date DATE,                            -- Ngày hoàn thiện hồ sơ trình ký
    hoan_thien_by TEXT                               -- Cán bộ thực hiện hoàn thiện
);

-- 2. Thêm Index tối ưu hóa truy vấn tìm kiếm
CREATE INDEX IF NOT EXISTS idx_certificate_records_code ON certificate_records(code);
CREATE INDEX IF NOT EXISTS idx_certificate_records_ward ON certificate_records(ward);
CREATE INDEX IF NOT EXISTS idx_certificate_records_status ON certificate_records(status);

-- 3. Cho phép truy cập tự do nếu Supabase đang sử dụng Row-Level Security (RLS)
ALTER TABLE certificate_records DISABLE ROW LEVEL SECURITY;
