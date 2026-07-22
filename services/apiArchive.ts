
import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache } from './apiCore';

// --- TYPES ---
export interface ArchiveRecord {
    id: string;
    created_at: string;
    created_by: string;
    type: 'saoluc' | 'vaoso' | 'congvan';
    status: 'draft' | 'assigned' | 'executed' | 'pending_check' | 'checked' | 'pending_sign' | 'signed' | 'completed'; // Nháp | Đã giao | Đã thực hiện | Trình kiểm tra | Đã kiểm tra | Trình ký | Đã ký | Hoàn thành
    so_hieu: string; // Số hiệu/Số hồ sơ
    trich_yeu: string; // Nội dung/Trích yếu
    ngay_thang: string;
    noi_nhan_gui: string;
    data: any; // Các trường mở rộng khác
}

// Mock Data Stores
let MOCK_ARCHIVE: ArchiveRecord[] = [];

const CACHE_KEY_ARCHIVE = 'offline_archive_records';

// --- API ---

export const migrateCungCapTaiLieu = async () => {
    // Reverse migration: move 'Cung cấp tài liệu đất đai' from archive_records to land_records
    if (!isConfigured) return;
    try {
        const { data: archiveData, error: fetchError } = await supabase
            .from('archive_records')
            .select('*')
            .eq('type', 'saoluc');
            
        if (fetchError) throw fetchError;
        if (!archiveData || archiveData.length === 0) return;

        // Di chuyển toàn bộ các hồ sơ Sao Lục cũ, chuyển đổi sang loại 'Cung cấp tài liệu đất đai' chuẩn
        const cungCapRecords = archiveData;
        console.log(`Found ${cungCapRecords.length} records to reverse migrate.`);

        const landRecordsToInsert = cungCapRecords.map(r => {
            const rData = r.data || {};
            const { xa_phuong, to_ban_do, thua_dat, hen_tra, ...originalData } = rData;
            
            // Đồng bộ chuyển đổi trạng thái bản ghi tương thích
            let status = 'RECEIVED';
            if (r.status === 'assigned') status = 'ASSIGNED';
            else if (r.status === 'executed') status = 'COMPLETED_WORK';
            else if (r.status === 'pending_check') status = 'PENDING_CHECK';
            else if (r.status === 'checked') status = 'CHECKED';
            else if (r.status === 'pending_sign') status = 'PENDING_SIGN';
            else if (r.status === 'signed') status = 'SIGNED';
            else if (r.status === 'completed') status = 'RETURNED';
            else if (r.status === 'rejected') status = 'REJECTED';
            else if (r.status === 'withdrawn') status = 'WITHDRAWN';

            // Khôi phục đầy đủ, vẹn toàn tất cả thông tin bị thiếu hụt hoặc rách nát cột trước đó
            const safeData: any = {
                id: r.id, // Sử dụng nguyên vẹn ID gốc UUID của archive_records để tránh nhân bản hồ sơ trùng mã hiệu
                code: r.so_hieu || originalData.code,
                customerName: r.noi_nhan_gui || originalData.customerName || 'Chưa Cập Nhật',
                receivedDate: r.ngay_thang || originalData.receivedDate,
                ward: xa_phuong || originalData.ward,
                mapSheet: to_ban_do || originalData.mapSheet,
                landPlot: thua_dat || originalData.landPlot,
                deadline: hen_tra || originalData.deadline,
                recordType: 'Cung cấp tài liệu đất đai',
                status: status,
                assignedTo: originalData.assigned_to || originalData.assignedTo,
                assignedDate: originalData.assigned_date || originalData.assignedDate,
                completedWorkDate: originalData.ngay_hoan_thanh || originalData.completedWorkDate
            };

            const validCols = [
                'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'customerAddress', 'ward', 'landPlot', 'mapSheet', 
                'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'receivedBy', 'deadline', 
                'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'submittedTo', 'checkedBy',
                'pendingCheckDate', 'checkedDate', 'completedWorkDate',
                'notes', 'privateNotes', 'personalNotes', 
                'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'handoverWard',
                'measurementNumber', 'excerptNumber',
                'reminderDate', 'lastRemindedAt',
                'receiptNumber', 'resultReturnedDate', 'receiverName',
                'needsMapCorrection', 'explanationPlan',
                'issueNumber', 'entryNumber', 'issueDate', 'residentialArea'
            ];

            // Bảo toàn thêm các trường hợp lệ khác
            for (const key of Object.keys(originalData)) {
                if (validCols.includes(key) && safeData[key] === undefined) {
                    safeData[key] = originalData[key];
                }
            }
            return safeData;
        });

        // Insert into land_records using upsert to avoid conflicts on duplicate IDs
        const { error: insertError } = await supabase
            .from('land_records')
            .upsert(landRecordsToInsert);
            
        if (insertError) throw insertError;

        const idsToDelete = cungCapRecords.map(r => r.id);
        const { error: deleteError } = await supabase
            .from('archive_records')
            .delete()
            .in('id', idsToDelete);
            
        if (deleteError) throw deleteError;

        console.log('Reverse migration completed successfully.');
    } catch (error) {
        console.error('Reverse migration failed:', error);
    }
};

