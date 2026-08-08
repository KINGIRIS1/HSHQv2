-- Tạo bảng riêng cho dữ liệu tab Cấp Giấy (không lưu chung với dữ liệu đo đạc)
CREATE TABLE IF NOT EXISTS cap_giay_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,                  -- Mã hồ sơ
    customer_name TEXT,                  -- Tên chủ sử dụng / Người yêu cầu
    record_type TEXT,                    -- Loại hồ sơ (Cấp lần đầu, Cấp đổi, Tách thửa, Đính chính...)
    ward TEXT,                           -- Xã / Phường
    land_plot TEXT,                      -- Số thửa
    map_sheet TEXT,                      -- Tờ bản đồ
    area NUMERIC,                        -- Tổng diện tích
    residential_area NUMERIC,            -- Diện tích đất ở
    address TEXT,                        -- Địa chỉ thửa đất / Khách hàng
    
    -- Trạng thái & Quy trình bước nhỏ Cấp giấy
    status TEXT NOT NULL DEFAULT 'RECEIVED', -- Trạng thái tổng quan hồ sơ
    cap_giay_sub_step TEXT DEFAULT 'tham_dinh', -- Bước xử lý: tham_dinh, phieu_chuyen_thue, cho_tbt, cho_nop_thue, hoan_thien_trinh_duyet, kiem_tra, trinh_ky, vo_so_gcn, cho_ban_giao, da_ban_giao
    
    -- Thông tin thuế & Nghiệp vụ chuyên môn
    so_phieu_chuyen_thue TEXT,          -- Số phiếu chuyển thuế
    issue_number TEXT,                   -- Số phát hành GCN
    entry_number TEXT,                   -- Số vào sổ GCN
    issue_date DATE,                     -- Ngày cấp GCN
    excerptNumber TEXT,                  -- Số trích lục (nếu có)
    
    -- Thời gian & Tiến độ
    received_date DATE,                  -- Ngày tiếp nhận
    deadline DATE,                       -- Hạn giải quyết
    assigned_to TEXT,                    -- Nhân viên thụ lý
    assigned_date DATE,                  -- Ngày phân công
    submission_date DATE,                -- Ngày trình ký
    submitted_to TEXT,                   -- Người trình ký (Lãnh đạo)
    pending_check_date DATE,             -- Ngày trình kiểm tra
    checked_by TEXT,                     -- Người kiểm tra (Tổ trưởng)
    checked_date DATE,                   -- Ngày kiểm tra
    approval_date DATE,                  -- Ngày ký duyệt / Ký GCN
    completed_date DATE,                 -- Ngày hoàn thành
    
    -- Tài chính
    price NUMERIC,                       -- Tổng tiền
    advance_payment NUMERIC,             -- Tạm ứng
    
    -- Ghi chú & Dữ liệu mở rộng JSONB
    notes TEXT,                          -- Ghi chú chung
    private_notes TEXT,                  -- Ghi chú riêng
    data JSONB DEFAULT '{}'::jsonb,      -- Lưu trữ cấu trúc phụ trợ linh hoạt
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo Index để tối ưu tìm kiếm và lọc dữ liệu Cấp giấy
CREATE INDEX IF NOT EXISTS idx_cap_giay_records_code ON cap_giay_records(code);
CREATE INDEX IF NOT EXISTS idx_cap_giay_records_status ON cap_giay_records(status);
CREATE INDEX IF NOT EXISTS idx_cap_giay_records_sub_step ON cap_giay_records(cap_giay_sub_step);
CREATE INDEX IF NOT EXISTS idx_cap_giay_records_ward ON cap_giay_records(ward);
CREATE INDEX IF NOT EXISTS idx_cap_giay_records_assigned_to ON cap_giay_records(assigned_to);

COMMENT ON TABLE cap_giay_records IS 'Bảng lưu trữ riêng biệt dữ liệu hồ sơ Cấp giấy chứng nhận (không lưu chung với đo đạc)';
