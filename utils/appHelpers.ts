
import { RecordFile, RecordStatus, Employee } from '../types';

// --- HÀM TIỆN ÍCH XỬ LÝ CHUỖI TIẾNG VIỆT ---
export function removeVietnameseTones(str: string): string {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

// Hàm chuyển đổi Title Case (Nguyễn Văn A)
export function toTitleCase(str: string | null | undefined): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// --- CONFIRM ACTION WRAPPER ---
let globalConfirmCallback: null | ((message: string, title: string) => Promise<boolean>) = null;

export const setGlobalConfirmCallback = (cb: (message: string, title: string) => Promise<boolean>) => {
    globalConfirmCallback = cb;
};

// Sử dụng Native Dialog của Electron nếu có, hoặc Global Modal, hoặc fallback dùng window.confirm
export const confirmAction = async (message: string, title: string = 'Xác nhận'): Promise<boolean> => {
    if ((window as any).electronAPI && (window as any).electronAPI.showConfirmDialog) {
        // Chờ kết quả từ Main Process (không block renderer)
        return await (window as any).electronAPI.showConfirmDialog(message, title);
    }
    
    if (globalConfirmCallback) {
        return await globalConfirmCallback(message, title);
    }
    
    try {
        // Fallback cho trình duyệt web (có thể lỗi nếu sandboxed)
        return window.confirm(message);
    } catch {
        // Nếu không cho confirm (Iframe sandbox preview) -> Auto true
        return true; 
    }
};

// --- ĐỊNH NGHĨA CÁC CỘT HIỂN THỊ ---
// Updated: Căn giữa tiêu đề và điều chỉnh độ rộng theo yêu cầu
// Updated: Gộp cột Đợt vào cột Hoàn thành
export const COLUMN_DEFS = [
  { key: 'code', label: 'MÃ HỒ SƠ', sortKey: 'code', className: 'w-[110px] text-center' },
  { key: 'customer', label: 'THÔNG TIN CHỦ SỬ DỤNG', sortKey: 'customerName', className: 'w-64 text-center' }, 
  { key: 'type', label: 'LOẠI HỒ SƠ', sortKey: 'recordType', className: 'w-[115px] text-center' },
  { key: 'ward', label: 'XÃ PHƯỜNG', sortKey: 'ward', className: 'w-32 text-center' },
  { key: 'deadline', label: 'THỜI HẠN XỬ LÝ', sortKey: 'deadline', className: 'w-48 text-center' },
  { key: 'mapSheet', label: 'TỜ', sortKey: 'mapSheet', className: 'w-16 text-center' }, 
  { key: 'landPlot', label: 'THỬA', sortKey: 'landPlot', className: 'w-16 text-center' }, 
  { key: 'assigned', label: 'GIAO NHÂN VIÊN', sortKey: 'assignedDate', className: 'w-48 text-center' },
  { key: 'completed', label: 'HOÀN THÀNH / ĐỢT', sortKey: 'completedDate', className: 'w-32 text-center' },
  { key: 'tech', label: 'TĐ / TL', sortKey: 'measurementNumber', className: 'w-20 text-center' },
  { key: 'receipt', label: 'BIÊN LAI', sortKey: 'receiptNumber', className: 'w-20 text-center' },
  { key: 'status', label: 'TRẠNG THÁI', sortKey: 'status', className: 'w-32 text-center' },
];

export const DEFAULT_VISIBLE_COLUMNS = {
    code: true, 
    customer: true, 
    deadline: true,
    ward: true, 
    mapSheet: true, 
    landPlot: true, 
    assigned: true, 
    completed: true, // Mặc định hiện cột gộp này
    type: true, 
    tech: false, 
    receipt: true, 
    status: true
};

// --- CÁC HÀM CHECK LOGIC ---
export const isRecordOverdue = (record: RecordFile): boolean => {
  // 1. Kiểm tra trạng thái "Đã xong"
  const completedStatuses = [
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
      RecordStatus.WITHDRAWN,
      RecordStatus.REJECTED,
      RecordStatus.SIGNED
  ];

  if (completedStatuses.includes(record.status)) return false;
  
  // 2. [QUAN TRỌNG] Kiểm tra dữ liệu thực tế (Fix lỗi trạng thái chưa cập nhật)
  // Nếu đã có ngày xuất (đã giao 1 cửa) hoặc đã có ngày trả kết quả -> Coi như đã xong -> Không quá hạn
  if (record.exportDate || record.exportBatch || record.resultReturnedDate) {
      return false;
  }
  
  const deadline = parseSafeDate(record.deadline);
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

export const isRecordApproaching = (record: RecordFile): boolean => {
  const completedStatuses = [
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
      RecordStatus.WITHDRAWN,
      RecordStatus.REJECTED,
      RecordStatus.SIGNED
  ];

  if (completedStatuses.includes(record.status)) return false;
  
  // Kiểm tra dữ liệu thực tế: Nếu đã xong thì không báo sắp đến hạn
  if (record.exportDate || record.exportBatch || record.resultReturnedDate) {
      return false;
  }

  if (isRecordOverdue(record)) return false;
  
  const deadline = parseSafeDate(record.deadline);
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
};

// Chuyển đổi Âm lịch sang Dương lịch (Cố định cho các ngày lễ chính 2024-2026)
export const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
    const lunarMapping: Record<number, Record<string, string>> = {
        2024: { 
            "1/1": "2024-02-10", "2/1": "2024-02-11", "3/1": "2024-02-12", // Tết
            "10/3": "2024-04-18" // Giỗ tổ
        },
        2025: { 
            "1/1": "2025-01-29", "2/1": "2025-01-30", "3/1": "2025-01-31",
            "10/3": "2025-04-07"
        },
        2026: { 
            "1/1": "2026-02-17", "2/1": "2026-02-18", "3/1": "2026-02-19", 
            "10/3": "2026-04-26"
        }
    };

    const key = `${lunarDay}/${lunarMonth}`;
    if (lunarMapping[year] && lunarMapping[year][key]) {
        return new Date(lunarMapping[year][key]);
    }
    return null;
};

// Định dạng ngày chuẩn YYYY-MM-DD theo giờ địa phương (tránh lệch múi giờ)
export const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Tính hạn trả (deadline) dựa trên loại hồ sơ, ngày nhận, danh sách ngày nghỉ lễ
export const calculateDeadlineHelper = (type: string, receivedDateStr: string, holidays: any[]): string => {
    if (!receivedDateStr) return '';
    let daysToAdd = 30; 
    const lowerType = (type || '').toLowerCase();

    if (lowerType.includes('1.1') || lowerType.includes('1.2') || lowerType.includes('công văn') || lowerType.includes('cong van') || lowerType.includes('cung cấp tài liệu đất đai') || lowerType.includes('cung cấp dữ liệu') ||
        lowerType.includes('2.2') || lowerType.includes('quy hoạch') || 
        lowerType.includes('2.6') || lowerType.includes('số thửa') || 
        lowerType.includes('2.1') || lowerType.includes('trích lục')) {
        daysToAdd = 10;
    } else if (lowerType.includes('trích đo chỉnh lý') || lowerType.includes('chỉnh lý bản đồ')) {
        daysToAdd = 15;
    } else if (lowerType.includes('2.3') || lowerType.includes('trích đo') || 
               lowerType.includes('2.4') || lowerType.includes('cắm mốc') || 
               lowerType.includes('2.5') || lowerType.includes('tách') || lowerType.includes('hợp') ||
               lowerType.includes('đo đạc') || lowerType.includes('tách thửa')) {
        daysToAdd = 30;
    }
    
    // Áp dụng quy ước thời gian: nếu nhận sau 15h dời ngày trả qua sáng hôm sau (tức là cộng thêm 1 ngày làm việc)
    let isAfter15h = false;
    if (receivedDateStr && (receivedDateStr.includes('T') || receivedDateStr.includes(' '))) {
        const parsedDate = new Date(receivedDateStr);
        if (!isNaN(parsedDate.getTime()) && parsedDate.getHours() >= 15) {
            isAfter15h = true;
        }
    } else {
        const todayDateStr = formatDateKey(new Date());
        if (receivedDateStr === todayDateStr && new Date().getHours() >= 15) {
            isAfter15h = true;
        }
    }

    if (isAfter15h) {
        daysToAdd += 1;
    }

    const startDate = new Date(receivedDateStr);
    let count = 0;
    let currentDate = new Date(startDate);
    
    // Tạo Set chứa chuỗi ngày nghỉ (YYYY-MM-DD) để tra cứu nhanh và chính xác
    const holidaySet = new Set<string>();
    const currentYear = startDate.getFullYear();
    const yearsToCheck = [currentYear, currentYear + 1];

    if (holidays && holidays.length > 0) {
        holidays.forEach(h => {
            yearsToCheck.forEach(year => {
                if (h.isLunar) {
                    const solarDate = getSolarDateFromLunar(h.day, h.month, year);
                    if (solarDate) holidaySet.add(formatDateKey(solarDate));
                } else {
                    const solarDate = new Date(year, h.month - 1, h.day);
                    holidaySet.add(formatDateKey(solarDate));
                }
            });
        });
    }

    while (count < daysToAdd) {
        currentDate.setDate(currentDate.getDate() + 1);
        
        const dayOfWeek = currentDate.getDay(); // 0 là Chủ Nhật, 6 là Thứ 7
        const dateString = formatDateKey(currentDate);
        
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidaySet.has(dateString);

        if (!isWeekend && !isHoliday) {
            count++;
        }
    }
    
    return formatDateKey(currentDate);
};

// --- HÀM TIỆN ÍCH SO KHỚP PHÒNG BAN ---
export function matchDepartmentKey(key: string, empDept: string): boolean {
    if (!key || !empDept) return false;
    const kLower = key.trim().toLowerCase();
    const empDeptLower = empDept.trim().toLowerCase();
    if (kLower === empDeptLower) return true;
    
    // Check the 4 standard departments:
    // 1. Tổ Đăng ký cấp giấy (Tổ Cấp giấy)
    if (kLower.includes('giấy') || kLower.includes('đăng ký')) {
        return empDeptLower.includes('giấy') || empDeptLower.includes('đăng ký');
    }
    // 2. Tổ Thông tin lưu trữ (Tổ Lưu trữ)
    if (kLower.includes('lưu trữ') || kLower.includes('thông tin')) {
        return empDeptLower.includes('lưu trữ') || empDeptLower.includes('thông tin');
    }
    // 3. Tổ Đo đạc
    if (kLower.includes('đo đạc')) {
        return empDeptLower.includes('đo đạc');
    }
    // 4. Tổ Hành chính
    if (kLower.includes('hành chính') || kLower.includes('một cửa')) {
        return empDeptLower.includes('hành chính') || empDeptLower.includes('một cửa');
    }
    
    return false;
}

export function parseSafeDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    const s = String(dateStr).trim();
    if (!s) return null;

    // Check if it's already ISO format or YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    // Check if it's DD/MM/YYYY or DD-MM-YYYY or similar
    const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
    const match = s.match(dmyRegex);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed
        const year = parseInt(match[3], 10);
        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

export function processAssignmentTimelineCheck(
  record: RecordFile,
  newEmployeeId: string,
  newAssignedDateStr: string,
  employees: Employee[],
  currentUser: any
): Partial<RecordFile> {
  const newDate = parseSafeDate(newAssignedDateStr) || new Date();
  const formatDateVN = (dStr?: string | null) => {
    if (!dStr) return '';
    const d = parseSafeDate(dStr);
    if (!d) return String(dStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const oldEmp = employees.find(e => e.id === record.assignedTo);
  const newEmp = employees.find(e => e.id === newEmployeeId);

  const oldEmpName = oldEmp ? oldEmp.name : (record.assignedTo || 'Chưa phân công');
  const newEmpName = newEmp ? newEmp.name : newEmployeeId;

  // List previous milestones
  const historyParts: string[] = [];
  if (record.assignedDate) {
    historyParts.push(`Giao NV ${oldEmpName} ngày ${formatDateVN(record.assignedDate)}`);
  }
  if (record.completedWorkDate) {
    historyParts.push(`Đã thực hiện ngày ${formatDateVN(record.completedWorkDate)}`);
  }
  if (record.pendingCheckDate) {
    historyParts.push(`Trình KT ngày ${formatDateVN(record.pendingCheckDate)}`);
  }
  if (record.submissionDate) {
    historyParts.push(`Trình ký ngày ${formatDateVN(record.submissionDate)}`);
  }
  if (record.checkedDate) {
    historyParts.push(`Đã kiểm tra ngày ${formatDateVN(record.checkedDate)}`);
  }
  if (record.approvalDate) {
    historyParts.push(`Ký duyệt ngày ${formatDateVN(record.approvalDate)}`);
  }

  const hasSubsequentSteps = !!(
    record.submissionDate ||
    record.pendingCheckDate ||
    record.checkedDate ||
    record.approvalDate ||
    record.completedWorkDate ||
    record.status === RecordStatus.PENDING_CHECK ||
    record.status === RecordStatus.CHECKED ||
    record.status === RecordStatus.PENDING_SIGN ||
    record.status === RecordStatus.SIGNED ||
    record.status === RecordStatus.COMPLETED_WORK
  );

  let isLaterDate = false;
  if (record.assignedDate) {
    const oldAssignedDate = parseSafeDate(record.assignedDate);
    if (oldAssignedDate && newDate > oldAssignedDate) isLaterDate = true;
  }
  if (record.submissionDate) {
    const oldSubDate = parseSafeDate(record.submissionDate);
    if (oldSubDate && newDate > oldSubDate) isLaterDate = true;
  }
  if (record.pendingCheckDate) {
    const oldCheckDate = parseSafeDate(record.pendingCheckDate);
    if (oldCheckDate && newDate > oldCheckDate) isLaterDate = true;
  }

  const updates: Partial<RecordFile> = {
    assignedTo: newEmployeeId,
    assignedDate: record.assignedDate || newAssignedDateStr,
  };
  if (record.status === RecordStatus.RECEIVED) {
    updates.status = RecordStatus.IN_PROGRESS;
  }

  const firstWard = newEmp?.managedWards?.[0];
  if (firstWard) {
    updates.ward = firstWard;
    updates.handoverWard = firstWard;
  }

  if (hasSubsequentSteps || isLaterDate || historyParts.length > 0) {
    const logNote = `Giao NV ${oldEmpName} ngày ${formatDateVN(record.assignedDate) || 'trước đó'}${record.submissionDate ? `, Trình ký ngày ${formatDateVN(record.submissionDate)}` : ''}`;
    const fullInternalNote = `Cập nhật lại đã giao việc ngày ${formatDateVN(newAssignedDateStr)} (${newEmpName}). Đưa về bước Đang thực hiện. Ghi chú nội bộ: ${logNote} để biết và truy vết.`;

    const existingPrivate = record.privateNotes || '';
    updates.privateNotes = existingPrivate ? `${existingPrivate}\n${fullInternalNote}` : fullInternalNote;

    const newLog = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recordId: record.id,
      previousStatus: record.status,
      newStatus: RecordStatus.IN_PROGRESS,
      changedBy: currentUser?.name || 'Hệ thống',
      changedAt: new Date().toISOString(),
      note: fullInternalNote
    };
    updates.statusLogs = [...(record.statusLogs || []), newLog];
  }

  if (record.data) {
    updates.data = {
      ...record.data,
      assigned_to: newEmployeeId,
      ngay_giao: newAssignedDateStr,
      ghi_chu_noi_bo: updates.privateNotes || record.data.ghi_chu_noi_bo
    };
  }

  return updates;
}

// --- HÀM XỬ LÝ VÀ ĐỊNH DẠNG ĐỢT GIAO 1 CỬA ---

export function getDepartmentForRecord(r: RecordFile): string {
    if (r.returnHandoverDept) {
        const d = r.returnHandoverDept.toLowerCase();
        if (d.includes('lưu trữ') || d.includes('thông tin')) return 'Tổ Lưu trữ';
        if (d.includes('đo đạc') || d.includes('đo dạc')) return 'Tổ Đo đạc';
        if (d.includes('cấp giấy') || d.includes('đăng ký')) return 'Tổ Cấp giấy';
    }
    const type = (r.recordType || '').toLowerCase();
    const code = (r.code || '').toLowerCase();

    if (type.includes('1.1') || type.includes('1.2') || type.includes('công văn') || type.includes('sao lục') || code.startsWith('1.')) {
        return 'Tổ Lưu trữ';
    }
    if (type.includes('2.1') || type.includes('2.2') || type.includes('trích lục')) {
        return 'Tổ Cấp giấy';
    }
    if (type.includes('2.3') || type.includes('2.4') || type.includes('2.5') || type.includes('2.6') || type.includes('số thửa') || type.includes('trích đo') || type.includes('đo đạc') || code.startsWith('2.')) {
        return 'Tổ Đo đạc';
    }
    return 'Tổ Cấp giấy';
}

export function getDeptAbbr(deptName: string): string {
    if (!deptName) return 'CG';
    const d = deptName.toLowerCase();
    if (d.includes('lưu trữ') || d.includes('thông tin') || d === 'lt') return 'LT';
    if (d.includes('đo đạc') || d.includes('đo dạc') || d.includes('kỹ thuật') || d === 'dd') return 'DD';
    if (d.includes('cấp giấy') || d.includes('đăng ký') || d === 'cg') return 'CG';
    return deptName;
}

export function formatDateDDMMYYYY(d?: string | null): string {
    if (!d) {
        const today = new Date();
        return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    }
    const clean = d.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
}

export function formatDateDDMMYY(d?: string | null): string {
    if (!d) {
        const today = new Date();
        const yy = String(today.getFullYear()).slice(-2);
        return `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${yy}`;
    }
    const clean = d.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
        const yy = parts[0].length === 4 ? parts[0].slice(-2) : parts[0];
        return `${parts[2]}/${parts[1]}/${yy}`;
    }
    return d;
}

export function formatBatchName(batch: number | string | null | undefined, deptName?: string, dateStr?: string | null): string {
    if (!batch) return '';
    let bStr = String(batch).trim();
    if (!bStr) return '';

    // Loại bỏ mã tổ chuyên môn cũ nếu có (-CG-, -LT-, -DD-, -Tổ Cấp giấy-)
    bStr = bStr.replace(/-(CG|LT|DD|Tổ\s*[^-\s]+)-/gi, '-');

    let dateFormatted = formatDateDDMMYYYY(dateStr);
    const dateInBatchMatch = bStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (dateInBatchMatch) {
        dateFormatted = dateInBatchMatch[1];
    }

    const match = bStr.match(/Đợt\s*(\d+)/i) || bStr.match(/^(\d+)$/);
    if (match && match[1]) {
        const num = parseInt(match[1], 10);
        return dateFormatted ? `Đợt ${num} - Ngày ${dateFormatted}` : `Đợt ${num}`;
    }

    if (bStr.startsWith('Đợt')) {
        if (!bStr.includes('Ngày') && dateFormatted) {
            const cleanStr = bStr.replace(/Đợt\s*0*(\d+).*/i, 'Đợt $1');
            return `${cleanStr} - Ngày ${dateFormatted}`;
        }
        return bStr;
    }

    const num = isNaN(Number(bStr)) ? bStr : parseInt(bStr, 10);
    return `Đợt ${num}${dateFormatted ? ` - Ngày ${dateFormatted}` : ''}`;
}

export function getBatchDisplayParts(batch: number | string | null | undefined, dateStr?: string | null): { batchName: string; dateName: string } {
    if (!batch) return { batchName: '', dateName: '' };
    let bStr = String(batch).trim();
    if (!bStr) return { batchName: '', dateName: '' };

    // Loại bỏ mã tổ chuyên môn cũ nếu có
    bStr = bStr.replace(/-(CG|LT|DD|Tổ\s*[^-\s]+)-/gi, '-');

    let dateFormatted = formatDateDDMMYYYY(dateStr);
    const dateInBatchMatch = bStr.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (dateInBatchMatch) {
        let matchedDate = dateInBatchMatch[1];
        const parts = matchedDate.split('/');
        if (parts.length === 3) {
            if (parts[2].length === 2) parts[2] = '20' + parts[2];
            matchedDate = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }
        dateFormatted = matchedDate;
    }

    const match = bStr.match(/Đợt\s*0*(\d+)/i) || bStr.match(/^(\d+)$/);
    let batchName = '';
    if (match && match[1]) {
        batchName = `Đợt ${parseInt(match[1], 10)}`;
    } else if (bStr.startsWith('Đợt')) {
        batchName = bStr.split('-')[0].replace(/Ngày.*/i, '').trim();
    } else {
        const num = isNaN(Number(bStr)) ? bStr : parseInt(bStr, 10);
        batchName = `Đợt ${num}`;
    }

    return {
        batchName,
        dateName: dateFormatted || ''
    };
}

/**
 * Tự động gom các hồ sơ trước đây chưa chốt đợt (exportBatch rỗng/null)
 * hoặc hồ sơ có chữ "Đợt Cuối" thành đợt có số lớn nhất trong ngày.
 */
export function migrateUnbatchedRecords(records: RecordFile[]): { migratedRecords: RecordFile[], hasChanges: boolean } {
    let hasChanges = false;

    // Pass 1: Build map of existing batches by date (YYYY-MM-DD)
    const existingBatchesByDate: Record<string, string> = {};
    const existingMaxBatchNumByDate: Record<string, number> = {};

    records.forEach(r => {
        if (r.exportBatch && String(r.exportBatch).trim() !== '' && r.exportBatch !== 'NOT_BATCHED' && !/cuối/i.test(String(r.exportBatch))) {
            const rawDate = r.exportDate || r.completedDate;
            if (rawDate) {
                const dateKey = String(rawDate).split('T')[0];
                const currentBatchStr = String(r.exportBatch);
                
                const match = currentBatchStr.match(/Đợt\s*(\d+)/i) || currentBatchStr.match(/^(\d+)$/);
                if (match && match[1]) {
                    const num = parseInt(match[1], 10);
                    if (!existingMaxBatchNumByDate[dateKey] || num > existingMaxBatchNumByDate[dateKey]) {
                        existingMaxBatchNumByDate[dateKey] = num;
                    }
                }

                if (!existingBatchesByDate[dateKey] || currentBatchStr.localeCompare(existingBatchesByDate[dateKey], undefined, { numeric: true }) > 0) {
                    existingBatchesByDate[dateKey] = currentBatchStr;
                }
            }
        }
    });

    const getFallbackBatchName = (rawDate: string) => {
        const dateKey = String(rawDate).split('T')[0];
        const dateFmt = formatDateDDMMYYYY(rawDate);
        if (existingBatchesByDate[dateKey]) {
            return formatBatchName(existingBatchesByDate[dateKey], '', dateKey);
        }
        const maxNum = existingMaxBatchNumByDate[dateKey] || 1;
        return `Đợt ${maxNum} - Ngày ${dateFmt}`;
    };

    const migratedRecords = records.map(r => {
        let currentBatch = r.exportBatch;

        // Tự động làm sạch các tên đợt cũ bị lặp chữ "Đợt"
        if (typeof currentBatch === 'string' && /^Đợt\s+Đợt/i.test(currentBatch)) {
            currentBatch = currentBatch.replace(/^Đợt\s+/i, '');
            hasChanges = true;
        }

        // Tự động làm sạch các mã tổ chuyên môn thừa trong tên đợt (vd: Đợt 01-CG-30/07/2026 -> Đợt 1 - Ngày 30/07/2026)
        if (typeof currentBatch === 'string' && /-(CG|LT|DD|Tổ\s*[^-\s]+)-/i.test(currentBatch)) {
            currentBatch = currentBatch.replace(/-(CG|LT|DD|Tổ\s*[^-\s]+)-/gi, '-');
            hasChanges = true;
        }

        // Tự động đổi tên "Đợt Cuối" / "Đợt cuối" thành đợt số lớn nhất trong ngày
        if (typeof currentBatch === 'string' && /cuối/i.test(currentBatch)) {
            hasChanges = true;
            const rawDate = r.exportDate || r.completedDate || r.receivedDate || new Date().toISOString();
            currentBatch = getFallbackBatchName(rawDate);
        }

        // Chuẩn hóa tên đợt sang dạng "Đợt X - Ngày DD/MM/YYYY"
        if (currentBatch && currentBatch !== 'NOT_BATCHED') {
            const rawDate = r.exportDate || r.completedDate || r.receivedDate;
            const formatted = formatBatchName(currentBatch, '', rawDate);
            if (formatted && formatted !== currentBatch) {
                currentBatch = formatted;
                hasChanges = true;
            }
        }

        const isHandedOver = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || Boolean((r as any).is_handover);
        const missingBatch = !currentBatch || String(currentBatch).trim() === '' || currentBatch === 'NOT_BATCHED';

        if (isHandedOver && missingBatch) {
            hasChanges = true;
            const rawDate = r.exportDate || r.completedDate || r.receivedDate || new Date().toISOString();
            const defaultBatchName = getFallbackBatchName(rawDate);

            return {
                ...r,
                exportBatch: defaultBatchName,
                exportDate: r.exportDate || rawDate,
                completedDate: r.completedDate || rawDate,
                status: r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? r.status : RecordStatus.HANDOVER
            };
        }

        // Tự động chuẩn hóa đợt số cũ (ví dụ: exportBatch = 1) thành chuỗi tên đợt chuẩn
        if (currentBatch && typeof currentBatch === 'number') {
            hasChanges = true;
            const rawDate = r.exportDate || r.completedDate || r.receivedDate || new Date().toISOString();
            const dateFmt = formatDateDDMMYYYY(rawDate);
            const numStr = String(currentBatch).padStart(2, '0');
            return {
                ...r,
                exportBatch: `Đợt ${numStr}-${dateFmt}`
            };
        }

        if (currentBatch !== r.exportBatch) {
            return {
                ...r,
                exportBatch: currentBatch
            };
        }

        return r;
    });

    return { migratedRecords, hasChanges };
}




