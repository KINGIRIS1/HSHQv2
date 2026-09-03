import { supabase, isConfigured } from './supabaseClient';
import { RecordFile } from '../types';
import { MOCK_RECORDS, API_BASE_URL, isArchiveRecordType } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, sanitizePayloadFor22P02, normalizeCode, mapRecordFromDb } from './apiCore';

const RECORD_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'customerAddress', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'receivedBy', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo', 'checkedBy',
    'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'handoverWard',
    'measurementNumber', 'excerptNumber',
    'reminderDate', 'lastRemindedAt', 'deadlineReminded',
    'receiptNumber', 'resultReturnedDate', 'receiverName',
    'needsMapCorrection', 'explanationPlan',
    'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'price', 'advancePayment', 'isHandedOver',
    'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch'
];

export const getTargetTable = (record: Partial<RecordFile>): 'dangky_records' | 'land_records' | 'luutru_records' => {
    if (record.sourceTable === 'luutru_records' || record.sourceTable === 'archive_records') return 'luutru_records';
    if (record.sourceTable === 'dangky_records') return 'dangky_records';
    if (record.sourceTable === 'land_records') return 'land_records';

    // Check if recordType or content is an archive type
    if (isArchiveRecordType(record.recordType) || isArchiveRecordType(record.content)) {
        return 'luutru_records';
    }

    if (record.id || record.code) {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        const found = cached.find(r => (record.id && r.id === record.id) || (record.code && r.code === record.code));
        if (found) {
            if (found.sourceTable === 'luutru_records' || found.sourceTable === 'archive_records') return 'luutru_records';
            if (found.sourceTable === 'dangky_records' || found.sourceTable === 'land_records') return found.sourceTable;
            if (isArchiveRecordType(found.recordType) || isArchiveRecordType(found.content)) {
                return 'luutru_records';
            }
        }
    }
    return 'land_records';
};

const OPTIONAL_NEW_COLUMNS = [
    'customerAddress', 'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'needsMapCorrection', 'explanationPlan', 'receiptNumber', 'resultReturnedDate', 'receiverName',
    'reminderDate', 'lastRemindedAt', 'deadlineReminded', 'measurementNumber', 'excerptNumber',
    'authorizedBy', 'authDocType', 'otherDocs',
    'privateNotes', 'personalNotes', 'checkedBy', 'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'price', 'advancePayment', 'isHandedOver',
    'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch'
];

// --- CẤU HÌNH PHÂN NHÓM TẢI 3 GIAI ĐOẠN ƯU TIÊN ---
// Giai đoạn 1 (Ưu tiên 1): Tiếp nhận mới, đang thực hiện, đã giao 1 cửa
export const TIER_1_STATUSES = [
    'RECEIVED', 'received',
    'ASSIGNED', 'assigned',
    'IN_PROGRESS', 'in_progress',
    'COMPLETED_WORK', 'completed_work',
    'PENDING_SUPPLEMENT', 'pending_supplement',
    'HANDOVER', 'handover'
];

// Giai đoạn 2 (Ưu tiên 2): Tiếp tục tới kiểm tra, trình ký, chờ bàn giao
export const TIER_2_STATUSES = [
    'PENDING_CHECK', 'pending_check',
    'CHECKED', 'checked',
    'PENDING_SIGN', 'pending_sign',
    'SIGNED', 'signed',
    'GIAO_HS', 'giao_hs',
    'REJECTED', 'rejected',
    'WITHDRAWN', 'withdrawn'
];

// Giai đoạn 3 (Ưu tiên 3): Đã trả kết quả (và các trạng thái hoàn tất còn lại nếu có)
export const TIER_3_STATUSES = [
    'RETURNED', 'returned'
];

const applyTierFilter = (query: any, tier: 1 | 2 | 3) => {
    if (tier === 1) {
        return query.in('status', TIER_1_STATUSES);
    } else if (tier === 2) {
        return query.in('status', TIER_2_STATUSES);
    } else {
        // Tier 3: RETURNED và các bản ghi còn lại (hoặc status null / rỗng)
        const excluded = [...TIER_1_STATUSES, ...TIER_2_STATUSES];
        return query.or(`status.not.in.(${excluded.join(',')}),status.is.null`);
    }
};

