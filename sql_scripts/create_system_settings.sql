-- Tạo bảng system_settings để lưu trữ các cấu hình chung của hệ thống
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo bảng holidays chuyên dụng cho cấu hình ngày nghỉ lễ
CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    day INTEGER NOT NULL,
    month INTEGER NOT NULL,
    is_lunar BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm dữ liệu khởi tạo cho số vào sổ (nếu chưa có)
INSERT INTO system_settings (key, value) 
VALUES ('vaoso_current_book_number', '000000') 
ON CONFLICT (key) DO NOTHING;

-- Thêm các cấu hình hệ thống khác nếu cần
INSERT INTO system_settings (key, value) 
VALUES ('app_version', '1.0.0') 
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value) 
VALUES ('app_update_url', '') 
ON CONFLICT (key) DO NOTHING;
