import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, RecordStatus } from '../types';
import { MOCK_RECORDS, API_BASE_URL, isArchiveRecordType, getShortRecordType } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, sanitizePayloadFor22P02, normalizeCode, mapRecordFromDb, keepOnlyDate } from './apiCore';
import { getIndexedDBItem } from './storageService';
import { addPendingRecord, removePendingRecord, getPendingRecords, syncPendingRecordsToCloud, generateStandardUUID, isValidUUID } from './syncQueueService';

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
    'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch',
    'surveyorId', 'surveyAssignedDate', 'fieldAssignedDate', 'fieldCompletedDate',
    'drafterId', 'officeAssignedDate', 'officeCompletedDate',
    'attachedFiles', 'dossierComponents'
];

/**
 * Định tuyến bảng dữ liệu chuẩn xác theo tiền tố mã thủ tục:
 * - Nhóm 1.x (Sao lục, Công văn, Cung cấp dữ liệu đất đai) -> luutru_records
 * - Nhóm 2.x (Trích lục, Trích đo, Duyệt đơn, Cắm mốc, Tách-Hợp thửa) -> land_records
 * - Nhóm 3.x (Đăng ký đất đai, Cấp giấy, Đăng ký biến động) -> dangky_records
 */
export const getTargetTable = (record: Partial<RecordFile>): 'dangky_records' | 'land_records' | 'luutru_records' => {
    const rawType = String(record.recordType || record.content || '').trim();
    const code = String(record.code || '').trim();
    const shortType = getShortRecordType(rawType);

    // 1. Phân loại theo tiền tố mã thủ tục nghiêm ngặt (không dùng từ khóa)
    // Nhóm 1.x -> Tổ Lưu trữ (luutru_records)
    if (
        shortType.startsWith('1.') ||
        rawType.startsWith('1.') ||
        code.startsWith('1.') ||
        isArchiveRecordType(record.recordType) ||
        isArchiveRecordType(record.content)
    ) {
        return 'luutru_records';
    }

    // Nhóm 2.x -> Tổ Đo đạc (land_records)
    if (
        shortType.startsWith('2.') ||
        rawType.startsWith('2.') ||
        code.startsWith('2.')
    ) {
        return 'land_records';
    }

    // Nhóm 3.x -> Tổ Cấp giấy / Đăng ký (dangky_records)
    if (
        shortType.startsWith('3.') ||
        rawType.startsWith('3.') ||
        code.startsWith('3.')
    ) {
        return 'dangky_records';
    }

    // Nếu có sourceTable đã được xác định trước đó
    if (record.sourceTable === 'luutru_records' || record.sourceTable === 'archive_records') return 'luutru_records';
    if (record.sourceTable === 'dangky_records') return 'dangky_records';
    if (record.sourceTable === 'land_records') return 'land_records';

    // Tra cứu nhanh từ Cache nếu không có recordType
    if (record.id || record.code) {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        const found = cached.find(r => (record.id && r.id === record.id) || (record.code && r.code === record.code));
        if (found && (found.recordType || found.content)) {
            return getTargetTable(found);
        }
    }

    return 'land_records';
};

/**
 * Tự động xóa bản ghi trùng lặp ở các bảng sai (loại bỏ hoàn toàn lưu sai bảng / đa bảng)
 */
export const purgeRecordFromOtherTables = async (
    id?: string,
    code?: string,
    keepTable?: 'dangky_records' | 'land_records' | 'luutru_records'
) => {
    if (!isConfigured || (!id && !code) || !keepTable) return;
    const allTables: ('dangky_records' | 'land_records' | 'luutru_records')[] = ['dangky_records', 'land_records', 'luutru_records'];
    const otherTables = allTables.filter(t => t !== keepTable);

    const safeId = id && isValidUUID(id) ? id.trim() : null;
    const safeCode = code && code.trim().length > 3 && !code.includes('?') ? code.trim() : null;

    if (!safeId && !safeCode) return;

    for (const tbl of otherTables) {
        try {
            if (safeId) {
                await supabase.from(tbl).delete().eq('id', safeId);
            }
            if (safeCode) {
                await supabase.from(tbl).delete().eq('code', safeCode);
            }
        } catch {
            // Không ngắt luồng nếu bảng đó không có bản ghi
        }
    }
};

/**
 * Xóa hàng loạt bản ghi trùng lặp ở các bảng khác
 */
