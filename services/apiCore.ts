
import { supabase, isConfigured } from './supabaseClient';
import { Contract, PriceItem, Employee, User, RecordStatus } from '../types';
import { API_BASE_URL, isArchiveRecordType } from '../constants'; 
import { isFieldWorkProcedure, isOfficeOnlySurveyProcedure } from '../utils/appHelpers';
import { connectionManager } from './connectionService'; 
import { setIndexedDBItem, getIndexedDBItem } from './storageService';

// --- CACHE KEYS ---
export const CACHE_KEYS = {
    RECORDS: 'offline_records',
    EMPLOYEES: 'offline_employees',
    USERS: 'offline_users',
    CONTRACTS: 'offline_contracts',
    EXCERPT_HISTORY: 'offline_excerpt_history',
    EXCERPT_COUNTERS: 'offline_excerpt_counters',
    TRICHDO_HISTORY: 'offline_trichdo_history',
    TRICHDO_COUNTERS: 'offline_trichdo_counters',
    PRICE_LIST: 'offline_price_list',
    HOLIDAYS: 'offline_holidays',
    SYSTEM_CONFIG: 'offline_system_config'
};

// --- HELPERS ---
export const saveToCache = (key: string, data: any) => {
    // 1. Nếu là danh sách hồ sơ: Lưu 100% toàn bộ vào IndexedDB, KHÔNG lưu vào LocalStorage để tránh giới hạn 5MB và lỗi cắt 50 hồ sơ
    if (key === CACHE_KEYS.RECORDS) {
        if (Array.isArray(data)) {
            setIndexedDBItem(key, data).catch(() => {});
        }
        // Xóa sạch key cũ trong LocalStorage để giải phóng bộ nhớ
        try {
            localStorage.removeItem(key);
            localStorage.removeItem('app_records_cache_v1');
        } catch {}
        return;
    }

    // 2. Với các cấu hình / danh mục nhỏ khác (nhân viên, tài khoản, ngày nghỉ...), lưu an toàn vào LocalStorage
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e: any) {
        if (e?.name === 'QuotaExceededError' || e?.message?.includes('quota')) {
            // Dọn dẹp các cache rác nếu có
            try {
                localStorage.removeItem('app_records_cache_v1');
                localStorage.removeItem(CACHE_KEYS.RECORDS);
            } catch {}
        }
    }
};

export const getFromCache = <T>(key: string, fallback: T): T => {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        // Bỏ qua lỗi đọc cache
    }
    return fallback;
};

// Hàm chuẩn hóa chuỗi để so sánh mã (Code) chính xác hơn
export const normalizeCode = (code: any): string => {
    if (!code) return '';
    let str = String(code).trim().toLowerCase();
    // Loại bỏ các ký tự ẩn không in được (zero width space...)
    // eslint-disable-next-line no-control-regex
    str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');
    // Loại bỏ toàn bộ khoảng trắng để so sánh tuyệt đối (Ví dụ: "HS - 001" sẽ bằng "hs-001")
    str = str.replace(/\s+/g, '');
    return str;
};

// Variable to prevent multiple alerts on connection failures during a single session
let hasShownConnectionAlert = false;

export const logError = (context: string, error: any, silent: boolean = false) => {
    // 1. Log Raw Error object để debug trong Console
    // console.error(`[Raw Error] ${context}:`, error);

    let msg = 'Lỗi không xác định';
    let code = '';
    let details = '';

    if (error instanceof Error) {
        msg = error.message;
    }
    else if (typeof error === 'object' && error !== null) {
        // Cố gắng lấy message từ các cấu trúc lỗi phổ biến
        msg = error.message || error.error_description || error.msg || (error.error ? error.error.message : '');
        code = error.code || error.status || '';
        details = error.details || error.hint || '';
        
        // Nếu vẫn không có message, stringify toàn bộ object
        if (!msg) {
            try {
                msg = JSON.stringify(error);
            } catch (e) {
                msg = '[Circular or Unserializable Object]';
            }
        }
    } 
    else if (typeof error === 'string') {
        msg = error;
    }

    if (silent) {
        console.warn(`⚠️ [Error Logged] ${context}: ${msg} ${code ? `(Code: ${code})` : ''} ${details ? `Details: ${details}` : ''}`);
        return;
    }

    if (typeof msg === 'string' && (msg.includes('<!DOCTYPE html>') || msg.includes('500 Internal Server Error') || msg.includes('<html>'))) {
         console.warn(`⚠️ [Server Error] ${context}: Máy chủ Cloud đang tạm dừng hoặc gặp sự cố (Lỗi 500).`);
         return; 
    }

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('configuration') || msg.includes('Load failed') || msg.includes('ERR_INTERNET_DISCONNECTED')) {
        console.warn(`⚠️ [Lỗi kết nối] ${context}: Không thể kết nối tới cơ sở dữ liệu Cloud Supabase.`);
        if (!silent) {
            connectionManager.reportNetworkError(context, error);
        }
    } else if (code === '42P01' || code === 'PGRST205' || (typeof msg === 'string' && msg.includes('schema cache'))) {
        console.error(`❌ Lỗi tại ${context}: Bảng dữ liệu chưa tồn tại trên Supabase! (Code: ${code || 'PGRST205'})`);
        if (!silent) {
            alert(`LỖI BẢNG DỮ LIỆU: Bảng '${context.includes('Contract') ? 'contracts' : 'luutru_records'}' chưa tồn tại trên Supabase!\n\nVui lòng truy cập SQL Editor trên trang quản trị Supabase và chạy file SQL tạo bảng tương ứng.`);
        }
    } else if (code === '22P02') {
        console.error(`❌ Lỗi tại ${context}: Định dạng dữ liệu không khớp kiểu cột Supabase (Lỗi 22P02). Hệ thống sẽ tự động xử lý ép kiểu an toàn.`);
    } else if (code === 'PGRST204' || code === '42703' || msg.includes('column') || details.includes('column') || msg.includes('does not exist')) {
         console.error(`❌ Lỗi tại ${context}: Cột không tồn tại (Lỗi ${code}). Details: ${details || msg}`);
         // Cập nhật thông báo lỗi hướng dẫn cụ thể SQL
         alert(`LỖI CẤU TRÚC DATABASE (Thiếu cột):\nDatabase trên Cloud đang thiếu cột.\nChi tiết lỗi: ${details || msg}\n\nVui lòng vào SQL Editor trên Supabase và chạy lệnh sau để thêm TẤT CẢ các cột có thể thiếu:\n\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "customerAddress" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "entryNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "residentialArea" numeric;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" boolean;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiverName" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "reminderDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "measurementNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "excerptNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportBatch" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "handoverWard" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authorizedBy" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authDocType" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "otherDocs" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "privateNotes" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "personalNotes" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submittedTo" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedBy" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submissionDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "approvalDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedTo" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receivedBy" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedWorkDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "price" numeric;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "advancePayment" numeric;\nALTER TABLE land_records ALTER COLUMN "exportBatch" TYPE text USING "exportBatch"::text;`);
    } else if (code === '406') {
         console.warn(`⚠️ [Info] ${context}: Không tìm thấy dữ liệu (406).`);
    } else if (code === '22007' || code === '22008') {
         console.warn(`⚠️ [Cảnh báo ngày tháng] ${context}: Dữ liệu ngày tháng không hợp lệ hoặc sai định dạng (Lỗi ${code}). Hệ thống đã tự động lọc và chuyển về ngày hợp lệ.`);
    } else if (code === '21000') {
         console.error(`❌ Lỗi tại ${context}: Dữ liệu trùng lặp trong cùng một yêu cầu (Lỗi ${code}).`);
         alert(`LỖI TRÙNG LẶP: File Excel có chứa nhiều dòng cùng Mã Hồ Sơ. Hệ thống đã cố gắng xử lý nhưng Server từ chối.\nVui lòng kiểm tra file Excel và xóa các dòng trùng lặp mã.`);
    } else if (code === '42501') {
         console.error(`❌ Lỗi tại ${context}: Lỗi phân quyền bảo mật RLS (Code: 42501)`);
         alert(`LỖI PHÂN QUYỀN (Row-Level Security): \nSupabase đang từ chối LƯU HOẶC SỬA dữ liệu do bạn đang bật tính năng bảo mật Row-Level Security (RLS) trên bảng dữ liệu nhưng chưa cấu hình Policy.\n\nHƯỚNG DẪN SỬA LỖI:\n1. Mở trang Quản lý Supabase của bạn\n2. Chọn phần "SQL Editor"\n3. Copy và chạy tập lệnh sau để cho phép truy cập:\n\nALTER TABLE land_records DISABLE ROW LEVEL SECURITY;\nALTER TABLE luutru_records DISABLE ROW LEVEL SECURITY;\nALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;`);
    } else {
        console.error(`❌ [Chi tiết] ${context}: ${msg} ${code ? `(Code: ${code})` : ''} ${details ? `Details: ${details}` : ''}`);
    }
};

