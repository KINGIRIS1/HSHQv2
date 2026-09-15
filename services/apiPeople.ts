
import { supabase, isConfigured } from './supabaseClient';
import { Employee, User } from '../types';
import { MOCK_EMPLOYEES, MOCK_USERS } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, mapEmployeeFromDb, mapEmployeeToDb, mapUserFromDb, mapUserToDb } from './apiCore';
import { getSystemSetting, saveSystemSetting } from './apiSystem';

// --- EMPLOYEES ---
export const fetchEmployees = async (): Promise<Employee[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    try {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        if (Array.isArray(data) && data.length > 0) {
            const mapped = data.map(mapEmployeeFromDb);
            saveToCache(CACHE_KEYS.EMPLOYEES, mapped);
            return mapped;
        }
        const cached = getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
        return cached && cached.length > 0 ? cached : MOCK_EMPLOYEES;
    } catch (error) {
        logError("fetchEmployees", error, true);
        const cached = getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
        return cached && cached.length > 0 ? cached : MOCK_EMPLOYEES;
    }
};

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean): Promise<Employee | null> => {
    if (!isConfigured) return employee;
    try {
        const payload = mapEmployeeToDb(employee);
        if (isUpdate) {
            const { data, error } = await supabase.from('employees').update(payload).eq('id', employee.id).select();
            if (error) throw error;
            return data?.[0] ? mapEmployeeFromDb(data[0]) : employee;
        } else {
            const { data, error } = await supabase.from('employees').insert([payload]).select();
            if (error) throw error;
            return data?.[0] ? mapEmployeeFromDb(data[0]) : employee;
        }
    } catch (error) {
        logError("saveEmployeeApi", error, true);
        return employee;
    }
};

export const deleteEmployeeApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
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
            employeesList = await fetchEmployees();
        } catch (e) {
            console.warn("Lỗi fetchEmployees khi enrich user:", e);
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

    if (matchedEmp && matchedEmp.name) {
        const officialEmpName = matchedEmp.name.trim();
        const currentUserName = (user.name || '').trim();

        const isNameEmptyOrCode = !currentUserName || 
            currentUserName.toLowerCase() === cleanEmpId || 
            currentUserName.toLowerCase() === cleanUsername;

        if (isNameEmptyOrCode || currentUserName !== officialEmpName) {
            return {
                ...user,
                employeeId: matchedEmp.id,
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
            employeesList = await fetchEmployees();
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
