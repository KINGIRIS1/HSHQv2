-- ====================================================================
-- SCRIPT TẠO 2 BẢNG CHO SUPABASE (land_records & luutru_records)
-- CHUẨN HÓA 30 CỘT VÀ 10 TRẠNG THÁI QUY TRÌNH
-- ====================================================================

-- 1. TẠO BẢNG HỒ SƠ ĐO ĐẠC (land_records)
CREATE TABLE IF NOT EXISTS public.land_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL,
    customer_name TEXT,
    customer_address TEXT,
    certificate_code TEXT,
    book_number TEXT,
    issue_date DATE,
    total_area NUMERIC(15, 2),
    residential_area NUMERIC(15, 2),
    authorized_person_name TEXT,
    authorized_person_id TEXT,
    authorized_person_address TEXT,
    ward TEXT,
    record_type TEXT,
    received_date TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    assigned_date TIMESTAMPTZ,
    assigned_to TEXT,
    employee_name TEXT,
    pending_check_date TIMESTAMPTZ,
    checked_by TEXT,
    pending_sign_date TIMESTAMPTZ,
    submitted_to TEXT,
    completed_date TIMESTAMPTZ,
    export_batch TEXT,
    result_returned_date TIMESTAMPTZ,
    receipt_number TEXT,
    invoice_number TEXT,
    fee_amount NUMERIC(15, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RECEIVED',
    notes TEXT,
    private_notes TEXT,
    map_sheet TEXT,
    land_plot TEXT,
    status_logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TẠO BẢNG HỒ SƠ LƯU TRỮ (luutru_records)
CREATE TABLE IF NOT EXISTS public.luutru_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL,
    customer_name TEXT,
    customer_address TEXT,
    certificate_code TEXT,
    book_number TEXT,
    issue_date DATE,
    total_area NUMERIC(15, 2),
    residential_area NUMERIC(15, 2),
    authorized_person_name TEXT,
    authorized_person_id TEXT,
    authorized_person_address TEXT,
    ward TEXT,
    record_type TEXT,
    received_date TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    assigned_date TIMESTAMPTZ,
    assigned_to TEXT,
    employee_name TEXT,
    pending_check_date TIMESTAMPTZ,
    checked_by TEXT,
    pending_sign_date TIMESTAMPTZ,
    submitted_to TEXT,
    completed_date TIMESTAMPTZ,
    export_batch TEXT,
    result_returned_date TIMESTAMPTZ,
    receipt_number TEXT,
    invoice_number TEXT,
    fee_amount NUMERIC(15, 2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RECEIVED',
    notes TEXT,
    private_notes TEXT,
    map_sheet TEXT,
    land_plot TEXT,
    status_logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TẠO INDEX ĐỂ TỐI ƯU TRA CỨU HỒ SƠ NHANH CHÓNG
CREATE INDEX IF NOT EXISTS idx_land_records_code ON public.land_records(code);
CREATE INDEX IF NOT EXISTS idx_land_records_ward ON public.land_records(ward);
CREATE INDEX IF NOT EXISTS idx_land_records_status ON public.land_records(status);

CREATE INDEX IF NOT EXISTS idx_luutru_records_code ON public.luutru_records(code);
CREATE INDEX IF NOT EXISTS idx_luutru_records_ward ON public.luutru_records(ward);
CREATE INDEX IF NOT EXISTS idx_luutru_records_status ON public.luutru_records(status);

-- 4. BẬT BẢO MẬT ROW LEVEL SECURITY (RLS) HOẶC PHÂN QUYỀN
ALTER TABLE public.land_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luutru_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cho phép tất cả thao tác trên land_records" ON public.land_records;
CREATE POLICY "Cho phép tất cả thao tác trên land_records" ON public.land_records FOR ALL USING (true);

DROP POLICY IF EXISTS "Cho phép tất cả thao tác trên luutru_records" ON public.luutru_records;
CREATE POLICY "Cho phép tất cả thao tác trên luutru_records" ON public.luutru_records FOR ALL USING (true);