export function sanitizeFileName(fileName: string): string {
    let str = fileName.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/[^a-z0-9\.\-\_]/g, '_');
    if (str.length > 50) {
        const ext = str.split('.').pop();
        str = str.substring(0, 40) + '.' + ext;
    }
    return str;
}

export const keepOnlyDate = (val: any): string | null => {
    if (val === undefined || val === null || val === '') return null;
    
    // 1. Xử lý số serial của Excel (vd: 45500)
    if (typeof val === 'number') {
        if (isNaN(val)) return null;
        if (val > 20000 && val < 70000) {
            const utcMs = Math.round((val - 25569) * 86400 * 1000);
            const date = new Date(utcMs);
            if (!isNaN(date.getTime())) {
                const y = date.getUTCFullYear();
                const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                const d = String(date.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        return null;
    }

    // 2. Xử lý Date object
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        const y = val.getFullYear();
        if (y < 1900 || y > 2100) return null;
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 3. Xử lý chuỗi
    if (typeof val === 'string') {
        let cleanStr = val.trim();
        if (cleanStr === '' || cleanStr === 'null' || cleanStr === 'undefined' || cleanStr === '-' || cleanStr === 'N/A') return null;

        // Trích xuất YYYY-MM-DD từ chuỗi ISO hoặc có giờ (vd: 2026-07-24T12:34:56.000Z hoặc 2026-07-24 10:30:00)
        const matchYmd = cleanStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (matchYmd) {
            const year = parseInt(matchYmd[1], 10);
            const month = parseInt(matchYmd[2], 10);
            const day = parseInt(matchYmd[3], 10);
            if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
            const d = new Date(year, month - 1, day);
            if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
                return null; // Ngày không hợp lệ (vd: 30/02)
            }
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        
        // Xử lý định dạng DD/MM/YYYY hoặc DD-MM-YYYY hoặc DD.MM.YYYY
        const matchDmy = cleanStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
        if (matchDmy) {
            const day = parseInt(matchDmy[1], 10);
            const month = parseInt(matchDmy[2], 10);
            const year = parseInt(matchDmy[3], 10);
            if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
            const d = new Date(year, month - 1, day);
            if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
                return null; // Ngày không hợp lệ (vd: 30/02)
            }
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        // Thử parse Date thông thường
        const parsed = new Date(cleanStr);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            if (y < 1900 || y > 2100) return null;
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        return null;
    }
    return null;
};

export const keepOnlyDateTime = (val: any): string | null => {
    if (val === undefined || val === null || val === '') return null;
    if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : val.toISOString();
    }
    if (typeof val === 'number') {
        if (isNaN(val)) return null;
        if (val > 20000 && val < 70000) {
            const utcMs = Math.round((val - 25569) * 86400 * 1000);
            const d = new Date(utcMs);
            return isNaN(d.getTime()) ? null : d.toISOString();
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
    }
    if (typeof val === 'string') {
        const cleanStr = val.trim();
        if (!cleanStr || cleanStr === 'null' || cleanStr === 'undefined' || cleanStr === '-' || cleanStr === 'N/A') return null;
        
        // Kiểm tra dạng DD/MM/YYYY hoặc DD/MM/YYYY HH:mm(:ss)
        const dmyMatch = cleanStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10);
            const year = parseInt(dmyMatch[3], 10);
            const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
            const mins = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
            const secs = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
            if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
            const d = new Date(year, month - 1, day, hours, mins, secs);
            if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
                return null;
            }
            return d.toISOString();
        }
        
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            if (y < 1900 || y > 2100) return null;
            return d.toISOString();
        }
        return null;
    }
    return null;
};

