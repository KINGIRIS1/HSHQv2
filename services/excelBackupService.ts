import { RecordFile, Employee } from '../types';
import { generateRecordsWorkbookBase64 } from '../utils/excelExport';
import * as XLSX from 'xlsx-js-style';
import { getSystemSetting, saveSystemSetting } from './apiSystem';

export const EXCEL_BACKUP_PERIOD_DAYS = 5;
export const EXCEL_BACKUP_PERIOD_MS = EXCEL_BACKUP_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Tạo tên file sao lưu theo định dạng: Backup-DD-mm-yyyy.xlsx
 */
export const getExcelBackupFileName = (date: Date = new Date()): string => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `Backup-${dd}-${mm}-${yyyy}.xlsx`;
};

export const EXCEL_BACKUP_FILENAME = getExcelBackupFileName();

export interface ExcelBackupResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    message?: string;
    error?: string;
    time?: string;
}

/**
 * Lấy đường dẫn thư mục sao lưu Excel từ hệ thống (nếu có cấu hình)
 */
export const getExcelBackupDirectory = async (): Promise<string> => {
    return '';
};

/**
 * Lưu đường dẫn thư mục sao lưu Excel vào hệ thống
 */
export const saveExcelBackupDirectory = async (dir: string): Promise<boolean> => {
    return true;
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
 * Gửi dữ liệu Excel lên máy chủ để lưu trữ dự phòng
 */
export const saveExcelBackupToServer = async (
    base64Data: string,
    customDirectory: string = '',
    fileName: string = getExcelBackupFileName()
): Promise<ExcelBackupResult> => {
    try {
        const response = await fetch('/api/backup/excel-overwrite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                base64Data,
                customDirectory: customDirectory ? customDirectory.trim() : '',
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
            fileName: data.fileName || fileName,
            message: data.message,
            time: data.time
        };
    } catch (err: any) {
        console.warn("Không thể lưu file Excel đè lên server:", err);
        return {
            success: false,
            fileName: fileName,
            error: err.message || "Không thể kết nối đến server để ghi đè file."
        };
    }
};

/**
 * Thực hiện xuất toàn bộ hồ sơ ra Excel và tải trực tiếp về máy (Downloads)
 */
export const performExcelBackup = async (
    records: RecordFile[],
    employees: Employee[],
    explicitFileName?: string
): Promise<ExcelBackupResult> => {
    if (!records || records.length === 0) {
        return {
            success: false,
            error: "Không có hồ sơ nào để sao lưu."
        };
    }

    const fileName = explicitFileName || getExcelBackupFileName();

    try {
        // Tạo file Excel với định dạng chuẩn
        const { wb, base64 } = await generateRecordsWorkbookBase64(
            records,
            employees,
            `BẢNG SAO LƯU ĐỊNH KỲ TOÀN BỘ HỒ SƠ (${records.length} HỒ SƠ)`
        );

        // Tải ngay file về máy khách (Browser Download vào thư mục Downloads)
        try {
            XLSX.writeFile(wb, fileName);
        } catch (downloadErr) {
            console.warn("Không thể kích hoạt tải xuống trình duyệt:", downloadErr);
        }

        // Lưu bản dự phòng lên máy chủ
        const serverResult = await saveExcelBackupToServer(base64, '', fileName);
        
        const now = Date.now();
        await setLastExcelBackupTime(now);
        window.dispatchEvent(new CustomEvent('excel_backup_success', {
            detail: {
                fileName: fileName,
                filePath: serverResult.filePath,
                time: now,
                count: records.length
            }
        }));

        return {
            success: true,
            fileName: fileName,
            filePath: serverResult.filePath,
            message: `Đã sao lưu thành công ${records.length} hồ sơ vào file ${fileName}`
        };
    } catch (err: any) {
        console.error("Lỗi trong quá trình tạo sao lưu Excel:", err);
        return {
            success: false,
            fileName: fileName,
            error: err.message || "Lỗi không xác định khi xuất file Excel sao lưu."
        };
    }
};

/**
 * Kiểm tra chu kỳ 5 ngày và tự động thực hiện sao lưu
 */
export const checkAndTriggerPeriodicExcelBackup = async (
    records: RecordFile[],
    employees: Employee[]
): Promise<{ triggered: boolean; result?: ExcelBackupResult }> => {
    const lastTime = await getLastExcelBackupTime();
    const now = Date.now();

    // Nếu chưa từng sao lưu hoặc đã đủ 5 ngày (432,000,000 ms)
    if (!lastTime || (now - lastTime) >= EXCEL_BACKUP_PERIOD_MS) {
        console.log(`[EXCEL BACKUP] Đã đến hạn định kỳ (hoặc lần đầu). Bắt đầu sao lưu ${records.length} hồ sơ...`);
        const result = await performExcelBackup(records, employees);
        return { triggered: true, result };
    }

    return { triggered: false };
};
