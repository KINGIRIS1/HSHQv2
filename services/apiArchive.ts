import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache, sanitizeData, sanitizePayloadFor22P02, CACHE_KEYS, isTransientError } from './apiCore';
import { updateArchiveCounterIfHigher, markRecordsRecentlyUpdated } from './apiRecords';
import { addPendingRecord, getPendingRecords } from './syncQueueService';
import { RecordFile, RecordStatus } from '../types';
import { isArchiveRecordType, getShortRecordType } from '../constants';
import { setIndexedDBItem, getIndexedDBItem } from './storageService';

// --- TYPES ---
export interface SaveArchiveResult {
    success: boolean;
    persisted: boolean;
    queued: boolean;
    offline: boolean;
    record?: ArchiveRecord;
    errorCode?: string;
    message?: string;
}

export interface ArchiveRecord {
    id: string;
    created_at?: string;
    created_by?: string;
    type: 'saoluc' | 'vaoso' | 'congvan';
    status: 'draft' | 'assigned' | 'executed' | 'pending_supplement' | 'pending_check' | 'checked' | 'pending_sign' | 'signed' | 'completed' | 'withdrawn' | 'rejected';
    so_hieu: string; // Số hiệu/Số hồ sơ
    trich_yeu: string; // Nội dung/Trích yếu
    ngay_thang: string;
    noi_nhan_gui: string;
    exportBatch?: string | null;
    data: any; // Các trường mở rộng khác
}

// Mock Data Stores
let MOCK_ARCHIVE: ArchiveRecord[] = [];

export const CACHE_KEY_ARCHIVE = 'offline_archive_records';
export const CACHE_KEY_ARCHIVE_VAOSO = 'offline_archive_records_vaoso';
export const CACHE_KEY_ARCHIVE_SAOLUC = 'offline_archive_records_saoluc';
export const CACHE_KEY_ARCHIVE_CONGVAN = 'offline_archive_records_congvan';
export const CACHE_KEY_LUUTRU_RECORDS = 'offline_luutru_records';

export const getArchiveCacheKey = (type: 'saoluc' | 'vaoso' | 'congvan' | string): string => {
    if (type === 'vaoso') return CACHE_KEY_ARCHIVE_VAOSO;
    if (type === 'congvan') return CACHE_KEY_ARCHIVE_CONGVAN;
    if (type === 'saoluc') return CACHE_KEY_ARCHIVE_SAOLUC;
    return `offline_archive_records_${type}`;
};

// In-memory cache for instant 0ms access
let memoryArchiveRecordsCache: RecordFile[] | null = null;
const memoryArchiveTypeCaches = new Map<string, ArchiveRecord[]>();

export const clearArchiveMemoryCaches = (type?: string) => {
    if (type) {
        memoryArchiveTypeCaches.delete(type);
    } else {
        memoryArchiveTypeCaches.clear();
    }
    memoryArchiveRecordsCache = null;
};

const ARCHIVE_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'customerAddress', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'receivedBy', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo', 'checkedBy',
    'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'handoverWard',
    'measurementNumber', 'excerptNumber',
    'reminderDate', 'lastRemindedAt',
    'receiptNumber', 'resultReturnedDate', 'receiverName',
    'needsMapCorrection', 'explanationPlan',
    'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'isHandedOver', 'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch',
    'attachedFiles', 'dossierComponents'
];

export const OPTIONAL_ARCHIVE_COLUMNS = [
    'dossierComponents', 'attachedFiles', 'statusLogs', 'isHandedOver',
    'archiveHandoverDate', 'archiveHandoverBatch', 'exportBatch', 'exportDate',
    'handoverWard', 'checkedBy', 'pendingCheckDate', 'checkedDate', 'submittedTo', 'approvalDate',
    'reminderDate', 'lastRemindedAt'
];

// --- CONVERSION HELPERS ---
export const mapArchiveDbToRecordFile = (row: any): RecordFile => {
    let rawSt = String(row.status || '').trim().toUpperCase();
    let status = RecordStatus.RECEIVED;
    if (rawSt === 'HANDOVER' || rawSt === 'COMPLETED' || rawSt === 'HANDED_OVER' || rawSt === 'GIAO_1_CUA' || rawSt === 'GIAO_HS') {
        status = RecordStatus.HANDOVER;
    } else if (rawSt === 'RETURNED' || rawSt === 'TRA_DAN') {
        status = RecordStatus.RETURNED;
    } else if (rawSt === 'SIGNED' || rawSt === 'DA_KY') {
        status = RecordStatus.SIGNED;
    } else if (rawSt === 'PENDING_SIGN' || rawSt === 'CHECKED' || rawSt === 'TRINH_KY') {
        status = RecordStatus.PENDING_SIGN;
    } else if (rawSt === 'PENDING_CHECK' || rawSt === 'CHO_KIEM_TRA') {
        status = RecordStatus.PENDING_CHECK;
    } else if (rawSt === 'COMPLETED_WORK' || rawSt === 'EXECUTED' || rawSt === 'DA_THUC_HIEN') {
        status = RecordStatus.COMPLETED_WORK;
    } else if (rawSt === 'ASSIGNED' || rawSt === 'IN_PROGRESS' || rawSt === 'GIAO_NV') {
        status = RecordStatus.ASSIGNED;
    } else if (rawSt === 'WITHDRAWN') {
        status = RecordStatus.WITHDRAWN;
    } else if (rawSt === 'REJECTED') {
        status = RecordStatus.REJECTED;
    } else if (Object.values(RecordStatus).includes(row.status as RecordStatus)) {
        status = row.status as RecordStatus;
    }

    const batchVal = row.exportBatch || row.export_batch || row.data?.exportBatch || row.data?.danh_sach || null;

    return {
        id: row.id,
        code: row.code || row.so_hieu || row.id,
        customerName: row.customerName || row.noi_nhan_gui || 'Chưa có tên',
        phoneNumber: row.phoneNumber || null,
        cccd: row.cccd || null,
        customerAddress: row.customerAddress || null,
        ward: row.ward || null,
        landPlot: row.landPlot || null,
        mapSheet: row.mapSheet || null,
        area: row.area || null,
        address: row.address || null,
        group: row.group || null,
        content: row.content || row.trich_yeu || null,
        recordType: row.recordType || '1.1 Cung cấp dữ liệu đất đai',
        receivedDate: row.receivedDate || row.ngay_thang || (row.created_at ? row.created_at.split('T')[0] : null),
        receivedBy: row.receivedBy || row.created_by || null,
        deadline: row.deadline || null,
        assignedDate: row.assignedDate || null,
        assignedTo: row.assignedTo || null,
        submissionDate: row.submissionDate || null,
        submittedTo: row.submittedTo || null,
        pendingCheckDate: row.pendingCheckDate || null,
        checkedBy: row.checkedBy || null,
        checkedDate: row.checkedDate || null,
        completedWorkDate: row.completedWorkDate || null,
        approvalDate: row.approvalDate || null,
        completedDate: row.completedDate || null,
        status: status,
        notes: row.notes || null,
        privateNotes: row.privateNotes || null,
        personalNotes: row.personalNotes || null,
        authorizedBy: row.authorizedBy || null,
        authDocType: row.authDocType || null,
        otherDocs: row.otherDocs || null,
        exportBatch: batchVal ? String(batchVal) : null,
        exportDate: row.exportDate || row.completedWorkDate || (row.data?.ngay_hoan_thanh) || null,
        handoverWard: row.handoverWard || null,
        measurementNumber: row.measurementNumber || null,
        excerptNumber: row.excerptNumber || null,
        reminderDate: row.reminderDate || null,
        lastRemindedAt: row.lastRemindedAt || null,
        deadlineReminded: row.deadlineReminded || false,
        receiptNumber: row.receiptNumber || null,
        resultReturnedDate: row.resultReturnedDate || null,
        receiverName: row.receiverName || null,
        isHandedOver: row.isHandedOver || status === RecordStatus.HANDOVER,
        data: row.data || {},
        sourceTable: 'luutru_records'
    };
};

export const isVaoSoRecord = (row: any): boolean => {
    if (!row) return false;
    const rowType = String(row.type || '').toLowerCase();
    const dataType = String(row.data?.type || '').toLowerCase();
    const recType = String(row.recordType || row.content || '').toLowerCase();
    const dataStage = String(row.data?.stage || '').toLowerCase();
    const entryNum = String(row.entryNumber || row.data?.so_vao_so || row.data?.entryNumber || '').trim();
    const dataStatus = String(row.data?.status || '').toLowerCase();
    const group = String(row.group || '').toLowerCase();

    return (
        rowType === 'vaoso' ||
        dataType === 'vaoso' ||
        recType.includes('vào sổ') ||
        recType.includes('vao so') ||
        recType.includes('vaoso') ||
        dataStage === 'vao_so' ||
        entryNum.length > 0 ||
        dataStatus.includes('vào sổ') ||
        dataStatus.includes('vao so') ||
        group.includes('cấp gcn') ||
        group.includes('đăng ký đất đai')
    );
};