export const isBlankRecord = (r: any): boolean => {
    if (!r) return true;
    const customerName = String(r.customerName || '').trim().toLowerCase();
    const content = String(r.content || '').trim().toLowerCase();
    const address = String(r.address || r.customerAddress || '').trim().toLowerCase();
    const phone = String(r.phoneNumber || '').trim();
    const cccd = String(r.cccd || '').trim();
    const landPlot = String(r.landPlot || '').trim();
    const mapSheet = String(r.mapSheet || '').trim();
    const issueNum = String(r.issueNumber || '').trim();
    const entryNum = String(r.entryNumber || '').trim();
    const notes = String(r.notes || r.privateNotes || '').trim();
    const receivedBy = String(r.receivedBy || '').trim();

    const isInvalidCustomer = !customerName || 
      customerName === 'chưa có' || 
      customerName === 'chưa nhập' || 
      customerName === 'trống' || 
      customerName === 'n/a' || 
      customerName === 'undefined' || 
      customerName === 'null' ||
      customerName === 'chưa cập nhật' ||
      customerName === '0' ||
      customerName === 'test';

    const hasNoLandInfo = (!landPlot || landPlot === '0') && (!mapSheet || mapSheet === '0');
    const hasNoDetails = !phone && !cccd && !address && !issueNum && !entryNum && !notes && (!content || content.length < 3) && !receivedBy;

    return isInvalidCustomer && hasNoLandInfo && hasNoDetails;
};

export const sanitizeData = (data: any, allowedColumns: string[]) => {
    const clean: any = { ...data };
    const numberFields = [
        'area', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount', 
        'deposit', 'quantity', 'plotCount', 'markerCount', 
        'minArea', 'maxArea', 'price',
        'liquidationArea', 'liquidationAmount', 'residentialArea', 'advancePayment'
    ];
    numberFields.forEach(field => {
        if (clean[field] !== undefined) {
            if (clean[field] === '' || (typeof clean[field] === 'number' && isNaN(clean[field]))) {
                clean[field] = null;
            }
        }
    });
    
    // DateTime fields: Lưu chuẩn ISO timestamp hoặc null
    const dateTimeFields = [
        'lastRemindedAt', 'reminderDate', 'created_at', 'updated_at', 'createdAt', 'updatedAt'
    ];

    // Date-only fields: Đảm bảo CHỈ lưu YYYY-MM-DD hợp lệ, loại bỏ hoàn toàn các chuỗi ngày lỗi
    const dateOnlyFields = [
        'receivedDate', 'resultReturnedDate',
        'deadline', 'assignedDate', 
        'submissionDate', 'approvalDate', 'completedDate', 
        'exportDate', 'issueDate',
        'pendingCheckDate', 'checkedDate', 'completedWorkDate',
        'surveyAssignedDate', 'fieldAssignedDate', 'fieldCompletedDate',
        'officeAssignedDate', 'officeCompletedDate',
        'archiveHandoverDate', 'returnBatchDate', 'returnBatchDate',
        'ngay_thang', 'date', 'createdDate'
    ];

    dateTimeFields.forEach(field => {
        if (clean[field] !== undefined) {
            clean[field] = keepOnlyDateTime(clean[field]);
        }
    });

    dateOnlyFields.forEach(field => {
        if (clean[field] !== undefined) {
            clean[field] = keepOnlyDate(clean[field]);
        }
    });

    // Boolean fields: Chuyển đổi chuỗi rỗng "" hoặc "null" thành null để tránh lỗi 22P02 trên PostgreSQL
    const booleanFields = ['needsMapCorrection', 'deadlineReminded', 'isHandedOver', 'is_handover', 'active'];
    booleanFields.forEach(field => {
        if (clean[field] !== undefined) {
            const val = clean[field];
            if (val === '' || val === null || val === undefined || val === 'null' || val === 'undefined') {
                clean[field] = null;
            } else if (typeof val === 'boolean') {
                clean[field] = val;
            } else if (typeof val === 'string') {
                const str = val.trim().toLowerCase();
                if (str === 'true' || str === '1' || str === 't') {
                    clean[field] = true;
                } else if (str === 'false' || str === '0' || str === 'f') {
                    clean[field] = false;
                } else {
                    clean[field] = null;
                }
            } else if (typeof val === 'number') {
                clean[field] = val === 1 ? true : (val === 0 ? false : null);
            }
        }
    });
    
    const sanitized: any = {};
    allowedColumns.forEach(col => {
        if (clean.hasOwnProperty(col) && clean[col] !== undefined) {
            sanitized[col] = clean[col];
        }
    });
    return sanitized;
};

/**
 * Tự động làm sạch & chuẩn hóa toàn bộ các trường ngày tháng khi gặp lỗi 22007/22008 (Invalid Date / Out of Range)
 */
export const sanitizePayloadForDateErrors = (payload: any): any => {
    if (!payload) return payload;
    if (Array.isArray(payload)) {
        return payload.map(item => sanitizePayloadForDateErrors(item));
    }
    const clean = { ...payload };
    const dateFields = [
        'receivedDate', 'resultReturnedDate', 'deadline', 'assignedDate', 
        'submissionDate', 'approvalDate', 'completedDate', 'exportDate', 'issueDate',
        'pendingCheckDate', 'checkedDate', 'completedWorkDate',
        'surveyAssignedDate', 'fieldAssignedDate', 'fieldCompletedDate',
        'officeAssignedDate', 'officeCompletedDate',
        'archiveHandoverDate', 'returnBatchDate', 'ngay_thang', 'date', 'createdDate'
    ];
    dateFields.forEach(f => {
        if (clean[f] !== undefined) {
            clean[f] = keepOnlyDate(clean[f]);
        }
    });

    const dateTimeFields = ['lastRemindedAt', 'reminderDate', 'created_at', 'updated_at', 'createdAt', 'updatedAt'];
    dateTimeFields.forEach(f => {
        if (clean[f] !== undefined) {
            clean[f] = keepOnlyDateTime(clean[f]);
        }
    });
    return clean;
};

