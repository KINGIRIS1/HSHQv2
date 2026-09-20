-- =========================================================================
-- MIGRATION SCRIPT: KHỞI TẠO HỆ THỐNG CẤP SỐ VÀO SỔ TỰ ĐỘNG CHỐNG TRÙNG TUYỆT ĐỐI
-- Hướng dẫn: Sao chép toàn bộ nội dung file này dán vào SQL Editor trên Supabase Dashboard và bấm RUN.
-- =========================================================================

-- 1. Bảng lưu trạng thái đếm số cuối cùng của từng tiền tố (Sequence Counter)
CREATE TABLE IF NOT EXISTS vao_so_sequences (
    prefix TEXT PRIMARY KEY,
    current_number BIGINT NOT NULL DEFAULT 0,
    pad_length INT NOT NULL DEFAULT 5,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm quyền truy cập cho bảng vao_so_sequences (nếu cần)
-- Bảng này chỉ chứa bộ đếm số thứ tự hệ thống không nhạy cảm, tắt RLS để đảm bảo an toàn truy cập từ phía client và tránh lỗi 42501 (RLS Policy)
ALTER TABLE vao_so_sequences DISABLE ROW LEVEL SECURITY;

-- 2. Hàm RPC cấp số nguyên tử chống trùng 100% (Atomic Allocation with Row Lock FOR UPDATE)
CREATE OR REPLACE FUNCTION allocate_next_vao_so_numbers(
    p_prefix TEXT,
    p_count INT DEFAULT 1,
    p_pad_length INT DEFAULT 5
)
RETURNS TABLE (allocated_number TEXT, raw_number BIGINT) 
LANGUAGE plpgsql
SECURITY DEFINER -- Chạy với quyền admin để bypass RLS nếu cần
AS $$
DECLARE
    v_start_num BIGINT;
    v_end_num BIGINT;
    v_current_max BIGINT;
    v_current_max_archive BIGINT;
    i BIGINT;
BEGIN
    -- Đảm bảo dòng prefix tồn tại trước khi lock
    INSERT INTO vao_so_sequences (prefix, current_number, pad_length, updated_at)
    VALUES (p_prefix, 0, p_pad_length, NOW())
    ON CONFLICT (prefix) DO NOTHING;

    -- Khóa dòng prefix để các giao dịch đồng thời khác phải xếp hàng chờ (Row Lock FOR UPDATE)
    SELECT current_number INTO v_start_num
    FROM vao_so_sequences
    WHERE prefix = p_prefix
    FOR UPDATE;

    -- Nếu sequence mới khởi tạo (= 0), thực hiện quét tìm MAX thực tế hiện có trong cả hai bảng để tự động đồng bộ (Self-Healing)
    IF v_start_num = 0 THEN
        -- Tìm số lớn nhất từ dangky_records
        SELECT COALESCE(MAX(NULLIF(regexp_replace("entryNumber", '\D', '', 'g'), '')::BIGINT), 0)
        INTO v_current_max
        FROM dangky_records
        WHERE "entryNumber" ILIKE (p_prefix || '%');

        -- Tìm số lớn nhất từ luutru_records (sổ vào sổ)
        SELECT COALESCE(MAX(NULLIF(regexp_replace("entryNumber", '\D', '', 'g'), '')::BIGINT), 0)
        INTO v_current_max_archive
        FROM luutru_records
        WHERE "entryNumber" ILIKE (p_prefix || '%') AND type = 'vaoso';

        IF v_current_max_archive > v_current_max THEN
            v_current_max := v_current_max_archive;
        END IF;
        
        IF v_current_max > v_start_num THEN
            v_start_num := v_current_max;
        END IF;
    END IF;

    v_end_num := v_start_num + p_count;

    -- Cập nhật số lớn nhất mới vào bảng sequence
    UPDATE vao_so_sequences
    SET current_number = v_end_num,
        pad_length = p_pad_length,
        updated_at = NOW()
    WHERE prefix = p_prefix;

    -- Sinh dãy số trả về liên tiếp
    FOR i IN (v_start_num + 1)..v_end_num LOOP
        allocated_number := p_prefix || ' ' || LPAD(i::TEXT, p_pad_length, '0');
        raw_number := i;
        RETURN NEXT;
    END LOOP;
END;
$$;
