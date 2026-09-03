import { RecordFile, Employee } from '../types';
import { generateRecordsWorkbookBase64 } from '../utils/excelExport';
import { getSystemSetting, saveSystemSetting } from './apiSystem';

export const EXCEL_BACKUP_PERIOD_DAYS = 5;
export const EXCEL_BACKUP_PERIOD_MS = EXCEL_BACKUP_PERIOD_DAYS * 24 * 60 * 60 * 1000;
export const EXCEL_BACKUP_FILENAME = 'Sao_Luu_Toan_Bo_Ho_So.xlsx';

export interface ExcelBackupResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    message?: string;
    error?: string;
    time?: string;
}

/**
 * Lấy đường dẫn thư mục sao lưu Excel từ hệ thống
 */
export const getExcelBackupDirectory = async (): Promise<string> => {
    try {
        const cloudDir = await getSystemSetting('excel_backup_directory');
        if (cloudDir && cloudDir.trim()) {
            localStorage.setItem('excel_backup_directory', cloudDir.trim());
            return cloudDir.trim();
        }
    } catch (e) {
        console.warn("Không thể lấy đường dẫn sao lưu từ Cloud:", e);
    }
    return localStorage.getItem('excel_backup_directory') || '';
};

/**
 * Lưu đường dẫn thư mục sao lưu Excel vào hệ thống
 */
export const saveExcelBackupDirectory = async (dir: string): Promise<boolean> => {
    const trimmed = dir.trim();
    localStorage.setItem('excel_backup_directory', trimmed);
    try {
        await saveSystemSetting('excel_backup_directory', trimmed);
        window.dispatchEvent(new CustomEvent('excel_backup_dir_updated', { detail: { directory: trimmed } }));
        return true;
    } catch (e) {
        console.warn("Lỗi khi lưu cấu hình thư mục sao lưu:", e);
        window.dispatchEvent(new CustomEvent('excel_backup_dir_updated', { detail: { directory: trimmed } }));
        return true;
    }
};

/**
 * Lấy thời gian sao lưu Excel gần nhất
 */
export const getLastExcelBackupTime = async (): Promise<number | null> => {
    const local = localStorage.getItem('excel_backup_last_time');
    if (local) {
        const parsed = parseInt(local, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    try {
        const cloudTime = await getSystemSetting('excel_backup_last_time');
        if (cloudTime) {
            const parsed = parseInt(cloudTime, 10);
            if (!isNaN(parsed) && parsed > 0) {
                localStorage.setItem('excel_backup_last_time', cloudTime);
                return parsed;
            }
        }
    } catch (e) {
        // ignore
    }
    return null;
};

/**
 * Cập nhật thời gian sao lưu Excel gần nhất
 */
export const setLastExcelBackupTime = async (time: number): Promise<void> => {
    localStorage.setItem('excel_backup_last_time', time.toString());
    try {
        await saveSystemSetting('excel_backup_last_time', time.toString());
    } catch (e) {
        console.warn("Không thể lưu thời gian sao lưu lên hệ thống:", e);
    }
};

/**
 * Gửi dữ liệu Excel lên máy chủ để ghi đè vào file cũ
 */
export const saveExcelBackupToServer = async (
    base64Data: string,
    customDirectory: string,
    fileName: string = EXCEL_BACKUP_FILENAME
): Promise<ExcelBackupResult> => {
    try {
        const response = await fetch('/api/backup/excel-overwrite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                base64Data,
                customDirectory: customDirectory.trim(),
                fileName
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            filePath: data.filePath,
            fileName: data.fileName,
            message: data.message,
            time: data.time
        };
    } catch (err: any) {
        console.warn("Không thể lưu file Excel đè lên server:", err);
        return {
            success: false,
            error: err.message || "Không thể kết nối đến server để ghi đè file."
        };
    }
};

/**
 * Thực hiện xuất toàn bộ hồ sơ ra Excel và ghi đè vào file cũ
 */
export const performExcelBackup = async (
    records: RecordFile[],
    employees: Employee[],
    explicitDir?: string
): Promise<ExcelBackupResult> => {
    if (!records || records.length === 0) {
        return {
            success: false,
            error: "Không có hồ sơ nào để sao lưu."
        };
    }

    const dir = explicitDir !== undefined ? explicitDir : await getExcelBackupDirectory();

    try {
        // Tạo file Excel với định dạng chuẩn
        const { base64 } = await generateRecordsWorkbookBase64(
            records,
            employees,
            `BẢNG SAO LƯU ĐỊNH KỲ TOÀN BỘ HỒ SƠ (${records.length} HỒ SƠ)`
        );

        // Ghi đè vào file trên máy chủ / thư mục cấu hình
        const result = await saveExcelBackupToServer(base64, dir, EXCEL_BACKUP_FILENAME);
        
        if (result.success) {
            const now = Date.now();
            await setLastExcelBackupTime(now);
            window.dispatchEvent(new CustomEvent('excel_backup_success', {
                detail: {
                    filePath: result.filePath,
                    time: now,
                    count: records.length
                }
            }));
        }

        return result;
    } catch (err: any) {
        console.error("Lỗi trong quá trình tạo sao lưu Excel:", err);
        return {
            success: false,
            error: err.message || "Lỗi không xác định khi xuất và ghi đè file Excel."
        };
    }
};

/**
 * Kiểm tra chu kỳ 5 ngày và tự động thực hiện sao lưu
 */
export const checkAndTriggerPeriodicExcelBackup = async (
    records: RecordFile[],
    employees: Employee[]
): Promise<{ triggered: boolean; result?: ExcelBackupResult; needConfig?: boolean }> => {
    const dir = await getExcelBackupDirectory();
    if (!dir || !dir.trim()) {
        return { triggered: false, needConfig: true };
    }

    const lastTime = await getLastExcelBackupTime();
    const now = Date.now();

    // Nếu chưa từng sao lưu hoặc đã đủ 5 ngày (432,000,000 ms)
    if (!lastTime || (now - lastTime) >= EXCEL_BACKUP_PERIOD_MS) {
        console.log(`[EXCEL BACKUP] Đã đến hạn 5 ngày định kỳ (hoặc lần đầu). Bắt đầu sao lưu toàn bộ ${records.length} hồ sơ...`);
        const result = await performExcelBackup(records, employees, dir);
        return { triggered: true, result };
    }

    return { triggered: false };
};