/**
 * Tự động làm sạch & chuyển đổi payload khi gặp lỗi 22P02 (Sai kiểu dữ liệu trên Supabase)
 * Giúp người dùng không cần chạy lệnh SQL chỉnh sửa kiểu cột trên Supabase.
 */
export const sanitizePayloadFor22P02 = (payload: any): any => {
    if (!payload) return payload;
    if (Array.isArray(payload)) {
        return payload.map(item => sanitizePayloadFor22P02(item));
    }
    const clean = { ...payload };

    // 1. Chuyển exportBatch: nếu cột trên Supabase đang là numeric/integer,
    // biến chuỗi "Đợt 01-30/07/2026" hoặc "Đợt 1" thành số 1
    if (clean.exportBatch !== undefined && clean.exportBatch !== null) {
        if (typeof clean.exportBatch === 'string') {
            const match = clean.exportBatch.match(/Đợt\s*(\d+)/i) || clean.exportBatch.match(/^(\d+)/);
            if (match && match[1]) {
                clean.exportBatch = parseInt(match[1], 10);
            } else if (isNaN(Number(clean.exportBatch))) {
                clean.exportBatch = null;
            } else {
                clean.exportBatch = Number(clean.exportBatch);
            }
        }
    }

    // 2. Chuyển đổi các cột số bị dính chuỗi chữ hoặc chuỗi rỗng
    const numericKeys = [
        'area', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount', 
        'deposit', 'quantity', 'plotCount', 'markerCount', 
        'minArea', 'maxArea', 'price', 'advancePayment',
        'liquidationArea', 'liquidationAmount', 'residentialArea',
        'excerptNumber', 'measurementNumber', 'sheetNumber', 'plotNumber',
        'issueNumber', 'receiptNumber', 'entryNumber'
    ];

    numericKeys.forEach(k => {
        if (clean[k] !== undefined && clean[k] !== null) {
            if (clean[k] === '' || clean[k] === 'null' || clean[k] === 'undefined') {
                clean[k] = null;
            } else if (typeof clean[k] === 'string') {
                const cleanDigits = clean[k].replace(/[^0-9\.]/g, '');
                if (cleanDigits === '') {
                    clean[k] = null;
                } else {
                    const num = parseFloat(cleanDigits);
                    clean[k] = isNaN(num) ? null : num;
                }
            }
        }
    });

    // 3. Chuyển đổi các cột boolean bị dính chuỗi rỗng "" hoặc "null"
    const booleanFields = ['needsMapCorrection', 'deadlineReminded', 'isHandedOver', 'is_handover', 'active'];
    booleanFields.forEach(field => {
        if (clean[field] !== undefined) {
            const val = clean[field];
            if (val === '' || val === null || val === undefined || val === 'null' || val === 'undefined') {
                clean[field] = null;
            } else if (typeof val === 'boolean') {
                clean[field] = val;
            } else if (typeof val === 'string') {
                const str = val.trim().toLowerCase();
                if (str === 'true' || str === '1' || str === 't') {
                    clean[field] = true;
                } else if (str === 'false' || str === '0' || str === 'f') {
                    clean[field] = false;
                } else {
                    clean[field] = null;
                }
            } else if (typeof val === 'number') {
                clean[field] = val === 1 ? true : (val === 0 ? false : null);
            }
        }
    });

    return clean;
};

