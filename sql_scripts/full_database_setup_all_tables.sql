-- ==============================================================================
-- SCRIPT SQL ĐẦY ĐỦ KHỞI TẠO VÀ NÂNG CẤP TOÀN BỘ CƠ SỞ DỮ LIỆU HỆ THỐNG QUẢN LÝ HỒ SƠ
-- Tương thích 100% với PostgreSQL & Supabase SQL Editor
-- Script được viết an toàn (Idempotent): Chạy nhiều lần không làm mất dữ liệu hiện có
-- ==============================================================================

-- ==============================================================================
-- 1. BẢNG NHÂN SỰ & TÀI KHOẢN HỆ THỐNG
-- ==============================================================================

-- 1.1. Bảng Nhân sự (employees)
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'STAFF',
    department TEXT NOT NULL DEFAULT 'Tổ Đo đạc',
    "phoneNumber" TEXT,
    email TEXT,
    active BOOLEAN DEFAULT TRUE,
    position TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Đảm bảo kiểu dữ liệu id là TEXT (để hỗ trợ mã NV01, NV02...)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
        ALTER TABLE employees ALTER COLUMN id TYPE text USING id::text;
    END IF;
END $$;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE employees ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- 1.2. Bảng Tài khoản người dùng (users)
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'STAFF',
    department TEXT,
    "employeeId" TEXT,
    active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '[]'::jsonb,
    "customPermissions" JSONB DEFAULT '[]'::jsonb,
    avatar TEXT,
    id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tự động bổ sung các cột nếu bảng users đã tồn tại từ trước
ALTER TABLE users ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '123456';
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'STAFF';
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "customPermissions" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- Tạo tài khoản Quản trị viên mặc định nếu chưa có
INSERT INTO users (username, password, name, role, department, active, permissions)
VALUES (
    'admin',
    'admin123',
    'Quản trị viên Hệ thống',
    'ADMIN',
    'Ban Giám đốc',
    TRUE,
    '["*"]'::jsonb
) ON CONFLICT (username) DO NOTHING;


-- ==============================================================================
-- 2. CẤU HÌNH HỆ THỐNG & NGHỈ LỄ
-- ==============================================================================

-- 2.1. Bảng Cài đặt hệ thống (system_settings)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Khởi tạo cấu hình mặc định nếu chưa có
INSERT INTO system_settings (key, value) VALUES 
    ('app_version', '2.1.1'),
    ('app_update_url', ''),
    ('vaoso_current_book_number', '000000'),
    ('role_permissions', '{}'),
    ('department_permissions', '{}')
ON CONFLICT (key) DO NOTHING;

-- 2.2. Bảng Ngày nghỉ lễ (holidays)
CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    day INTEGER NOT NULL,
    month INTEGER NOT NULL,
    is_lunar BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==============================================================================
-- 3. CÁC BẢNG QUẢN LÝ HỒ SƠ CHUYÊN MÔN (3 NHÓM CHÍNH)
-- ==============================================================================