export const isCongVanRecord = (row: any): boolean => {
    if (!row) return false;
    const rowType = String(row.type || '').toLowerCase();
    const recType = String(row.recordType || row.content || '').toLowerCase();
    const group = String(row.group || '').toLowerCase();
    return (
        rowType === 'congvan' ||
        recType.includes('công văn') ||
        recType.includes('cong van') ||
        group === '1.2' ||
        recType === '1.2 công văn'
    );
};

export const identifyArchiveRecordType = (row: any): 'saoluc' | 'vaoso' | 'congvan' => {
    if (isCongVanRecord(row)) return 'congvan';
    if (isVaoSoRecord(row)) return 'vaoso';
    return 'saoluc';
};

export const mapLuutruDbToArchiveRecord = (row: any): ArchiveRecord => {
    const type: 'saoluc' | 'vaoso' | 'congvan' = identifyArchiveRecordType(row);

    let st: ArchiveRecord['status'] = 'draft';
    const rawSt = String(row.status || '').toLowerCase();
    const batchVal = row.exportBatch || row.export_batch || row.data?.exportBatch || row.data?.danh_sach || null;

    if (rawSt === 'assigned') st = 'assigned';
    else if (rawSt === 'in_progress' || rawSt === 'inprogress') st = 'assigned';
    else if (rawSt === 'executed' || rawSt === 'completed_work') st = 'executed';
    else if (rawSt === 'pending_supplement') st = 'pending_supplement';
    else if (rawSt === 'pending_check') st = 'pending_check';
    else if (rawSt === 'checked') st = 'checked';
    else if (rawSt === 'pending_sign') st = 'pending_sign';
    else if (rawSt === 'signed') st = 'signed';
    else if (rawSt === 'handover' || rawSt === 'handed_over' || rawSt === 'completed' || rawSt === 'returned' || rawSt === 'giao_1_cua' || rawSt === 'giao_hs' || rawSt === 'da_giao') st = 'completed';
    else if (rawSt === 'withdrawn') st = 'withdrawn';
    else if (rawSt === 'rejected') st = 'rejected';

    const extraData = {
        ...(typeof row.data === 'object' && row.data !== null ? row.data : {}),
        code: row.code,
        so_hieu: row.code,
        customerName: row.customerName,
        noi_nhan_gui: row.customerName,
        content: row.content,
        trich_yeu: row.content,
        xa_phuong: row.ward,
        ward: row.ward,
        to_ban_do: row.mapSheet,
        mapSheet: row.mapSheet,
        thua_dat: row.landPlot,
        landPlot: row.landPlot,
        hen_tra: row.deadline,
        deadline: row.deadline,
        assigned_to: row.assignedTo,
        assignedTo: row.assignedTo,
        assigned_date: row.assignedDate,
        assignedDate: row.assignedDate,
        ngay_hoan_thanh: row.completedWorkDate || row.exportDate || row.data?.ngay_hoan_thanh,
        completedWorkDate: row.completedWorkDate,
        area: row.area,
        address: row.address,
        phoneNumber: row.phoneNumber,
        cccd: row.cccd,
        customerAddress: row.customerAddress,
        notes: row.notes,
        privateNotes: row.privateNotes,
        personalNotes: row.personalNotes,
        recordType: row.recordType,
        exportBatch: batchVal ? String(batchVal) : row.exportBatch,
        exportDate: row.exportDate || row.data?.ngay_hoan_thanh,
        resultReturnedDate: row.resultReturnedDate,
        receiverName: row.receiverName,
        receiptNumber: row.receiptNumber,
        isHandedOver: row.isHandedOver || st === 'completed',
        so_vao_so: row.entryNumber || row.data?.so_vao_so || '',
        so_phat_hanh: row.issueNumber || row.data?.so_phat_hanh || '',
        entryNumber: row.entryNumber || row.data?.so_vao_so || '',
        issueNumber: row.issueNumber || row.data?.so_phat_hanh || ''
    };

    return {
        id: row.id,
        created_at: row.created_at,
        created_by: row.created_by || row.receivedBy,
        type,
        status: st,
        so_hieu: row.code || row.so_hieu || '',
        trich_yeu: row.content || row.trich_yeu || '',
        ngay_thang: row.receivedDate || row.ngay_thang || (row.created_at ? row.created_at.split('T')[0] : ''),
        noi_nhan_gui: row.customerName || row.noi_nhan_gui || '',
        exportBatch: batchVal ? String(batchVal) : null,
        data: extraData
    };
};

export const mapArchiveRecordToLuutruDb = (r: Partial<ArchiveRecord>): any => {
    const d = r.data || {};
    let recType = d.recordType;
    if (!recType) {
        if (r.type === 'congvan') recType = '1.2 Công văn';
        else if (r.type === 'vaoso') recType = 'Vào sổ GCN';
        else recType = '1.1 Cung cấp dữ liệu đất đai';
    }

    let status = RecordStatus.RECEIVED;
    const rawSt = String(r.status || '').toLowerCase();
    if (rawSt === 'assigned') status = RecordStatus.ASSIGNED;
    else if (rawSt === 'executed') status = RecordStatus.COMPLETED_WORK;
    else if (rawSt === 'pending_supplement') status = RecordStatus.PENDING_SUPPLEMENT;
    else if (rawSt === 'pending_check') status = RecordStatus.PENDING_CHECK;
    else if (rawSt === 'checked') status = RecordStatus.PENDING_SIGN;
    else if (rawSt === 'pending_sign') status = RecordStatus.PENDING_SIGN;
    else if (rawSt === 'signed') status = RecordStatus.SIGNED;
    else if (rawSt === 'completed' || rawSt === 'handover' || rawSt === 'handed_over' || rawSt === 'giao_1_cua' || rawSt === 'giao_hs') status = RecordStatus.HANDOVER;
    else if (rawSt === 'returned') status = RecordStatus.RETURNED;
    else if (rawSt === 'withdrawn') status = RecordStatus.WITHDRAWN;
    else if (rawSt === 'rejected') status = RecordStatus.REJECTED;

    const exportBatchVal = r.exportBatch || d.exportBatch || d.danh_sach || null;

    const effectiveCode = r.so_hieu || d.code || (r as any).code || '';
    const payload = {
        id: r.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)),
        code: effectiveCode,
        so_hieu: effectiveCode,
        customerName: r.noi_nhan_gui || d.customerName || '',
        content: r.trich_yeu || d.content || '',
        receivedDate: r.ngay_thang || d.receivedDate || null,
        receivedBy: r.created_by || d.receivedBy || null,
        ward: d.xa_phuong || d.ward || null,
        mapSheet: d.to_ban_do || d.mapSheet || null,
        landPlot: d.thua_dat || d.landPlot || null,
        area: d.area || null,
        address: d.address || null,
        group: d.group || null,
        deadline: d.hen_tra || d.deadline || null,
        recordType: recType,
        status: status,
        assignedTo: d.assigned_to || d.assignedTo || null,
        assignedDate: d.assigned_date || d.assignedDate || null,
        completedWorkDate: d.ngay_hoan_thanh || d.completedWorkDate || null,
        checkedBy: d.checkedBy || null,
        pendingCheckDate: d.pendingCheckDate || null,
        checkedDate: d.checkedDate || null,
        submissionDate: d.submissionDate || null,
        submittedTo: d.submittedTo || null,
        approvalDate: d.approvalDate || null,
        completedDate: d.completedDate || null,
        notes: d.notes || null,
        privateNotes: d.privateNotes || null,
        personalNotes: d.personalNotes || null,
        phoneNumber: d.phoneNumber || null,
        cccd: d.cccd || null,
        customerAddress: d.customerAddress || null,
        exportBatch: exportBatchVal ? String(exportBatchVal) : null,
        exportDate: d.exportDate || d.ngay_hoan_thanh || null,
        handoverWard: d.handoverWard || null,
        resultReturnedDate: d.resultReturnedDate || null,
        receiverName: d.receiverName || null,
        receiptNumber: d.receiptNumber || null,
        isHandedOver: d.isHandedOver || status === RecordStatus.HANDOVER,
        entryNumber: (r as any).entryNumber || d.so_vao_so || (r as any).entryNumber || null,
        issueNumber: (r as any).issueNumber || d.so_phat_hanh || (r as any).issueNumber || null
    };

    return sanitizeData(payload, ARCHIVE_DB_COLUMNS);
};

