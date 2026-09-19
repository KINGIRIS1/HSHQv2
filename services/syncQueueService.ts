import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, RecordStatus } from '../types';
import { getIndexedDBItem, setIndexedDBItem } from './storageService';
import { sanitizeData, sanitizePayloadFor22P02, mapRecordFromDb, logError, keepOnlyDate, isTransientError } from './apiCore';

const SYNC_QUEUE_KEY = 'offline_unsynced_records';
const SYNC_BACKUP_KEY = 'app_unsynced_records_backup';
const MAX_ATTEMPTS = 5;
const TAB_LOCK_KEY = 'app_sync_engine_tab_lock';
const currentTabId = Math.random().toString(36).substring(2) + Date.now().toString(36);

export interface PendingSyncItem {
    record: RecordFile;
    targetTable: 'dangky_records' | 'land_records' | 'luutru_records';
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    queuedAt: string;
    attempts: number;
    isBlocked?: boolean;
    lastError?: string;
}

export const isValidUUID = (uuid: any): boolean => {
    if (typeof uuid !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid.trim());
};

export const generateStandardUUID = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

/**
 * Lấy danh sách hồ sơ đang chờ đồng bộ lên Cloud.
 * Quy tắc nghiêm ngặt:
 * - IndexedDB trả mảng hợp lệ (kể cả []) -> coi là dữ liệu chính xác từ IndexedDB (không fallback LocalStorage khi mảng rỗng).
 * - IndexedDB throw error -> mới fallback sang LocalStorage backup.
 */
export const getPendingSyncItems = async (): Promise<PendingSyncItem[]> => {
    try {
        const dbItems = await getIndexedDBItem<PendingSyncItem[]>(SYNC_QUEUE_KEY);
        if (Array.isArray(dbItems)) {
            return dbItems;
        }
    } catch (e) {
        console.warn('[SyncQueue] IndexedDB read error, falling back to LocalStorage backup:', e);
        try {
            const backup = localStorage.getItem(SYNC_BACKUP_KEY);
            if (backup) {
                const parsed = JSON.parse(backup);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (backupErr) {
            console.warn('[SyncQueue] LocalStorage backup read error:', backupErr);
        }
    }
    return [];
};

/**
 * Lưu danh sách hồ sơ chờ đồng bộ vào IndexedDB (nguồn chính).
 * Nếu IndexedDB thất bại, throw lỗi trực tiếp không nuốt lỗi.
 * LocalStorage backup chỉ là phụ trợ kỹ thuật dự phòng.
 */
export const savePendingSyncItems = async (items: PendingSyncItem[]): Promise<void> => {
    try {
        await setIndexedDBItem(SYNC_QUEUE_KEY, items);
        try {
            localStorage.setItem(SYNC_BACKUP_KEY, JSON.stringify(items));
        } catch (backupErr) {
            console.warn('[SyncQueue] LocalStorage backup write quota/error (non-fatal):', backupErr);
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync_queue_updated', { detail: { count: items.length } }));
        }
    } catch (e) {
        console.error('[SyncQueue] CRITICAL: Failed to save queue to IndexedDB:', e);
        // Cố gắng lưu vào LocalStorage backup để bảo toàn dữ liệu trước khi ném lỗi
        try {
            localStorage.setItem(SYNC_BACKUP_KEY, JSON.stringify(items));
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('sync_queue_updated', { detail: { count: items.length } }));
            }
        } catch (backupErr) {
            console.warn('[SyncQueue] LocalStorage backup write failed:', backupErr);
        }
        throw e; // Bắt buộc ném lỗi để caller biết IndexedDB write thất bại
    }
};

// ==========================================
// CƠ CHẾ KHÓA SERIALIZATION CHO QUEUE MUTATIONS
// ==========================================

// In-tab promise chain để tuần tự hóa các mutation trong cùng một tab
let inTabMutationPromise: Promise<any> = Promise.resolve();

/**
 * Fallback spin-lock dùng localStorage lease khi Web Locks API không có sẵn trên trình duyệt.
 * Không dùng polyfill Node.js, an toàn 100% cho browser.
 */
