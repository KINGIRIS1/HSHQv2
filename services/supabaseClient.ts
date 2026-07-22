
import { createClient } from '@supabase/supabase-js';

// =========================================================================
// HƯỚNG DẪN CẤU HÌNH GÓI PRO (QUAN TRỌNG):
// 1. Vào trang https://supabase.com/dashboard/project/_/settings/api
// 2. Copy "Project URL" và dán vào biến SUPABASE_URL bên dưới.
// 3. Copy "anon public" Key và dán vào biến SUPABASE_ANON_KEY bên dưới.
// LƯU Ý: Nếu bạn vừa tạo Project mới cho gói Pro, BẮT BUỘC phải thay đổi 2 dòng này.
// =========================================================================

// --- CẤU HÌNH KẾT NỐI CLOUD ---
const SUPABASE_URL: string = 'https://lrnfdksqepztnihrkgrr.supabase.co'; 
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybmZka3NxZXB6dG5paHJrZ3JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njk1NzQsImV4cCI6MjA5MjQ0NTU3NH0.eIif2yiYZ8RwdoVLjHXBc73ookcWWEIqF_om7O-Eso8';

// Kiểm tra kỹ điều kiện cấu hình
const isEmpty = !SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.trim() === '' || SUPABASE_ANON_KEY.trim() === '';
// Kiểm tra nếu là placeholder (chỉ cảnh báo nếu thực sự chưa thay đổi)
const isUrlPlaceholder = SUPABASE_URL.includes('YOUR_PROJECT_ID');
const isKeyPlaceholder = SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');

export const isConfigured = !isEmpty && !isUrlPlaceholder && !isKeyPlaceholder;

if (!isConfigured) {
    console.warn("⚠️ CHƯA CẤU HÌNH SUPABASE: Ứng dụng sẽ chạy ở chế độ Demo (Offline) với dữ liệu mẫu.");
} else {
    console.log(`✅ Đã phát hiện cấu hình Cloud. Đang kết nối tới: ${SUPABASE_URL}`);
}

// Sử dụng thông tin placeholder hợp lệ để tránh lỗi crash khi khởi tạo createClient nếu người dùng lỡ xóa trắng biến
const urlToUse = isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co';
const keyToUse = isConfigured ? SUPABASE_ANON_KEY : 'placeholder';

export const supabase = createClient(urlToUse, keyToUse, {
    auth: {
        persistSession: true, // Giữ đăng nhập khi F5
        autoRefreshToken: true,
        // Hủy bỏ việc sử dụng LockManager của trình duyệt (tránh lỗi Timeout 10s trong iframe sandboxed)
        lock: async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
            return await fn();
        }
    },
    db: {
        schema: 'public',
    }
});