-- 3.1. BẢNG HỒ SƠ TỔ ĐO ĐẠC (land_records - Nhóm 2.x)
CREATE TABLE IF NOT EXISTS land_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    cccd TEXT,
    "customerAddress" TEXT,
    ward TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    address TEXT,
    "group" TEXT,
    content TEXT,
    "recordType" TEXT,
    
    -- Mốc thời gian
    "receivedDate" DATE,
    deadline DATE,
    "assignedDate" DATE,
    
    -- Trạng thái & Phân công
    status TEXT DEFAULT 'RECEIVED',
    "receivedBy" TEXT,
    "assignedTo" TEXT,
    "surveyorId" TEXT,
    "surveyAssignedDate" DATE,
    "fieldAssignedDate" DATE,
    "fieldCompletedDate" DATE,
    "drafterId" TEXT,
    "officeAssignedDate" DATE,
    "officeCompletedDate" DATE,
    
    -- Kiểm tra & Duyệt
    "pendingCheckDate" DATE,
    "checkedBy" TEXT,
    "checkedDate" DATE,
    "completedWorkDate" DATE,
    "submissionDate" DATE,
    "submittedTo" TEXT,
    "approvalDate" DATE,
    "completedDate" DATE,
    
    -- Số trích đo / trích lục / cấp GCN
    "measurementNumber" TEXT,
    "excerptNumber" TEXT,
    "issueNumber" TEXT,
    "entryNumber" TEXT,
    "issueDate" DATE,
    "residentialArea" NUMERIC,
    
    -- Tài chính & Trả kết quả
    price NUMERIC,
    "advancePayment" NUMERIC,
    "receiptNumber" TEXT,
    "receiverName" TEXT,
    "resultReturnedDate" DATE,
    
    -- Đợt xuất & Bàn giao
    "exportBatch" TEXT,
    "exportDate" DATE,
    "handoverWard" TEXT,
    "isHandedOver" BOOLEAN DEFAULT FALSE,
    "archiveHandoverDate" DATE,
    "archiveHandoverBatch" TEXT,
    
    -- Chỉnh lý & Nhắc nhở
    "needsMapCorrection" BOOLEAN DEFAULT FALSE,
    "explanationPlan" TEXT,
    "reminderDate" TIMESTAMPTZ,
    "lastRemindedAt" TIMESTAMPTZ,
    "deadlineReminded" BOOLEAN DEFAULT FALSE,
    
    -- Ghi chú & Thành phần hồ sơ
    "authorizedBy" TEXT,
    "authDocType" TEXT,
    "otherDocs" TEXT,
    notes TEXT,
    "privateNotes" TEXT,
    "personalNotes" TEXT,
    "dossierComponents" JSONB DEFAULT '[]'::jsonb,
    "attachedFiles" JSONB DEFAULT '[]'::jsonb,
    "statusLogs" JSONB DEFAULT '[]'::jsonb,
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Cập nhật bổ sung cột nếu bảng land_records đã tồn tại trước đó
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receivedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'RECEIVED';
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "surveyorId" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "surveyAssignedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "fieldAssignedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "fieldCompletedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "drafterId" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "officeAssignedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "officeCompletedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedWorkDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submissionDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submittedTo" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "approvalDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "measurementNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "excerptNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "entryNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "residentialArea" NUMERIC;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "handoverWard" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "isHandedOver" BOOLEAN DEFAULT FALSE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" DATE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" BOOLEAN DEFAULT FALSE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "explanationPlan" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMPTZ;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" TIMESTAMPTZ;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "deadlineReminded" BOOLEAN DEFAULT FALSE;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authDocType" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "otherDocs" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "privateNotes" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "personalNotes" TEXT;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "dossierComponents" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "attachedFiles" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE land_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.2. BẢNG HỒ SƠ TỔ CẤP GIẤY / ĐĂNG KÝ (dangky_records - Nhóm 3.x)
CREATE TABLE IF NOT EXISTS dangky_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    cccd TEXT,
    "customerAddress" TEXT,
    ward TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    address TEXT,
    "group" TEXT,
    "recordType" TEXT,
    content TEXT,
    
    -- Thời gian & Hạn giải quyết
    "receivedDate" DATE,
    deadline DATE,
    "assignedDate" DATE,
    
    -- Thông tin cấp giấy & kết quả
    "issueNumber" TEXT,
    "entryNumber" TEXT,
    "issueDate" DATE,
    "residentialArea" NUMERIC,
    status TEXT DEFAULT 'RECEIVED',
    
    -- Quy trình & Tiến độ nhân sự
    "receivedBy" TEXT,
    "assignedTo" TEXT,
    "pendingCheckDate" DATE,
    "checkedBy" TEXT,
    "checkedDate" DATE,
    "completedWorkDate" DATE,
    "submissionDate" DATE,
    "submittedTo" TEXT,
    "approvalDate" DATE,
    "completedDate" DATE,
    
    -- Tài chính & Biên lai
    price NUMERIC,
    "advancePayment" NUMERIC,
    "receiptNumber" TEXT,
    "receiptType" TEXT,
    "receiverName" TEXT,
    "returnedBy" TEXT,
    "resultReturnedDate" DATE,
    "returnedPrice" NUMERIC,
    
    -- Bàn giao & Đợt xuất
    "exportBatch" TEXT,
    "exportDate" DATE,
    "handoverWard" TEXT,
    "returnBatch" NUMERIC,
    "returnBatchDate" DATE,
    "returnHandoverDept" TEXT,
    "isHandedOver" BOOLEAN DEFAULT FALSE,
    "archiveHandoverDate" DATE,
    "archiveHandoverBatch" TEXT,
    
    -- Ủy quyền, Ghi chú & Tệp đính kèm
    "authorizedBy" TEXT,
    "authDocType" TEXT,
    notes TEXT,
    "privateNotes" TEXT,
    "personalNotes" TEXT,
    "otherDocs" TEXT,
    "attachedFiles" JSONB DEFAULT '[]'::jsonb,
    "dossierComponents" JSONB DEFAULT '[]'::jsonb,
    "statusLogs" JSONB DEFAULT '[]'::jsonb,
    
    -- Chỉnh lý & Nhắc nhở
    "needsMapCorrection" BOOLEAN DEFAULT FALSE,
    "explanationPlan" TEXT,
    "reminderDate" TIMESTAMPTZ,
    "lastRemindedAt" TIMESTAMPTZ,
    "deadlineReminded" BOOLEAN DEFAULT FALSE,
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Bổ sung đầy đủ cột cho dangky_records nếu bảng đã có sẵn
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "assignedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "entryNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "residentialArea" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'RECEIVED';
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "checkedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "checkedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "completedWorkDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submissionDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "submittedTo" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "approvalDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "completedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiptType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnedPrice" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "exportDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "handoverWard" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnBatch" NUMERIC;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnBatchDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "returnHandoverDept" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "isHandedOver" BOOLEAN DEFAULT FALSE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" DATE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "authDocType" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "privateNotes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "personalNotes" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "otherDocs" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "attachedFiles" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "dossierComponents" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" BOOLEAN DEFAULT FALSE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "explanationPlan" TEXT;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" TIMESTAMPTZ;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "deadlineReminded" BOOLEAN DEFAULT FALSE;
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE dangky_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.3. BẢNG HỒ SƠ TỔ LƯU TRỮ (luutru_records - Nhóm 1.x)
CREATE TABLE IF NOT EXISTS luutru_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    cccd TEXT,
    "customerAddress" TEXT,
    ward TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    address TEXT,
    "group" TEXT,
    content TEXT,
    "recordType" TEXT,
    
    -- Mốc thời gian & Trạng thái
    "receivedDate" DATE,
    deadline DATE,
    "assignedDate" DATE,
    status TEXT DEFAULT 'RECEIVED',
    
    -- Nhân sự & Tiến độ
    "receivedBy" TEXT,
    "assignedTo" TEXT,
    "pendingCheckDate" DATE,
    "checkedBy" TEXT,
    "checkedDate" DATE,
    "completedWorkDate" DATE,
    "submissionDate" DATE,
    "submittedTo" TEXT,
    "approvalDate" DATE,
    "completedDate" DATE,
    
    -- Số trích đo / trích lục
    "measurementNumber" TEXT,
    "excerptNumber" TEXT,
    "issueNumber" TEXT,
    "entryNumber" TEXT,
    "issueDate" DATE,
    "residentialArea" NUMERIC,
    
    -- Tài chính & Trả kết quả
    price NUMERIC,
    "advancePayment" NUMERIC,
    "receiptNumber" TEXT,
    "receiverName" TEXT,
    "resultReturnedDate" DATE,
    
    -- Đợt xuất & Bàn giao
    "exportBatch" TEXT,
    "exportDate" DATE,
    "handoverWard" TEXT,
    "isHandedOver" BOOLEAN DEFAULT FALSE,
    "archiveHandoverDate" DATE,
    "archiveHandoverBatch" TEXT,
    
    -- Chỉnh lý & Nhắc nhở
    "needsMapCorrection" BOOLEAN DEFAULT FALSE,
    "explanationPlan" TEXT,
    "reminderDate" TIMESTAMPTZ,
    "lastRemindedAt" TIMESTAMPTZ,
    "deadlineReminded" BOOLEAN DEFAULT FALSE,
    
    -- Ghi chú & Thành phần hồ sơ
    "authorizedBy" TEXT,
    "authDocType" TEXT,
    "otherDocs" TEXT,
    notes TEXT,
    "privateNotes" TEXT,
    "personalNotes" TEXT,
    "dossierComponents" JSONB DEFAULT '[]'::jsonb,
    "attachedFiles" JSONB DEFAULT '[]'::jsonb,
    "statusLogs" JSONB DEFAULT '[]'::jsonb,
    
    -- Các trường mở rộng riêng cho Sổ Lưu trữ
    type TEXT,
    so_hieu TEXT,
    trich_yeu TEXT,
    ngay_thang DATE,
    noi_nhan_gui TEXT,
    created_by TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Cập nhật bổ sung cột cho luutru_records nếu đã có sẵn
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS cccd TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "customerAddress" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "landPlot" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "mapSheet" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS area NUMERIC;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "recordType" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receivedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "assignedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'RECEIVED';
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "checkedBy" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "checkedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "completedWorkDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "submissionDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "submittedTo" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "approvalDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "completedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "measurementNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "excerptNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "issueNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "entryNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "issueDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "residentialArea" NUMERIC;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "advancePayment" NUMERIC;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "receiverName" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "exportBatch" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "exportDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "handoverWard" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "isHandedOver" BOOLEAN DEFAULT FALSE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "archiveHandoverDate" DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "archiveHandoverBatch" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" BOOLEAN DEFAULT FALSE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "explanationPlan" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "reminderDate" TIMESTAMPTZ;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" TIMESTAMPTZ;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "deadlineReminded" BOOLEAN DEFAULT FALSE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "authorizedBy" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "authDocType" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "otherDocs" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "privateNotes" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "personalNotes" TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "dossierComponents" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "attachedFiles" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "statusLogs" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS so_hieu TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS trich_yeu TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS ngay_thang DATE;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS noi_nhan_gui TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE luutru_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.4. Bảng dự phòng archive_records (Tương thích ứng dụng cũ)
CREATE TABLE IF NOT EXISTS archive_records (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    so_hieu TEXT,
    trich_yeu TEXT,
    ngay_thang DATE,
    noi_nhan_gui TEXT,
    created_by TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    "exportBatch" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ==============================================================================
-- 4. HỢP ĐỒNG DỊCH VỤ & BẢNG GIÁ
-- ==============================================================================

-- 4.1. Bảng Hợp đồng dịch vụ (contracts)
CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "customerAddress" TEXT,
    ward TEXT,
    address TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    "contractType" TEXT,
    "serviceType" TEXT,
    "areaType" TEXT,
    "plotCount" INTEGER DEFAULT 1,
    "markerCount" INTEGER DEFAULT 0,
    "splitItems" JSONB DEFAULT '[]'::jsonb,
    quantity NUMERIC DEFAULT 1,
    "unitPrice" NUMERIC DEFAULT 0,
    "vatRate" NUMERIC DEFAULT 0,
    "vatAmount" NUMERIC DEFAULT 0,
    "totalAmount" NUMERIC DEFAULT 0,
    deposit NUMERIC DEFAULT 0,
    content TEXT,
    "createdDate" DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'DRAFT',
    "liquidationArea" NUMERIC,
    "liquidationAmount" NUMERIC,
    "surveyorId" TEXT,
    "drafterId" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "createdDate" DATE DEFAULT CURRENT_DATE;

-- 4.2. Bảng Đơn giá dịch vụ (price_list)
CREATE TABLE IF NOT EXISTS price_list (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    "group" TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE price_list ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();


-- ==============================================================================
-- 5. CÁC TIỆN ÍCH, BIÊN BẢN & SỔ THEO DÕI
-- ==============================================================================

-- 5.1. Bảng Lịch công tác (work_schedules)
CREATE TABLE IF NOT EXISTS work_schedules (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    session TEXT NOT NULL DEFAULT 'morning',
    content TEXT NOT NULL,
    location TEXT,
    attendees TEXT,
    host TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.2. Bảng Chuyển đổi tờ bản đồ cũ - mới (map_sheet_conversions)
CREATE TABLE IF NOT EXISTS map_sheet_conversions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    xa_phuong_cu TEXT NOT NULL,
    so_to_cu TEXT NOT NULL,
    xa_phuong_moi TEXT NOT NULL,
    so_to_moi TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.3. Bảng Sổ Trích lục (excerpt_history & excerpt_counters)
CREATE TABLE IF NOT EXISTS excerpt_history (
    id TEXT PRIMARY KEY,
    "recordCode" TEXT,
    "customerName" TEXT,
    ward TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    purpose TEXT,
    "excerptNumber" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE excerpt_history ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE excerpt_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS excerpt_counters (
    ward TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
);

-- 5.4. Bảng Sổ Trích đo (trichdo_history & trichdo_counters)
CREATE TABLE IF NOT EXISTS trichdo_history (
    id TEXT PRIMARY KEY,
    "recordCode" TEXT,
    "customerName" TEXT,
    ward TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    purpose TEXT,
    "trichdoNumber" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trichdo_history ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE trichdo_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS trichdo_counters (
    ward TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
);

-- 5.5. Biên bản Vi phạm hành chính (vphc_records)
CREATE TABLE IF NOT EXISTS vphc_records (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    record_type TEXT DEFAULT 'mau01',
    data JSONB DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.6. Biên bản Hiện trạng (bienban_records)
CREATE TABLE IF NOT EXISTS bienban_records (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.7. Phiếu Cung cấp thông tin (thongtin_records)
CREATE TABLE IF NOT EXISTS thongtin_records (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.8. Sổ Theo dõi Chỉnh lý biến động (chinhly_records)
CREATE TABLE IF NOT EXISTS chinhly_records (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.9. Sổ Theo dõi Tách thửa (tachthua_records)
CREATE TABLE IF NOT EXISTS tachthua_records (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.10. Bảng Tin nhắn / Trao đổi nội bộ (messages)
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT,
    receiver_id TEXT,
    content TEXT,
    channel TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==============================================================================
-- 6. TẠO INDEXES TỐI ƯU HIỆU NĂNG TÌM KIẾM
-- ==============================================================================

-- Index cho land_records
CREATE INDEX IF NOT EXISTS idx_land_code ON land_records(code);
CREATE INDEX IF NOT EXISTS idx_land_status ON land_records(status);
CREATE INDEX IF NOT EXISTS idx_land_ward ON land_records(ward);
CREATE INDEX IF NOT EXISTS idx_land_assigned ON land_records("assignedTo");

-- Index cho dangky_records
CREATE INDEX IF NOT EXISTS idx_dangky_code ON dangky_records(code);
CREATE INDEX IF NOT EXISTS idx_dangky_status ON dangky_records(status);
CREATE INDEX IF NOT EXISTS idx_dangky_ward ON dangky_records(ward);
CREATE INDEX IF NOT EXISTS idx_dangky_assigned ON dangky_records("assignedTo");

-- Index cho luutru_records
CREATE INDEX IF NOT EXISTS idx_luutru_code ON luutru_records(code);
CREATE INDEX IF NOT EXISTS idx_luutru_status ON luutru_records(status);
CREATE INDEX IF NOT EXISTS idx_luutru_ward ON luutru_records(ward);
CREATE INDEX IF NOT EXISTS idx_luutru_assigned ON luutru_records("assignedTo");

-- Index cho contracts
CREATE INDEX IF NOT EXISTS idx_contracts_code ON contracts(code);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

-- Index cho work_schedules
CREATE INDEX IF NOT EXISTS idx_work_schedules_date ON work_schedules(date DESC);

-- Index cho map_sheet_conversions
CREATE INDEX IF NOT EXISTS idx_map_conv_old ON map_sheet_conversions(xa_phuong_cu, so_to_cu);
CREATE INDEX IF NOT EXISTS idx_map_conv_new ON map_sheet_conversions(xa_phuong_moi, so_to_moi);


-- ==============================================================================
-- 7. CẤU HÌNH QUYỀN TRUY CẬP (ROW LEVEL SECURITY - RLS) CHO SUPABASE
-- ==============================================================================

-- Tắt RLS hoặc mở quyền toàn quyền truy cập thông qua anon/authenticated key
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS holidays DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS land_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS dangky_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS luutru_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS archive_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS work_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS map_sheet_conversions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS excerpt_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS excerpt_counters DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trichdo_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trichdo_counters DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vphc_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bienban_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS thongtin_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chinhly_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tachthua_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- HOÀN TẤT THIẾT LẬP CƠ SỞ DỮ LIỆU TOÀN BỘ PHẦN MỀM
-- ==============================================================================
