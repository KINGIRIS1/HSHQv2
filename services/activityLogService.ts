import { SystemActivityLog, RecordFile, User, Employee, DangKyRecord } from '../types';
import * as XLSX from 'xlsx-js-style';

const LOGS_STORAGE_KEY = 'system_activity_logs_v1';

export const getStoredActivityLogs = (): SystemActivityLog[] => {
    try {
        const raw = localStorage.getItem(LOGS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                // Filter out any legacy synthetic fake logs (starting with SYN_)
                const cleanLogs = parsed.filter(item => item && !String(item.id || '').startsWith('SYN_'));
                return cleanLogs;
            }
        }
    } catch (e) {
        console.error('Error reading system activity logs from localStorage:', e);
    }
    return [];
};

export const addActivityLog = (logData: Omit<SystemActivityLog, 'id' | 'timestamp'> & { timestamp?: string }): SystemActivityLog => {
    const logs = getStoredActivityLogs();
    const newLog: SystemActivityLog = {
        id: `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: logData.timestamp || new Date().toISOString(),
        performerName: logData.performerName || 'Hệ thống',
        performerRole: logData.performerRole || 'ONEDOOR',
        actionType: logData.actionType || 'UPDATE',
        actionLabel: logData.actionLabel || 'Cập nhật',
        targetType: logData.targetType || 'Hồ sơ',
        referenceCode: logData.referenceCode || '-',
        details: logData.details || '',
        recordId: logData.recordId
    };

    const updatedLogs = [newLog, ...logs].slice(0, 3000); // Max 3000 logs
    try {
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
    } catch (e) {
        console.error('Error saving system activity log:', e);
    }
    return newLog;
};

export const clearStoredActivityLogs = (): void => {
    try {
        localStorage.removeItem(LOGS_STORAGE_KEY);
    } catch (e) {
        console.error('Error clearing activity logs:', e);
    }
};

/**
 * Returns all real system activity logs recorded when users interact with the application.
 */
export const getAllSystemActivityLogs = (
    _records: RecordFile[] = [],
    _users: User[] = [],
    _employees: Employee[] = [],
    _dangKyRecords: DangKyRecord[] = []
): SystemActivityLog[] => {
    const stored = getStoredActivityLogs();
    return stored.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
};

export const exportActivityLogsToExcel = (logs: SystemActivityLog[]) => {
    const headers = [
        'STT',
        'Thời gian',
        'Người thực hiện',
        'Bộ phận/Vai trò',
        'Hành động',
        'Đối tượng',
        'Mã tham chiếu',
        'Chi tiết thao tác'
    ];

    const rows = logs.map((log, index) => {
        const d = new Date(log.timestamp);
        const timeStr = isNaN(d.getTime()) ? log.timestamp : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        return [
            index + 1,
            timeStr,
            log.performerName,
            log.performerRole || 'ONEDOOR',
            log.actionLabel,
            log.targetType,
            log.referenceCode || '-',
            log.details
        ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
        ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
        ['Độc lập - Tự do - Hạnh phúc'],
        [''],
        ['LỊCH SỬ THAO TÁC HỆ THỐNG'],
        [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
        [''],
        headers,
        ...rows
    ]);

    const totalCols = headers.length - 1;
    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } }
    ];

    if(worksheet['A1']) worksheet['A1'].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    if(worksheet['A2']) worksheet['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if(worksheet['A4']) worksheet['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
    if(worksheet['A5']) worksheet['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };

    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const headerStyle = {
        font: { name: "Times New Roman", sz: 11, bold: true },
        fill: { fgColor: { rgb: "E0E0E0" } },
        border: borderStyle,
        alignment: { horizontal: "center", vertical: "center", wrapText: true }
    };
    const cellStyle = {
        font: { name: "Times New Roman", sz: 11 },
        border: borderStyle,
        alignment: { vertical: "center", wrapText: true }
    };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

    const headerRowIdx = 6;
    const dataStartIdx = 7;

    for (let c = 0; c <= totalCols; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
        if (!worksheet[headerRef]) worksheet[headerRef] = { v: "", t: "s" };
        worksheet[headerRef].s = headerStyle;

        for (let r = dataStartIdx; r < dataStartIdx + rows.length; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!worksheet[cellRef]) worksheet[cellRef] = { v: "", t: "s" };

            // Center STT(0), Time(1), Role(3), Action(4), Type(5), Code(6)
            if ([0, 1, 3, 4, 5, 6].includes(c)) worksheet[cellRef].s = centerStyle;
            else worksheet[cellRef].s = cellStyle;
        }
    }

    worksheet['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 22 },
        { wch: 15 },
        { wch: 18 },
        { wch: 15 },
        { wch: 18 },
        { wch: 65 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lịch_sử_thao_tác');

    const fileName = `Lich_su_thao_tac_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
};
