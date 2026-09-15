
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
export const fetchUsers = async (): Promise<User[]> => {
    const cachedLocal = getFromCache<User[]>(CACHE_KEYS.USERS, MOCK_USERS);
    let mergedUsersMap = new Map<string, User>();

    // Nạp MOCK_USERS & LocalCache trước
    MOCK_USERS.forEach(u => mergedUsersMap.set(u.username.toLowerCase(), mapUserFromDb(u)));
    if (Array.isArray(cachedLocal)) {
        cachedLocal.forEach(u => {
            const mapped = mapUserFromDb(u);
            if (mapped.username) mergedUsersMap.set(mapped.username.toLowerCase(), mapped);
        });
    }

    if (!isConfigured) {
        const result = Array.from(mergedUsersMap.values());
        saveToCache(CACHE_KEYS.USERS, result);
        return result;
    }

    try {
        // 1. Đọc từ system_settings (users_config)
        const configVal = await getSystemSetting('users_config');
        if (configVal) {
            try {
                const parsed = JSON.parse(configVal);
                if (Array.isArray(parsed)) {
                    parsed.forEach(u => {
                        const mapped = mapUserFromDb(u);
                        if (mapped.username) mergedUsersMap.set(mapped.username.toLowerCase(), mapped);
                    });
                }
            } catch (e) {
                console.warn("Parse users_config error:", e);
            }
        }

        // 2. Đọc từ bảng users trên Supabase
        try {
            const { data, error } = await supabase.from('users').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(u => {
                    const mapped = mapUserFromDb(u);
                    if (mapped.username) mergedUsersMap.set(mapped.username.toLowerCase(), mapped);
                });
            }
        } catch (dbErr) {
            console.warn("fetchUsers bảng users gặp thông báo (đã có users_config dự phòng):", dbErr);
        }

        const finalUsers = Array.from(mergedUsersMap.values());
        saveToCache(CACHE_KEYS.USERS, finalUsers);
        return finalUsers;
    } catch (error) {
        logError("fetchUsers", error, true);
        const fallback = Array.from(mergedUsersMap.values());
        return fallback.length > 0 ? fallback : MOCK_USERS;
    }
};

/**
 * Truy vấn danh sách tài khoản TRỰC TIẾP từ Supabase Cloud (bỏ qua cache, phục vụ đăng nhập trên máy mới)
 */
export const fetchUsersDirectFromDb = async (): Promise<User[]> => {
    let usersMap = new Map<string, User>();

    // Nạp MOCK_USERS làm mốc mặc định
    MOCK_USERS.forEach(u => usersMap.set(u.username.toLowerCase(), mapUserFromDb(u)));

    if (!isConfigured || !supabase) {
        return Array.from(usersMap.values());
    }

    try {
        // 1. Thử đọc từ system_settings ('users_config')
        try {
            const configVal = await getSystemSetting('users_config');
            if (configVal) {
                const parsed = JSON.parse(configVal);
                if (Array.isArray(parsed)) {
                    parsed.forEach(u => {
                        const mapped = mapUserFromDb(u);
                        if (mapped.username) usersMap.set(mapped.username.toLowerCase(), mapped);
                    });
                }
            }
        } catch (e) {
            console.warn("Direct fetch system_settings error:", e);
        }

        // 2. Thử đọc từ bảng users
        try {
            const { data, error } = await supabase.from('users').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(u => {
                    const mapped = mapUserFromDb(u);
                    if (mapped.username) usersMap.set(mapped.username.toLowerCase(), mapped);
                });
            }
        } catch (e) {
            console.warn("Direct fetch table users error:", e);
        }

        const result = Array.from(usersMap.values());
        if (result.length > 0) {
            saveToCache(CACHE_KEYS.USERS, result);
        }
        return result;
    } catch (err) {
        console.warn("fetchUsersDirectFromDb exception:", err);
        return Array.from(usersMap.values());
    }
};

/**
 * Tìm kiếm tài khoản cụ thể trực tiếp trên Supabase
 */
export const findUserInDbDirectly = async (usernameInput: string): Promise<User | null> => {
    const cleanU = usernameInput.normalize('NFC').trim().toLowerCase();
    if (!cleanU) return null;

    // 1. Tìm trong danh sách vừa nạp trực tiếp từ Cloud
    const allUsers = await fetchUsersDirectFromDb();
    const matched = allUsers.find(u => u.username.normalize('NFC').trim().toLowerCase() === cleanU);
    if (matched) return matched;

    // 2. Thử tìm qua query trực tiếp trên Supabase
    if (isConfigured && supabase) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', cleanU);
            if (!error && Array.isArray(data) && data.length > 0) {
                return mapUserFromDb(data[0]);
            }
        } catch (e) {
            console.warn("findUserInDbDirectly query error:", e);
        }
    }

    return null;
};

