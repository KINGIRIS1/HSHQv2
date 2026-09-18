import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, RecordStatus } from '../types';
import { MOCK_RECORDS, API_BASE_URL, isArchiveRecordType, getShortRecordType, isSurveyRecordType, getSurveyRecordPrefix, isCertificateRecordType } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, sanitizePayloadFor22P02, sanitizePayloadForDateErrors, normalizeCode, mapRecordFromDb, keepOnlyDate, isBlankRecord } from './apiCore';
import { getIndexedDBItem } from './storageService';
import { addPendingRecord, removePendingRecord, getPendingRecords, getPendingSyncItems, syncPendingRecordsToCloud, generateStandardUUID, isValidUUID } from './syncQueueService';
import { deriveActualSurveyStatus } from '../utils/appHelpers';

// 24 cột cơ sở dữ liệu cốt lõi
export const RECORD_DB_COLUMNS = [
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
    'attachedFiles', 'dossierComponents',
    'appraisalDate', 'postingDate', 'postingEndDate', 'taxTransferDate', 'taxKv7Date', 'taxPaymentDate', 'printCertDate', 'pendingHandoverDate',
    'sourceTable', 'previousStatus', 'supplementReason', 'supplementRequestDate', 'supplementReturnedDate'
];

/**
 * Cơ chế Khóa bảo vệ thời gian thực (Optimistic Timestamp Guard):
 * Ghi nhận các hồ sơ vừa được người dùng chuyển bước hoặc cập nhật trong vòng 45 giây.
 * Tiến trình Polling nền 60s và Realtime sẽ không được phép dùng dữ liệu cũ từ server để đè lên.
 */
export const RECENTLY_UPDATED_RECORDS = new Map<string, { record: RecordFile; updatedAt: number }>();

export const markRecordsRecentlyUpdated = (records: (RecordFile | Partial<RecordFile>)[]) => {
    const now = Date.now();
    // Dọn dẹp các mục cũ quá 2 phút để giải phóng bộ nhớ
    for (const [id, item] of RECENTLY_UPDATED_RECORDS.entries()) {
        if (now - item.updatedAt > 120000) {
            RECENTLY_UPDATED_RECORDS.delete(id);
        }
    }
    records.forEach(r => {
        if (r && r.id) {
            const existing = RECENTLY_UPDATED_RECORDS.get(r.id);
            const merged = { ...(existing?.record || {}), ...r } as RecordFile;
            RECENTLY_UPDATED_RECORDS.set(r.id, {
                record: merged,
                updatedAt: now
            });
        }
    });
};

/**
 * Định tuyến bảng dữ liệu chuẩn xác theo tiền tố mã thủ tục:
 * - Nhóm 1.x (Sao lục, Công văn, Cung cấp dữ liệu đất đai) -> luutru_records
 * - Nhóm 2.x (Trích lục, Trích đo, Duyệt đơn, Cắm mốc, Tách-Hợp thửa) -> land_records
 * - Nhóm 3.x (Đăng ký đất đai, Cấp giấy, Đăng ký biến động) -> dangky_records
 */
