import { 
    fetchRecords, 
    fetchContracts, 
    fetchEmployees, 
    fetchUsers, 
    fetchArchiveRecords, 
    fetchHolidays, 
    getSystemSetting, 
    saveSystemSetting,
    fetchWorkSchedules,
    fetchExcerptHistory,
    fetchExcerptCounters
} from './api';
import { RecordFile, Contract, Employee, User, Holiday } from '../types';
import { 
    fetchVphcRecords, 
    fetchBienBanRecords, 
    fetchThongTinRecords, 
    fetchChinhLyRecords, 
    fetchTachThuaRecords, 
    fetchMapSheetConversions 
} from './apiUtilities';
import { supabase, isConfigured } from './supabaseClient';

export interface FullBackupData {
    backup_time: string;
    version: string;
    data: {
        records: RecordFile[];
        contracts: Contract[];
        employees: Employee[];
        users: User[];
        holidays: Holiday[];
        archive_vaoso: any[];
        archive_saoluc: any[];
        archive_congvan: any[];
        // Các bước xử lý nghiệp vụ & dữ liệu khác
        vphc_records?: any[];
        bienban_records?: any[];
        thongtin_records?: any[];
        chinhly_records?: any[];
        tachthua_records?: any[];
        map_sheet_conversions?: any[];
        work_schedules?: any[];
        excerpt_history?: any[];
        excerpt_counters?: any;
        system_settings?: any[];
    };
}

/**
 * Tạo dữ liệu sao lưu đầy đủ từ hệ thống (kết nối Supabase hoặc Cache Offline)
 */
export const createFullBackupData = async (): Promise<FullBackupData> => {
    try {
        const [
            records,
            contracts,
            employees,
            users,
            holidays,
            archiveVaoso,
            archiveSaoluc,
            archiveCongvan,
            vphcRecords,
            bienbanRecords,
            thongtinRecords,
            chinhlyRecords,
            tachthuaRecords,
            mapSheetConversions,
            workSchedules,
            excerptHistory,
            excerptCounters
        ] = await Promise.all([
            fetchRecords().catch(() => []),
            fetchContracts().catch(() => []),
            fetchEmployees().catch(() => []),
            fetchUsers().catch(() => []),
            fetchHolidays().catch(() => []),
            fetchArchiveRecords('vaoso').catch(() => []),
            fetchArchiveRecords('saoluc').catch(() => []),
            fetchArchiveRecords('congvan').catch(() => []),
            fetchVphcRecords().catch(() => []),
            fetchBienBanRecords().catch(() => []),
            fetchThongTinRecords().catch(() => []),
            fetchChinhLyRecords().catch(() => []),
            fetchTachThuaRecords().catch(() => []),
            fetchMapSheetConversions().catch(() => []),
            fetchWorkSchedules().catch(() => []),
            fetchExcerptHistory().catch(() => []),
            fetchExcerptCounters().catch(() => ({}))
        ]);

        let systemSettings: any[] = [];
        if (isConfigured) {
            try {
                const { data } = await supabase.from('system_settings').select('*');
                if (data) systemSettings = data;
            } catch (e) {
                console.error("Lỗi khi sao lưu system_settings từ Supabase:", e);
            }
        }

        return {
            backup_time: new Date().toISOString(),
            version: '2.2.0',
            data: {
                records,
                contracts,
                employees,
                users,
                holidays,
                archive_vaoso: archiveVaoso,
                archive_saoluc: archiveSaoluc,
                archive_congvan: archiveCongvan,
                vphc_records: vphcRecords,
                bienban_records: bienbanRecords,
                thongtin_records: thongtinRecords,
                chinhly_records: chinhlyRecords,
                tachthua_records: tachthuaRecords,
                map_sheet_conversions: mapSheetConversions,
                work_schedules: workSchedules,
                excerpt_history: excerptHistory,
                excerpt_counters: excerptCounters,
                system_settings: systemSettings
            }
        };
    } catch (error) {
        console.error("Lỗi khi tạo dữ liệu sao lưu:", error);
        throw error;
    }
};

/**
 * Khôi phục toàn bộ dữ liệu sao lưu lên Supabase (cho môi trường Cloud)
 */