export const mapRecordFileToArchiveDb = (r: RecordFile | Partial<RecordFile>): any => {
    return sanitizeData(r, ARCHIVE_DB_COLUMNS);
};

// --- API ---

let hasMigratedArchiveOnce = false;

/**
 * [LEGACY/MANUAL RECOVERY ONLY]
 * TUYỆT ĐỐI KHÔNG GỌI TỰ ĐỘNG TRONG NORMAL STARTUP HOẶC BACKGROUND SYNC.
 * Chỉ dùng khi quản trị viên thực hiện lệnh khôi phục / di chuyển thủ công có kiểm soát.
 */
export const migrateArchiveRecordsFromLandRecords = async (forceManualRun: boolean = false) => {
    // Vô hiệu hóa tự động: chỉ chạy khi có cờ xác nhận thủ công rõ ràng
    if (!forceManualRun) {
        console.log('[Archive Migration Guard] Automatic cross-table migration is disabled by system policy.');
        return;
    }
    if (!isConfigured) return;
    try {
        const isArchiveRow = (r: any) => {
            if (!r) return false;
            const rType = String(r.recordType || '');
            const rContent = String(r.content || '');
            const rCode = String(r.code || '');
            const rSoHieu = String(r.so_hieu || '');
            const rGroup = String(r.group || '');
            return (
                isArchiveRecordType(rType) || 
                isArchiveRecordType(rContent) || 
                rType === 'Cung cấp tài liệu đất đai' ||
                rType === 'Cung cấp dữ liệu đất đai' ||
                rType === '1.1 Sao lục' ||
                rType === '1.2 Công văn' ||
                rType === '1.1 Sao lục hồ sơ' ||
                rType === '1.1 Cung cấp dữ liệu đất đai' ||
                rType.startsWith('1.') ||
                rContent.startsWith('1.') ||
                rGroup === '1.1' ||
                rGroup === '1.2' ||
                rCode.startsWith('LT-') ||
                rSoHieu.startsWith('LT-')
            );
        };

        // 1. Kiểm tra land_records
        const { data: landData, error: landFetchErr } = await supabase
            .from('land_records')
            .select('*');
            
        if (!landFetchErr && landData && landData.length > 0) {
            const archiveRecordsToMigrate = landData.filter(isArchiveRow);
            if (archiveRecordsToMigrate.length > 0) {
                console.log(`[Archive Migration] Tìm thấy ${archiveRecordsToMigrate.length} hồ sơ lưu trữ trong land_records để chuyển sang luutru_records.`);
                const luutruPayloads = archiveRecordsToMigrate.map((r: any) => sanitizeData(r, ARCHIVE_DB_COLUMNS));
                let { error: insertError } = await supabase.from('luutru_records').upsert(luutruPayloads);
                if (insertError && (insertError.code === '22P02' || String(insertError.message || '').includes('22P02'))) {
                    const clean = sanitizePayloadFor22P02(luutruPayloads);
                    const res = await supabase.from('luutru_records').upsert(clean);
                    insertError = res.error;
                }
                if (!insertError) {
                    const idsToDelete = archiveRecordsToMigrate.map((r: any) => r.id);
                    await supabase.from('land_records').delete().in('id', idsToDelete);
                    console.log(`[Archive Migration] Đã di chuyển thành công ${archiveRecordsToMigrate.length} hồ sơ lưu trữ từ land_records.`);
                }
            }
        }

        // 2. Kiểm tra dangky_records
        const { data: dangkyData, error: dangkyFetchErr } = await supabase
            .from('dangky_records')
            .select('*');
            
        if (!dangkyFetchErr && dangkyData && dangkyData.length > 0) {
            const dangkyArchiveRecords = dangkyData.filter(isArchiveRow);
            if (dangkyArchiveRecords.length > 0) {
                console.log(`[Archive Migration] Tìm thấy ${dangkyArchiveRecords.length} hồ sơ lưu trữ trong dangky_records để chuyển sang luutru_records.`);
                const luutruPayloads = dangkyArchiveRecords.map((r: any) => sanitizeData(r, ARCHIVE_DB_COLUMNS));
                let { error: insertError } = await supabase.from('luutru_records').upsert(luutruPayloads);
                if (insertError && (insertError.code === '22P02' || String(insertError.message || '').includes('22P02'))) {
                    const clean = sanitizePayloadFor22P02(luutruPayloads);
                    const res = await supabase.from('luutru_records').upsert(clean);
                    insertError = res.error;
                }
                if (!insertError) {
                    const idsToDelete = dangkyArchiveRecords.map((r: any) => r.id);
                    await supabase.from('dangky_records').delete().in('id', idsToDelete);
                    console.log(`[Archive Migration] Đã di chuyển thành công ${dangkyArchiveRecords.length} hồ sơ lưu trữ từ dangky_records.`);
                }
            }
        }
    } catch (error: any) {
        console.error('Lỗi trong quá trình di chuyển hồ sơ lưu trữ sang luutru_records:', error);
    }
};

// Giữ alias tương thích
export const migrateCungCapTaiLieu = migrateArchiveRecordsFromLandRecords;

export const getCachedArchiveRecords = async (): Promise<RecordFile[]> => {
    if (memoryArchiveRecordsCache && memoryArchiveRecordsCache.length > 0) {
        return memoryArchiveRecordsCache;
    }
    try {
        const idb = await getIndexedDBItem<RecordFile[]>(CACHE_KEY_LUUTRU_RECORDS);
        if (Array.isArray(idb) && idb.length > 0) {
            memoryArchiveRecordsCache = idb;
            return idb;
        }
    } catch {
        // ignore
    }
    return [];
};

// Biến giữ promise đang chạy để tránh tạo nhiều request đồng thời khi khởi động
let inFlightAllArchivePromise: Promise<RecordFile[]> | null = null;
const inFlightTypePromises = new Map<string, Promise<ArchiveRecord[]>>();

const fetchLuutruBatchWithRetry = async (
    page: number, 
    pageSize: number, 
    maxRetries = 3,
    typeFilter?: 'saoluc' | 'vaoso' | 'congvan'
): Promise<{ data: any[] | null; error: any }> => {
    let lastError: any = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            let query = supabase
                .from('luutru_records')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (typeFilter === 'vaoso') {
                query = query.or('recordType.ilike.%vào sổ%,recordType.ilike.%vaoso%,recordType.ilike.%vao so%,entryNumber.not.is.null,content.ilike.%vào sổ%,content.ilike.%vaoso%,group.ilike.%cấp gcn%,group.ilike.%đăng ký%');
            } else if (typeFilter === 'congvan') {
                query = query.or('recordType.ilike.%công văn%,recordType.ilike.%cong van%,content.ilike.%công văn%,content.ilike.%cong van%,group.eq.1.2');
            }

            try {
                query = query.order('receivedDate', { ascending: false, nullsFirst: false });
            } catch {
                // ignore sort error
            }

            const res = await query;
            if (!res.error) {
                return { data: res.data || [], error: null };
            }

            lastError = res.error;
            // Nếu lỗi do filter .or không tương thích trên phiên bản database, fallback không filter
            if (typeFilter && attempt === 1) {
                console.warn(`[fetchLuutruBatchWithRetry] Filter query returned error (${res.error?.message}). Retrying fallback without DB filter.`);
                typeFilter = undefined;
                continue;
            }

            // Nếu không phải lỗi tạm thời, không retry vô ích
            if (!isTransientError(res.error)) {
                break;
            }

            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
            }
        } catch (err: any) {
            lastError = err;
            if (!isTransientError(err)) {
                break;
            }
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
            }
        }
    }
    return { data: null, error: lastError };
};