export const getTargetTable = (record: Partial<RecordFile>): 'dangky_records' | 'land_records' | 'luutru_records' => {
    // 0. Ưu tiên tuyệt đối nếu sourceTable đã được chỉ định (như Module Cấp giấy hoặc Module Lưu trữ)
    if (record.sourceTable === 'dangky_records') return 'dangky_records';
    if (record.sourceTable === 'luutru_records' || record.sourceTable === 'archive_records') return 'luutru_records';
    if (record.sourceTable === 'land_records') return 'land_records';

    const rawType = String(record.recordType || record.content || '').trim();
    const code = String(record.code || '').trim();
    const shortType = getShortRecordType(rawType);
    const groupStr = String(record.group || '').trim();

    // 1. Phân loại theo tiền tố mã thủ tục hoặc tên thủ tục chuyên môn (ƯU TIÊN HÀNG ĐẦU TẠI CÁC MODULE)
    // Nhóm 1.x / Mã LT- -> Tổ Lưu trữ (luutru_records)
    if (
        shortType.startsWith('1.') ||
        rawType.startsWith('1.') ||
        code.startsWith('1.') ||
        code.toUpperCase().startsWith('LT-') ||
        groupStr.startsWith('1.') ||
        isArchiveRecordType(record.recordType) ||
        isArchiveRecordType(record.content)
    ) {
        return 'luutru_records';
    }

    // Nhóm 3.x -> Tổ Cấp giấy / Đăng ký (dangky_records)
    if (
        shortType.startsWith('3.') ||
        rawType.startsWith('3.') ||
        code.startsWith('3.') ||
        groupStr.startsWith('3.') ||
        groupStr.includes('Đăng ký') ||
        groupStr.includes('Cấp GCN') ||
        groupStr.includes('Cấp giấy') ||
        isCertificateRecordType(record)
    ) {
        return 'dangky_records';
    }

    // Nhóm 2.x -> Tổ Đo đạc (land_records)
    if (
        shortType.startsWith('2.') ||
        rawType.startsWith('2.') ||
        code.startsWith('2.') ||
        groupStr.startsWith('2.') ||
        groupStr.includes('Đo đạc')
    ) {
        return 'land_records';
    }

    // 2. Phân loại theo phòng ban/bộ phận nếu không phân định được theo mã thủ tục
    const deptStr = String((record as any).department || '').trim().toLowerCase();
    if (deptStr.includes('lưu trữ') || deptStr.includes('luu tru')) {
        return 'luutru_records';
    }
    if (deptStr.includes('đăng ký') || deptStr.includes('cấp giấy') || deptStr.includes('dang ky') || deptStr.includes('cap giay')) {
        return 'dangky_records';
    }
    if (deptStr.includes('đo đạc') || deptStr.includes('do dac')) {
        return 'land_records';
    }

    // Tra cứu nhanh từ Cache nếu không có recordType
    if (record.id || record.code) {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        const found = cached.find(r => (record.id && r.id === record.id) || (record.code && r.code === record.code));
        if (found) {
            if (found.sourceTable === 'dangky_records') return 'dangky_records';
            if (found.sourceTable === 'luutru_records') return 'luutru_records';
            if (found.sourceTable === 'land_records') return 'land_records';
            if (found.recordType || found.content) {
                return getTargetTable(found);
            }
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
    'drafterId', 'officeAssignedDate', 'officeCompletedDate',
    'exportBatch', 'exportDate', 'handoverWard', 'attachedFiles', 'dossierComponents'
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

    // Tự động phát hiện và di chuyển các hồ sơ bị phân nhầm vào land_records (ví dụ hồ sơ Lưu trữ 1.x / mã LT-)
    const misplacedInLand = land
        .map(mapRecordFromDb)
        .filter((r): r is RecordFile => !!r && getTargetTable(r) !== 'land_records');

    // Tự động phát hiện các dòng hoàn toàn trống rác trong land_records, dangky_records, luutru_records
    const blankInLandIds = new Set(
        land.map(mapRecordFromDb).filter((r): r is RecordFile => !!r && isBlankRecord(r)).map(r => r.id)
    );
    const blankInDangkyIds = new Set(
        dangky.map(mapRecordFromDb).filter((r): r is RecordFile => !!r && isBlankRecord(r)).map(r => r.id)
    );
    const blankInLuutruIds = new Set(
        luutru.map(mapRecordFromDb).filter((r): r is RecordFile => !!r && isBlankRecord(r)).map(r => r.id)
    );
    const allBlankIds = new Set([...blankInLandIds, ...blankInDangkyIds, ...blankInLuutruIds]);

    if (misplacedInDangky.length > 0 || misplacedInLand.length > 0 || allBlankIds.size > 0) {
        console.log(`[Auto-Fix] Phát hiện ${misplacedInDangky.length} sai ở dangky, ${misplacedInLand.length} sai ở land_records, ${allBlankIds.size} dòng trống. Đang tự động xử lý...`);
        setTimeout(async () => {
            try {
                const landFixesFromDangky = misplacedInDangky.filter(r => getTargetTable(r) === 'land_records');
                const luutruFixesFromDangky = misplacedInDangky.filter(r => getTargetTable(r) === 'luutru_records');

                if (landFixesFromDangky.length > 0) {
                    await supabase.from('land_records').upsert(landFixesFromDangky.map(r => sanitizeData(r, RECORD_DB_COLUMNS)));
                    await purgeBatchFromOtherTables(landFixesFromDangky.map(r => r.id), landFixesFromDangky.map(r => r.code), 'land_records');
                }
                if (luutruFixesFromDangky.length > 0) {
                    await supabase.from('luutru_records').upsert(luutruFixesFromDangky.map(r => sanitizeData(r, RECORD_DB_COLUMNS)));
                    await purgeBatchFromOtherTables(luutruFixesFromDangky.map(r => r.id), luutruFixesFromDangky.map(r => r.code), 'luutru_records');
                }

                const luutruFixesFromLand = misplacedInLand.filter(r => getTargetTable(r) === 'luutru_records');
                const dangkyFixesFromLand = misplacedInLand.filter(r => getTargetTable(r) === 'dangky_records');

                if (luutruFixesFromLand.length > 0) {
                    await supabase.from('luutru_records').upsert(luutruFixesFromLand.map(r => sanitizeData(r, RECORD_DB_COLUMNS)));
                    await purgeBatchFromOtherTables(luutruFixesFromLand.map(r => r.id), luutruFixesFromLand.map(r => r.code), 'luutru_records');
                }
                if (dangkyFixesFromLand.length > 0) {
                    await supabase.from('dangky_records').upsert(dangkyFixesFromLand.map(r => sanitizeData(r, RECORD_DB_COLUMNS)));
                    await purgeBatchFromOtherTables(dangkyFixesFromLand.map(r => r.id), dangkyFixesFromLand.map(r => r.code), 'dangky_records');
                }

                if (blankInLandIds.size > 0) {
                    await supabase.from('land_records').delete().in('id', Array.from(blankInLandIds));
                }
                if (blankInDangkyIds.size > 0) {
                    await supabase.from('dangky_records').delete().in('id', Array.from(blankInDangkyIds));
                }
                if (blankInLuutruIds.size > 0) {
                    await supabase.from('luutru_records').delete().in('id', Array.from(blankInLuutruIds));
                }
            } catch (err) {
                console.error("[Auto-Fix Misplaced/Blank Records] Lỗi khi xử lý:", err);
            }
        }, 300);
    }
    
    const rawList = [...dangky, ...land, ...luutru];
    rawList.forEach(item => {
        const mapped = mapRecordFromDb(item);
        if (mapped && mapped.id && !allBlankIds.has(mapped.id)) {
            uniqueMap.set(mapped.id, mapped);
        }
    });

    // 2. [QUAN TRỌNG NHẤT] Hợp nhất các hồ sơ đang chờ đồng bộ (Sync Queue)
    // Đảm bảo không ghi đè dữ liệu Cloud mới hơn bằng bản ghi pending cũ (như khi vừa lui bước rồi tiến lên Đã giao 1 cửa)
    const pendingItems = await getPendingSyncItems();
    for (const item of pendingItems) {
        const pending = item.record;
        if (!pending || !pending.id) continue;
        const cloudRecord = uniqueMap.get(pending.id);
        if (cloudRecord) {
            const getRecordTime = (r: RecordFile): number => {
                let maxT = 0;
                if ((r as any).updatedAt) maxT = Math.max(maxT, new Date((r as any).updatedAt).getTime() || 0);
                if (Array.isArray(r.statusLogs) && r.statusLogs.length > 0) {
                    r.statusLogs.forEach((l: any) => {
                        if (l?.changedAt) maxT = Math.max(maxT, new Date(l.changedAt).getTime() || 0);
                    });
                }
                return maxT;
            };
            const cloudTime = getRecordTime(cloudRecord);
            const pendingTime = Math.max(
                getRecordTime(pending),
                item.queuedAt ? new Date(item.queuedAt).getTime() : 0
            );

            if (cloudTime > pendingTime) {
                console.log(`[SyncEngine] Gỡ bỏ bản ghi pending lỗi thời của ${pending.code || pending.id} do Cloud đã có dữ liệu mới hơn.`);
                await removePendingRecord(pending.id, pending.code);
                continue;
            }
            uniqueMap.set(pending.id, { ...cloudRecord, ...pending, _isOfflineSaved: true });
        } else {
            uniqueMap.set(pending.id, { ...pending, _isOfflineSaved: true });
        }
    }

    const finalRecords = Array.from(uniqueMap.values());
    console.log(`[FetchRecords] Đã nạp thành công ${finalRecords.length} hồ sơ (trong đó có ${pendingItems.length} hồ sơ chờ đồng bộ)`);

    if (finalRecords.length > 0) {
        saveToCache(CACHE_KEYS.RECORDS, finalRecords);
    }
    onProgress?.(3, finalRecords, true);

    // 3. Kích hoạt đồng bộ ngầm tự động nếu có hồ sơ tồn đọng
    if (pendingItems.length > 0) {
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

/**
 * Trích xuất số thứ tự (sequence number) từ mã hồ sơ một cách an toàn và chuẩn xác
 * Hỗ trợ tất cả cấu trúc mã: TK-260917-8318, 260916-54574, H19.151.11.22-260917-0001, LT-260917-0187, v.v.
 */
export const extractRecordSequence = (code: string | undefined | null, targetYearYy: string): number | null => {
    if (!code) return null;
    const clean = code.trim().replace(/[.,;]+$/, '');
    if (!clean || clean.toUpperCase() === 'HS' || clean === '--') return null;

    const parts = clean.split('-');
    if (parts.length < 2) return null;

    const lastPart = parts[parts.length - 1];
    const seqNum = parseInt(lastPart, 10);
    if (isNaN(seqNum) || seqNum <= 0) return null;

    // Kiểm tra xem các đoạn trước đó có chứa năm cần so khớp không
    const hasYearMatch = parts.slice(0, parts.length - 1).some(p => {
        const pClean = p.trim();
        return pClean.startsWith(targetYearYy) || pClean === `20${targetYearYy}` || pClean === targetYearYy;
    });

    if (hasYearMatch) {
        return seqNum;
    }
    return null;
};

/**
 * Quét trực tiếp thời gian thực trên Cloud Database để lấy số thứ tự lớn nhất hiện tại
 */
export const fetchMaxCloudSequence = async (yy: string, isLT: boolean, isCert: boolean): Promise<number> => {
    if (!isConfigured) return 0;
    try {
        if (isLT) {
            const [r1, r2] = await Promise.all([
                supabase.from('luutru_records').select('code').ilike('code', `LT-${yy}%`).order('created_at', { ascending: false }).limit(100),
                supabase.from('land_records').select('code').ilike('code', `LT-${yy}%`).order('created_at', { ascending: false }).limit(100)
            ]);
            let max = 0;
            const rows = [...(r1.data || []), ...(r2.data || [])];
            for (const row of rows) {
                const seq = extractRecordSequence(row.code, yy);
                if (seq !== null && seq > max) max = seq;
            }
            return max;
        } else if (isCert) {
            const [r1, r2] = await Promise.all([
                supabase.from('land_records').select('code').ilike('code', `H19.151.11.22-${yy}%`).order('created_at', { ascending: false }).limit(100),
                supabase.from('dangky_records').select('code').ilike('code', `H19.151.11.22-${yy}%`).order('created_at', { ascending: false }).limit(100)
            ]);
            let max = 0;
            const rows = [...(r1.data || []), ...(r2.data || [])];
            for (const row of rows) {
                const seq = extractRecordSequence(row.code, yy);
                if (seq !== null && seq > max) max = seq;
            }
            return max;
        } else {
            // Đo đạc (Survey)
            const { data } = await supabase
                .from('land_records')
                .select('code')
                .ilike('code', `%${yy}%`)
                .order('created_at', { ascending: false })
                .limit(150);

            let max = 0;
            if (data && data.length > 0) {
                for (const row of data) {
                    const c = (row.code || '').trim();
                    if (c.startsWith('LT-') || c.startsWith('H19.151.11.22-')) continue;
                    const seq = extractRecordSequence(c, yy);
                    if (seq !== null) {
                        if (seq >= 50000) continue; // Bỏ qua mã một cửa để không nhảy vọt số thứ tự nội bộ
                        if (seq > max) max = seq;
                    }
                }
            }
            return max;
        }
    } catch (err) {
        console.warn('Lỗi khi fetchMaxCloudSequence:', err);
        return 0;
    }
};

/**
 * Kiểm tra mã hồ sơ đã tồn tại trong bất kỳ bảng dữ liệu nào trên cơ sở dữ liệu cloud hay chưa
 */
export const checkRecordCodeExistsInDb = async (code: string, excludeId?: string): Promise<boolean> => {
    if (!code || !isConfigured) return false;
    try {
        const clean = code.trim();
        if (!clean || clean.toUpperCase() === 'HS' || clean === '--') return false;

        let qLand = supabase.from('land_records').select('id').ilike('code', clean);
        let qDangky = supabase.from('dangky_records').select('id').ilike('code', clean);
        let qLuutru = supabase.from('luutru_records').select('id').ilike('code', clean);

        if (excludeId) {
            qLand = qLand.neq('id', excludeId);
            qDangky = qDangky.neq('id', excludeId);
            qLuutru = qLuutru.neq('id', excludeId);
        }

        const [r1, r2, r3] = await Promise.all([
            qLand.limit(1),
            qDangky.limit(1),
            qLuutru.limit(1)
        ]);
        if ((r1.data && r1.data.length > 0) || (r2.data && r2.data.length > 0) || (r3.data && r3.data.length > 0)) {
            return true;
        }
    } catch (e) {
        console.error("Lỗi khi quét mã hồ sơ trên database:", e);
    }
    return false;
};

/**
 * Sinh số ngẫu nhiên 4 chữ số (1000 - 9999)
 */
export const generateRandom4Digit = (): string => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Tự động kiểm tra và giải quyết xung đột mã hồ sơ: Nếu mã ứng viên đã tồn tại trên DB,
 * tự động sinh số ngẫu nhiên 4 chữ số mới cho đến khi tìm được mã hoàn toàn duy nhất 100%
 */
export const resolveGuaranteedUniqueCode = async (
    candidateCode: string,
    excludeId?: string
): Promise<string> => {
    if (!candidateCode || !isConfigured) return candidateCode;
    let code = candidateCode.trim();
    if (!code || code.toUpperCase() === 'HS' || code === '--') return code;

    let exists = await checkRecordCodeExistsInDb(code, excludeId);
    if (!exists) return code;

    console.warn(`⚠️ Phát hiện mã "${code}" đã tồn tại trên Cloud DB. Đang tự động tạo số ngẫu nhiên 4 chữ số mới duy nhất...`);

    // Phân tích mã thành prefix và số ngẫu nhiên cuối cùng
    const match = code.match(/^(.*?[-_])(\d+)(\.?)$/);
    if (match) {
        const prefix = match[1];
        const suffix = match[3] || '';

        let attempts = 0;
        while (exists && attempts < 100) {
            attempts++;
            const rand4 = generateRandom4Digit();
            const nextCandidate = `${prefix}${rand4}${suffix}`;
            exists = await checkRecordCodeExistsInDb(nextCandidate, excludeId);
            if (!exists) {
                console.log(`✅ Đã giải quyết xung đột mã: Đổi thành công sang mã ngẫu nhiên duy nhất "${nextCandidate}"`);
                return nextCandidate;
            }
        }
    } else {
        let attempts = 0;
        while (exists && attempts < 100) {
            attempts++;
            const rand4 = generateRandom4Digit();
            const nextCandidate = `${code}-${rand4}`;
            exists = await checkRecordCodeExistsInDb(nextCandidate, excludeId);
            if (!exists) return nextCandidate;
        }
    }
    return code;
};

export const getNextGlobalRecordCode = async (
    dateStr: string, 
    isArchive = false, 
    recordType = '', 
    receivedBy = '', 
    wardName = ''
): Promise<string> => {
    const rType = (recordType || '').toLowerCase();
    const isLT = isArchive || isArchiveRecordType(recordType) || rType.startsWith('1.');
    const isCert = !isLT && isCertificateRecordType(recordType);
    const isSurvey = !isLT && !isCert && isSurveyRecordType(recordType);

    const d = new Date(dateStr || new Date());
    const year = d.getFullYear().toString();
    const yy = year.slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;

    let prefix = '';
    if (isLT) {
        prefix = 'LT-';
    } else if (isCert) {
        prefix = 'H19.151.11.22-';
    } else if (isSurvey) {
        const p2 = getSurveyRecordPrefix(receivedBy, [], wardName);
        prefix = p2 ? `${p2}-` : '';
    }

    const codeBase = `${prefix}${datePrefix}-`;

    // Sinh ngẫu nhiên 4 chữ số theo ngày, kiểm tra tính duy nhất trực tiếp trên Cloud DB
    let candidate = '';
    let attempts = 0;
    while (attempts < 100) {
        attempts++;
        const rand4 = generateRandom4Digit();
        candidate = `${codeBase}${rand4}`;
        if (!isConfigured) return candidate;

        const exists = await checkRecordCodeExistsInDb(candidate);
        if (!exists) {
            return candidate;
        }
    }

    return await resolveGuaranteedUniqueCode(candidate);
};

/**
 * Quét toàn diện hệ thống (bộ nhớ local + cơ sở dữ liệu cloud) để đảm bảo cấp mã duy nhất 100% không trùng
 */
export const getVerifiedUniqueRecordCode = async (
    generateBaseCode: (extraCodes: string[]) => string,
    localRecords: { code?: string | null }[] = []
): Promise<string> => {
    const localCodes = new Set(
        localRecords
            .map(r => (r.code || '').trim().toLowerCase())
            .filter(Boolean)
    );
    
    let extraExcluded: string[] = [];
    let candidate = '';
    let attempts = 0;
    
    while (attempts < 100) {
        attempts++;
        candidate = generateBaseCode(extraExcluded);
        if (!candidate) break;
        
        // 1. Quét kiểm tra trong bộ nhớ local của hệ thống
        if (localCodes.has(candidate.toLowerCase())) {
            extraExcluded.push(candidate);
            continue;
        }
        
        // 2. Quét kiểm tra trên cơ sở dữ liệu máy chủ
        if (isConfigured) {
            const existsInDb = await checkRecordCodeExistsInDb(candidate);
            if (existsInDb) {
                extraExcluded.push(candidate);
                continue;
            }
        }
        
        // Cả local và database đều không có mã này -> Đã xác thực an toàn tuyệt đối, cấp mã!
        return candidate;
    }
    
    // Nếu vẫn bị trùng, giải quyết nguyên tử bằng hàm tăng tiến an toàn
    return await resolveGuaranteedUniqueCode(candidate);
};

/**
 * Tự động cập nhật bộ đếm archive_record_counter_${year} nếu mã hồ sơ lưu trữ có số thứ tự lớn hơn
 */
export const updateArchiveCounterIfHigher = async (code?: string | null, dateStr?: string) => {
    if (!isConfigured || !code || !code.startsWith('LT-')) return;
    try {
        const parts = code.trim().replace(/^LT-/, '').split('-');
        if (parts.length < 2) return;
        const rDate = parts[0];
        const rSeq = parts[1];
        const seq = parseInt(rSeq, 10);
        if (isNaN(seq) || seq <= 0 || seq >= 50000) return;

        let year = '';
        if (rDate.length === 4 && /^\d{4}$/.test(rDate)) {
            year = rDate;
        } else if (rDate.length >= 2 && /^\d+$/.test(rDate.substring(0, 2))) {
            year = '20' + rDate.substring(0, 2);
        } else if (dateStr) {
            year = new Date(dateStr).getFullYear().toString();
        } else {
            year = new Date().getFullYear().toString();
        }

        const key = `archive_record_counter_${year}`;
        const { data } = await supabase.from('system_settings').select('value').eq('key', key).single();
        const currentVal = data?.value ? parseInt(data.value, 10) : 0;
        if (seq > currentVal) {
            if (data) {
                await supabase.from('system_settings').update({ value: seq.toString() }).eq('key', key);
            } else {
                await supabase.from('system_settings').insert([{ key, value: seq.toString() }]);
            }
        }
    } catch (_) {}
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
        let finalCode = record.code ? record.code.trim() : '';
        const targetTable = getTargetTable(recordToSave);
        const isArchive = targetTable === 'luutru_records';
        const isCert = targetTable === 'dangky_records' || isCertificateRecordType(recordToSave);

        // NGUYÊN TẮC QUAN TRỌNG: Ưu tiên tuyệt đối mã hồ sơ do người dùng nhập vào tại tất cả các module chuyên môn (Đo đạc, Lưu trữ, Cấp giấy...).
        // Chỉ khi người dùng KHÔNG nhập mã (để trống, khoảng trắng, hoặc ký hiệu tạm '?' / 'HS'), hệ thống mới tự sinh mã mới.
        const isInvalidOrEmptyCode = !finalCode || 
                                     finalCode.includes('?') || 
                                     finalCode.toUpperCase() === 'HS' || 
                                     finalCode === '--' ||
                                     finalCode.toLowerCase() === 'chưa có mã';

        // Luôn đảm bảo id là chuẩn UUID RFC4122 để không bị lỗi 22P02 của PostgreSQL
        const standardId = (recordToSave.id && isValidUUID(recordToSave.id)) ? recordToSave.id : generateStandardUUID();

        if (isInvalidOrEmptyCode) {
            finalCode = await getNextGlobalRecordCode(
                record.receivedDate || new Date().toISOString(), 
                isArchive,
                record.recordType || '',
                record.receivedBy || '',
                record.ward || ''
            );
        } else {
            // NGUYÊN TẮC BẢO MẬT VÀ CHỐNG TRÙNG MÃ 100%:
            // Cho dù người dùng tự nhập mã hay giao diện sinh mã, hệ thống luôn kiểm tra
            // và tự động giải quyết xung đột mã trên Cloud DB ngay trước khi insert
            finalCode = await resolveGuaranteedUniqueCode(finalCode, standardId);
        }
        
        const validReceivedDate = keepOnlyDate(record.receivedDate) || new Date().toISOString().split('T')[0];

        const assignedGroup = targetTable === 'dangky_records' 
            ? '3. Đăng ký đất đai, cấp GCN' 
            : (targetTable === 'luutru_records' ? '1. Cung cấp thông tin, dữ liệu đất đai' : '2. Đo đạc bản đồ');

        recordToSave = { 
            ...record, 
            id: standardId,
            code: finalCode,
            receivedDate: validReceivedDate,
            status: record.status || RecordStatus.RECEIVED,
            sourceTable: targetTable,
            group: assignedGroup
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

        // 1.1. Thử lại nếu lỗi định dạng ngày tháng 22007/22008
        if (error && (error.code === '22007' || error.code === '22008' || String(error.message || '').includes('date') || String(error.message || '').includes('timestamp') || String(error.message || '').includes('time'))) {
            console.warn(`⚠️ [Date Fallback] Thử lại insert vào ${targetTable} với dữ liệu ngày tháng đã làm sạch...`);
            const fallbackDatePayload = sanitizePayloadForDateErrors(payload);
            const res = await supabase.from(targetTable).insert([fallbackDatePayload]).select();
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
        
        if (error) throw error;

        const result = mapRecordFromDb({ ...recordToSave, ...(data?.[0] || {}), sourceTable: targetTable }) as RecordFile;
        if (result) {
            // Cập nhật bộ đếm số dài theo năm nếu là hồ sơ lưu trữ
            if (isArchive || (result.code && result.code.startsWith('LT-'))) {
                updateArchiveCounterIfHigher(result.code, result.receivedDate || undefined);
            }
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
    // 0. Khóa bảo vệ thời gian thực chống giật lùi trạng thái
    markRecordsRecentlyUpdated([record]);

    // 1. ĐỒNG BỘ TỨC THỜI VÀO RAM VÀ BỘ NHỚ ĐỆM (INSTANT CACHE SYNC)
    const memIdx = MOCK_RECORDS.findIndex(r => r.id === record.id);
    if (memIdx !== -1) {
        MOCK_RECORDS[memIdx] = { ...MOCK_RECORDS[memIdx], ...record };
    }
    syncCacheOnUpdate(record);

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

                if (error && (error.code === '22007' || error.code === '22008' || String(error.message || '').includes('date') || String(error.message || '').includes('timestamp') || String(error.message || '').includes('time'))) {
                    console.warn(`⚠️ [Date Fallback] Retrying update on ${tbl} with date sanitized payload...`);
                    const fallbackDatePayload = sanitizePayloadForDateErrors(payload);
                    const res = await supabase.from(tbl).update(fallbackDatePayload).eq('id', record.id).select();
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
    // 0. Khóa bảo vệ thời gian thực chống giật lùi trạng thái
    markRecordsRecentlyUpdated([{ id, ...fields }]);

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

                if (error && (error.code === '22007' || error.code === '22008' || String(error.message || '').includes('date') || String(error.message || '').includes('timestamp') || String(error.message || '').includes('time'))) {
                    console.warn(`⚠️ [Date Fallback] Retrying updateRecordFieldsApi on ${tbl} with date sanitized payload...`);
                    const fallbackDatePayload = sanitizePayloadForDateErrors(payload);
                    const res = await supabase.from(tbl).update(fallbackDatePayload).eq('id', id).select();
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
        const seenCodesInBatch = new Set<string>();
        
        for (const r of records) {
            let finalCode = (r.code || '').trim();
            if (!finalCode || finalCode.includes('?') || finalCode.toUpperCase() === 'HS' || finalCode === '--') {
                finalCode = await getNextGlobalRecordCode(r.receivedDate || new Date().toISOString());
            }

            // Giải quyết xung đột trên Cloud DB
            finalCode = await resolveGuaranteedUniqueCode(finalCode, r.id);

            // Đảm bảo không trùng với các hồ sơ khác trong cùng file tải lên / batch
            while (seenCodesInBatch.has(finalCode.toLowerCase())) {
                finalCode = await resolveGuaranteedUniqueCode(finalCode, r.id);
            }
            seenCodesInBatch.add(finalCode.toLowerCase());
            
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

                if (error && (error.code === '22007' || error.code === '22008' || String(error.message || '').includes('date') || String(error.message || '').includes('timestamp') || String(error.message || '').includes('time'))) {
                    console.warn(`⚠️ [Date Fallback] Retrying batch insert into ${table} chunk ${i} with date sanitized payload...`);
                    const fallbackDate = sanitizePayloadForDateErrors(chunk);
                    const res = await supabase.from(table).insert(fallbackDate);
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
                        // Tự động suy luận lại trạng thái chuẩn theo mốc thời gian thực tế
                        if (dbEntry.table === 'land_records' || !isArchiveRecordType(merged.recordType || '')) {
                            merged.status = deriveActualSurveyStatus(merged);
                        }
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
                } else {
                    // Nếu mã chưa tồn tại trong DB khi Cập nhật, tự động thêm mới vào đúng bảng phù hợp (mặc định land_records)
                    const newRecord = { ...excelRecord };
                    if (!newRecord.id || !isValidUUID(newRecord.id)) {
                        newRecord.id = generateStandardUUID();
                    }
                    const rTypeStr = String(newRecord.recordType || '').trim();
                    let targetTable: 'land_records' | 'luutru_records' | 'dangky_records' = 'land_records';
                    
                    if (newRecord.sourceTable === 'dangky_records' || isCertificateRecordType(rTypeStr) || rTypeStr.startsWith('3.')) {
                        targetTable = 'dangky_records';
                    } else if (newRecord.sourceTable === 'luutru_records' || isArchiveRecordType(rTypeStr) || rTypeStr.startsWith('1.')) {
                        targetTable = 'luutru_records';
                    } else {
                        targetTable = 'land_records';
                    }
                    
                    if (targetTable === 'land_records' || !isArchiveRecordType(newRecord.recordType || '')) {
                        newRecord.status = deriveActualSurveyStatus(newRecord);
                    }
                    
                    const sanitized = sanitizeData(newRecord, RECORD_DB_COLUMNS);
                    if (targetTable === 'luutru_records') {
                        luutruUpdates.push(sanitized);
                    } else if (targetTable === 'dangky_records') {
                        dangkyUpdates.push(sanitized);
                    } else {
                        landUpdates.push(sanitized);
                    }
                    allModifiedRecords.push(newRecord as RecordFile);
                    updateCount++;
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
                            (fallbackError as any).context = `forceUpdateRecordsBatchApi (${table})`;
                            throw fallbackError;
                        }
                    } else if (upsertError) {
                        (upsertError as any).context = `forceUpdateRecordsBatchApi (${table})`;
                        throw upsertError;
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

    } catch (error: any) {
        const ctx = error?.context || "forceUpdateRecordsBatchApi (land_records)";
        logError(ctx, error);
        return { success: false, count: 0 };
    }
};

// Cập nhật hàng loạt hồ sơ an toàn bằng ID (Phòng tránh trùng mã hồ sơ)
export const updateRecordsBatchById = async (updates: Partial<RecordFile>[], onProgress?: (processed: number, total: number) => void): Promise<{ success: boolean; count: number }> => {
    if (!updates || updates.length === 0) return { success: true, count: 0 };

    // 0. Khóa bảo vệ thời gian thực cho toàn bộ hồ sơ vừa chuyển trạng thái (ngăn chặn polling nền đè lùi trạng thái)
    markRecordsRecentlyUpdated(updates);

    // 1. ĐỒNG BỘ NGAY VÀO RAM VÀ BỘ NHỚ ĐỆM (INSTANT CACHE & MEMORY SYNC)
    // Đảm bảo giao diện và bộ nhớ cache lập tức khóa trạng thái mới, không bị giật lùi kể cả khi mạng chậm
    updates.forEach(up => {
        const idx = MOCK_RECORDS.findIndex(r => r.id === up.id);
        if (idx !== -1) {
            MOCK_RECORDS[idx] = { ...MOCK_RECORDS[idx], ...up } as RecordFile;
        }
    });
    syncCacheOnBatchUpdate(updates);

    if (!isConfigured) {
        saveToCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: updates.length };
    }

    try {
        // 2. TÌM BẢNG VÀ GHÉP DỮ LIỆU ĐẦY ĐỦ (Tránh phán đoán sai bảng do updates chỉ chứa một phần trường)
        const idToExistingMap = new Map<string, RecordFile>();
        MOCK_RECORDS.forEach(r => idToExistingMap.set(r.id, r));

        const fullMergedUpdates: RecordFile[] = updates.map(u => {
            const existing = u.id ? idToExistingMap.get(u.id) : undefined;
            return { ...(existing || {}), ...u } as RecordFile;
        });

        const landRows: any[] = [];
        const dangkyRows: any[] = [];
        const luutruRows: any[] = [];

        fullMergedUpdates.forEach(u => {
            const table = getTargetTable(u);
            const sanitizedRow = sanitizeData(u, RECORD_DB_COLUMNS);

            if (u.exportBatch || u.exportDate || u.handoverWard) {
                const currentData = (typeof sanitizedRow.data === 'object' && sanitizedRow.data !== null) ? { ...sanitizedRow.data } : {};
                if (u.exportBatch) {
                    currentData.exportBatch = u.exportBatch;
                    currentData.danh_sach = u.exportBatch;
                }
                if (u.exportDate) {
                    currentData.exportDate = u.exportDate;
                    currentData.ngay_hoan_thanh = u.exportDate;
                }
                if (u.handoverWard) {
                    currentData.handoverWard = u.handoverWard;
                }
                sanitizedRow.data = currentData;
            }

            if (table === 'luutru_records') {
                luutruRows.push(sanitizedRow);
            } else if (table === 'dangky_records') {
                dangkyRows.push(sanitizedRow);
            } else {
                landRows.push(sanitizedRow);
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

            if (error && (error.code === '22007' || error.code === '22008' || String(error.message || '').includes('date') || String(error.message || '').includes('timestamp'))) {
                console.warn(`⚠️ [Date Fallback] Retrying updateRecordsBatchById on ${table} with date sanitized payload...`);
                const fallbackDateRows = payload.map(r => sanitizePayloadForDateErrors(r));
                const res = await supabase.from(table).upsert(fallbackDateRows);
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
                throw error;
            }
        };

        const results = await Promise.allSettled([
            upsertIntoTable('land_records', landRows),
            upsertIntoTable('dangky_records', dangkyRows),
            upsertIntoTable('luutru_records', luutruRows)
        ]);

        // Nếu bảng nào gặp lỗi mạng hoặc lỗi Supabase, tự động đẩy hồ sơ vào hàng đợi Offline Sync để tự động thử lại
        results.forEach((res, index) => {
            if (res.status === 'rejected') {
                const table = index === 0 ? 'land_records' : index === 1 ? 'dangky_records' : 'luutru_records';
                const rows = index === 0 ? landRows : index === 1 ? dangkyRows : luutruRows;
                console.warn(`⚠️ Cập nhật bảng ${table} thất bại, đang xếp ${rows.length} hồ sơ vào hàng đợi tự động đồng bộ:`, res.reason);
                rows.forEach(r => {
                    addPendingRecord(r as RecordFile, 'UPDATE', table).catch(e => console.error("Error adding to sync queue:", e));
                });
            }
        });

        // Dọn dẹp bản ghi trùng ở bảng khác
        if (landRows.length > 0) {
            purgeBatchFromOtherTables(landRows.map(r => r.id), landRows.map(r => r.code), 'land_records');
        }
        if (dangkyRows.length > 0) {
            purgeBatchFromOtherTables(dangkyRows.map(r => r.id), dangkyRows.map(r => r.code), 'dangky_records');
        }
        if (luutruRows.length > 0) {
            purgeBatchFromOtherTables(luutruRows.map(r => r.id), luutruRows.map(r => r.code), 'luutru_records');
        }
        
        await syncCacheOnBatchUpdate(fullMergedUpdates);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: updates.length };
    } catch (error) {
        logError("updateRecordsBatchById", error);
        // Ngay cả khi có ngoại lệ chung, vẫn xếp toàn bộ updates vào Sync Queue để không mất dữ liệu
        updates.forEach(u => {
            addPendingRecord(u as RecordFile, 'UPDATE').catch(e => console.error(e));
        });
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
                // Thử lại duy nhất trên targetTable đã chỉ định
                await supabase.from(targetTable).update(payload).or(`id.eq.${r.id},code.eq.${r.code}`);
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

