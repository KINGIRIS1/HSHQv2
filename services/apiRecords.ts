
import { supabase, isConfigured } from './supabaseClient';
import { RecordFile } from '../types';
import { MOCK_RECORDS, API_BASE_URL, isCapGiayRecord, isArchiveRecordType } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, sanitizePayloadFor22P02, normalizeCode, mapRecordFromDb } from './apiCore';
import { parseSafeDate } from '../utils/appHelpers';

export const RECORD_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'customerAddress', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'receivedBy', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo', 'checkedBy',
    'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'handoverWard',
    'measurementNumber', 'excerptNumber', 'soPhieuChuyenThue',
    'reminderDate', 'lastRemindedAt', 'deadlineReminded',
    'receiptNumber', 'resultReturnedDate', 'receiverName',
    'needsMapCorrection', 'explanationPlan',
    'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'price', 'advancePayment', 'isHandedOver',
    'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch',
    'capGiaySubStep'
];

const OPTIONAL_NEW_COLUMNS = [
    'customerAddress', 'issueNumber', 'entryNumber', 'issueDate', 'residentialArea', 'soPhieuChuyenThue',
    'needsMapCorrection', 'explanationPlan', 'receiptNumber', 'resultReturnedDate', 'receiverName',
    'reminderDate', 'lastRemindedAt', 'deadlineReminded', 'measurementNumber', 'excerptNumber',
    'authorizedBy', 'authDocType', 'otherDocs',
    'privateNotes', 'personalNotes', 'checkedBy', 'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'price', 'advancePayment', 'isHandedOver',
    'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch',
    'capGiaySubStep'
];

export const getTargetTableForRecord = (record: Partial<RecordFile> | null | undefined): string => {
    if (!record) return 'land_records';
    if (isArchiveRecordType(record.recordType)) {
        return 'luutru_records';
    }
    if (isCapGiayRecord(record) || record.group === 'cap_giay' || record.group === 'Cấp giấy') {
        return 'dangky_records';
    }
    return 'land_records';
};

