
import { supabase, isConfigured } from './supabaseClient';
import { Employee, User } from '../types';
import { MOCK_EMPLOYEES, MOCK_USERS, DEPARTMENTS, POSITIONS } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, mapEmployeeFromDb, mapEmployeeToDb, mapUserFromDb, mapUserToDb, normalizeDepartment, normalizePosition } from './apiCore';
import { getSystemSetting, saveSystemSetting } from './apiSystem';

// --- EMPLOYEES ---

/**
 * Tải trực tiếp danh sách nhân viên thô từ CSDL (bảng employees & system_settings)
 * Hợp nhất thông minh giữa CSDL Cloud và Cấu hình Nhân sự nâng cao
 */
export const fetchRawEmployeesOnly = async (): Promise<Employee[]> => {
    const empMap = new Map<string, Employee>();

    if (isConfigured && supabase) {
        // 1. Tải từ bảng employees trên Supabase Cloud
        try {
            const { data, error } = await supabase.from('employees').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(item => {
                    const emp = mapEmployeeFromDb(item);
                    if (emp.id) {
                        empMap.set(emp.id.trim().toLowerCase(), emp);
                    }
                });
            }
        } catch (e) {
            console.warn("Lỗi fetch bảng employees:", e);
        }

        // 2. Tải từ system_settings (key: employees_config) để hợp nhất thông tin phong phú hơn
        try {
            const configVal = await getSystemSetting('employees_config');
            if (configVal) {
                const parsed = JSON.parse(configVal);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach(e => {
                        const mapped = mapEmployeeFromDb(e);
                        if (mapped.id) {
                            const key = mapped.id.trim().toLowerCase();
                            const existing = empMap.get(key);
                            if (!existing) {
                                empMap.set(key, mapped);
                            } else {
                                // Ưu tiên giữ thông tin đã được cấu hình chi tiết (Tổ, Chức vụ, Xã phụ trách)
                                const hasDeptConfig = mapped.department && DEPARTMENTS.includes(mapped.department as any);
                                const hasPosConfig = mapped.position && POSITIONS.includes(mapped.position as any);
                                const hasWardsConfig = Array.isArray(mapped.managedWards) && mapped.managedWards.length > 0;

                                empMap.set(key, {
                                    id: existing.id,
                                    name: (existing.name && existing.name !== existing.id) ? existing.name : (mapped.name || existing.name),
                                    department: hasDeptConfig ? mapped.department : existing.department,
                                    position: hasPosConfig ? mapped.position : existing.position,
                                    managedWards: hasWardsConfig ? mapped.managedWards : existing.managedWards
                                });
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Lỗi fetch system_settings employees_config:", e);
        }
    }

    return Array.from(empMap.values());
};

export const fetchEmployees = async (): Promise<Employee[]> => {
    let cloudEmps = await fetchRawEmployeesOnly();

    if (isConfigured && supabase) {
        // Tự động bổ sung từ bảng users trên DB trực tiếp (TRUY VẤN TRỰC TIẾP bảng users, KHÔNG gọi fetchUsersDirectFromDb để tránh đệ quy)
        try {
            const { data, error } = await supabase.from('users').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(u => {
                    const mappedUser = mapUserFromDb(u);
                    const empId = (mappedUser.employeeId || mappedUser.username || '').trim();
                    const empName = (mappedUser.name || mappedUser.username || '').trim();
                    if (empId && empName && empName.toLowerCase() !== empId.toLowerCase()) {
                        const exists = cloudEmps.some(e => 
                            (e.id || '').trim().toLowerCase() === empId.toLowerCase() || 
                            (e.name || '').trim().toLowerCase() === empName.toLowerCase()
                        );
                        if (!exists) {
                            const userRoleStr = String(mappedUser.role).toUpperCase();
                            let defaultDept = 'Tổ Hành chính';
                            if (userRoleStr === 'SURVEYOR' || userRoleStr === 'STAFF') defaultDept = 'Tổ Đo đạc';
                            else if (userRoleStr === 'ARCHIVE_STAFF') defaultDept = 'Tổ Lưu trữ';
                            else if (userRoleStr === 'SUBADMIN' || userRoleStr === 'ADMIN') defaultDept = 'Ban Giám đốc';

                            cloudEmps.push({
                                id: empId,
                                name: empName,
                                department: normalizeDepartment(defaultDept),
                                position: normalizePosition(userRoleStr === 'SUBADMIN' || userRoleStr === 'ADMIN' ? 'Tổ Trưởng' : 'Nhân viên'),
                                managedWards: []
                            });
                        }
                    }
                });
            }
        } catch (e) {
            console.warn("Lỗi tự động tổng hợp danh sách nhân viên từ danh sách Users:", e);
        }
    }

    if (cloudEmps.length > 0) {
        saveToCache(CACHE_KEYS.EMPLOYEES, cloudEmps);
        return cloudEmps;
    }

    const cached = getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    return cached && cached.length > 0 ? cached : MOCK_EMPLOYEES;
};

export const syncEmployeesToCloudConfig = async (employeesList: Employee[]) => {
    try {
        await saveSystemSetting('employees_config', JSON.stringify(employeesList));
    } catch (e) {
        console.warn("Lỗi đồng bộ employees_config lên system_settings:", e);
    }
};

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean): Promise<Employee | null> => {
    if (!isConfigured) return employee;
    try {
        const payload = mapEmployeeToDb(employee);
        let resultEmp = employee;
        if (isUpdate) {
            const { data, error } = await supabase.from('employees').update(payload).eq('id', employee.id).select();
            if (!error && data?.[0]) resultEmp = mapEmployeeFromDb(data[0]);
        } else {
            const { data, error } = await supabase.from('employees').insert([payload]).select();
            if (!error && data?.[0]) resultEmp = mapEmployeeFromDb(data[0]);
        }

        // Luôn đồng bộ cập nhật vào system_settings 'employees_config' để đồng bộ 100% trên thiết bị/trình duyệt mới
        try {
            const currentCloudList = await fetchRawEmployeesOnly();
            const existingIdx = currentCloudList.findIndex(e => (e.id || '').toLowerCase() === (employee.id || '').toLowerCase());
            if (existingIdx >= 0) {
                currentCloudList[existingIdx] = resultEmp;
            } else {
                currentCloudList.push(resultEmp);
            }
            await syncEmployeesToCloudConfig(currentCloudList);
            saveToCache(CACHE_KEYS.EMPLOYEES, currentCloudList);
        } catch (syncErr) {
            console.warn("Lỗi đồng bộ kép employees_config:", syncErr);
        }

        return resultEmp;
    } catch (error) {
        logError("saveEmployeeApi", error, true);
        return employee;
    }
};

export const deleteEmployeeApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('employees').delete().eq('id', id);
        const currentCloudList = await fetchRawEmployeesOnly();
        const filtered = currentCloudList.filter(e => (e.id || '').toLowerCase() !== id.toLowerCase());
        await syncEmployeesToCloudConfig(filtered);
        saveToCache(CACHE_KEYS.EMPLOYEES, filtered);
        return true;
    } catch (error) {
        logError("deleteEmployeeApi", error, true);
        return true;
    }
};

