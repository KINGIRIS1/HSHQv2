
import { supabase, isConfigured } from './supabaseClient';
import { RecordFile } from '../types';
import { MOCK_RECORDS, API_BASE_URL } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, normalizeCode, mapRecordFromDb } from './apiCore';

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
    'price', 'advancePayment', 'isHandedOver'
];

const OPTIONAL_NEW_COLUMNS = [
    'customerAddress', 'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'needsMapCorrection', 'explanationPlan', 'receiptNumber', 'resultReturnedDate', 'receiverName',
    'reminderDate', 'lastRemindedAt', 'deadlineReminded', 'measurementNumber', 'excerptNumber',
    'authorizedBy', 'authDocType', 'otherDocs',
    'privateNotes', 'personalNotes', 'checkedBy', 'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'price', 'advancePayment', 'isHandedOver'
];

export const fetchRecords = async (): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình. Đang dùng dữ liệu Cache/Mock.");
      return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }

  try {
    let allRecords: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;
    let retryCount = 0;
    const maxRetries = 1;

    while (hasMore) {
        try {
            const { data, error } = await supabase
                .from('land_records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(from, from + step - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allRecords = [...allRecords, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        } catch (fetchError: any) {
            if (retryCount < maxRetries && (fetchError.message?.includes('fetch') || !fetchError.code)) {
                console.warn(`Lỗi fetchRecords, đang thử lại lần ${retryCount + 1}...`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue; 
            }
            throw fetchError;
        }
    }
    
    const uniqueMap = new Map();
    allRecords.forEach((item: any) => {
        if (item.id) {
            uniqueMap.set(item.id, mapRecordFromDb(item));
        }
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    
    console.log(`[Fetch] Total fetched: ${uniqueRecords.length}`);
    saveToCache(CACHE_KEYS.RECORDS, uniqueRecords);
    return uniqueRecords as RecordFile[];

  } catch (error) {
    logError("fetchRecords", error);
    return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
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
        
        const payload = sanitizeData(recordToSave, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('land_records').insert([payload]).select();
        
        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn("⚠️ [Fallback] Database is missing columns. Retrying without new columns...");
            if (!(window as any).fallbackAlertShown) {
                logError("createRecordApi", error, true);
                (window as any).fallbackAlertShown = true;
            }
            const fallbackPayload = { ...payload };
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const { data: fallbackData, error: fallbackError } = await supabase.from('land_records').insert([fallbackPayload]).select();
            if (fallbackError) throw fallbackError;
            const result = mapRecordFromDb({ ...recordToSave, ...(fallbackData?.[0] || {}) }) as RecordFile;
            if (result) syncCacheOnCreate(result);
            return result;
        }
        
        if (error) throw error;
        const result = mapRecordFromDb(data?.[0]) as RecordFile;
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
        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('land_records').update(payload).eq('id', record.id).select();
        
        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn("⚠️ [Fallback] Database is missing columns. Retrying without new columns...");
            if (!(window as any).fallbackAlertShown) {
                logError("updateRecordApi", error, true);
                (window as any).fallbackAlertShown = true;
            }
            const fallbackPayload = { ...payload };
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const { data: fallbackData, error: fallbackError } = await supabase.from('land_records').update(fallbackPayload).eq('id', record.id).select();
            if (fallbackError) throw fallbackError;
            const result = mapRecordFromDb({ ...record, ...(fallbackData?.[0] || {}) }) as RecordFile;
            if (result) syncCacheOnUpdate(result);
            return result;
        }
        
        if (error) throw error;
        const result = mapRecordFromDb(data?.[0]) as RecordFile;
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
        const payload = sanitizeData({ id, ...fields } as any, RECORD_DB_COLUMNS);
        delete payload.id;
        const { data, error } = await supabase.from('land_records').update(payload).eq('id', id).select();
        
        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn("⚠️ [Fallback] Database is missing columns. Retrying without new columns...");
            const fallbackPayload = { ...payload };
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const { data: fallbackData, error: fallbackError } = await supabase.from('land_records').update(fallbackPayload).eq('id', id).select();
            if (fallbackError) throw fallbackError;
            const result = mapRecordFromDb({ id, ...fields, ...(fallbackData?.[0] || {}) }) as RecordFile;
            if (result) syncCacheOnUpdate(result);
            return result;
        }
        
        if (error) throw error;
        const result = mapRecordFromDb(data?.[0]) as RecordFile;
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
        const { error } = await supabase.from('land_records').delete().eq('id', id);
        if (error) throw error;
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
        const payload = [];
        for (const r of records) {
            let finalCode = r.code;
            
            // Chỉ tạo mới code tự động nếu như mã bị thiếu hoặc có chứa dấu '?' (mã nháp)
            // KHÔNG GHI ĐÈ các mã có định dạng chuẩn (isGeneratedFormat) vì đây là data từ Excel đưa vào
            if (!finalCode || finalCode.includes('?')) {
                finalCode = await getNextGlobalRecordCode(r.receivedDate || new Date().toISOString());
            }
            
            const recordPayload = { ...r, code: finalCode };
            if (!recordPayload.id) {
                recordPayload.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            }
            
            payload.push(sanitizeData(recordPayload, RECORD_DB_COLUMNS));
        }

        const CHUNK_SIZE = 500;
        for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
            const chunk = payload.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from('land_records').insert(chunk);
            
            if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
                console.warn(`⚠️ [Fallback] Database is missing columns. Retrying batch insert chunk ${i} without new columns...`);
                if (!(window as any).fallbackAlertShown) {
                    logError("createRecordsBatchApi", error);
                    (window as any).fallbackAlertShown = true;
                }
                const fallbackPayload = chunk.map(p => {
                    const fp = { ...p };
                    OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                    return fp;
                });
                const { error: fallbackError } = await supabase.from('land_records').insert(fallbackPayload);
                if (fallbackError) throw fallbackError;
            } else if (error) {
                throw error;
            }
            
            if (onProgress) {
                onProgress(Math.min(i + CHUNK_SIZE, payload.length), payload.length);
            }
        }
        
        // Synchronize local cache with the batch of new records
        try {
            const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
            payload.forEach(p => {
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
    if (!isConfigured) return { success: true, count: 0 };
    
    const isSupabase = API_BASE_URL.includes('supabase.co');
    if (!isSupabase) {
        return { success: true, count: 0 };
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

            const { data: existingData, error: fetchError } = await supabase
                .from('land_records')
                .select('*')
                .in('code', searchCodes);

            if (fetchError) throw fetchError;

            const dbMap = new Map<string, any>();
            if (existingData) {
                existingData.forEach((r: any) => {
                    if (r.code) {
                        dbMap.set(normalizeCode(r.code), r);
                    }
                });
            }

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
                const { error: upsertError } = await supabase.from('land_records').upsert(updatesToPush);
                
                if (upsertError && (upsertError.code === 'PGRST204' || String(upsertError.code) === '42703' || (upsertError.message && String(upsertError.message).includes('does not exist')))) {
                    console.warn(`⚠️ [Fallback] Retrying chunk target upsert without new columns...`);
                    if (!(window as any).fallbackAlertShown) {
                        logError("forceUpdateRecordsBatchApi", upsertError);
                        (window as any).fallbackAlertShown = true;
                    }
                    const fallbackPayload = updatesToPush.map(p => {
                        const fp = { ...p };
                        OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                        return fp;
                    });
                    const { error: fallbackError } = await supabase.from('land_records').upsert(fallbackPayload);
                    if (fallbackError) throw fallbackError;
                } else if (upsertError) {
                    throw upsertError;
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
        const rows = updates.map(u => sanitizeData(u, RECORD_DB_COLUMNS));
        const { error } = await supabase
            .from('land_records')
            .upsert(rows);

        if (error) throw error;
        
        syncCacheOnBatchUpdate(updates);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: updates.length };
    } catch (error) {
        logError("updateRecordsBatchById", error);
        return { success: false, count: 0 };
    }
};
