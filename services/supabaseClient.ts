import { createClient } from '@supabase/supabase-js';

const buildEnv = (import.meta as any).env || {};
const defaultUrl = buildEnv.VITE_SUPABASE_URL || 'https://api.qlhshq.info.vn';
const defaultKey = buildEnv.VITE_SUPABASE_ANON_KEY || '';
// Build configuration takes precedence over settings left by the Cloud app.
const customUrl = !buildEnv.VITE_SUPABASE_URL && typeof localStorage !== 'undefined'
    ? localStorage.getItem('CUSTOM_SUPABASE_URL') : null;
const customKey = customUrl && typeof localStorage !== 'undefined'
    ? localStorage.getItem('CUSTOM_SUPABASE_KEY') : null;
export const SUPABASE_URL: string = customUrl || defaultUrl;
export const SUPABASE_ANON_KEY: string = customKey || defaultKey;
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
if (typeof localStorage !== 'undefined') {
    for (const key of ['offline_users', 'sys_setting_users_config', 'users_config']) localStorage.removeItem(key);
}
export const supabase = createClient(
    isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
    isConfigured ? SUPABASE_ANON_KEY : 'placeholder',
    { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hshq-auth-v1' }, db: { schema: 'public' } }
);

export const hasAuthenticatedSession = async (): Promise<boolean> => {
    if (!isConfigured) return false;
    const { data: { session }, error } = await supabase.auth.getSession();
    return !error && Boolean(session);
};

// Staff still enter their username; Auth uses an internal deterministic alias.
export const usernameToAuthEmail = async (username: string): Promise<string> => {
    const normalized = username.normalize('NFC').trim().toLowerCase();
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    return `${hash}@users.qlhshq.info.vn`;
};
export const setCustomEndpoint = (url: string, key?: string) => {
    if (buildEnv.VITE_SUPABASE_URL) throw new Error('Máy chủ được cấu hình trong bản cài đặt ứng dụng.');
    if (!key?.trim()) throw new Error('Cần URL và khóa anon của cùng một máy chủ.');
    localStorage.setItem('CUSTOM_SUPABASE_URL', url.trim());
    localStorage.setItem('CUSTOM_SUPABASE_KEY', key.trim());
    window.location.reload();
};
export const resetToDefaultEndpoint = () => {
    for (const key of ['CUSTOM_SUPABASE_URL', 'CUSTOM_SUPABASE_KEY', 'custom_supabase_url', 'custom_supabase_key']) localStorage.removeItem(key);
    window.location.reload();
};