// --- USERS ENRICHMENT HELPERS ---

/**
 * Tự động đồng bộ và bổ sung Họ tên nhân viên chính xác cho User từ bảng employees
 * Quy tắc:
 * 1. Nếu User có employeeId -> Tìm employee theo employeeId.
 * 2. Nếu User không có employeeId nhưng username trùng với employee.id -> Gán employeeId = employee.id.
 * 3. Nếu tìm thấy employee:
 *    - Nếu user.name bị trống, null, trùng với username, hoặc trùng với employeeId:
 *      Gán user.name = employee.name.
 *    - Nếu employee.name có giá trị hợp lệ và khác user.name (khi user.name chỉ là mã nhân viên):
 *      Ưu tiên gán user.name = employee.name để đảm bảo hiển thị đúng Họ tên.
 */
export const enrichUserWithEmployees = async (user: User, existingEmployees?: Employee[]): Promise<User> => {
    if (!user) return user;

    let employeesList = existingEmployees;
    if (!employeesList || employeesList.length === 0) {
        try {
            employeesList = await fetchRawEmployeesOnly();
            if (!employeesList || employeesList.length === 0) {
                employeesList = getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
            }
        } catch (e) {
            console.warn("Lỗi fetchRawEmployeesOnly khi enrich user:", e);
            employeesList = [];
        }
    }

    const cleanEmpId = (user.employeeId || '').trim().toLowerCase();
    const cleanUsername = (user.username || '').trim().toLowerCase();

    // 1. Tìm theo employeeId
    let matchedEmp = employeesList.find(e => (e.id || '').trim().toLowerCase() === cleanEmpId && cleanEmpId !== '');

    // 2. Nếu chưa thấy, thử tìm theo username = employee.id
    if (!matchedEmp && cleanUsername) {
        matchedEmp = employeesList.find(e => (e.id || '').trim().toLowerCase() === cleanUsername);
    }

    // 3. Nếu vẫn chưa thấy trong danh sách bộ nhớ (máy mới / trình duyệt mới), truy vấn TRỰC TIẾP từ Supabase Cloud
    if (!matchedEmp && isConfigured && supabase) {
        const targetKey = (user.employeeId || user.username || '').trim();
        if (targetKey) {
            try {
                const { data, error } = await supabase
                    .from('employees')
                    .select('*')
                    .or(`id.ilike.${targetKey},ma_nv.ilike.${targetKey},employee_id.ilike.${targetKey},code.ilike.${targetKey}`);
                if (!error && Array.isArray(data) && data.length > 0) {
                    matchedEmp = mapEmployeeFromDb(data[0]);
                }
            } catch (e) {
                console.warn("Lỗi truy vấn nhân viên trực tiếp từ CSDL Cloud:", e);
            }
        }
    }

    if (matchedEmp && matchedEmp.name) {
        const officialEmpName = matchedEmp.name.trim();
        const currentUserName = (user.name || '').trim();

        const isNameEmptyOrCode = !currentUserName || 
            currentUserName.toLowerCase() === cleanEmpId || 
            currentUserName.toLowerCase() === cleanUsername;

        if (isNameEmptyOrCode || currentUserName !== officialEmpName) {
            return {
                ...user,
                employeeId: matchedEmp.id || user.employeeId,
                name: officialEmpName
            };
        }
    }

    return user;
};

