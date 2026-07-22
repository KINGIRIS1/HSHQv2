
import { supabase, isConfigured } from './supabaseClient';
import { WorkSchedule } from '../types';
import { logError, getFromCache, saveToCache, CACHE_KEYS } from './apiCore';

// Cache key mới cho lịch công tác
const WORK_SCHEDULE_CACHE_KEY = 'offline_work_schedules';

// Mock data store cho offline
let MOCK_SCHEDULES: WorkSchedule[] = [];

export const fetchWorkSchedules = async (): Promise<WorkSchedule[]> => {
    if (!isConfigured) return getFromCache(WORK_SCHEDULE_CACHE_KEY, MOCK_SCHEDULES);
    try {
        const { data, error } = await supabase
            .from('work_schedules')
            .select('*')
            .order('date', { ascending: false });
        if (error) throw error;
        saveToCache(WORK_SCHEDULE_CACHE_KEY, data);
        return data as WorkSchedule[];
    } catch (error) {
        logError("fetchWorkSchedules", error);
        return getFromCache(WORK_SCHEDULE_CACHE_KEY, []);
    }
};

export const saveWorkSchedule = async (schedule: Partial<WorkSchedule>): Promise<boolean> => {
    if (!isConfigured) {
        if (schedule.id) {
            const idx = MOCK_SCHEDULES.findIndex(s => s.id === schedule.id);
            if (idx !== -1) MOCK_SCHEDULES[idx] = { ...MOCK_SCHEDULES[idx], ...schedule } as WorkSchedule;
        } else {
            const newSchedule = { 
                ...schedule, 
                id: Math.random().toString(36).substr(2, 9),
                created_at: new Date().toISOString() 
            } as WorkSchedule;
            MOCK_SCHEDULES.unshift(newSchedule);
        }
        saveToCache(WORK_SCHEDULE_CACHE_KEY, MOCK_SCHEDULES);
        return true;
    }

    try {
        if (schedule.id) {
            const { error } = await supabase
                .from('work_schedules')
                .update(schedule)
                .eq('id', schedule.id);
            if (error) throw error;
        } else {
            // FIX: Tự động sinh ID trước khi insert để tránh lỗi null value
            const newSchedule = {
                ...schedule,
                id: Math.random().toString(36).substr(2, 9)
            };
            const { error } = await supabase
                .from('work_schedules')
                .insert([newSchedule]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveWorkSchedule", error);
        return false;
    }
};

export const deleteWorkSchedule = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        MOCK_SCHEDULES = MOCK_SCHEDULES.filter(s => s.id !== id);
        saveToCache(WORK_SCHEDULE_CACHE_KEY, MOCK_SCHEDULES);
        return true;
    }
    try {
        const { error } = await supabase.from('work_schedules').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteWorkSchedule", error);
        return false;
    }
};