export const purgeBatchFromOtherTables = async (
    ids: string[],
    codes: string[],
    keepTable: 'dangky_records' | 'land_records' | 'luutru_records'
) => {
    if (!isConfigured || !keepTable) return;
    const validIds = ids.filter(id => id && isValidUUID(id));
    const validCodes = codes.filter(code => code && code.trim().length > 3 && !code.includes('?'));
    if (validIds.length === 0 && validCodes.length === 0) return;

    const allTables: ('dangky_records' | 'land_records' | 'luutru_records')[] = ['dangky_records', 'land_records', 'luutru_records'];
    const otherTables = allTables.filter(t => t !== keepTable);

    for (const tbl of otherTables) {
        try {
            const CHUNK = 200;
            if (validIds.length > 0) {
                for (let i = 0; i < validIds.length; i += CHUNK) {
                    await supabase.from(tbl).delete().in('id', validIds.slice(i, i + CHUNK));
                }
            }
            if (validCodes.length > 0) {
                for (let i = 0; i < validCodes.length; i += CHUNK) {
                    await supabase.from(tbl).delete().in('code', validCodes.slice(i, i + CHUNK));
                }
            }
        } catch {
            // bỏ qua lỗi
        }
    }
};

const OPTIONAL_NEW_COLUMNS = [
    'customerAddress', 'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'needsMapCorrection', 'explanationPlan', 'receiptNumber', 'resultReturnedDate', 'receiverName',
    'reminderDate', 'lastRemindedAt', 'deadlineReminded', 'measurementNumber', 'excerptNumber',
    'authorizedBy', 'authDocType', 'otherDocs',
    'privateNotes', 'personalNotes', 'checkedBy', 'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'price', 'advancePayment', 'isHandedOver',
    'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch',
    'surveyorId', 'surveyAssignedDate', 'fieldAssignedDate', 'fieldCompletedDate',
    'drafterId', 'officeAssignedDate', 'officeCompletedDate'
];

const fetchTableRecords = async (
    table: 'dangky_records' | 'land_records' | 'luutru_records'
): Promise<any[]> => {
    const step = 1000;
    try {
        let firstData: any[] | null = null;
        let count: number | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const res = await supabase
                    .from(table)
                    .select('*', { count: 'exact' })
                    .order('receivedDate', { ascending: false, nullsFirst: false })
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

        // Tải theo nhóm song song (concurrency = 4) để nạp 100% hồ sơ cực nhanh
        const concurrency = 4;
        const remainingPages: any[][] = [];
        for (let i = 0; i < ranges.length; i += concurrency) {
            const chunk = ranges.slice(i, i + concurrency);
            const chunkResults = await Promise.all(
                chunk.map(r => fetchPageDirectWithRetry(table, r.from, r.to))
            );
            remainingPages.push(...chunkResults);
        }

        return [mappedFirst, ...remainingPages].flat();
    } catch (err: any) {
        console.warn(`Lỗi fetch ${table}:`, err);
        return [];
    }
};

const fetchPageDirectWithRetry = async (
    table: 'dangky_records' | 'land_records' | 'luutru_records',
    from: number,
    to: number,
    retries = 3,
    delayMs = 300
): Promise<any[]> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data, error: pageErr } = await supabase
                .from(table)
                .select('*')
                .order('receivedDate', { ascending: false, nullsFirst: false })
                .order('id', { ascending: true })
                .range(from, to);

            if (pageErr) {
                if (attempt === retries) {
                    console.warn(`Lỗi fetch trang ${from}-${to} của ${table}:`, pageErr);
                    return [];
                }
                await new Promise(res => setTimeout(res, delayMs * attempt));
                continue;
            }
            return (data || []).map(item => ({ ...item, sourceTable: table }));
        } catch (err: any) {
            if (attempt === retries) {
                console.warn(`Lỗi ngoại lệ fetch trang ${from}-${to} của ${table}:`, err);
                return [];
            }
            await new Promise(res => setTimeout(res, delayMs * attempt));
        }
    }
    return [];
};

export type TierProgressCallback = (tier: 1 | 2 | 3, recordsSoFar: RecordFile[], isComplete: boolean) => void;

