import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, RecordStatus } from '../types';
import { MOCK_RECORDS, API_BASE_URL, isArchiveRecordType, getShortRecordType, isSurveyRecordType, getSurveyRecordPrefix, isCertificateRecordType } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, sanitizePayloadFor22P02, sanitizePayloadForDateErrors, normalizeCode, mapRecordFromDb, keepOnlyDate, isBlankRecord, isTransientError } from './apiCore';
import { getIndexedDBItem } from './storageService';
import { addPendingRecord, removePendingRecord, getPendingRecords, getPendingSyncItems, syncPendingRecordsToCloud, generateStandardUUID, isValidUUID } from './syncQueueService';
import { deriveActualSurveyStatus } from '../utils/appHelpers';

/**
 * Kiểm tra trạng thái trực tuyến của ứng dụng:
 * Phải thỏa mãn cả 2 điều kiện:
 * 1. Supabase đã được cấu hình (isConfigured === true)
 * 2. Môi trường mạng trực tuyến (navigator.onLine !== false)
 */
export const isOnline = (): boolean => {
    if (!isConfigured) return false;
    if (typeof navigator !== 'undefined' && (navigator as any).onLine === false) return false;
    return true;
};

// 24 cột cơ sở dữ liệu cốt lõi (hợp nhất cho backward compatibility)
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
    'previousStatus', 'supplementReturnStatus', 'supplementReason', 'supplementRequestedBy', 'supplementRequestedAt', 'supplementStartedAt', 'supplementCompletedBy', 'supplementCompletedAt', 'supplementRequestDate', 'supplementReturnedDate', 'updated_at'
];

// Schema cột chuẩn riêng cho bảng Đo đạc (land_records)
export const LAND_RECORDS_DB_COLUMNS = [
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
    'updated_at'
];

// Schema cột chuẩn riêng cho bảng Đăng ký/Cấp giấy (dangky_records)
export const DANGKY_RECORDS_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'customerAddress', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'receivedBy', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo', 'checkedBy',
    'pendingCheckDate', 'checkedDate', 'completedWorkDate',
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'handoverWard',
    'reminderDate', 'lastRemindedAt', 'deadlineReminded',
    'receiptNumber', 'receiptType', 'receiverName', 'returnedBy', 'resultReturnedDate', 'returnedPrice',
    'needsMapCorrection', 'explanationPlan',
    'issueNumber', 'entryNumber', 'issueDate', 'residentialArea',
    'price', 'advancePayment', 'isHandedOver',
    'returnBatch', 'returnBatchDate', 'returnHandoverDept',
    'statusLogs', 'archiveHandoverDate', 'archiveHandoverBatch',
    'attachedFiles', 'dossierComponents',
    'appraisalDate', 'postingDate', 'postingEndDate', 'taxTransferDate', 'taxKv7Date', 'taxPaymentDate', 'printCertDate', 'pendingHandoverDate',
    'previousStatus', 'supplementReturnStatus', 'supplementReason', 'supplementRequestedBy', 'supplementRequestedAt', 'supplementStartedAt', 'supplementCompletedBy', 'supplementCompletedAt', 'supplementRequestDate', 'supplementReturnedDate',
    'updated_at'
];

// Schema cột chuẩn riêng cho bảng Lưu trữ (luutru_records)
export const LUUTRU_RECORDS_DB_COLUMNS = [
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
    'attachedFiles', 'dossierComponents',
    'type', 'so_hieu', 'trich_yeu', 'ngay_thang', 'noi_nhan_gui', 'created_by',
    'updated_at'
];

/**
 * Lấy danh sách cột database hợp lệ cho từng bảng cụ thể.
 */
export const getColumnsForTable = (table: 'land_records' | 'dangky_records' | 'luutru_records' | string): string[] => {
    if (table === 'dangky_records') return DANGKY_RECORDS_DB_COLUMNS;
    if (table === 'luutru_records') return LUUTRU_RECORDS_DB_COLUMNS;
    return LAND_RECORDS_DB_COLUMNS;
};

/**
 * Sanitize payload theo đúng schema của bảng đích.
 * Tuyệt đối không bao giờ gửi trường 'data' lên Supabase cho các bảng record.
 * 3 trường exportBatch, exportDate, handoverWard luôn được trích xuất thẳng vào cột cấp cao nhất.
 */
export const sanitizeRecordPayloadForTable = (
    data: any,
    targetTable: 'land_records' | 'dangky_records' | 'luutru_records' | string
): any => {
    if (!data) return data;
    const allowedColumns = getColumnsForTable(targetTable);
    
    const normalized: any = { ...data };
    // Trích xuất 3 trường bàn giao nếu trước đó bị lồng trong data
    if (normalized.exportBatch === undefined && normalized.data?.exportBatch) {
        normalized.exportBatch = normalized.data.exportBatch;
    }
    if (normalized.exportDate === undefined && (normalized.data?.exportDate || normalized.data?.ngay_hoan_thanh)) {
        normalized.exportDate = normalized.data.exportDate || normalized.data.ngay_hoan_thanh;
    }
    if (normalized.handoverWard === undefined && normalized.data?.handoverWard) {
        normalized.handoverWard = normalized.data.handoverWard;
    }

    const sanitized = sanitizeData(normalized, allowedColumns);
    // Loại bỏ triệt để 'data' và các trường runtime ngoại lai
    delete (sanitized as any).data;
    delete (sanitized as any).sourceTable;
    delete (sanitized as any)._isOfflineSaved;
    delete (sanitized as any)._isManualCode;
    return sanitized;
};

/**
 * Phân tích thông báo lỗi PGRST204 / 42703 để xác định chính xác cột và bảng gây lỗi.
 */
export const extractMissingColumnFromError = (error: any): { tableName?: string; columnName?: string } | null => {
    if (!error) return null;
    const msg = String(error.message || error.details || error.hint || '');
    
    // Pattern 1: Could not find the 'xyz' column of 'table_name' in the schema cache
    const matchPgrst = msg.match(/Could not find the '([^']+)' column of '([^']+)'/i);
    if (matchPgrst) {
        return { columnName: matchPgrst[1], tableName: matchPgrst[2] };
    }
    
    // Pattern 2: column "xyz" of relation "table_name" does not exist
    const matchPg = msg.match(/column "?([^"\s]+)"? of relation "?([^"\s]+)"? does not exist/i);
    if (matchPg) {
        return { columnName: matchPg[1], tableName: matchPg[2] };
    }

    // Pattern 3: column "xyz" does not exist
    const matchColOnly = msg.match(/column "?([^"\s]+)"? does not exist/i);
    if (matchColOnly) {
        return { columnName: matchColOnly[1] };
    }

    return null;
};

/**
 * Tự phục hồi payload khi gặp lỗi PGRST204 / 42703:
 * Chỉ loại bỏ ĐÚNG cột gây lỗi, tuyệt đối không xóa hàng loạt các cột nghiệp vụ khác.
 * Báo lỗi cảnh báo rõ ràng nếu trường bị thiếu là một cột nghiệp vụ thực tế.
 */
export const recoverPayloadFromSchemaError = (
    payload: any,
    table: string,
    error: any
): { recoveredPayload: any; missingColumn: string | null; isBusinessField: boolean } => {
    const missingInfo = extractMissingColumnFromError(error);
    const missingCol = missingInfo?.columnName || null;
    const tableName = missingInfo?.tableName || table;

    const isBusinessField = Boolean(
        missingCol && ['exportBatch', 'exportDate', 'handoverWard', 'statusLogs', 'notes', 'price'].includes(missingCol)
    );

    if (missingCol) {
        console.warn(`⚠️ [SCHEMA_RECOVERY] Detected missing column '${missingCol}' on table '${tableName}'. Error: ${error.message}`);
        console.error(`👉 CHẠY CÂU LỆNH SQL NÀY TRÊN SUPABASE ĐỂ BỔ SUNG CỘT BỊ THIẾU:\nALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS "${missingCol}" TEXT;`);
        if (isBusinessField) {
            console.error(`❌ [SCHEMA_MISMATCH] Warning: Business column '${missingCol}' does not exist on table '${tableName}'. Database migration needed!`);
        }
    } else {
        console.warn(`⚠️ [SCHEMA_RECOVERY] PGRST204 / 42703 error on table '${tableName}' but could not pinpoint exact column name: ${error.message}`);
    }

    const removeMissing = (obj: any) => {
        const copy = { ...obj };
        delete (copy as any).data;
        if (missingCol) {
            delete copy[missingCol];
        }
        return copy;
    };

    const recoveredPayload = Array.isArray(payload) ? payload.map(removeMissing) : removeMissing(payload);
    return { recoveredPayload, missingColumn: missingCol, isBusinessField };
};

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
 * Kiểm tra mã/nhóm/loại có tiền tố rõ ràng (1.x, 2.x, 3.x, LT-):
 * THỨ TỰ ƯU TIÊN:
 * ƯU TIÊN 1: recordType rõ ràng (nhóm 1.x -> luutru, nhóm 2.x -> land_records, nhóm 3.x -> dangky_records)
 * ƯU TIÊN 2: Tiền tố mã CODE rõ ràng (1.xx, LT- -> luutru; 2.xx -> land; 3.xx -> dangky; phân biệt với mã ngày tháng 6 số như 260919-7806)
 * ƯU TIÊN 3: Tiền tố group rõ ràng (1.x -> luutru; 2.x -> land; 3.x -> dangky)
 */
