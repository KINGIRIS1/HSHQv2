
import { RecordFile, RecordStatus, Employee } from '../types';
import { DEFAULT_HOLIDAYS } from '../constants';

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
    if (!date || isNaN(date.getTime())) return '';
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

    if (lowerType.includes('1.1') || lowerType.includes('cung cấp tài liệu đất đai') || lowerType.includes('cung cấp dữ liệu') ||
        lowerType.includes('2.1') || lowerType.includes('trích lục') || 
        lowerType.includes('quy hoạch')) {
        daysToAdd = 10;
    } else if (lowerType.includes('2.3') || lowerType.includes('duyệt đơn') || lowerType.includes('duyet don') || lowerType.includes('số thửa') || lowerType.includes('so thua') || lowerType.includes('cung cấp số thửa') || lowerType.includes('cập nhật số thửa') || lowerType.includes('cập nhập số thửa') || lowerType.includes('2.6')) {
        daysToAdd = 12;
    } else if (lowerType.includes('trích đo chỉnh lý') || lowerType.includes('chỉnh lý bản đồ')) {
        daysToAdd = 15;
    } else if (lowerType.includes('2.2') || lowerType.includes('trích đo') || 
               lowerType.includes('2.4') || lowerType.includes('cắm mốc') || 
               lowerType.includes('2.5') || lowerType.includes('tách') || lowerType.includes('hợp') ||
               lowerType.includes('đo đạc') || lowerType.includes('tách thửa')) {
        daysToAdd = 30;
    }
    
    // Áp dụng quy ước thời gian: nếu nhận sau 15h dời ngày trả qua sáng hôm sau (tức là cộng thêm 1 ngày làm việc)
    let isAfter15h = false;
    const parsedStart = parseSafeDate(receivedDateStr);
    const startDate = parsedStart ? new Date(parsedStart.getTime()) : new Date();

    if (receivedDateStr && (receivedDateStr.includes('T') || receivedDateStr.includes(' '))) {
        if (parsedStart && parsedStart.getHours() >= 15) {
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

    let count = 0;
    let currentDate = new Date(startDate.getTime());
    
    // Tạo Set chứa chuỗi ngày nghỉ (YYYY-MM-DD) để tra cứu nhanh và chính xác
    const holidaySet = new Set<string>();
    const currentYear = startDate.getFullYear();
    const yearsToCheck = [currentYear, currentYear + 1];

    const effectiveHolidays = (Array.isArray(holidays) && holidays.length > 0) ? holidays : DEFAULT_HOLIDAYS;

    if (effectiveHolidays && effectiveHolidays.length > 0) {
        effectiveHolidays.forEach(h => {
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
    
    // 5. Ban Giám đốc
    if (kLower.includes('giám đốc') || kLower.includes('lãnh đạo')) {
        return empDeptLower.includes('giám đốc') || empDeptLower.includes('lãnh đạo');
    }
    
    return false;
}

// Chuẩn hóa và phân nhóm nhân viên theo tổ chuyên môn
export function groupEmployeesByDepartment(employees: Employee[] = []): Record<string, Employee[]> {
    if (!employees || employees.length === 0) return {};

    const standardOrder = ['Tổ Đo đạc', 'Tổ Cấp giấy', 'Tổ Lưu trữ', 'Tổ Hành chính', 'Ban Giám đốc'];
    const groups: Record<string, Employee[]> = {};

    employees.forEach(emp => {
        let dept = emp.department?.trim() || 'Chưa phân tổ';
        const dLower = dept.toLowerCase();
        
        if (dLower.includes('đo đạc') || dLower.includes('đo dạc')) {
            dept = 'Tổ Đo đạc';
        } else if (dLower.includes('cấp giấy') || dLower.includes('đăng ký')) {
            dept = 'Tổ Cấp giấy';
        } else if (dLower.includes('lưu trữ') || dLower.includes('thông tin')) {
            dept = 'Tổ Lưu trữ';
        } else if (dLower.includes('hành chính') || dLower.includes('một cửa')) {
            dept = 'Tổ Hành chính';
        } else if (dLower.includes('giám đốc') || dLower.includes('lãnh đạo')) {
            dept = 'Ban Giám đốc';
        }

        if (!groups[dept]) groups[dept] = [];
        groups[dept].push(emp);
    });

    const orderedGroups: Record<string, Employee[]> = {};
    standardOrder.forEach(dept => {
        if (groups[dept] && groups[dept].length > 0) {
            orderedGroups[dept] = groups[dept];
        }
    });

    Object.keys(groups).forEach(dept => {
        if (!orderedGroups[dept] && groups[dept].length > 0) {
            orderedGroups[dept] = groups[dept];
        }
    });

    return orderedGroups;
}

// Kiểu màu sắc và huy hiệu theo từng tổ
export function getDepartmentBadgeStyle(department?: string): { bg: string; text: string; border: string; badgeBg: string; label: string } {
    const dept = (department || '').toLowerCase();
    if (dept.includes('đo đạc') || dept.includes('đo dạc')) {
        return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badgeBg: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Tổ Đo đạc' };
    }
    if (dept.includes('cấp giấy') || dept.includes('đăng ký')) {
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Tổ Cấp giấy' };
    }
    if (dept.includes('lưu trữ') || dept.includes('thông tin')) {
        return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badgeBg: 'bg-purple-100 text-purple-800 border-purple-300', label: 'Tổ Lưu trữ' };
    }
    if (dept.includes('hành chính') || dept.includes('một cửa')) {
        return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badgeBg: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Tổ Hành chính' };
    }
    if (dept.includes('giám đốc') || dept.includes('lãnh đạo')) {
        return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badgeBg: 'bg-rose-100 text-rose-800 border-rose-300', label: 'Ban Giám đốc' };
    }
    return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badgeBg: 'bg-slate-100 text-slate-800 border-slate-300', label: department || 'Nhân sự' };
}


export function parseSafeDate(dateStr: any): Date | null {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    const s = String(dateStr).trim();
    if (!s) return null;

    // Check if it's YYYY-MM-DD or ISO format with optional time
    const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s](\d{2}):(\d{2})(?::(\d{2}))?)/);
    if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10) - 1;
        const day = parseInt(ymdMatch[3], 10);
        const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
        const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
        const second = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
        const d = new Date(year, month, day, hour, minute, second);
        return isNaN(d.getTime()) ? null : d;
    }

    // Check if it's DD/MM/YYYY or DD-MM-YYYY or similar with optional time
    const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:$|[T\s](\d{2}):(\d{2})(?::(\d{2}))?)/;
    const match = s.match(dmyRegex);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed
        const year = parseInt(match[3], 10);
        const hour = match[4] ? parseInt(match[4], 10) : 0;
        const minute = match[5] ? parseInt(match[5], 10) : 0;
        const second = match[6] ? parseInt(match[6], 10) : 0;
        const d = new Date(year, month, day, hour, minute, second);
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
    if (type.includes('2.3') || type.includes('2.4') || type.includes('2.5') || type.includes('2.6') || type.includes('số thửa') || type.includes('trích đo') || type.includes('đo đạc') || code.startsWith('2.')) {
        return 'Tổ Đo đạc';
    }
    if (type.includes('2.1') || type.includes('2.2') || type.includes('trích lục')) {
        return 'Tổ Cấp giấy';
    }
    return 'Tổ Đo đạc';
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
    return formatDateDDMMYYYY(d);
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

