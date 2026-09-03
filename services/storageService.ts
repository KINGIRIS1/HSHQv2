/**
 * Quản lý bộ nhớ đệm lưu trữ ngoại tuyến cho ứng dụng bằng IndexedDB
 * Khắc phục triệt để lỗi tràn hạn ngạch 5MB của LocalStorage (QuotaExceededError)
 */

const DB_NAME = 'HeThongQuanLyHoSo_DB';
const DB_VERSION = 1;
const STORE_NAME = 'app_cache';

let dbInstance: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase | null> => {
    if (typeof window === 'undefined' || !window.indexedDB) {
        return Promise.resolve(null);
    }
    if (dbInstance) {
        return Promise.resolve(dbInstance);
    }

    return new Promise((resolve) => {
        try {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = (event: any) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onerror = (event: any) => {
                console.warn('Không thể khởi tạo IndexedDB:', event.target.error);
                resolve(null);
            };
        } catch (e) {
            console.warn('Lỗi khi mở IndexedDB:', e);
            resolve(null);
        }
    });
};

export const setIndexedDBItem = async (key: string, value: any): Promise<void> => {
    try {
        const db = await getDB();
        if (!db) return;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put(value, key);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    } catch {
        // Bỏ qua lỗi IndexedDB nếu có
    }
};

export const getIndexedDBItem = async <T>(key: string): Promise<T | null> => {
    try {
        const db = await getDB();
        if (!db) return null;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => {
                    resolve(req.result !== undefined ? req.result : null);
                };
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    } catch {
        return null;
    }
};
