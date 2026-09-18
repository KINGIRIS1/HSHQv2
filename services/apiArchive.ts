import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache, sanitizeData, sanitizePayloadFor22P02 } from './apiCore';
import { updateArchiveCounterIfHigher, markRecordsRecentlyUpdated } from './apiRecords';
import { RecordFile, RecordStatus } from '../types';
import { isArchiveRecordType, getShortRecordType } from '../constants';
import { setIndexedDBItem, getIndexedDBItem } from './storageService';

// --- TYPES ---
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

const CACHE_KEY_ARCHIVE = 'offline_archive_records';
export const CACHE_KEY_LUUTRU_RECORDS = 'offline_luutru_records';

// In-memory cache for instant 0ms access
let memoryArchiveRecordsCache: RecordFile[] | null = null;

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

    if (batchVal && status !== RecordStatus.WITHDRAWN && status !== RecordStatus.REJECTED && status !== RecordStatus.RETURNED) {
        status = RecordStatus.HANDOVER;
    }

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

export const mapLuutruDbToArchiveRecord = (row: any): ArchiveRecord => {
    let type: 'saoluc' | 'vaoso' | 'congvan' = 'saoluc';
    const recType = String(row.recordType || row.content || '').toLowerCase();
    if (recType.includes('công văn') || recType === '1.2 công văn') {
        type = 'congvan';
    } else if (recType.includes('vào sổ') || recType === 'vaoso') {
        type = 'vaoso';
    }

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

    // BẮT BUỘC: Nếu hồ sơ đã được chốt đợt giao/xuất (batchVal), bảo tồn trạng thái 'completed' (Đã giao 1 cửa)
    if (batchVal && st !== 'withdrawn' && st !== 'rejected') {
        st = 'completed';
    }

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
        isHandedOver: row.isHandedOver || st === 'completed'
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
    if (exportBatchVal && status !== RecordStatus.WITHDRAWN && status !== RecordStatus.REJECTED && status !== RecordStatus.RETURNED) {
        status = RecordStatus.HANDOVER;
    }

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
        isHandedOver: d.isHandedOver || status === RecordStatus.HANDOVER
    };

    return sanitizeData(payload, ARCHIVE_DB_COLUMNS);
};

export const mapRecordFileToArchiveDb = (r: RecordFile | Partial<RecordFile>): any => {
    return sanitizeData(r, ARCHIVE_DB_COLUMNS);
};

// --- API ---

