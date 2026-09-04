
import { useState, useEffect, useCallback } from 'react';
import { RecordFile, Employee, User, UserRole, RecordStatus, Holiday, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { fetchRecords, fetchEmployees, fetchUsers, fetchUpdateInfo, fetchHolidays,
    createRecordApi, updateRecordApi, deleteRecordApi, createRecordsBatchApi,
    saveEmployeeApi, deleteEmployeeApi, saveUserApi, deleteUserApi, deleteAllDataApi, getSystemSetting
} from '../services/api';
import { supabase } from '../services/supabaseClient';
import { mapRecordFromDb, getFromCache, CACHE_KEYS } from '../services/apiCore';
import { getIndexedDBItem } from '../services/storageService';
import { DEFAULT_WARDS as STATIC_WARDS, APP_VERSION, MOCK_EMPLOYEES, MOCK_USERS } from '../constants';
import { migrateUnbatchedRecords, deduplicateRecords } from '../utils/appHelpers';
import { connectionManager } from '../services/connectionService';

export const useAppData = (currentUser: User | null) => {
    // Khởi tạo danh sách hồ sơ ban đầu (sẽ được nạp tức thì từ IndexedDB & Cloud)
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [employees, setEmployees] = useState<Employee[]>(() => {
        return getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    });
    const [users, setUsers] = useState<User[]>(() => {
        return getFromCache<User[]>(CACHE_KEYS.USERS, MOCK_USERS);
    });
    const [holidays, setHolidays] = useState<Holiday[]>(() => {
        return getFromCache<Holiday[]>(CACHE_KEYS.HOLIDAYS, []);
    });
    const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
    const [departmentPermissions, setDepartmentPermissions] = useState<DepartmentPermissions>({});
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline'>('connected');
    
    // Wards State
    const [wards, setWards] = useState<string[]>(() => {
        const saved = localStorage.getItem('wards_list');
        return saved ? JSON.parse(saved) : STATIC_WARDS;
    });

    // Update Info State
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [latestVersion, setLatestVersion] = useState('');
    const [updateUrl, setUpdateUrl] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            // Helper bọc timeout an toàn cho từng tác vụ tải dữ liệu
            const safeFetch = async <T>(promise: Promise<T>, fallbackValue: T, timeoutMs = 15000): Promise<T> => {
                let timer: any;
                const timeoutP = new Promise<T>((resolve) => {
                    timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
                });
                try {
                    const res = await Promise.race([promise, timeoutP]);
                    clearTimeout(timer);
                    return res;
                } catch (err) {
                    clearTimeout(timer);
                    return fallbackValue;
                }
            };

            const [recData, empData, userData, updateInfo, holidayData, permsData, deptPermsData] = await Promise.all([
                // Tải danh sách hồ sơ: Không ép fallback về mảng rỗng làm đè mất dữ liệu đang tải
                fetchRecords((tier, partialList, isComplete) => {
                    // Cập nhật giao diện ngay khi từng Giai đoạn ưu tiên tải xong
                    if (Array.isArray(partialList) && partialList.length > 0) {
                        setRecords(prev => {
                            if (!prev || prev.length === 0) {
                                const { migratedRecords } = migrateUnbatchedRecords(deduplicateRecords(partialList));
                                return migratedRecords;
                            }
                            const map = new Map<string, RecordFile>();
                            prev.forEach(r => { if (r.id) map.set(r.id, r); });
                            partialList.forEach(r => { if (r.id) map.set(r.id, r); });
                            const merged = Array.from(map.values());
                            const { migratedRecords } = migrateUnbatchedRecords(deduplicateRecords(merged));
                            return migratedRecords;
                        });
                    }
                }).catch(async (err) => {
                    console.warn("fetchRecords gặp lỗi mạng, đang nạp từ IndexedDB:", err);
                    const idb = await getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS);
                    return Array.isArray(idb) ? idb : [];
                }),
                safeFetch(fetchEmployees(), getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES)),
                safeFetch(fetchUsers(), getFromCache(CACHE_KEYS.USERS, MOCK_USERS)),
                safeFetch(fetchUpdateInfo(), { version: null, url: null }, 6000),
                safeFetch(fetchHolidays(), getFromCache(CACHE_KEYS.HOLIDAYS, []), 6000),
                safeFetch(getSystemSetting('role_permissions'), null, 6000),
                safeFetch(getSystemSetting('department_permissions'), null, 6000)
            ]);

            if (Array.isArray(recData) && recData.length > 0) {
                const { migratedRecords } = migrateUnbatchedRecords(deduplicateRecords(recData));
                setRecords(prev => {
                    // Chỉ cập nhật nếu danh sách mới nhiều hơn hoặc bằng danh sách hiện tại
                    if (prev.length <= migratedRecords.length || prev.length === 0) {
                        return migratedRecords;
                    }
                    const map = new Map<string, RecordFile>();
                    prev.forEach(r => { if (r.id) map.set(r.id, r); });
                    migratedRecords.forEach(r => { if (r.id) map.set(r.id, r); });
                    const merged = Array.from(map.values());
                    const { migratedRecords: mRecs } = migrateUnbatchedRecords(deduplicateRecords(merged));
                    return mRecs;
                });
            }

            if (Array.isArray(empData) && empData.length > 0) {
                setEmployees(empData);
            }
            if (Array.isArray(userData) && userData.length > 0) {
                setUsers(userData);
            }
            if (Array.isArray(holidayData)) {
                setHolidays(holidayData);
            }

            if (permsData) {
                try {
                    const parsed = JSON.parse(permsData);
                    Object.keys(DEFAULT_ROLE_PERMISSIONS).forEach(roleKey => {
                        if (!parsed[roleKey]) {
                            parsed[roleKey] = DEFAULT_ROLE_PERMISSIONS[roleKey as UserRole] || [];
                        }
                    });
                    setRolePermissions(parsed);
                } catch (e) {
                    console.error("Failed to parse role_permissions", e);
                }
            }
            if (deptPermsData) {
                try {
                    const parsedDept = JSON.parse(deptPermsData);
                    setDepartmentPermissions(parsedDept);
                } catch (e) {
                    console.error("Failed to parse department_permissions", e);
                }
            }
            setConnectionStatus('connected');

            if (updateInfo && updateInfo.version && updateInfo.version !== APP_VERSION) {
                setIsUpdateAvailable(true);
                setLatestVersion(updateInfo.version);
                setUpdateUrl(updateInfo.url);
            }
        } catch (error) {
            console.warn("Lỗi tải dữ liệu hoặc mất mạng, đang sử dụng dữ liệu đệm từ IndexedDB:", error);
            setConnectionStatus('offline');
            
            // Đảm bảo dữ liệu luôn sẵn sàng từ IndexedDB / Defaults
            getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS).then(idbRecords => {
                if (Array.isArray(idbRecords) && idbRecords.length > 0) {
                    const { migratedRecords } = migrateUnbatchedRecords(deduplicateRecords(idbRecords));
                    setRecords(prev => prev.length > 0 ? prev : migratedRecords);
                }
            }).catch(() => {});
            setEmployees((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES));
            setUsers((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.USERS, MOCK_USERS));
            setHolidays((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.HOLIDAYS, []));
        }
    }, []);

    // Khởi tạo ngầm từ IndexedDB khi mở app để đảm bảo đầy đủ bản ghi offline
    useEffect(() => {
        getIndexedDBItem<RecordFile[]>(CACHE_KEYS.RECORDS).then(idbRecords => {
            if (Array.isArray(idbRecords) && idbRecords.length > 0) {
                setRecords(prev => {
                    if (prev.length < idbRecords.length) {
                        const { migratedRecords } = migrateUnbatchedRecords(deduplicateRecords(idbRecords));
                        return migratedRecords;
                    }
                    return prev;
                });
            }
        }).catch(() => {});
    }, []);

    // Lắng nghe sự kiện khôi phục kết nối từ connectionManager để reload data ngầm
    useEffect(() => {
        const unsubscribe = connectionManager.subscribe((state) => {
            setConnectionStatus(state.isOnline ? 'connected' : 'offline');
        });

        const handleRestored = () => {
            console.log("🔄 Phát hiện mạng đã kết nối lại, đang tự động đồng bộ dữ liệu...");
            loadData();
        };

        window.addEventListener('app_connection_restored', handleRestored);
        return () => {
            unsubscribe();
            window.removeEventListener('app_connection_restored', handleRestored);
        };
    }, [loadData]);

    // Initial Load & Fallback Auto-polling (Realtime handles instant updates)
    useEffect(() => {
        loadData();
        const intervalId = setInterval(() => {
            fetchRecords().then(recData => {
                if (recData && Array.isArray(recData)) {
                    const { migratedRecords } = migrateUnbatchedRecords(deduplicateRecords(recData));
                    setRecords(prev => {
                        // Prevent unnecessary re-renders if data has not changed
                        if (prev.length === migratedRecords.length) {
                            const isSame = prev.every((r, idx) => {
                                const m = migratedRecords[idx];
                                return m && r.id === m.id && r.status === m.status && r.assignedTo === m.assignedTo && r.deadline === m.deadline;
                            });
                            if (isSame) return prev;
                        }
                        return migratedRecords;
                    });
                }
            }).catch(err => {
                console.error("Background sync poll error:", err);
            });
        }, 60000); // 60s fallback sync
        return () => clearInterval(intervalId);
    }, [loadData]);

    // Lắng nghe thay đổi Realtime từ bảng land_records
    useEffect(() => {
        if (!supabase) return;

        const landRecordsChannel = supabase.channel('land_records_changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'land_records' },
                (payload) => {
                    setRecords(prev => {
                        if (prev.some(r => r.id === payload.new.id)) return prev;
                        return [mapRecordFromDb(payload.new) as RecordFile, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'land_records' },
                (payload) => {
                    setRecords(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...mapRecordFromDb(payload.new) } as RecordFile : r));
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'land_records' },
                (payload) => {
                    setRecords(prev => prev.filter(r => r.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(landRecordsChannel);
        };
    }, []);

    // Lắng nghe phiên bản mới từ Supabase Realtime & BroadcastChannel
    useEffect(() => {
        const checkUpdateStatus = async () => {
            try {
                const updateInfo = await fetchUpdateInfo();
                if (updateInfo && updateInfo.version && updateInfo.version !== APP_VERSION) {
                    setIsUpdateAvailable(true);
                    setLatestVersion(updateInfo.version);
                    setUpdateUrl(updateInfo.url);
                } else {
                    setIsUpdateAvailable(false);
                }
            } catch (e) {
                console.warn("Check update status error:", e);
            }
        };

        // Chạy ngay lập tức khi ứng dụng vừa mở
        checkUpdateStatus();

        // Lắng nghe sự kiện phát hành phiên bản ngay trên cùng window/tab
        const handleCustomPublished = (e: any) => {
            const ver = e.detail?.version;
            const url = e.detail?.url;
            if (ver && ver !== APP_VERSION) {
                setIsUpdateAvailable(true);
                setLatestVersion(ver);
                if (url) setUpdateUrl(url);
            } else {
                checkUpdateStatus();
            }
        };
        window.addEventListener('app_version_published', handleCustomPublished);

        let settingsChannel: any = null;
        if (supabase) {
            settingsChannel = supabase.channel('system_settings_version_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'system_settings' },
                    () => {
                        checkUpdateStatus();
                    }
                )
                .subscribe();
        }

        // BroadcastChannel cho kết nối liên tab / liên cửa sổ
        let bc: BroadcastChannel | null = null;
        if (typeof BroadcastChannel !== 'undefined') {
            bc = new BroadcastChannel('app_version_channel');
            bc.onmessage = (event) => {
                if (event.data?.type === 'VERSION_PUBLISHED') {
                    if (event.data.version && event.data.version !== APP_VERSION) {
                        setIsUpdateAvailable(true);
                        setLatestVersion(event.data.version);
                        if (event.data.url) setUpdateUrl(event.data.url);
                    } else {
                        checkUpdateStatus();
                    }
                }
            };
        }

        // Tự động kiểm tra định kỳ mỗi 3 phút + khi chuyển cửa sổ (focus)
        const intervalId = setInterval(checkUpdateStatus, 180000);
        const handleFocus = () => checkUpdateStatus();
        window.addEventListener('focus', handleFocus);

        return () => {
            if (supabase && settingsChannel) supabase.removeChannel(settingsChannel);
            if (bc) bc.close();
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('app_version_published', handleCustomPublished);
        };
    }, []);

    // --- Record Handlers ---
    const handleAddOrUpdateRecord = async (recordData: any): Promise<RecordFile | null> => {
        const isEdit = recordData.id && records.find(r => r.id === recordData.id);
        if (isEdit) {
            const updated = await updateRecordApi(recordData);
            if (updated) {
                setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
                return updated;
            }
        } else {
            const newRecord = await createRecordApi({ ...recordData, id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9) });
            if (newRecord) {
                setRecords(prev => [newRecord, ...prev.filter(r => r.id !== newRecord.id)]);
                return newRecord;
            }
        }
        return null;
    };

    const handleDeleteRecord = async (id: string) => {
        const success = await deleteRecordApi(id);
        if (success) {
            setRecords(prev => prev.filter(r => r.id !== id));
        }
        return success;
    };

    const handleImportRecords = async (newRecords: RecordFile[], onProgress?: (processed: number, total: number) => void) => {
        let success = true;

        if (newRecords.length > 0) {
            const landSuccess = await createRecordsBatchApi(newRecords, onProgress);
            if (!landSuccess) success = false;
        }

        if (success) {
            await loadData();
            return true;
        }
        return false;
    };

    const handleBatchUpdate = async (updatedRecords: RecordFile[]) => {
        // Optimistic update
        const updatedIds = updatedRecords.map(r => r.id);
        setRecords(prev => prev.map(r => {
            const found = updatedRecords.find(u => u.id === r.id);
            return found ? found : r;
        }));
    };

    // --- Employee Handlers ---
    const handleSaveEmployee = async (emp: Employee) => {
        const exists = employees.find(e => e.id === emp.id);
        const savedEmp = await saveEmployeeApi(emp, !!exists);
        if (savedEmp) {
            if (exists) setEmployees(prev => prev.map(e => e.id === savedEmp.id ? savedEmp : e));
            else setEmployees(prev => [...prev, savedEmp]);
        }
    };

    const handleDeleteEmployee = async (id: string) => {
        const success = await deleteEmployeeApi(id);
        if (success) setEmployees(prev => prev.filter(e => e.id !== id));
    };

    // --- User Handlers ---
    const handleUpdateUser = async (u: User, isUpdate: boolean) => {
        const res = await saveUserApi(u, isUpdate);
        if (res) {
            if (isUpdate) setUsers(prev => prev.map(x => x.username === u.username ? res : x));
            else setUsers(prev => [...prev, res]);
        }
        return res;
    };

    const handleDeleteUser = async (username: string) => {
        const success = await deleteUserApi(username);
        if (success) setUsers(prev => prev.filter(u => u.username !== username));
    };

    // --- System Handlers ---
    const handleDeleteAllData = async () => {
        const success = await deleteAllDataApi();
        if (success) {
            setRecords([]);
            return true;
        }
        return false;
    };

    return {
        records, employees, users, wards, holidays, rolePermissions, departmentPermissions, connectionStatus,
        isUpdateAvailable, latestVersion, updateUrl,
        setWards, setEmployees, setUsers, setRecords,
        loadData,
        handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords, handleBatchUpdate,
        handleSaveEmployee, handleDeleteEmployee,
        handleUpdateUser, handleDeleteUser,
        handleDeleteAllData
    };
};
