
import { supabase, isConfigured } from './supabaseClient';
import { logError } from './apiCore';

// --- COMMON TYPES ---
export interface GenericRecord {
    id: string;
    created_at: string;
    created_by: string;
    customer_name: string; // Tên chủ/người yêu cầu để tìm kiếm
    data: any; // Toàn bộ dữ liệu form (JSON)
}

export interface VphcRecord extends GenericRecord {
    record_type: 'mau01' | 'mau02';
}

export interface BienBanRecord extends GenericRecord {
    // data chứa formData, boundaryChanges, boundaryChangesBDDC
}

export interface ThongTinRecord extends GenericRecord {
    // data chứa formData
}

export interface ChinhLyRecord extends GenericRecord {
    // data chứa các trường chỉnh lý biến động
}

export interface TachThuaRecord extends GenericRecord {
    // data chứa các trường tách thửa (cấu trúc giống ChinhLyRecord)
}

export interface MapSheetConversion {
    id: string;
    created_at: string;
    xa_phuong_cu: string;
    so_to_cu: string;
    xa_phuong_moi: string;
    so_to_moi: string;
}

// Mock Data Stores
const MOCK_VPHC: VphcRecord[] = [];
const MOCK_BIENBAN: BienBanRecord[] = [];
const MOCK_THONGTIN: ThongTinRecord[] = [];
const MOCK_CHINHLY: ChinhLyRecord[] = [];
const MOCK_TACHTHUA: TachThuaRecord[] = [];
let MOCK_MAP_CONVERSIONS: MapSheetConversion[] = [];

// Helper sinh ID ngẫu nhiên
const generateId = () => Math.random().toString(36).substr(2, 9);

// ============================================================================
// 1. BIÊN BẢN VPHC
// ============================================================================

