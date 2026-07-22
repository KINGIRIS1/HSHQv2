
import { supabase, isConfigured } from './supabaseClient';
import { Contract, PriceItem, Employee, User } from '../types';
import { API_BASE_URL } from '../constants'; 

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
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e?.message?.includes('quota')) {
            console.warn(`LocalStorage full when saving ${key}. Attempting to truncate...`);
            if (Array.isArray(data) && data.length > 500) {
                try {
                    const truncated = data.slice(0, 500);
                    localStorage.setItem(key, JSON.stringify(truncated));
                    console.info(`Successfully saved truncated ${key} (500 items) to free space.`);
                } catch (err) {
                    console.warn(`Failed to save even truncated ${key}`, err);
                }
            }
        } else {
            console.warn('LocalStorage full or error:', e);
        }
    }
};

export const getFromCache = <T>(key: string, fallback: T): T => {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            console.log(`[Offline Mode] Loaded data from cache: ${key}`);
            return JSON.parse(cached);
        }
    } catch (e) {
        console.warn('Error reading cache:', e);
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
        console.warn(`⚠️ [Silent Soft Error] ${context}: ${msg} ${code ? `(Code: ${code})` : ''} ${details ? `Details: ${details}` : ''}`);
        return;
    }

    if (typeof msg === 'string' && (msg.includes('<!DOCTYPE html>') || msg.includes('500 Internal Server Error') || msg.includes('<html>'))) {
         console.warn(`⚠️ [Server Error] ${context}: Máy chủ Cloud đang tạm dừng hoặc gặp sự cố (Lỗi 500). Hệ thống sẽ sử dụng dữ liệu Cache/Offline.`);
         return; 
    }

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('configuration') || msg.includes('Load failed')) {
        console.warn(`⚠️ [Offline Mode] ${context}: Không thể kết nối Cloud. Sử dụng dữ liệu Cache/Offline.`);
    } else if (code === '42P01') {
        console.error(`❌ Lỗi tại ${context}: Bảng dữ liệu chưa tồn tại trên Supabase! (Code: 42P01)`);
    } else if (code === '22P02') {
        if (context === 'saveEmployeeApi') {
            console.error(`❌ Lỗi tại ${context}: Cột 'id' trong bảng 'employees' đang là kiểu UUID.`);
            alert(`LỖI CẤU TRÚC DATABASE (Kiểu dữ liệu):\nCột 'id' trong bảng 'employees' đang là kiểu 'uuid' (mặc định), nhưng mã nhân viên là chuỗi (ví dụ: NV001).\n\nVui lòng vào SQL Editor trên Supabase và chạy lệnh sau:\n\nALTER TABLE employees ALTER COLUMN id TYPE text USING id::text;`);
        } else {
            console.error(`❌ Lỗi tại ${context}: Sai định dạng dữ liệu (Lỗi 22P02). Kiểm tra các trường Số hoặc Ngày tháng.`);
            alert(`LỖI DỮ LIỆU: Có trường dữ liệu không đúng định dạng (Ví dụ: Diện tích phải là số).\nHệ thống đã cố gắng tự sửa nhưng vẫn thất bại.`);
        }
    } else if (code === 'PGRST204' || code === '42703' || msg.includes('column') || details.includes('column') || msg.includes('does not exist')) {
         console.error(`❌ Lỗi tại ${context}: Cột không tồn tại (Lỗi ${code}). Details: ${details || msg}`);
         // Cập nhật thông báo lỗi hướng dẫn cụ thể SQL
         alert(`LỖI CẤU TRÚC DATABASE (Thiếu cột):\nDatabase trên Cloud đang thiếu cột.\nChi tiết lỗi: ${details || msg}\n\nVui lòng vào SQL Editor trên Supabase và chạy lệnh sau để thêm TẤT CẢ các cột có thể thiếu:\n\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "customerAddress" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "entryNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "issueDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "residentialArea" numeric;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "needsMapCorrection" boolean;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiptNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "resultReturnedDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receiverName" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "reminderDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "lastRemindedAt" timestamp;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "measurementNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "excerptNumber" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportBatch" numeric;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "exportDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "handoverWard" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authorizedBy" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "authDocType" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "otherDocs" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "privateNotes" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "personalNotes" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submittedTo" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedBy" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "submissionDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "approvalDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "assignedTo" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "receivedBy" text;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "completedWorkDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "pendingCheckDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "checkedDate" date;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "price" numeric;\nALTER TABLE land_records ADD COLUMN IF NOT EXISTS "advancePayment" numeric;`);
    } else if (code === '406') {
         console.warn(`⚠️ [Info] ${context}: Không tìm thấy dữ liệu (406).`);
    } else if (code === '22007' || code === '22008') {
         console.error(`❌ Lỗi tại ${context}: Dữ liệu ngày tháng không hợp lệ (Lỗi ${code}).`);
         alert(`LỖI DỮ LIỆU: Dữ liệu chứa ngày tháng không hợp lệ hoặc sai định dạng (Ví dụ: 30/02).\nHệ thống đã cố gắng xử lý nhưng Server từ chối.`);
    } else if (code === '21000') {
         console.error(`❌ Lỗi tại ${context}: Dữ liệu trùng lặp trong cùng một yêu cầu (Lỗi ${code}).`);
         alert(`LỖI TRÙNG LẶP: File Excel có chứa nhiều dòng cùng Mã Hồ Sơ. Hệ thống đã cố gắng xử lý nhưng Server từ chối.\nVui lòng kiểm tra file Excel và xóa các dòng trùng lặp mã.`);
    } else if (code === '42501') {
         console.error(`❌ Lỗi tại ${context}: Lỗi phân quyền bảo mật RLS (Code: 42501)`);
         alert(`LỖI PHÂN QUYỀN (Row-Level Security): \nSupabase đang từ chối LƯU HOẶC SỬA dữ liệu do bạn đang bật tính năng bảo mật Row-Level Security (RLS) trên bảng dữ liệu nhưng chưa cấu hình Policy.\n\nHƯỚNG DẪN SỬA LỖI:\n1. Mở trang Quản lý Supabase của bạn\n2. Chọn phần "SQL Editor"\n3. Copy và chạy tập lệnh sau để cho phép truy cập:\n\nALTER TABLE land_records DISABLE ROW LEVEL SECURITY;\nALTER TABLE archive_records DISABLE ROW LEVEL SECURITY;\nALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;`);
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

export const sanitizeData = (data: any, allowedColumns: string[]) => {
    const clean: any = { ...data };
    const numberFields = [
        'area', 'exportBatch', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount', 
        'deposit', 'quantity', 'excerptNumber', 'plotCount', 'markerCount', 
        'minArea', 'maxArea', 'price',
        'liquidationArea', 'liquidationAmount', 'residentialArea'
    ];
    numberFields.forEach(field => {
        if (clean[field] === '' || clean[field] === undefined || (typeof clean[field] === 'number' && isNaN(clean[field]))) {
            clean[field] = null;
        }
    });
    
    // CẬP NHẬT: Thêm đầy đủ các trường ngày tháng để tránh lỗi 22007
    const dateFields = [
        'receivedDate', 'deadline', 'assignedDate', 
        'submissionDate', 'approvalDate', 'completedDate', 
        'createdDate', 'exportDate',
        'resultReturnedDate', 'reminderDate', 'lastRemindedAt', 'issueDate',
        'pendingCheckDate', 'checkedDate', 'completedWorkDate'
    ];
    
    dateFields.forEach(field => {
        // Chuyển chuỗi rỗng, undefined, hoặc chuỗi không hợp lệ thành NULL
        if (clean[field] === '' || clean[field] === undefined || clean[field] === null) {
            clean[field] = null;
        }
    });
    
    const sanitized: any = {};
    allowedColumns.forEach(col => {
        if (clean.hasOwnProperty(col)) {
            sanitized[col] = clean[col];
        }
    });
    return sanitized;
};

// --- MAPPERS ---
export const mapRecordFromDb = (item: any): any => {
    if (!item) return item;
    const r = { ...item };
    
    // Normalization mapping from potential snake_case or lowercase
    if (r.receivedDate === undefined && (r.receiveddate !== undefined || r.received_date !== undefined)) r.receivedDate = r.receiveddate || r.received_date;
    if (r.customerName === undefined && (r.customername !== undefined || r.customer_name !== undefined)) r.customerName = r.customername || r.customer_name;
    if (r.phoneNumber === undefined && (r.phonenumber !== undefined || r.phone_number !== undefined)) r.phoneNumber = r.phonenumber || r.phone_number;
    if (r.customerAddress === undefined && (r.customeraddress !== undefined || r.customer_address !== undefined)) r.customerAddress = r.customeraddress || r.customer_address;
    if (r.landPlot === undefined && (r.landplot !== undefined || r.land_plot !== undefined)) r.landPlot = r.landplot || r.land_plot;
    if (r.mapSheet === undefined && (r.mapsheet !== undefined || r.map_sheet !== undefined)) r.mapSheet = r.mapsheet || r.map_sheet;
    if (r.issueNumber === undefined && (r.issuenumber !== undefined || r.issue_number !== undefined)) r.issueNumber = r.issuenumber || r.issue_number;
    if (r.entryNumber === undefined && (r.entrynumber !== undefined || r.entry_number !== undefined)) r.entryNumber = r.entrynumber || r.entry_number;
    if (r.issueDate === undefined && (r.issuedate !== undefined || r.issue_date !== undefined)) r.issueDate = r.issuedate || r.issue_date;
    if (r.residentialArea === undefined && (r.residentialarea !== undefined || r.residential_area !== undefined)) r.residentialArea = r.residentialarea || r.residential_area;
    if (r.needsMapCorrection === undefined && (r.needsmapcorrection !== undefined || r.needs_map_correction !== undefined)) r.needsMapCorrection = r.needsmapcorrection || r.needs_map_correction;
    if (r.explanationPlan === undefined && (r.explanationplan !== undefined || r.explanation_plan !== undefined)) r.explanationPlan = r.explanationplan || r.explanation_plan;
    if (r.receiptNumber === undefined && (r.receiptnumber !== undefined || r.receipt_number !== undefined)) r.receiptNumber = r.receiptnumber || r.receipt_number;
    if (r.recordType === undefined && (r.recordtype !== undefined || r.record_type !== undefined)) r.recordType = r.recordtype || r.record_type;
    
    if (r.receivedBy === undefined && (r.receivedby !== undefined || r.received_by !== undefined)) r.receivedBy = r.receivedby || r.received_by;
    if (r.assignedDate === undefined && (r.assigneddate !== undefined || r.assigned_date !== undefined)) r.assignedDate = r.assigneddate || r.assigned_date;
    if (r.assignedTo === undefined && (r.assignedto !== undefined || r.assigned_to !== undefined)) r.assignedTo = r.assignedto || r.assigned_to;
    
    if (r.submissionDate === undefined && (r.submissiondate !== undefined || r.submission_date !== undefined)) r.submissionDate = r.submissiondate || r.submission_date;
    if (r.submittedTo === undefined && (r.submittedto !== undefined || r.submitted_to !== undefined)) r.submittedTo = r.submittedto || r.submitted_to;
    
    if (r.pendingCheckDate === undefined && (r.pendingcheckdate !== undefined || r.pending_check_date !== undefined)) r.pendingCheckDate = r.pendingcheckdate || r.pending_check_date;
    if (r.checkedBy === undefined && (r.checkedby !== undefined || r.checked_by !== undefined)) r.checkedBy = r.checkedby || r.checked_by;
    if (r.checkedDate === undefined && (r.checkeddate !== undefined || r.checked_date !== undefined)) r.checkedDate = r.checkeddate || r.checked_date;
    
    if (r.completedWorkDate === undefined && (r.completedworkdate !== undefined || r.completed_work_date !== undefined)) r.completedWorkDate = r.completedworkdate || r.completed_work_date;
    if (r.approvalDate === undefined && (r.approvaldate !== undefined || r.approval_date !== undefined)) r.approvalDate = r.approvaldate || r.approval_date;
    if (r.completedDate === undefined && (r.completeddate !== undefined || r.completed_date !== undefined)) r.completedDate = r.completeddate || r.completed_date;
    
    if (r.authorizedBy === undefined && (r.authorizedby !== undefined || r.authorized_by !== undefined)) r.authorizedBy = r.authorizedby || r.authorized_by;
    if (r.authDocType === undefined && (r.authdoctype !== undefined || r.auth_doc_type !== undefined)) r.authDocType = r.authdoctype || r.auth_doc_type;
    if (r.otherDocs === undefined && (r.otherdocs !== undefined || r.other_docs !== undefined)) r.otherDocs = r.otherdocs || r.other_docs;
    
    if (r.resultReturnedDate === undefined && (r.resultreturneddate !== undefined || r.result_returned_date !== undefined)) r.resultReturnedDate = r.resultreturneddate || r.result_returned_date;
    
    if (r.exportBatch === undefined && (r.exportbatch !== undefined || r.export_batch !== undefined)) r.exportBatch = r.exportbatch || r.export_batch;
    if (r.exportDate === undefined && (r.exportdate !== undefined || r.export_date !== undefined)) r.exportDate = r.exportdate || r.export_date;
    if (r.handoverWard === undefined && (r.handoverward !== undefined || r.handover_ward !== undefined)) r.handoverWard = r.handoverward || r.handover_ward;
    
    if (r.measurementNumber === undefined && (r.measurementnumber !== undefined || r.measurement_number !== undefined)) r.measurementNumber = r.measurementnumber || r.measurement_number;
    if (r.excerptNumber === undefined && (r.excerptnumber !== undefined || r.excerpt_number !== undefined)) r.excerptNumber = r.excerptnumber || r.excerpt_number;
    
    if (r.reminderDate === undefined && (r.reminderdate !== undefined || r.reminder_date !== undefined)) r.reminderDate = r.reminderdate || r.reminder_date;
    if (r.lastRemindedAt === undefined && (r.lastremindedat !== undefined || r.last_reminded_at !== undefined)) r.lastRemindedAt = r.lastremindedat || r.last_reminded_at;
    if (r.deadlineReminded === undefined && (r.deadlinereminded !== undefined || r.deadline_reminded !== undefined)) r.deadlineReminded = r.deadlinereminded !== undefined ? r.deadlinereminded : r.deadline_reminded;
    
    if (r.privateNotes === undefined && (r.privatenotes !== undefined || r.private_notes !== undefined)) r.privateNotes = r.privatenotes || r.private_notes;
    if (r.personalNotes === undefined && (r.personalnotes !== undefined || r.personal_notes !== undefined)) r.personalNotes = r.personalnotes || r.personal_notes;
    if (r.isHandedOver === undefined && (r.ishandedover !== undefined || r.is_handed_over !== undefined)) r.isHandedOver = r.ishandedover !== undefined ? r.ishandedover : r.is_handed_over;
    
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

export const mapEmployeeToDb = (e: Employee) => ({
    id: e.id,
    name: e.name,
    department: e.department,
    position: e.position,
    "managedWards": Array.isArray(e.managedWards) ? JSON.stringify(e.managedWards) : e.managedWards
});

export const mapEmployeeFromDb = (e: any): Employee => {
    let parsedWards = [];
    if (typeof e.managedWards === 'string') {
        try {
            parsedWards = JSON.parse(e.managedWards);
        } catch (err) {
            parsedWards = e.managedWards.split(',').map((w: string) => w.trim()).filter(Boolean);
        }
    } else if (typeof e.managed_wards === 'string') {
        try {
            parsedWards = JSON.parse(e.managed_wards);
        } catch (err) {
            parsedWards = e.managed_wards.split(',').map((w: string) => w.trim()).filter(Boolean);
        }
    } else if (Array.isArray(e.managedWards)) {
        parsedWards = e.managedWards;
    } else if (Array.isArray(e.managed_wards)) {
        parsedWards = e.managed_wards;
    }
    
    return {
        id: e.id,
        name: e.name,
        department: e.department,
        position: e.position,
        managedWards: parsedWards
    };
};

export const mapUserToDb = (u: User) => ({
    username: u.username,
    password: u.password,
    name: u.name,
    role: u.role,
    "employeeId": u.employeeId
});

export const mapUserFromDb = (u: any): User => ({
    username: u.username,
    password: u.password,
    name: u.name,
    role: u.role,
    employeeId: u.employeeId || u.employeeid
});

export const mapPriceFromDb = (item: any): PriceItem => ({
    id: item.id,
    serviceGroup: item.serviceGroup || item.service_group,
    areaType: item.areaType || item.area_type,
    serviceName: item.serviceName || item.service_name,
    minArea: item.minArea !== undefined ? item.minArea : item.min_area,
    maxArea: item.maxArea !== undefined ? item.maxArea : item.max_area,
    unit: item.unit,
    price: item.price,
    vatRate: item.vatRate !== undefined ? item.vatRate : item.vat_rate,
    vatIsPercent: item.vatIsPercent !== undefined ? item.vatIsPercent : item.vat_is_percent
});

export const mapPriceToDb = (item: PriceItem) => ({
    id: item.id,
    "serviceGroup": item.serviceGroup,
    "areaType": item.areaType,
    "serviceName": item.serviceName,
    "minArea": item.minArea,
    "maxArea": item.maxArea,
    unit: item.unit,
    price: item.price,
    "vatRate": item.vatRate,
    "vatIsPercent": item.vatIsPercent
});