export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    let savedUser = user;

    // 1. Thử lưu vào bảng users chuyên dụng (với fallback payload linh hoạt)
    if (isConfigured) {
        try {
            const fullPayload = mapUserToDb(user);
            let payloadToUse: any = fullPayload;

            if (isUpdate) {
                let { data, error } = await supabase.from('users').update(payloadToUse).eq('username', user.username).select();
                if (error && error.code === '42703') {
                    // Nếu dính lỗi cột không tồn tại, lược bỏ employee_id/employeeId
                    delete payloadToUse.employee_id;
                    delete payloadToUse.employeeId;
                    const res = await supabase.from('users').update(payloadToUse).eq('username', user.username).select();
                    data = res.data;
                }
                if (data?.[0]) savedUser = mapUserFromDb(data[0]);
            } else {
                let { data, error } = await supabase.from('users').insert([payloadToUse]).select();
                if (error && error.code === '42703') {
                    delete payloadToUse.employee_id;
                    delete payloadToUse.employeeId;
                    const res = await supabase.from('users').insert([payloadToUse]).select();
                    data = res.data;
                }
                if (data?.[0]) savedUser = mapUserFromDb(data[0]);
            }
        } catch (error) {
            logError("saveUserApi table users", error, true);
        }
    }

    // 2. Luôn nạp toàn bộ danh sách hiện tại, cập nhật tài khoản mới/sửa và đồng bộ KÉP lên system_settings ('users_config')
    try {
        const currentList = await fetchUsers();
        let updatedList: User[] = [];
        const normalizedTarget = savedUser.username.normalize('NFC').trim().toLowerCase();

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

/**
 * Hàm xác thực tài khoản trực tiếp với Supabase Cloud dành cho máy mới / trình duyệt mới.
 * Tuân thủ nghiêm ngặt 3 trường hợp phản hồi theo yêu cầu hệ thống.
 */
export const authenticateUserCloud = async (usernameInput: string, passwordInput: string): Promise<CloudAuthResult> => {
    // 1. Kiểm tra cấu hình môi trường kết nối Supabase
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

    let cloudUsers: User[] = [];
    let querySuccessCount = 0;
    let lastNetworkError: any = null;
    let lastDbError: any = null;

    // 2. Truy vấn trực tiếp từ bảng users trên Supabase Cloud
    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) {
            console.error("🔒 [Supabase Auth Debug] Lỗi truy vấn bảng `users`:", error);
            lastDbError = error;
        } else if (Array.isArray(data)) {
            querySuccessCount++;
            data.forEach(item => {
                const mapped = mapUserFromDb(item);
                if (mapped.username) cloudUsers.push(mapped);
            });
        }
    } catch (e: any) {
        console.error("🌐 [Supabase Auth Debug] Lỗi mạng khi đọc bảng `users`:", e);
        lastNetworkError = e;
    }

    // 3. Truy vấn trực tiếp từ system_settings (users_config) để đảm bảo đồng bộ kép
    try {
        const configVal = await getSystemSetting('users_config');
        if (configVal) {
            querySuccessCount++;
            try {
                const parsed = JSON.parse(configVal);
                if (Array.isArray(parsed)) {
                    parsed.forEach(item => {
                        const mapped = mapUserFromDb(item);
                        if (mapped.username) cloudUsers.push(mapped);
                    });
                }
            } catch (pErr) {
                console.warn("Parse users_config JSON warning:", pErr);
            }
        } else if (!lastDbError && !lastNetworkError) {
            querySuccessCount++;
        }
    } catch (e: any) {
        console.error("🌐 [Supabase Auth Debug] Lỗi mạng khi đọc `system_settings`:", e);
        if (!lastNetworkError) lastNetworkError = e;
    }

    // 4. Phân loại 3 trường hợp lỗi kết nối / RLS theo đúng yêu cầu:
    if (querySuccessCount === 0) {
        // Trường hợp 2: Lỗi mạng / Không kết nối được Supabase
        if (lastNetworkError || (!window.navigator.onLine)) {
            return {
                status: 'NETWORK_ERROR',
                message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
                errorDetails: lastNetworkError
            };
        }
        // Trường hợp 3: Lỗi RLS / Database / Query Supabase
        if (lastDbError) {
            return {
                status: 'DB_ERROR',
                message: 'Không thể xác thực tài khoản từ máy chủ. Vui lòng liên hệ quản trị hệ thống.',
                errorDetails: lastDbError
            };
        }
        return {
            status: 'NETWORK_ERROR',
            message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
        };
    }

    // Trường hợp 1: Supabase hoạt động bình thường -> Xác thực tài khoản Cloud
    const userMap = new Map<string, User>();
    cloudUsers.forEach(u => {
        const key = (u.username || '').normalize('NFC').trim().toLowerCase();
        if (key) {
            const existing = userMap.get(key);
            if (!existing || (!existing.password && u.password)) {
                userMap.set(key, u);
            }
        }
    });

    const targetUser = userMap.get(cleanU);

    // Không tìm thấy tài khoản
    if (!targetUser) {
        return {
            status: 'INVALID_CREDENTIALS',
            message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        };
    }

    // Mật khẩu không đúng
    const dbPassword = (targetUser.password || '').normalize('NFC').trim();
    if (dbPassword !== cleanP) {
        return {
            status: 'INVALID_CREDENTIALS',
            message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        };
    }

    // Tài khoản bị vô hiệu hóa / active = false
    if (targetUser.active === false) {
        return {
            status: 'ACCOUNT_DISABLED',
            message: 'Tài khoản đã bị vô hiệu hóa hoặc bị khóa. Vui lòng liên hệ quản trị viên.'
        };
    }

    return {
        status: 'SUCCESS',
        user: targetUser
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
