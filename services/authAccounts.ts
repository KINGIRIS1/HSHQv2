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
    if (!(await hasAuthenticatedSession())) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data, error: profileError } = await supabase.from('users').select(profileFields).eq('auth_id', user.id).maybeSingle();
    if (profileError || !data || data.active === false) return null;
    return enrichUserWithEmployees(cleanProfile(data));
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
    try {
        const { error } = await supabase.auth.signInWithPassword({ email: await usernameToAuthEmail(username), password });
        if (error) return { status: error.status && error.status < 500 ? 'INVALID_CREDENTIALS' : 'NETWORK_ERROR',
            message: error.status && error.status < 500 ? 'Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.' : 'Không kết nối được máy chủ. Vui lòng thử lại.' };
        const user = await getAuthenticatedAppUser();
        if (!user) {
            await supabase.auth.signOut();
            return { status: 'ACCOUNT_DISABLED', message: 'Tài khoản chưa được cấp quyền hoặc đã bị khóa.' };
        }
        return { status: 'SUCCESS', user };
    } catch {
        return { status: 'NETWORK_ERROR', message: 'Không kết nối được máy chủ. Vui lòng thử lại.' };
    }
};
async function manageAccount(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('hshq-users', { body });
    if (error) {
        let message = 'Không thể lưu tài khoản.';
        try { message = (await error.context.json()).message || message; } catch {}
        throw new Error(message);
    }
    window.dispatchEvent(new CustomEvent('users_updated'));
    return data;
}
export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    const result = await manageAccount({ action: isUpdate ? 'update' : 'create', user });
    return result?.user ? cleanProfile(result.user) : null;
};
export const deleteUserApi = async (username: string): Promise<boolean> => {
    const result = await manageAccount({ action: 'delete', username });
    return result?.success === true;
};