export const migrateArchiveRecordsFromLandRecords = async () => {
    // Di chuyển và đồng bộ dữ liệu hồ sơ lưu trữ từ land_records sang luutru_records
    if (!isConfigured) return;
    try {
        const { data: landData, error: fetchError } = await supabase
            .from('land_records')
            .select('*');
            
        if (fetchError) {
            console.warn('Lỗi khi kiểm tra land_records cho migration lưu trữ:', fetchError);
            return;
        }
        if (!landData || landData.length === 0) return;

        // Lọc các hồ sơ thuộc loại Lưu trữ
        const archiveRecordsToMigrate = landData.filter((r: any) => 
            isArchiveRecordType(r.recordType) || 
            isArchiveRecordType(r.content) || 
            r.recordType === 'Cung cấp tài liệu đất đai' ||
            r.recordType === 'Cung cấp dữ liệu đất đai' ||
            r.recordType === '1.1 Sao lục' ||
            r.recordType === '1.2 Công văn' ||
            r.recordType === '1.1 Sao lục hồ sơ' ||
            r.recordType === '1.1 Cung cấp dữ liệu đất đai'
        );

        if (archiveRecordsToMigrate.length === 0) return;
        console.log(`[Archive Migration] Tìm thấy ${archiveRecordsToMigrate.length} hồ sơ lưu trữ trong land_records để chuyển sang luutru_records.`);

        const luutruPayloads = archiveRecordsToMigrate.map((r: any) => {
            return sanitizeData(r, ARCHIVE_DB_COLUMNS);
        });

        // Upsert vào luutru_records
        let { error: insertError } = await supabase
            .from('luutru_records')
            .upsert(luutruPayloads);
            
        if (insertError && (insertError.code === '22P02' || String(insertError.message || '').includes('22P02'))) {
            const clean = sanitizePayloadFor22P02(luutruPayloads);
            const res = await supabase.from('luutru_records').upsert(clean);
            insertError = res.error;
        }

        if (insertError) {
            console.error('Lỗi khi upsert vào luutru_records trong migration:', insertError);
            return;
        }

        // Xóa các hồ sơ này khỏi land_records để tránh phân mảnh và trùng lặp dữ liệu
        const idsToDelete = archiveRecordsToMigrate.map((r: any) => r.id);
        const { error: deleteError } = await supabase
            .from('land_records')
            .delete()
            .in('id', idsToDelete);
            
        if (deleteError) {
            console.warn('Cảnh báo khi xóa hồ sơ lưu trữ khỏi land_records:', deleteError);
        }

        console.log(`[Archive Migration] Đã di chuyển thành công ${archiveRecordsToMigrate.length} hồ sơ lưu trữ sang luutru_records.`);
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

export const fetchAllArchiveRecordsAsRecordFiles = async (): Promise<RecordFile[]> => {
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
            let query = supabase
                .from('luutru_records')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            try {
                query = query.order('receivedDate', { ascending: false, nullsFirst: false });
            } catch {
                // ignore sort error
            }

            const { data, error } = await query;

            if (error) {
                console.warn('Lỗi khi fetch all luutru_records:', error);
                const fallbackRes = await supabase.from('luutru_records').select('*').limit(1000);
                if (fallbackRes.data && fallbackRes.data.length > 0) {
                    allRecords = fallbackRes.data.map(item => mapArchiveDbToRecordFile(item));
                }
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

        // Khử trùng lặp 100% bằng Map theo id
        const uniqueMap = new Map<string, RecordFile>();
        allRecords.forEach(r => {
            if (r && r.id) {
                uniqueMap.set(r.id, r);
            }
        });

        const result = Array.from(uniqueMap.values());
        
        // Cập nhật bộ nhớ đệm RAM & IndexedDB
        if (result.length > 0) {
            memoryArchiveRecordsCache = result;
            setIndexedDBItem(CACHE_KEY_LUUTRU_RECORDS, result).catch(() => {});
        }

        return result;
    } catch (error: any) {
        logError('fetchAllArchiveRecordsAsRecordFiles', error, true);
        return memoryArchiveRecordsCache || [];
    }
};

export const fetchArchiveRecords = async (type: 'saoluc' | 'vaoso' | 'congvan'): Promise<ArchiveRecord[]> => {
    if (!isConfigured) {
        const cached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
    try {
        let allData: ArchiveRecord[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('luutru_records')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            // Sắp xếp an toàn theo receivedDate giảm dần (nếu có lỗi cột sẽ bỏ qua)
            try {
                query = query.order('receivedDate', { ascending: false, nullsFirst: false });
            } catch {
                // ignore
            }

            const { data, error } = await query;

            if (error) {
                console.warn('Lỗi khi fetch luutru_records:', error);
                // Thử fallback query đơn giản nếu có lỗi sắp xếp
                const fallbackRes = await supabase.from('luutru_records').select('*').limit(1000);
                if (fallbackRes.data && fallbackRes.data.length > 0) {
                    const mapped = fallbackRes.data.map(item => mapLuutruDbToArchiveRecord(item));
                    const filtered = mapped.filter(r => r.type === type);
                    allData = [...allData, ...filtered];
                }
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

        // Tự động kiểm tra thêm bản ghi lưu trữ chưa chuyển đổi từ land_records để không sót hồ sơ
        try {
            const { data: landData } = await supabase
                .from('land_records')
                .select('*')
                .or('recordType.ilike.%sao lục%,recordType.ilike.%công văn%,recordType.ilike.%1.1%,recordType.ilike.%1.2%,recordType.ilike.%cung cấp%')
                .limit(500);
            if (landData && landData.length > 0) {
                const mappedLand = landData.map(item => mapLuutruDbToArchiveRecord(item)).filter(r => r.type === type);
                allData = [...allData, ...mappedLand];
            }
        } catch (e) {
            // Không ngắt luồng nếu land_records không có
        }

        // Khử trùng lặp 100% bằng Map theo id hoặc số hiệu tránh trùng
        const uniqueMap = new Map<string, ArchiveRecord>();
        allData.forEach(r => {
            if (r && (r.id || r.so_hieu)) {
                const key = r.id || r.so_hieu;
                uniqueMap.set(key, r);
            }
        });
        const result = Array.from(uniqueMap.values());
        saveToCache(CACHE_KEY_ARCHIVE, result);
        return result;
    } catch (error: any) {
        logError(`fetchArchiveRecords-${type}`, error, true);
        const cached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
};

export const saveArchiveRecord = async (record: Partial<ArchiveRecord>): Promise<ArchiveRecord | null> => {
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
                return merged;
            }
        } else {
            const newRec = { 
                ...record, 
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9), 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);
            saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
            return newRec;
        }
        return null;
    }
    try {
        let fullRecord = record;
        if (record.id) {
            const { data: existingRows } = await supabase
                .from('luutru_records')
                .select('*')
                .eq('id', record.id)
                .single();
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

        if (record.id) {
            let { data, error } = await supabase.from('luutru_records').update(payload).eq('id', record.id).select();
            
            if (error && (error.code === '42703' || String(error.message || '').includes('column') || error.code === 'PGRST204')) {
                const fallbackPayload = { ...payload };
                OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fallbackPayload[col]);
                const res = await supabase.from('luutru_records').update(fallbackPayload).eq('id', record.id).select();
                data = res.data;
                error = res.error;
            }

            if (error && (error.code === '22P02' || String(error.message || '').includes('22P02'))) {
                const cleanPayload = sanitizePayloadFor22P02(payload);
                const res = await supabase.from('luutru_records').update(cleanPayload).eq('id', record.id).select();
                data = res.data;
                error = res.error;
            }

            if (error) throw error;
            const resRec = data && data.length > 0 ? mapLuutruDbToArchiveRecord(data[0]) : null;
            if (resRec && data && data.length > 0) {
                if (resRec.so_hieu && resRec.so_hieu.startsWith('LT-')) {
                    updateArchiveCounterIfHigher(resRec.so_hieu, resRec.ngay_thang);
                }
                const mappedFile = mapArchiveDbToRecordFile(data[0]);
                markRecordsRecentlyUpdated([mappedFile]);
            }
            memoryArchiveRecordsCache = null;
            return resRec;
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
            const resRec = data && data.length > 0 ? mapLuutruDbToArchiveRecord(data[0]) : null;
            if (resRec && data && data.length > 0) {
                if (resRec.so_hieu && resRec.so_hieu.startsWith('LT-')) {
                    updateArchiveCounterIfHigher(resRec.so_hieu, resRec.ngay_thang);
                }
                const mappedFile = mapArchiveDbToRecordFile(data[0]);
                markRecordsRecentlyUpdated([mappedFile]);
            }
            memoryArchiveRecordsCache = null;
            return resRec;
        }
    } catch (error: any) {
        logError("saveArchiveRecord", error);
        return null;
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
        records.forEach(r => {
            const newRec = { 
                ...r, 
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9), 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);
        });
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
    } catch (error) {
        logError("importArchiveRecords", error, true);
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
        const { data: currentRecords, error: fetchError } = await supabase
            .from('luutru_records')
            .select('*')
            .in('id', ids);
            
        if (fetchError) throw fetchError;
        if (!currentRecords || currentRecords.length === 0) return true;

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

        let { error: upsertError } = await supabase.from('luutru_records').upsert(updatedPayloads);
        if (upsertError && (upsertError.code === '42703' || String(upsertError.message || '').includes('column') || upsertError.code === 'PGRST204')) {
            const fallbackPayloads = updatedPayloads.map(p => {
                const fp = { ...p };
                OPTIONAL_ARCHIVE_COLUMNS.forEach(col => delete fp[col]);
                return fp;
            });
            const res = await supabase.from('luutru_records').upsert(fallbackPayloads);
            upsertError = res.error;
        }

        if (upsertError && (upsertError.code === '22P02' || String(upsertError.message || '').includes('22P02'))) {
            const cleanPayload = sanitizePayloadFor22P02(updatedPayloads);
            const res = await supabase.from('luutru_records').upsert(cleanPayload);
            upsertError = res.error;
        }

        if (upsertError) throw upsertError;
        const mappedFiles = updatedPayloads.map(p => mapArchiveDbToRecordFile(p));
        markRecordsRecentlyUpdated(mappedFiles);
        memoryArchiveRecordsCache = null;
        return true;
    } catch (error) {
        logError("updateArchiveRecordsBatch", error, true);
        return false;
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

export const fetchListsByDate = async (type: 'saoluc' | 'congvan' | 'vaoso', date: string): Promise<string[]> => {
    if (!isConfigured) {
        const lists = new Set<string>();
        MOCK_ARCHIVE.forEach(r => {
            if ((r.type === type || !type) && r.data?.danh_sach) {
                if (!date || r.data?.ngay_hoan_thanh === date || r.data?.exportDate === date) {
                    lists.add(r.data.danh_sach);
                }
            }
        });
        return Array.from(lists).sort();
    }

    try {
        const { data, error } = await supabase
            .from('luutru_records')
            .select('completedWorkDate, exportBatch, exportDate, data')
            .not('exportBatch', 'is', null);

        if (error) return [];

        const lists = new Set<string>();
        data?.forEach((r: any) => {
            const batchVal = r.exportBatch || r.data?.exportBatch || r.data?.danh_sach;
            const dateVal = r.exportDate || r.completedWorkDate || r.data?.ngay_hoan_thanh || r.data?.exportDate;
            
            if (batchVal) {
                if (!date || (dateVal && dateVal.startsWith(date))) {
                    lists.add(String(batchVal).trim());
                }
            }
        });
        
        return Array.from(lists).sort();
    } catch (error) {
        logError(`fetchListsByDate-${type}`, error, true);
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

export const createArchiveBatch = async (
    batchName: string,
    recordIds: string[],
    moduleType: string = 'archive',
    handoverDate: string = new Date().toISOString().split('T')[0]
): Promise<{ success: boolean; batchName: string; count: number }> => {
    try {
        const nowIso = new Date().toISOString();
        let finalBatchName = batchName ? batchName.trim() : '';
        
        if (!finalBatchName) {
            const existingBatches = await fetchLuutruHandoverBatches();
            const numbers = existingBatches
                .map(b => parseInt(b.batch.replace(/\D/g, ''), 10))
                .filter(n => !isNaN(n));
            const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
            finalBatchName = `Đợt ${maxNum + 1}`;
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

        if (recordIds.length > 0) {
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
        }

        return { success: true, batchName: finalBatchName, count: recordIds.length };
    } catch (error) {
        logError('createArchiveBatch', error, true);
        return { success: false, batchName, count: 0 };
    }
};