const acquireMutationSpinLock = async (timeoutMs = 5000): Promise<() => void> => {
    const startTime = Date.now();
    const lockId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const LEASE_KEY = 'app_sync_queue_mutation_lease';

    while (Date.now() - startTime < timeoutMs) {
        const now = Date.now();
        let canAcquire = false;
        try {
            const raw = localStorage.getItem(LEASE_KEY);
            if (!raw) {
                canAcquire = true;
            } else {
                const parsed = JSON.parse(raw);
                if (!parsed.expiresAt || parsed.expiresAt <= now) {
                    canAcquire = true;
                }
            }
            if (canAcquire) {
                localStorage.setItem(LEASE_KEY, JSON.stringify({ lockId, expiresAt: now + 3000 }));
                // Thử đọc lại để kiểm chứng ownership
                const check = localStorage.getItem(LEASE_KEY);
                if (check && JSON.parse(check).lockId === lockId) {
                    return () => {
                        try {
                            const cur = localStorage.getItem(LEASE_KEY);
                            if (cur && JSON.parse(cur).lockId === lockId) {
                                localStorage.removeItem(LEASE_KEY);
                            }
                        } catch {}
                    };
                }
            }
        } catch {}
        // Chờ ngẫu nhiên 20-50ms trước khi thử lại
        await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
    }

    // Nếu hết timeout, trả về hàm dọn dẹp để tránh kẹt mãi mãi
    return () => {
        try { localStorage.removeItem(LEASE_KEY); } catch {}
    };
};

/**
 * Thực thi mutation queue dưới khóa độc quyền:
 * - Ưu tiên Web Locks API (navigator.locks) nếu trình duyệt hỗ trợ (Chrome, Firefox, Safari, Edge hiện đại).
 * - Fallback LocalStorage spin-lock lease an toàn cho trình duyệt không hỗ trợ.
 * - Luôn tuần tự hóa trong tab thông qua promise chain.
 */
export const withMutationLock = async <T>(operation: () => Promise<T>): Promise<T> => {
    const executeExclusive = async (): Promise<T> => {
        if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
            return await navigator.locks.request('app_sync_queue_mutation_lock', { mode: 'exclusive' }, async () => {
                return await operation();
            });
        } else {
            const release = await acquireMutationSpinLock();
            try {
                return await operation();
            } finally {
                release();
            }
        }
    };

    const nextPromise = inTabMutationPromise.then(executeExclusive, executeExclusive);
    inTabMutationPromise = nextPromise.then(() => {}, () => {});
    return await nextPromise;
};

/**
 * Thêm hoặc cập nhật hồ sơ vào hàng đợi chờ đồng bộ lên Cloud.
 * Chạy bên trong withMutationLock để đảm bảo tính tuần tự hóa giữa các tab.
 * Nếu item đã tồn tại và đang BLOCKED, giữ nguyên targetTable, action, attempts, lastError và isBlocked.
 */
