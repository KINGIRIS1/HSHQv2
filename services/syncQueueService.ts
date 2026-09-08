import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, RecordStatus } from '../types';
import { getIndexedDBItem, setIndexedDBItem } from './storageService';
import { sanitizeData, sanitizePayloadFor22P02, mapRecordFromDb, logError, keepOnlyDate } from './apiCore';

const SYNC_QUEUE_KEY = 'offline_unsynced_records';
const SYNC_BACKUP_KEY = 'app_unsynced_records_backup';

export interface PendingSyncItem {
    record: RecordFile;
    targetTable?: 'dangky_records' | 'land_records' | 'luutru_records';
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    queuedAt: string;
    attempts: number;
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
 * Lấy danh sách hồ sơ đang chờ đồng bộ lên Cloud
 */
export const getPendingSyncItems = async (): Promise<PendingSyncItem[]> => {
    try {
        const dbItems = await getIndexedDBItem<PendingSyncItem[]>(SYNC_QUEUE_KEY);
        if (Array.isArray(dbItems) && dbItems.length > 0) {
            return dbItems;
        }
        const backup = localStorage.getItem(SYNC_BACKUP_KEY);
        if (backup) {
            const parsed = JSON.parse(backup);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn('Lỗi đọc hàng đợi đồng bộ:', e);
    }
    return [];
};

/**
 * Lưu danh sách hồ sơ chờ đồng bộ vào cả IndexedDB và LocalStorage backup
 */
const savePendingSyncItems = async (items: PendingSyncItem[]): Promise<void> => {
    try {
        await setIndexedDBItem(SYNC_QUEUE_KEY, items);
        try {
            localStorage.setItem(SYNC_BACKUP_KEY, JSON.stringify(items));
        } catch {}
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync_queue_updated', { detail: { count: items.length } }));
        }
    } catch (e) {
        console.warn('Lỗi lưu hàng đợi đồng bộ:', e);
    }
};

/**
 * Thêm hoặc cập nhật hồ sơ vào hàng đợi chờ đồng bộ lên Cloud
 */
export const addPendingRecord = async (
    record: RecordFile,
    action: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE',
    targetTable?: 'dangky_records' | 'land_records' | 'luutru_records'
): Promise<void> => {
    if (!record || !record.id) return;
    try {
        const currentItems = await getPendingSyncItems();
        const existingIdx = currentItems.findIndex(item => item.record.id === record.id);
        const newItem: PendingSyncItem = {
            record: { ...record, _isOfflineSaved: true },
            targetTable,
            action,
            queuedAt: new Date().toISOString(),
            attempts: existingIdx >= 0 ? currentItems[existingIdx].attempts : 0
        };

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
        console.error('Lỗi khi thêm vào sync queue:', e);
    }
};

/**
 * Xóa hồ sơ đã đồng bộ thành công khỏi hàng đợi
 */
export const removePendingRecord = async (recordId: string): Promise<void> => {
    if (!recordId) return;
    try {
        const currentItems = await getPendingSyncItems();
        const filtered = currentItems.filter(item => item.record.id !== recordId);
        if (filtered.length !== currentItems.length) {
            await savePendingSyncItems(filtered);
            console.log(`[SyncQueue] Đã hoàn tất đồng bộ và gỡ hồ sơ ${recordId} khỏi hàng đợi. Còn lại: ${filtered.length}`);
        }
    } catch (e) {
        console.error('Lỗi khi xóa khỏi sync queue:', e);
    }
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

// Khóa chống chạy đồng bộ song song
let isSyncingInProgress = false;

/**
 * Thực hiện đồng bộ toàn bộ hồ sơ đang tồn đọng lên Supabase Cloud
 */
export const syncPendingRecordsToCloud = async (
    createFn: (r: RecordFile) => Promise<RecordFile | null>,
    updateFn: (r: RecordFile) => Promise<RecordFile | null>
): Promise<{ successCount: number; failCount: number }> => {
    if (!isConfigured || isSyncingInProgress) {
        return { successCount: 0, failCount: 0 };
    }

    isSyncingInProgress = true;
    let successCount = 0;
    let failCount = 0;

    try {
        const items = await getPendingSyncItems();
        if (items.length === 0) {
            isSyncingInProgress = false;
            return { successCount: 0, failCount: 0 };
        }

        console.log(`[SyncEngine] Đang tự động đẩy ${items.length} hồ sơ tồn đọng lên Supabase Cloud...`);

        const remainingItems: PendingSyncItem[] = [];

        for (const item of items) {
            try {
                let synced: RecordFile | null = null;
                if (item.action === 'CREATE') {
                    synced = await createFn(item.record);
                } else if (item.action === 'UPDATE') {
                    synced = await updateFn(item.record);
                }

                // Nếu hàm trả về kết quả KHÔNG có cờ _isOfflineSaved thì đã lên cloud thành công
                if (synced && !synced._isOfflineSaved) {
                    successCount++;
                    console.log(`[SyncEngine] ✅ Đồng bộ thành công hồ sơ: ${synced.code || synced.id}`);
                } else {
                    failCount++;
                    remainingItems.push({
                        ...item,
                        attempts: item.attempts + 1,
                        lastError: 'Chưa thể kết nối tới Cloud'
                    });
                }
            } catch (err: any) {
                failCount++;
                remainingItems.push({
                    ...item,
                    attempts: item.attempts + 1,
                    lastError: err?.message || String(err)
                });
            }
        }

        await savePendingSyncItems(remainingItems);
        console.log(`[SyncEngine] Hoàn tất đợt đồng bộ: ${successCount} thành công, ${failCount} còn tồn`);
    } catch (e) {
        console.error('[SyncEngine] Lỗi trong quá trình đồng bộ hàng đợi:', e);
    } finally {
        isSyncingInProgress = false;
    }

    return { successCount, failCount };
};