export const enrichUsersList = async (usersList: User[], existingEmployees?: Employee[]): Promise<User[]> => {
    if (!Array.isArray(usersList) || usersList.length === 0) return usersList;

    let employeesList = existingEmployees;
    if (!employeesList || employeesList.length === 0) {
        try {
            employeesList = await fetchRawEmployeesOnly();
            if (!employeesList || employeesList.length === 0) {
                employeesList = getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
            }
        } catch (e) {
            employeesList = [];
        }
    }

    const empMap = new Map<string, Employee>();
    employeesList.forEach(e => {
        if (e.id) empMap.set(e.id.trim().toLowerCase(), e);
    });

    return usersList.map(u => {
        const cleanEmpId = (u.employeeId || '').trim().toLowerCase();
        const cleanUsername = (u.username || '').trim().toLowerCase();

        let matchedEmp = empMap.get(cleanEmpId);
        if (!matchedEmp && cleanUsername) {
            matchedEmp = empMap.get(cleanUsername);
        }

        if (matchedEmp && matchedEmp.name) {
            const officialName = matchedEmp.name.trim();
            const currentUserName = (u.name || '').trim();

            const isNameEmptyOrCode = !currentUserName || 
                currentUserName.toLowerCase() === cleanEmpId || 
                currentUserName.toLowerCase() === cleanUsername;

            if (isNameEmptyOrCode || currentUserName !== officialName) {
                return {
                    ...u,
                    employeeId: matchedEmp.id,
                    name: officialName
                };
            }
        }
        return u;
    });
};

// --- USERS ---

/**
 * Đồng bộ danh sách tài khoản kép vào system_settings ('users_config') để đảm bảo đồng bộ 100% trên mọi thiết bị và trình duyệt
 */
const syncUsersToCloudConfig = async (usersList: User[]) => {
    try {
        await saveSystemSetting('users_config', JSON.stringify(usersList));
    } catch (e) {
        console.warn("Lỗi đồng bộ users_config lên system_settings:", e);
    }
};

/**
 * Đọc và hợp nhất toàn bộ tài khoản từ:
 * 1. Bảng system_settings (key: users_config)
 * 2. Bảng users chuyên dụng trên Supabase
 * 3. LocalStorage cache
 * 4. MOCK_USERS mặc định
 */
