
import { supabase, isConfigured } from './supabaseClient';
import { Contract, PriceItem } from '../types';
import { logError, mapContractFromDb, mapContractToDb, mapPriceFromDb, mapPriceToDb } from './apiCore';

const LOCAL_CONTRACTS_KEY = 'app_contracts_data_v2';

const getLocalContracts = (): Contract[] => {
    try {
        const raw = localStorage.getItem(LOCAL_CONTRACTS_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("Lỗi đọc LocalStorage contracts:", e);
    }
    return [];
};

const setLocalContracts = (contracts: Contract[]) => {
    try {
        localStorage.setItem(LOCAL_CONTRACTS_KEY, JSON.stringify(contracts));
    } catch (e) {
        console.error("Lỗi ghi LocalStorage contracts:", e);
    }
};

export const mapContractToDbSnake = (c: Contract) => ({
    id: c.id,
    code: c.code,
    customer_name: c.customerName,
    phone_number: c.phoneNumber,
    customer_address: c.customerAddress,
    ward: c.ward,
    address: c.address,
    land_plot: c.landPlot,
    map_sheet: c.mapSheet,
    area: c.area,
    contract_type: c.contractType,
    service_type: c.serviceType,
    area_type: c.areaType,
    plot_count: c.plotCount,
    marker_count: c.markerCount,
    split_items: c.splitItems,
    quantity: c.quantity,
    unit_price: c.unitPrice,
    vat_rate: c.vatRate,
    vat_amount: c.vatAmount,
    total_amount: c.totalAmount,
    deposit: c.deposit,
    content: c.content,
    created_date: c.createdDate,
    status: c.status,
    liquidation_area: c.liquidationArea,
    liquidation_amount: c.liquidationAmount
});

// --- CONTRACTS ---
export const fetchContracts = async (): Promise<Contract[]> => {
    const localContracts = getLocalContracts();

    if (!isConfigured) return localContracts;
    
    try {
        let cloudContracts: Contract[] = [];
        const { data, error } = await supabase.from('contracts').select('*').order('createdDate', { ascending: false });
        if (error) {
            // Thử lại nếu bảng contracts sử dụng cột created_date theo chuẩn snake_case
            const { data: dataSnake, error: errSnake } = await supabase.from('contracts').select('*').order('created_date', { ascending: false });
            if (!errSnake && dataSnake) {
                cloudContracts = dataSnake.map(mapContractFromDb);
            }
        } else if (data) {
            cloudContracts = data.map(mapContractFromDb);
        }

        if (cloudContracts.length > 0) {
            // Hợp nhất dữ liệu cloud và local (ưu tiên mới nhất)
            const map = new Map<string, Contract>();
            localContracts.forEach(c => map.set(c.id || c.code, c));
            cloudContracts.forEach(c => map.set(c.id || c.code, c));
            const merged = Array.from(map.values()).sort((a, b) => 
                new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime()
            );
            setLocalContracts(merged);
            return merged;
        }
    } catch (error) {
        logError("fetchContracts", error, true);
    }

    return localContracts;
};

export const createContractApi = async (contract: Contract): Promise<boolean> => {
    try {
        // 1. Lưu lập tức vào LocalStorage để không bao giờ bị mất
        const contracts = getLocalContracts();
        const index = contracts.findIndex(c => c.id === contract.id || (c.code && c.code === contract.code));
        if (index >= 0) {
            contracts[index] = contract;
        } else {
            contracts.unshift(contract);
        }
        setLocalContracts(contracts);

        // 2. Thử đồng bộ lên Cloud Supabase nếu có kết nối
        if (isConfigured) {
            try {
                const payload = mapContractToDb(contract);
                const { error } = await supabase.from('contracts').insert([payload]);
                if (error) {
                    if (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist'))) {
                        console.warn("⚠️ Bảng contracts thiếu cột camelCase. Đang thử lại với kiểu cột snake_case...");
                        const snakePayload = mapContractToDbSnake(contract);
                        const { error: err2 } = await supabase.from('contracts').insert([snakePayload]);
                        if (err2) logError("createContractApi snake_case", err2);
                    } else {
                        logError("createContractApi camelCase", error);
                    }
                }
            } catch (cloudErr) {
                logError("createContractApi Cloud sync", cloudErr);
            }
        }

        return true;
    } catch (error) {
        logError("createContractApi Local error", error);
        return false;
    }
};

export const updateContractApi = async (contract: Contract): Promise<boolean> => {
    try {
        // 1. Cập nhật LocalStorage
        const contracts = getLocalContracts();
        const index = contracts.findIndex(c => c.id === contract.id || (c.code && c.code === contract.code));
        if (index >= 0) {
            contracts[index] = contract;
            setLocalContracts(contracts);
        } else {
            contracts.unshift(contract);
            setLocalContracts(contracts);
        }

        // 2. Thử đồng bộ lên Supabase
        if (isConfigured) {
            try {
                const payload = mapContractToDb(contract);
                const { error } = await supabase.from('contracts').update(payload).eq('id', contract.id);
                if (error) {
                    if (error.code === 'PGRST204' || String(error.code) === '42703' || (error.message && String(error.message).includes('does not exist'))) {
                        console.warn("⚠️ Bảng contracts thiếu cột camelCase. Đang thử lại cập nhật với kiểu cột snake_case...");
                        const snakePayload = mapContractToDbSnake(contract);
                        const { error: err2 } = await supabase.from('contracts').update(snakePayload).eq('id', contract.id);
                        if (err2) logError("updateContractApi snake_case", err2);
                    } else {
                        logError("updateContractApi camelCase", error);
                    }
                }
            } catch (cloudErr) {
                logError("updateContractApi Cloud sync", cloudErr);
            }
        }

        return true;
    } catch (error) {
        logError("updateContractApi Local error", error);
        return false;
    }
};

export const deleteContractApi = async (id: string): Promise<boolean> => {
    try {
        // 1. Xóa trong LocalStorage
        const contracts = getLocalContracts();
        const filtered = contracts.filter(c => c.id !== id);
        setLocalContracts(filtered);

        // 2. Xóa trên Cloud Supabase
        if (isConfigured) {
            try {
                const { error } = await supabase.from('contracts').delete().eq('id', id);
                if (error) logError("deleteContractApi Cloud", error);
            } catch (cloudErr) {
                logError("deleteContractApi Cloud sync", cloudErr);
            }
        }

        return true;
    } catch (error) {
        logError("deleteContractApi Local error", error);
        return false;
    }
};

// --- PRICE LIST ---
export const fetchPriceList = async (): Promise<PriceItem[]> => {
    if (!isConfigured) return [];
    try {
        const { data, error } = await supabase.from('price_list').select('*');
        if (error) throw error;
        return (data || []).map(mapPriceFromDb);
    } catch (error) {
        logError("fetchPriceList", error, true);
        return [];
    }
};

export const savePriceListBatch = async (items: PriceItem[]): Promise<boolean> => {
    if (!isConfigured) return false;
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