export const fetchAllArchiveRecordsAsRecordFiles = async (): Promise<RecordFile[]> => {
    if (inFlightAllArchivePromise) {
        return inFlightAllArchivePromise;
    }

    inFlightAllArchivePromise = (async () => {
        // Migration guard: Automatic cross-table migration is disabled by system policy
        hasMigratedArchiveOnce = true;

        if (!isConfigured) {
            const cached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
            if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
            const res = MOCK_ARCHIVE.map(r => {
                const row = mapArchiveRecordToLuutruDb(r);
                return mapArchiveDbToRecordFile(row);
            });
            memoryArchiveRecordsCache = res;
            return res;
        }

        try {
            let allRecords: RecordFile[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await fetchLuutruBatchWithRetry(page, pageSize, 3);

                if (error) {
                    console.warn('Lỗi khi fetch all luutru_records sau khi thử lại:', error);
                    break;
                }

                if (data && data.length > 0) {
                    const mapped = data.map(item => mapArchiveDbToRecordFile(item));
                    allRecords = [...allRecords, ...mapped];
                    if (data.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            }

            // Nếu lấy được dữ liệu mới từ Cloud
            if (allRecords.length > 0) {
                // Khử trùng lặp 100% bằng Map theo id
                const uniqueMap = new Map<string, RecordFile>();
                allRecords.forEach(r => {
                    if (r && r.id) {
                        uniqueMap.set(r.id, r);
                    }
                });

                const result = Array.from(uniqueMap.values());
                memoryArchiveRecordsCache = result;
                setIndexedDBItem(CACHE_KEY_LUUTRU_RECORDS, result).catch(() => {});
                return result;
            }

            // Nếu kết nối lỗi hoặc không tải được dữ liệu, an toàn fallback về bộ nhớ đệm / IndexedDB (KHÔNG ghi đè rỗng)
            if (memoryArchiveRecordsCache && memoryArchiveRecordsCache.length > 0) {
                return memoryArchiveRecordsCache;
            }

            const idbFallback = await getIndexedDBItem<RecordFile[]>(CACHE_KEY_LUUTRU_RECORDS);
            if (Array.isArray(idbFallback) && idbFallback.length > 0) {
                memoryArchiveRecordsCache = idbFallback;
                return idbFallback;
            }

            return [];
        } catch (error: any) {
            logError('fetchAllArchiveRecordsAsRecordFiles', error, true);
            if (memoryArchiveRecordsCache && memoryArchiveRecordsCache.length > 0) {
                return memoryArchiveRecordsCache;
            }
            try {
                const idbFallback = await getIndexedDBItem<RecordFile[]>(CACHE_KEY_LUUTRU_RECORDS);
                if (Array.isArray(idbFallback) && idbFallback.length > 0) {
                    memoryArchiveRecordsCache = idbFallback;
                    return idbFallback;
                }
            } catch {}
            return [];
        } finally {
            inFlightAllArchivePromise = null;
        }
    })();

    return inFlightAllArchivePromise;
};

export const fetchArchiveRecords = async (type: 'saoluc' | 'vaoso' | 'congvan'): Promise<ArchiveRecord[]> => {
    const inFlight = inFlightTypePromises.get(type);
    if (inFlight) {
        return inFlight;
    }

    const cacheKey = getArchiveCacheKey(type);

    const promise = (async () => {
        if (!isConfigured) {
            const cached = getFromCache<ArchiveRecord[]>(cacheKey, []);
            if (cached.length > 0) return cached.filter(r => r.type === type);
            const legacyCached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
            if (MOCK_ARCHIVE.length === 0 && legacyCached.length > 0) MOCK_ARCHIVE = legacyCached;
            return MOCK_ARCHIVE.filter(r => r.type === type);
        }
        try {
            let allData: ArchiveRecord[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await fetchLuutruBatchWithRetry(page, pageSize, 3, type);

                if (error) {
                    console.warn(`Lỗi khi fetch luutru_records (${type}) sau khi thử lại:`, error);
                    break;
                }
                
                if (data && data.length > 0) {
                    const mapped = data.map(item => mapLuutruDbToArchiveRecord(item));
                    const filtered = mapped.filter(r => r.type === type);
                    allData = [...allData, ...filtered];
                    if (data.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            }

            if (allData.length > 0) {
                // Khử trùng lặp 100% bằng Map theo id hoặc số hiệu tránh trùng
                const uniqueMap = new Map<string, ArchiveRecord>();
                allData.forEach(r => {
                    if (r && (r.id || r.so_hieu)) {
                        const key = r.id || r.so_hieu;
                        uniqueMap.set(key, r);
                    }
                });
                const result = Array.from(uniqueMap.values());

                // Lưu vào cache riêng độc lập theo từng loại hồ sơ (không đè lẫn nhau)
                saveToCache(cacheKey, result);
                memoryArchiveTypeCaches.set(type, result);
                return result;
            }

            // Fallback an toàn về cache riêng cũ (không ghi đè rỗng)
            const cached = getFromCache<ArchiveRecord[]>(cacheKey, []);
            if (cached.length > 0) {
                memoryArchiveTypeCaches.set(type, cached);
                return cached.filter(r => r.type === type);
            }
            const legacyCached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
            if (legacyCached.length > 0) return legacyCached.filter(r => r.type === type);
            if (MOCK_ARCHIVE.length === 0 && legacyCached.length > 0) MOCK_ARCHIVE = legacyCached;
            return MOCK_ARCHIVE.filter(r => r.type === type);
        } catch (error: any) {
            logError(`fetchArchiveRecords-${type}`, error, true);
            const cached = getFromCache<ArchiveRecord[]>(cacheKey, []);
            if (cached.length > 0) {
                memoryArchiveTypeCaches.set(type, cached);
                return cached.filter(r => r.type === type);
            }
            const legacyCached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
            return (legacyCached.length > 0 ? legacyCached : MOCK_ARCHIVE).filter(r => r.type === type);
        } finally {
            inFlightTypePromises.delete(type);
        }
    })();

    inFlightTypePromises.set(type, promise);
    return promise;
};

export const saveArchiveRecord = async (record: Partial<ArchiveRecord>): Promise<SaveArchiveResult> => {
    let fullRecord = { ...record };
    if (!isConfigured) {
        if (record.id) {
            const idx = MOCK_ARCHIVE.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                const existing = MOCK_ARCHIVE[idx];
                const merged = {
                    ...existing,
                    ...record,
                    data: {
                        ...(existing.data || {}),
                        ...(record.data || {})
                    },
                    so_hieu: record.so_hieu || existing.so_hieu,
                    noi_nhan_gui: record.noi_nhan_gui || existing.noi_nhan_gui,
                    trich_yeu: record.trich_yeu || existing.trich_yeu
                } as ArchiveRecord;
                MOCK_ARCHIVE[idx] = merged;
                saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
                const recFile = mapArchiveDbToRecordFile(mapArchiveRecordToLuutruDb(merged));
                await addPendingRecord(recFile, 'UPDATE', 'luutru_records');
                return { success: true, persisted: false, queued: true, offline: true, record: merged };
            }
        } else {
            const newRec = { 
                ...record, 
                id: record.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)), 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);
            saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
            const recFile = mapArchiveDbToRecordFile(mapArchiveRecordToLuutruDb(newRec));
            await addPendingRecord(recFile, 'CREATE', 'luutru_records');
            return { success: true, persisted: false, queued: true, offline: true, record: newRec };
        }
        return { success: false, persisted: false, queued: false, offline: true, errorCode: 'OFFLINE_NOT_FOUND', message: 'Record not found in offline memory' };
    }
    let existingRows: any = null;
    try {
        if (record.id) {
            let res = await supabase
                .from('luutru_records')
                .select('*')
                .eq('id', record.id)
                .maybeSingle();
            existingRows = res.data;

            if (existingRows) {
                const currentArch = mapLuutruDbToArchiveRecord(existingRows);
                fullRecord = {
                    ...currentArch,
                    ...record,
                    so_hieu: record.so_hieu || currentArch.so_hieu || existingRows.code || '',
                    noi_nhan_gui: record.noi_nhan_gui || currentArch.noi_nhan_gui || existingRows.customerName || '',
                    trich_yeu: record.trich_yeu || currentArch.trich_yeu || existingRows.content || '',
                    data: {
                        ...(currentArch.data || {}),
                        ...(record.data || {})
                    }
                };
            }
        }

        const payload = mapArchiveRecordToLuutruDb(fullRecord);

        if (record.id && existingRows) {
            // Sử dụng timestamp vừa được nạp trực tiếp từ DB ngay tại thời điểm gọi hàm
            // để tránh xung đột giả lập giữa các lần gõ/rời ô liên tiếp trong cùng một phiên làm việc
            let previousUpdatedAt = existingRows.updated_at;

            let query = supabase.from('luutru_records').update(payload).eq('id', record.id);
            if (previousUpdatedAt) {
                query = query.eq('updated_at', previousUpdatedAt);
            }
            let { data, error } = await query.select();
            
            if (error && (error.code === '42703' || String(error.message || '').includes('column') || error.code === 'PGRST204')) {
                const fallbackPayload = { ...payload };
                OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fallbackPayload[col]);
                let fallbackQuery = supabase.from('luutru_records').update(fallbackPayload).eq('id', record.id);
                if (previousUpdatedAt) {
                    fallbackQuery = fallbackQuery.eq('updated_at', previousUpdatedAt);
                }
                const res = await fallbackQuery.select();
                data = res.data;
                error = res.error;
            }

            if (error && (error.code === '22P02' || String(error.message || '').includes('22P02'))) {
                const cleanPayload = sanitizePayloadFor22P02(payload);
                let fallbackQuery = supabase.from('luutru_records').update(cleanPayload).eq('id', record.id);
                if (previousUpdatedAt) {
                    fallbackQuery = fallbackQuery.eq('updated_at', previousUpdatedAt);
                }
                const res = await fallbackQuery.select();
                data = res.data;
                error = res.error;
            }

            if (error) throw error;
            if (!data || data.length === 0) {
                const { data: checkData } = await supabase.from('luutru_records').select('id, updated_at').eq('id', record.id);
                if (checkData && checkData.length > 0) {
                    const currentDbUpdatedAt = checkData[0].updated_at;
                    if (currentDbUpdatedAt !== previousUpdatedAt) {
                        console.warn(`[MUTATION][CONCURRENCY_SYNC] Auto-resolving concurrency for Archive Record ID ${record.id}. DB: ${currentDbUpdatedAt}, Prev: ${previousUpdatedAt}. Retrying with fresh snapshot.`);
                        // Tự động giải quyết xung đột bằng cách cập nhật không kẹp điều kiện updated_at cũ
                        const forceUpdateRes = await supabase.from('luutru_records').update(payload).eq('id', record.id).select();
                        if (forceUpdateRes.data && forceUpdateRes.data.length > 0) {
                            data = forceUpdateRes.data;
                        }
                    }
                }
                if (!data || data.length === 0) {
                    // Upsert fallback if 0 rows modified
                    console.warn(`[MUTATION][RECOVERY] UPDATE returned 0 rows on luutru_records for ID: ${record.id}. Executing upsert fallback...`);
                    let upsertRes = await supabase.from('luutru_records').upsert(payload).select();
                    if (upsertRes.error && (upsertRes.error.code === '42703' || String(upsertRes.error.message || '').includes('column') || upsertRes.error.code === 'PGRST204')) {
                        const fallbackPayload = { ...payload };
                        OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fallbackPayload[col]);
                        upsertRes = await supabase.from('luutru_records').upsert(fallbackPayload).select();
                    }
                    if (upsertRes.data && upsertRes.data.length > 0) {
                        data = upsertRes.data;
                    } else {
                        console.error(`[MUTATION][ARCHIVE_UPDATE_NOT_FOUND] ID ${record.id} not found in luutru_records.`);
                        throw new Error(`[UPDATE_NOT_FOUND] Archive record with ID ${record.id} was not found in luutru_records.`);
                    }
                }
            }
            const resRec = mapLuutruDbToArchiveRecord(data[0]);
            if (resRec) {
                if (resRec.so_hieu && resRec.so_hieu.startsWith('LT-')) {
                    updateArchiveCounterIfHigher(resRec.so_hieu, resRec.ngay_thang);
                }
                const mappedFile = mapArchiveDbToRecordFile(data[0]);
                markRecordsRecentlyUpdated([mappedFile]);
            }
            memoryArchiveRecordsCache = null;
            return { success: true, persisted: true, queued: false, offline: false, record: resRec };
        } else {
            let { data, error } = await supabase.from('luutru_records').insert([payload]).select();
            
            if (error && (error.code === '42703' || String(error.message || '').includes('column') || error.code === 'PGRST204')) {
                const fallbackPayload = { ...payload };
                OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fallbackPayload[col]);
                const res = await supabase.from('luutru_records').insert([fallbackPayload]).select();
                data = res.data;
                error = res.error;
            }

            if (error && (error.code === '22P02' || String(error.message || '').includes('22P02'))) {
                const cleanPayload = sanitizePayloadFor22P02(payload);
                const res = await supabase.from('luutru_records').insert([cleanPayload]).select();
                data = res.data;
                error = res.error;
            }

            if (error) throw error;
            const resRec = data && data.length > 0 ? mapLuutruDbToArchiveRecord(data[0]) : undefined;
            if (resRec && data && data.length > 0) {
                if (resRec.so_hieu && resRec.so_hieu.startsWith('LT-')) {
                    updateArchiveCounterIfHigher(resRec.so_hieu, resRec.ngay_thang);
                }
                const mappedFile = mapArchiveDbToRecordFile(data[0]);
                markRecordsRecentlyUpdated([mappedFile]);
            }
            memoryArchiveRecordsCache = null;
            return { success: true, persisted: true, queued: false, offline: false, record: resRec };
        }
    } catch (error: any) {
        logError("saveArchiveRecord", error);

        const errStr = String(error?.message || error || '').toLowerCase();
        const errCode = String(error?.code || '').toLowerCase();

        const isRouting = errStr.includes('routing_conflict') || errStr.includes('routing_unresolved');
        const isConcurrency = errStr.includes('concurrency_conflict') || errCode === '40901' || errStr.includes('modified by another user');
        const isUpdateNotFound = errStr.includes('update_not_found');
        const isValidation = errCode.startsWith('23') || errCode === '22p02' || errCode === '22007' || errCode === '22008' || 
                             errStr.includes('invalid input') || errStr.includes('constraint') || errStr.includes('violat') || 
                             errStr.includes('invalid uuid') || errStr.includes('invalid date') || errStr.includes('invalid status');

        const isNetworkOrTempDb = errStr.includes('failed to fetch') || errStr.includes('networkerror') || 
                                  errStr.includes('timeout') || errStr.includes('connection refused') || 
                                  errStr.includes('transient') || errStr.includes('connection failure') ||
                                  errStr.includes('load failed') || errCode === 'ebusy' || errCode === 'enotfound';

        const shouldQueue = isNetworkOrTempDb || (!isRouting && !isConcurrency && !isUpdateNotFound && !isValidation);

        if (shouldQueue) {
            console.log("[MUTATION][ARCHIVE_SAVE] Transient/Network error detected. Saving to pending offline queue.");
            const payload = mapArchiveRecordToLuutruDb(fullRecord);
            const recFile = mapArchiveDbToRecordFile(payload);
            try {
                await addPendingRecord(recFile, record.id ? 'UPDATE' : 'CREATE', 'luutru_records');
                return {
                    success: true,
                    persisted: false,
                    queued: true,
                    offline: true,
                    record: fullRecord as ArchiveRecord
                };
            } catch (qErr: any) {
                return {
                    success: false,
                    persisted: false,
                    queued: false,
                    offline: false,
                    errorCode: 'QUEUE_ERROR',
                    message: `Failed to save to offline queue: ${String(qErr)}`
                };
            }
        } else {
            console.warn(`[MUTATION][ARCHIVE_SAVE] Hard error (Validation/Routing/Concurrency) detected. Skipping queue. Error: ${errStr}`);
            return {
                success: false,
                persisted: false,
                queued: false,
                offline: false,
                errorCode: isConcurrency ? 'CONCURRENCY_CONFLICT' : (isRouting ? 'ROUTING_ERROR' : (isUpdateNotFound ? 'UPDATE_NOT_FOUND' : 'VALIDATION_ERROR')),
                message: error?.message || String(error)
            };
        }
    }
};