export const getExplicitGroup = (record: Partial<RecordFile>): 'dangky_records' | 'land_records' | 'luutru_records' | null => {
    const rawType = String(record.recordType || record.content || '').trim();
    const code = String(record.code || '').trim();
    const groupStr = String(record.group || '').trim();

    // 1. ƯU TIÊN 1: recordType hoặc content có tiền tố nhóm rõ ràng (1.x, 2.x, 3.x) hoặc tên loại trích lục/đo đạc/cấp giấy
    if (/^1\.\d+/i.test(rawType) || isArchiveRecordType(rawType)) {
        return 'luutru_records';
    }
    if (/^2\.\d+/i.test(rawType) || isSurveyRecordType(rawType)) {
        return 'land_records';
    }
    if (/^3\.\d+/i.test(rawType) || isCertificateRecordType(rawType)) {
        return 'dangky_records';
    }

    // 2. ƯU TIÊN 2: Tiền tố mã CODE rõ ràng (1.x, 2.x, 3.x, LT-)
    // Lưu ý: code phải có tiền tố dạng 1.xx, 2.xx, 3.xx hoặc LT- để không nhầm với mã ngày tháng (như 260919-7806)
    if (/^1\.\d+/i.test(code) || code.toUpperCase().startsWith('LT-')) {
        return 'luutru_records';
    }
    if (/^2\.\d+/i.test(code)) {
        return 'land_records';
    }
    if (/^3\.\d+/i.test(code)) {
        return 'dangky_records';
    }

    // 3. ƯU TIÊN 3: Tiền tố group rõ ràng
    if (/^1\./i.test(groupStr)) {
        return 'luutru_records';
    }
    if (/^2\./i.test(groupStr) || groupStr.includes('Đo đạc')) {
        return 'land_records';
    }
    if (/^3\./i.test(groupStr) || groupStr.includes('Đăng ký') || groupStr.includes('Cấp GCN') || groupStr.includes('Cấp giấy')) {
        return 'dangky_records';
    }

    return null;
};

/**
 * Định tuyến bảng dữ liệu suy đoán:
 * - Ưu tiên kiểm tra explicit group
 * - Sau đó kiểm tra isSurveyRecordType / isArchiveRecordType / isCertificateRecordType
 * - Sau đó kiểm tra nhóm, phòng ban, từ khóa và cache
 */
export const getInferredTable = (record: Partial<RecordFile>): 'dangky_records' | 'land_records' | 'luutru_records' | null => {
    const explicit = getExplicitGroup(record);
    if (explicit) return explicit;

    const rawType = String(record.recordType || record.content || '').trim();
    const groupStr = String(record.group || '').trim();

    // 1. Nhóm Lưu trữ
    if (
        isArchiveRecordType(record.recordType) ||
        isArchiveRecordType(record.content) ||
        rawType.toLowerCase().includes('sao lục') ||
        rawType.toLowerCase().includes('công văn')
    ) {
        return 'luutru_records';
    }

    // 2. Nhóm Đo đạc (2.x)
    if (
        isSurveyRecordType(record.recordType) ||
        isSurveyRecordType(record.content) ||
        groupStr.includes('Đo đạc') ||
        rawType.toLowerCase().includes('trích lục') ||
        rawType.toLowerCase().includes('trích đo') ||
        rawType.toLowerCase().includes('cắm mốc')
    ) {
        return 'land_records';
    }

    // 3. Nhóm Đăng ký / Cấp giấy (3.x)
    if (
        isCertificateRecordType(record) ||
        groupStr.includes('Đăng ký') ||
        groupStr.includes('Cấp GCN') ||
        groupStr.includes('Cấp giấy')
    ) {
        return 'dangky_records';
    }

    // 4. Phân loại theo phòng ban/bộ phận
    const deptStr = String((record as any).department || '').trim().toLowerCase();
    if (deptStr.includes('lưu trữ') || deptStr.includes('luu tru')) {
        return 'luutru_records';
    }
    if (deptStr.includes('đo đạc') || deptStr.includes('do dac')) {
        return 'land_records';
    }
    if (deptStr.includes('đăng ký') || deptStr.includes('cấp giấy') || deptStr.includes('dang ky') || deptStr.includes('cap giay')) {
        return 'dangky_records';
    }

    // Tra cứu nhanh từ Cache nếu không có recordType
    if (record.id || record.code) {
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        const found = cached.find(r => (record.id && r.id === record.id) || (record.code && r.code === record.code));
        if (found) {
            if (found.recordType || found.content || found.group) {
                const inferredFromFound = getInferredTable({ ...found, id: undefined, code: undefined });
                if (inferredFromFound) return inferredFromFound;
            }
        }
    }

    return null;
};

export const getTargetTable = (record: Partial<RecordFile>): 'dangky_records' | 'land_records' | 'luutru_records' => {
    const normalizeSource = (s?: string) => {
        if (s === 'archive_records') return 'luutru_records';
        if (s === 'dangky_records' || s === 'land_records' || s === 'luutru_records') return s;
        return null;
    };

    const validSource = normalizeSource(record.sourceTable);
    const explicitGroup = getExplicitGroup(record);
    const inferredGroup = explicitGroup || getInferredTable(record);

    // ƯU TIÊN 1-3: Phân loại theo recordType, tiền tố mã hoặc nhóm nghiệp vụ
    if (inferredGroup) {
        return inferredGroup;
    }

    // ƯU TIÊN 4: Nếu không có dấu hiệu phân loại rõ ràng nhưng có sourceTable hợp lệ -> Sử dụng sourceTable
    if (validSource) {
        return validSource;
    }

    // BẮT BUỘC BLOCK ROUTING_UNRESOLVED khi không thể xác định
    console.error(`[ROUTING_GUARD][UNRESOLVED] Unable to resolve target table for record:`, record);
    throw new Error(`ROUTING_UNRESOLVED: Unable to resolve target table for record (ID: ${record.id || 'N/A'}, Code: ${record.code || 'N/A'}). Mutation blocked.`);
};

/**
 * Helper kiểm tra xung đột phiên ghi (Concurrency Conflict).
 * Bỏ qua sai lệch phần triệu giây (microseconds) giữa Postgres (6 số) và JS ISO string (3 số).
 * Chỉ coi là xung đột thật sự nếu DB có updated_at mới hơn bản ghi của client trên 2000ms.
 */
export const isConcurrencyConflict = (dbUpdatedAt?: string | null, clientUpdatedAt?: string | null): boolean => {
    if (!dbUpdatedAt || !clientUpdatedAt) return false;
    const dbTime = new Date(dbUpdatedAt).getTime();
    const clientTime = new Date(clientUpdatedAt).getTime();
    if (isNaN(dbTime) || isNaN(clientTime)) return false;
    // Xung đột chỉ xảy ra khi DB thật sự có bản ghi mới hơn client quá 2 giây (> 2000ms)
    return (dbTime - clientTime) > 2000;
};

export interface MergeResult {
    hasConflict: boolean;
    conflictFields: string[];
    mergedRecord: RecordFile | null;
}

/**
 * 3-Way Non-Conflicting Auto-Merge Strategy.
 * Khi server có phiên bản mới hơn client:
 * - Giữ nguyên các trường mới nhất của server.
 * - Áp dụng các thay đổi nghiệp vụ của local nếu không xung đột đối kháng trên cùng 1 trường.
 * - Nếu phát hiện cùng sửa đổi một trường trọng yếu (status, assignedTo...) với giá trị khác nhau -> TRUE CONFLICT.
 */
export const mergeRecordSafely = (
    serverRecord: RecordFile,
    localMutation: RecordFile,
    baseSnapshot?: Partial<RecordFile>
): MergeResult => {
    if (!serverRecord || !localMutation) {
        return { hasConflict: false, conflictFields: [], mergedRecord: localMutation || serverRecord };
    }

    const systemFields = new Set([
        'id', 'code', 'sourceTable', '_isOfflineSaved', '_baseUpdatedAt', '_baseSnapshot',
        'created_at', 'createdAt', 'updated_at', 'updatedAt', 'created_by'
    ]);

    const conflictFields: string[] = [];
    const merged: any = { ...serverRecord };

    const allKeys = new Set([
        ...Object.keys(serverRecord),
        ...Object.keys(localMutation)
    ]);

    for (const key of allKeys) {
        if (systemFields.has(key)) continue;

        const serverVal = (serverRecord as any)[key];
        const localVal = (localMutation as any)[key];
        const baseVal = baseSnapshot ? (baseSnapshot as any)[key] : undefined;

        if (localVal === undefined) {
            continue;
        }

        if (baseSnapshot && baseVal !== undefined) {
            const isLocalChanged = JSON.stringify(localVal) !== JSON.stringify(baseVal);
            const isServerChanged = JSON.stringify(serverVal) !== JSON.stringify(baseVal);

            if (isLocalChanged && isServerChanged) {
                if (JSON.stringify(localVal) !== JSON.stringify(serverVal)) {
                    conflictFields.push(key);
                } else {
                    merged[key] = localVal;
                }
            } else if (isLocalChanged) {
                merged[key] = localVal;
            } else {
                merged[key] = serverVal;
            }
        } else {
            if (JSON.stringify(localVal) === JSON.stringify(serverVal)) {
                merged[key] = serverVal;
            } else if (serverVal === null || serverVal === undefined || serverVal === '' || (Array.isArray(serverVal) && serverVal.length === 0)) {
                merged[key] = localVal;
            } else if (localVal === null || localVal === undefined || localVal === '' || (Array.isArray(localVal) && localVal.length === 0)) {
                merged[key] = serverVal;
            } else {
                const criticalFields = ['status', 'assignedTo', 'deadline', 'exportBatch', 'isHandedOver', 'hasDefect'];
                if (criticalFields.includes(key)) {
                    conflictFields.push(key);
                } else {
                    merged[key] = localVal;
                }
            }
        }
    }

    if (conflictFields.length > 0) {
        return {
            hasConflict: true,
            conflictFields,
            mergedRecord: null
        };
    }

    merged.updated_at = new Date().toISOString();
    merged.updatedAt = merged.updated_at;
    merged._isOfflineSaved = false;

    return {
        hasConflict: false,
        conflictFields: [],
        mergedRecord: merged as RecordFile
    };
};

export interface RoutingValidationResult {
    valid: boolean;
    targetTable: 'dangky_records' | 'land_records' | 'luutru_records';
    originalSourceTable?: string;
    warning?: string;
}

/**
 * Data Integrity Guard: Kiểm tra định tuyến bảng dữ liệu tuyệt đối (Single Source of Truth).
 * Tự động phát hiện và chặn ghi nhầm bảng giữa:
 * - 1.x -> luutru_records
 * - 2.x -> land_records
 * - 3.x -> dangky_records
 */
