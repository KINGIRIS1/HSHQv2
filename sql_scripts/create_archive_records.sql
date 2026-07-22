-- 1. Tạo bảng archive_records nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS archive_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    type TEXT NOT NULL, -- 'saoluc', 'vaoso', 'congvan'
    status TEXT DEFAULT 'draft',
    so_hieu TEXT,
    trich_yeu TEXT,
    ngay_thang DATE, -- Hoặc TEXT nếu muốn lưu định dạng linh hoạt
    noi_nhan_gui TEXT,
    data JSONB DEFAULT '{}'::jsonb
);

-- 2. Thêm dữ liệu mẫu cho phần Vào số (type = 'vaoso')
INSERT INTO archive_records (type, status, so_hieu, trich_yeu, ngay_thang, noi_nhan_gui, created_by, data)
VALUES 
(
    'vaoso', 
    'completed', 
    'HS001', 
    'Chuyển nhượng QSDĐ ông A sang ông B', 
    CURRENT_DATE, 
    'VPĐKĐĐ', 
    'admin',
    '{
        "ma_ho_so": "HS-2024-001",
        "ten_chuyen_quyen": "Nguyễn Văn A",
        "ten_chu_su_dung": "Trần Văn B",
        "loai_bien_dong": "Chuyển nhượng",
        "ngay_nhan": "2024-01-15",
        "ngay_tra_kq_1": "2024-01-30",
        "so_to": "10",
        "so_thua": "100",
        "tong_dien_tich": "500.5",
        "dien_tich_tho_cu": "100",
        "dia_danh_so_phat_hanh": "Tân Khai - 12345",
        "chuyen_thue": "Chi cục thuế",
        "ghi_chu_sau_thue": "Đã nộp thuế",
        "ngay_ky_gcn": "2024-02-01",
        "ngay_ky_phieu_tk": "2024-01-20",
        "ghi_chu": "Hồ sơ đầy đủ"
    }'::jsonb
),
(
    'vaoso', 
    'completed', 
    'HS002', 
    'Tặng cho QSDĐ bà C cho con D', 
    CURRENT_DATE, 
    'VPĐKĐĐ', 
    'admin',
    '{
        "ma_ho_so": "HS-2024-002",
        "ten_chuyen_quyen": "Lê Thị C",
        "ten_chu_su_dung": "Nguyễn Văn D",
        "loai_bien_dong": "Tặng cho",
        "ngay_nhan": "2024-02-10",
        "ngay_tra_kq_1": "2024-02-25",
        "so_to": "15",
        "so_thua": "205",
        "tong_dien_tich": "1200",
        "dien_tich_tho_cu": "0",
        "dia_danh_so_phat_hanh": "Tân Khai - 67890",
        "chuyen_thue": "Miễn thuế",
        "ghi_chu_sau_thue": "",
        "ngay_ky_gcn": "2024-03-01",
        "ngay_ky_phieu_tk": "2024-02-15",
        "ghi_chu": "Đất trồng cây lâu năm"
    }'::jsonb
);