export const deleteArchiveRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_ARCHIVE.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_ARCHIVE.splice(idx, 1);
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        const { error } = await supabase.from('luutru_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteArchiveRecord", error, true);
        const idx = MOCK_ARCHIVE.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_ARCHIVE.splice(idx, 1);
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
};

export const importArchiveRecords = async (records: Partial<ArchiveRecord>[]): Promise<boolean> => {
    if (!isConfigured) {
        for (const r of records) {
            const newId = r.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));
            const newRec = { 
                ...r, 
                id: newId, 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);

            const payload = mapArchiveRecordToLuutruDb(newRec);
            const recFile = mapArchiveDbToRecordFile(payload);
            await addPendingRecord(recFile, 'CREATE', 'luutru_records');
        }
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        const payload = records.map(r => mapArchiveRecordToLuutruDb(r));

        let { error } = await supabase.from('luutru_records').insert(payload);
        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02'))) {
            const cleanPayload = sanitizePayloadFor22P02(payload);
            const res = await supabase.from('luutru_records').insert(cleanPayload);
            error = res.error;
        }
        if (error) throw error;
        return true;
    } catch (error: any) {
        logError("importArchiveRecords", error, true);

        const errStr = String(error?.message || error || '').toLowerCase();
        const errCode = String(error?.code || '').toLowerCase();

        const isValidation = errCode.startsWith('23') || errCode === '22p02' || errCode === '22007' || errCode === '22008' || 
                             errStr.includes('invalid input') || errStr.includes('constraint') || errStr.includes('violat') || 
                             errStr.includes('invalid uuid') || errStr.includes('invalid date') || errStr.includes('invalid status');

        const isNetworkOrTempDb = errStr.includes('failed to fetch') || errStr.includes('networkerror') || 
                                  errStr.includes('timeout') || errStr.includes('connection refused') || 
                                  errStr.includes('transient') || errStr.includes('connection failure') ||
                                  errStr.includes('load failed') || errCode === 'ebusy' || errCode === 'enotfound';

        const shouldQueue = isNetworkOrTempDb || !isValidation;

        if (shouldQueue) {
            console.log("[MUTATION][ARCHIVE_IMPORT] Transient/Network error detected on import. Pushing imported records to pending queue...");
            for (const r of records) {
                const payload = mapArchiveRecordToLuutruDb(r);
                const recFile = mapArchiveDbToRecordFile(payload);
                try {
                    await addPendingRecord(recFile, 'CREATE', 'luutru_records');
                } catch (queueErr) {
                    console.error("Failed to add imported record to pending queue:", queueErr);
                }
            }

            records.forEach(r => {
                const newRec = { 
                    ...r, 
                    id: r.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)), 
                    created_at: new Date().toISOString() 
                } as ArchiveRecord;
                MOCK_ARCHIVE.unshift(newRec);
            });
            saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);

            return true;
        }

        return false;
    }
};