export const fetchRecords = async (onProgress?: TierProgressCallback): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình.");
      const pending = await getPendingRecords();
      return pending;
  }

  try {
    const uniqueMap = new Map<string, RecordFile>();

    // 1. Tải toàn bộ 100% hồ sơ từ cả 3 bảng phân loại song song
    const [dangky, land, luutru] = await Promise.all([
        fetchTableRecords('dangky_records'),
        fetchTableRecords('land_records'),
        fetchTableRecords('luutru_records')
    ]);

    // Tự động phát hiện và di chuyển các hồ sơ bị phân nhầm vào dangky_records (ví dụ hồ sơ Đo đạc 2.x)
    const misplacedInDangky = dangky
        .map(mapRecordFromDb)
        .filter((r): r is RecordFile => !!r && getTargetTable(r) !== 'dangky_records');

    if (misplacedInDangky.length > 0) {
        console.log(`[Auto-Fix] Phát hiện ${misplacedInDangky.length} hồ sơ nằm sai trong dangky_records. Đang tự động chuyển dời...`);
        setTimeout(async () => {
            try {
                const landFixes = misplacedInDangky.filter(r => getTargetTable(r) === 'land_records');
                const luutruFixes = misplacedInDangky.filter(r => getTargetTable(r) === 'luutru_records');

                if (landFixes.length > 0) {
                    await supabase.from('land_records').upsert(landFixes.map(r => sanitizeData(r, RECORD_DB_COLUMNS)));
                    await purgeBatchFromOtherTables(landFixes.map(r => r.id), landFixes.map(r => r.code), 'land_records');
                }
                if (luutruFixes.length > 0) {
                    await supabase.from('luutru_records').upsert(luutruFixes.map(r => sanitizeData(r, RECORD_DB_COLUMNS)));
                    await purgeBatchFromOtherTables(luutruFixes.map(r => r.id), luutruFixes.map(r => r.code), 'luutru_records');
                }
            } catch (err) {
                console.error("[Auto-Fix Misplaced Records] Lỗi khi chuyển dời:", err);
            }
        }, 300);
    }
    
    const rawList = [...dangky, ...land, ...luutru];
    rawList.forEach(item => {
        const mapped = mapRecordFromDb(item);
        if (mapped && mapped.id) {
            uniqueMap.set(mapped.id, mapped);
        }
    });

    // 2. [QUAN TRỌNG NHẤT] Hợp nhất ngay các hồ sơ đang chờ đồng bộ (Sync Queue)
    // Đảm bảo mọi hồ sơ vừa tiếp nhận hoặc lưu offline KHÔNG BAO GIỜ bị biến mất hay bị ghi đè!
    const pendingRecords = await getPendingRecords();
    pendingRecords.forEach(pending => {
        if (pending && pending.id) {
            uniqueMap.set(pending.id, { ...(uniqueMap.get(pending.id) || {}), ...pending, _isOfflineSaved: true });
        }
    });

    const finalRecords = Array.from(uniqueMap.values());
    console.log(`[FetchRecords] Đã nạp thành công ${finalRecords.length} hồ sơ (trong đó có ${pendingRecords.length} hồ sơ chờ đồng bộ)`);

    if (finalRecords.length > 0) {
        saveToCache(CACHE_KEYS.RECORDS, finalRecords);
    }
    onProgress?.(3, finalRecords, true);

    // 3. Kích hoạt đồng bộ ngầm tự động nếu có hồ sơ tồn đọng
    if (pendingRecords.length > 0) {
        setTimeout(() => {
            syncPendingRecordsToCloud(createRecordApi, updateRecordApi);
        }, 1200);
    }

    return finalRecords;

  } catch (error) {
    logError("fetchRecords", error, true);
    const idb = await getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS) || [];
    const pendingRecords = await getPendingRecords();
    const map = new Map<string, RecordFile>();
    idb.forEach(r => { if (r.id) map.set(r.id, r); });
    pendingRecords.forEach(r => { if (r.id) map.set(r.id, { ...r, _isOfflineSaved: true }); });
    return Array.from(map.values());
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