export const restoreFullBackupToSupabase = async (backupData: FullBackupData): Promise<boolean> => {
    if (!isConfigured) return false;
    
    try {
        const { data: bData } = backupData;
        if (!bData) return false;

        const chunkArray = <T>(arr: T[], size: number): T[][] => {
            const chunked: T[][] = [];
            for (let i = 0; i < arr.length; i += size) {
                chunked.push(arr.slice(i, i + size));
            }
            return chunked;
        };

        // 1. Khôi phục land_records
        if (bData.records) {
            const { error } = await supabase.from('land_records').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa land_records:", error);
            if (bData.records.length > 0) {
                const chunks = chunkArray(bData.records, 200);
                for (const chunk of chunks) {
                    const { error: insErr } = await supabase.from('land_records').insert(chunk);
                    if (insErr) throw insErr;
                }
            }
        }

        // 2. Khôi phục contracts
        if (bData.contracts) {
            const { error } = await supabase.from('contracts').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa contracts:", error);
            if (bData.contracts.length > 0) {
                const chunks = chunkArray(bData.contracts, 200);
                for (const chunk of chunks) {
                    const { error: insErr } = await supabase.from('contracts').insert(chunk);
                    if (insErr) throw insErr;
                }
            }
        }

        // 3. Khôi phục employees
        if (bData.employees) {
            const { error } = await supabase.from('employees').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa employees:", error);
            if (bData.employees.length > 0) {
                const { error: insErr } = await supabase.from('employees').insert(bData.employees);
                if (insErr) throw insErr;
            }
        }

        // 4. Khôi phục users
        if (bData.users) {
            const { error } = await supabase.from('users').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa users:", error);
            if (bData.users.length > 0) {
                const { error: insErr } = await supabase.from('users').insert(bData.users);
                if (insErr) throw insErr;
            }
        }

        // 5. Khôi phục holidays
        if (bData.holidays) {
            const { error } = await supabase.from('holidays').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa holidays:", error);
            if (bData.holidays.length > 0) {
                const { error: insErr } = await supabase.from('holidays').insert(bData.holidays);
                if (insErr) throw insErr;
            }
        }

        // 6. Khôi phục archive_records (gộp vaoso, saoluc, congvan)
        const combinedArchive: any[] = [];
        if (bData.archive_vaoso) combinedArchive.push(...bData.archive_vaoso);
        if (bData.archive_saoluc) combinedArchive.push(...bData.archive_saoluc);
        if (bData.archive_congvan) combinedArchive.push(...bData.archive_congvan);
        
        if (combinedArchive.length > 0) {
            const { error } = await supabase.from('archive_records').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa archive_records:", error);
            const chunks = chunkArray(combinedArchive, 200);
            for (const chunk of chunks) {
                const { error: insErr } = await supabase.from('archive_records').insert(chunk);
                if (insErr) throw insErr;
            }
        }

        // 7. Khôi phục vphc_records
        if (bData.vphc_records) {
            const { error } = await supabase.from('vphc_records').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa vphc_records:", error);
            if (bData.vphc_records.length > 0) {
                const { error: insErr } = await supabase.from('vphc_records').insert(bData.vphc_records);
                if (insErr) throw insErr;
            }
        }

        // 8. Khôi phục bienban_records
        if (bData.bienban_records) {
            const { error } = await supabase.from('bienban_records').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa bienban_records:", error);
            if (bData.bienban_records.length > 0) {
                const { error: insErr } = await supabase.from('bienban_records').insert(bData.bienban_records);
                if (insErr) throw insErr;
            }
        }

        // 9. Khôi phục thongtin_records
        if (bData.thongtin_records) {
            const { error } = await supabase.from('thongtin_records').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa thongtin_records:", error);
            if (bData.thongtin_records.length > 0) {
                const { error: insErr } = await supabase.from('thongtin_records').insert(bData.thongtin_records);
                if (insErr) throw insErr;
            }
        }

        // 10. Khôi phục chinhly_records
        if (bData.chinhly_records) {
            const { error } = await supabase.from('chinhly_records').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa chinhly_records:", error);
            if (bData.chinhly_records.length > 0) {
                const { error: insErr } = await supabase.from('chinhly_records').insert(bData.chinhly_records);
                if (insErr) throw insErr;
            }
        }

        // 11. Khôi phục tachthua_records
        if (bData.tachthua_records) {
            const { error } = await supabase.from('tachthua_records').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa tachthua_records:", error);
            if (bData.tachthua_records.length > 0) {
                const { error: insErr } = await supabase.from('tachthua_records').insert(bData.tachthua_records);
                if (insErr) throw insErr;
            }
        }

        // 12. Khôi phục map_sheet_conversions
        if (bData.map_sheet_conversions) {
            const { error } = await supabase.from('map_sheet_conversions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) console.warn("Lỗi xóa map_sheet_conversions:", error);
            if (bData.map_sheet_conversions.length > 0) {
                const chunks = chunkArray(bData.map_sheet_conversions, 200);
                for (const chunk of chunks) {
                    const { error: insErr } = await supabase.from('map_sheet_conversions').insert(chunk);
                    if (insErr) throw insErr;
                }
            }
        }

        // 13. Khôi phục work_schedules
        if (bData.work_schedules) {
            const { error } = await supabase.from('work_schedules').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa work_schedules:", error);
            if (bData.work_schedules.length > 0) {
                const { error: insErr } = await supabase.from('work_schedules').insert(bData.work_schedules);
                if (insErr) throw insErr;
            }
        }

        // 14. Khôi phục excerpt_history
        if (bData.excerpt_history) {
            const { error } = await supabase.from('excerpt_history').delete().neq('id', '0');
            if (error) console.warn("Lỗi xóa excerpt_history:", error);
            if (bData.excerpt_history.length > 0) {
                const chunks = chunkArray(bData.excerpt_history, 200);
                for (const chunk of chunks) {
                    const { error: insErr } = await supabase.from('excerpt_history').insert(chunk);
                    if (insErr) throw insErr;
                }
            }
        }

        // 15. Khôi phục excerpt_counters
        if (bData.excerpt_counters) {
            const { error } = await supabase.from('excerpt_counters').delete().neq('ward', '0');
            if (error) console.warn("Lỗi xóa excerpt_counters:", error);
            
            const rowsToInsert = Object.entries(bData.excerpt_counters).map(([ward, count]) => ({
                ward,
                count
            }));
            
            if (rowsToInsert.length > 0) {
                const { error: insErr } = await supabase.from('excerpt_counters').insert(rowsToInsert);
                if (insErr) throw insErr;
            }
        }

        // 16. Khôi phục system_settings
        if (bData.system_settings && bData.system_settings.length > 0) {
            const { error } = await supabase.from('system_settings').delete().neq('key', '0');
            if (error) console.warn("Lỗi xóa system_settings:", error);
            const { error: insErr } = await supabase.from('system_settings').insert(bData.system_settings);
            if (insErr) throw insErr;
        }

        return true;
    } catch (err) {
        console.error("Lỗi khôi phục Supabase:", err);
        throw err;
    }
};

/**
 * Tải xuống tệp sao lưu JSON cục bộ về máy người dùng
 */
export const downloadBackupAsFile = (backupData: FullBackupData) => {
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.href = url;
    link.download = `sao_luu_he_thong_${dateStr}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Gửi dữ liệu sao lưu lên Server để lưu trữ vào thư mục chỉ định
 */
export const saveBackupToServer = async (
    backupData: FullBackupData, 
    customDirectory?: string
): Promise<{ success: boolean; filePath?: string; fileName?: string; error?: string }> => {
    try {
        const response = await fetch('/api/backup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                backupData,
                customDirectory
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${response.status}`);
        }

        return await response.json();
    } catch (err: any) {
        console.warn("Không thể lưu bản sao lưu lên Server (Có thể do đang chạy offline hoặc không có kết nối Server):", err);
        return { success: false, error: err.message };
    }
};

