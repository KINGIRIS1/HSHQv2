
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
            // 1. Thử kết nối Server nội bộ (LAN Server / Express API) TRƯỚC TIÊN vì chạy rất nhanh trên mạng nội bộ
            try {
                const [recRes, empRes, userRes, holRes] = await Promise.all([
                    fetch('/records', { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null).catch(() => null),
                    fetch('/employees', { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null).catch(() => null),
                    fetch('/users', { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null).catch(() => null),
                    fetch('/holidays', { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null).catch(() => null),
                ]);

                if (recRes !== null || empRes !== null || userRes !== null) {
                    console.log("✅ Kết nối thành công tới Server nội bộ (LAN Server)!");
                    const rawRecs = Array.isArray(recRes) ? recRes : (recRes?.records || []);
                    const { migratedRecords } = migrateUnbatchedRecords(rawRecs);
                    setRecords(migratedRecords);
                    if (Array.isArray(empRes)) setEmployees(empRes);
                    else if (empRes?.employees && Array.isArray(empRes.employees)) setEmployees(empRes.employees);
                    
                    if (Array.isArray(userRes)) setUsers(userRes);
                    else if (userRes?.users && Array.isArray(userRes.users)) setUsers(userRes.users);

                    if (Array.isArray(holRes)) setHolidays(holRes);
                    else if (holRes?.holidays && Array.isArray(holRes.holidays)) setHolidays(holRes.holidays);

                    setConnectionStatus('connected');
                    return;
                }
            } catch (localErr) {
                console.log("Server nội bộ không phản hồi, chuyển sang thử kết nối Supabase Cloud...", localErr);
            }

            // 2. Nếu không có Server nội bộ, thử kết nối Supabase Cloud (với timeout 8s)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout Supabase")), 8000)
            );

            const dataPromise = Promise.all([
                fetchRecords(),
                fetchEmployees(),
                fetchUsers(),
                fetchUpdateInfo(),
                fetchHolidays(), // Tải thêm danh sách ngày nghỉ
                getSystemSetting('role_permissions'),
                getSystemSetting('department_permissions')
            ]);

            // Race giữa fetch data và timeout
            const [recData, empData, userData, updateInfo, holidayData, permsData, deptPermsData] = await Promise.race([dataPromise, timeoutPromise]) as any;

            const rawRecList = Array.isArray(recData) ? recData : [];
            const { migratedRecords } = migrateUnbatchedRecords(rawRecList);
            setRecords(migratedRecords);

            setEmployees(empData);
            setUsers(userData);
            setHolidays(holidayData); // Cập nhật state holidays
            if (permsData) {
                try {
                    const parsed = JSON.parse(permsData);
                    const sanitized: RolePermissions = {};
                    Object.keys(parsed).forEach(roleKey => {
                        sanitized[roleKey] = (parsed[roleKey] || []).filter((p: string) => p !== 'CHECK_RECORDS' && p !== 'BTN_CLOSE_BATCH');
                    });
                    setRolePermissions(sanitized);
                } catch (e) {
                    console.error("Failed to parse role_permissions", e);
                }
            }
            if (deptPermsData) {
                try {
                    const parsedDept = JSON.parse(deptPermsData);
                    Object.keys(parsedDept).forEach(key => {
                        if (Array.isArray(parsedDept[key])) {
                            parsedDept[key] = parsedDept[key].filter((p: string) => p !== 'CHECK_RECORDS' && p !== 'BTN_CLOSE_BATCH');
                        }
                    });
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
            console.warn("Không thể kết nối Server nội bộ lẫn Supabase, chuyển sang chế độ Offline/Cache mượt mà:", error);
            setConnectionStatus('offline');
            
            // Đọc ngay lập tức dữ liệu từ Cache để người dùng tiếp tục làm việc bình thường không bị gián đoạn
            const cachedRecords = getFromCache(CACHE_KEYS.RECORDS, []);
            const cachedEmployees = getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
            const cachedUsers = getFromCache(CACHE_KEYS.USERS, MOCK_USERS);
            const cachedHolidays = getFromCache(CACHE_KEYS.HOLIDAYS, []);

            if (cachedRecords.length > 0) {
                const { migratedRecords } = migrateUnbatchedRecords(cachedRecords);
                setRecords(migratedRecords);
            }
            if (cachedEmployees.length > 0) setEmployees(cachedEmployees);
            if (cachedUsers.length > 0) setUsers(cachedUsers);
            if (cachedHolidays.length > 0) setHolidays(cachedHolidays);
        }
    }, []);

    // Initial Load & Fallback Auto-polling (Realtime handles instant updates)
    useEffect(() => {
        loadData();
        const intervalId = setInterval(() => {
            fetchRecords().then(recData => {
                if (recData && Array.isArray(recData)) {
                    const { migratedRecords } = migrateUnbatchedRecords(recData);
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