// --- MAPPERS ---
export const mapRecordFromDb = (item: any): any => {
    if (!item) return item;
    const r = { ...item };
    
    // Helper to get first non-null/non-undefined value
    const val = (camel: any, lower: any, snake: any) => {
        if (camel !== undefined && camel !== null) return camel;
        if (lower !== undefined && lower !== null) return lower;
        if (snake !== undefined && snake !== null) return snake;
        return camel;
    };

    // Ưu tiên 100% trạng thái status chính thức được lưu trong cơ sở dữ liệu
    r.status = val(r.status, r.STATUS, r.status);

    // Normalization mapping from potential snake_case or lowercase
    r.receivedDate = keepOnlyDate(val(r.receivedDate, r.receiveddate, r.received_date));
    r.customerName = val(r.customerName, r.customername, r.customer_name);
    r.phoneNumber = val(r.phoneNumber, r.phonenumber, r.phone_number);
    r.customerAddress = val(r.customerAddress, r.customeraddress, r.customer_address);
    r.landPlot = val(r.landPlot, r.landplot, r.land_plot);
    r.mapSheet = val(r.mapSheet, r.mapsheet, r.map_sheet);
    r.issueNumber = val(r.issueNumber, r.issuenumber, r.issue_number);
    r.entryNumber = val(r.entryNumber, r.entrynumber, r.entry_number);
    r.issueDate = keepOnlyDate(val(r.issueDate, r.issuedate, r.issue_date));
    r.residentialArea = val(r.residentialArea, r.residentialarea, r.residential_area);
    r.needsMapCorrection = val(r.needsMapCorrection, r.needsmapcorrection, r.needs_map_correction);
    r.explanationPlan = val(r.explanationPlan, r.explanationplan, r.explanation_plan);
    r.receiptNumber = val(r.receiptNumber, r.receiptnumber, r.receipt_number);
    r.recordType = val(r.recordType, r.recordtype, r.record_type);
    if (r.recordType === '2.3 Trích đo' || r.recordType === 'Trích đo bản đồ địa chính') {
        r.recordType = '2.2 Trích đo';
    } else if (r.recordType && (r.recordType.startsWith('2.6') || r.recordType.includes('CN số thửa') || r.recordType.includes('Cập số thửa') || r.recordType.includes('Cập nhập số thửa') || r.recordType.includes('Cập nhật số thửa') || r.recordType.includes('Duyệt đơn') || r.recordType.includes('duyệt đơn') || r.recordType.includes('Duyệt Đơn') || r.recordType.includes('Duyệt đơn-số thửa') || r.recordType.includes('Duyệt Đơn & Cung cấp số thửa'))) {
        r.recordType = '2.3 Duyệt đơn';
    }
    
    r.receivedBy = val(r.receivedBy, r.receivedby, r.received_by);
    r.assignedDate = keepOnlyDate(val(r.assignedDate, r.assigneddate, r.assigned_date));
    r.assignedTo = val(r.assignedTo, r.assignedto, r.assigned_to);
    
    r.submissionDate = keepOnlyDate(val(r.submissionDate, r.submissiondate, r.submission_date));
    r.submittedTo = val(r.submittedTo, r.submittedto, r.submitted_to);
    
    r.pendingCheckDate = keepOnlyDate(val(r.pendingCheckDate, r.pendingcheckdate, r.pending_check_date));
    r.checkedBy = val(r.checkedBy, r.checkedby, r.checked_by);
    r.checkedDate = keepOnlyDate(val(r.checkedDate, r.checkeddate, r.checked_date));
    
    r.completedWorkDate = keepOnlyDate(val(r.completedWorkDate, r.completedworkdate, r.completed_work_date));
    r.approvalDate = keepOnlyDate(val(r.approvalDate, r.approvaldate, r.approval_date));
    r.completedDate = keepOnlyDate(val(r.completedDate, r.completeddate, r.completed_date));
    
    r.authorizedBy = val(r.authorizedBy, r.authorizedby, r.authorized_by);
    r.authDocType = val(r.authDocType, r.authdoctype, r.auth_doc_type);
    r.otherDocs = val(r.otherDocs, r.otherdocs, r.other_docs);
    
    r.resultReturnedDate = keepOnlyDate(val(r.resultReturnedDate, r.resultreturneddate, r.result_returned_date));
    
    r.exportBatch = val(r.exportBatch, r.exportbatch, r.export_batch);
    r.exportDate = keepOnlyDate(val(r.exportDate, r.exportdate, r.export_date));
    r.handoverWard = val(r.handoverWard, r.handoverward, r.handover_ward);
    
    r.measurementNumber = val(r.measurementNumber, r.measurementnumber, r.measurement_number);
    r.excerptNumber = val(r.excerptNumber, r.excerptnumber, r.excerpt_number);
    
    r.reminderDate = keepOnlyDate(val(r.reminderDate, r.reminderdate, r.reminder_date));
    r.lastRemindedAt = val(r.lastRemindedAt, r.lastremindedat, r.last_reminded_at);
    r.deadlineReminded = val(r.deadlineReminded, r.deadlinereminded, r.deadline_reminded);
    
    r.privateNotes = val(r.privateNotes, r.privatenotes, r.private_notes);
    r.personalNotes = val(r.personalNotes, r.personalnotes, r.personal_notes);
    r.isHandedOver = val(r.isHandedOver, r.ishandedover, r.is_handed_over);
    r.deadline = keepOnlyDate(val(r.deadline, r.deadline, r.dead_line));
    
    let rawLogs = val(r.statusLogs, r.statuslogs, r.status_logs);
    if (typeof rawLogs === 'string') {
        try { rawLogs = JSON.parse(rawLogs); } catch (e) { rawLogs = []; }
    }
    r.statusLogs = Array.isArray(rawLogs) ? rawLogs : [];
    r.archiveHandoverDate = keepOnlyDate(val(r.archiveHandoverDate, r.archivehandoverdate, r.archive_handover_date));
    r.archiveHandoverBatch = val(r.archiveHandoverBatch, r.archivehandoverbatch, r.archive_handover_batch);

    // Mappings cho quy trình đo đạc 2 bước (Ngoại nghiệp & Nội nghiệp)
    r.surveyorId = val(r.surveyorId, r.surveyorid, r.surveyor_id);
    r.surveyAssignedDate = keepOnlyDate(val(r.surveyAssignedDate, r.surveyassigneddate, r.survey_assigned_date));
    r.fieldAssignedDate = keepOnlyDate(val(r.fieldAssignedDate, r.fieldassigneddate, r.field_assigned_date));
    r.fieldCompletedDate = keepOnlyDate(val(r.fieldCompletedDate, r.fieldcompleteddate, r.field_completed_date));
    r.drafterId = val(r.drafterId, r.drafterid, r.drafter_id);
    r.officeAssignedDate = keepOnlyDate(val(r.officeAssignedDate, r.officeassigneddate, r.office_assigned_date));
    r.officeCompletedDate = keepOnlyDate(val(r.officeCompletedDate, r.officecompleteddate, r.office_completed_date));

    // Tự động chuẩn hóa nếu trạng thái bị lệch so với tiến trình thực tế
    const currentStatus = (r.status || '').trim();
    const isArchive = isArchiveRecordType(r.recordType) || r.sourceTable === 'luutru_records';
    const isOfficeProcedure = isOfficeOnlySurveyProcedure(r.recordType);

    if (currentStatus === RecordStatus.WITHDRAWN || currentStatus === RecordStatus.REJECTED) {
        r.status = currentStatus as RecordStatus;
    } else if (r.resultReturnedDate) {
        r.status = RecordStatus.RETURNED;
    } else if (r.completedDate && (!currentStatus || currentStatus === RecordStatus.RETURNED || currentStatus === RecordStatus.HANDOVER || currentStatus === RecordStatus.RECEIVED || currentStatus === RecordStatus.ASSIGNED || currentStatus === RecordStatus.FIELD_WORK || currentStatus === RecordStatus.OFFICE_WORK || currentStatus === RecordStatus.PENDING_CHECK || currentStatus === RecordStatus.PENDING_SIGN || currentStatus === RecordStatus.SIGNED)) {
        r.status = RecordStatus.HANDOVER;
    } else if (r.approvalDate && (!currentStatus || currentStatus === RecordStatus.RECEIVED || currentStatus === RecordStatus.ASSIGNED || currentStatus === RecordStatus.FIELD_WORK || currentStatus === RecordStatus.OFFICE_WORK || currentStatus === RecordStatus.PENDING_CHECK || currentStatus === RecordStatus.PENDING_SIGN)) {
        r.status = RecordStatus.SIGNED;
    } else if ((r.submissionDate || r.submittedTo || r.checkedDate) && (!currentStatus || currentStatus === RecordStatus.RECEIVED || currentStatus === RecordStatus.ASSIGNED || currentStatus === RecordStatus.FIELD_WORK || currentStatus === RecordStatus.OFFICE_WORK || currentStatus === RecordStatus.PENDING_CHECK)) {
        r.status = RecordStatus.PENDING_SIGN;
    } else if ((r.pendingCheckDate || r.checkedBy) && (!currentStatus || currentStatus === RecordStatus.RECEIVED || currentStatus === RecordStatus.ASSIGNED || currentStatus === RecordStatus.FIELD_WORK || currentStatus === RecordStatus.OFFICE_WORK)) {
        r.status = RecordStatus.PENDING_CHECK;
    } else if (currentStatus && Object.values(RecordStatus).includes(currentStatus as RecordStatus)) {
        r.status = currentStatus as RecordStatus;
    } else if (!isArchive) {
        // Module Đo đạc: Bỏ hoàn toàn trạng thái "Đang thực hiện" -> Chuyển sang Đo đạc thực địa hoặc Biên tập bản đồ
        if (isOfficeProcedure) {
            // Thủ tục 2.1, 2.3: Nếu đã giao việc (có assignedTo/drafterId/officeAssignedDate) hoặc có trạng thái thuộc nhóm giao việc -> Biên tập bản đồ
            if (r.assignedTo || r.drafterId || r.officeAssignedDate || ['ASSIGNED', 'IN_PROGRESS', 'OFFICE_WORK', 'FIELD_WORK', 'COMPLETED_WORK', 'GIAO_HS'].includes(currentStatus)) {
                r.status = RecordStatus.OFFICE_WORK;
            } else {
                r.status = RecordStatus.RECEIVED;
            }
        } else if (['ASSIGNED', 'IN_PROGRESS', 'FIELD_WORK', 'OFFICE_WORK', 'COMPLETED_WORK', 'GIAO_HS'].includes(currentStatus) || r.assignedTo || r.surveyorId) {
            if (r.officeAssignedDate || r.drafterId || currentStatus === RecordStatus.OFFICE_WORK) {
                r.status = RecordStatus.OFFICE_WORK;
            } else {
                r.status = RecordStatus.FIELD_WORK;
            }
        } else {
            r.status = RecordStatus.RECEIVED;
        }
    } else {
        // Module Lưu trữ: Khôi phục lại trạng thái "Đang thực hiện" nếu đã giao việc
        if (['ASSIGNED', 'IN_PROGRESS', 'COMPLETED_WORK', 'GIAO_HS'].includes(currentStatus) || r.assignedTo) {
            r.status = RecordStatus.IN_PROGRESS;
        } else {
            r.status = RecordStatus.RECEIVED;
        }
    }

    // BỔ SUNG DỮ LIỆU ĐỂ TRÁNH BỎ TRỐNG CHO HỒ SƠ ĐO ĐẠC (ĐO ĐẠC THỰC ĐỊA & BIÊN TẬP BẢN ĐỒ)
    if (!isArchive) {
        if (isOfficeOnlySurveyProcedure(r.recordType)) {
            // Thủ tục thuần nội nghiệp (2.1 Trích lục, 2.3 Duyệt đơn & Cung cấp số thửa): Điền vào Biên tập bản đồ
            if (r.assignedTo && !r.drafterId) r.drafterId = r.assignedTo;
            if (r.assignedDate && !r.officeAssignedDate) r.officeAssignedDate = r.assignedDate;
            if (!r.assignedDate && r.officeAssignedDate) r.assignedDate = r.officeAssignedDate;
        } else if (isFieldWorkProcedure(r.recordType)) {
            // Thủ tục đo đạc 2 bước (2.2 Trích đo, 2.4 Cắm mốc, 2.5 Tách - Hợp thửa)
            if (r.assignedTo && !r.surveyorId) r.surveyorId = r.assignedTo;
            if (r.assignedDate && !r.fieldAssignedDate) r.fieldAssignedDate = r.assignedDate;

            const hasPassedInspection = Boolean(
                r.pendingCheckDate || r.checkedDate || r.checkedBy ||
                r.submissionDate || r.submittedTo || r.approvalDate ||
                r.completedDate || r.resultReturnedDate || r.exportBatch ||
                r.status === RecordStatus.PENDING_CHECK ||
                r.status === RecordStatus.PENDING_SIGN ||
                r.status === RecordStatus.SIGNED || r.status === RecordStatus.HANDOVER ||
                r.status === RecordStatus.RETURNED
            );

            if (hasPassedInspection) {
                // Đã qua bước Trình kiểm tra -> Tự động điền đầy đủ cả 2 bước nếu có ngày
                if (!r.drafterId && (r.assignedTo || r.surveyorId)) r.drafterId = r.assignedTo || r.surveyorId;
                if (!r.officeAssignedDate) r.officeAssignedDate = r.fieldCompletedDate || r.assignedDate || r.fieldAssignedDate;
                if (!r.fieldCompletedDate) r.fieldCompletedDate = r.officeAssignedDate || r.assignedDate || r.fieldAssignedDate;
                if (!r.officeCompletedDate) r.officeCompletedDate = r.pendingCheckDate || r.submissionDate || r.approvalDate || r.completedDate || r.assignedDate;
            } else if (r.status === RecordStatus.OFFICE_WORK) {
                // Đang ở bước Biên tập bản đồ
                if (!r.drafterId && r.assignedTo) r.drafterId = r.assignedTo;
                if (!r.officeAssignedDate) r.officeAssignedDate = r.assignedDate || r.fieldCompletedDate;
                if (!r.fieldCompletedDate) r.fieldCompletedDate = r.officeAssignedDate || r.assignedDate;
            }
            // Nếu chưa qua kiểm tra và không ở OFFICE_WORK -> CHỈ điền ĐO ĐẠC THỰC ĐỊA nếu đã giao, tuyệt đối không tự điền Biên tập bản đồ và không tự điền receivedDate
        } else {
            // Các thủ tục chuyên môn khác
            if (r.assignedTo) {
                if (!r.surveyorId) r.surveyorId = r.assignedTo;
                if (r.assignedDate && !r.fieldAssignedDate) r.fieldAssignedDate = r.assignedDate;
            }
        }

        if (!r.assignedDate && (r.fieldAssignedDate || r.officeAssignedDate)) {
            r.assignedDate = r.fieldAssignedDate || r.officeAssignedDate;
        }
        if (!r.assignedTo && (r.surveyorId || r.drafterId)) {
            r.assignedTo = r.surveyorId || r.drafterId;
        }
    }

    return r;
};