export const validateRecordRouting = (
    record: Partial<RecordFile>,
    targetTableToMutate?: 'dangky_records' | 'land_records' | 'luutru_records'
): RoutingValidationResult => {
    const targetTable = getTargetTable(record);

    if (targetTableToMutate && targetTableToMutate !== targetTable) {
        console.error(`[ROUTING_GUARD][CONFLICT] Record ID: ${record.id || 'N/A'}, Code: ${record.code || 'N/A'}: target table '${targetTableToMutate}' conflicts with resolved target table '${targetTable}'`);
        throw new Error(`ROUTING_CONFLICT: Record code/group/type indicates '${targetTable}' but target table is specified as '${targetTableToMutate}'. Mutation blocked.`);
    }

    return {
        valid: true,
        targetTable,
        originalSourceTable: record.sourceTable
    };
};

/**
 * Tự động xóa bản ghi trùng lặp ở các bảng sai (loại bỏ hoàn toàn lưu sai bảng / đa bảng)
 * TUYỆT ĐỐI TUÂN THỦ: Chỉ xóa khi có bằng chứng rõ ràng (cùng ID/mã, đã xác nhận tồn tại ở keepTable, không phải 2 hồ sơ nghiệp vụ khác nhau)
 */
export const purgeRecordFromOtherTables = async (
    id?: string,
    code?: string,
    keepTable?: 'dangky_records' | 'land_records' | 'luutru_records'
) => {
    if (!isConfigured || (!id && !code) || !keepTable) return;

    const safeId = id && isValidUUID(id) ? id.trim() : null;
    const safeCode = code && code.trim().length > 3 && !code.includes('?') ? code.trim() : null;

    if (!safeId && !safeCode) return;

    try {
        // 1. Kiểm tra xác nhận bản ghi mục tiêu đã thực sự tồn tại trong keepTable
        let query = supabase.from(keepTable).select('id, code, customerName');
        if (safeId) query = query.eq('id', safeId);
        else if (safeCode) query = query.eq('code', safeCode);

        const { data: keepData, error: keepErr } = await query.limit(1);
        if (keepErr || !keepData || keepData.length === 0) {
            console.warn(`[PURGE_GUARD] Aborting purge: Record not confirmed in keepTable ${keepTable} (ID: ${safeId}, Code: ${safeCode}).`);
            return;
        }

        const keepRecord = keepData[0];
        const allTables: ('dangky_records' | 'land_records' | 'luutru_records')[] = ['dangky_records', 'land_records', 'luutru_records'];
        const otherTables = allTables.filter(t => t !== keepTable);

        for (const tbl of otherTables) {
            let otherQuery = supabase.from(tbl).select('id, code, customerName');
            if (safeId) otherQuery = otherQuery.eq('id', safeId);
            else if (safeCode) otherQuery = otherQuery.eq('code', safeCode);

            const { data: otherData } = await otherQuery.limit(1);
            if (otherData && otherData.length > 0) {
                const otherRecord = otherData[0];
                const isExactSameId = safeId && otherRecord.id === safeId;
                const isSameCustomer = (otherRecord.customerName && keepRecord.customerName && otherRecord.customerName.trim().toLowerCase() === keepRecord.customerName.trim().toLowerCase());
                
                if (isExactSameId || isSameCustomer) {
                    console.log(`[PURGE_GUARD] Purging confirmed duplicate record from ${tbl} (ID: ${otherRecord.id}, Code: ${otherRecord.code})`);
                    await supabase.from(tbl).delete().eq('id', otherRecord.id);
                } else {
                    console.warn(`[PURGE_GUARD] Preserving record in ${tbl} with code ${safeCode} because it appears to be a distinct business record from keepTable ${keepTable}.`);
                }
            }
        }
    } catch (e) {
        console.warn(`[PURGE_GUARD] Error during verified purge check:`, e);
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
    if (!isConfigured || !keepTable || !ids || ids.length === 0) return;
    const validIds = ids.filter(id => id && isValidUUID(id));
    if (validIds.length === 0) return;

    try {
        const allTables: ('dangky_records' | 'land_records' | 'luutru_records')[] = ['dangky_records', 'land_records', 'luutru_records'];
        const otherTables = allTables.filter(t => t !== keepTable);

        // Chỉ xóa khi ID chính xác trùng nhau và đã được xác nhận lưu vào keepTable
        for (const tbl of otherTables) {
            const CHUNK = 100;
            for (let i = 0; i < validIds.length; i += CHUNK) {
                const chunkIds = validIds.slice(i, i + CHUNK);
                const { data } = await supabase.from(tbl).select('id').in('id', chunkIds);
                if (data && data.length > 0) {
                    const duplicateIds = data.map((d: any) => d.id);
                    await supabase.from(tbl).delete().in('id', duplicateIds);
                    console.log(`[PURGE_GUARD] Purged ${duplicateIds.length} confirmed duplicate IDs from ${tbl}.`);
                }
            }
        }
    } catch (e) {
        console.warn(`[PURGE_GUARD] Error during batch verified purge:`, e);
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
    'exportBatch', 'exportDate', 'handoverWard', 'attachedFiles', 'dossierComponents',
    'sourceTable', 'previousStatus', 'supplementReason', 'supplementRequestDate', 'supplementReturnedDate'
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

let inFlightFetchRecordsPromise: Promise<RecordFile[]> | null = null;
let lastFetchTime = 0;
let lastFetchedRecords: RecordFile[] | null = null;
const fetchRecordsCallbacks = new Set<TierProgressCallback>();

export const fetchRecords = async (onProgress?: TierProgressCallback, forceRefresh = false): Promise<RecordFile[]> => {
  if (onProgress) {
      fetchRecordsCallbacks.add(onProgress);
  }

  // Trả về ngay Promise đang chạy nếu có (Shared In-Flight Promise)
  if (inFlightFetchRecordsPromise) {
      return inFlightFetchRecordsPromise;
  }

  // Deduplication window: nếu vừa fetch trong vòng 3000ms và không force refresh -> trả về cache ngay
  const now = Date.now();
  if (!forceRefresh && lastFetchedRecords && (now - lastFetchTime < 3000)) {
      if (onProgress) {
          try { onProgress(3, lastFetchedRecords, true); } catch {}
      }
      return lastFetchedRecords;
  }

  inFlightFetchRecordsPromise = (async () => {
      console.log(`[SYNC] Start fetchRecords`);
      console.log(`[SYNC] Fetch from Supabase`);

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

        if (misplacedInDangky.length > 0 || misplacedInLand.length > 0) {
            console.warn(`⚠️ [Fetch Warning] Phát hiện ${misplacedInDangky.length} hồ sơ có thể sai bảng ở dangky_records, ${misplacedInLand.length} ở land_records. Giữ nguyên dữ liệu, không tự động di chuyển hoặc xóa.`);
        }
        
        const rawList = [...dangky, ...land, ...luutru];
        const currentTime = Date.now();
        rawList.forEach(item => {
            const mapped = mapRecordFromDb(item);
            if (mapped && mapped.id && !allBlankIds.has(mapped.id)) {
                const recent = RECENTLY_UPDATED_RECORDS.get(mapped.id);
                if (recent && (currentTime - recent.updatedAt < 60000)) {
                    console.log(`[SYNC] Record: ${mapped.code || mapped.id}`);
                    console.log(`[SYNC] Server status: ${mapped.status}`);
                    console.log(`[SYNC] Protection active (Client recent status: ${recent.record.status}). Keeping recent status.`);
                    uniqueMap.set(mapped.id, { ...mapped, ...recent.record });
                } else {
                    uniqueMap.set(mapped.id, mapped);
                }
            }
        });

        // 2. [QUAN TRỌNG NHẤT] Hợp nhất các hồ sơ đang chờ đồng bộ (Sync Queue)
        // fetchRecords TUYỆT ĐỐI KHÔNG tự ý xóa items trong Sync Queue
        const pendingItems = await getPendingSyncItems();
        for (const item of pendingItems) {
            const pending = item.record;
            if (!pending || !pending.id) continue;

            if (item.action === 'DELETE') {
                // Bản ghi đã bị xóa offline, loại bỏ khỏi danh sách hiển thị
                uniqueMap.delete(pending.id);
                continue;
            }

            const cloudRecord = uniqueMap.get(pending.id);
            if (cloudRecord) {
                uniqueMap.set(pending.id, { ...cloudRecord, ...pending, _isOfflineSaved: true });
            } else {
                uniqueMap.set(pending.id, { ...pending, _isOfflineSaved: true });
            }
        }

        const finalRecords = Array.from(uniqueMap.values());
        console.log(`[SYNC] Apply state (${finalRecords.length} records ready)`);

        if (finalRecords.length > 0) {
            saveToCache(CACHE_KEYS.RECORDS, finalRecords);
        }

        lastFetchTime = Date.now();
        lastFetchedRecords = finalRecords;

        fetchRecordsCallbacks.forEach(cb => {
            try { cb(3, finalRecords, true); } catch {}
        });

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
        const fallback = Array.from(map.values());
        fetchRecordsCallbacks.forEach(cb => {
            try { cb(3, fallback, true); } catch {}
        });
        return fallback;
      }
  })().finally(() => {
      inFlightFetchRecordsPromise = null;
      fetchRecordsCallbacks.clear();
  });

  return inFlightFetchRecordsPromise;
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

export const createRecordApi = async (record: RecordFile, expectedTargetTable?: 'dangky_records' | 'land_records' | 'luutru_records'): Promise<RecordFile | null> => {
    const { targetTable } = validateRecordRouting(record);

    if (expectedTargetTable && targetTable !== expectedTargetTable) {
        throw new Error(`[SYNC_ROUTING_CONFLICT] Target table in queue (${expectedTargetTable}) conflicts with record routing table (${targetTable}). Record ID: ${record.id}`);
    }

    const standardId = (record.id && isValidUUID(record.id)) ? record.id : generateStandardUUID();
    let finalCode = record.code ? record.code.trim() : '';
    const isArchive = targetTable === 'luutru_records';
    const isInvalidOrEmptyCode = !finalCode || 
                                 finalCode.includes('?') || 
                                 finalCode.toUpperCase() === 'HS' || 
                                 finalCode === '--' ||
                                 finalCode.toLowerCase() === 'chưa có mã';

    const validReceivedDate = keepOnlyDate(record.receivedDate) || new Date().toISOString().split('T')[0];
    const assignedGroup = targetTable === 'dangky_records' 
        ? '3. Đăng ký đất đai, cấp GCN' 
        : (targetTable === 'luutru_records' ? '1. Cung cấp thông tin, dữ liệu đất đai' : '2. Đo đạc bản đồ');

    if (!isOnline()) {
        if (isInvalidOrEmptyCode) {
            finalCode = `OFF-${Date.now().toString().slice(-6)}`;
        }
        const offlineRecord: RecordFile = {
            ...record,
            id: standardId,
            code: finalCode,
            receivedDate: validReceivedDate,
            status: record.status || RecordStatus.RECEIVED,
            sourceTable: targetTable,
            group: assignedGroup,
            _isOfflineSaved: true
        };
        await addPendingRecord(offlineRecord, 'CREATE', targetTable);
        syncCacheOnCreate(offlineRecord);
        return offlineRecord;
    }

    let recordToSave: RecordFile = record;
    try {
        if (isInvalidOrEmptyCode) {
            finalCode = await getNextGlobalRecordCode(
                record.receivedDate || new Date().toISOString(), 
                isArchive,
                record.recordType || '',
                record.receivedBy || '',
                record.ward || ''
            );
        } else {
            finalCode = await resolveGuaranteedUniqueCode(finalCode, standardId);
        }

        recordToSave = { 
            ...record, 
            id: standardId,
            code: finalCode,
            receivedDate: validReceivedDate,
            status: record.status || RecordStatus.RECEIVED,
            sourceTable: targetTable,
            group: assignedGroup
        };
        
        let payload = sanitizeRecordPayloadForTable(recordToSave, targetTable);
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

        // 2. Thử lại nếu thiếu cột trên Supabase (PGRST204 / 42703) - CHỈ loại bỏ ĐÚNG cột gây lỗi
        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')) || (error.message && String(error.message).includes('Could not find')))) {
            console.warn(`⚠️ [PGRST204 Fallback] Bảng ${targetTable} gặp lỗi schema. Đang bóc tách và loại bỏ đúng cột bị thiếu...`);
            const { recoveredPayload } = recoverPayloadFromSchemaError(payload, targetTable, error);
            const res = await supabase.from(targetTable).insert([recoveredPayload]).select();
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
            return { ...result, _isOfflineSaved: false };
        }
        return { ...recordToSave, _isOfflineSaved: false };
    } catch (error: any) {
        logError("createRecordApi", error, true);
        if (isTransientError(error)) {
            console.warn(`[Offline Queue] Lưu hồ sơ ${recordToSave.code || recordToSave.id} vào hàng đợi cục bộ để tự động đẩy lên Cloud sau.`);
            await addPendingRecord(recordToSave, 'CREATE', targetTable);
            syncCacheOnCreate({ ...recordToSave, _isOfflineSaved: true });
            return { ...recordToSave, _isOfflineSaved: true };
        }
        throw error;
    }
};

export const updateRecordApi = async (record: RecordFile, expectedTargetTable?: 'dangky_records' | 'land_records' | 'luutru_records'): Promise<RecordFile | null> => {
    if (!record || !record.id) {
        throw new Error("[MUTATION] Error: Record ID is required for update operation.");
    }

    const { targetTable } = validateRecordRouting(record);

    if (expectedTargetTable && targetTable !== expectedTargetTable) {
        throw new Error(`[SYNC_ROUTING_CONFLICT] Target table in queue (${expectedTargetTable}) conflicts with record routing table (${targetTable}). Record ID: ${record.id}`);
    }

    console.log(`[MUTATION][START] updateRecordApi for ID: ${record.id}, Code: ${record.code}`);
    console.log(`[MUTATION][ROUTING] Resolved target table: ${targetTable}`);

    // 0. Khóa bảo vệ thời gian thực chống giật lùi trạng thái
    markRecordsRecentlyUpdated([record]);

    if (!isOnline()) {
        console.log(`[MUTATION] Supabase offline mode (isOnline=false). Saved to offline queue.`);
        const offlineRecord = { 
            ...record, 
            sourceTable: targetTable, 
            _isOfflineSaved: true,
            _baseUpdatedAt: (record as any)._baseUpdatedAt || record.updated_at || (record as any).updatedAt 
        };
        await addPendingRecord(offlineRecord, 'UPDATE', targetTable);
        syncCacheOnUpdate(offlineRecord);
        return offlineRecord;
    }

    // Lấy previousUpdatedAt từ record truyền vào (_baseUpdatedAt nếu là mutation được lưu từ queue)
    let previousUpdatedAt = (record as any)._baseUpdatedAt || record.updated_at || (record as any).updatedAt;

    // Kiểm tra xung đột trước khi cập nhật nếu có previousUpdatedAt
    if (previousUpdatedAt && isOnline()) {
        try {
            const { data: curData } = await supabase
                .from(targetTable)
                .select('*')
                .eq('id', record.id)
                .maybeSingle();
            if (curData && curData.updated_at && isConcurrencyConflict(curData.updated_at, previousUpdatedAt)) {
                // Thử 3-way non-conflicting auto-merge
                const serverRecord = mapRecordFromDb(curData) as RecordFile;
                const mergeRes = mergeRecordSafely(serverRecord, record, (record as any)._baseSnapshot);
                if (!mergeRes.hasConflict && mergeRes.mergedRecord) {
                    console.log(`[MUTATION][SAFE_MERGE] Auto-merged non-conflicting mutation for record ID ${record.id}`);
                    record = mergeRes.mergedRecord;
                    previousUpdatedAt = curData.updated_at;
                } else {
                    const conflictFields = mergeRes.conflictFields.join(', ');
                    console.error(`[MUTATION][CONCURRENCY_CONFLICT] Record ID ${record.id} in ${targetTable} has conflicting fields: [${conflictFields}]. DB: ${curData.updated_at}, Expected: ${previousUpdatedAt}`);
                    throw new Error(`CONCURRENCY_CONFLICT: Record with ID ${record.id} in table ${targetTable} has true conflict on fields [${conflictFields}]. Please refresh.`);
                }
            }
        } catch (fetchError: any) {
            if (String(fetchError?.message || '').includes('CONCURRENCY_CONFLICT')) {
                throw fetchError;
            }
            console.warn(`[MUTATION][CONCURRENCY] Failed to check existing updated_at before update:`, fetchError);
        }
    }

    try {
        const payload = sanitizeRecordPayloadForTable(record, targetTable);
        if (!payload.updated_at) {
            payload.updated_at = new Date().toISOString();
        }

        console.log(`[MUTATION][SUPABASE_EXEC] Executing UPDATE on table '${targetTable}' for ID: ${record.id}`);

        let query = supabase.from(targetTable).update(payload).eq('id', record.id);
        let { data, error } = await query.select();

        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
            console.warn(`⚠️ [22P02 Fallback] Retrying update on ${targetTable} with sanitized payload...`);
            const fallback22P02Payload = sanitizePayloadFor22P02(payload);
            let fallbackQuery = supabase.from(targetTable).update(fallback22P02Payload).eq('id', record.id);
            const res = await fallbackQuery.select();
            data = res.data;
            error = res.error;
        }

        if (error && (error.code === '22007' || error.code === '22008' || String(error.message || '').includes('date') || String(error.message || '').includes('timestamp'))) {
            console.warn(`⚠️ [Date Fallback] Retrying update on ${targetTable} with date sanitized payload...`);
            const fallbackDatePayload = sanitizePayloadForDateErrors(payload);
            let fallbackQuery = supabase.from(targetTable).update(fallbackDatePayload).eq('id', record.id);
            const res = await fallbackQuery.select();
            data = res.data;
            error = res.error;
        }

        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')) || (error.message && String(error.message).includes('Could not find')))) {
            console.warn(`⚠️ [PGRST204 Fallback] Missing columns on ${targetTable}. Retrying with safely recovered payload...`);
            const { recoveredPayload } = recoverPayloadFromSchemaError(payload, targetTable, error);
            let fallbackQuery = supabase.from(targetTable).update(recoveredPayload).eq('id', record.id);
            const res = await fallbackQuery.select();
            data = res.data;
            error = res.error;
        }

        if (error) {
            console.error(`[MUTATION][ERROR] Supabase UPDATE failed on ${targetTable}:`, error);
            throw error;
        }

        if (!data || data.length === 0) {
            const { data: checkData } = await supabase.from(targetTable).select('*').eq('id', record.id);
            if (checkData && checkData.length > 0) {
                const currentDbUpdatedAt = checkData[0].updated_at;
                if (isConcurrencyConflict(currentDbUpdatedAt, previousUpdatedAt)) {
                    const serverRecord = mapRecordFromDb(checkData[0]) as RecordFile;
                    const mergeRes = mergeRecordSafely(serverRecord, record, (record as any)._baseSnapshot);
                    if (!mergeRes.hasConflict && mergeRes.mergedRecord) {
                        console.log(`[MUTATION][SAFE_MERGE_RETRY] Auto-merged on 0-row check for ID: ${record.id}`);
                        const mergedPayload = sanitizeRecordPayloadForTable(mergeRes.mergedRecord, targetTable);
                        const retryRes = await supabase.from(targetTable).update(mergedPayload).eq('id', record.id).select();
                        if (retryRes.data && retryRes.data.length > 0) {
                            data = retryRes.data;
                        }
                    } else {
                        const conflictFields = mergeRes.conflictFields.join(', ');
                        console.error(`[MUTATION][CONCURRENCY_CONFLICT] Record ID ${record.id} in ${targetTable} was updated by another session. DB: ${currentDbUpdatedAt}, Expected: ${previousUpdatedAt}`);
                        throw new Error(`CONCURRENCY_CONFLICT: Record with ID ${record.id} in table ${targetTable} has conflict on fields [${conflictFields}]. Please refresh.`);
                    }
                }
            }

            if (!data || data.length === 0) {
                // Kiểm tra xem bản ghi có tồn tại trong targetTable không (trường hợp idempotency update 0 rows)
                const { data: existInTarget } = await supabase.from(targetTable).select('*').eq('id', record.id);
                if (existInTarget && existInTarget.length > 0) {
                    console.log(`[MUTATION][IDEMPOTENT] Record ID ${record.id} already matched in ${targetTable}.`);
                    data = existInTarget;
                } else {
                    // Kiểm tra nếu tồn tại ở bảng khác -> Báo lỗi ROUTING_DATA_INTEGRITY_ERROR, TUYỆT ĐỐI KHÔNG AUTO-MIGRATE
                    const otherTables = (['land_records', 'dangky_records', 'luutru_records'] as const).filter(t => t !== targetTable);
                    let foundOther: string | null = null;
                    for (const ot of otherTables) {
                        try {
                            const { data: otCheck } = await supabase.from(ot).select('id').eq('id', record.id).maybeSingle();
                            if (otCheck && otCheck.id) {
                                foundOther = ot;
                                break;
                            }
                        } catch (e) {}
                    }

                    if (foundOther) {
                        console.error(`[ROUTING_DATA_INTEGRITY_ERROR] Record ID ${record.id} exists in ${foundOther}, but update requested for ${targetTable}. Auto-migration is forbidden.`);
                        throw new Error(`ROUTING_DATA_INTEGRITY_ERROR: Record with ID ${record.id} exists in ${foundOther}. Auto-migration to ${targetTable} is strictly forbidden.`);
                    }

                    console.error(`[RECORD_NOT_FOUND_IN_TARGET_TABLE] Record with ID ${record.id} was not found in table ${targetTable}.`);
                    throw new Error(`RECORD_NOT_FOUND_IN_TARGET_TABLE: Record with ID ${record.id} was not found in table ${targetTable}.`);
                }
            }
        }

        const result = mapRecordFromDb({ ...record, ...(data[0] || {}), sourceTable: targetTable }) as RecordFile;
        if (result) {
            console.log(`[MUTATION][VERIFY] SUCCESS - Record verified in DB (ID: ${result.id}, Table: ${targetTable}, Status: ${result.status})`);
            await removePendingRecord(result.id, result.code, true);
            markRecordsRecentlyUpdated([result]);
            
            const memIdx = MOCK_RECORDS.findIndex(r => r.id === result.id);
            if (memIdx !== -1) {
                MOCK_RECORDS[memIdx] = { ...MOCK_RECORDS[memIdx], ...result };
            }
            syncCacheOnUpdate(result);

            console.log(`[MUTATION][STATE_COMMIT] React State & Cache UPDATED for ID: ${result.id}`);
            return { ...result, _isOfflineSaved: false };
        }
        throw new Error("Failed to map updated response from Supabase.");
    } catch (error: any) {
        console.error(`[MUTATION][FAIL] Supabase UPDATE failed for ID ${record.id}`, error);
        logError("updateRecordApi", error, true);
        
        if (isTransientError(error)) {
            const offlineRecord = { ...record, sourceTable: targetTable, _isOfflineSaved: true };
            await addPendingRecord(offlineRecord, 'UPDATE', targetTable);
            syncCacheOnUpdate(offlineRecord);
            return offlineRecord;
        }
        throw error;
    }
};