export const fetchVphcRecords = async (): Promise<VphcRecord[]> => {
    if (!isConfigured) return MOCK_VPHC;
    try {
        const { data, error } = await supabase
            .from('vphc_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as VphcRecord[];
    } catch (error) {
        logError("fetchVphcRecords", error);
        return MOCK_VPHC;
    }
};

export const saveVphcRecord = async (record: Partial<VphcRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as VphcRecord;
            MOCK_VPHC.unshift(newRec);
        } else {
            const idx = MOCK_VPHC.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_VPHC[idx] = { ...MOCK_VPHC[idx], ...record } as VphcRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            // Update
            const { error } = await supabase.from('vphc_records').update({ 
                customer_name: record.customer_name,
                record_type: record.record_type,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            // Insert - FIX: Sinh ID trước khi gửi
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('vphc_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveVphcRecord", error);
        return false;
    }
};

export const deleteVphcRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_VPHC.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_VPHC.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('vphc_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteVphcRecord", error);
        return false;
    }
};

// ============================================================================
// 2. BIÊN BẢN HIỆN TRẠNG
// ============================================================================

export const fetchBienBanRecords = async (): Promise<BienBanRecord[]> => {
    if (!isConfigured) return MOCK_BIENBAN;
    try {
        const { data, error } = await supabase
            .from('bienban_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as BienBanRecord[];
    } catch (error) {
        // Fallback: Create table if not exists or ignore
        // logError("fetchBienBanRecords", error);
        return MOCK_BIENBAN;
    }
};

export const saveBienBanRecord = async (record: Partial<BienBanRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as BienBanRecord;
            MOCK_BIENBAN.unshift(newRec);
        } else {
            const idx = MOCK_BIENBAN.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_BIENBAN[idx] = { ...MOCK_BIENBAN[idx], ...record } as BienBanRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            // Update
            const { error } = await supabase.from('bienban_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            // Insert - FIX: Sinh ID trước khi gửi
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('bienban_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveBienBanRecord", error);
        return false;
    }
};

export const deleteBienBanRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_BIENBAN.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_BIENBAN.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('bienban_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteBienBanRecord", error);
        return false;
    }
};

// ============================================================================
// 3. CUNG CẤP THÔNG TIN
// ============================================================================

export const fetchThongTinRecords = async (): Promise<ThongTinRecord[]> => {
    if (!isConfigured) return MOCK_THONGTIN;
    try {
        const { data, error } = await supabase
            .from('thongtin_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as ThongTinRecord[];
    } catch (error) {
        // logError("fetchThongTinRecords", error);
        return MOCK_THONGTIN;
    }
};

export const saveThongTinRecord = async (record: Partial<ThongTinRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as ThongTinRecord;
            MOCK_THONGTIN.unshift(newRec);
        } else {
            const idx = MOCK_THONGTIN.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_THONGTIN[idx] = { ...MOCK_THONGTIN[idx], ...record } as ThongTinRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            // Update
            const { error } = await supabase.from('thongtin_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            // Insert - FIX: Sinh ID trước khi gửi
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('thongtin_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveThongTinRecord", error);
        return false;
    }
};

export const deleteThongTinRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_THONGTIN.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_THONGTIN.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('thongtin_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteThongTinRecord", error);
        return false;
    }
};

// ============================================================================
// 4. DANH SÁCH CHỈNH LÝ BIẾN ĐỘNG
// ============================================================================

export const fetchChinhLyRecords = async (): Promise<ChinhLyRecord[]> => {
    if (!isConfigured) return MOCK_CHINHLY;
    try {
        const { data, error } = await supabase
            .from('chinhly_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as ChinhLyRecord[];
    } catch (error) {
        // Fallback or ignore if table not created
        return MOCK_CHINHLY;
    }
};

export const saveChinhLyRecord = async (record: Partial<ChinhLyRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as ChinhLyRecord;
            MOCK_CHINHLY.unshift(newRec);
        } else {
            const idx = MOCK_CHINHLY.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_CHINHLY[idx] = { ...MOCK_CHINHLY[idx], ...record } as ChinhLyRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            const { error } = await supabase.from('chinhly_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('chinhly_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveChinhLyRecord", error);
        return false;
    }
};

export const deleteChinhLyRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_CHINHLY.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_CHINHLY.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('chinhly_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteChinhLyRecord", error);
        return false;
    }
};

// ============================================================================
// 5. HỒ SƠ TÁCH THỬA (NEW)
// ============================================================================

export const fetchTachThuaRecords = async (): Promise<TachThuaRecord[]> => {
    if (!isConfigured) return MOCK_TACHTHUA;
    try {
        const { data, error } = await supabase
            .from('tachthua_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as TachThuaRecord[];
    } catch (error) {
        return MOCK_TACHTHUA;
    }
};

export const saveTachThuaRecord = async (record: Partial<TachThuaRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as TachThuaRecord;
            MOCK_TACHTHUA.unshift(newRec);
        } else {
            const idx = MOCK_TACHTHUA.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_TACHTHUA[idx] = { ...MOCK_TACHTHUA[idx], ...record } as TachThuaRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            const { error } = await supabase.from('tachthua_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('tachthua_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveTachThuaRecord", error);
        return false;
    }
};

export const deleteTachThuaRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_TACHTHUA.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_TACHTHUA.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('tachthua_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteTachThuaRecord", error);
        return false;
    }
};

// ============================================================================
// 6. CHUYỂN ĐỔI TỜ BẢN ĐỒ
// ============================================================================

export const fetchMapSheetConversions = async (): Promise<MapSheetConversion[]> => {
    if (!isConfigured) return MOCK_MAP_CONVERSIONS;
    try {
        const { data, error } = await supabase
            .from('map_sheet_conversions')
            .select('*')
            .order('xa_phuong_cu', { ascending: true });
        if (error) throw error;
        return data as MapSheetConversion[];
    } catch (error) {
        logError("fetchMapSheetConversions", error);
        return MOCK_MAP_CONVERSIONS;
    }
};

export const saveMapSheetConversions = async (records: Partial<MapSheetConversion>[]): Promise<boolean> => {
    if (!isConfigured) {
        const newRecords = records.map(r => ({
            ...r,
            id: generateId(),
            created_at: new Date().toISOString()
        })) as MapSheetConversion[];
        MOCK_MAP_CONVERSIONS = [...MOCK_MAP_CONVERSIONS, ...newRecords];
        return true;
    }
    try {
        // Prepare records for insertion
        const newRecords = records.map(r => ({
            xa_phuong_cu: r.xa_phuong_cu,
            so_to_cu: r.so_to_cu,
            xa_phuong_moi: r.xa_phuong_moi,
            so_to_moi: r.so_to_moi
        }));

        const { error } = await supabase.from('map_sheet_conversions').insert(newRecords);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveMapSheetConversions", error);
        return false;
    }
};

export const deleteAllMapSheetConversions = async (): Promise<boolean> => {
    if (!isConfigured) {
        MOCK_MAP_CONVERSIONS = [];
        return true;
    }
    try {
        // Supabase requires a filter for delete. We can delete where id is not null.
        const { error } = await supabase.from('map_sheet_conversions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteAllMapSheetConversions", error);
        return false;
    }
};