export function formatBatchName(batch: number | string | null | undefined, _deptName?: string, dateStr?: string | null): string {
    if (!batch && batch !== 0) return '';
    let bStr = String(batch).trim();
    if (!bStr) return '';

    // Loại bỏ các mã tổ chuyên môn cũ nếu có (-CG-, -LT-, -DD-, -Tổ Cấp giấy-)
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
    if (!batch && batch !== 0) return { batchName: '', dateName: '' };
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
        dateName: dateFormatted ? `Ngày ${dateFormatted}` : ''
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

    const getFallbackBatchNum = (rawDate: string) => {
        const dateKey = String(rawDate).split('T')[0];
        if (existingBatchesByDate[dateKey]) {
            return getPureBatchNumber(existingBatchesByDate[dateKey]) || '1';
        }
        const maxNum = existingMaxBatchNumByDate[dateKey] || 1;
        return String(maxNum);
    };

    const migratedRecords = records.map(r => {
        let currentBatch = r.exportBatch;

        // Chuẩn hóa tên đợt xuất chỉ lưu duy nhất số đợt
        if (currentBatch && currentBatch !== 'NOT_BATCHED') {
            const pureNum = getPureBatchNumber(currentBatch);
            if (pureNum && pureNum !== String(currentBatch)) {
                currentBatch = pureNum;
                hasChanges = true;
            }
        }

        const isHandedOver = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || Boolean((r as any).is_handover);
        const missingBatch = !currentBatch || String(currentBatch).trim() === '' || currentBatch === 'NOT_BATCHED';

        if (isHandedOver && missingBatch) {
            hasChanges = true;
            const rawDate = r.exportDate || r.completedDate || r.receivedDate || new Date().toISOString();
            const defaultBatchNum = getFallbackBatchNum(rawDate);

            return {
                ...r,
                exportBatch: defaultBatchNum,
                exportDate: r.exportDate || rawDate,
                completedDate: r.completedDate || rawDate,
                status: r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? r.status : RecordStatus.HANDOVER
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

// Kiểm tra thủ tục 2.3 (Duyệt Đơn & Cung cấp số thửa) - Miễn thu phí
export function isProcedure2_3(recordType: string | null | undefined): boolean {
    if (!recordType) return false;
    const lower = recordType.toLowerCase().trim();
    return lower.startsWith('2.3') || 
           lower.startsWith('2.6') || 
           lower.includes('duyệt đơn') || 
           lower.includes('duyet don') || 
           lower.includes('số thửa') || 
           lower.includes('so thua') || 
           lower.includes('cung cấp số thửa') || 
           lower.includes('cập nhật số thửa') || 
           lower.includes('cập nhập số thửa') ||
           lower === '2.3';
}

export interface StatusTransitionOptions {
    targetDate?: string;
    reason?: string;
    userName?: string;
    userId?: string;
    assignedTo?: string | null;
    checkedBy?: string | null;
    submittedTo?: string | null;
    receivedBy?: string | null;
    customDates?: {
        receivedDate?: string | null;
        assignedDate?: string | null;
        completedWorkDate?: string | null;
        pendingCheckDate?: string | null;
        checkedDate?: string | null;
        submissionDate?: string | null;
        approvalDate?: string | null;
        completedDate?: string | null;
        exportDate?: string | null;
        resultReturnedDate?: string | null;
    };
    exportBatch?: number | string | null;
    exportDate?: string | null;
    handoverWard?: string | null;
    resultReturnedDate?: string | null;
    receiverName?: string | null;
    receiptNumber?: string | null;
    returnedPrice?: number | null;
}

const STATUS_RANK: Record<string, number> = {
    [RecordStatus.RECEIVED]: 0,
    [RecordStatus.ASSIGNED]: 1,
    [RecordStatus.IN_PROGRESS]: 1,
    [RecordStatus.COMPLETED_WORK]: 2,
    [RecordStatus.PENDING_CHECK]: 3,
    [RecordStatus.CHECKED]: 4,
    [RecordStatus.PENDING_SIGN]: 5,
    [RecordStatus.SIGNED]: 6,
    [RecordStatus.HANDOVER]: 7,
    [RecordStatus.RETURNED]: 8,
    [RecordStatus.WITHDRAWN]: 99,
    [RecordStatus.REJECTED]: 99,
    [RecordStatus.PENDING_SUPPLEMENT]: 1.5
};

/**
 * Hàm đồng bộ trạng thái trung tâm: Đảm bảo khi một hồ sơ thay đổi trạng thái tại bất kỳ module nào,
 * tất cả các trường ngày tháng, người thực hiện, nhật ký statusLogs và tiến độ hiển thị đều được dọn dẹp sạch sẽ
 * và đồng bộ nhất quán ngay lập tức.
 */
export function syncRecordStatusTransition(
    currentRecord: Partial<RecordFile>,
    newStatus: RecordStatus,
    options?: StatusTransitionOptions
): Partial<RecordFile> {
    const prevStatus = currentRecord.status;
    const targetDate = options?.targetDate || new Date().toISOString();
    const updates: Partial<RecordFile> = { status: newStatus };

    // Cập nhật người thực hiện nếu có truyền vào
    if (options?.assignedTo) updates.assignedTo = options.assignedTo;
    if (options?.checkedBy) updates.checkedBy = options.checkedBy;
    if (options?.submittedTo) updates.submittedTo = options.submittedTo;
    if (options?.receivedBy) updates.receivedBy = options.receivedBy;
    if (options?.handoverWard) updates.handoverWard = options.handoverWard;

    const newRank = STATUS_RANK[newStatus] ?? 0;
    const prevRank = currentRecord.status ? (STATUS_RANK[currentRecord.status] ?? 0) : 0;
    const isRollback = prevRank > newRank;

    if (newStatus === RecordStatus.WITHDRAWN || newStatus === RecordStatus.REJECTED) {
        updates.completedDate = options?.customDates?.completedDate || currentRecord.completedDate || targetDate;
        updates.resultReturnedDate = undefined;
        updates.receiverName = undefined;
    } else {
        // DỌN DẸP NẾU QUAY LÙI BƯỚC (Chỉ xóa khi thực sự quay lùi trạng thái và không có customDates bảo toàn)
        if (isRollback && !options?.customDates) {
            if (newRank < 1) {
                updates.assignedDate = undefined;
                updates.completedWorkDate = undefined;
                updates.pendingCheckDate = undefined;
                updates.checkedDate = undefined;
                updates.submissionDate = undefined;
                updates.approvalDate = undefined;
                updates.completedDate = undefined;
                updates.exportDate = undefined;
                updates.exportBatch = undefined;
                updates.is_handover = false;
                updates.handover_date = undefined;
                updates.resultReturnedDate = undefined;
                updates.receiverName = undefined;
            } else if (newRank < 2) {
                updates.completedWorkDate = undefined;
                updates.pendingCheckDate = undefined;
                updates.checkedDate = undefined;
                updates.submissionDate = undefined;
                updates.approvalDate = undefined;
                updates.completedDate = undefined;
                updates.exportDate = undefined;
                updates.exportBatch = undefined;
                updates.is_handover = false;
                updates.handover_date = undefined;
                updates.resultReturnedDate = undefined;
                updates.receiverName = undefined;
            } else if (newRank < 3) {
                updates.pendingCheckDate = undefined;
                updates.checkedDate = undefined;
                updates.submissionDate = undefined;
                updates.approvalDate = undefined;
                updates.completedDate = undefined;
                updates.exportDate = undefined;
                updates.exportBatch = undefined;
                updates.is_handover = false;
                updates.handover_date = undefined;
                updates.resultReturnedDate = undefined;
                updates.receiverName = undefined;
            } else if (newRank < 4) {
                updates.checkedDate = undefined;
                updates.submissionDate = undefined;
                updates.approvalDate = undefined;
                updates.completedDate = undefined;
                updates.exportDate = undefined;
                updates.exportBatch = undefined;
                updates.is_handover = false;
                updates.handover_date = undefined;
                updates.resultReturnedDate = undefined;
                updates.receiverName = undefined;
            } else if (newRank < 5) {
                updates.submissionDate = undefined;
                updates.approvalDate = undefined;
                updates.completedDate = undefined;
                updates.exportDate = undefined;
                updates.exportBatch = undefined;
                updates.is_handover = false;
                updates.handover_date = undefined;
                updates.resultReturnedDate = undefined;
                updates.receiverName = undefined;
            } else if (newRank < 6) {
                updates.approvalDate = undefined;
                updates.completedDate = undefined;
                updates.exportDate = undefined;
                updates.exportBatch = undefined;
                updates.is_handover = false;
                updates.handover_date = undefined;
                updates.resultReturnedDate = undefined;
                updates.receiverName = undefined;
            } else if (newRank < 7) {
                updates.completedDate = undefined;
                updates.exportDate = undefined;
                updates.exportBatch = undefined;
                updates.is_handover = false;
                updates.handover_date = undefined;
                updates.resultReturnedDate = undefined;
                updates.receiverName = undefined;
            } else if (newRank < 8) {
                updates.resultReturnedDate = undefined;
                updates.receiverName = undefined;
            }
        }

        // TỰ ĐỘNG BÙ NGÀY HOẶC SET NGÀY THEO BƯỚC HIỆN TẠI NẾU TIẾN TỚI
        if (newRank >= 1 && !updates.assignedDate && !currentRecord.assignedDate) {
            updates.assignedDate = options?.customDates?.assignedDate || targetDate;
        } else if (options?.customDates?.assignedDate) {
            updates.assignedDate = options.customDates.assignedDate;
        }

        if (newRank >= 2 && !updates.completedWorkDate && !currentRecord.completedWorkDate) {
            updates.completedWorkDate = options?.customDates?.completedWorkDate || targetDate;
        } else if (options?.customDates?.completedWorkDate) {
            updates.completedWorkDate = options.customDates.completedWorkDate;
        }

        if (newRank >= 3 && !updates.pendingCheckDate && !currentRecord.pendingCheckDate) {
            updates.pendingCheckDate = options?.customDates?.pendingCheckDate || targetDate;
        } else if (options?.customDates?.pendingCheckDate) {
            updates.pendingCheckDate = options.customDates.pendingCheckDate;
        }

        if (newRank >= 4 && !updates.checkedDate && !currentRecord.checkedDate) {
            updates.checkedDate = options?.customDates?.checkedDate || targetDate;
        } else if (options?.customDates?.checkedDate) {
            updates.checkedDate = options.customDates.checkedDate;
        }

        if (newRank >= 5 && !updates.submissionDate && !currentRecord.submissionDate) {
            updates.submissionDate = options?.customDates?.submissionDate || targetDate;
        } else if (options?.customDates?.submissionDate) {
            updates.submissionDate = options.customDates.submissionDate;
        }

        if (newRank >= 6 && !updates.approvalDate && !currentRecord.approvalDate) {
            updates.approvalDate = options?.customDates?.approvalDate || targetDate;
        } else if (options?.customDates?.approvalDate) {
            updates.approvalDate = options.customDates.approvalDate;
        }

        if (newRank >= 7) {
            updates.completedDate = options?.customDates?.completedDate || currentRecord.completedDate || targetDate;
            updates.exportDate = options?.exportDate || options?.customDates?.exportDate || currentRecord.exportDate || targetDate;
            if (options?.exportBatch !== undefined) updates.exportBatch = options.exportBatch;
            updates.is_handover = true;
            updates.handover_date = updates.exportDate;
        }

        if (newRank >= 8) {
            updates.resultReturnedDate = options?.resultReturnedDate || options?.customDates?.resultReturnedDate || currentRecord.resultReturnedDate || targetDate;
            if (!updates.completedDate) updates.completedDate = updates.resultReturnedDate;
            if (options?.receiverName) updates.receiverName = options.receiverName;
            if (options?.receiptNumber) updates.receiptNumber = options.receiptNumber;
            if (options?.returnedPrice !== undefined) updates.returnedPrice = options.returnedPrice;
        }

        // BẢO TOÀN TUYỆT ĐỐI TẤT CẢ CÁC MỐC NGÀY TRUYỀN VÀO TỪ CUSTOM DATES
        if (options?.customDates) {
            if (options.customDates.receivedDate !== undefined && options.customDates.receivedDate !== null && options.customDates.receivedDate !== '') updates.receivedDate = options.customDates.receivedDate;
            if (options.customDates.assignedDate !== undefined && options.customDates.assignedDate !== null && options.customDates.assignedDate !== '') updates.assignedDate = options.customDates.assignedDate;
            if (options.customDates.completedWorkDate !== undefined && options.customDates.completedWorkDate !== null && options.customDates.completedWorkDate !== '') updates.completedWorkDate = options.customDates.completedWorkDate;
            if (options.customDates.pendingCheckDate !== undefined && options.customDates.pendingCheckDate !== null && options.customDates.pendingCheckDate !== '') updates.pendingCheckDate = options.customDates.pendingCheckDate;
            if (options.customDates.checkedDate !== undefined && options.customDates.checkedDate !== null && options.customDates.checkedDate !== '') updates.checkedDate = options.customDates.checkedDate;
            if (options.customDates.submissionDate !== undefined && options.customDates.submissionDate !== null && options.customDates.submissionDate !== '') updates.submissionDate = options.customDates.submissionDate;
            if (options.customDates.approvalDate !== undefined && options.customDates.approvalDate !== null && options.customDates.approvalDate !== '') updates.approvalDate = options.customDates.approvalDate;
            if (options.customDates.completedDate !== undefined && options.customDates.completedDate !== null && options.customDates.completedDate !== '') updates.completedDate = options.customDates.completedDate;
            if (options.customDates.exportDate !== undefined && options.customDates.exportDate !== null && options.customDates.exportDate !== '') updates.exportDate = options.customDates.exportDate;
            if (options.customDates.resultReturnedDate !== undefined && options.customDates.resultReturnedDate !== null && options.customDates.resultReturnedDate !== '') updates.resultReturnedDate = options.customDates.resultReturnedDate;
        }
    }

    // Ghi nhật ký statusLogs
    if (prevStatus !== newStatus) {
        const existingLogs = Array.isArray(currentRecord.statusLogs) ? [...currentRecord.statusLogs] : [];
        const newLog = {
            id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            recordId: currentRecord.id || '',
            previousStatus: prevStatus || null,
            newStatus: newStatus,
            changedAt: targetDate,
            changedBy: options?.userName || 'Hệ thống',
            userId: options?.userId,
            reason: options?.reason || 'Cập nhật trạng thái'
        };
        updates.statusLogs = [...existingLogs, newLog];
    }

    return updates;
}

/**
 * Khử trùng lặp hồ sơ toàn cục dựa trên ID duy nhất
 * Đảm bảo mỗi hồ sơ chỉ xuất hiện 1 lần duy nhất trong toàn bộ hệ thống
 */
export function deduplicateRecords<T extends { id?: string }>(records: T[]): T[] {
    if (!Array.isArray(records) || records.length === 0) return [];
    const uniqueMap = new Map<string, T>();
    for (const r of records) {
        if (!r || !r.id) continue;
        if (!uniqueMap.has(r.id)) {
            uniqueMap.set(r.id, r);
        } else {
            const existing = uniqueMap.get(r.id)!;
            uniqueMap.set(r.id, {
                ...r,
                ...existing
            });
        }
    }
    return Array.from(uniqueMap.values());
}