const fetchPageWithRetry = async (
    table: 'dangky_records' | 'land_records' | 'luutru_records',
    tier: 1 | 2 | 3,
    from: number,
    to: number,
    retries = 3,
    delayMs = 300
): Promise<any[]> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            let q = supabase.from(table).select('*');
            q = applyTierFilter(q, tier);
            const { data, error: pageErr } = await q
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true })
                .range(from, to);

            if (pageErr) {
                if (attempt === retries) {
                    console.warn(`Lỗi fetch trang ${from}-${to} của ${table} (Tier ${tier}, lần ${attempt}/${retries}):`, pageErr);
                    return [];
                }
                await new Promise(res => setTimeout(res, delayMs * attempt));
                continue;
            }
            return (data || []).map(item => ({ ...item, sourceTable: table }));
        } catch (err: any) {
            if (attempt === retries) {
                console.warn(`Lỗi ngoại lệ fetch trang ${from}-${to} của ${table} (Tier ${tier}):`, err);
                return [];
            }
            await new Promise(res => setTimeout(res, delayMs * attempt));
        }
    }
    return [];
};

const fetchTableRecordsByTier = async (
    table: 'dangky_records' | 'land_records' | 'luutru_records',
    tier: 1 | 2 | 3
): Promise<any[]> => {
    const step = 1000;
    try {
        let firstData: any[] | null = null;
        let count: number | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                let q = supabase.from(table).select('*', { count: 'exact' });
                q = applyTierFilter(q, tier);
                const res = await q
                    .order('receivedDate', { ascending: false })
                    .order('id', { ascending: true })
                    .range(0, step - 1);

                if (res.error) {
                    if (res.error.code === 'PGRST205' || res.error.code === '42P01' || res.error.message?.includes('does not exist')) {
                        return [];
                    }
                    if (attempt < 3) {
                        await new Promise(r => setTimeout(r, 250 * attempt));
                        continue;
                    }
                    throw res.error;
                }

                firstData = res.data;
                count = res.count;
                break;
            } catch (err) {
                if (attempt < 3) {
                    await new Promise(r => setTimeout(r, 250 * attempt));
                } else {
                    throw err;
                }
            }
        }

        if (!firstData || firstData.length === 0) return [];
        const mappedFirst = firstData.map(item => ({ ...item, sourceTable: table }));
        if (!count || count <= step) {
            return mappedFirst;
        }

        // Tạo danh sách các khoảng phân trang cần tải song song
        const ranges: { from: number; to: number }[] = [];
        for (let from = step; from < count; from += step) {
            const to = Math.min(from + step - 1, count - 1);
            ranges.push({ from, to });
        }

        // Tải theo nhóm song song (concurrency = 4) để tốc độ tối ưu nhất
        const concurrency = 4;
        const remainingPages: any[][] = [];
        for (let i = 0; i < ranges.length; i += concurrency) {
            const chunk = ranges.slice(i, i + concurrency);
            const chunkResults = await Promise.all(
                chunk.map(r => fetchPageWithRetry(table, tier, r.from, r.to))
            );
            remainingPages.push(...chunkResults);
        }

        return [mappedFirst, ...remainingPages].flat();
    } catch (err: any) {
        console.warn(`Lỗi fetch ${table} tier ${tier}:`, err);
        return [];
    }
};

const fetchTierData = async (tier: 1 | 2 | 3): Promise<RecordFile[]> => {
    const [dangky, land, luutru] = await Promise.all([
        fetchTableRecordsByTier('dangky_records', tier),
        fetchTableRecordsByTier('land_records', tier),
        fetchTableRecordsByTier('luutru_records', tier)
    ]);
    const rawList = [...dangky, ...land, ...luutru];
    return rawList.map(item => mapRecordFromDb(item));
};

export type TierProgressCallback = (tier: 1 | 2 | 3, recordsSoFar: RecordFile[], isComplete: boolean) => void;

