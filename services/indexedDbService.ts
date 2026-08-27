/**
 * IndexedDB Service for high-capacity local persistent snapshot storage.
 * Stores 100% full dataset across records, dangky_records, luutru_records, etc.
 */

const DB_NAME = 'QLHS_Offline_Database_v1';
const DB_VERSION = 1;
const STORE_NAME = 'app_keyval_store';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
    if (dbInstance) return Promise.resolve(dbInstance);
    if (dbInitPromise) return dbInitPromise;

    dbInitPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not supported in this environment'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('[IndexedDB] Failed to open database:', (event.target as IDBOpenDBRequest).error);
            reject((event.target as IDBOpenDBRequest).error);
        };
    });

    return dbInitPromise;
};

/**
 * Get an item from IndexedDB
 */
export const getFromIdb = async <T>(key: string, defaultValue: T): Promise<T> => {
    try {
        const db = await getDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                if (result !== undefined && result !== null) {
                    resolve(result as T);
                } else {
                    resolve(defaultValue);
                }
            };

            request.onerror = () => {
                console.warn(`[IndexedDB] Read error for key ${key}, falling back to default`);
                resolve(defaultValue);
            };
        });
    } catch (e) {
        console.warn(`[IndexedDB] Access error for key ${key}:`, e);
        return defaultValue;
    }
};

/**
 * Save an item into IndexedDB with full capacity (no truncation)
 */
export const saveToIdb = async <T>(key: string, value: T): Promise<void> => {
    try {
        const db = await getDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(value, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error(`[IndexedDB] Failed to save key ${key}:`, request.error);
                reject(request.error);
            };
        });
    } catch (e) {
        console.error(`[IndexedDB] Write error for key ${key}:`, e);
    }
};

/**
 * Delete an item from IndexedDB
 */
export const deleteFromIdb = async (key: string): Promise<void> => {
    try {
        const db = await getDb();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    } catch {
        // ignore
    }
};
