import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache, sanitizeData, sanitizePayloadFor22P02, executeSupabaseOperationWithAutoClean } from './apiCore';
import { RecordFile, RecordStatus } from '../types';
import { isArchiveRecordType, getShortRecordType } from '../constants';

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

const ARCHIVE_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'customerAddress', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'receivedBy', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo', 'checkedBy',
    'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authorizedPersonName', 'authorizedPersonId', 'authorizedPersonPhone', 'authorizedPersonAddress', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'handoverWard',
    'measurementNumber', 'excerptNumber',
    'reminderDate', 'lastRemindedAt',
    'receiptNumber', 'resultReturnedDate', 'receiverName',
    'needsMapCorrection', 'explanationPlan',
    'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'isHandedOver', 'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch'
];

// --- CONVERSION HELPERS ---
export const mapArchiveDbToRecordFile = (row: any): RecordFile => {
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
        status: (row.status as RecordStatus) || RecordStatus.RECEIVED,
        notes: row.notes || null,
        privateNotes: row.privateNotes || null,
        personalNotes: row.personalNotes || null,
        authorizedBy: row.authorizedBy || null,
        authorizedPersonName: row.authorizedPersonName || row.authorized_person_name || null,
        authorizedPersonId: row.authorizedPersonId || row.authorized_person_id || null,
        authorizedPersonPhone: row.authorizedPersonPhone || row.authorized_person_phone || null,
        authorizedPersonAddress: row.authorizedPersonAddress || row.authorized_person_address || null,
        authDocType: row.authDocType || null,
        otherDocs: row.otherDocs || null,
        exportBatch: row.exportBatch || null,
        exportDate: row.exportDate || null,
        handoverWard: row.handoverWard || null,
        measurementNumber: row.measurementNumber || null,
        excerptNumber: row.excerptNumber || null,
        reminderDate: row.reminderDate || null,
        lastRemindedAt: row.lastRemindedAt || null,
        deadlineReminded: row.deadlineReminded || false,
        receiptNumber: row.receiptNumber || null,
        resultReturnedDate: row.resultReturnedDate || null,
        receiverName: row.receiverName || null,
        isHandedOver: row.isHandedOver || false,
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
    if (rawSt === 'assigned') st = 'assigned';
    else if (rawSt === 'in_progress' || rawSt === 'inprogress') st = 'assigned';
    else if (rawSt === 'executed' || rawSt === 'completed_work') st = 'executed';
    else if (rawSt === 'pending_supplement') st = 'pending_supplement';
    else if (rawSt === 'pending_check') st = 'pending_check';
    else if (rawSt === 'checked') st = 'checked';
    else if (rawSt === 'pending_sign') st = 'pending_sign';
    else if (rawSt === 'signed') st = 'signed';
    else if (rawSt === 'handover' || rawSt === 'handed_over' || rawSt === 'completed' || rawSt === 'returned') st = 'completed';
    else if (rawSt === 'withdrawn') st = 'withdrawn';
    else if (rawSt === 'rejected') st = 'rejected';

    const extraData = {
        ...(typeof row.data === 'object' && row.data !== null ? row.data : {}),
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
        ngay_hoan_thanh: row.completedWorkDate,
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
        exportBatch: row.exportBatch,
        exportDate: row.exportDate,
        resultReturnedDate: row.resultReturnedDate,
        receiverName: row.receiverName,
        receiptNumber: row.receiptNumber,
        isHandedOver: row.isHandedOver
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
        exportBatch: row.exportBatch || null,
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
    else if (rawSt === 'checked') status = RecordStatus.CHECKED;
    else if (rawSt === 'pending_sign') status = RecordStatus.PENDING_SIGN;
    else if (rawSt === 'signed') status = RecordStatus.SIGNED;
    else if (rawSt === 'completed') status = RecordStatus.RETURNED;
    else if (rawSt === 'handover') status = RecordStatus.HANDOVER;
    else if (rawSt === 'withdrawn') status = RecordStatus.WITHDRAWN;
    else if (rawSt === 'rejected') status = RecordStatus.REJECTED;

    const payload = {
        id: r.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)),
        code: r.so_hieu || d.code || '',
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
        exportBatch: r.exportBatch || d.exportBatch || null,
        exportDate: d.exportDate || null,
        resultReturnedDate: d.resultReturnedDate || null,
        receiverName: d.receiverName || null,
        receiptNumber: d.receiptNumber || null,
        isHandedOver: d.isHandedOver || false
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
        // Chỉ chọn id, recordType, code, content để lọc nhanh light-weight
        const { data: landMeta, error: fetchError } = await supabase
            .from('land_records')
            .select('id, recordType, code, content');
            
        if (fetchError || !landMeta || landMeta.length === 0) return;

        // Lọc các hồ sơ thuộc loại Lưu trữ
        const candidateIds = landMeta.filter((r: any) => 
            isArchiveRecordType(r.recordType) || 
            isArchiveRecordType(r.content) || 
            (r.code || '').startsWith('1.') ||
            r.recordType === 'Cung cấp tài liệu đất đai' ||
            r.recordType === 'Cung cấp dữ liệu đất đai' ||
            r.recordType === '1.1 Sao lục' ||
            r.recordType === '1.2 Công văn' ||
            r.recordType === '1.1 Sao lục hồ sơ' ||
            r.recordType === '1.1 Cung cấp dữ liệu đất đai'
        ).map((r: any) => r.id);

        if (candidateIds.length === 0) return;
        console.log(`[Archive Migration] Tìm thấy ${candidateIds.length} hồ sơ lưu trữ trong land_records để chuyển sang luutru_records.`);

        // Lấy chi tiết đầy đủ chỉ cho các hồ sơ cần di chuyển
        const { data: archiveRecordsToMigrate } = await supabase
            .from('land_records')
            .select('*')
            .in('id', candidateIds);

        if (!archiveRecordsToMigrate || archiveRecordsToMigrate.length === 0) return;

        const luutruPayloads = archiveRecordsToMigrate.map((r: any) => {
            return sanitizeData(r, ARCHIVE_DB_COLUMNS);
        });

        // Upsert theo Batch (100 items/lần)
        const batchSize = 100;
        for (let i = 0; i < luutruPayloads.length; i += batchSize) {
            const chunk = luutruPayloads.slice(i, i + batchSize);
            const { error: insertError } = await executeSupabaseOperationWithAutoClean(
                async (p) => await supabase.from('luutru_records').upsert(p),
                chunk
            );
            if (insertError) {
                console.error('Lỗi khi upsert chunk vào luutru_records trong migration:', insertError);
            }
        }

        // Xóa các hồ sơ này khỏi land_records
        const idsToDelete = archiveRecordsToMigrate.map((r: any) => r.id);
        for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const chunkIds = idsToDelete.slice(i, i + batchSize);
            await supabase.from('land_records').delete().in('id', chunkIds);
        }

        console.log(`[Archive Migration] Đã di chuyển thành công ${archiveRecordsToMigrate.length} hồ sơ lưu trữ sang luutru_records.`);
    } catch (error: any) {
        console.error('Lỗi trong quá trình di chuyển hồ sơ lưu trữ sang luutru_records:', error);
    }
};

