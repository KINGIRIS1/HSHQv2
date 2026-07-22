-- Bảng lưu trữ dữ liệu chuyển đổi tờ bản đồ
CREATE TABLE IF NOT EXISTS public.map_sheet_conversions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    xa_phuong_cu TEXT NOT NULL,
    so_to_cu TEXT NOT NULL,
    xa_phuong_moi TEXT NOT NULL,
    so_to_moi TEXT NOT NULL
);

-- Thêm index để tối ưu tìm kiếm
CREATE INDEX IF NOT EXISTS idx_map_sheet_conversions_xa_phuong_cu ON public.map_sheet_conversions(xa_phuong_cu);
CREATE INDEX IF NOT EXISTS idx_map_sheet_conversions_so_to_cu ON public.map_sheet_conversions(so_to_cu);

-- RLS (Row Level Security) - Cho phép tất cả người dùng đã xác thực (nếu có)
ALTER TABLE public.map_sheet_conversions ENABLE ROW LEVEL SECURITY;

-- Tạo policy cho phép tất cả các thao tác (nếu bạn muốn mở hoàn toàn)
CREATE POLICY "Cho phép tất cả thao tác trên map_sheet_conversions" 
ON public.map_sheet_conversions 
FOR ALL 
USING (true) 
WITH CHECK (true);
