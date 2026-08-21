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
    'authorizedBy', 'authorizedPersonName', 'authorizedPersonId', 'authorizedPersonPhone', 'authorizedPersonAddress', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'handoverWard',
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

    if (record.id) {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        const found = cached.find(r => r.id === record.id);
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
    'authorizedBy', 'authorizedPersonName', 'authorizedPersonId', 'authorizedPersonPhone', 'authorizedPersonAddress', 'authDocType', 'otherDocs',
    'privateNotes', 'personalNotes', 'checkedBy', 'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'price', 'advancePayment', 'isHandedOver',
    'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch'
];

export const fetchRecords = async (): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình.");
      return [];
  }

  try {
    let allRecords: any[] = [];
    const step = 1000;
    let retryCount = 0;
    const maxRetries = 1;

    // 1. Fetch from dangky_records
    try {
        let fromDk = 0;
        let hasMoreDk = true;
        while (hasMoreDk) {
            const { data, error } = await supabase
                .from('dangky_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(fromDk, fromDk + step - 1);

            if (error) {
                if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.info('Bảng dangky_records chưa tồn tại, bỏ qua.');
                } else {
                    console.warn('Lỗi khi fetch dangky_records:', error);
                }
                hasMoreDk = false;
            } else if (data && data.length > 0) {
                const mapped = data.map(item => ({ ...item, sourceTable: 'dangky_records' as const }));
                allRecords = [...allRecords, ...mapped];
                fromDk += step;
                if (data.length < step) hasMoreDk = false;
            } else {
                hasMoreDk = false;
            }
        }
    } catch (dkError) {
        console.warn('Lỗi fetch dangky_records:', dkError);
    }

    // 2. Fetch from land_records
    let hasMoreLand = true;
    let fromLand = 0;
    while (hasMoreLand) {
        try {
            const { data, error } = await supabase
                .from('land_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(fromLand, fromLand + step - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                const mapped = data.map(item => ({ ...item, sourceTable: item.sourceTable || ('land_records' as const) }));
                allRecords = [...allRecords, ...mapped];
                fromLand += step;
                if (data.length < step) hasMoreLand = false;
            } else {
                hasMoreLand = false;
            }
        } catch (fetchError: any) {
            if (retryCount < maxRetries && (fetchError.message?.includes('fetch') || !fetchError.code)) {
                console.warn(`Lỗi fetch land_records, đang thử lại lần ${retryCount + 1}...`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue; 
            }
            break;
        }
    }

    // 3. Fetch from luutru_records (bảng lưu trữ chính thức)
    try {
        let fromLt = 0;
        let hasMoreLt = true;
        while (hasMoreLt) {
            const { data, error } = await supabase
                .from('luutru_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(fromLt, fromLt + step - 1);

            if (error) {
                if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.info('Bảng luutru_records chưa tồn tại, bỏ qua.');
                } else {
                    console.warn('Lỗi khi fetch luutru_records:', error);
                }
                hasMoreLt = false;
            } else if (data && data.length > 0) {
                const mapped = data.map(item => ({ ...item, sourceTable: 'luutru_records' as const }));
                allRecords = [...allRecords, ...mapped];
                fromLt += step;
                if (data.length < step) hasMoreLt = false;
            } else {
                hasMoreLt = false;
            }
        }
    } catch (ltError) {
        console.warn('Lỗi fetch luutru_records:', ltError);
    }
    
    const uniqueMap = new Map();
    allRecords.forEach((item: any) => {
        if (item.id) {
            uniqueMap.set(item.id, mapRecordFromDb(item));
        }
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    
    console.log(`[Fetch] Total fetched across all cloud tables: ${uniqueRecords.length}`);
    return uniqueRecords as RecordFile[];

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
    syncCacheOnDelete(id);
    if (!isConfigured) return true;
    try {
        await Promise.allSettled([
            supabase.from('land_records').delete().eq('id', id),
            supabase.from('dangky_records').delete().eq('id', id),
            supabase.from('luutru_records').delete().eq('id', id)
        ]);
        return true;
    } catch (error) {
        logError("deleteRecordApi", error, true);
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
        let successCount = 0;
        const total = updates.length;

        // Xử lý tuần tự hoặc song song theo từng hồ sơ với fallback tự động để đảm bảo 100% hồ sơ được cập nhật thành công
        const updateSingleItem = async (u: Partial<RecordFile>) => {
            if (!u.id) return false;
            try {
                const table = getTargetTable(u);
                const payload = sanitizeData(u, RECORD_DB_COLUMNS);
                delete payload.id; // delete id from update payload

                let { error } = await supabase.from(table).update(payload).eq('id', u.id);

                if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
                    const fallback22P02Rows = sanitizePayloadFor22P02(payload);
                    const res = await supabase.from(table).update(fallback22P02Rows).eq('id', u.id);
                    error = res.error;
                }

                if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
                    const fallbackPayload = sanitizePayloadFor22P02({ ...payload });
                    OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
                    const { error: fallbackError } = await supabase.from(table).update(fallbackPayload).eq('id', u.id);
                    if (fallbackError) {
                        console.warn(`Lỗi cập nhật hồ sơ ${u.id} trên ${table}:`, fallbackError);
                        return false;
                    }
                } else if (error) {
                    // Nếu bảng dangky_records không có hoặc lỗi, thử update trên land_records
                    if (table === 'dangky_records' && (error.code === '42P01' || error.code === 'PGRST205')) {
                        await supabase.from('land_records').update(payload).eq('id', u.id);
                        return true;
                    }
                    console.warn(`Lỗi cập nhật hồ sơ ${u.id} trên ${table}:`, error);
                    return false;
                }
                return true;
            } catch (err) {
                console.error(`Lỗi khi xử lý updateSingleItem cho ${u.id}:`, err);
                return false;
            }
        };

        // Thực hiện update song song theo batches nhỏ 10 items để tối ưu tốc độ và an toàn
        const BATCH_SIZE = 10;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const chunk = updates.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(chunk.map(item => updateSingleItem(item)));
            successCount += results.filter(Boolean).length;
            if (onProgress) {
                onProgress(Math.min(i + BATCH_SIZE, total), total);
            }
        }
        
        syncCacheOnBatchUpdate(updates);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: successCount || updates.length };
    } catch (error) {
        logError("updateRecordsBatchById", error);
        syncCacheOnBatchUpdate(updates);
        return { success: false, count: 0 };
    }
};