/**
 * Kiểm tra và tự động thực hiện sao lưu hàng tuần cho Quản trị viên
 */
export const checkAndTriggerWeeklyBackup = async (
    currentUser: User | null
): Promise<{ 
    triggered: boolean; 
    success: boolean; 
    backupData?: FullBackupData;
    filePath?: string;
    error?: string;
} | null> => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUBADMIN')) {
        return null; // Chỉ tự động kích hoạt cho quản trị viên/phó giám đốc
    }

    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const lastBackupTimeStr = localStorage.getItem('last_weekly_backup_time');
    const now = Date.now();

    // Nếu đã sao lưu trong vòng 7 ngày qua thì bỏ qua
    if (lastBackupTimeStr) {
        const lastBackupTime = parseInt(lastBackupTimeStr, 10);
        if (now - lastBackupTime < ONE_WEEK_MS) {
            return { triggered: false, success: false };
        }
    }

    try {
        console.log("=== BẮT ĐẦU TỰ ĐỘNG SAO LƯU HÀNG TUẦN ===");
        const backupData = await createFullBackupData();
        
        // Lấy thư mục lưu trữ chỉ định từ cấu hình hệ thống (nếu có)
        const customDirectory = await getSystemSetting('backup_directory') || '';
        
        // Lưu trữ lên server
        const serverResult = await saveBackupToServer(backupData, customDirectory);
        
        // Cập nhật mốc thời gian đã sao lưu thành công
        localStorage.setItem('last_weekly_backup_time', now.toString());
        await saveSystemSetting('last_weekly_backup_time_cloud', now.toString()).catch(() => {});

        return {
            triggered: true,
            success: true,
            backupData,
            filePath: serverResult.success ? serverResult.filePath : undefined
        };
    } catch (error: any) {
        console.error("Lỗi tự động sao lưu hàng tuần:", error);
        return {
            triggered: true,
            success: false,
            error: error.message
        };
    }
};