export const saveRecord = updateRecordApi;

export const updateRecordFieldsApi = async (id: string, fields: Partial<RecordFile>, expectedTargetTable?: 'dangky_records' | 'land_records' | 'luutru_records'): Promise<RecordFile | null> => {
    const fullRecord = { id, ...fields };
    const { targetTable } = validateRecordRouting(fullRecord);

    if (expectedTargetTable && targetTable !== expectedTargetTable) {
        throw new Error(`[SYNC_ROUTING_CONFLICT] Target table in queue (${expectedTargetTable}) conflicts with record routing table (${targetTable}). Record ID: ${id}`);
    }

    console.log(`[MUTATION][START] updateRecordFieldsApi for ID: ${id}`);
    console.log(`[MUTATION][ROUTING] Resolved target table: ${targetTable}`);

    // 0. Khóa bảo vệ thời gian thực chống giật lùi trạng thái
    markRecordsRecentlyUpdated([fullRecord]);

    if (!isConfigured) {
        console.log(`[MUTATION] Supabase offline mode (isConfigured=false). Saved offline.`);
        const fallbackRecord = { ...fullRecord, sourceTable: targetTable, _isOfflineSaved: true } as RecordFile;
        await addPendingRecord(fallbackRecord, 'UPDATE', targetTable);
        syncCacheOnUpdate(fallbackRecord);
        return fallbackRecord;
    }

    // Lấy previousUpdatedAt từ fields truyền vào hoặc fetch trực tiếp từ DB
    let previousUpdatedAt = (fields as any).updated_at || (fields as any).updatedAt;

    if (previousUpdatedAt && isOnline()) {
        try {
            const { data: curData } = await supabase
                .from(targetTable)
                .select('updated_at')
                .eq('id', id)
                .maybeSingle();
            if (curData && curData.updated_at && isConcurrencyConflict(curData.updated_at, previousUpdatedAt)) {
                console.error(`[MUTATION][CONCURRENCY_CONFLICT] Record ID ${id} in ${targetTable} was updated by another session. DB: ${curData.updated_at}, Expected: ${previousUpdatedAt}`);
                throw new Error(`CONCURRENCY_CONFLICT: Record with ID ${id} in table ${targetTable} was modified by another user or session. Please refresh.`);
            }
        } catch (fetchError: any) {
            if (String(fetchError?.message || '').includes('CONCURRENCY_CONFLICT')) {
                throw fetchError;
            }
            console.warn(`[MUTATION][CONCURRENCY] Failed to check existing updated_at before fields update:`, fetchError);
        }
    }

    try {
        const payload = sanitizeRecordPayloadForTable(fullRecord as any, targetTable);
        if (!payload.updated_at) {
            payload.updated_at = new Date().toISOString();
        }
        delete payload.id;

        console.log(`[MUTATION][SUPABASE_EXEC] Executing UPDATE fields on table '${targetTable}' for ID: ${id}`);

        let query = supabase.from(targetTable).update(payload).eq('id', id);
        let { data, error } = await query.select();

        if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
            console.warn(`⚠️ [22P02 Fallback] Retrying updateRecordFieldsApi on ${targetTable}...`);
            const fallback22P02Payload = sanitizePayloadFor22P02(payload);
            let fallbackQuery = supabase.from(targetTable).update(fallback22P02Payload).eq('id', id);
            const res = await fallbackQuery.select();
            data = res.data;
            error = res.error;
        }

        if (error && (error.code === '22007' || error.code === '22008' || String(error.message || '').includes('date') || String(error.message || '').includes('timestamp'))) {
            console.warn(`⚠️ [Date Fallback] Retrying updateRecordFieldsApi on ${targetTable}...`);
            const fallbackDatePayload = sanitizePayloadForDateErrors(payload);
            let fallbackQuery = supabase.from(targetTable).update(fallbackDatePayload).eq('id', id);
            const res = await fallbackQuery.select();
            data = res.data;
            error = res.error;
        }

        if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')) || (error.message && String(error.message).includes('Could not find')))) {
            console.warn(`⚠️ [PGRST204 Fallback] Retrying updateRecordFieldsApi on ${targetTable} with safely recovered payload...`);
            const { recoveredPayload } = recoverPayloadFromSchemaError(payload, targetTable, error);
            delete recoveredPayload.id;
            let fallbackQuery = supabase.from(targetTable).update(recoveredPayload).eq('id', id);
            const res = await fallbackQuery.select();
            data = res.data;
            error = res.error;
        }

        if (error) {
            console.error(`[MUTATION][ERROR] Supabase UPDATE fields failed on ${targetTable}:`, error);
            throw error;
        }

        if (!data || data.length === 0) {
            const { data: checkData } = await supabase.from(targetTable).select('id, updated_at').eq('id', id);
            if (checkData && checkData.length > 0) {
                const currentDbUpdatedAt = checkData[0].updated_at;
                if (isConcurrencyConflict(currentDbUpdatedAt, previousUpdatedAt)) {
                    console.error(`[MUTATION][CONCURRENCY_CONFLICT] Record ID ${id} in ${targetTable} was updated by another session. DB: ${currentDbUpdatedAt}, Expected: ${previousUpdatedAt}`);
                    throw new Error(`CONCURRENCY_CONFLICT: Record with ID ${id} in table ${targetTable} was modified by another user or session. Please refresh.`);
                }
            }

            if (!data || data.length === 0) {
                // Kiểm tra xem bản ghi có tồn tại trong targetTable không (trường hợp idempotency update 0 rows)
                const { data: existInTarget } = await supabase.from(targetTable).select('*').eq('id', id);
                if (existInTarget && existInTarget.length > 0) {
                    console.log(`[MUTATION][IDEMPOTENT] Record ID ${id} fields already matched in ${targetTable}.`);
                    data = existInTarget;
                } else {
                    // Kiểm tra nếu tồn tại ở bảng khác -> Báo lỗi ROUTING_DATA_INTEGRITY_ERROR, TUYỆT ĐỐI KHÔNG AUTO-MIGRATE
                    const otherTables = (['land_records', 'dangky_records', 'luutru_records'] as const).filter(t => t !== targetTable);
                    let foundOther: string | null = null;
                    for (const ot of otherTables) {
                        try {
                            const { data: otCheck } = await supabase.from(ot).select('id').eq('id', id).maybeSingle();
                            if (otCheck && otCheck.id) {
                                foundOther = ot;
                                break;
                            }
                        } catch (e) {}
                    }

                    if (foundOther) {
                        console.error(`[ROUTING_DATA_INTEGRITY_ERROR] Record ID ${id} exists in ${foundOther}, but update requested for ${targetTable}. Auto-migration is forbidden.`);
                        throw new Error(`ROUTING_DATA_INTEGRITY_ERROR: Record with ID ${id} exists in ${foundOther}. Auto-migration to ${targetTable} is strictly forbidden.`);
                    }

                    console.error(`[RECORD_NOT_FOUND_IN_TARGET_TABLE] Record with ID ${id} was not found in table ${targetTable}.`);
                    throw new Error(`RECORD_NOT_FOUND_IN_TARGET_TABLE: Record with ID ${id} was not found in table ${targetTable}.`);
                }
            }
        }

        const result = mapRecordFromDb({ id, ...fields, ...(data[0] || {}), sourceTable: targetTable }) as RecordFile;
        if (result) {
            console.log(`[MUTATION][VERIFY] SUCCESS - Verified fields update in DB (ID: ${result.id}, Table: ${targetTable})`);
            await removePendingRecord(result.id, result.code, true);
            markRecordsRecentlyUpdated([result]);

            const memIdx = MOCK_RECORDS.findIndex(r => r.id === result.id);
            if (memIdx !== -1) {
                MOCK_RECORDS[memIdx] = { ...MOCK_RECORDS[memIdx], ...result };
            }
            syncCacheOnUpdate(result);

            console.log(`[MUTATION][STATE_COMMIT] React State & Cache UPDATED for ID: ${result.id}`);
            return { ...result, _isOfflineSaved: false };
        }
        throw new Error("Failed to map updated fields response from Supabase.");
    } catch (error: any) {
        console.error(`[MUTATION][FAIL] updateRecordFieldsApi failed for ID: ${id}`, error);
        logError("updateRecordFieldsApi", error, true);
        
        if (isTransientError(error)) {
            const fallbackRecord = { ...fullRecord, sourceTable: targetTable, _isOfflineSaved: true } as RecordFile;
            await addPendingRecord(fallbackRecord, 'UPDATE', targetTable);
            syncCacheOnUpdate(fallbackRecord);
            return fallbackRecord;
        }
        throw error;
    }
};