export const mapContractToDb = (c: Contract) => ({
    id: c.id,
    code: c.code,
    "customerName": c.customerName,
    "phoneNumber": c.phoneNumber,
    "customerAddress": c.customerAddress,
    ward: c.ward,
    address: c.address,
    "landPlot": c.landPlot,
    "mapSheet": c.mapSheet,
    area: c.area,
    "contractType": c.contractType,
    "serviceType": c.serviceType,
    "areaType": c.areaType,
    "plotCount": c.plotCount,
    "markerCount": c.markerCount,
    "splitItems": c.splitItems,
    quantity: c.quantity,
    "unitPrice": c.unitPrice,
    "vatRate": c.vatRate,
    "vatAmount": c.vatAmount,
    "totalAmount": c.totalAmount,
    deposit: c.deposit,
    content: c.content,
    "createdDate": c.createdDate,
    status: c.status,
    "liquidationArea": c.liquidationArea,
    "liquidationAmount": c.liquidationAmount
});

export const mapContractFromDb = (c: any): Contract => ({
    id: c.id,
    code: c.code,
    customerName: c.customerName || c.customer_name, 
    phoneNumber: c.phoneNumber || c.phone_number,
    customerAddress: c.customerAddress || c.customer_address,
    ward: c.ward,
    address: c.address,
    landPlot: c.landPlot || c.land_plot,
    mapSheet: c.mapSheet || c.map_sheet,
    area: c.area,
    contractType: c.contractType || c.contract_type,
    serviceType: c.serviceType || c.service_type,
    areaType: c.areaType || c.area_type,
    plotCount: c.plotCount || c.plot_count,
    markerCount: c.markerCount || c.marker_count,
    splitItems: c.splitItems || c.split_items,
    quantity: c.quantity,
    unitPrice: c.unitPrice || c.unit_price,
    vatRate: c.vatRate || c.vat_rate,
    vatAmount: c.vatAmount || c.vat_amount,
    totalAmount: c.totalAmount || c.total_amount,
    deposit: c.deposit,
    content: c.content,
    createdDate: c.createdDate || c.created_date,
    status: c.status,
    liquidationArea: c.liquidationArea || c.liquidation_area,
    liquidationAmount: c.liquidationAmount || c.liquidation_amount
});