// Giữ alias tương thích
export const migrateCungCapTaiLieu = migrateArchiveRecordsFromLandRecords;

export const fetchArchiveRecords = async (type: 'saoluc' | 'vaoso' | 'congvan', onProgress?: (loaded: ArchiveRecord[]) => void): Promise<ArchiveRecord[]> => {
    if (!isConfigured) {
        const { getFromCacheAsync } = await import('./apiCore');
        const cached = await getFromCacheAsync<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
    try {
        let allData: ArchiveRecord[] = [];
        let page = 0;
        const pageSize = 500;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('luutru_records')
                .select('*')
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.warn('Lỗi khi fetch luutru_records:', error);
                throw error;
            }
            
            if (data && data.length > 0) {
                const mapped = data.map(item => mapLuutruDbToArchiveRecord(item));
                const filtered = mapped.filter(r => r.type === type);
                allData = [...allData, ...filtered];
                if (onProgress) {
                    onProgress(allData);
                }
                if (data.length < pageSize) hasMore = false;
                else page++;
            } else {
                hasMore = false;
            }
        }
        saveToCache(CACHE_KEY_ARCHIVE, allData);
        return allData;
    } catch (error: any) {
        logError(`fetchArchiveRecords-${type}`, error, true);
        const { getFromCacheAsync } = await import('./apiCore');
        const cached = await getFromCacheAsync<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
};

export const saveArchiveRecord = async (record: Partial<ArchiveRecord>): Promise<ArchiveRecord | null> => {
    if (!isConfigured) {
        if (record.id) {
            const idx = MOCK_ARCHIVE.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                MOCK_ARCHIVE[idx] = { ...MOCK_ARCHIVE[idx], ...record } as ArchiveRecord;
                saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
                return MOCK_ARCHIVE[idx];
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
        const payload = mapArchiveRecordToLuutruDb(record);

        if (record.id) {
            const { data, error } = await executeSupabaseOperationWithAutoClean(
                async (p) => await supabase.from('luutru_records').update(p).eq('id', record.id!).select(),
                payload
            );
            if (error) throw error;
            return data && data.length > 0 ? mapLuutruDbToArchiveRecord(data[0]) : null;
        } else {
            const { data, error } = await executeSupabaseOperationWithAutoClean(
                async (p) => await supabase.from('luutru_records').insert([p]).select(),
                payload
            );
            if (error) throw error;
            return data && data.length > 0 ? mapLuutruDbToArchiveRecord(data[0]) : null;
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

        const { error } = await executeSupabaseOperationWithAutoClean(
            async (p) => await supabase.from('luutru_records').insert(p),
            payload
        );
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

        const { error: upsertError } = await executeSupabaseOperationWithAutoClean(
            async (p) => await supabase.from('luutru_records').upsert(p),
            updatedPayloads
        );

        if (upsertError) throw upsertError;
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

export const fetchListsByDate = async (type: 'saoluc' | 'congvan', date: string): Promise<string[]> => {
    if (!isConfigured) {
        const lists = new Set<string>();
        MOCK_ARCHIVE.forEach(r => {
            if (r.type === type && r.data?.ngay_hoan_thanh === date && r.data?.danh_sach) {
                lists.add(r.data.danh_sach);
            }
        });
        return Array.from(lists).sort();
    }

    try {
        const { data, error } = await supabase
            .from('luutru_records')
            .select('completedWorkDate, notes')
            .not('completedWorkDate', 'is', null);

        if (error) return [];

        const lists = new Set<string>();
        data?.forEach((r: any) => {
            if (r.completedWorkDate?.startsWith(date) && r.notes) {
                lists.add(r.notes);
            }
        });
        
        return Array.from(lists).sort();
    } catch (error) {
        logError(`fetchListsByDate-${type}`, error, true);
        return [];
    }
};
