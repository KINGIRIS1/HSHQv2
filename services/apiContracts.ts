
import { supabase, isConfigured } from './supabaseClient';
import { Contract, PriceItem } from '../types';
import { logError, getFromCache, saveToCache, CACHE_KEYS, mapContractFromDb, mapContractToDb, mapPriceFromDb, mapPriceToDb } from './apiCore';
import { MOCK_CONTRACTS } from '../constants';

// --- CONTRACTS ---
export const fetchContracts = async (): Promise<Contract[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.CONTRACTS, MOCK_CONTRACTS);
    try {
        const { data, error } = await supabase.from('contracts').select('*').order('createdDate', { ascending: false });
        if (error) throw error;
        const mappedData = data.map(mapContractFromDb);
        saveToCache(CACHE_KEYS.CONTRACTS, mappedData);
        return mappedData;
    } catch (error) {
        logError("fetchContracts", error);
        return getFromCache(CACHE_KEYS.CONTRACTS, MOCK_CONTRACTS);
    }
};

export const createContractApi = async (contract: Contract): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const payload = mapContractToDb(contract);
        const { error } = await supabase.from('contracts').insert([payload]);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("createContractApi", error);
        return false;
    }
};

export const updateContractApi = async (contract: Contract): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const payload = mapContractToDb(contract);
        const { error } = await supabase.from('contracts').update(payload).eq('id', contract.id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("updateContractApi", error);
        return false;
    }
};

export const deleteContractApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('contracts').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteContractApi", error);
        return false;
    }
};

// --- PRICE LIST ---
export const fetchPriceList = async (): Promise<PriceItem[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.PRICE_LIST, []);
    try {
        const { data, error } = await supabase.from('price_list').select('*');
        if (error) throw error;
        const items = data.map(mapPriceFromDb);
        saveToCache(CACHE_KEYS.PRICE_LIST, items);
        return items;
    } catch (error) {
        logError("fetchPriceList", error);
        return getFromCache(CACHE_KEYS.PRICE_LIST, []);
    }
};

export const savePriceListBatch = async (items: PriceItem[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('price_list').delete().neq('id', '0'); 
        if (items.length === 0) return true;
        const dbItems = items.map(mapPriceToDb);
        const { error } = await supabase.from('price_list').insert(dbItems);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("savePriceListBatch", error);
        return false;
    }
};