export const fetchArchiveRecords = async (type: 'saoluc' | 'vaoso' | 'congvan'): Promise<ArchiveRecord[]> => {
    if (!isConfigured) {
        const cached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        // Nếu cache rỗng và chưa có mock in-mem, dùng mảng rỗng. Nếu mock có data thì dùng mock (để sync trong session)
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
    try {
        let allData: ArchiveRecord[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('archive_records')
                .select('*')
                .eq('type', type)
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;
            
            if (data && data.length > 0) {
                allData = [...allData, ...data as ArchiveRecord[]];
                if (data.length < pageSize) hasMore = false;
                else page++;
            } else {
                hasMore = false;
            }
        }
        return allData;
    } catch (error) {
        logError(`fetchArchiveRecords-${type}`, error);
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
};

export const saveArchiveRecord = async (record: Partial<ArchiveRecord>): Promise<ArchiveRecord | null> => {
    if (!isConfigured) {
        if (record.id) {
            const idx = MOCK_ARCHIVE.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                MOCK_ARCHIVE[idx] = { ...MOCK_ARCHIVE[idx], ...record } as ArchiveRecord;
                saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
                return MOCK_ARCHIVE[idx];
            }
        } else {
            const newRec = { 
                ...record, 
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9), 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);
            saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
            return newRec;
        }
        return null;
    }
    try {
        // Chuẩn hóa dữ liệu
        const payload: any = { ...record };
        
        // Xử lý ngày tháng: Nếu rỗng thì set null để tránh lỗi định dạng DATE của PostgreSQL
        if (payload.ngay_thang === '') payload.ngay_thang = null;

        if (record.id) {
            const { data, error } = await supabase.from('archive_records').update({ 
                status: payload.status,
                so_hieu: payload.so_hieu,
                trich_yeu: payload.trich_yeu,
                ngay_thang: payload.ngay_thang,
                noi_nhan_gui: payload.noi_nhan_gui,
                data: payload.data
            }).eq('id', record.id).select();
            
            if (error) throw error;
            return data && data.length > 0 ? (data[0] as ArchiveRecord) : null;
        } else {
            if (!payload.id) {
                payload.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            }
            
            const { data, error } = await supabase.from('archive_records').insert([payload]).select();
            if (error) throw error;
            return data && data.length > 0 ? (data[0] as ArchiveRecord) : null;
        }
    } catch (error: any) {
        // Xử lý thông báo lỗi cụ thể cho 22P02 (Sai kiểu dữ liệu, ví dụ text vào trường UUID hoặc Date sai format)
        if (error.code === '22P02') {
            console.error("Lỗi định dạng dữ liệu (22P02):", error.message);
            logError("saveArchiveRecord", "Sai định dạng dữ liệu (Lỗi 22P02). Kiểm tra các trường Số hoặc Ngày tháng.");
        } else {
            logError("saveArchiveRecord", error);
        }
        return null;
    }
};