export const fetchRecords = async (onProgress?: TierProgressCallback): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình.");
      return [];
  }

  try {
    const uniqueMap = new Map<string, RecordFile>();

    // 🚀 GIAI ĐOẠN 1 (Ưu tiên 1): Tiếp nhận mới, đang thực hiện, đã giao 1 cửa
    const tier1 = await fetchTierData(1);
    tier1.forEach(r => { if (r.id) uniqueMap.set(r.id, r); });
    const listTier1 = Array.from(uniqueMap.values());
    console.log(`[Tier 1 Ready] Đã nạp xong ${listTier1.length} hồ sơ ưu tiên 1 (tiếp nhận mới, đang thực hiện, đã giao 1 cửa)`);
    onProgress?.(1, listTier1, false);

    // 🚀 GIAI ĐOẠN 2 (Ưu tiên 2): Tiếp tục tới kiểm tra, trình ký, chờ bàn giao
    const tier2 = await fetchTierData(2);
    tier2.forEach(r => { if (r.id) uniqueMap.set(r.id, r); });
    const listTier2 = Array.from(uniqueMap.values());
    console.log(`[Tier 2 Ready] Đã nạp xong tổng cộng ${listTier2.length} hồ sơ (+ kiểm tra, trình ký, chờ bàn giao)`);
    onProgress?.(2, listTier2, false);

    // 🚀 GIAI ĐOẠN 3 (Ưu tiên 3): Đã trả kết quả (tải ngầm sau cùng trong nền)
    const tier3 = await fetchTierData(3);
    tier3.forEach(r => { if (r.id) uniqueMap.set(r.id, r); });
    const finalRecords = Array.from(uniqueMap.values());
    console.log(`[Tier 3 Complete] Đã nạp đầy đủ toàn bộ ${finalRecords.length} hồ sơ hệ thống`);

    if (finalRecords.length > 0) {
        saveToCache(CACHE_KEYS.RECORDS, finalRecords);
    }
    onProgress?.(3, finalRecords, true);
    return finalRecords;

  } catch (error) {
    logError("fetchRecords", error, true);
    const cached = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
    return cached.length > 0 ? cached : MOCK_RECORDS;
  }
};

export const getShortCode = (ward: string) => {
    const normalized = ward.toLowerCase().trim();
    const cleanName = normalized
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

    if (cleanName.includes('tân khai') || cleanName.includes('tankhai')) return 'TK';
    if (cleanName.includes('tân hưng') || cleanName.includes('tanhung')) return 'TH';
    if (cleanName.includes('minh đức') || cleanName.includes('minhduc')) return 'MĐ';
    if (cleanName.includes('tân quan') || cleanName.includes('tanquan')) return 'TQ';

    if (cleanName.includes('minh hưng') || cleanName.includes('minhhung')) return 'MH';
    if (cleanName.includes('chơn thành') || cleanName.includes('chonthanh') || cleanName.includes('hưng long')) return 'CT';
    if (cleanName.includes('nha bích') || cleanName.includes('nhabich')) return 'NB';
    if (cleanName.includes('minh lập') || cleanName.includes('minhlap')) return 'ML';
    if (cleanName.includes('minh thắng') || cleanName.includes('minhthang')) return 'MT';
    if (cleanName.includes('quang minh') || cleanName.includes('quangminh')) return 'QM';
    if (cleanName.includes('thành tâm') || cleanName.includes('thanhtam')) return 'TT';
    if (cleanName.includes('minh long') || cleanName.includes('minhlong')) return 'MLO';
    
    return 'CT';
};

