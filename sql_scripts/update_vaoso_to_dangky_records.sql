-- =========================================================================
-- SQL CHUYỂN ĐỔI TOÀN DIỆN VÀO SỔ GCN SANG BẢNG dangky_records
-- Dùng chạy trên Supabase SQL Editor (Database -> SQL Editor)
-- =========================================================================

-- 1. Bổ sung các cột thiết yếu cho bảng dangky_records (nếu chưa có)
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "entryNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "approvalDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingHandoverDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "residentialArea" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "completedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "deadline" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportDate" DATE;

-- 2. Đảm bảo các chỉ mục (Indexes) để tra cứu siêu nhanh
CREATE INDEX IF NOT EXISTS idx_dangky_entry_number ON dangky_records("entryNumber");
CREATE INDEX IF NOT EXISTS idx_dangky_issue_number ON dangky_records("issueNumber");
CREATE INDEX IF NOT EXISTS idx_dangky_approval_date ON dangky_records("approvalDate");
CREATE INDEX IF NOT EXISTS idx_dangky_pending_handover_date ON dangky_records("pendingHandoverDate");
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);

-- 3. Tạo bảng lưu trữ số thứ tự vào sổ (sequences) để cấp số tự động không trùng
CREATE TABLE IF NOT EXISTS vao_so_sequences (
    prefix TEXT PRIMARY KEY,
    current_number INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tạo hàm RPC an toàn để cấp số vào sổ tự động (hỗ trợ đa người dùng cấp số đồng thời)
CREATE OR REPLACE FUNCTION allocate_next_vao_so_numbers(
    p_prefix TEXT DEFAULT 'CN',
    p_count INTEGER DEFAULT 1,
    p_pad_length INTEGER DEFAULT 5
)
RETURNS TABLE (allocated_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_val INTEGER;
    v_end_val INTEGER;
    i INTEGER;
    v_max_dangky INTEGER := 0;
    v_max_luutru INTEGER := 0;
    v_max_actual INTEGER := 0;
BEGIN
    -- Tìm số lớn nhất hiện hữu trong dangky_records
    SELECT COALESCE(MAX(
        CASE 
            WHEN "entryNumber" ~ '^[0-9]+$' THEN "entryNumber"::INTEGER
            WHEN "entryNumber" ~ '[0-9]+' THEN (regexp_matches("entryNumber", '[0-9]+'))[1]::INTEGER
            ELSE 0 
        END
    ), 0) INTO v_max_dangky FROM dangky_records;

    -- Tìm số lớn nhất hiện hữu trong luutru_records (để tương thích dữ liệu cũ)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'luutru_records') THEN
        SELECT COALESCE(MAX(
            CASE 
                WHEN "entryNumber" ~ '^[0-9]+$' THEN "entryNumber"::INTEGER
                WHEN "entryNumber" ~ '[0-9]+' THEN (regexp_matches("entryNumber", '[0-9]+'))[1]::INTEGER
                ELSE 0 
            END
        ), 0) INTO v_max_luutru FROM luutru_records;
    END IF;

    v_max_actual := GREATEST(v_max_dangky, v_max_luutru);

    -- Khởi tạo hoặc cập nhật sequence theo số lớn nhất thực tế
    INSERT INTO vao_so_sequences (prefix, current_number, updated_at)
    VALUES (p_prefix, v_max_actual, NOW())
    ON CONFLICT (prefix) DO UPDATE
    SET current_number = GREATEST(vao_so_sequences.current_number, v_max_actual),
        updated_at = NOW();

    -- Lấy block số tự tăng tiếp theo có khóa an toàn
    UPDATE vao_so_sequences
    SET current_number = current_number + p_count,
        updated_at = NOW()
    WHERE prefix = p_prefix
    RETURNING current_number - p_count + 1, current_number
    INTO v_start_val, v_end_val;

    -- Trả về danh sách các số đã cấp
    FOR i IN v_start_val..v_end_val LOOP
        allocated_number := p_prefix || ' ' || LPAD(i::TEXT, p_pad_length, '0');
        RETURN NEXT;
    END LOOP;
END;
$$;

-- 5. (Tùy chọn) Chuyển giao các hồ sơ Vào sổ cũ từ luutru_records sang dangky_records nếu chưa có
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'luutru_records') THEN
        INSERT INTO dangky_records (
            id,
            code,
            "customerName",
            ward,
            "landPlot",
            "mapSheet",
            area,
            "residentialArea",
            "recordType",
            content,
            "entryNumber",
            "issueNumber",
            "approvalDate",
            "receivedDate",
            status,
            notes,
            data,
            "createdAt",
            "updatedAt"
        )
        SELECT 
            COALESCE(l.id, gen_random_uuid()::text),
            COALESCE(l."documentNumber", (l.data->>'ma_ho_so'), l.id),
            COALESCE((l.data->>'ten_chu_su_dung'), l.sender, 'Chưa xác định'),
            COALESCE((l.data->>'dia_danh'), (l.data->>'xa_phuong'), ''),
            COALESCE((l.data->>'so_thua'), ''),
            COALESCE((l.data->>'so_to'), ''),
            COALESCE(NULLIF(l.data->>'tong_dien_tich', '')::numeric, 0),
            COALESCE(NULLIF(l.data->>'dien_tich_tho_cu', '')::numeric, 0),
            COALESCE(l."recordType", (l.data->>'loai_bien_dong'), 'Cấp Giấy chứng nhận'),
            COALESCE(l.content, 'Cấp Giấy chứng nhận'),
            COALESCE(l."entryNumber", (l.data->>'so_vao_so')),
            COALESCE((l.data->>'so_phat_hanh'), ''),
            COALESCE(NULLIF(l.data->>'ngay_ky_gcn', '')::date, NULLIF(l."issueDate"::text, '')::date),
            COALESCE(NULLIF(l.data->>'ngay_nhan', '')::date, NULLIF(l."documentDate"::text, '')::date, CURRENT_DATE),
            'DA_KY',
            COALESCE(l.notes, (l.data->>'ghi_chu'), ''),
            COALESCE(l.data, '{}'::jsonb),
            COALESCE(l."createdAt", NOW()),
            NOW()
        FROM luutru_records l
        WHERE (l."recordType" ILIKE '%vào sổ%' OR l."recordType" ILIKE '%vaoso%' OR l.data->>'stage' = 'vao_so' OR l."entryNumber" IS NOT NULL)
          AND NOT EXISTS (
              SELECT 1 FROM dangky_records d 
              WHERE d.code = COALESCE(l."documentNumber", (l.data->>'ma_ho_so'), l.id)
                 OR d.id = l.id
          );
    END IF;
END $$;