export const deleteArchiveRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_ARCHIVE.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_ARCHIVE.splice(idx, 1);
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        const { error } = await supabase.from('archive_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteArchiveRecord", error);
        return false;
    }
};

export const importArchiveRecords = async (records: Partial<ArchiveRecord>[]): Promise<boolean> => {
    if (!isConfigured) {
        records.forEach(r => {
            const newRec = { 
                ...r, 
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9), 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);
        });
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        // Chuẩn hóa dữ liệu trước khi insert
        const payload = records.map(r => {
            const p: any = { ...r };
            if (!p.id) p.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            if (p.ngay_thang === '') p.ngay_thang = null;
            return p;
        });

        const { error } = await supabase.from('archive_records').insert(payload);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("importArchiveRecords", error);
        return false;
    }
};

export const updateArchiveRecordsBatch = async (ids: string[], updates: Partial<ArchiveRecord>): Promise<boolean> => {
    if (!isConfigured) {
        MOCK_ARCHIVE = MOCK_ARCHIVE.map(r => {
            if (ids.includes(r.id)) {
                // Merge data field if exists
                const newData = updates.data ? { ...r.data, ...updates.data } : r.data;
                return { ...r, ...updates, data: newData } as ArchiveRecord;
            }
            return r;
        });
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        // Lưu ý: data field trong supabase update sẽ replace toàn bộ jsonb nếu không dùng jsonb_set.
        // Tuy nhiên, ở đây ta giả định updates.data chứa các trường cần merge, nhưng Supabase JS client update jsonb là replace.
        // Để merge, ta cần logic phức tạp hơn hoặc fetch về rồi update.
        // Nhưng với yêu cầu "Chuyển Scan", ta chỉ update thêm trường vào data.
        // Cách đơn giản: Dùng RPC hoặc chấp nhận fetch-update nếu số lượng ít.
        // Hoặc: update từng dòng (chậm nhưng an toàn cho JSON merge).
        
        // Cách tối ưu hơn cho Supabase: Update các trường thường, còn JSON thì...
        // Tạm thời loop update để đảm bảo merge JSON đúng (an toàn nhất mà không cần store procedure)
        
        const { data: currentRecords, error: fetchError } = await supabase
            .from('archive_records')
            .select('id, data')
            .in('id', ids);
            
        if (fetchError) throw fetchError;

        const promises = currentRecords.map(r => {
            let mergedData = { ...r.data, ...(updates.data || {}) };

            // Special handling for history: append instead of replace if updates.data.history exists
            if (updates.data && updates.data.history && Array.isArray(updates.data.history)) {
                const oldHistory = Array.isArray(r.data?.history) ? r.data.history : [];
                // Assuming updates.data.history contains NEW items to append
                mergedData.history = [...oldHistory, ...updates.data.history];
            }

            const payload = { ...updates, data: mergedData };
            return supabase.from('archive_records').update(payload).eq('id', r.id);
        });

        await Promise.all(promises);
        return true;
    } catch (error) {
        logError("updateArchiveRecordsBatch", error);
        return false;
    }
};

export const fetchListsByDate = async (type: 'saoluc' | 'congvan', date: string): Promise<string[]> => {
    if (!isConfigured) {
        const lists = new Set<string>();
        MOCK_ARCHIVE.forEach(r => {
            if (r.type === type && r.data?.ngay_hoan_thanh === date && r.data?.danh_sach) {
                lists.add(r.data.danh_sach);
            }
        });
        return Array.from(lists).sort();
    }

    try {
        const { data, error } = await supabase
            .from('archive_records')
            .select('data')
            .eq('type', type)
            .contains('data', { ngay_hoan_thanh: date });

        if (error) throw error;

        const lists = new Set<string>();
        data?.forEach((r: any) => {
            if (r.data?.danh_sach) {
                lists.add(r.data.danh_sach);
            }
        });
        
        return Array.from(lists).sort();
    } catch (error) {
        logError(`fetchListsByDate-${type}`, error);
        return [];
    }
};
