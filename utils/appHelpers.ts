
import { RecordFile, RecordStatus, Employee, DangKyRecord } from '../types';
import { detectProcedureId, getProcedureById, DANG_KY_DEADLINE_MAP } from '../constants/procedures';

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
// Updated: Thứ tự chuẩn theo quy định (MÃ HỒ SƠ, CHỦ SỬ DỤNG, LOẠI HỒ SƠ, THỜI HẠN XỬ LÝ, XÃ PHƯỜNG, TỜ, THỬA, GIAO NHÂN VIÊN, HOÀN THÀNH ĐỢT, TRẠNG THÁI)
export const COLUMN_DEFS = [
  { key: 'code', label: 'MÃ HỒ SƠ', sortKey: 'code', className: 'w-[110px] text-center' },
  { key: 'customer', label: 'THÔNG TIN CHỦ SỬ DỤNG', sortKey: 'customerName', className: 'w-64 text-center' }, 
  { key: 'type', label: 'LOẠI HỒ SƠ', sortKey: 'recordType', className: 'w-[115px] text-center' },
  { key: 'deadline', label: 'THỜI HẠN XỬ LÝ', sortKey: 'deadline', className: 'w-48 text-center' },
  { key: 'ward', label: 'XÃ PHƯỜNG', sortKey: 'ward', className: 'w-32 text-center' },
  { key: 'mapSheet', label: 'TỜ', sortKey: 'mapSheet', className: 'w-16 text-center' }, 
  { key: 'landPlot', label: 'THỬA', sortKey: 'landPlot', className: 'w-16 text-center' }, 
  { key: 'assigned', label: 'GIAO NHÂN VIÊN', sortKey: 'assignedDate', className: 'w-48 text-center' },
  { key: 'completed', label: 'HOÀN THÀNH ĐỢT', sortKey: 'completedDate', className: 'w-32 text-center' },
  { key: 'status', label: 'TRẠNG THÁI', sortKey: 'status', className: 'w-32 text-center' },
];