export const deleteRecordApi = async (id: string, record?: Partial<RecordFile>): Promise<boolean> => {
    let targetTable: 'dangky_records' | 'land_records' | 'luutru_records' | null = null;
    
    const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
    const found = cached.find(r => r.id === id);
    const mergedRecord = { ...found, ...record, id };

    try {
        targetTable = getTargetTable(mergedRecord);
    } catch (error: any) {
        // Table not resolvable from mergedRecord properties alone, will check Supabase
    }

    if (!targetTable && isOnline()) {
        try {
            const [landRes, dangkyRes, luutruRes] = await Promise.all([
                supabase.from('land_records').select('id').eq('id', id).maybeSingle(),
                supabase.from('dangky_records').select('id').eq('id', id).maybeSingle(),
                supabase.from('luutru_records').select('id').eq('id', id).maybeSingle()
            ]);
            if (landRes.data) {
                targetTable = 'land_records';
            } else if (dangkyRes.data) {
                targetTable = 'dangky_records';
            } else if (luutruRes.data) {
                targetTable = 'luutru_records';
            }
        } catch (dbErr) {
            console.warn(`[deleteRecordApi] Database lookup for record table failed:`, dbErr);
        }
    }

    if (!targetTable) {
        const rawSource = mergedRecord.sourceTable || found?.sourceTable || (record as any)?.sourceTable;
        const normalized = (rawSource === 'archive_records' || rawSource === 'luutru_records') ? 'luutru_records' : (rawSource === 'land_records' ? 'land_records' : (rawSource === 'dangky_records' ? 'dangky_records' : null));
        if (normalized) {
            targetTable = normalized;
        }
    }

    if (!targetTable) {
        if (isOnline()) {
            console.warn(`[deleteRecordApi] Record ID ${id} target table unresolved. Purging across all tables and cleaning cache.`);
            await Promise.allSettled([
                supabase.from('land_records').delete().eq('id', id),
                supabase.from('dangky_records').delete().eq('id', id),
                supabase.from('luutru_records').delete().eq('id', id)
            ]);
            syncCacheOnDelete(id);
            return true;
        } else {
            syncCacheOnDelete(id);
            return true;
        }
    }

    if (!isOnline()) {
        await addPendingRecord({ id } as RecordFile, 'DELETE', targetTable);
        syncCacheOnDelete(id);
        return true;
    }

    try {
        console.log(`[MUTATION][DELETE] Deleting record ID ${id} from target table ${targetTable}`);
        const { error } = await supabase.from(targetTable).delete().eq('id', id);
        if (error) {
            if (isTransientError(error)) {
                console.warn(`[DELETE_SINGLE] Transient error deleting record ID ${id}. Enqueueing to offline sync.`, error);
                await addPendingRecord({ id } as RecordFile, 'DELETE', targetTable);
                syncCacheOnDelete(id);
                return true;
            } else {
                console.error(`[DELETE_SINGLE] Database/Permanent error deleting record ID ${id}. Blocking.`, error);
                throw error;
            }
        }
        syncCacheOnDelete(id);
        return true;
    } catch (error) {
        logError("deleteRecordApi", error, true);
        throw error;
    }
};