export const normalizeDepartment = (rawDept: any): string => {
    if (!rawDept) return 'Tổ Đo đạc';
    const str = String(rawDept).normalize('NFC').trim();
    if (!str) return 'Tổ Đo đạc';
    const lower = str.toLowerCase();

    if (lower.includes('giám đốc') || lower.includes('lãnh đạo') || lower.includes('subadmin') || lower.includes('admin')) {
        return 'Ban Giám đốc';
    }
    if (lower.includes('lưu trữ') || lower.includes('thông tin') || lower.includes('archive')) {
        return 'Tổ Lưu trữ';
    }
    if (lower.includes('cấp giấy') || lower.includes('đăng ký') || lower.includes('biến động') || lower.includes('đk&cg')) {
        return 'Tổ Cấp giấy';
    }
    if (lower.includes('hành chính') || lower.includes('một cửa') || lower.includes('quản trị')) {
        return 'Tổ Hành chính';
    }
    if (lower.includes('đo đạc') || lower.includes('đo dạc') || lower.includes('sơ đồ') || lower.includes('surveyor') || lower.includes('trích đo')) {
        return 'Tổ Đo đạc';
    }

    const standardDepts = ['Ban Giám đốc', 'Tổ Lưu trữ', 'Tổ Đo đạc', 'Tổ Cấp giấy', 'Tổ Hành chính'];
    const matched = standardDepts.find(d => d.toLowerCase() === lower);
    if (matched) return matched;

    return 'Tổ Đo đạc';
};

export const normalizePosition = (rawPos: any): string => {
    if (!rawPos) return 'Nhân viên';
    const str = String(rawPos).normalize('NFC').trim();
    if (!str) return 'Nhân viên';
    const lower = str.toLowerCase();

    if (lower.includes('phó giám đốc')) return 'Phó Giám Đốc';
    if (lower.includes('giám đốc')) return 'Giám Đốc';
    if (lower.includes('tổ trưởng') || lower.includes('trưởng tổ')) return 'Tổ Trưởng';
    if (lower.includes('tổ phó') || lower.includes('phó tổ')) return 'Tổ Phó';
    if (lower.includes('viên chức')) return 'Viên chức';
    if (lower.includes('nhân viên') || lower.includes('chuyên viên')) return 'Nhân viên';

    const standardPositions = ['Giám Đốc', 'Phó Giám Đốc', 'Tổ Trưởng', 'Tổ Phó', 'Viên chức', 'Nhân viên'];
    const matched = standardPositions.find(p => p.toLowerCase() === lower);
    if (matched) return matched;

    return 'Nhân viên';
};

export const mapEmployeeToDb = (e: Employee) => {
    const cleanDept = normalizeDepartment(e.department);
    const cleanPos = normalizePosition(e.position);
    const wardsArr = Array.isArray(e.managedWards) ? e.managedWards : [];
    const wardsStr = JSON.stringify(wardsArr);

    return {
        id: e.id,
        name: e.name,
        department: cleanDept,
        position: cleanPos,
        managedWards: wardsStr,
        managed_wards: wardsStr
    };
};