export const fetchUsersDirectFromDb = async (): Promise<User[]> => {
    let cloudMap = new Map<string, User>();

    if (!isConfigured || !supabase) {
        const cached = getFromCache<User[]>(CACHE_KEYS.USERS, MOCK_USERS);
        const fallbackUsers = cached && cached.length > 0 ? cached : MOCK_USERS;
        return enrichUsersList(fallbackUsers);
    }

    try {
        // 1. Đọc từ bảng users trên Supabase (Thẩm quyền cao nhất)
        try {
            const { data, error } = await supabase.from('users').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(u => {
                    const mapped = mapUserFromDb(u);
                    if (mapped.username) {
                        cloudMap.set(mapped.username.normalize('NFC').trim().toLowerCase(), mapped);
                    }
                });
            }
        } catch (e) {
            console.warn("Direct fetch table users error:", e);
        }

        // 2. Đọc từ system_settings ('users_config') CHỈ để bổ sung tài khoản chưa có trong bảng users
        try {
            const configVal = await getSystemSetting('users_config');
            if (configVal) {
                const parsed = JSON.parse(configVal);
                if (Array.isArray(parsed)) {
                    parsed.forEach(u => {
                        const mapped = mapUserFromDb(u);
                        if (mapped.username) {
                            const key = mapped.username.normalize('NFC').trim().toLowerCase();
                            // BẢNG USERS CÓ THẨM QUYỀN CAO NHẤT, chỉ thêm từ users_config nếu chưa có trong users table
                            if (!cloudMap.has(key)) {
                                cloudMap.set(key, mapped);
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Direct fetch system_settings error:", e);
        }

        // 3. Nạp thêm MOCK_USERS mặc định nếu chưa có trong DB (đảm bảo admin luôn có sẵn)
        MOCK_USERS.forEach(m => {
            const key = m.username.normalize('NFC').trim().toLowerCase();
            if (!cloudMap.has(key)) {
                cloudMap.set(key, mapUserFromDb(m));
            }
        });

        const rawResult = Array.from(cloudMap.values());
        const enrichedResult = await enrichUsersList(rawResult);
        saveToCache(CACHE_KEYS.USERS, enrichedResult);
        return enrichedResult;
    } catch (err) {
        console.warn("fetchUsersDirectFromDb exception:", err);
        const cached = getFromCache<User[]>(CACHE_KEYS.USERS, MOCK_USERS);
        const fallbackUsers = cached && cached.length > 0 ? cached : MOCK_USERS;
        return enrichUsersList(fallbackUsers);
    }
};

export const fetchUsers = async (): Promise<User[]> => {
    return fetchUsersDirectFromDb();
};

/**
 * Tìm kiếm tài khoản cụ thể trực tiếp trên Supabase (Ưu tiên bảng users)
 */
export const findUserInDbDirectly = async (usernameInput: string): Promise<User | null> => {
    const cleanU = (usernameInput || '').normalize('NFC').trim().toLowerCase();
    if (!cleanU) return null;

    // 1. Tìm trực tiếp trong bảng users trên Supabase
    if (isConfigured && supabase) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .ilike('username', cleanU);
            if (!error && Array.isArray(data) && data.length > 0) {
                const mappedUser = mapUserFromDb(data[0]);
                return await enrichUserWithEmployees(mappedUser);
            }
        } catch (e) {
            console.warn("findUserInDbDirectly direct query error:", e);
        }
    }

    // 2. Tìm trong danh sách hợp nhất từ Cloud
    const allUsers = await fetchUsersDirectFromDb();
    const matched = allUsers.find(u => u.username.normalize('NFC').trim().toLowerCase() === cleanU);
    if (matched) {
        return await enrichUserWithEmployees(matched);
    }

    return null;
};

export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    let savedUser = { ...user };

    if (isConfigured && supabase) {
        try {
            const payloadsToTry = [
                {
                    username: user.username,
                    password: user.password,
                    name: user.name,
                    role: user.role,
                    employee_id: user.employeeId || null,
                    active: user.active !== undefined ? user.active : true
                },
                {
                    username: user.username,
                    password: user.password,
                    name: user.name,
                    role: user.role,
                    employeeId: user.employeeId || null,
                    active: user.active !== undefined ? user.active : true
                },
                {
                    username: user.username,
                    password: user.password,
                    name: user.name,
                    role: user.role,
                    active: user.active !== undefined ? user.active : true
                },
                {
                    username: user.username,
                    password: user.password,
                    name: user.name,
                    role: user.role
                }
            ];

            let dbSuccess = false;
            for (const payload of payloadsToTry) {
                if (dbSuccess) break;
                try {
                    if (isUpdate) {
                        let query = supabase.from('users').update(payload);
                        if (user.id) {
                            query = query.eq('id', user.id);
                        } else {
                            query = query.ilike('username', user.username);
                        }
                        const { data, error } = await query.select();
                        if (!error) {
                            if (Array.isArray(data) && data.length > 0) {
                                savedUser = mapUserFromDb(data[0]);
                                dbSuccess = true;
                            } else {
                                const insertRes = await supabase.from('users').insert([payload]).select();
                                if (!insertRes.error && Array.isArray(insertRes.data) && insertRes.data.length > 0) {
                                    savedUser = mapUserFromDb(insertRes.data[0]);
                                    dbSuccess = true;
                                }
                            }
                        }
                    } else {
                        const { data, error } = await supabase.from('users').insert([payload]).select();
                        if (!error && Array.isArray(data) && data.length > 0) {
                            savedUser = mapUserFromDb(data[0]);
                            dbSuccess = true;
                        }
                    }
                } catch (e) {
                    console.warn("Thử payload lưu bảng users không thành công, đang thử phương án tiếp theo:", e);
                }
            }
        } catch (error) {
            logError("saveUserApi table users", error, true);
        }
    }

    try {
        const currentList = await fetchUsersDirectFromDb();
        const normalizedTarget = savedUser.username.normalize('NFC').trim().toLowerCase();
        let updatedList: User[] = [];

        const exists = currentList.some(u => u.username.normalize('NFC').trim().toLowerCase() === normalizedTarget);
        if (exists) {
            updatedList = currentList.map(u => 
                u.username.normalize('NFC').trim().toLowerCase() === normalizedTarget ? savedUser : u
            );
        } else {
            updatedList = [...currentList, savedUser];
        }

        saveToCache(CACHE_KEYS.USERS, updatedList);
        if (isConfigured) {
            await syncUsersToCloudConfig(updatedList);
        }
    } catch (syncErr) {
        console.warn("Lỗi lưu dự phòng users_config:", syncErr);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('users_updated'));
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('app_users_channel');
                bc.postMessage({ type: 'USERS_UPDATED' });
                bc.close();
            } catch (e) {}
        }
    }

    return savedUser;
};