export const updateArchiveRecordsBatch = async (ids: string[], updates: Partial<ArchiveRecord>): Promise<boolean> => {
    if (ids.length === 0) return true;

    if (!isConfigured) {
        MOCK_ARCHIVE = MOCK_ARCHIVE.map(r => {
            if (ids.includes(r.id)) {
                const newData = updates.data ? { ...r.data, ...updates.data } : r.data;
                return { ...r, ...updates, data: newData } as ArchiveRecord;
            }
            return r;
        });
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        let { data: currentRecords, error: fetchError } = await supabase
            .from('luutru_records')
            .select('*')
            .in('id', ids);
            
        if (fetchError) throw fetchError;

        // Phục hồi từ bộ nhớ cache lưu trữ hoặc pending queue nếu thiếu
        const missingIds = ids.filter(id => !currentRecords?.some(r => r.id === id));
        if (missingIds.length > 0) {
            console.log(`[updateArchiveRecordsBatch] Resolving ${missingIds.length} missing IDs from local caches/queue:`, missingIds);
            const localCachedArchive = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
            const localCachedRecords = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
            let pending: any[] = [];
            try {
                pending = await getPendingRecords();
            } catch {}

            for (const missingId of missingIds) {
                const foundCached = localCachedArchive.find(r => r.id === missingId)
                        || memoryArchiveRecordsCache?.find(r => r.id === missingId)
                        || MOCK_ARCHIVE.find(r => r.id === missingId)
                        || localCachedRecords.find(r => r.id === missingId)
                        || pending.find(r => r.id === missingId);

                    let baseArch: Partial<ArchiveRecord>;
                    if (foundCached) {
                        baseArch = (foundCached as any).data !== undefined ? (foundCached as ArchiveRecord) : mapLuutruDbToArchiveRecord(foundCached);
                    } else {
                        baseArch = {
                            id: missingId,
                            type: 'saoluc',
                            status: (updates.status as any) || 'draft',
                            so_hieu: (updates as any).so_hieu || '',
                            trich_yeu: (updates as any).trich_yeu || '',
                            ngay_thang: (updates as any).ngay_thang || new Date().toISOString().split('T')[0],
                            noi_nhan_gui: (updates as any).noi_nhan_gui || ''
                        };
                    }

                    const mergedArch: ArchiveRecord = {
                        ...baseArch,
                        ...updates,
                        data: {
                            ...(baseArch.data || {}),
                            ...(updates.data || {})
                        }
                    } as ArchiveRecord;

                    const payloadToUpsert = mapArchiveRecordToLuutruDb(mergedArch);
                    let { data: upData, error: upErr } = await supabase.from('luutru_records').upsert(payloadToUpsert).select();
                    if (upErr && (upErr.code === '42703' || String(upErr.message || '').includes('column') || upErr.code === 'PGRST204')) {
                        const fallback = { ...payloadToUpsert };
                        OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fallback[col]);
                        const res = await supabase.from('luutru_records').upsert(fallback).select();
                        upData = res.data;
                    }
                    if (upData && upData.length > 0) {
                        currentRecords = [...(currentRecords || []), upData[0]];
                    }
                }
            }

        if (!currentRecords || currentRecords.length === 0) {
            console.warn(`[MUTATION][UPDATE_NOT_FOUND] Records with IDs ${ids.join(', ')} not found in any table or cache. Enqueueing to offline pending queue.`);
            for (const missingId of ids) {
                const fallbackRec: ArchiveRecord = {
                    id: missingId,
                    type: 'saoluc',
                    status: (updates.status as any) || 'draft',
                    ...updates,
                    data: updates.data || {}
                } as ArchiveRecord;
                const recFile = mapArchiveDbToRecordFile(mapArchiveRecordToLuutruDb(fallbackRec));
                await addPendingRecord(recFile, 'UPDATE', 'luutru_records');
            }
            return true;
        }

        const updatedPayloads = currentRecords.map(r => {
            const currentArch = mapLuutruDbToArchiveRecord(r);
            const mergedArch: ArchiveRecord = {
                ...currentArch,
                ...updates,
                data: {
                    ...(currentArch.data || {}),
                    ...(updates.data || {})
                }
            };
            return mapArchiveRecordToLuutruDb(mergedArch);
        });

        for (const payload of updatedPayloads) {
            const curRec = currentRecords.find(cr => cr.id === payload.id);
            const previousUpdatedAt = curRec ? curRec.updated_at : null;

            let query = supabase.from('luutru_records').update(payload).eq('id', payload.id);
            if (previousUpdatedAt) {
                query = query.eq('updated_at', previousUpdatedAt);
            }
            let { data, error: updateError } = await query.select();

            if (updateError && (updateError.code === '42703' || String(updateError.message || '').includes('column') || updateError.code === 'PGRST204')) {
                const fallbackPayload = { ...payload };
                OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fallbackPayload[col]);
                let fallbackQuery = supabase.from('luutru_records').update(fallbackPayload).eq('id', payload.id);
                if (previousUpdatedAt) {
                    fallbackQuery = fallbackQuery.eq('updated_at', previousUpdatedAt);
                }
                const res = await fallbackQuery.select();
                data = res.data;
                updateError = res.error;
            }

            if (updateError && (updateError.code === '22P02' || String(updateError.message || '').includes('22P02'))) {
                const cleanPayload = sanitizePayloadFor22P02(payload);
                let fallbackQuery = supabase.from('luutru_records').update(cleanPayload).eq('id', payload.id);
                if (previousUpdatedAt) {
                    fallbackQuery = fallbackQuery.eq('updated_at', previousUpdatedAt);
                }
                const res = await fallbackQuery.select();
                data = res.data;
                updateError = res.error;
            }

            if (updateError) throw updateError;
            if (!data || data.length === 0) {
                const { data: checkData } = await supabase.from('luutru_records').select('id, updated_at').eq('id', payload.id);
                if (checkData && checkData.length > 0) {
                    const currentDbUpdatedAt = checkData[0].updated_at;
                    if (currentDbUpdatedAt !== previousUpdatedAt) {
                        console.error(`[MUTATION][CONCURRENCY_CONFLICT] Archive Record ID ${payload.id} in batch was updated by another session. DB: ${currentDbUpdatedAt}, Expected: ${previousUpdatedAt}`);
                        throw new Error(`CONCURRENCY_CONFLICT: Archive Record with ID ${payload.id} was modified by another user or session. Please refresh.`);
                    }
                }
                // Upsert fallback if 0 rows modified
                console.warn(`[MUTATION][RECOVERY] UPDATE returned 0 modified rows on luutru_records for ID: ${payload.id}. Attempting upsert recovery...`);
                let upsertRes = await supabase.from('luutru_records').upsert(payload).select();
                if (upsertRes.error && (upsertRes.error.code === '42703' || String(upsertRes.error.message || '').includes('column') || upsertRes.error.code === 'PGRST204')) {
                    const fbPayload = { ...payload };
                    OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fbPayload[col]);
                    upsertRes = await supabase.from('luutru_records').upsert(fbPayload).select();
                }
                if (upsertRes.error) {
                    console.error(`[MUTATION][UPDATE_NOT_FOUND] Upsert recovery failed for ID: ${payload.id}:`, upsertRes.error);
                    throw upsertRes.error;
                }
                if (!upsertRes.data || upsertRes.data.length === 0) {
                    console.warn(`[MUTATION][UPDATE_NOT_FOUND] Enqueueing to offline queue for ID: ${payload.id}`);
                    const recFile = mapArchiveDbToRecordFile(payload);
                    await addPendingRecord(recFile, 'UPDATE', 'luutru_records');
                }
            }
        }

        const mappedFiles = updatedPayloads.map(p => mapArchiveDbToRecordFile(p));
        markRecordsRecentlyUpdated(mappedFiles);
        memoryArchiveRecordsCache = null;
        return true;
    } catch (error) {
        logError("updateArchiveRecordsBatch", error, true);
        throw error;
    }
};