export const mapEmployeeFromDb = (e: any): Employee => {
    if (!e) return { id: '', name: '', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: [] };

    let parsedWards: string[] = [];
    const rawWards = e.managedWards || e.managed_wards || e.managedwards || e.phuong_xa || e.assignedAreas || e.assigned_areas || e.dia_ban;
    if (typeof rawWards === 'string') {
        try {
            parsedWards = JSON.parse(rawWards);
        } catch (err) {
            parsedWards = rawWards.split(',').map((w: string) => w.trim()).filter(Boolean);
        }
    } else if (Array.isArray(rawWards)) {
        parsedWards = rawWards.map((w: any) => String(w).trim()).filter(Boolean);
    }
    
    const rawId = e.id || e.employee_id || e.employeeId || e.ma_nv || e.manv || e.code || '';
    const rawName = e.name || e.ho_ten || e.hoten || e.full_name || e.fullname || e.display_name || e.ten_nhan_vien || e.tennhanvien || e.id || '';
    const rawDept = e.department || e.phong_ban || e.phongban || e.bo_phan || e.bophan || e.team || e.to_chuyen_mon || '';
    const rawPos = e.position || e.chuc_vu || e.chucvu || e.chuc_danh || e.job_title || '';

    const cleanDept = normalizeDepartment(rawDept);
    const cleanPos = normalizePosition(rawPos);

    return {
        id: String(rawId).normalize('NFC').trim(),
        name: String(rawName).normalize('NFC').trim(),
        department: cleanDept,
        position: cleanPos,
        managedWards: parsedWards
    };
};

export const mapUserToDb = (u: User) => ({
    username: u.username,
    password: u.password,
    name: u.name,
    role: u.role,
    employee_id: u.employeeId || null,
    active: u.active !== undefined ? u.active : true
});

export const mapUserFromDb = (u: any): User => {
    if (!u) return { username: '', password: '', name: '', role: 'USER' as any, active: true };
    
    const rawUsername = u.username || u.user_name || u.userName || u.user || u.account || u.ten_dang_nhap || u.tendangnhap || '';
    const rawPassword = u.password !== undefined && u.password !== null ? u.password : 
                        (u.pass !== undefined && u.pass !== null ? u.pass : 
                        (u.pass_word !== undefined && u.pass_word !== null ? u.pass_word : 
                        (u.mat_khau !== undefined && u.mat_khau !== null ? u.mat_khau : 
                        (u.matkhau !== undefined && u.matkhau !== null ? u.matkhau : ''))));
    const rawName = u.name || u.display_name || u.displayName || u.ho_ten || u.hoten || u.full_name || u.fullname || rawUsername || '';
    const rawRole = u.role || u.user_role || u.userRole || u.vai_tro || u.vaitro || 'USER';
    const rawEmpId = u.employeeId || u.employeeid || u.employee_id || u.ma_nv || u.manv || '';
    const rawActive = u.active !== undefined ? Boolean(u.active) :
                      (u.is_active !== undefined ? Boolean(u.is_active) :
                      (u.trang_thai !== undefined ? (String(u.trang_thai) === 'true' || String(u.trang_thai) === '1' || u.trang_thai === true) : true));

    const rawDept = u.department || u.phong_ban || u.phongban || u.team || u.to_chuyen_mon || '';
    const rawPos = u.position || u.chuc_vu || u.chucvu || u.chuc_danh || '';
    let parsedWards: string[] = [];
    const rawWards = u.managedWards || u.managed_wards || u.assignedAreas || u.assigned_areas || u.phuong_xa || u.dia_ban;
    if (typeof rawWards === 'string') {
        try { parsedWards = JSON.parse(rawWards); } catch { parsedWards = rawWards.split(',').map((w: string) => w.trim()).filter(Boolean); }
    } else if (Array.isArray(rawWards)) {
        parsedWards = rawWards.map(w => String(w).trim()).filter(Boolean);
    }

    return {
        id: u.id ? String(u.id) : undefined,
        username: String(rawUsername).normalize('NFC').trim(),
        password: String(rawPassword).normalize('NFC').trim(),
        name: String(rawName).normalize('NFC').trim(),
        role: String(rawRole).trim().toUpperCase() as any,
        employeeId: String(rawEmpId).trim(),
        active: rawActive,
        department: rawDept ? normalizeDepartment(rawDept) : undefined,
        position: rawPos ? normalizePosition(rawPos) : undefined,
        managedWards: parsedWards.length > 0 ? parsedWards : undefined
    };
};

export const mapPriceFromDb = (item: any): PriceItem => ({
    id: item.id || Math.random().toString(36).substr(2, 9),
    serviceGroup: item.serviceGroup || item.service_group || '',
    areaType: item.areaType || item.area_type || '',
    serviceName: item.serviceName || item.service_name || '',
    minArea: item.minArea !== undefined && item.minArea !== null ? Number(item.minArea) : (item.min_area !== undefined && item.min_area !== null ? Number(item.min_area) : 0),
    maxArea: item.maxArea !== undefined && item.maxArea !== null ? Number(item.maxArea) : (item.max_area !== undefined && item.max_area !== null ? Number(item.max_area) : 99999999),
    unit: item.unit || 'Thửa',
    price: item.price !== undefined && item.price !== null ? Number(item.price) : 0,
    vatRate: item.vatRate !== undefined && item.vatRate !== null ? Number(item.vatRate) : (item.vat_rate !== undefined && item.vat_rate !== null ? Number(item.vat_rate) : 8),
    vatIsPercent: item.vatIsPercent !== undefined && item.vatIsPercent !== null ? Boolean(item.vatIsPercent) : (item.vat_is_percent !== undefined && item.vat_is_percent !== null ? Boolean(item.vat_is_percent) : true)
});

export const mapPriceToDb = (item: PriceItem) => {
    const obj: any = {
        serviceGroup: item.serviceGroup || '',
        areaType: item.areaType || '',
        serviceName: item.serviceName || '',
        minArea: item.minArea ?? 0,
        maxArea: item.maxArea ?? 99999999,
        unit: item.unit || 'Thửa',
        price: item.price ?? 0,
        vatRate: item.vatRate ?? 8,
        vatIsPercent: item.vatIsPercent ?? true
    };
    if (item.id && (typeof item.id === 'number' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.id)))) {
        obj.id = item.id;
    }
    return obj;
};

export const mapPriceToDbSnake = (item: PriceItem) => {
    const obj: any = {
        service_group: item.serviceGroup || '',
        area_type: item.areaType || '',
        service_name: item.serviceName || '',
        min_area: item.minArea ?? 0,
        max_area: item.maxArea ?? 99999999,
        unit: item.unit || 'Thửa',
        price: item.price ?? 0,
        vat_rate: item.vatRate ?? 8,
        vat_is_percent: item.vatIsPercent ?? true
    };
    if (item.id && (typeof item.id === 'number' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.id)))) {
        obj.id = item.id;
    }
    return obj;
};