export const addPendingRecord = async (
    record: RecordFile,
    action: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE',
    targetTable?: 'dangky_records' | 'land_records' | 'luutru_records'
): Promise<void> => {
    if (!record || !record.id) return;
    if (!targetTable || !['dangky_records', 'land_records', 'luutru_records'].includes(targetTable)) {
        console.error(`[SyncQueue][BLOCK] addPendingRecord rejected: targetTable is mandatory and must be valid. Record ID: ${record.id}`);
        throw new Error("TARGET_TABLE_REQUIRED: Cannot add item to sync queue without mandatory targetTable.");
    }

    return await withMutationLock(async () => {
        try {
            const currentItems = await getPendingSyncItems();
            const existingIdx = currentItems.findIndex(item => item.record.id === record.id);
            
            let newItem: PendingSyncItem;
            if (existingIdx >= 0) {
                const existing = currentItems[existingIdx];
                if (existing.isBlocked) {
                    if (targetTable && targetTable !== existing.targetTable) {
                        console.warn(`[SyncQueue][BLOCKED_IMMUTABLE] Record ID ${record.id} is blocked. TargetTable conflict (${targetTable} vs ${existing.targetTable}). TargetTable and action cannot be changed.`);
                    }
                    newItem = {
                        ...existing,
                        record: { ...record, _isOfflineSaved: true },
                        // Giữ nguyên targetTable, action, attempts, lastError, isBlocked
                        targetTable: existing.targetTable,
                        action: existing.action,
                        isBlocked: true,
                        attempts: existing.attempts,
                        lastError: existing.lastError
                    };
                } else {
                    newItem = {
                        ...existing,
                        record: { ...record, _isOfflineSaved: true },
                        targetTable: targetTable || existing.targetTable,
                        action,
                        isBlocked: false,
                        attempts: existing.attempts,
                        lastError: existing.lastError
                    };
                }
            } else {
                newItem = {
                    record: { ...record, _isOfflineSaved: true },
                    targetTable,
                    action,
                    queuedAt: new Date().toISOString(),
                    attempts: 0,
                    isBlocked: false
                };
            }

            let updatedList: PendingSyncItem[];
            if (existingIdx >= 0) {
                updatedList = [...currentItems];
                updatedList[existingIdx] = newItem;
            } else {
                updatedList = [newItem, ...currentItems];
            }

            await savePendingSyncItems(updatedList);
            console.log(`[SyncQueue] Đã ghi nhận hồ sơ ${record.code || record.id} vào hàng đợi đồng bộ (${updatedList.length} hồ sơ chờ)`);
        } catch (e) {
            console.error('[SyncQueue] Lỗi khi thêm vào sync queue:', e);
            throw e; // Propagate error cho caller
        }
    });
};

/**
 * Xóa hồ sơ đã đồng bộ thành công khỏi hàng đợi (dựa vào ID hoặc mã hồ sơ).
 * QUY TẮC BẢO VỆ BLOCKED ITEM:
 * - Không bao giờ xóa item đang có isBlocked === true trong luồng thông thường.
 * - Chỉ xóa BLOCKED item khi tham số forceRemoveBlocked === true được truyền rõ ràng.
 * - Chạy bên trong withMutationLock để tránh race condition giữa các tab.
 */
export const removePendingRecord = async (
    recordId: string,
    recordCode?: string,
    forceRemoveBlocked: boolean = false
): Promise<void> => {
    if (!recordId && !recordCode) return;
    return await withMutationLock(async () => {
        try {
            const currentItems = await getPendingSyncItems();
            const filtered = currentItems.filter(item => {
                const isMatch = (recordId && item.record.id === recordId) ||
                                (recordCode && item.record.code && item.record.code === recordCode);
                if (!isMatch) return true;

                // Hồ sơ khớp! Kiểm tra nếu bị BLOCKED:
                if (item.isBlocked && !forceRemoveBlocked) {
                    console.warn(`[SyncQueue] PROTECTED: Record ${recordId || recordCode} is BLOCKED. removePendingRecord refused to delete blocked item.`);
                    return true; // Giữ lại trong queue!
                }
                return false; // Xóa khỏi queue
            });

            if (filtered.length !== currentItems.length) {
                await savePendingSyncItems(filtered);
                console.log(`[SyncQueue] Đã hoàn tất đồng bộ và gỡ hồ sơ ${recordId || recordCode} khỏi hàng đợi. Còn lại: ${filtered.length}`);
            }
        } catch (e) {
            console.error('[SyncQueue] Lỗi khi xóa khỏi sync queue:', e);
            throw e; // Propagate error cho caller
        }
    });
};

/**
 * Lấy danh sách RecordFile đang chờ đồng bộ
 */
export const getPendingRecords = async (): Promise<RecordFile[]> => {
    const items = await getPendingSyncItems();
    return items.map(i => ({ ...i.record, _isOfflineSaved: true }));
};

/**
 * Đếm số lượng hồ sơ đang chờ đồng bộ
 */
export const getPendingSyncCount = async (): Promise<number> => {
    const items = await getPendingSyncItems();
    return items.length;
};

// ==========================================
// MULTI-TAB ENGINE LOCK (CHO TOÀN BỘ TIẾN TRÌNH SYNC)
// ==========================================

let isSyncingInProgress = false;