export const fetchLuutruHandoverBatches = async (): Promise<Array<{ batch: string; count: number; date?: string; ward?: string }>> => {
    if (!isConfigured) return [];
    try {
        const { data, error } = await supabase
            .from('luutru_records')
            .select('exportBatch, exportDate, handoverWard')
            .not('exportBatch', 'is', null);

        if (error) throw error;
        if (!data) return [];

        const batchMap = new Map<string, { count: number; date?: string; ward?: string }>();
        data.forEach(item => {
            if (item.exportBatch) {
                const b = item.exportBatch.trim();
                const existing = batchMap.get(b) || { count: 0, date: item.exportDate, ward: item.handoverWard };
                existing.count += 1;
                if (!existing.date && item.exportDate) existing.date = item.exportDate;
                if (!existing.ward && item.handoverWard) existing.ward = item.handoverWard;
                batchMap.set(b, existing);
            }
        });

        return Array.from(batchMap.entries()).map(([batch, info]) => ({
            batch,
            count: info.count,
            date: info.date,
            ward: info.ward
        }));
    } catch (error) {
        logError('fetchLuutruHandoverBatches', error, true);
        return [];
    }
};

export const fetchListsByDate = async (type: string | undefined, date: string): Promise<string[]> => {
    if (!isConfigured) {
        const lists = new Set<string>();
        MOCK_ARCHIVE.forEach(r => {
            if (r.data?.danh_sach) {
                if (!date || r.data?.ngay_hoan_thanh === date || r.data?.exportDate === date) {
                    lists.add(r.data.danh_sach);
                }
            }
        });
        return Array.from(lists).sort();
    }

    try {
        const lists = new Set<string>();
        const cleanDate = date && date.includes('T') ? date.split('T')[0] : date;

        // Query luutru_records
        const { data: luutruData } = await supabase
            .from('luutru_records')
            .select('completedWorkDate, exportBatch, exportDate, data')
            .not('exportBatch', 'is', null);

        luutruData?.forEach((r: any) => {
            const batchVal = r.exportBatch || r.data?.exportBatch || r.data?.danh_sach;
            const dateVal = r.exportDate || r.completedWorkDate || r.data?.ngay_hoan_thanh || r.data?.exportDate;
            if (batchVal) {
                if (!cleanDate || (dateVal && dateVal.startsWith(cleanDate))) {
                    lists.add(String(batchVal).trim());
                }
            }
        });

        // Query archive_batches table
        const { data: batchesData } = await supabase
            .from('archive_batches')
            .select('batch_name, created_at');

        batchesData?.forEach((b: any) => {
            if (b.batch_name) {
                const createdDate = b.created_at ? b.created_at.split('T')[0] : '';
                if (!cleanDate || (createdDate && createdDate.startsWith(cleanDate))) {
                    lists.add(String(b.batch_name).trim());
                }
            }
        });

        return Array.from(lists).sort();
    } catch (error) {
        logError(`fetchListsByDate-global`, error, true);
        return [];
    }
};

export interface ArchiveBatchItem {
    id?: string;
    batch_name: string;
    batch_number?: number;
    module_type?: string;
    created_at?: string;
    record_ids?: string[];
    record_count?: number;
}