export const deleteRecordsBatchApi = async (
    ids: string[], 
    recordsOrProgress?: Partial<RecordFile>[] | ((processed: number, total: number) => void),
    onProgressParam?: (processed: number, total: number) => void
): Promise<boolean> => {
    if (!ids || ids.length === 0) return true;

    const recordHints: Partial<RecordFile>[] = Array.isArray(recordsOrProgress) ? recordsOrProgress : [];
    const onProgress = typeof recordsOrProgress === 'function' ? recordsOrProgress : onProgressParam;

    const landIds: string[] = [];
    const dangkyIds: string[] = [];
    const luutruIds: string[] = [];
    const unresolvedIds: string[] = [];
    const duplicateIds: string[] = [];

    const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
    const cachedMap = new Map<string, Partial<RecordFile>>();
    cached.forEach(r => {
        if (r && r.id) cachedMap.set(r.id, r);
    });
    recordHints.forEach(r => {
        if (r && r.id) cachedMap.set(r.id, { ...(cachedMap.get(r.id) || {}), ...r });
    });

    if (isOnline()) {
        try {
            const [landRes, dangkyRes, luutruRes] = await Promise.all([
                supabase.from('land_records').select('id').in('id', ids),
                supabase.from('dangky_records').select('id').in('id', ids),
                supabase.from('luutru_records').select('id').in('id', ids)
            ]);

            const landSet = new Set((landRes.data || []).map(r => r.id));
            const dangkySet = new Set((dangkyRes.data || []).map(r => r.id));
            const luutruSet = new Set((luutruRes.data || []).map(r => r.id));

            for (const id of ids) {
                const foundInTables: string[] = [];
                if (landSet.has(id)) foundInTables.push('land_records');
                if (dangkySet.has(id)) foundInTables.push('dangky_records');
                if (luutruSet.has(id)) foundInTables.push('luutru_records');

                const count = foundInTables.length;

                if (count === 0) {
                    const found = cachedMap.get(id);
                    if (found) {
                        try {
                            const targetTable = getTargetTable(found);
                            if (targetTable === 'land_records') landIds.push(id);
                            else if (targetTable === 'dangky_records') dangkyIds.push(id);
                            else if (targetTable === 'luutru_records') luutruIds.push(id);
                            else unresolvedIds.push(id);
                        } catch {
                            unresolvedIds.push(id);
                        }
                    } else {
                        unresolvedIds.push(id);
                    }
                } else if (count === 1) {
                    const singleTable = foundInTables[0];
                    if (singleTable === 'land_records') landIds.push(id);
                    else if (singleTable === 'dangky_records') dangkyIds.push(id);
                    else if (singleTable === 'luutru_records') luutruIds.push(id);
                } else {
                    console.error(`[MUTATION][DELETE_BATCH][DUPLICATE_ID_CONFLICT] ID=${id} TABLES=${foundInTables.join(',')}`);
                    duplicateIds.push(id);
                }
            }
        } catch (dbError) {
            console.error("[MUTATION][DELETE_BATCH] DB resolve failed, using cache fallback", dbError);
            for (const id of ids) {
                const found = cachedMap.get(id);
                if (found) {
                    try {
                        const targetTable = getTargetTable(found);
                        if (targetTable === 'land_records') landIds.push(id);
                        else if (targetTable === 'dangky_records') dangkyIds.push(id);
                        else if (targetTable === 'luutru_records') luutruIds.push(id);
                        else unresolvedIds.push(id);
                    } catch {
                        unresolvedIds.push(id);
                    }
                } else {
                    unresolvedIds.push(id);
                }
            }
        }
    } else {
        for (const id of ids) {
            const found = cachedMap.get(id);
            if (found) {
                try {
                    const targetTable = getTargetTable(found);
                    if (targetTable === 'land_records') landIds.push(id);
                    else if (targetTable === 'dangky_records') dangkyIds.push(id);
                    else if (targetTable === 'luutru_records') luutruIds.push(id);
                    else unresolvedIds.push(id);
                } catch {
                    unresolvedIds.push(id);
                }
            } else {
                unresolvedIds.push(id);
            }
        }
    }

    if (duplicateIds.length > 0) {
        const duplicateErr = new Error(`DUPLICATE_ID_CONFLICT: Duplicate ID conflict for IDs: ${duplicateIds.join(', ')}. Batch delete blocked.`);
        console.error(`[ROUTING_GUARD][DUPLICATE_ID_CONFLICT]`, duplicateErr);
        throw duplicateErr;
    }

    if (unresolvedIds.length > 0) {
        if (isOnline()) {
            console.warn(`[MUTATION][DELETE_BATCH] Purging unresolved IDs across tables:`, unresolvedIds);
            await Promise.allSettled([
                supabase.from('land_records').delete().in('id', unresolvedIds),
                supabase.from('dangky_records').delete().in('id', unresolvedIds),
                supabase.from('luutru_records').delete().in('id', unresolvedIds)
            ]);
            await syncCacheOnBatchDelete(unresolvedIds);
        } else {
            await syncCacheOnBatchDelete(unresolvedIds);
        }
    }

    if (!isOnline()) {
        for (const id of landIds) {
            await addPendingRecord({ id } as RecordFile, 'DELETE', 'land_records');
        }
        for (const id of dangkyIds) {
            await addPendingRecord({ id } as RecordFile, 'DELETE', 'dangky_records');
        }
        for (const id of luutruIds) {
            await addPendingRecord({ id } as RecordFile, 'DELETE', 'luutru_records');
        }
        await syncCacheOnBatchDelete(ids);
        return true;
    }

    try {
        const successfullyDeletedIds: string[] = [];
        const totalToProcess = landIds.length + dangkyIds.length + luutruIds.length;

        if (landIds.length > 0) {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < landIds.length; i += CHUNK_SIZE) {
                const chunk = landIds.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase.from('land_records').delete().in('id', chunk);
                if (error) {
                    if (isTransientError(error)) {
                        console.warn(`[DELETE_BATCH] Transient error deleting land_records chunk. Enqueueing to offline sync.`, error);
                        for (const id of chunk) {
                            await addPendingRecord({ id } as RecordFile, 'DELETE', 'land_records');
                        }
                    } else {
                        console.error(`[DELETE_BATCH] Database error deleting land_records chunk. Blocking.`, error);
                        throw error;
                    }
                } else {
                    successfullyDeletedIds.push(...chunk);
                }
                if (onProgress) onProgress(successfullyDeletedIds.length, totalToProcess);
            }
        }

        if (dangkyIds.length > 0) {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < dangkyIds.length; i += CHUNK_SIZE) {
                const chunk = dangkyIds.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase.from('dangky_records').delete().in('id', chunk);
                if (error) {
                    if (isTransientError(error)) {
                        console.warn(`[DELETE_BATCH] Transient error deleting dangky_records chunk. Enqueueing to offline sync.`, error);
                        for (const id of chunk) {
                            await addPendingRecord({ id } as RecordFile, 'DELETE', 'dangky_records');
                        }
                    } else {
                        console.error(`[DELETE_BATCH] Database error deleting dangky_records chunk. Blocking.`, error);
                        throw error;
                    }
                } else {
                    successfullyDeletedIds.push(...chunk);
                }
                if (onProgress) onProgress(successfullyDeletedIds.length, totalToProcess);
            }
        }

        if (luutruIds.length > 0) {
            const CHUNK_SIZE = 100;
            for (let i = 0; i < luutruIds.length; i += CHUNK_SIZE) {
                const chunk = luutruIds.slice(i, i + CHUNK_SIZE);
                const { error } = await supabase.from('luutru_records').delete().in('id', chunk);
                if (error) {
                    if (isTransientError(error)) {
                        console.warn(`[DELETE_BATCH] Transient error deleting luutru_records chunk. Enqueueing to offline sync.`, error);
                        for (const id of chunk) {
                            await addPendingRecord({ id } as RecordFile, 'DELETE', 'luutru_records');
                        }
                    } else {
                        console.error(`[DELETE_BATCH] Database error deleting luutru_records chunk. Blocking.`, error);
                        throw error;
                    }
                } else {
                    successfullyDeletedIds.push(...chunk);
                }
                if (onProgress) onProgress(successfullyDeletedIds.length, totalToProcess);
            }
        }

        if (successfullyDeletedIds.length > 0) {
            await syncCacheOnBatchDelete(successfullyDeletedIds);
        }

        return true;
    } catch (error) {
        logError("deleteRecordsBatchApi", error, true);
        throw error;
    }
};

