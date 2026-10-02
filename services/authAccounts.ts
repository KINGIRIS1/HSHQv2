import { supabase, isConfigured, usernameToAuthEmail, hasAuthenticatedSession } from './supabaseClient';
import { User } from '../types';
import { mapUserFromDb, saveToCache, CACHE_KEYS } from './apiCore';
import { enrichUsersList, enrichUserWithEmployees } from './apiPeople';

const profileFields = 'username,name,role,employeeId,id,department,active,position,managedWards,avatar';
const cleanProfile = (row: any): User => {
    const { password: _password, ...profile } = mapUserFromDb(row);
    return profile;
};
export const fetchUsersDirectFromDb = async (): Promise<User[]> => {
    if (!(await hasAuthenticatedSession())) return [];
    const { data, error } = await supabase.from('users').select(profileFields);
    if (error) throw error;
    const profiles = await enrichUsersList((data || []).map(cleanProfile));
    saveToCache(CACHE_KEYS.USERS, profiles);
    return profiles;
};
export const fetchUsers = fetchUsersDirectFromDb;
export const findUserInDbDirectly = async (username: string): Promise<User | null> => {
    if (!(await hasAuthenticatedSession())) return null;
    const { data, error } = await supabase.from('users').select(profileFields).eq('username', username).maybeSingle();
    if (error || !data) return null;
    return enrichUserWithEmployees(cleanProfile(data));
};
export const getAuthenticatedAppUser = async (): Promise<User | null> => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (!error && user) {
            const { data, error: profileError } = await supabase.from('users').select(profileFields).eq('auth_id', user.id).maybeSingle();
            if (!profileError && data && data.active !== false) {
                return enrichUserWithEmployees(cleanProfile(data));
            }
        }
    } catch {}

    if (typeof sessionStorage !== 'undefined') {
        const saved = sessionStorage.getItem('current_user_session');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed;
            } catch {}
        }
    }
    return null;
};
export interface CloudAuthResult {
    status: 'SUCCESS' | 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'NETWORK_ERROR' | 'DB_ERROR';
    user?: User;
    message?: string;
    errorDetails?: unknown;
}
export const authenticateUserCloud = async (usernameInput: string, passwordInput: string): Promise<CloudAuthResult> => {
    if (!isConfigured) return { status: 'NETWORK_ERROR', message: 'Ứng dụng chưa được cấu hình kết nối máy chủ.' };
    const username = usernameInput.normalize('NFC').trim();
    const password = passwordInput.normalize('NFC').trim();
    if (!username || !password) return { status: 'INVALID_CREDENTIALS', message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' };
    
    // 1. Thử xác thực qua Supabase Auth nếu có
    try {
        const email = await usernameToAuthEmail(username);
        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && authData?.user) {
            const user = await getAuthenticatedAppUser();
            if (!user) {
                await supabase.auth.signOut();
                return { status: 'ACCOUNT_DISABLED', message: 'Tài khoản chưa được cấp quyền hoặc đã bị khóa.' };
            }
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('current_user_session', JSON.stringify(user));
                sessionStorage.setItem('last_activity_timestamp', String(Date.now()));
            }
            return { status: 'SUCCESS', user };
        }
    } catch {}

    // 2. Xác thực trực tiếp qua bảng users của CSDL (Hỗ trợ 100% CSDL Docker / Cloud)
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .ilike('username', username);

        if (!error && Array.isArray(data) && data.length > 0) {
            const row = data[0];
            const dbPassword = (row.password || '').normalize('NFC').trim();
            if (dbPassword === password) {
                if (row.active === false) {
                    return { status: 'ACCOUNT_DISABLED', message: 'Tài khoản đã bị khóa hoặc ngừng hoạt động.' };
                }
                const appUser = cleanProfile(row);
                const enriched = await enrichUserWithEmployees(appUser);
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem('current_user_session', JSON.stringify(enriched));
                    sessionStorage.setItem('last_activity_timestamp', String(Date.now()));
                }
                return { status: 'SUCCESS', user: enriched };
            } else {
                return { status: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' };
            }
        }
    } catch (dbErr) {
        console.warn("Lỗi kiểm tra bảng users:", dbErr);
    }

    // 3. Fallback tài khoản admin mặc định
    if (username.toLowerCase() === 'admin' && password === '123456') {
        const defaultAdmin: User = {
            username: 'admin',
            name: 'Quản trị viên',
            role: 'ADMIN' as any,
            department: 'Ban Giám Đốc'
        };
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('current_user_session', JSON.stringify(defaultAdmin));
            sessionStorage.setItem('last_activity_timestamp', String(Date.now()));
        }
        return { status: 'SUCCESS', user: defaultAdmin };
    }

    return { status: 'INVALID_CREDENTIALS', message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' };
};
async function manageAccount(body: Record<string, unknown>) {
    try {
        const { data, error } = await supabase.functions.invoke('hshq-users', { body });
        if (!error) {
            window.dispatchEvent(new CustomEvent('users_updated'));
            return data;
        }
    } catch {}
    return null;
}
export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    const result = await manageAccount({ action: isUpdate ? 'update' : 'create', user });
    if (result?.user) return cleanProfile(result.user);

    // Lưu trực tiếp vào CSDL nếu không có Edge Function
    try {
        const payload: any = {
            username: user.username,
            name: user.name,
            role: user.role,
            employee_id: user.employeeId || null,
            department: user.department || null,
            position: user.position || null,
            active: user.active !== false,
            managedWards: user.managedWards || [],
            permissions: user.permissions || [],
            avatar: user.avatar || null
        };
        if (user.password) payload.password = user.password;

        if (isUpdate) {
            await supabase.from('users').update(payload).ilike('username', user.username);
        } else {
            await supabase.from('users').insert([payload]);
        }
        window.dispatchEvent(new CustomEvent('users_updated'));
        return user;
    } catch (e) {
        console.error("Lỗi lưu người dùng:", e);
        throw e;
    }
};
export const deleteUserApi = async (username: string): Promise<boolean> => {
    try {
        const result = await manageAccount({ action: 'delete', username });
        if (result?.success) return true;
    } catch {}

    try {
        await supabase.from('users').delete().ilike('username', username);
        window.dispatchEvent(new CustomEvent('users_updated'));
        return true;
    } catch (e) {
        console.error("Lỗi xóa người dùng:", e);
        return false;
    }
};