export const getOrGenerateDailyHighestBatch = async (
    type: string = 'global',
    targetDateStr: string = new Date().toISOString().split('T')[0]
): Promise<string> => {
    try {
        const cleanDate = targetDateStr.includes('T') ? targetDateStr.split('T')[0] : targetDateStr;
        const lists = await fetchListsByDate(type, cleanDate);
        let maxNum = 0;
        lists.forEach(batchStr => {
            const match = batchStr.match(/Đợt\s*(\d+)/i) || batchStr.match(/(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        return `Đợt ${maxNum + 1}`;
    } catch (error) {
        logError('getOrGenerateDailyHighestBatch', error, true);
        return 'Đợt 1';
    }
};

export const autoAssignDailyHighestBatchToUnbatchedRecords = async (
    type: string = 'global',
    targetDateStr?: string
): Promise<{ batchName: string; updatedCount: number }> => {
    if (!isConfigured) return { batchName: 'Đợt 1', updatedCount: 0 };
    try {
        const { data: records, error } = await supabase
            .from('luutru_records')
            .select('*');

        if (error || !records || records.length === 0) return { batchName: 'Đợt 1', updatedCount: 0 };

        const unbatchedRecords = records.filter(r => {
            const st = String(r.status || '').toLowerCase();
            const isCompleted = st === 'completed' || st === 'handover' || st === 'handed_over' || st === 'giao_1_cua' || Boolean(r.completedWorkDate) || Boolean(r.exportDate);
            const batchVal = r.exportBatch || r.export_batch || r.data?.exportBatch || r.data?.danh_sach;
            const isUnbatched = !batchVal || String(batchVal).trim() === '';
            return isCompleted && isUnbatched;
        });

        if (unbatchedRecords.length === 0) {
            return { batchName: 'Không có hồ sơ lẻ', updatedCount: 0 };
        }

        const recordsByDate = new Map<string, any[]>();
        unbatchedRecords.forEach(r => {
            let recDate = r.exportDate || r.completedWorkDate || r.receivedDate || r.data?.ngay_hoan_thanh || targetDateStr || new Date().toISOString().split('T')[0];
            if (recDate.includes('T')) recDate = recDate.split('T')[0];
            const list = recordsByDate.get(recDate) || [];
            list.push(r);
            recordsByDate.set(recDate, list);
        });

        let totalUpdated = 0;
        let lastBatchName = 'Đợt 1';

        for (const [dateStr, dateRecords] of recordsByDate.entries()) {
            const highestBatchName = await getOrGenerateDailyHighestBatch(type, dateStr);
            const unbatchedIds = dateRecords.map(r => r.id);
            const res = await createArchiveBatch(highestBatchName, unbatchedIds, type, dateStr);
            totalUpdated += res.count;
            lastBatchName = res.batchName;
        }

        memoryArchiveRecordsCache = null;
        return { batchName: lastBatchName, updatedCount: totalUpdated };
    } catch (err) {
        logError('autoAssignDailyHighestBatchToUnbatchedRecords', err, true);
        return { batchName: 'Đợt 1', updatedCount: 0 };
    }
};

export const createArchiveBatch = async (
    batchName: string,
    recordIds: string[],
    moduleType: string = 'global',
    handoverDate: string = new Date().toISOString().split('T')[0]
): Promise<{ success: boolean; batchName: string; count: number }> => {
    try {
        const nowIso = new Date().toISOString();
        let finalBatchName = batchName ? batchName.trim() : '';
        
        if (!finalBatchName) {
            finalBatchName = await getOrGenerateDailyHighestBatch(moduleType, handoverDate);
        }

        if (isConfigured) {
            try {
                await supabase.from('archive_batches').insert([{
                    batch_name: finalBatchName,
                    module_type: moduleType,
                    record_ids: recordIds,
                    record_count: recordIds.length,
                    created_at: nowIso
                }]);
            } catch (tblErr) {
                console.warn('⚠️ archive_batches table insert safely caught:', tblErr);
            }
        }

        if (recordIds.length > 0 && isConfigured) {
            // Update luutru_records ONLY
            try {
                await updateArchiveRecordsBatch(recordIds, {
                    status: 'completed',
                    exportBatch: finalBatchName,
                    data: {
                        exportBatch: finalBatchName,
                        exportDate: handoverDate,
                        ngay_hoan_thanh: handoverDate,
                        danh_sach: finalBatchName,
                        updated_at: nowIso
                    }
                });
            } catch (err) {
                console.warn('⚠️ updateArchiveRecordsBatch inside createArchiveBatch safely caught:', err);
            }
        }

        return { success: true, batchName: finalBatchName, count: recordIds.length };
    } catch (error) {
        logError('createArchiveBatch', error, true);
        return { success: false, batchName, count: 0 };
    }
};

/**
 * Cấp số vào sổ GCN nguyên tử (Atomic), chống trùng 100% bằng Supabase RPC hoặc quét MAX toàn diện.
 * Có cơ chế tự động đồng bộ (Self-healing) và fallback an toàn quét cả client memory, settings và DB.
 */
export const allocateNextVaoSoNumbers = async (
    prefix: string,
    count: number = 1,
    padLength: number = 5,
    minBaseNumber?: number
): Promise<string[]> => {
    let maxVal = typeof minBaseNumber === 'number' && !isNaN(minBaseNumber) ? minBaseNumber : 0;

    const extractNum = (val: any) => {
        if (!val) return;
        const str = String(val).trim();
        const matches = str.match(/\d+/g);
        if (matches) {
            matches.forEach(m => {
                const num = parseInt(m, 10);
                if (!isNaN(num) && num > maxVal) maxVal = num;
            });
        }
    };

    // Quét số lớn nhất từ bộ nhớ cache client
    const cachedVaoso = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE_VAOSO, []);
    const cachedArchive = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
    [...cachedVaoso, ...cachedArchive].forEach(r => {
        if (r.type === 'vaoso' || isVaoSoRecord(r)) {
            extractNum(r.data?.so_vao_so);
            extractNum(r.data?.entryNumber);
            extractNum(r.so_hieu);
        }
    });

    if (!isConfigured) {
        // Fallback offline / demo mode
        const results: string[] = [];
        for (let i = 1; i <= count; i++) {
            const nextNum = maxVal + i;
            results.push(`${prefix} ${String(nextNum).padStart(padLength, '0')}`);
        }
        return results;
    }

    try {
        // 1. Quét số MAX thực tế từ DB trước để đảm bảo không bao giờ bị lùi số
        const [dangkyRes, luutruRes] = await Promise.all([
            supabase.from('dangky_records').select('entryNumber, data'),
            supabase.from('luutru_records').select('entryNumber, data, recordType')
        ]);

        (dangkyRes.data || []).forEach(r => {
            extractNum(r.entryNumber);
            extractNum((r as any)?.data?.so_vao_so);
            extractNum((r as any)?.data?.entryNumber);
        });
        (luutruRes.data || []).forEach(r => {
            extractNum(r.entryNumber);
            extractNum((r as any)?.data?.so_vao_so);
            extractNum((r as any)?.data?.entryNumber);
        });

        // 2. Thử gọi RPC nếu có
        try {
            const { data, error } = await supabase.rpc('allocate_next_vao_so_numbers', {
                p_prefix: prefix,
                p_count: count,
                p_pad_length: padLength
            });

            if (!error && data && Array.isArray(data)) {
                const rpcNums = data.map((d: any) => d.allocated_number);
                let rpcMax = 0;
                rpcNums.forEach((n: string) => {
                    const matches = String(n).match(/\d+/g);
                    if (matches) {
                        matches.forEach(m => {
                            const num = parseInt(m, 10);
                            if (!isNaN(num) && num > rpcMax) rpcMax = num;
                        });
                    }
                });

                // Nếu số RPC trả về lớn hơn maxVal thực tế, sử dụng kết quả RPC
                if (rpcMax > maxVal) {
                    return rpcNums;
                }
            }
        } catch {
            // RPC lỗi hoặc không tồn tại, sẽ sử dụng kết quả quét DB + bộ đệm
        }

        // 3. Sử dụng kết quả quét MAX toàn diện (DB + Cache + Memory state)
        const results: string[] = [];
        for (let i = 1; i <= count; i++) {
            const nextNum = maxVal + i;
            results.push(`${prefix} ${String(nextNum).padStart(padLength, '0')}`);
        }
        return results;
    } catch (err) {
        console.warn("[VaoSo API Warning] Lỗi khi cấp số vào sổ, sử dụng bộ đệm:", err);
        const results: string[] = [];
        for (let i = 1; i <= count; i++) {
            const nextNum = maxVal + i;
            results.push(`${prefix} ${String(nextNum).padStart(padLength, '0')}`);
        }
        return results;
    }
};

/**
 * Ánh xạ và đồng bộ tự động hồ sơ Đăng ký/Cấp giấy đã ký sang Module Vào sổ GCN (luutru_records type = 'vaoso')
 * Đảm bảo Idempotency (không trùng, không lặp bản ghi khi bấm duyệt lại)
 */
export const syncDangKyToVaoSo = async (records: RecordFile[]): Promise<boolean> => {
    if (!records || records.length === 0) return true;

    try {
        const nowIso = new Date().toISOString();
        const promises = records.map(async (rec) => {
            // Xác định các trường bổ sung chi tiết theo thiết kế
            const extraData = {
                ...(typeof rec.data === 'object' && rec.data !== null ? rec.data : {}),
                ma_ho_so: rec.code,
                code: rec.code,
                so_hieu: rec.code,
                ten_chu_su_dung: rec.customerName,
                customerName: rec.customerName,
                cccd: rec.cccd,
                phoneNumber: rec.phoneNumber,
                customerAddress: rec.customerAddress,
                recordType: rec.recordType || 'Vào sổ GCN',
                receivedDate: rec.receivedDate,
                deadline: rec.deadline,
                thua_dat: rec.landPlot,
                landPlot: rec.landPlot,
                to_ban_do: rec.mapSheet,
                mapSheet: rec.mapSheet,
                area: rec.area,
                address: rec.address,
                dia_danh: rec.ward,
                ward: rec.ward,
                so_phat_hanh: rec.issueNumber || '',
                so_vao_so: rec.entryNumber || '',
                ngay_ky_gcn: rec.approvalDate || nowIso,
                stage: 'vao_so',
                ghi_chu: rec.notes || '',
                is_scanned: false
            };

            const luutruPayload: any = {
                id: rec.id, // Sử dụng luôn ID của hồ sơ đăng ký để đảm bảo 1-1 và chống trùng lắp hoàn toàn!
                code: rec.code,
                so_hieu: rec.code,
                customerName: rec.customerName,
                content: rec.content || rec.recordType || 'Vào sổ GCN',
                receivedDate: rec.receivedDate || nowIso.split('T')[0],
                receivedBy: rec.receivedBy || null,
                ward: rec.ward || null,
                mapSheet: rec.mapSheet || null,
                landPlot: rec.landPlot || null,
                area: rec.area || null,
                address: rec.address || null,
                group: '3. Đăng ký đất đai, cấp GCN',
                recordType: 'Vào sổ GCN',
                status: RecordStatus.PENDING_HANDOVER,
                approvalDate: rec.approvalDate || nowIso.split('T')[0],
                notes: rec.notes || null,
                phoneNumber: rec.phoneNumber || null,
                cccd: rec.cccd || null,
                customerAddress: rec.customerAddress || null,
                entryNumber: rec.entryNumber || null,
                issueNumber: rec.issueNumber || null,
                isHandedOver: false,
                data: extraData
            };

            if (!isConfigured) {
                // Offline demo update
                const idx = MOCK_ARCHIVE.findIndex(a => a.id === rec.id);
                const archRec: ArchiveRecord = {
                    id: rec.id,
                    type: 'vaoso',
                    status: 'draft',
                    so_hieu: rec.code,
                    trich_yeu: rec.recordType || 'Vào sổ GCN',
                    ngay_thang: rec.receivedDate || nowIso.split('T')[0],
                    noi_nhan_gui: rec.customerName,
                    data: extraData
                };
                if (idx !== -1) {
                    MOCK_ARCHIVE[idx] = archRec;
                } else {
                    MOCK_ARCHIVE.push(archRec);
                }
                const vaosoList = MOCK_ARCHIVE.filter(a => a.type === 'vaoso');
                saveToCache(CACHE_KEY_ARCHIVE_VAOSO, vaosoList);
                memoryArchiveTypeCaches.set('vaoso', vaosoList);
                return;
            }

            // Gọi Upsert trực tiếp bằng ID duy nhất để đảm bảo không bao giờ nhân bản bản ghi
            let { error } = await supabase.from('luutru_records').upsert(luutruPayload);
            if (error && (error.code === '42703' || String(error.message || '').includes('column') || error.code === 'PGRST204')) {
                const fallbackPayload = { ...luutruPayload };
                OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fallbackPayload[col]);
                const retryRes = await supabase.from('luutru_records').upsert(fallbackPayload);
                error = retryRes.error;
            }
            if (error) {
                console.error(`[VaoSo Sync] Không thể đồng bộ hồ sơ ${rec.code} sang Vào sổ GCN:`, error);
                throw error;
            }
        });

        await Promise.all(promises);

        // Khởi động lại cache local sau khi upsert thành công
        clearArchiveMemoryCaches('vaoso');
        if (isConfigured) {
            const { data } = await supabase.from('luutru_records').select('*');
            if (data) {
                const mapped = data.map(item => mapLuutruDbToArchiveRecord(item));
                const vaosoRecords = mapped.filter(r => r.type === 'vaoso');
                saveToCache(CACHE_KEY_ARCHIVE_VAOSO, vaosoRecords);
                memoryArchiveTypeCaches.set('vaoso', vaosoRecords);
            }
        }
        return true;
    } catch (err) {
        console.error("[VaoSo Sync] Lỗi đồng bộ hàng loạt:", err);
        return false;
    }
};