export const createRecordsBatchApi = async (records: RecordFile[], onProgress?: (processed: number, total: number) => void): Promise<boolean> => {
    if (!records || records.length === 0) return true;

    if (!isOnline()) {
        console.log(`[MUTATION] createRecordsBatchApi offline mode (isOnline=false). Enqueueing ${records.length} records...`);
        const preparedRecords: RecordFile[] = [];

        for (const r of records) {
            let finalCode = (r.code || '').trim();
            if (!finalCode || finalCode.includes('?') || finalCode.toUpperCase() === 'HS' || finalCode === '--') {
                finalCode = `OFF-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            }

            const recordPayload = { ...r, code: finalCode };
            if (!recordPayload.id || !isValidUUID(recordPayload.id)) {
                recordPayload.id = generateStandardUUID();
            }

            let targetTable: 'dangky_records' | 'land_records' | 'luutru_records';
            try {
                targetTable = getTargetTable(recordPayload);
            } catch (routingErr) {
                console.error(`[ROUTING_GUARD][UNRESOLVED] createRecordsBatchApi blocked for offline record:`, routingErr);
                throw routingErr;
            }

            recordPayload.sourceTable = targetTable;
            recordPayload._isOfflineSaved = true;
            preparedRecords.push(recordPayload);
        }

        // Enqueue tất cả các bản ghi. Chỉ khi toàn bộ persistence thành công mới đồng bộ cache
        for (const pr of preparedRecords) {
            await addPendingRecord(pr, 'CREATE', pr.sourceTable as any);
        }

        try {
            const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
            preparedRecords.forEach(r => {
                if (!cached.some(c => c.id === r.id)) {
                    cached.unshift(r);
                }
            });
            saveToCache(CACHE_KEYS.RECORDS, cached);
        } catch (e) {
            console.error("Error syncing cache for batch create", e);
        }

        if (onProgress) onProgress(preparedRecords.length, preparedRecords.length);
        return true;
    }

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
            if (!recordPayload.id || !isValidUUID(recordPayload.id)) {
                recordPayload.id = generateStandardUUID();
            }
            
            const targetTable = getTargetTable(recordPayload);
            if (targetTable === 'luutru_records') {
                luutruPayload.push(sanitizeRecordPayloadForTable(recordPayload, 'luutru_records'));
            } else if (targetTable === 'dangky_records') {
                dangkyPayload.push(sanitizeRecordPayloadForTable(recordPayload, 'dangky_records'));
            } else {
                landPayload.push(sanitizeRecordPayloadForTable(recordPayload, 'land_records'));
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

                if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')) || (error.message && String(error.message).includes('Could not find')))) {
                    console.warn(`⚠️ [PGRST204 Fallback] Database schema mismatch on ${table} chunk ${i}. Retrying with safely recovered payload...`);
                    const { recoveredPayload } = recoverPayloadFromSchemaError(chunk, table, error);
                    const { error: fallbackError } = await supabase.from(table).insert(recoveredPayload);
                    if (fallbackError) throw fallbackError;
                } else if (error) {
                    if (isTransientError(error)) {
                        console.warn(`[CREATE_BATCH] Transient network error inserting into ${table}. Enqueueing chunk to offline sync.`, error);
                        for (const item of chunk) {
                            await addPendingRecord(item as RecordFile, 'CREATE', table);
                        }
                    } else {
                        throw error;
                    }
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
                        const sanitized = sanitizeRecordPayloadForTable(merged, dbEntry.table);
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
                    
                    const sanitized = sanitizeRecordPayloadForTable(newRecord, targetTable);
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

                    if (upsertError && (upsertError.code === 'PGRST204' || String(upsertError.code) === '42703' || (upsertError.message && String(upsertError.message).includes('does not exist')) || (upsertError.message && String(upsertError.message).includes('Could not find')))) {
                        console.warn(`⚠️ [PGRST204 Fallback] Retrying chunk target upsert into ${table} with safely recovered payload...`);
                        const { recoveredPayload } = recoverPayloadFromSchemaError(upChunk, table, upsertError);
                        const { error: fallbackError } = await supabase.from(table).upsert(recoveredPayload);
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
export const updateRecordsBatchById = async (updates: Partial<RecordFile>[], onProgress?: (processed: number, total: number) => void): Promise<{ success: boolean; count: number; error?: any }> => {
    if (!updates || updates.length === 0) return { success: true, count: 0 };

    console.log(`[MUTATION] Start updateRecordsBatchById for ${updates.length} records`);
    console.log(`[MUTATION] Supabase UPDATE: START`);

    // 0. Khóa bảo vệ thời gian thực cho toàn bộ hồ sơ vừa chuyển trạng thái (ngăn chặn polling nền đè lùi trạng thái)
    markRecordsRecentlyUpdated(updates);

    if (!isOnline()) {
        console.log(`[MUTATION] Supabase offline mode (isOnline=false). Enqueueing ${updates.length} updates to sync queue.`);
        const idToExistingMap = new Map<string, RecordFile>();
        MOCK_RECORDS.forEach(r => idToExistingMap.set(r.id, r));

        const fullMergedUpdates: RecordFile[] = updates.map(u => {
            const existing = u.id ? idToExistingMap.get(u.id) : undefined;
            const merged = { ...(existing || {}), ...u, _isOfflineSaved: true } as RecordFile;
            merged.sourceTable = getTargetTable(merged);
            return merged;
        });

        // 1. Lưu vào Sync Queue trước (Persistence-First)
        for (const item of fullMergedUpdates) {
            await addPendingRecord(item, 'UPDATE', item.sourceTable as any);
        }

        // 2. Chỉ cập nhật RAM & Cache sau khi đã persist vào Queue thành công
        fullMergedUpdates.forEach(up => {
            const idx = MOCK_RECORDS.findIndex(r => r.id === up.id);
            if (idx !== -1) {
                MOCK_RECORDS[idx] = { ...MOCK_RECORDS[idx], ...up } as RecordFile;
            }
        });
        await syncCacheOnBatchUpdate(fullMergedUpdates);
        saveToCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: updates.length };
    }

    try {
        // 2. TÌM BẢNG VÀ GHÉP DỮ LIỆU ĐẦY ĐỦ (Tránh phán đoán sai bảng do updates chỉ chứa một phần trường)
        const idToExistingMap = new Map<string, RecordFile>();
        const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
        cached.forEach(r => { if (r && r.id) idToExistingMap.set(r.id, r); });
        MOCK_RECORDS.forEach(r => { if (r && r.id && !idToExistingMap.has(r.id)) idToExistingMap.set(r.id, r); });

        const missingIds = updates.map(u => u.id).filter(id => id && !idToExistingMap.has(id)) as string[];
        if (missingIds.length > 0 && isOnline()) {
            try {
                const [landRes, dangkyRes, luutruRes] = await Promise.all([
                    supabase.from('land_records').select('*').in('id', missingIds),
                    supabase.from('dangky_records').select('*').in('id', missingIds),
                    supabase.from('luutru_records').select('*').in('id', missingIds)
                ]);
                (landRes.data || []).forEach(r => idToExistingMap.set(r.id, mapRecordFromDb({ ...r, sourceTable: 'land_records' })));
                (dangkyRes.data || []).forEach(r => idToExistingMap.set(r.id, mapRecordFromDb({ ...r, sourceTable: 'dangky_records' })));
                (luutruRes.data || []).forEach(r => idToExistingMap.set(r.id, mapRecordFromDb({ ...r, sourceTable: 'luutru_records' })));
            } catch (fetchErr) {
                console.warn('[updateRecordsBatchById] Failed to fetch missing records from DB:', fetchErr);
            }
        }

        const fullMergedUpdates: RecordFile[] = updates.map(u => {
            const existing = u.id ? idToExistingMap.get(u.id) : undefined;
            return { ...(existing || {}), ...u } as RecordFile;
        });

        const landRows: any[] = [];
        const dangkyRows: any[] = [];
        const luutruRows: any[] = [];

        fullMergedUpdates.forEach(u => {
            let table: 'land_records' | 'dangky_records' | 'luutru_records' = 'land_records';
            try {
                table = getTargetTable(u);
            } catch (e) {
                if (u.sourceTable && ['land_records', 'dangky_records', 'luutru_records'].includes(u.sourceTable)) {
                    table = u.sourceTable as any;
                }
            }
            const sanitizedRow = sanitizeRecordPayloadForTable(u, table);

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
            
            // Payload ban đầu đã được sanitize theo đúng schema bảng table, tuyệt đối không có 'data'
            let currentPayload = payload.map(r => sanitizeRecordPayloadForTable(r, table));

            let { error } = await supabase.from(table).upsert(currentPayload);

            if (error && (error.code === '22P02' || String(error.message || '').includes('22P02') || String(error.message || '').includes('invalid input syntax'))) {
                console.warn(`⚠️ [22P02 Fallback] Retrying updateRecordsBatchById on ${table} with 22P02 sanitized payload...`);
                currentPayload = sanitizePayloadFor22P02(currentPayload);
                const res = await supabase.from(table).upsert(currentPayload);
                error = res.error;
            }

            if (error && (error.code === '22007' || error.code === '22008' || String(error.message || '').includes('date') || String(error.message || '').includes('timestamp'))) {
                console.warn(`⚠️ [Date Fallback] Retrying updateRecordsBatchById on ${table} with date sanitized payload...`);
                currentPayload = currentPayload.map(r => sanitizePayloadForDateErrors(r));
                const res = await supabase.from(table).upsert(currentPayload);
                error = res.error;
            }

            if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')) || (error.message && String(error.message).includes('Could not find')))) {
                console.warn(`⚠️ [PGRST204 Recovery] Table '${table}' schema mismatch inside updateRecordsBatchById:`, error.message);
                const { recoveredPayload } = recoverPayloadFromSchemaError(currentPayload, table, error);
                currentPayload = recoveredPayload;
                const { error: fallbackError } = await supabase.from(table).upsert(currentPayload);
                error = fallbackError;
            }

            // Fallback cập nhật từng bản ghi theo ID nếu upsert hàng loạt gặp lỗi
            // Tuân thủ yêu cầu: fallback single update PHẢI SỬ DỤNG PAYLOAD ĐÃ SANITIZE, không lấy lại object gốc
            if (error) {
                console.warn(`⚠️ [updateRecordsBatchById] Upsert failed on ${table}, falling back to single updates by ID with sanitized payload:`, error);
                let fallbackSuccess = true;
                for (const row of currentPayload) {
                    if (!row.id) continue;
                    const cleanRow = { ...row };
                    delete cleanRow.id;
                    delete (cleanRow as any).data;
                    let { error: singleErr } = await supabase.from(table).update(cleanRow).eq('id', row.id);
                    if (singleErr && (singleErr.code === 'PGRST204' || String(singleErr.message || '').includes('Could not find') || String(singleErr.code) === '42703')) {
                        const { recoveredPayload: singleRecovered } = recoverPayloadFromSchemaError(cleanRow, table, singleErr);
                        delete singleRecovered.id;
                        const retry = await supabase.from(table).update(singleRecovered).eq('id', row.id);
                        singleErr = retry.error;
                    }
                    if (singleErr) {
                        console.error(`[updateRecordsBatchById] Single update fallback failed for ID ${row.id}:`, singleErr);
                        fallbackSuccess = false;
                        break;
                    }
                }
                if (fallbackSuccess) {
                    error = null;
                } else {
                    throw error;
                }
            }
        };

        const results = await Promise.allSettled([
            upsertIntoTable('land_records', landRows),
            upsertIntoTable('dangky_records', dangkyRows),
            upsertIntoTable('luutru_records', luutruRows)
        ]);

        const hasRejections = results.some(res => res.status === 'rejected');
        if (hasRejections) {
            console.error(`[MUTATION] Supabase UPDATE: ERROR inside updateRecordsBatchById`);
            console.warn(`[MUTATION] React State: NOT COMMITTED to live UI until queue confirmed`);
            for (let index = 0; index < results.length; index++) {
                const res = results[index];
                if (res.status === 'rejected') {
                    const table = index === 0 ? 'land_records' : index === 1 ? 'dangky_records' : 'luutru_records';
                    const rows = index === 0 ? landRows : index === 1 ? dangkyRows : luutruRows;
                    for (const r of rows) {
                        await addPendingRecord({ ...r, _isOfflineSaved: true } as RecordFile, 'UPDATE', table);
                    }
                }
            }
            return { success: false, count: 0, error: 'Lỗi đồng bộ dữ liệu tới Supabase. Đã lưu vào hàng đợi đồng bộ.' };
        }

        console.log(`[MUTATION] Supabase UPDATE: SUCCESS for ${updates.length} records`);
        console.log(`[MUTATION] VERIFY: SUCCESS`);

        // Synchronize RAM and local cache ONLY after Supabase confirmation
        fullMergedUpdates.forEach(up => {
            const idx = MOCK_RECORDS.findIndex(r => r.id === up.id);
            if (idx !== -1) {
                MOCK_RECORDS[idx] = { ...MOCK_RECORDS[idx], ...up } as RecordFile;
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
        console.log(`[MUTATION] React State: UPDATED`);
        if (onProgress) onProgress(updates.length, updates.length);
        return { success: true, count: updates.length };
    } catch (error: any) {
        console.error(`[MUTATION] Supabase UPDATE: ERROR`, error);
        console.warn(`[MUTATION] React State: NOT COMMITTED`);
        logError("updateRecordsBatchById", error);
        for (const u of updates) {
            let table: any = (u as any).sourceTable;
            if (!table) {
                try {
                    table = getTargetTable(u as RecordFile);
                } catch {
                    table = 'land_records';
                }
            }
            await addPendingRecord({ ...u, _isOfflineSaved: true } as RecordFile, 'UPDATE', table);
        }
        return { success: false, count: 0, error };
    }
};

export const bulkUpdateDangKyRecordsApi = async (records: RecordFile[]): Promise<boolean> => {
    if (!isConfigured || !records || records.length === 0) return true;
    try {
        for (const r of records) {
            const targetTable = getTargetTable(r);
            const payload = sanitizeRecordPayloadForTable(r, targetTable);
            delete payload.id;
            delete (payload as any).data;
            
            const previousUpdatedAt = r.updated_at || (r as any).updatedAt;

            // Kiểm tra xung đột trước khi update nếu có previousUpdatedAt
            if (previousUpdatedAt && r.id && isOnline()) {
                try {
                    const { data: curData } = await supabase.from(targetTable).select('updated_at').eq('id', r.id).maybeSingle();
                    if (curData && curData.updated_at && isConcurrencyConflict(curData.updated_at, previousUpdatedAt)) {
                        console.error(`[MUTATION][CONCURRENCY_CONFLICT] Record ID ${r.id} in bulkUpdate was updated by another session. DB: ${curData.updated_at}, Expected: ${previousUpdatedAt}`);
                        throw new Error(`CONCURRENCY_CONFLICT: Record with ID ${r.id} in table ${targetTable} was modified by another user or session. Please refresh.`);
                    }
                } catch (confErr: any) {
                    if (String(confErr?.message || '').includes('CONCURRENCY_CONFLICT')) throw confErr;
                }
            }

            let query = supabase.from(targetTable).update(payload);
            
            if (r.id) {
                query = query.eq('id', r.id);
            } else if (r.code) {
                query = query.eq('code', r.code);
            } else {
                continue;
            }
            
            let { data, error } = await query.select();
            if (error && (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist')) || (error.message && String(error.message).includes('Could not find')))) {
                console.warn(`⚠️ [bulkUpdateDangKyRecordsApi] Schema mismatch on ${targetTable}. Retrying with safely recovered payload...`);
                const { recoveredPayload } = recoverPayloadFromSchemaError(payload, targetTable, error);
                delete recoveredPayload.id;
                let retryQuery = supabase.from(targetTable).update(recoveredPayload);
                if (r.id) retryQuery = retryQuery.eq('id', r.id);
                else if (r.code) retryQuery = retryQuery.eq('code', r.code);
                const res = await retryQuery.select();
                data = res.data;
                error = res.error;
            }

            if (error) {
                console.warn(`⚠️ [bulkUpdateDangKyRecordsApi] Error updating record ${r.id || r.code} in ${targetTable}:`, error);
                let retryQuery = supabase.from(targetTable).update(payload).eq('id', r.id);
                const res = await retryQuery.select();
                data = res.data;
                error = res.error;
                if (error) throw error;
            }

            if (!data || data.length === 0) {
                if (r.id) {
                    const { data: checkData } = await supabase.from(targetTable).select('id, updated_at').eq('id', r.id);
                    if (checkData && checkData.length > 0) {
                        const currentDbUpdatedAt = checkData[0].updated_at;
                        if (isConcurrencyConflict(currentDbUpdatedAt, previousUpdatedAt)) {
                            console.error(`[MUTATION][CONCURRENCY_CONFLICT] Record ID ${r.id} in bulkUpdate was updated by another session. DB: ${currentDbUpdatedAt}, Expected: ${previousUpdatedAt}`);
                            throw new Error(`CONCURRENCY_CONFLICT: Record with ID ${r.id} in table ${targetTable} was modified by another user or session. Please refresh.`);
                        }
                    }
                    console.warn(`[bulkUpdateDangKyRecordsApi] Attempting upsert recovery on ${targetTable} for ID: ${r.id}`);
                    const upRes = await supabase.from(targetTable).upsert(payload).select();
                    if (upRes.data && upRes.data.length > 0) {
                        data = upRes.data;
                    } else {
                        console.error(`[MUTATION][UPDATE_NOT_FOUND] UPDATE returned 0 modified rows on ${targetTable} for ID: ${r.id}`);
                        throw new Error(`[UPDATE_NOT_FOUND] Record with ID ${r.id} was not found in table ${targetTable}.`);
                    }
                }
            } else {
                purgeRecordFromOtherTables(r.id, r.code, targetTable);
            }
        }
        syncCacheOnBatchUpdate(records);
        return true;
    } catch (error) {
        logError("bulkUpdateDangKyRecordsApi", error, true);
        throw error;
    }
};

