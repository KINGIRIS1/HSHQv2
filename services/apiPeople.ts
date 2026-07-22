
import { supabase, isConfigured } from './supabaseClient';
import { Employee, User } from '../types';
import { MOCK_EMPLOYEES, MOCK_USERS } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, mapEmployeeFromDb, mapEmployeeToDb, mapUserFromDb, mapUserToDb } from './apiCore';

// --- EMPLOYEES ---
export const fetchEmployees = async (): Promise<Employee[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    try {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        const mapped = data.map(mapEmployeeFromDb);
        saveToCache(CACHE_KEYS.EMPLOYEES, mapped);
        return mapped;
    } catch (error) {
        logError("fetchEmployees", error);
        return getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    }
};

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean): Promise<Employee | null> => {
    if (!isConfigured) return employee;
    try {
        const payload = mapEmployeeToDb(employee);
        if (isUpdate) {
            const { data, error } = await supabase.from('employees').update(payload).eq('id', employee.id).select();
            if (error) throw error;
            return data?.[0] ? mapEmployeeFromDb(data[0]) : null;
        } else {
            const { data, error } = await supabase.from('employees').insert([payload]).select();
            if (error) throw error;
            return data?.[0] ? mapEmployeeFromDb(data[0]) : null;
        }
    } catch (error) {
        logError("saveEmployeeApi", error);
        return null;
    }
};

export const deleteEmployeeApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteEmployeeApi", error);
        return false;
    }
};

// --- USERS ---
export const fetchUsers = async (): Promise<User[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.USERS, MOCK_USERS);
    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        const mapped = data.map(mapUserFromDb);
        saveToCache(CACHE_KEYS.USERS, mapped);
        return mapped;
    } catch (error) {
        logError("fetchUsers", error);
        return getFromCache(CACHE_KEYS.USERS, MOCK_USERS);
    }
};

export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    if (!isConfigured) return user;
    try {
        const payload = mapUserToDb(user);
        if (isUpdate) {
            const { data, error } = await supabase.from('users').update(payload).eq('username', user.username).select();
            if (error) throw error;
            return data?.[0] ? mapUserFromDb(data[0]) : null;
        } else {
            const { data, error } = await supabase.from('users').insert([payload]).select();
            if (error) throw error;
            return data?.[0] ? mapUserFromDb(data[0]) : null;
        }
    } catch (error) {
        logError("saveUserApi", error);
        return null;
    }
};

export const deleteUserApi = async (username: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('users').delete().eq('username', username);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteUserApi", error);
        return false;
    }
};
