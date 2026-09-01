
import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache, CACHE_KEYS } from './apiCore';

export const fetchExcerptHistory = async (): Promise<any[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EXCERPT_HISTORY, []);
    try {
        const { data, error } = await supabase.from('excerpt_history').select('*').order('createdAt', { ascending: false }).limit(200);
        if (error) throw error;
        saveToCache(CACHE_KEYS.EXCERPT_HISTORY, data);
        return data;
    } catch (error) {
        logError("fetchExcerptHistory", error);
        return getFromCache(CACHE_KEYS.EXCERPT_HISTORY, []);
    }
};

export const saveExcerptRecord = async (record: any): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const recordData = { ...record };
        // Loại bỏ các giá trị undefined để tránh lỗi Supabase
        Object.keys(recordData).forEach(key => {
            if (recordData[key] === undefined) {
                recordData[key] = null;
            }
        });
        const { error } = await supabase.from('excerpt_history').insert([recordData]);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveExcerptRecord", error);
        return false;
    }
};

export const fetchExcerptCounters = async (): Promise<Record<string, number>> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EXCERPT_COUNTERS, {});
    try {
        const { data, error } = await supabase.from('excerpt_counters').select('*');
        if (error) throw error;
        const counters: Record<string, number> = {};
        data.forEach((item: any) => {
            counters[item.ward] = item.count;
        });
        saveToCache(CACHE_KEYS.EXCERPT_COUNTERS, counters);
        return counters;
    } catch (error) {
        logError("fetchExcerptCounters", error);
        return getFromCache(CACHE_KEYS.EXCERPT_COUNTERS, {});
    }
};

export const saveExcerptCounters = async (counters: Record<string, number>): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const upsertData = Object.entries(counters).map(([ward, count]) => ({ ward, count }));
        const { error } = await supabase.from('excerpt_counters').upsert(upsertData);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveExcerptCounters", error);
        return false;
    }
};

export const fetchTrichDoHistory = async (): Promise<any[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.TRICHDO_HISTORY, []);
    try {
        const { data, error } = await supabase.from('trichdo_history').select('*').order('createdAt', { ascending: false }).limit(200);
        if (error) throw error;
        saveToCache(CACHE_KEYS.TRICHDO_HISTORY, data);
        return data;
    } catch (error) {
        logError("fetchTrichDoHistory", error);
        return getFromCache(CACHE_KEYS.TRICHDO_HISTORY, []);
    }
};

export const saveTrichDoRecord = async (record: any): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const recordData = { ...record };
        // Loại bỏ các giá trị undefined để tránh lỗi Supabase
        Object.keys(recordData).forEach(key => {
            if (recordData[key] === undefined) {
                recordData[key] = null;
            }
        });
        const { error } = await supabase.from('trichdo_history').insert([recordData]);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveTrichDoRecord", error);
        return false;
    }
};

export const fetchTrichDoCounters = async (): Promise<Record<string, number>> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.TRICHDO_COUNTERS, {});
    try {
        const { data, error } = await supabase.from('trichdo_counters').select('*');
        if (error) throw error;
        const counters: Record<string, number> = {};
        data.forEach((item: any) => {
            counters[item.ward] = item.count;
        });
        saveToCache(CACHE_KEYS.TRICHDO_COUNTERS, counters);
        return counters;
    } catch (error) {
        logError("fetchTrichDoCounters", error);
        return getFromCache(CACHE_KEYS.TRICHDO_COUNTERS, {});
    }
};

export const saveTrichDoCounters = async (counters: Record<string, number>): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const upsertData = Object.entries(counters).map(([ward, count]) => ({ ward, count }));
        const { error } = await supabase.from('trichdo_counters').upsert(upsertData);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveTrichDoCounters", error);
        return false;
    }
};
