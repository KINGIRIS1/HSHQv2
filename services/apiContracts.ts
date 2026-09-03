
import { supabase, isConfigured } from './supabaseClient';
import { Contract, PriceItem } from '../types';
import { logError, mapContractFromDb, mapContractToDb, mapPriceFromDb, mapPriceToDb } from './apiCore';
import { getIndexedDBItem, setIndexedDBItem } from './storageService';

const LOCAL_CONTRACTS_KEY = 'app_contracts_data_v2';
let memoryContractsCache: Contract[] | null = null;

// Tự động dọn dẹp key cũ trong LocalStorage để giải phóng 5MB quota ngay khi khởi động
try {
    const legacy = localStorage.getItem(LOCAL_CONTRACTS_KEY);
    if (legacy) {
        try {
            const parsed = JSON.parse(legacy);
            if (Array.isArray(parsed) && parsed.length > 0) {
                memoryContractsCache = parsed;
                setIndexedDBItem(LOCAL_CONTRACTS_KEY, parsed).catch(() => {});
            }
        } catch (_) {}
        localStorage.removeItem(LOCAL_CONTRACTS_KEY);
    }
} catch (_) {}

const getLocalContracts = (): Contract[] => {
    if (memoryContractsCache && memoryContractsCache.length > 0) {
        return memoryContractsCache;
    }
    try {
        const raw = localStorage.getItem(LOCAL_CONTRACTS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            memoryContractsCache = parsed;
            setIndexedDBItem(LOCAL_CONTRACTS_KEY, parsed).catch(() => {});
            try { localStorage.removeItem(LOCAL_CONTRACTS_KEY); } catch (_) {}
            return parsed;
        }
    } catch (e) {
        console.error("Lỗi đọc LocalStorage contracts:", e);
    }
    return [];
};

export const getIndexedDBContracts = async (): Promise<Contract[]> => {
    if (memoryContractsCache && memoryContractsCache.length > 0) {
        return memoryContractsCache;
    }
    try {
        const idbData = await getIndexedDBItem<Contract[]>(LOCAL_CONTRACTS_KEY);
        if (idbData && Array.isArray(idbData) && idbData.length > 0) {
            memoryContractsCache = idbData;
            try { localStorage.removeItem(LOCAL_CONTRACTS_KEY); } catch (_) {}
            return idbData;
        }
    } catch (e) {
        console.error("Lỗi đọc IndexedDB contracts:", e);
    }
    return getLocalContracts();
};

const setLocalContracts = (contracts: Contract[]) => {
    memoryContractsCache = contracts;
    // Tuyệt đối không lưu vào LocalStorage để không bao giờ bị lỗi quota 5MB
    try {
        localStorage.removeItem(LOCAL_CONTRACTS_KEY);
    } catch (_) {}
    // Lưu bền vững vào IndexedDB (dung lượng không giới hạn)
    setIndexedDBItem(LOCAL_CONTRACTS_KEY, contracts).catch((err) => {
        console.error("Lỗi ghi IndexedDB contracts:", err);
    });
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
    // 1. Ưu tiên lấy ngay lập tức từ RAM cache hoặc IndexedDB / LocalStorage (0 giây chờ)
    const localContracts = await getIndexedDBContracts();

    if (!isConfigured) return localContracts;
    
    // Tải ngầm đồng bộ từ Supabase nếu cần
    (async () => {
        try {
            let cloudContracts: Contract[] = [];
            const step = 1000;
            let { data: firstData, count, error } = await supabase
                .from('contracts')
                .select('*', { count: 'exact' })
                .order('createdDate', { ascending: false })
                .range(0, step - 1);

            let orderCol = 'createdDate';
            if (error) {
                const resSnake = await supabase
                    .from('contracts')
                    .select('*', { count: 'exact' })
                    .order('created_date', { ascending: false })
                    .range(0, step - 1);
                if (!resSnake.error && resSnake.data) {
                    firstData = resSnake.data;
                    count = resSnake.count;
                    orderCol = 'created_date';
                }
            }

            if (firstData && firstData.length > 0) {
                let allContractRows = [...firstData];
                if (count && count > step) {
                    const promises = [];
                    for (let from = step; from < count; from += step) {
                        const to = Math.min(from + step - 1, count - 1);
                        promises.push((async () => {
                            try {
                                const { data } = await supabase
                                    .from('contracts')
                                    .select('*')
                                    .order(orderCol, { ascending: false })
                                    .range(from, to);
                                return data || [];
                            } catch (err: any) {
                                return [];
                            }
                        })());
                    }
                    const remaining = await Promise.all(promises);
                    allContractRows = [firstData, ...remaining].flat();
                }
                cloudContracts = allContractRows.map(mapContractFromDb);
            }

            if (cloudContracts.length > 0) {
                const map = new Map<string, Contract>();
                localContracts.forEach(c => map.set(c.id || c.code, c));
                cloudContracts.forEach(c => map.set(c.id || c.code, c));
                const merged = Array.from(map.values()).sort((a, b) => 
                    new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime()
                );
                setLocalContracts(merged);
            }
        } catch (error) {
            logError("fetchContracts background sync", error);
        }
    })();

    return localContracts;
};

export const createContractApi = async (contract: Contract): Promise<boolean> => {
    try {
        // 1. Lưu lập tức vào RAM Cache & IndexedDB
        let contracts = memoryContractsCache;
        if (!contracts || contracts.length === 0) {
            contracts = await getIndexedDBContracts();
        }
        const updatedContracts = [...contracts];
        const index = updatedContracts.findIndex(c => c.id === contract.id || (c.code && c.code === contract.code));
        if (index >= 0) {
            updatedContracts[index] = contract;
        } else {
            updatedContracts.unshift(contract);
        }
        setLocalContracts(updatedContracts);

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
        // 1. Cập nhật RAM Cache & IndexedDB
        let contracts = memoryContractsCache;
        if (!contracts || contracts.length === 0) {
            contracts = await getIndexedDBContracts();
        }
        const updatedContracts = [...contracts];
        const index = updatedContracts.findIndex(c => c.id === contract.id || (c.code && c.code === contract.code));
        if (index >= 0) {
            updatedContracts[index] = contract;
            setLocalContracts(updatedContracts);
        } else {
            updatedContracts.unshift(contract);
            setLocalContracts(updatedContracts);
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
        // 1. Xóa trong RAM Cache & IndexedDB
        let contracts = memoryContractsCache;
        if (!contracts || contracts.length === 0) {
            contracts = await getIndexedDBContracts();
        }
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
        logError("fetchPriceList", error);
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