export const fetchRecords = async (): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình.");
      return [];
  }

  try {
    let allRecords: any[] = [];
    const step = 1000;

    // 1. Fetch land_records (Đo đạc)
    try {
        let from = 0;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase
                .from('land_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(from, from + step - 1);

            if (error) break;

            if (data && data.length > 0) {
                allRecords = [...allRecords, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }
    } catch (err) {
        console.warn("Error fetching land_records:", err);
    }

    // 2. Fetch dangky_records (Đăng ký / Cấp giấy)
    try {
        let dkFrom = 0;
        let dkHasMore = true;
        while (dkHasMore) {
            const { data: dkData, error: dkError } = await supabase
                .from('dangky_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(dkFrom, dkFrom + step - 1);

            if (dkError) {
                console.warn("Error fetching dangky_records:", dkError.message || dkError);
                break;
            }

            if (dkData && dkData.length > 0) {
                allRecords = [...allRecords, ...dkData];
                dkFrom += step;
                if (dkData.length < step) dkHasMore = false;
            } else {
                dkHasMore = false;
            }
        }
    } catch (err) {
        console.warn("Table dangky_records may not exist yet:", err);
    }

    // 3. Fetch luutru_records (Lưu trữ / Cung cấp tài liệu)
    try {
        let ltFrom = 0;
        let ltHasMore = true;
        while (ltHasMore) {
            const { data: ltData, error: ltError } = await supabase
                .from('luutru_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(ltFrom, ltFrom + step - 1);

            if (ltError) {
                console.warn("Error fetching luutru_records:", ltError.message || ltError);
                break;
            }

            if (ltData && ltData.length > 0) {
                allRecords = [...allRecords, ...ltData];
                ltFrom += step;
                if (ltData.length < step) ltHasMore = false;
            } else {
                ltHasMore = false;
            }
        }
    } catch (err) {
        console.warn("Table luutru_records may not exist yet:", err);
    }
    
    const uniqueMap = new Map();
    allRecords.forEach((item: any) => {
        if (item.id) {
            uniqueMap.set(item.id, mapRecordFromDb(item));
        }
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    
    console.log(`[Fetch] Total fetched: ${uniqueRecords.length}`);
    return uniqueRecords as RecordFile[];

  } catch (error) {
    logError("fetchRecords", error);
    return [];
  }
};

export const fetchCapGiayRecordsForVaoSo = async (): Promise<RecordFile[]> => {
  if (!isConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('land_records')
      .select('*')
      .or('group.eq.cap_giay,group.eq.other,recordType.ilike.%cấp giấy%')
      .order('receivedDate', { ascending: false })
      .limit(1000);

    if (error) throw error;
    return (data || []).map(mapRecordFromDb) as RecordFile[];
  } catch (error) {
    logError("fetchCapGiayRecordsForVaoSo", error);
    return [];
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
    const d = parseSafeDate(dateStr) || new Date();
    if (!isConfigured) {
        const yy = d.getFullYear().toString().slice(-2);
        const mm = ('0' + (d.getMonth() + 1)).slice(-2);
        const dd = ('0' + d.getDate()).slice(-2);
        return `${yy}${mm}${dd}-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
    }

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

const saveToDbTable = async (table: string, payload: any, action: 'insert' | 'update' | 'upsert', id?: string) => {
    let query;
    if (action === 'insert') {
        query = supabase.from(table).insert([payload]);
    } else if (action === 'update') {
        query = supabase.from(table).update(payload).eq('id', id || payload.id);
    } else {
        query = supabase.from(table).upsert([payload]);
    }

    let { data, error } = await query.select();

    if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
        const fallback22P02Payload = sanitizePayloadFor22P02(payload);
        if (action === 'insert') {
            query = supabase.from(table).insert([fallback22P02Payload]);
        } else if (action === 'update') {
            query = supabase.from(table).update(fallback22P02Payload).eq('id', id || payload.id);
        } else {
            query = supabase.from(table).upsert([fallback22P02Payload]);
        }
        const res = await query.select();
        data = res.data;
        error = res.error;
    }

    if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
        const fallbackPayload = sanitizePayloadFor22P02({ ...payload });
        OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
        if (action === 'insert') {
            query = supabase.from(table).insert([fallbackPayload]);
        } else if (action === 'update') {
            query = supabase.from(table).update(fallbackPayload).eq('id', id || payload.id);
        } else {
            query = supabase.from(table).upsert([fallbackPayload]);
        }
        const res = await query.select();
        data = res.data;
        error = res.error;
    }

    if (error) throw error;
    return data?.[0] || null;
};

const batchUpsertToTable = async (table: string, rows: any[]) => {
    if (!rows || rows.length === 0) return;
    const CHUNK_SIZE = 500;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        let { error } = await supabase.from(table).upsert(chunk);
        
        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
            const fallback22P02 = sanitizePayloadFor22P02(chunk);
            const res = await supabase.from(table).upsert(fallback22P02);
            error = res.error;
        }

        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            const fallbackPayload = chunk.map(p => {
                const fp = sanitizePayloadFor22P02({ ...p });
                OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                return fp;
            });
            const { error: fallbackError } = await supabase.from(table).upsert(fallbackPayload);
            if (fallbackError) throw fallbackError;
        } else if (error) {
            throw error;
        }
    }
};

const batchInsertToTable = async (table: string, rows: any[]) => {
    if (!rows || rows.length === 0) return;
    const CHUNK_SIZE = 500;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        let { error } = await supabase.from(table).insert(chunk);
        
        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
            const fallback22P02 = sanitizePayloadFor22P02(chunk);
            const res = await supabase.from(table).insert(fallback22P02);
            error = res.error;
        }

        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            const fallbackPayload = chunk.map(p => {
                const fp = sanitizePayloadFor22P02({ ...p });
                OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                return fp;
            });
            const { error: fallbackError } = await supabase.from(table).insert(fallbackPayload);
            if (fallbackError) throw fallbackError;
        } else if (error) {
            throw error;
        }
    }
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        let finalCode = record.code;
        const isGeneratedFormat = finalCode && (/^[A-ZĐ]{2,3}-\d{6}-\d{3,4}$/.test(finalCode) || /^\d{6}-\d{3,4}$/.test(finalCode));
        
        if (!finalCode || finalCode.includes('?') || isGeneratedFormat) {
            finalCode = await getNextGlobalRecordCode(record.receivedDate || new Date().toISOString());
        }
        
        const recordToSave = { ...record, code: finalCode };
        if (!recordToSave.id) {
            recordToSave.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
        }

        const targetTable = getTargetTableForRecord(recordToSave);
        const payload = sanitizeData(recordToSave, RECORD_DB_COLUMNS);
        if (targetTable === 'dangky_records' && !payload.group) payload.group = 'cap_giay';

        const savedData = await saveToDbTable(targetTable, payload, 'insert');

        const result = mapRecordFromDb({ ...recordToSave, ...(savedData || {}) }) as RecordFile;
        if (result) syncCacheOnCreate(result);
        return result;
    } catch (error) {
        logError("createRecordApi", error);
        return null;
    }
};

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        const targetTable = getTargetTableForRecord(record);
        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        if (targetTable === 'dangky_records' && !payload.group) payload.group = 'cap_giay';

        const savedData = await saveToDbTable(targetTable, payload, 'upsert', record.id);

        const result = mapRecordFromDb({ ...record, ...(savedData || {}) }) as RecordFile;
        if (result) syncCacheOnUpdate(result);
        return result;
    } catch (error) {
        logError("updateRecordApi", error);
        return null;
    }
};

export const updateRecordFieldsApi = async (id: string, fields: Partial<RecordFile>): Promise<RecordFile | null> => {
    if (!isConfigured) return null;
    try {
        const targetTable = getTargetTableForRecord(fields);
        const payload = sanitizeData({ id, ...fields } as any, RECORD_DB_COLUMNS);
        delete payload.id;

        const savedData = await saveToDbTable(targetTable, payload, 'update', id);

        const result = mapRecordFromDb({ id, ...fields, ...(savedData || {}) }) as RecordFile;
        if (result) syncCacheOnUpdate(result);
        return result;
    } catch (error) {
        logError("updateRecordFieldsApi", error);
        return null;
    }
};

export const deleteRecordApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await Promise.all([
            supabase.from('land_records').delete().eq('id', id),
            supabase.from('dangky_records').delete().eq('id', id),
            supabase.from('luutru_records').delete().eq('id', id)
        ]);
        syncCacheOnDelete(id);
        return true;
    } catch (error) {
        logError("deleteRecordApi", error);
        return false;
    }
};

export const createRecordsBatchApi = async (records: RecordFile[], onProgress?: (processed: number, total: number) => void): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const dangkyPayload: any[] = [];
        const landPayload: any[] = [];
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
            const sanitized = sanitizeData(recordPayload, RECORD_DB_COLUMNS);
            const target = getTargetTableForRecord(recordPayload);
            if (target === 'dangky_records') {
                if (!sanitized.group) sanitized.group = 'cap_giay';
                dangkyPayload.push(sanitized);
            } else if (target === 'luutru_records') {
                luutruPayload.push(sanitized);
            } else {
                landPayload.push(sanitized);
            }
        }

        if (dangkyPayload.length > 0) {
            await batchInsertToTable('dangky_records', dangkyPayload);
        }
        if (luutruPayload.length > 0) {
            await batchInsertToTable('luutru_records', luutruPayload);
        }
        if (landPayload.length > 0) {
            await batchInsertToTable('land_records', landPayload);
        }

        if (onProgress) {
            onProgress(records.length, records.length);
        }

        try {
            const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
            [...dangkyPayload, ...landPayload].forEach(p => {
                const mapped = mapRecordFromDb(p);
                if (!cached.some(r => r.id === mapped.id)) {
                    cached.unshift(mapped);
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
    const isSupabase = isConfigured && API_BASE_URL.includes('supabase.co');
    if (!isSupabase) {
        let count = 0;
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
        records.forEach(excelRecord => {
            const normCode = normalizeCode(excelRecord.code);
            const index = cached.findIndex(r => normalizeCode(r.code) === normCode);
            if (index !== -1) {
                const merged = { ...cached[index] };
                let hasChange = false;
                Object.keys(excelRecord).forEach(key => {
                    const newVal = (excelRecord as any)[key];
                    if (newVal !== null && newVal !== undefined && newVal !== '' && key !== 'id') {
                        if (String((merged as any)[key]) !== String(newVal)) {
                            (merged as any)[key] = newVal;
                            hasChange = true;
                        }
                    }
                });
                if (hasChange) {
                    cached[index] = merged;
                    const mockIdx = MOCK_RECORDS.findIndex(r => normalizeCode(r.code) === normCode);
                    if (mockIdx !== -1) MOCK_RECORDS[mockIdx] = merged;
                    count++;
                }
            }
        });
        saveToCache(CACHE_KEYS.RECORDS, cached);
        if (onProgress) onProgress(records.length, records.length);
        return { success: true, count };
    }

    // Helper tạo danh sách biến thể mã hồ sơ phong phú để truy vấn DB chính xác nhất
    const getCodeSearchVariants = (code: string): string[] => {
        if (!code) return [];
        const clean = code.trim();
        const variants = new Set<string>();
        
        variants.add(clean);
        variants.add(clean.toLowerCase());
        variants.add(clean.toUpperCase());
        
        // Gỡ tất cả khoảng trắng
        const noSpaces = clean.replace(/\s+/g, '');
        variants.add(noSpaces);
        variants.add(noSpaces.toLowerCase());
        variants.add(noSpaces.toUpperCase());

        // Xử lý dấu gạch ngang
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
            // Chèn dấu gạch ngang nếu là định dạng HS123 -> HS-123
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
            
            // Generate all variants for querying Supabase
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

            const [landRes, dangkyRes, luutruRes] = await Promise.all([
                supabase.from('land_records').select('*').in('code', searchCodes),
                supabase.from('dangky_records').select('*').in('code', searchCodes),
                supabase.from('luutru_records').select('*').in('code', searchCodes)
            ]);

            const existingData = [
                ...(landRes.data || []),
                ...(dangkyRes.data || []),
                ...(luutruRes.data || [])
            ];

            const dbMap = new Map<string, any>();
            existingData.forEach((r: any) => {
                if (r.code) {
                    dbMap.set(normalizeCode(r.code), r);
                }
            });

            const updatesToPush: any[] = [];

            chunkRecords.forEach((excelRecord) => {
                const normCode = normalizeCode(excelRecord.code);
                const dbRecord = dbMap.get(normCode);
                
                if (dbRecord) {
                    const merged = { ...dbRecord };
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
                        updatesToPush.push(sanitizeData(merged, RECORD_DB_COLUMNS));
                        updateCount++;
                    }
                }
            });

            if (updatesToPush.length > 0) {
                const dangkyUpdates: any[] = [];
                const landUpdates: any[] = [];
                const luutruUpdates: any[] = [];

                updatesToPush.forEach(up => {
                    const target = getTargetTableForRecord(up);
                    if (target === 'dangky_records') {
                        dangkyUpdates.push(up);
                    } else if (target === 'luutru_records') {
                        luutruUpdates.push(up);
                    } else {
                        landUpdates.push(up);
                    }
                });

                if (dangkyUpdates.length > 0) {
                    await batchUpsertToTable('dangky_records', dangkyUpdates);
                }
                if (luutruUpdates.length > 0) {
                    await batchUpsertToTable('luutru_records', luutruUpdates);
                }
                if (landUpdates.length > 0) {
                    await batchUpsertToTable('land_records', landUpdates);
                }

                try {
                    const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
                    updatesToPush.forEach(up => {
                        const normCode = normalizeCode(up.code);
                        const mapped = mapRecordFromDb(up);
                        const idx = cached.findIndex(r => normalizeCode(r.code) === normCode);
                        if (idx !== -1) {
                            cached[idx] = { ...cached[idx], ...mapped };
                            const mIdx = MOCK_RECORDS.findIndex(r => normalizeCode(r.code) === normCode);
                            if (mIdx !== -1) MOCK_RECORDS[mIdx] = cached[idx];
                        }
                    });
                    saveToCache(CACHE_KEYS.RECORDS, cached);
                } catch (e) {
                    console.error("Error syncing cache in forceUpdateRecordsBatchApi:", e);
                }
            }
            
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
        const dangkyRows: any[] = [];
        const landRows: any[] = [];
        const luutruRows: any[] = [];

        updates.forEach(u => {
            const row = sanitizeData(u, RECORD_DB_COLUMNS);
            const target = getTargetTableForRecord(u);
            if (target === 'dangky_records') {
                dangkyRows.push(row);
            } else if (target === 'luutru_records') {
                luutruRows.push(row);
            } else {
                landRows.push(row);
            }
        });

        if (dangkyRows.length > 0) {
            await batchUpsertToTable('dangky_records', dangkyRows);
        }
        if (luutruRows.length > 0) {
            await batchUpsertToTable('luutru_records', luutruRows);
        }
        if (landRows.length > 0) {
            await batchUpsertToTable('land_records', landRows);
        }

        syncCacheOnBatchUpdate(updates);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: updates.length };
    } catch (error) {
        logError("updateRecordsBatchById", error);
        return { success: false, count: 0 };
    }
};
