
import { useState, useEffect, useCallback } from 'react';
import { RecordFile, Employee, User, UserRole, RecordStatus, Holiday, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { fetchRecords, fetchEmployees, fetchUsers, fetchUpdateInfo, fetchHolidays,
    createRecordApi, updateRecordApi, deleteRecordApi, createRecordsBatchApi,
    saveEmployeeApi, deleteEmployeeApi, saveUserApi, deleteUserApi, deleteAllDataApi, getSystemSetting
} from '../services/api';
import { supabase } from '../services/supabaseClient';
import { mapRecordFromDb, getFromCache, CACHE_KEYS } from '../services/apiCore';
import { DEFAULT_WARDS as STATIC_WARDS, APP_VERSION, MOCK_EMPLOYEES, MOCK_USERS } from '../constants';
import { migrateUnbatchedRecords } from '../utils/appHelpers';

export const useAppData = (currentUser: User | null) => {
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]); // State mới cho ngày nghỉ
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
            const safeFetch = async <T>(fn: () => Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
                try {
                    let timer: any;
                    const timeoutPromise = new Promise<T>((resolve) => {
                        timer = setTimeout(() => {
                            console.warn(`Request timed out after ${timeoutMs}ms, using fallback.`);
                            resolve(fallback);
                        }, timeoutMs);
                    });
                    const res = await Promise.race([fn(), timeoutPromise]);
                    clearTimeout(timer);
                    return res ?? fallback;
                } catch {
                    return fallback;
                }
            };

            const [recData, empData, userData, updateInfo, holidayData, permsData, deptPermsData] = await Promise.all([
                safeFetch(() => fetchRecords(), 12000, getFromCache(CACHE_KEYS.RECORDS, [])),
                safeFetch(() => fetchEmployees(), 10000, getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES)),
                safeFetch(() => fetchUsers(), 10000, getFromCache(CACHE_KEYS.USERS, MOCK_USERS)),
                safeFetch(() => fetchUpdateInfo(), 5000, null),
                safeFetch(() => fetchHolidays(), 5000, getFromCache(CACHE_KEYS.HOLIDAYS, [])),
                safeFetch(() => getSystemSetting('role_permissions'), 5000, null),
                safeFetch(() => getSystemSetting('department_permissions'), 5000, null)
            ]);

            const rawList = Array.isArray(recData) ? recData : [];
            const { migratedRecords } = migrateUnbatchedRecords(rawList);
            setRecords(migratedRecords.length > 0 ? migratedRecords : getFromCache(CACHE_KEYS.RECORDS, []));
            setEmployees(empData && empData.length > 0 ? empData : getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES));
            setUsers(userData && userData.length > 0 ? userData : getFromCache(CACHE_KEYS.USERS, MOCK_USERS));
            setHolidays(holidayData || []);

            if (permsData) {
                try {
                    const parsed = JSON.parse(permsData);
                    const defaultOneDoor = DEFAULT_ROLE_PERMISSIONS[UserRole.ONEDOOR] || [];
                    const existingOneDoor = parsed[UserRole.ONEDOOR] || [];
                    parsed[UserRole.ONEDOOR] = Array.from(new Set([...existingOneDoor, ...defaultOneDoor]));
                    setRolePermissions(parsed);
                } catch (e) {
                    console.warn("Failed to parse role_permissions", e);
                }
            }
            if (deptPermsData) {
                try {
                    const parsedDept = JSON.parse(deptPermsData);
                    Object.keys(parsedDept).forEach(key => {
                        if (key.endsWith(`_${UserRole.ONEDOOR}`)) {
                            const defaultOneDoor = DEFAULT_ROLE_PERMISSIONS[UserRole.ONEDOOR] || [];
                            parsedDept[key] = Array.from(new Set([...(parsedDept[key] || []), ...defaultOneDoor]));
                        }
                    });
                    setDepartmentPermissions(parsedDept);
                } catch (e) {
                    console.warn("Failed to parse department_permissions", e);
                }
            }
            setConnectionStatus('connected');

            if (updateInfo && updateInfo.version && updateInfo.version !== APP_VERSION) {
                setIsUpdateAvailable(true);
                setLatestVersion(updateInfo.version);
                setUpdateUrl(updateInfo.url);
            }
        } catch (error) {
            console.warn("Lỗi tải dữ liệu cloud, chuyển sang chế độ cache offline:", error);
            setConnectionStatus('offline');
            
            setRecords((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.RECORDS, []));
            setEmployees((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES));
            setUsers((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.USERS, MOCK_USERS));
            setHolidays((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.HOLIDAYS, []));
        }
    }, []);

    // Initial Load (NO POLLING)
    useEffect(() => {
        loadData();
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

        // Tự động kiểm tra định kỳ mỗi 5 giây + khi chuyển cửa sổ (focus)
        const intervalId = setInterval(checkUpdateStatus, 5000);
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
                setRecords(prev => [newRecord, ...prev]);
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