const acquireMultiTabLock = (): boolean => {
    const now = Date.now();
    try {
        const raw = localStorage.getItem(TAB_LOCK_KEY);
        if (raw) {
            const lockData = JSON.parse(raw);
            if (lockData.expiresAt > now && lockData.tabId !== currentTabId) {
                return false; // Đang bị tab khác giữ khóa
            }
        }
        localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ tabId: currentTabId, expiresAt: now + 35000 }));
        return true;
    } catch {
        return true;
    }
};

const renewMultiTabLock = () => {
    const now = Date.now();
    try {
        localStorage.setItem(TAB_LOCK_KEY, JSON.stringify({ tabId: currentTabId, expiresAt: now + 35000 }));
    } catch {}
};

const releaseMultiTabLock = () => {
    try {
        const raw = localStorage.getItem(TAB_LOCK_KEY);
        if (raw) {
            const lockData = JSON.parse(raw);
            if (lockData.tabId === currentTabId) {
                localStorage.removeItem(TAB_LOCK_KEY);
            }
        }
    } catch {}
};

export interface SyncResult {
    successCount: number;
    failCount: number;
    blockedCount: number;
    pendingCount: number;
}

/**
 * Thực hiện đồng bộ toàn bộ hồ sơ đang tồn đọng lên Supabase Cloud:
 * - Khi Web Locks có sẵn: dùng native lock hoàn toàn, KHÔNG tạo LocalStorage heartbeat chồng chéo.
 * - Khi Web Locks không có sẵn: dùng LocalStorage lease + heartbeat renewal định kỳ.
 * - Luôn release khóa trong mọi trường hợp (success, error, exception, empty queue, network failure).
 */
export const syncPendingRecordsToCloud = async (
    createFn: (r: RecordFile, expectedTargetTable?: 'dangky_records' | 'land_records' | 'luutru_records') => Promise<RecordFile | null>,
    updateFn: (r: RecordFile, expectedTargetTable?: 'dangky_records' | 'land_records' | 'luutru_records') => Promise<RecordFile | null>
): Promise<SyncResult> => {
    if (!isConfigured || isSyncingInProgress) {
        const currentCount = await getPendingSyncCount();
        return { successCount: 0, failCount: 0, blockedCount: 0, pendingCount: currentCount };
    }

    // Phân nhánh 1: Web Locks API có sẵn trên trình duyệt -> Native Lock độc lập
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        let result: SyncResult = { successCount: 0, failCount: 0, blockedCount: 0, pendingCount: 0 };
        try {
            const acquired = await navigator.locks.request('app_sync_engine_native_lock', { ifAvailable: true }, async (lock) => {
                if (!lock) {
                    console.warn('[SyncEngine] SKIP - LOCKED by native Web Locks API in another tab');
                    return false;
                }
                // Native lock: không dùng LocalStorage lease heartbeat
                result = await executeSyncProcess(createFn, updateFn, false);
                return true;
            });
            if (!acquired) {
                const currentCount = await getPendingSyncCount();
                return { successCount: 0, failCount: 0, blockedCount: 0, pendingCount: currentCount };
            }
            return result;
        } catch (nativeErr) {
            console.error('[SyncEngine] Native lock execution error:', nativeErr);
            const currentCount = await getPendingSyncCount();
            return { successCount: 0, failCount: 0, blockedCount: 0, pendingCount: currentCount };
        }
    } else {
        // Phân nhánh 2: Fallback LocalStorage Lease lock + Heartbeat
        if (!acquireMultiTabLock()) {
            console.warn('[SyncEngine] SKIP - LOCKED by LocalStorage lease in another tab');
            const currentCount = await getPendingSyncCount();
            return { successCount: 0, failCount: 0, blockedCount: 0, pendingCount: currentCount };
        }
        try {
            return await executeSyncProcess(createFn, updateFn, true);
        } finally {
            releaseMultiTabLock();
        }
    }
};

interface ProcessOutcome {
    status: 'SUCCESS' | 'BLOCKED' | 'RETRY';
    attempts: number;
    isBlocked: boolean;
    lastError?: string;
}