export const getNextGlobalRecordCode = async (dateStr: string, isArchive = false, recordType = ''): Promise<string> => {
    const rType = (recordType || '').toLowerCase();
    const isLT = isArchive || rType.startsWith('1.') || rType.includes('1.1') || rType.includes('1.2') || rType.includes('sao lục') || rType.includes('công văn') || rType.includes('cung cấp') || rType.includes('lưu trữ');

    if (!isConfigured) {
        const d = new Date(dateStr);
        const yy = d.getFullYear().toString().slice(-2);
        const mm = ('0' + (d.getMonth() + 1)).slice(-2);
        const dd = ('0' + d.getDate()).slice(-2);
        const datePrefix = `${yy}${mm}${dd}`;
        const prefix = isLT ? 'LT-' : '';
        return `${prefix}${datePrefix}-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
    }

    const d = new Date(dateStr);
    const year = d.getFullYear().toString();
    const yy = year.slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;
    
    // Tách riêng bộ đếm cho Hồ sơ Lưu trữ / 1.1, 1.2 (isLT = true) và Hồ sơ Đo đạc khác
    const key = isLT ? `archive_record_counter_${year}` : `record_counter_${year}`;
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
    // Với hồ sơ lưu trữ / 1.1, 1.2 có tiền tố LT-YYMMDD-XXXX
    return isLT ? `LT-${datePrefix}-${seqStr}` : `${datePrefix}-${seqStr}`;
};

// --- CACHE SYNCHRONIZATION HELPERS ---
const syncCacheOnCreate = async (newRecord: RecordFile) => {
    try {
        const cached = (await getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS)) || [];
        if (!cached.some(r => r.id === newRecord.id)) {
            cached.unshift(newRecord);
            saveToCache(CACHE_KEYS.RECORDS, cached);
        }
    } catch (e) {
        console.error("Error syncing cache for created record", e);
    }
};

const syncCacheOnUpdate = async (updatedRecord: RecordFile) => {
    try {
        const cached = (await getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS)) || [];
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

const syncCacheOnDelete = async (id: string) => {
    try {
        const cached = (await getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS)) || [];
        const filtered = cached.filter(r => r.id !== id);
        saveToCache(CACHE_KEYS.RECORDS, filtered);
    } catch (e) {
        console.error("Error syncing cache for deleted record", e);
    }
};

const syncCacheOnBatchDelete = async (ids: string[]) => {
    try {
        const idSet = new Set(ids);
        const cached = (await getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS)) || [];
        const filtered = cached.filter(r => !idSet.has(r.id));
        saveToCache(CACHE_KEYS.RECORDS, filtered);
    } catch (e) {
        console.error("Error syncing cache for batch deleted records", e);
    }
};

const syncCacheOnBatchUpdate = async (batchUpdates: Partial<RecordFile>[]) => {
    try {
        const cached = (await getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS)) || [];
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
    if (!isConfigured) {
        await addPendingRecord(record, 'CREATE');
        syncCacheOnCreate({ ...record, _isOfflineSaved: true });
        return { ...record, _isOfflineSaved: true };
    }

    let recordToSave: RecordFile = record;
    try {
        let finalCode = record.code;
        const isGeneratedFormat = finalCode && (/^[A-ZĐ]{2,3}-\d{6}-\d{3,4}$/.test(finalCode) || /^\d{6}-\d{3,4}$/.test(finalCode));
        
        const targetTable = getTargetTable(recordToSave);
        const isArchive = targetTable === 'luutru_records';

        if (!finalCode || finalCode.includes('?') || isGeneratedFormat) {
            finalCode = await getNextGlobalRecordCode(record.receivedDate || new Date().toISOString(), isArchive);
        }
        
        // Luôn đảm bảo id là chuẩn UUID RFC4122 để không bị lỗi 22P02 của PostgreSQL
        const standardId = (recordToSave.id && isValidUUID(recordToSave.id)) ? recordToSave.id : generateStandardUUID();
        const validReceivedDate = keepOnlyDate(record.receivedDate) || new Date().toISOString().split('T')[0];

        recordToSave = { 
            ...record, 
            id: standardId,
            code: finalCode,
            receivedDate: validReceivedDate,
            status: record.status || RecordStatus.RECEIVED
        };
        
        let payload = sanitizeData(recordToSave, RECORD_DB_COLUMNS);
        payload.id = standardId;
        payload.receivedDate = validReceivedDate;

        let { data, error } = await supabase.from(targetTable).insert([payload]).select();
        
        // 1. Thử lại nếu lỗi kiểu dữ liệu 22P02
        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
            console.warn(`⚠️ [22P02 Fallback] Thử lại insert vào ${targetTable} với dữ liệu đã chuẩn hóa 22P02...`);
            const fallback22P02Payload = sanitizePayloadFor22P02(payload);
            if (!isValidUUID(fallback22P02Payload.id)) fallback22P02Payload.id = generateStandardUUID();
            const res = await supabase.from(targetTable).insert([fallback22P02Payload]).select();
            data = res.data;
            error = res.error;
        }

        // 2. Thử lại nếu thiếu cột trên Supabase (PGRST204 / 42703)
        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
            console.warn(`⚠️ [Fallback] Bảng ${targetTable} thiếu một số cột mới. Thử lại không kèm cột tùy chọn...`);
            const fallbackPayload = sanitizePayloadFor22P02({ ...payload });
            OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
            const res = await supabase.from(targetTable).insert([fallbackPayload]).select();
            data = res.data;
            error = res.error;
        }

        // 3. Fallback sang bảng land_records nếu bảng chuyên biệt (luutru_records / dangky_records) bị lỗi cấu trúc hoặc phân quyền
        if (error && targetTable !== 'land_records') {
            console.warn(`⚠️ [Fallback Table] Bảng ${targetTable} gặp lỗi (${error.message || error.code}). Chuyển hướng lưu an toàn sang bảng land_records...`);
            const landFallbackPayload = sanitizePayloadFor22P02({ ...payload });
            const landRes = await supabase.from('land_records').insert([landFallbackPayload]).select();
            if (!landRes.error && landRes.data && landRes.data.length > 0) {
                data = landRes.data;
                error = null;
            }
        }
        
        if (error) throw error;

        const result = mapRecordFromDb({ ...recordToSave, ...(data?.[0] || {}), sourceTable: targetTable }) as RecordFile;
        if (result) {
            // Gỡ khỏi hàng đợi chờ đồng bộ vì đã lên Cloud thành công 100%
            await removePendingRecord(result.id);
            syncCacheOnCreate(result);
            // Dọn dẹp bản ghi cũ nếu có ở các bảng khác
            purgeRecordFromOtherTables(result.id, result.code, targetTable);
            return { ...result, _isOfflineSaved: false };
        }
        return { ...recordToSave, _isOfflineSaved: false };
    } catch (error: any) {
        logError("createRecordApi", error, true);
        console.warn(`[Offline Queue] Lưu hồ sơ ${recordToSave.code || recordToSave.id} vào hàng đợi cục bộ để tự động đẩy lên Cloud sau.`);
        // Lưu hồ sơ vào hàng đợi đồng bộ bền vững (Sync Queue)
        await addPendingRecord(recordToSave, 'CREATE');
        syncCacheOnCreate({ ...recordToSave, _isOfflineSaved: true });
        return { ...recordToSave, _isOfflineSaved: true };
    }
};

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) {
        await addPendingRecord(record, 'UPDATE');
        syncCacheOnUpdate({ ...record, _isOfflineSaved: true });
        return { ...record, _isOfflineSaved: true };
    }
    try {
        const primaryTable = (record.sourceTable && ['dangky_records', 'land_records', 'luutru_records'].includes(record.sourceTable))
            ? (record.sourceTable as 'dangky_records' | 'land_records' | 'luutru_records')
            : getTargetTable(record);

        const candidateTables: ('dangky_records' | 'land_records' | 'luutru_records')[] = Array.from(new Set([
            primaryTable,
            getTargetTable(record),
            'land_records',
            'dangky_records',
            'luutru_records'
        ]));

        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        let updatedData: any[] | null = null;
        let finalTable: 'dangky_records' | 'land_records' | 'luutru_records' = primaryTable;
        let lastError: any = null;

        for (const tbl of candidateTables) {
            try {
                let { data, error } = await supabase.from(tbl).update(payload).eq('id', record.id).select();

                if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
                    console.warn(`⚠️ [22P02 Fallback] Retrying update on ${tbl} with 22P02 sanitized payload...`);
                    const fallback22P02Payload = sanitizePayloadFor22P02(payload);
                    const res = await supabase.from(tbl).update(fallback22P02Payload).eq('id', record.id).select();
                    data = res.data;
                    error = res.error;
                }

                if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
                    console.warn(`⚠️ [Fallback] Database is missing columns on ${tbl}. Retrying without new columns...`);
                    const fallbackPayload = sanitizePayloadFor22P02({ ...payload });
                    OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
                    const res = await supabase.from(tbl).update(fallbackPayload).eq('id', record.id).select();
                    data = res.data;
                    error = res.error;
                }

                if (!error && data && data.length > 0) {
                    updatedData = data;
                    finalTable = tbl;
                    lastError = null;
                    break;
                }
                if (error) lastError = error;
            } catch (err) {
                lastError = err;
            }
        }

        // Nếu không tìm thấy bản ghi nào ở cả 3 bảng để UPDATE (0 rows matched), thực hiện upsert vào targetTable chuẩn
        if (!updatedData || updatedData.length === 0) {
            const targetTable = getTargetTable(record);
            const upsertPayload = sanitizeData(record, RECORD_DB_COLUMNS);
            const upsertRes = await supabase.from(targetTable).upsert([upsertPayload]).select();
            if (!upsertRes.error && upsertRes.data && upsertRes.data.length > 0) {
                updatedData = upsertRes.data;
                finalTable = targetTable;
            } else if (lastError) {
                throw lastError;
            }
        }

        const result = mapRecordFromDb({ ...record, ...(updatedData?.[0] || {}), sourceTable: finalTable }) as RecordFile;
        if (result) {
            await removePendingRecord(result.id);
            syncCacheOnUpdate(result);
            purgeRecordFromOtherTables(result.id, result.code, finalTable);
            return { ...result, _isOfflineSaved: false };
        }
        return { ...record, _isOfflineSaved: false };
    } catch (error: any) {
        logError("updateRecordApi", error, true);
        await addPendingRecord(record, 'UPDATE');
        syncCacheOnUpdate({ ...record, _isOfflineSaved: true });
        return { ...record, _isOfflineSaved: true };
    }
};

export const saveRecord = updateRecordApi;

export const updateRecordFieldsApi = async (id: string, fields: Partial<RecordFile>): Promise<RecordFile | null> => {
    if (!isConfigured) {
        const fallbackRecord = { id, ...fields, _isOfflineSaved: true } as RecordFile;
        await addPendingRecord(fallbackRecord, 'UPDATE');
        syncCacheOnUpdate(fallbackRecord);
        return fallbackRecord;
    }
    try {
        const primaryTable = (fields.sourceTable && ['dangky_records', 'land_records', 'luutru_records'].includes(fields.sourceTable))
            ? (fields.sourceTable as 'dangky_records' | 'land_records' | 'luutru_records')
            : getTargetTable({ id, ...fields });

        const candidateTables: ('dangky_records' | 'land_records' | 'luutru_records')[] = Array.from(new Set([
            primaryTable,
            getTargetTable({ id, ...fields }),
            'land_records',
            'dangky_records',
            'luutru_records'
        ]));

        const payload = sanitizeData({ id, ...fields } as any, RECORD_DB_COLUMNS);
        delete payload.id;

        let updatedData: any[] | null = null;
        let finalTable: 'dangky_records' | 'land_records' | 'luutru_records' = primaryTable;
        let lastError: any = null;

        for (const tbl of candidateTables) {
            try {
                let { data, error } = await supabase.from(tbl).update(payload).eq('id', id).select();

                if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
                    console.warn(`⚠️ [22P02 Fallback] Retrying updateRecordFieldsApi on ${tbl} with 22P02 sanitized payload...`);
                    const fallback22P02Payload = sanitizePayloadFor22P02(payload);
                    const res = await supabase.from(tbl).update(fallback22P02Payload).eq('id', id).select();
                    data = res.data;
                    error = res.error;
                }

                if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')))) {
                    console.warn(`⚠️ [Fallback] Database is missing columns on ${tbl}. Retrying without new columns...`);
                    const fallbackPayload = sanitizePayloadFor22P02({ ...payload });
                    OPTIONAL_NEW_COLUMNS.forEach(col => delete fallbackPayload[col]);
                    const res = await supabase.from(tbl).update(fallbackPayload).eq('id', id).select();
                    data = res.data;
                    error = res.error;
                }

                if (!error && data && data.length > 0) {
                    updatedData = data;
                    finalTable = tbl;
                    lastError = null;
                    break;
                }
                if (error) lastError = error;
            } catch (err) {
                lastError = err;
            }
        }

        if (!updatedData || updatedData.length === 0) {
            if (lastError) throw lastError;
        }

        const result = mapRecordFromDb({ id, ...fields, ...(updatedData?.[0] || {}), sourceTable: finalTable }) as RecordFile;
        if (result) {
            await removePendingRecord(result.id);
            syncCacheOnUpdate(result);
            purgeRecordFromOtherTables(result.id, result.code, finalTable);
            return { ...result, _isOfflineSaved: false };
        }
        return { id, ...fields } as RecordFile;
    } catch (error: any) {
        logError("updateRecordFieldsApi", error, true);
        const fallbackRecord = { id, ...fields, _isOfflineSaved: true } as RecordFile;
        await addPendingRecord(fallbackRecord, 'UPDATE');
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

export const deleteRecordsBatchApi = async (ids: string[], onProgress?: (processed: number, total: number) => void): Promise<boolean> => {
    if (!ids || ids.length === 0) return true;
    
    // Always sync local cache first
    await syncCacheOnBatchDelete(ids);

    if (!isConfigured) return true;
    try {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            await supabase.from('land_records').delete().in('id', chunk);
            await supabase.from('dangky_records').delete().in('id', chunk);
            await supabase.from('luutru_records').delete().in('id', chunk);
            if (onProgress) onProgress(Math.min(i + CHUNK_SIZE, ids.length), ids.length);
        }
        return true;
    } catch (error) {
        logError("deleteRecordsBatchApi", error, true);
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
            purgeBatchFromOtherTables(landPayload.map(r => r.id), landPayload.map(r => r.code), 'land_records');
        }
        if (dangkyPayload.length > 0) {
            await insertIntoTableInChunks('dangky_records', dangkyPayload);
            purgeBatchFromOtherTables(dangkyPayload.map(r => r.id), dangkyPayload.map(r => r.code), 'dangky_records');
        }
        if (luutruPayload.length > 0) {
            await insertIntoTableInChunks('luutru_records', luutruPayload);
            purgeBatchFromOtherTables(luutruPayload.map(r => r.id), luutruPayload.map(r => r.code), 'luutru_records');
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
        const rawCodes = records.map(r => r.code).filter(c => Boolean(c && String(c).trim()));
        if (rawCodes.length === 0) return { success: true, count: 0 };

        let updateCount = 0;
        const allModifiedRecords: RecordFile[] = [];
        const CHUNK_SIZE = 100; // Chia nhỏ 100 dòng để URL query .in() của Supabase / PostgREST không bị tràn URL độ dài (Bad Request)

        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
            const chunkRecords = records.slice(i, i + CHUNK_SIZE);
            const chunkCodes = chunkRecords.map(r => r.code).filter(c => Boolean(c && String(c).trim()));
            
            const searchCodesSet = new Set<string>();
            chunkCodes.forEach(code => {
                getCodeSearchVariants(code).forEach(variant => {
                    if (variant && variant.length <= 100) {
                        searchCodesSet.add(variant);
                    }
                });
                const norm = normalizeCode(code);
                if (norm && norm.length <= 100) {
                    searchCodesSet.add(norm);
                }
            });
            const searchCodes = Array.from(searchCodesSet);

            if (searchCodes.length === 0) {
                if (onProgress) onProgress(Math.min(i + CHUNK_SIZE, records.length), records.length);
                continue;
            }

            // Truy vấn từng bảng an toàn, tránh văng lỗi nếu một bảng không tồn tại hoặc lỗi phân quyền
            const queryTableSafe = async (tableName: 'land_records' | 'luutru_records' | 'dangky_records') => {
                try {
                    // Cắt searchCodes thành từng batch nhỏ tối đa 60 mã để query URL ngắn và ổn định
                    const SUB_BATCH = 60;
                    const results: any[] = [];
                    for (let s = 0; s < searchCodes.length; s += SUB_BATCH) {
                        const subCodes = searchCodes.slice(s, s + SUB_BATCH);
                        const { data, error } = await supabase.from(tableName).select('*').in('code', subCodes);
                        if (error) {
                            if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) {
                                return [];
                            }
                            console.warn(`Query on ${tableName} returned error:`, error.message);
                            continue;
                        }
                        if (data && data.length > 0) {
                            results.push(...data);
                        }
                    }
                    return results;
                } catch {
                    return [];
                }
            };

            const [existingLand, existingLuutru, existingDangky] = await Promise.all([
                queryTableSafe('land_records'),
                queryTableSafe('luutru_records'),
                queryTableSafe('dangky_records')
            ]);

            const dbMap = new Map<string, { record: any; table: 'land_records' | 'luutru_records' | 'dangky_records' }>();
            if (existingLand && existingLand.length > 0) {
                existingLand.forEach((r: any) => {
                    if (r.code) {
                        dbMap.set(normalizeCode(r.code), { record: r, table: 'land_records' });
                        dbMap.set(String(r.code).trim().toLowerCase(), { record: r, table: 'land_records' });
                    }
                });
            }
            if (existingLuutru && existingLuutru.length > 0) {
                existingLuutru.forEach((r: any) => {
                    if (r.code) {
                        dbMap.set(normalizeCode(r.code), { record: r, table: 'luutru_records' });
                        dbMap.set(String(r.code).trim().toLowerCase(), { record: r, table: 'luutru_records' });
                    }
                });
            }
            if (existingDangky && existingDangky.length > 0) {
                existingDangky.forEach((r: any) => {
                    if (r.code) {
                        dbMap.set(normalizeCode(r.code), { record: r, table: 'dangky_records' });
                        dbMap.set(String(r.code).trim().toLowerCase(), { record: r, table: 'dangky_records' });
                    }
                });
            }

            const landUpdates: any[] = [];
            const luutruUpdates: any[] = [];
            const dangkyUpdates: any[] = [];

            chunkRecords.forEach((excelRecord) => {
                const normCode = normalizeCode(excelRecord.code);
                const exactLower = String(excelRecord.code || '').trim().toLowerCase();
                const dbEntry = dbMap.get(normCode) || dbMap.get(exactLower);
                
                if (dbEntry) {
                    const merged = { ...dbEntry.record };
                    let hasChange = false;

                    Object.keys(excelRecord).forEach(key => {
                        const newVal = (excelRecord as any)[key];
                        const isValidValue = newVal !== null && newVal !== undefined && newVal !== '';
                        
                        if (isValidValue && key !== 'id') {
                            if (String(merged[key] ?? '') !== String(newVal)) {
                                merged[key] = newVal;
                                hasChange = true;
                            }
                        }
                    });

                    if (hasChange) {
                        // Đảm bảo UUID chuẩn
                        if (!merged.id || !isValidUUID(merged.id)) {
                            merged.id = generateStandardUUID();
                        }
                        const sanitized = sanitizeData(merged, RECORD_DB_COLUMNS);
                        if (dbEntry.table === 'luutru_records') {
                            luutruUpdates.push(sanitized);
                        } else if (dbEntry.table === 'dangky_records') {
                            dangkyUpdates.push(sanitized);
                        } else {
                            landUpdates.push(sanitized);
                        }
                        allModifiedRecords.push(merged as RecordFile);
                        updateCount++;
                    }
                }
            });

            const upsertIntoTable = async (table: 'land_records' | 'luutru_records' | 'dangky_records', updates: any[]) => {
                if (updates.length === 0) return;
                const UPSERT_CHUNK = 50;
                for (let u = 0; u < updates.length; u += UPSERT_CHUNK) {
                    const upChunk = updates.slice(u, u + UPSERT_CHUNK);
                    let { error: upsertError } = await supabase.from(table).upsert(upChunk);
                    
                    if (upsertError && (upsertError.code === '22P02' || String(upsertError.message || '').includes('22P02') || String(upsertError.message || '').includes('invalid input syntax'))) {
                        console.warn(`⚠️ [22P02 Fallback] Retrying chunk target upsert into ${table} with 22P02 sanitized payload...`);
                        const fallback22P02 = sanitizePayloadFor22P02(upChunk);
                        const res = await supabase.from(table).upsert(fallback22P02);
                        upsertError = res.error;
                    }

                    if (upsertError && (upsertError.code === 'PGRST204' || String(upsertError.code) === '42703' || (upsertError.message && String(upsertError.message).includes('does not exist')))) {
                        console.warn(`⚠️ [Fallback] Retrying chunk target upsert into ${table} without new columns...`);
                        const fallbackPayload = upChunk.map(p => {
                            const fp = sanitizePayloadFor22P02({ ...p });
                            OPTIONAL_NEW_COLUMNS.forEach(col => delete fp[col]);
                            return fp;
                        });
                        const { error: fallbackError } = await supabase.from(table).upsert(fallbackPayload);
                        if (fallbackError) {
                            if (table === 'dangky_records' && (fallbackError.code === '42P01' || fallbackError.code === 'PGRST205')) {
                                await supabase.from('land_records').upsert(fallbackPayload);
                            } else {
                                throw fallbackError;
                            }
                        }
                    } else if (upsertError) {
                        if (table === 'dangky_records' && (upsertError.code === '42P01' || upsertError.code === 'PGRST205')) {
                            await supabase.from('land_records').upsert(upChunk);
                        } else {
                            throw upsertError;
                        }
                    }
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

        // Cập nhật bộ nhớ đệm (Cache/IndexedDB) cho các hồ sơ vừa được cập nhật
        if (allModifiedRecords.length > 0) {
            syncCacheOnBatchUpdate(allModifiedRecords);
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

        if (landRows.length > 0) {
            purgeBatchFromOtherTables(landRows.map(r => r.id), landRows.map(r => r.code), 'land_records');
        }
        if (dangkyRows.length > 0) {
            purgeBatchFromOtherTables(dangkyRows.map(r => r.id), dangkyRows.map(r => r.code), 'dangky_records');
        }
        if (luutruRows.length > 0) {
            purgeBatchFromOtherTables(luutruRows.map(r => r.id), luutruRows.map(r => r.code), 'luutru_records');
        }
        
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
            } else {
                purgeRecordFromOtherTables(r.id, r.code, targetTable);
            }
        }
        syncCacheOnBatchUpdate(records);
        return true;
    } catch (error) {
        logError("bulkUpdateDangKyRecordsApi", error, true);
        return false;
    }
};