export const DEFAULT_VISIBLE_COLUMNS = {
    code: true, 
    customer: true, 
    type: true,
    deadline: true,
    ward: true, 
    mapSheet: true, 
    landPlot: true, 
    assigned: true, 
    completed: true, 
    status: true,
    tech: false, 
    receipt: false
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

export const isDangKyRecordOverdue = (record: DangKyRecord): boolean => {
  const completedStatuses = [
    'Đã giao 1 cửa',
    'Đã trả kết quả',
    'CSD rút HS',
    'Trả hủy hồ sơ'
  ];
  if (record.status && completedStatuses.includes(record.status)) return false;
  
  if (record.exportBatch || record.resultReturnedDate || record.completedDate) {
    return false;
  }
  
  const deadline = parseSafeDate(record.deadline);
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

export const isDangKyRecordApproaching = (record: DangKyRecord): boolean => {
  const completedStatuses = [
    'Đã giao 1 cửa',
    'Đã trả kết quả',
    'CSD rút HS',
    'Trả hủy hồ sơ'
  ];
  if (record.status && completedStatuses.includes(record.status)) return false;
  if (record.exportBatch || record.resultReturnedDate || record.completedDate) {
    return false;
  }
  if (isDangKyRecordOverdue(record)) return false;
  
  const deadline = parseSafeDate(record.deadline);
  if (!deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
};

export const getDangKyOverdueDays = (record: DangKyRecord): number => {
  const deadline = parseSafeDate(record.deadline);
  if (!deadline) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - deadline.getTime();
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

export const getDangKyRemainingDays = (record: DangKyRecord): number => {
  const deadline = parseSafeDate(record.deadline);
  if (!deadline) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// Chuyển đổi Âm lịch sang Dương lịch (Cố định cho các ngày lễ chính 2024-2026)
// Chuyển đổi Âm lịch sang Dương lịch (Cố định cho các ngày lễ chính 2024-2030)
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
        },
        2027: {
            "1/1": "2027-02-06", "2/1": "2027-02-07", "3/1": "2027-02-08",
            "10/3": "2027-04-16"
        },
        2028: {
            "1/1": "2028-01-26", "2/1": "2028-01-27", "3/1": "2028-01-28",
            "10/3": "2028-04-04"
        },
        2029: {
            "1/1": "2029-02-13", "2/1": "2029-02-14", "3/1": "2029-02-15",
            "10/3": "2029-04-22"
        },
        2030: {
            "1/1": "2030-02-02", "2/1": "2030-02-03", "3/1": "2030-02-04",
            "10/3": "2030-04-12"
        }
    };

    const key = `${lunarDay}/${lunarMonth}`;
    if (lunarMapping[year] && lunarMapping[year][key]) {
        const parts = lunarMapping[year][key].split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
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
export const calculateDeadlineHelper = (type: string, receivedDateStr: string, holidays: any[], code?: string, procedureId?: string): string => {
    if (!receivedDateStr) return '';
    let daysToAdd = 30; 
    
    const targetProcId = procedureId || detectProcedureId(code, type);
    const procDef = getProcedureById(targetProcId);

    if (procDef) {
        daysToAdd = procDef.defaultDeadline;
    } else {
        const cleanType = (type || '').trim();
        const lowerType = cleanType.toLowerCase();

        // 1. Kiểm tra mã định danh 3.4.1 (Tách - hợp thửa đăng ký) -> 17 ngày chuẩn
        if (lowerType.includes('3.4.1')) {
            daysToAdd = 17;
        }
        // 2. Kiểm tra mã định danh 2.5 (Trích đo tách - hợp thửa đo đạc) -> 30 ngày chuẩn
        else if (lowerType.includes('2.5') || lowerType.includes('trích đo tách')) {
            daysToAdd = 30;
        }
        // 3. Khớp chính xác với DANG_KY_DEADLINE_MAP
        else if (DANG_KY_DEADLINE_MAP[cleanType]) {
            daysToAdd = DANG_KY_DEADLINE_MAP[cleanType];
        }
        // 4. Tra cứu cụ thể cho các loại hồ sơ Đăng ký (3.x.x)
        else if (lowerType.includes('cấp đổi (có thuế)') || lowerType.includes('3.2.2')) {
            daysToAdd = 15;
        } else if (lowerType.includes('cấp lại (có thuế)') || lowerType.includes('3.3.2')) {
            daysToAdd = 15;
        } else if (lowerType.includes('3.1.1') || lowerType.includes('3.1.2') || lowerType.includes('3.1.3') ||
                   lowerType.includes('chuyển nhượng') || lowerType.includes('tặng cho') || lowerType.includes('thừa kế') || lowerType.includes('thỏa thuận') || lowerType.includes('phân chia')) {
            daysToAdd = 13;
        } else if (lowerType.includes('cấp đổi') || lowerType.includes('3.2.1')) {
            daysToAdd = 10;
        } else if (lowerType.includes('cấp lại') || lowerType.includes('3.3.1')) {
            daysToAdd = 10;
        } else if (lowerType.includes('gia hạn') || lowerType.includes('3.5.1')) {
            daysToAdd = 12;
        } else if (lowerType.includes('chuyển mục đích') || lowerType.includes('3.6.1') || lowerType.includes('đính chính') || lowerType.includes('3.7.1') || lowerType.includes('3.7.2') || lowerType.includes('thay đổi thông tin')) {
            daysToAdd = 7;
        } else if (lowerType.includes('xóa thế chấp') || lowerType.includes('xóa đk gdbd') || lowerType.includes('xóa gdbd') || lowerType.includes('3.8.2')) {
            daysToAdd = 1;
        } else if (lowerType.includes('thế chấp') || lowerType.includes('giao dịch bảo đảm') || lowerType.includes('gdbd') || lowerType.includes('3.8.1')) {
            daysToAdd = 3;
        } else if (lowerType.includes('cấp mới') || lowerType.includes('cấp lần đầu') || lowerType.includes('cấp gcn lần đầu') || lowerType.includes('công nhận') || lowerType.includes('3.9.1')) {
            daysToAdd = 30;
        } else if (lowerType.includes('tách - hợp thửa') || lowerType.includes('tách thửa') || lowerType.includes('hợp thửa') || lowerType.includes('3.4.1') || lowerType.includes('3.4.2')) {
            daysToAdd = 17;
        }
        // 5. Nhóm Đo đạc & Cung cấp số thửa
        else if (lowerType.includes('2.3') || lowerType.includes('duyệt đơn & cung cấp số thửa') || lowerType.includes('dđ & cc số thửa') || lowerType.includes('dd & cc số thửa') || lowerType.includes('duyệt đơn-số thửa') || lowerType.includes('duyệt đơn') || lowerType.includes('cung cấp số thửa') || lowerType.includes('cập nhật số thửa') || lowerType.includes('cập nhập số thửa') || lowerType.includes('2.6')) {
            daysToAdd = 12;
        }
        // 6. Nhóm Sao lục / Cung cấp thông tin / Lưu trữ / Quy hoạch
        else if (lowerType.includes('1.1') || lowerType.includes('sao lục') || lowerType.includes('cung cấp tài liệu đất đai') || lowerType.includes('cung cấp dữ liệu') ||
            lowerType.includes('2.1') || lowerType.includes('trích lục') || 
            lowerType.includes('quy hoạch') || lowerType.includes('lưu trữ') || lowerType.includes('cung cấp thông tin')) {
            daysToAdd = 10;
        } 
        // 7. Nhóm Trích đo chỉnh lý / Chỉnh lý bản đồ
        else if (lowerType.includes('trích đo chỉnh lý') || lowerType.includes('chỉnh lý bản đồ')) {
            daysToAdd = 15;
        } 
        // 8. Nhóm Trích đo / Đo đạc địa chính / Cắm mốc (bao gồm 2.5)
        else if (lowerType.includes('2.2') || lowerType.includes('trích đo') || 
                   lowerType.includes('2.4') || lowerType.includes('cắm mốc') || 
                   lowerType.includes('2.5') || lowerType.includes('đo đạc')) {
            daysToAdd = 30;
        }
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

    // Phân tích ngày bắt đầu chuẩn theo local time tránh lệch timezone
    const cleanDateStr = receivedDateStr.includes('T') ? receivedDateStr.split('T')[0] : receivedDateStr;
    const dateParts = cleanDateStr.split('-');
    let startDate: Date;
    if (dateParts.length === 3) {
        startDate = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
    } else {
        startDate = parseSafeDate(receivedDateStr) || new Date();
    }

    let count = 0;
    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    
    // Tạo Set chứa chuỗi ngày nghỉ (YYYY-MM-DD) để tra cứu nhanh và chính xác
    const holidaySet = new Set<string>();
    const currentYear = startDate.getFullYear();
    const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

    if (holidays && holidays.length > 0) {
        holidays.forEach(h => {
            if (h.date) {
                holidaySet.add(h.date);
            } else if (h.day !== undefined && h.month !== undefined) {
                if (h.year) {
                    const solarDate = new Date(h.year, h.month - 1, h.day);
                    holidaySet.add(formatDateKey(solarDate));
                } else {
                    yearsToCheck.forEach(year => {
                        if (h.isLunar) {
                            const solarDate = getSolarDateFromLunar(h.day, h.month, year);
                            if (solarDate) holidaySet.add(formatDateKey(solarDate));
                        } else {
                            const solarDate = new Date(year, h.month - 1, h.day);
                            holidaySet.add(formatDateKey(solarDate));
                        }
                    });
                }
            }
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
    const code = (r.code || '').trim();
    const type = (r.recordType || '').trim();
    const procId = detectProcedureId(code, type);

    if (code.startsWith('1.') || type.startsWith('1.') || procId.startsWith('1.')) {
        return 'Tổ Lưu trữ';
    }
    if (code.startsWith('2.') || type.startsWith('2.') || procId.startsWith('2.')) {
        return 'Tổ Đo đạc';
    }
    if (code.startsWith('3.') || type.startsWith('3.') || procId.startsWith('3.')) {
        return 'Tổ Cấp giấy';
    }

    if (r.returnHandoverDept) {
        return r.returnHandoverDept;
    }

    return 'Tổ Đo đạc';
}

export function getDeptAbbr(deptName: string): string {
    if (!deptName) return 'DD';
    const d = deptName.toLowerCase();
    if (d.includes('lưu trữ') || d.includes('thông tin') || d === 'lt') return 'LT';
    if (d.includes('đo đạc') || d.includes('đo dạc') || d.includes('kỹ thuật') || d.includes('cấp giấy') || d.includes('đăng ký') || d === 'dd' || d === 'cg') return 'DD';
    return 'DD';
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

export function getPureBatchNumber(batch: number | string | null | undefined): string {
    if (!batch && batch !== 0) return '';
    const bStr = String(batch).trim();
    if (!bStr) return '';
    const match = bStr.match(/(\d+)/);
    if (match && match[1]) {
        return `${parseInt(match[1], 10)}`;
    }
    return bStr;
}

export function extractDateFromBatch(batch: number | string | null | undefined): string | null {
    if (!batch) return null;
    const bStr = String(batch);
    const match = bStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
    }
    return null;
}

export function formatBatchName(batch: number | string | null | undefined, _deptName?: string, dateStr?: string | null): string {
    if (!batch && batch !== 0) return '';
    let bStr = String(batch).trim();
    if (!bStr) return '';

    // 1. Loại bỏ các mã tổ chuyên môn cũ nếu có (-CG-, -LT-, -DD-, -Tổ Cấp giấy-)
    bStr = bStr.replace(/-(CG|LT|DD|Tổ\s*[^-\s]+)-/gi, '-');

    // 2. Trích xuất số đợt
    let batchNum: string = '';
    const numMatch = bStr.match(/Đợt\s*0*(\d+)/i) || bStr.match(/^(\d+)$/);
    if (numMatch && numMatch[1]) {
        batchNum = numMatch[1];
    } else {
        const fallbackMatch = bStr.match(/(\d+)/);
        if (fallbackMatch) {
            batchNum = fallbackMatch[1];
        }
    }

    // 3. Trích xuất ngày
    let dateFormatted = formatDateDDMMYYYY(dateStr);
    const dateInBatchMatch = bStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateInBatchMatch) {
        let day = dateInBatchMatch[1].padStart(2, '0');
        let month = dateInBatchMatch[2].padStart(2, '0');
        let year = dateInBatchMatch[3];
        if (year.length === 2) year = '20' + year;
        dateFormatted = `${day}/${month}/${year}`;
    }

    // 4. Trả về định dạng duy nhất, sạch sẽ
    if (batchNum) {
        const num = parseInt(batchNum, 10);
        return dateFormatted ? `Đợt ${num} - Ngày ${dateFormatted}` : `Đợt ${num}`;
    }

    let cleanStr = bStr;
    cleanStr = cleanStr.split(/\s*-\s*Ngày/i)[0];
    cleanStr = cleanStr.split(/\s*-\s*Ngày/)[0];
    
    return dateFormatted ? `${cleanStr} - Ngày ${dateFormatted}` : cleanStr;
}

export function getBatchDisplayParts(batch: number | string | null | undefined, dateStr?: string | null): { batchName: string; dateName: string } {
    if (!batch && batch !== 0) return { batchName: '', dateName: '' };
    const bStr = String(batch).trim();
    if (!bStr) return { batchName: '', dateName: '' };

    const formatted = formatBatchName(bStr, '', dateStr);
    const parts = formatted.split(/\s*-\s*Ngày\s*/i);
    
    return {
        batchName: parts[0] || 'Đợt lẻ',
        dateName: parts[1] ? `Ngày ${parts[1]}` : ''
    };
}

export function extractBatchOnly(batch: number | string | null | undefined): string {
    if (!batch && batch !== 0) return '';
    const bStr = String(batch).trim();
    if (!bStr) return '';
    
    const numMatch = bStr.match(/Đợt\s*0*(\d+)/i) || bStr.match(/^(\d+)$/);
    if (numMatch && numMatch[1]) {
        return `${parseInt(numMatch[1], 10)}`;
    }
    const cleanStr = bStr.split(/\s*-\s*Ngày/i)[0].replace(/^Đợt\s*/i, '').trim();
    return cleanStr;
}

export function extractBatchNumber(batch: number | string | null | undefined): number | string {
    if (!batch && batch !== 0) return '';
    const bStr = String(batch).trim();
    if (!bStr) return '';
    const numMatch = bStr.match(/Đợt\s*0*(\d+)/i) || bStr.match(/^(\d+)$/);
    if (numMatch && numMatch[1]) {
        return parseInt(numMatch[1], 10);
    }
    return bStr.split(/\s*-\s*Ngày/i)[0].replace(/^Đợt\s*/i, '').trim();
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

// --- HÀM CHUẨN HÓA VÀ TRA CỨU NHÂN SỰ (ID VS TÊN) ---
export function getEmployeeName(idOrName?: string | null, employees: Employee[] = []): string {
    if (!idOrName) return 'Chưa giao';
    const trimmed = String(idOrName).trim();
    if (!trimmed) return 'Chưa giao';
    
    // 1. Tìm theo ID (không phân biệt hoa thường)
    let emp = employees.find(e => e.id && e.id.toLowerCase() === trimmed.toLowerCase());
    if (emp) return `${emp.name} (${emp.department || 'Nhân sự'})`;
    
    // 2. Tìm theo Tên (không phân biệt hoa thường)
    emp = employees.find(e => e.name && e.name.toLowerCase() === trimmed.toLowerCase());
    if (emp) return `${emp.name} (${emp.department || 'Nhân sự'})`;
    
    // 3. Nếu không tìm thấy trong danh mục, trả về chính chuỗi đang lưu (tránh mất tên nếu nhập tự do)
    return trimmed;
}

export function resolveEmployeeId(idOrName?: string | null, employees: Employee[] = []): string {
    if (!idOrName) return '';
    const trimmed = String(idOrName).trim();
    if (!trimmed) return '';
    
    // Nếu truyền vào trùng ID hoặc Tên trong danh sách, quy đổi về ID chuẩn
    const emp = employees.find(e => (e.id && e.id.toLowerCase() === trimmed.toLowerCase()) || (e.name && e.name.toLowerCase() === trimmed.toLowerCase()));
    return emp ? emp.id : trimmed;
}

export function cleanSyncNotes(text?: string | null): string {
    if (!text) return '';
    let str = String(text);
    const patterns = [
        /đồng\s*bộ\s*thủ\s*tục\s*cũ/gi,
        /đồng\s*bộ\s*thủ\s*tục\s*củ/gi,
        /đồng\s*bộ\s*từ\s*thủ\s*tục\s*cũ/gi,
        /đồng\s*bộ\s*từ\s*thủ\s*tục\s*củ/gi,
        /thủ\s*tục\s*cũ/gi,
        /thủ\s*tục\s*củ/gi,
        /trích\s*đo\s*bản\s*đồ\s*địa\s*chính/gi,
        /trích\s*đo\s*địa\s*chính/gi,
        /trích\s*đo/gi
    ];
    for (const p of patterns) {
        str = str.replace(p, '');
    }
    str = str.replace(/;\s*;/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
    return str;
}

// --- TÍNH TOÁN KHỐI LƯỢNG CÔNG VIỆC THEO SỐ THỬA ĐẤT ---
export function getRecordPlotCount(r: RecordFile): number {
    if (!r) return 1;
    // 1. Check data.plotCount
    if (r.data && typeof r.data.plotCount === 'number' && r.data.plotCount > 0) {
        return r.data.plotCount;
    }
    if (r.data && r.data.plotCount && !isNaN(Number(r.data.plotCount)) && Number(r.data.plotCount) > 0) {
        return Number(r.data.plotCount);
    }
    // 2. Check doDacItems / splitItems / tachThuaItems
    if (r.data?.doDacItems && Array.isArray(r.data.doDacItems) && r.data.doDacItems.length > 0) {
        return r.data.doDacItems.length;
    }
    if (r.data?.splitItems && Array.isArray(r.data.splitItems) && r.data.splitItems.length > 0) {
        return r.data.splitItems.length;
    }
    if (r.data?.tachThuaItems && Array.isArray(r.data.tachThuaItems) && r.data.tachThuaItems.length > 0) {
        return r.data.tachThuaItems.length;
    }
    // 3. Check landPlot string separated by commas, semicolons, etc.
    if (r.landPlot && typeof r.landPlot === 'string') {
        const raw = r.landPlot.trim();
        if (raw) {
            const parts = raw.split(/[,;\n+]/).map(p => p.trim()).filter(Boolean);
            if (parts.length > 1) {
                return parts.length;
            }
        }
    }
    return 1;
}

export interface EmployeeWorkloadStats {
    inProgressPlots: number;
    completedPlots: number;
}

export function calculateEmployeeWorkload(
    records: RecordFile[],
    employee: Employee
): EmployeeWorkloadStats {
    if (!records || records.length === 0 || !employee) {
        return { inProgressPlots: 0, completedPlots: 0 };
    }

    const empName = (employee.name || '').trim().toLowerCase();
    const empId = (employee.id || '').trim().toLowerCase();
    const position = (employee.position || '').toLowerCase();
    const department = (employee.department || '').toLowerCase();

    const isBoard = department.includes('ban giám đốc') || position.includes('giám đốc');
    const isLead = position.includes('trưởng') || position.includes('phó') || position.includes('lãnh đạo');

    let inProgressPlots = 0;
    let completedPlots = 0;

    for (const r of records) {
        const plotCount = getRecordPlotCount(r);
        
        const rAssigned = (r.assignedTo || '').trim().toLowerCase();
        const rChecked = (r.checkedBy || '').trim().toLowerCase();
        const rSubmitted = (r.submittedTo || '').trim().toLowerCase();

        const isAssigned = rAssigned === empName || rAssigned === empId;
        const isCheckedBy = rChecked === empName || rChecked === empId;
        const isSubmittedTo = rSubmitted === empName || rSubmitted === empId;

        // Has status log transitioned by this user
        const hasLog = r.statusLogs?.some(log => {
            const cb = (log.changedBy || '').trim().toLowerCase();
            return cb === empName || cb === empId;
        });

        if (isBoard) {
            // Ban Giám đốc khi nhận trình ký:
            // Đang xử lý: Hồ sơ PENDING_SIGN được trình cho Giám đốc này (hoặc r.submittedTo == emp)
            if (r.status === RecordStatus.PENDING_SIGN && (isSubmittedTo || isAssigned)) {
                inProgressPlots += plotCount;
            }
            // Đã hoàn thành: Hồ sơ đã ký duyệt/hoàn thành (SIGNED, HANDOVER, RETURNED) mà Giám đốc đã duyệt/trình
            if ((r.status === RecordStatus.SIGNED || r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED) && (isSubmittedTo || isAssigned || hasLog)) {
                completedPlots += plotCount;
            }
        } else if (isLead) {
            // Tổ trưởng / Tổ phó khi nhận kiểm tra:
            // Đang xử lý: Hồ sơ đang PENDING_CHECK / CHECKING được giao cho cán bộ này kiểm tra (hoặc đang phân công xử lý trực tiếp)
            if ((r.status === RecordStatus.PENDING_CHECK || (r.status as string) === 'CHECKING') && (isCheckedBy || isAssigned)) {
                inProgressPlots += plotCount;
            } else if ((r.status === RecordStatus.ASSIGNED || r.status === RecordStatus.IN_PROGRESS || r.status === RecordStatus.COMPLETED_WORK) && isAssigned) {
                inProgressPlots += plotCount;
            }

            // Đã hoàn thành: Hồ sơ đã qua bước kiểm tra (CHECKED, PENDING_SIGN, SIGNED, HANDOVER, RETURNED) mà do cán bộ này kiểm tra/xử lý
            if ((r.status === RecordStatus.CHECKED || r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED || r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED) && (isCheckedBy || isAssigned || hasLog)) {
                completedPlots += plotCount;
            }
        } else {
            // Chuyên viên / Tổ viên:
            // Đang xử lý: Hồ sơ được giao cho chuyên viên xử lý ở các bước chưa trình/hoàn thành (RECEIVED, ASSIGNED, IN_PROGRESS, COMPLETED_WORK)
            if (isAssigned && (r.status === RecordStatus.RECEIVED || r.status === RecordStatus.ASSIGNED || r.status === RecordStatus.IN_PROGRESS || r.status === RecordStatus.COMPLETED_WORK)) {
                inProgressPlots += plotCount;
            }

            // Đã hoàn thành: Hồ sơ chuyên viên đó chịu trách nhiệm (assignedTo hoặc có log) đã chuyển bước tiếp theo (PENDING_CHECK, CHECKED, PENDING_SIGN, SIGNED, HANDOVER, RETURNED)
            if ((isAssigned || hasLog) && (r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED || r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED || r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED)) {
                completedPlots += plotCount;
            }
        }
    }

    return { inProgressPlots, completedPlots };
}

export const formatStaffInfoHelper = (staffNameOrId?: string | null, employees: Employee[] = [], users: any[] = []): string | null => {
  if (!staffNameOrId) return null;
  const val = String(staffNameOrId).trim();
  
  const emp = employees.find(e => 
    e.id === val || 
    e.name?.toLowerCase() === val.toLowerCase() || 
    (e as any).fullName?.toLowerCase() === val.toLowerCase()
  );
  if (emp) {
    const pos = emp.position || '';
    return pos ? `${emp.name} (${pos})` : emp.name;
  }

  const user = users.find(u => 
    u.employeeId === val || 
    u.username?.toLowerCase() === val.toLowerCase() || 
    u.name?.toLowerCase() === val.toLowerCase() || 
    u.fullName?.toLowerCase() === val.toLowerCase()
  );
  if (user) {
    const matchedEmp = employees.find(e => e.id === user.employeeId || e.name === user.name);
    const name = user.fullName || user.name || user.username;
    const pos = matchedEmp?.position || user.role || '';
    return pos ? `${name} (${pos})` : name;
  }

  return val;
};