const executeSyncProcess = async (
    createFn: (r: RecordFile, expectedTargetTable?: 'dangky_records' | 'land_records' | 'luutru_records') => Promise<RecordFile | null>,
    updateFn: (r: RecordFile, expectedTargetTable?: 'dangky_records' | 'land_records' | 'luutru_records') => Promise<RecordFile | null>,
    withHeartbeat: boolean
): Promise<SyncResult> => {
    isSyncingInProgress = true;
    console.log('[SYNC] START');

    let successCount = 0;
    let failCount = 0;
    let lockRenewalInterval: any = null;

    let finalPendingCount = 0;
    let finalBlockedCount = 0;
    let finalRetryCount = 0;

    try {
        if (withHeartbeat) {
            lockRenewalInterval = setInterval(() => {
                renewMultiTabLock();
            }, 15000);
        }

        const itemsToProcess = await getPendingSyncItems();
        if (itemsToProcess.length === 0) {
            return { successCount: 0, failCount: 0, blockedCount: 0, pendingCount: 0 };
        }

        console.log(`[SyncEngine] Đang tự động đẩy ${itemsToProcess.length} hồ sơ tồn đọng lên Supabase Cloud...`);

        const outcomeMap = new Map<string, ProcessOutcome>();

        for (const item of itemsToProcess) {
            console.log(`[SYNC] RECORD ID: ${item.record.id}`);
            console.log(`[SYNC] ACTION: ${item.action}`);
            console.log(`[SYNC] TARGET_TABLE: ${item.targetTable}`);
            console.log(`[SYNC] ATTEMPT: ${item.attempts}`);

            // 1. Kiểm tra nếu item đã bị BLOCKED từ trước -> SKIP và giữ nguyên trạng thái BLOCKED trong queue
            if (item.isBlocked || String(item.lastError || '').includes('SYNC_ROUTING_CONFLICT') || String(item.lastError || '').includes('BLOCKED') || String(item.lastError || '').includes('CONCURRENCY_CONFLICT')) {
                console.warn(`[SYNC] SKIP_BLOCKED recordId: ${item.record.id}, targetTable: ${item.targetTable}, attempts: ${item.attempts}, lastError: ${item.lastError}`);
                outcomeMap.set(item.record.id, {
                    status: 'BLOCKED',
                    attempts: item.attempts,
                    isBlocked: true,
                    lastError: item.lastError
                });
                continue;
            }

            try {
                if (item.action === 'CREATE') {
                    const synced = await createFn(item.record, item.targetTable);
                    if (synced && !synced._isOfflineSaved) {
                        successCount++;
                        console.log(`[SYNC] SUCCESS CREATE recordId: ${item.record.id}`);
                        outcomeMap.set(item.record.id, {
                            status: 'SUCCESS',
                            attempts: item.attempts,
                            isBlocked: false
                        });
                    } else {
                        throw new Error("CREATE_FAILED: createFn returned null or offline state");
                    }
                } else if (item.action === 'UPDATE') {
                    const synced = await updateFn(item.record, item.targetTable);
                    if (synced && !synced._isOfflineSaved) {
                        successCount++;
                        console.log(`[SYNC] SUCCESS UPDATE recordId: ${item.record.id}`);
                        outcomeMap.set(item.record.id, {
                            status: 'SUCCESS',
                            attempts: item.attempts,
                            isBlocked: false
                        });
                    } else {
                        throw new Error("UPDATE_FAILED: updateFn returned null or offline state");
                    }
                } else if (item.action === 'DELETE') {
                    const { error } = await supabase.from(item.targetTable).delete().eq('id', item.record.id);
                    if (!error) {
                        successCount++;
                        console.log(`[SYNC] SUCCESS DELETE recordId: ${item.record.id}`);
                        outcomeMap.set(item.record.id, {
                            status: 'SUCCESS',
                            attempts: item.attempts,
                            isBlocked: false
                        });
                    } else {
                        throw error;
                    }
                }
            } catch (err: any) {
                const errStr = String(err?.message || err || '');
                const isRoutingConflict = errStr.includes('SYNC_ROUTING_CONFLICT');
                const isConcurrencyConflict = errStr.includes('CONCURRENCY_CONFLICT');
                const isTransient = isTransientError(err);
                const errorType = isRoutingConflict ? 'SYNC_ROUTING_CONFLICT' : (isConcurrencyConflict ? 'CONCURRENCY_CONFLICT' : (isTransient ? 'TRANSIENT' : 'PERMANENT'));

                console.log(`[SYNC] ERROR_TYPE: ${errorType} - ${errStr}`);

                if (isRoutingConflict || isConcurrencyConflict || !isTransient) {
                    // Lỗi xung đột hoặc permanent -> BLOCKED ngay để bảo vệ dữ liệu, KHÔNG ghi đè, KHÔNG xóa khỏi queue
                    const finalErrorMsg = isRoutingConflict 
                        ? `SYNC_ROUTING_CONFLICT: ${errStr}` 
                        : (isConcurrencyConflict ? `CONCURRENCY_CONFLICT: ${errStr}` : `BLOCKED: ${errStr}`);
                    console.error(`[SYNC] BLOCKED recordId: ${item.record.id}, attempts: ${item.attempts}, error: ${finalErrorMsg}`);
                    outcomeMap.set(item.record.id, {
                        status: 'BLOCKED',
                        attempts: item.attempts,
                        isBlocked: true,
                        lastError: finalErrorMsg
                    });
                } else {
                    // Lỗi transient -> tăng attempts lên đến MAX_ATTEMPTS
                    const newAttempts = item.attempts + 1;
                    if (newAttempts >= MAX_ATTEMPTS) {
                        const finalErrorMsg = `MAX_ATTEMPTS_EXCEEDED (${MAX_ATTEMPTS}): ${errStr}`;
                        console.error(`[SYNC] BLOCKED recordId: ${item.record.id}, attempts reach MAX_ATTEMPTS (${newAttempts}), error: ${finalErrorMsg}`);
                        outcomeMap.set(item.record.id, {
                            status: 'BLOCKED',
                            attempts: MAX_ATTEMPTS,
                            isBlocked: true,
                            lastError: finalErrorMsg
                        });
                    } else {
                        failCount++;
                        console.warn(`[SYNC] RETRY recordId: ${item.record.id}, attempt ${newAttempts}/${MAX_ATTEMPTS}`);
                        outcomeMap.set(item.record.id, {
                            status: 'RETRY',
                            attempts: newAttempts,
                            isBlocked: false,
                            lastError: errStr
                        });
                    }
                }
            }
        }

        // Cập nhật kết quả vào IndexedDB dưới khóa mutation lock để bảo vệ các record mới thêm từ tab khác
        await withMutationLock(async () => {
            const freshQueue = await getPendingSyncItems();
            const mergedQueue: PendingSyncItem[] = [];

            for (const queueItem of freshQueue) {
                const outcome = outcomeMap.get(queueItem.record.id);
                if (!outcome) {
                    // Record được thêm mới từ tab khác trong lúc đang sync -> giữ nguyên 100%!
                    mergedQueue.push(queueItem);
                } else if (outcome.status === 'SUCCESS') {
                    // Đã đồng bộ thành công -> gỡ khỏi queue (trừ khi đang bị blocked thì bảo vệ)
                    if (queueItem.isBlocked) {
                        mergedQueue.push(queueItem);
                    }
                } else {
                    // Thất bại hoặc Blocked -> cập nhật metadata
                    mergedQueue.push({
                        ...queueItem,
                        attempts: outcome.attempts,
                        isBlocked: outcome.isBlocked,
                        lastError: outcome.lastError
                    });
                }
            }

            await savePendingSyncItems(mergedQueue);
            finalPendingCount = mergedQueue.length;
            finalBlockedCount = mergedQueue.filter(i => i.isBlocked).length;
            finalRetryCount = mergedQueue.filter(i => !i.isBlocked).length;
        });

        console.log(`[SyncEngine] Hoàn tất đợt đồng bộ: ${successCount} thành công, ${finalPendingCount} còn tồn (${finalBlockedCount} bị chặn/xung đột, ${finalRetryCount} chờ thử lại)`);
    } catch (e) {
        console.error('[SyncEngine] Lỗi trong quá trình đồng bộ hàng đợi:', e);
    } finally {
        if (lockRenewalInterval) clearInterval(lockRenewalInterval);
        isSyncingInProgress = false;
    }

    return {
        successCount,
        failCount: finalRetryCount,
        blockedCount: finalBlockedCount,
        pendingCount: finalPendingCount
    };
};