export interface CloudAuthResult {
    status: 'SUCCESS' | 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'NETWORK_ERROR' | 'DB_ERROR';
    user?: User;
    message?: string;
    errorDetails?: any;
}

export const authenticateUserCloud = async (usernameInput: string, passwordInput: string): Promise<CloudAuthResult> => {
    if (!isConfigured || !supabase) {
        return {
            status: 'NETWORK_ERROR',
            message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
        };
    }

    const cleanU = usernameInput.normalize('NFC').trim().toLowerCase();
    const cleanP = passwordInput.normalize('NFC').trim();

    if (!cleanU || !cleanP) {
        return {
            status: 'INVALID_CREDENTIALS',
            message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.'
        };
    }

    const cloudUsers = await fetchUsersDirectFromDb();
    const targetUser = cloudUsers.find(u => u.username.normalize('NFC').trim().toLowerCase() === cleanU);

    if (!targetUser) {
        return {
            status: 'INVALID_CREDENTIALS',
            message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        };
    }

    const dbPassword = (targetUser.password || '').normalize('NFC').trim();
    if (dbPassword !== cleanP) {
        return {
            status: 'INVALID_CREDENTIALS',
            message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        };
    }

    if (targetUser.active === false) {
        return {
            status: 'ACCOUNT_DISABLED',
            message: 'Tài khoản đã bị vô hiệu hóa hoặc bị khóa. Vui lòng liên hệ quản trị viên.'
        };
    }

    const finalUser = await enrichUserWithEmployees(targetUser);

    return {
        status: 'SUCCESS',
        user: finalUser
    };
};

export const deleteUserApi = async (username: string): Promise<boolean> => {
    let success = true;
    const cleanU = username.normalize('NFC').trim().toLowerCase();

    if (isConfigured) {
        try {
            const { error } = await supabase.from('users').delete().eq('username', username);
            if (error) console.warn("deleteUserApi table users error:", error);
        } catch (error) {
            logError("deleteUserApi", error, true);
        }
    }

    try {
        const currentList = await fetchUsers();
        const updatedList = currentList.filter(u => u.username.normalize('NFC').trim().toLowerCase() !== cleanU);
        saveToCache(CACHE_KEYS.USERS, updatedList);
        if (isConfigured) {
            await syncUsersToCloudConfig(updatedList);
        }
    } catch (syncErr) {
        console.warn("Lỗi xóa dự phòng users_config:", syncErr);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('users_updated'));
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('app_users_channel');
                bc.postMessage({ type: 'USERS_UPDATED' });
                bc.close();
            } catch (e) {}
        }
    }

    return success;
};
