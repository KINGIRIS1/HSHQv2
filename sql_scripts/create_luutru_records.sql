-- ====================================================================
-- SCRIPT TẠO BẢNG LUUTRU_RECORDS CHO TỔ LƯU TRỮ (Hoặc đồng bộ archive_records)
-- ====================================================================

CREATE TABLE IF NOT EXISTS luutru_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'saoluc', 'vaoso', 'congvan'
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

-- Tạo view hoặc alias nếu muốn tương thích ngược với tên cũ archive_records
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

CREATE INDEX IF NOT EXISTS idx_luutru_type ON luutru_records(type);
CREATE INDEX IF NOT EXISTS idx_archive_type ON archive_records(type);
