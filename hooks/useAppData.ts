
import { useState, useEffect, useCallback } from 'react';
import { RecordFile, Employee, User, RecordStatus, Holiday, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { fetchRecords, fetchEmployees, fetchUsers, fetchUpdateInfo, fetchHolidays,
    createRecordApi, updateRecordApi, deleteRecordApi, createRecordsBatchApi,
    saveEmployeeApi, deleteEmployeeApi, saveUserApi, deleteUserApi, deleteAllDataApi, getSystemSetting
} from '../services/api';
import { supabase } from '../services/supabaseClient';
import { mapRecordFromDb } from '../services/apiCore';
import { DEFAULT_WARDS as STATIC_WARDS, APP_VERSION } from '../constants';

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
            // Tạo timeout promise để tránh việc fetch bị treo mãi mãi
            // Tăng timeout lên 30s để xử lý trường hợp mạng chậm hoặc DB bị sleep
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 30000)
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

            setRecords(recData);
            setEmployees(empData);
            setUsers(userData);
            setHolidays(holidayData); // Cập nhật state holidays
            if (permsData) {
                try {
                    setRolePermissions(JSON.parse(permsData));
                } catch (e) {
                    console.error("Failed to parse role_permissions", e);
                }
            }
            if (deptPermsData) {
                try {
                    setDepartmentPermissions(JSON.parse(deptPermsData));
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
            console.error("Lỗi tải dữ liệu hoặc Timeout:", error);
            // Quan trọng: Khi lỗi, chuyển sang OFFLINE nhưng vẫn cho phép App hoạt động
            setConnectionStatus('offline');
            
            // Nếu cache cũng rỗng (lần đầu chạy) hoặc bị timeout nên không nhận được data, 
            // ta sẽ chủ động đọc lại từ Cache để người dùng có thể Đăng nhập và làm việc.
            import('../services/apiCore').then(({ getFromCache, CACHE_KEYS }) => {
                import('../constants').then(({ MOCK_EMPLOYEES, MOCK_USERS }) => {
                    setRecords((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.RECORDS, []));
                    setEmployees((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES));
                    setUsers((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.USERS, MOCK_USERS));
                    setHolidays((prev) => prev.length > 0 ? prev : getFromCache(CACHE_KEYS.HOLIDAYS, []));
                });
            });
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