export const getNextGlobalRecordCode = async (dateStr: string): Promise<string> => {
    if (!isConfigured) {
        const d = new Date(dateStr);
        const yy = d.getFullYear().toString().slice(-2);
        const mm = ('0' + (d.getMonth() + 1)).slice(-2);
        const dd = ('0' + d.getDate()).slice(-2);
        return `${yy}${mm}${dd}-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
    }

    const d = new Date(dateStr);
    const year = d.getFullYear().toString();
    const yy = year.slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;
    
    const key = `record_counter_${year}`;
    let nextSeq = 1;
    let success = false;
    let attempts = 0;

    while (!success && attempts < 5) {
        attempts++;
        try {
            const { data } = await supabase.from('system_settings').select('value').eq('key', key).single();
            
            let currentVal = 0;
            if (data && data.value) {
                currentVal = parseInt(data.value, 10);
                if (isNaN(currentVal)) currentVal = 0;
            }

            nextSeq = currentVal + 1;

            if (data) {
                const { data: updatedData, error } = await supabase
                    .from('system_settings')
                    .update({ value: nextSeq.toString() })
                    .eq('key', key)
                    .eq('value', data.value)
                    .select();
                    
                if (!error && updatedData && updatedData.length > 0) {
                    success = true;
                }
            } else {
                const { data: insertedData, error } = await supabase
                    .from('system_settings')
                    .insert([{ key, value: nextSeq.toString() }])
                    .select();
                    
                if (!error && insertedData && insertedData.length > 0) {
                    success = true;
                }
            }
        } catch (e) {
            // Ignore and retry
        }

        if (!success) {
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
        }
    }

    const seqStr = nextSeq.toString().padStart(4, '0');
    return `${datePrefix}-${seqStr}`;
};

// --- CACHE SYNCHRONIZATION HELPERS ---
const syncCacheOnCreate = (newRecord: RecordFile) => {
    try {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        if (!cached.some(r => r.id === newRecord.id)) {
            cached.unshift(newRecord);
            saveToCache(CACHE_KEYS.RECORDS, cached);
        }
    } catch (e) {
        console.error("Error syncing cache for created record", e);
    }
};

const syncCacheOnUpdate = (updatedRecord: RecordFile) => {
    try {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        const index = cached.findIndex(r => r.id === updatedRecord.id);
        if (index !== -1) {
            cached[index] = { ...cached[index], ...updatedRecord };
        } else {
            cached.unshift(updatedRecord);
        }
        saveToCache(CACHE_KEYS.RECORDS, cached);
    } catch (e) {
        console.error("Error syncing cache for updated record", e);
    }
};

const syncCacheOnDelete = (id: string) => {
    try {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        const filtered = cached.filter(r => r.id !== id);
        saveToCache(CACHE_KEYS.RECORDS, filtered);
    } catch (e) {
        console.error("Error syncing cache for deleted record", e);
    }
};

const syncCacheOnBatchUpdate = (batchUpdates: Partial<RecordFile>[]) => {
    try {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        if (cached && cached.length > 0) {
            batchUpdates.forEach(up => {
                const index = cached.findIndex(r => r.id === up.id);
                if (index !== -1) {
                    cached[index] = { ...cached[index], ...up } as RecordFile;
                }
            });
            saveToCache(CACHE_KEYS.RECORDS, cached);
        }
    } catch (e) {
        console.error("Error syncing cache for batch update", e);
    }
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    let recordToSave: RecordFile = record;
    try {
        let finalCode = record.code;
        const isGeneratedFormat = finalCode && (/^[A-ZĐ]{2,3}-\d{6}-\d{3,4}$/.test(finalCode) || /^\d{6}-\d{3,4}$/.test(finalCode));
        
        if (!finalCode || finalCode.includes('?') || isGeneratedFormat) {
            finalCode = await getNextGlobalRecordCode(record.receivedDate || new Date().toISOString());
        }
        
        recordToSave = { ...record, code: finalCode };
        if (!recordToSave.id) {
            recordToSave.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
        }
        
        const targetTable = getTargetTable(recordToSave);
        const payload = sanitizeData(recordToSave, RECORD_DB_COLUMNS);
        let { data, error } = await supabase.from(targetTable).insert([payload]).select();
        
        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
            console.warn(`⚠️ [22P02 Fallback] Retrying insert into ${targetTable} with 22P02 sanitized payload...`);
            const fallback22P02Payload = sanitizePayloadFor22P02(payload);
            const res = await supabase.from(targetTable).insert([fallback22P02Payload]).select();
            data = res.data;
            error = res.error;
        }

        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn(`⚠️ [Fallback] Database is missing columns. Retrying insert into ${targetTable} without new columns...`);
            if (!(window as any).fallbackAlertShown) {
                logError("createRecordApi", error, true);
                (window as any).fallbackAlertShown = true;
            }
            const fallbackPayload = sanitizePayloadFor22P02({ ...payload });
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const { data: fallbackData, error: fallbackError } = await supabase.from(targetTable).insert([fallbackPayload]).select();
            if (fallbackError) throw fallbackError;
            const result = mapRecordFromDb({ ...recordToSave, ...(fallbackData?.[0] || {}), sourceTable: targetTable }) as RecordFile;
            if (result) syncCacheOnCreate(result);
            return result;
        }
        
        if (error) throw error;
        const result = mapRecordFromDb({ ...recordToSave, ...(data?.[0] || {}), sourceTable: targetTable }) as RecordFile;
        if (result) syncCacheOnCreate(result);
        return result;
    } catch (error) {
        logError("createRecordApi", error, true);
        syncCacheOnCreate(recordToSave);
        return recordToSave;
    }
};

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        const targetTable = getTargetTable(record);
        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        let { data, error } = await supabase.from(targetTable).update(payload).eq('id', record.id).select();
        
        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
            console.warn(`⚠️ [22P02 Fallback] Retrying update on ${targetTable} with 22P02 sanitized payload...`);
            const fallback22P02Payload = sanitizePayloadFor22P02(payload);
            const res = await supabase.from(targetTable).update(fallback22P02Payload).eq('id', record.id).select();
            data = res.data;
            error = res.error;
        }

        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn(`⚠️ [Fallback] Database is missing columns. Retrying update on ${targetTable} without new columns...`);
            if (!(window as any).fallbackAlertShown) {
                logError("updateRecordApi", error, true);
                (window as any).fallbackAlertShown = true;
            }
            const fallbackPayload = sanitizePayloadFor22P02({ ...payload });
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const { data: fallbackData, error: fallbackError } = await supabase.from(targetTable).update(fallbackPayload).eq('id', record.id).select();
            if (fallbackError) throw fallbackError;
            const result = mapRecordFromDb({ ...record, ...(fallbackData?.[0] || {}), sourceTable: targetTable }) as RecordFile;
            if (result) syncCacheOnUpdate(result);
            return result;
        }
        
        if (error) throw error;
        const result = mapRecordFromDb({ ...record, ...(data?.[0] || {}), sourceTable: targetTable }) as RecordFile;
        if (result) syncCacheOnUpdate(result);
        return result;
    } catch (error) {
        logError("updateRecordApi", error, true);
        syncCacheOnUpdate(record);
        return record;
    }
};

export const updateRecordFieldsApi = async (id: string, fields: Partial<RecordFile>): Promise<RecordFile | null> => {
    if (!isConfigured) {
        const fallbackRecord = { id, ...fields } as RecordFile;
        syncCacheOnUpdate(fallbackRecord);
        return fallbackRecord;
    }
    try {
        const targetTable = getTargetTable({ id, ...fields });
        const payload = sanitizeData({ id, ...fields } as any, RECORD_DB_COLUMNS);
        delete payload.id;
        let { data, error } = await supabase.from(targetTable).update(payload).eq('id', id).select();
        
        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
            console.warn(`⚠️ [22P02 Fallback] Retrying updateRecordFieldsApi on ${targetTable} with 22P02 sanitized payload...`);
            const fallback22P02Payload = sanitizePayloadFor22P02(payload);
            const res = await supabase.from(targetTable).update(fallback22P02Payload).eq('id', id).select();
            data = res.data;
            error = res.error;
        }

        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn(`⚠️ [Fallback] Database is missing columns on ${targetTable}. Retrying without new columns...`);
            const fallbackPayload = sanitizePayloadFor22P02({ ...payload });
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const { data: fallbackData, error: fallbackError } = await supabase.from(targetTable).update(fallbackPayload).eq('id', id).select();
            if (fallbackError) throw fallbackError;
            const result = mapRecordFromDb({ id, ...fields, ...(fallbackData?.[0] || {}), sourceTable: targetTable }) as RecordFile;
            if (result) syncCacheOnUpdate(result);
            return result;
        }
        
        if (error) throw error;
        const result = mapRecordFromDb({ id, ...fields, ...(data?.[0] || {}), sourceTable: targetTable }) as RecordFile;
        if (result) syncCacheOnUpdate(result);
        return result;
    } catch (error) {
        logError("updateRecordFieldsApi", error, true);
        const fallbackRecord = { id, ...fields } as RecordFile;
        syncCacheOnUpdate(fallbackRecord);
        return fallbackRecord;
    }
};

export const deleteRecordApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error: landErr } = await supabase.from('land_records').delete().eq('id', id);
        if (landErr) {
            await supabase.from('dangky_records').delete().eq('id', id);
        }
        await supabase.from('luutru_records').delete().eq('id', id);
        syncCacheOnDelete(id);
        return true;
    } catch (error) {
        logError("deleteRecordApi", error, true);
        syncCacheOnDelete(id);
        return true;
    }
};

export const createRecordsBatchApi = async (records: RecordFile[], onProgress?: (processed: number, total: number) => void): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const landPayload: any[] = [];
        const dangkyPayload: any[] = [];
        const luutruPayload: any[] = [];
        
        for (const r of records) {
            let finalCode = r.code;
            if (!finalCode || finalCode.includes('?')) {
                finalCode = await getNextGlobalRecordCode(r.receivedDate || new Date().toISOString());
            }
            
            const recordPayload = { ...r, code: finalCode };
            if (!recordPayload.id) {
                recordPayload.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            }
            
            const targetTable = getTargetTable(recordPayload);
            if (targetTable === 'luutru_records') {
                luutruPayload.push(sanitizeData(recordPayload, RECORD_DB_COLUMNS));
            } else if (targetTable === 'dangky_records') {
                dangkyPayload.push(sanitizeData(recordPayload, RECORD_DB_COLUMNS));
            } else {
                landPayload.push(sanitizeData(recordPayload, RECORD_DB_COLUMNS));
            }
        }

        const insertIntoTableInChunks = async (table: 'land_records' | 'dangky_records' | 'luutru_records', payload: any[]) => {
            const CHUNK_SIZE = 500;
            for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
                const chunk = payload.slice(i, i + CHUNK_SIZE);
                let { error } = await supabase.from(table).insert(chunk);
                
                if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
                    console.warn(`⚠️ [22P02 Fallback] Retrying batch insert into ${table} chunk ${i} with 22P02 sanitized payload...`);
                    const fallback22P02 = sanitizePayloadFor22P02(chunk);
                    const res = await supabase.from(table).insert(fallback22P02);
                    error = res.error;
                }

                if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
                    console.warn(`⚠️ [Fallback] Database is missing columns on ${table}. Retrying batch insert chunk ${i} without new columns...`);
                    const fallbackPayload = chunk.map(p => {
                        const fp = sanitizePayloadFor22P02({ ...p });
                        OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                        return fp;
                    });
                    const { error: fallbackError } = await supabase.from(table).insert(fallbackPayload);
                    if (fallbackError) throw fallbackError;
                } else if (error) {
                    if (table === 'dangky_records' && (error.code === '42P01' || error.code === 'PGRST205')) {
                        await supabase.from('land_records').insert(chunk);
                        return;
                    }
                    throw error;
                }
            }
        };

        if (landPayload.length > 0) {
            await insertIntoTableInChunks('land_records', landPayload);
        }
        if (dangkyPayload.length > 0) {
            await insertIntoTableInChunks('dangky_records', dangkyPayload);
        }
        if (luutruPayload.length > 0) {
            await insertIntoTableInChunks('luutru_records', luutruPayload);
        }

        if (onProgress) {
            onProgress(records.length, records.length);
        }
        
        // Synchronize local cache with the batch of new records
        try {
            const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
            records.forEach(r => {
                if (!cached.some(c => c.id === r.id)) {
                    cached.unshift(r);
                }
            });
            saveToCache(CACHE_KEYS.RECORDS, cached);
        } catch (e) {
            console.error("Error syncing cache for batch create", e);
        }
        
        return true;
    } catch (error) {
        logError("createRecordsBatchApi", error);
        return false;
    }
};

export const forceUpdateRecordsBatchApi = async (records: RecordFile[], onProgress?: (processed: number, total: number) => void): Promise<{ success: boolean, count: number }> => {
    if (!isConfigured) return { success: true, count: 0 };
    
    const isSupabase = API_BASE_URL.includes('supabase.co');
    if (!isSupabase) {
        return { success: true, count: 0 };
    }

    const getCodeSearchVariants = (code: string): string[] => {
        if (!code) return [];
        const clean = code.trim();
        const variants = new Set<string>();
        
        variants.add(clean);
        variants.add(clean.toLowerCase());
        variants.add(clean.toUpperCase());
        
        const noSpaces = clean.replace(/\s+/g, '');
        variants.add(noSpaces);
        variants.add(noSpaces.toLowerCase());
        variants.add(noSpaces.toUpperCase());

        if (clean.includes('-')) {
            const parts = clean.split('-');
            const withSpaces = parts.map(p => p.trim()).join(' - ');
            variants.add(withSpaces);
            variants.add(withSpaces.toLowerCase());
            variants.add(withSpaces.toUpperCase());
            
            const spaceInstead = parts.map(p => p.trim()).join(' ');
            variants.add(spaceInstead);
            variants.add(spaceInstead.toLowerCase());
            variants.add(spaceInstead.toUpperCase());
        } else {
            const match = clean.match(/^([A-Za-z]+)(\d+)$/);
            if (match) {
                const withDash = `${match[1]}-${match[2]}`;
                variants.add(withDash);
                variants.add(withDash.toLowerCase());
                variants.add(withDash.toUpperCase());

                const withDashSpaces = `${match[1]} - ${match[2]}`;
                variants.add(withDashSpaces);
                variants.add(withDashSpaces.toLowerCase());
                variants.add(withDashSpaces.toUpperCase());
            }

            if (clean.includes(' ')) {
                const withDash = clean.replace(/\s+/g, '-');
                variants.add(withDash);
                variants.add(withDash.toLowerCase());
                variants.add(withDash.toUpperCase());
            }
        }

        return Array.from(variants);
    };

    try {
        const rawCodes = records.map(r => r.code).filter(c => c);
        if (rawCodes.length === 0) return { success: true, count: 0 };

        let updateCount = 0;
        const CHUNK_SIZE = 500;

        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
            const chunkRecords = records.slice(i, i + CHUNK_SIZE);
            const chunkCodes = chunkRecords.map(r => r.code).filter(c => c);
            
            const searchCodesSet = new Set<string>();
            chunkCodes.forEach(code => {
                getCodeSearchVariants(code).forEach(variant => {
                    searchCodesSet.add(variant);
                });
                searchCodesSet.add(normalizeCode(code));
            });
            const searchCodes = Array.from(searchCodesSet);

            if (searchCodes.length === 0) {
                if (onProgress) onProgress(Math.min(i + CHUNK_SIZE, records.length), records.length);
                continue;
            }

            const [{ data: existingLand, error: landError }, { data: existingLuutru, error: luutruError }, { data: existingDangky, error: dangkyError }] = await Promise.all([
                supabase.from('land_records').select('*').in('code', searchCodes),
                supabase.from('luutru_records').select('*').in('code', searchCodes),
                supabase.from('dangky_records').select('*').in('code', searchCodes)
            ]);

            if (landError) throw landError;

            const dbMap = new Map<string, { record: any; table: 'land_records' | 'luutru_records' | 'dangky_records' }>();
            if (existingLand) {
                existingLand.forEach((r: any) => {
                    if (r.code) dbMap.set(normalizeCode(r.code), { record: r, table: 'land_records' });
                });
            }
            if (existingLuutru) {
                existingLuutru.forEach((r: any) => {
                    if (r.code) dbMap.set(normalizeCode(r.code), { record: r, table: 'luutru_records' });
                });
            }
            if (existingDangky) {
                existingDangky.forEach((r: any) => {
                    if (r.code) dbMap.set(normalizeCode(r.code), { record: r, table: 'dangky_records' });
                });
            }

            const landUpdates: any[] = [];
            const luutruUpdates: any[] = [];
            const dangkyUpdates: any[] = [];

            chunkRecords.forEach((excelRecord) => {
                const normCode = normalizeCode(excelRecord.code);
                const dbEntry = dbMap.get(normCode);
                
                if (dbEntry) {
                    const merged = { ...dbEntry.record };
                    let hasChange = false;

                    Object.keys(excelRecord).forEach(key => {
                        const newVal = (excelRecord as any)[key];
                        const isValidValue = newVal !== null && newVal !== undefined && newVal !== '';
                        
                        if (isValidValue && key !== 'id') {
                            if (String(merged[key]) !== String(newVal)) {
                                merged[key] = newVal;
                                hasChange = true;
                            }
                        }
                    });

                    if (hasChange) {
                        const sanitized = sanitizeData(merged, RECORD_DB_COLUMNS);
                        if (dbEntry.table === 'luutru_records') {
                            luutruUpdates.push(sanitized);
                        } else if (dbEntry.table === 'dangky_records') {
                            dangkyUpdates.push(sanitized);
                        } else {
                            landUpdates.push(sanitized);
                        }
                        updateCount++;
                    }
                }
            });

            const upsertIntoTable = async (table: 'land_records' | 'luutru_records' | 'dangky_records', updates: any[]) => {
                if (updates.length === 0) return;
                let { error: upsertError } = await supabase.from(table).upsert(updates);
                
                if (upsertError && (upsertError.code === '22P02' || String(upsertError.message || '').includes('22P02') || String(upsertError.message || '').includes('invalid input syntax'))) {
                    console.warn(`⚠️ [22P02 Fallback] Retrying chunk target upsert into ${table} with 22P02 sanitized payload...`);
                    const fallback22P02 = sanitizePayloadFor22P02(updates);
                    const res = await supabase.from(table).upsert(fallback22P02);
                    upsertError = res.error;
                }

                if (upsertError && (upsertError.code === 'PGRST204' || String(upsertError.code) === '42703' || (upsertError.message && String(upsertError.message).includes('does not exist')))) {
                    console.warn(`⚠️ [Fallback] Retrying chunk target upsert into ${table} without new columns...`);
                    const fallbackPayload = updates.map(p => {
                        const fp = sanitizePayloadFor22P02({ ...p });
                        OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                        return fp;
                    });
                    const { error: fallbackError } = await supabase.from(table).upsert(fallbackPayload);
                    if (fallbackError) throw fallbackError;
                } else if (upsertError) {
                    throw upsertError;
                }
            };

            await Promise.all([
                upsertIntoTable('land_records', landUpdates),
                upsertIntoTable('luutru_records', luutruUpdates),
                upsertIntoTable('dangky_records', dangkyUpdates)
            ]);
            
            if (onProgress) {
                onProgress(Math.min(i + CHUNK_SIZE, records.length), records.length);
            }
        }

        return { success: true, count: updateCount };

    } catch (error) {
        logError("forceUpdateRecordsBatchApi", error);
        return { success: false, count: 0 };
    }
};

// Cập nhật hàng loạt hồ sơ an toàn bằng ID (Phòng tránh trùng mã hồ sơ)
export const updateRecordsBatchById = async (updates: Partial<RecordFile>[], onProgress?: (processed: number, total: number) => void): Promise<{ success: boolean; count: number }> => {
    if (!isConfigured) {
        let count = 0;
        updates.forEach(up => {
            const idx = MOCK_RECORDS.findIndex(r => r.id === up.id);
            if (idx !== -1) {
                MOCK_RECORDS[idx] = { ...MOCK_RECORDS[idx], ...up } as RecordFile;
                count++;
            }
        });
        saveToCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count };
    }

    try {
        const rows = updates.map(u => sanitizeData(u, RECORD_DB_COLUMNS));
        const landRows: any[] = [];
        const dangkyRows: any[] = [];
        const luutruRows: any[] = [];

        updates.forEach((u, idx) => {
            const table = getTargetTable(u);
            if (table === 'luutru_records') {
                luutruRows.push(rows[idx]);
            } else if (table === 'dangky_records') {
                dangkyRows.push(rows[idx]);
            } else {
                landRows.push(rows[idx]);
            }
        });

        const upsertIntoTable = async (table: 'land_records' | 'dangky_records' | 'luutru_records', payload: any[]) => {
            if (payload.length === 0) return;
            let { error } = await supabase.from(table).upsert(payload);

            if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
                console.warn(`⚠️ [22P02 Fallback] Retrying updateRecordsBatchById on ${table} with 22P02 sanitized payload...`);
                const fallback22P02Rows = sanitizePayloadFor22P02(payload);
                const res = await supabase.from(table).upsert(fallback22P02Rows);
                error = res.error;
            }

            if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
                console.warn(`⚠️ [Fallback] Database is missing columns inside updateRecordsBatchById on ${table}. Retrying without new columns...`);
                const fallbackPayload = payload.map(r => {
                    const fp = sanitizePayloadFor22P02({ ...r });
                    OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                    return fp;
                });
                const { error: fallbackError } = await supabase.from(table).upsert(fallbackPayload);
                if (fallbackError) throw fallbackError;
            } else if (error) {
                if (table === 'dangky_records' && (error.code === '42P01' || error.code === 'PGRST205')) {
                    await supabase.from('land_records').upsert(payload);
                    return;
                }
                throw error;
            }
        };

        await Promise.all([
            upsertIntoTable('land_records', landRows),
            upsertIntoTable('dangky_records', dangkyRows),
            upsertIntoTable('luutru_records', luutruRows)
        ]);
        
        syncCacheOnBatchUpdate(updates);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: updates.length };
    } catch (error) {
        logError("updateRecordsBatchById", error);
        return { success: false, count: 0 };
    }
};

export const bulkUpdateDangKyRecordsApi = async (records: RecordFile[]): Promise<boolean> => {
    if (!isConfigured || !records || records.length === 0) return true;
    try {
        for (const r of records) {
            const targetTable = getTargetTable(r);
            const payload = sanitizeData(r, RECORD_DB_COLUMNS);
            
            // Cập nhật đồng thời theo cả cột id và cột code
            let query = supabase.from(targetTable).update(payload);
            if (r.id && r.code) {
                query = query.or(`id.eq.${r.id},code.eq.${r.code}`);
            } else if (r.id) {
                query = query.eq('id', r.id);
            } else if (r.code) {
                query = query.eq('code', r.code);
            } else {
                continue;
            }
            
            const { error } = await query;
            if (error) {
                console.warn(`⚠️ [bulkUpdateDangKyRecordsApi] Error updating record ${r.id || r.code} in ${targetTable}:`, error);
                await supabase.from('dangky_records').update(payload).or(`id.eq.${r.id},code.eq.${r.code}`);
                await supabase.from('land_records').update(payload).or(`id.eq.${r.id},code.eq.${r.code}`);
                await supabase.from('luutru_records').update(payload).or(`id.eq.${r.id},code.eq.${r.code}`);
            }
        }
        syncCacheOnBatchUpdate(records);
        return true;
    } catch (error) {
        logError("bulkUpdateDangKyRecordsApi", error, true);
        return false;
    }
};

