import { RecordStatus, RecordFile, Employee, User } from '../types';
import { getShortRecordType, DEFAULT_HOLIDAYS, isArchiveRecordType, isSurveyRecordType } from '../constants';
import { parseSafeDate, formatDateKey } from './appHelpers';
import { loadRegistrationSlaFullConfig, ProcedureItemConfig, ProcedureStep } from '../components/registration/RegistrationSlaStatusView';

export type RegistrationWorkflowCategory = 
  | 'tax_transfer'
  | 'fast_track'
  | 'gdbd'
  | 'gdbd_register'
  | 'gdbd_release'
  | 'lost_cert'
  | 'lost_cert_tax'
  | 'split_plot'
  | 'unclassified';

export interface WorkflowStep {
  id?: string;
  key?: RecordStatus | string;
  statusKey?: RecordStatus | string;
  label?: string;
  name?: string;
  shortLabel?: string;
  description?: string;
  dateField?: keyof RecordFile;
  badgeColor?: string;
  durationHours?: number;
  durationDays?: number;
  durationMinutes?: number;
  totalMinutes?: number;
  durationLabel?: string;
  department?: string;
  isTaxPhase?: boolean;
  isPostingPhase?: boolean;
  isSlaPaused?: boolean;
}

export interface RegistrationWorkflowConfig {
  id?: string;
  code?: string;
  title: string;
  name?: string;
  subtitle?: string;
  category: RegistrationWorkflowCategory | string;
  standardDays: number;
  totalDays?: number;
  steps: WorkflowStep[];
}

export interface StepSlaInfo {
  step: WorkflowStep;
  durationHours: number;
  durationDays: number;
  durationLabel: string;
  elapsedHours: number;
  elapsedLabel: string;
  remainingHours: number;
  remainingLabel: string;
  status: 'ontime' | 'warning' | 'overdue' | 'paused' | 'completed' | 'waiting';
  isOverdue: boolean;
  isWarning?: boolean;
  isPaused?: boolean;
  isCompleted?: boolean;
  stepHeaderText?: string;
  pauseReason?: string;
  overdueHours: number;
  overdueLabel: string;
  percent: number;
  startTime: string | null;
  badgeText?: string;
  badgeClass?: string;
}

export interface AppointmentInfo {
  phase: 'tax_notice' | 'final_result' | 'unclassified';
  label: string;
  shortLabel: string;
  appointmentDate: string | null;
  formattedAppointmentDate: string;
  description: string;
}

// --- KHUNG GIỜ LÀM VIỆC CHUẨN (BUSINESS WORKING HOURS SLA ENGINE) ---
// Buổi sáng: 07:30 - 11:30 (4h)
// Nghỉ trưa: 11:30 - 13:30 (2h)
// Buổi chiều: 13:30 - 17:30 (4h)
// Tổng cộng: 8 giờ làm việc / ngày. Thứ 7, Chủ nhật và Ngày lễ tự động bỏ qua.

export const isWorkdayDate = (d: Date, holidays: any = DEFAULT_HOLIDAYS): boolean => {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const dateKey = formatDateKey(d);
  if (Array.isArray(holidays)) {
    return !holidays.some(h => (typeof h === 'string' ? h === dateKey : h.date === dateKey));
  }
  return true;
};

export const getNextWorkdayStart = (d: Date, holidays: any = DEFAULT_HOLIDAYS): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  next.setHours(7, 30, 0, 0);
  while (!isWorkdayDate(next, holidays)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

export const normalizeToWorkingStart = (d: Date, holidays: any = DEFAULT_HOLIDAYS): Date => {
  const target = new Date(d);
  if (!isWorkdayDate(target, holidays)) {
    return getNextWorkdayStart(target, holidays);
  }

  const hours = target.getHours();
  const minutes = target.getMinutes();
  const timeDec = hours + minutes / 60;

  if (timeDec < 7.5) {
    target.setHours(7, 30, 0, 0);
    return target;
  }
  if (timeDec >= 7.5 && timeDec <= 11.5) {
    return target;
  }
  if (timeDec > 11.5 && timeDec < 13.5) {
    target.setHours(13, 30, 0, 0);
    return target;
  }
  if (timeDec >= 13.5 && timeDec <= 17.5) {
    return target;
  }
  return getNextWorkdayStart(target, holidays);
};

export const addWorkingHours = (startDate: Date, hoursToAdd: number, holidays: any = DEFAULT_HOLIDAYS): Date => {
  if (hoursToAdd <= 0) return new Date(startDate);
  let curr = normalizeToWorkingStart(startDate, holidays);
  let remainingMins = Math.round(hoursToAdd * 60);

  while (remainingMins > 0) {
    if (!isWorkdayDate(curr, holidays)) {
      curr = getNextWorkdayStart(curr, holidays);
      continue;
    }

    const h = curr.getHours() + curr.getMinutes() / 60;

    if (h >= 7.5 && h < 11.5) {
      const availableMins = Math.round((11.5 - h) * 60);
      if (remainingMins <= availableMins) {
        curr.setMinutes(curr.getMinutes() + remainingMins);
        remainingMins = 0;
      } else {
        remainingMins -= availableMins;
        curr.setHours(13, 30, 0, 0);
      }
    } else if (h >= 13.5 && h < 17.5) {
      const availableMins = Math.round((17.5 - h) * 60);
      if (remainingMins <= availableMins) {
        curr.setMinutes(curr.getMinutes() + remainingMins);
        remainingMins = 0;
      } else {
        remainingMins -= availableMins;
        curr = getNextWorkdayStart(curr, holidays);
      }
    } else {
      curr = normalizeToWorkingStart(curr, holidays);
    }
  }

  return curr;
};

export const calculateWorkingHoursBetween = (start: Date, end: Date, holidays: any = DEFAULT_HOLIDAYS): number => {
  if (end.getTime() <= start.getTime()) return 0;

  let curr = new Date(start);
  let totalMinutes = 0;
  const targetEnd = new Date(end);

  while (curr < targetEnd) {
    if (isWorkdayDate(curr, holidays)) {
      const year = curr.getFullYear();
      const month = curr.getMonth();
      const date = curr.getDate();

      const mStart = new Date(year, month, date, 7, 30, 0, 0);
      const mEnd = new Date(year, month, date, 11, 30, 0, 0);
      const aStart = new Date(year, month, date, 13, 30, 0, 0);
      const aEnd = new Date(year, month, date, 17, 30, 0, 0);

      const startM = Math.max(curr.getTime(), mStart.getTime());
      const endM = Math.min(targetEnd.getTime(), mEnd.getTime());
      if (endM > startM) {
        totalMinutes += (endM - startM) / 60000;
      }

      const startA = Math.max(curr.getTime(), aStart.getTime());
      const endA = Math.min(targetEnd.getTime(), aEnd.getTime());
      if (endA > startA) {
        totalMinutes += (endA - startA) / 60000;
      }
    }

    curr.setDate(curr.getDate() + 1);
    curr.setHours(0, 0, 0, 0);
  }

  return totalMinutes / 60;
};

/**
 * Xác định Mốc ngày giờ bắt đầu thực tế cho từng khâu
 */
export const getStepStartDateTime = (record: Partial<RecordFile>, step: WorkflowStep): Date => {
  const d = (typeof record.data === 'object' && record.data !== null) ? record.data : {};
  const normKey = (step.key || step.label || step.name || '').toString().toLowerCase().trim();

  let dateStr = '';
  let timeStr = '';

  const recAny = record as any;
  if (normKey.includes('tiếp nhận') || normKey.includes('receive') || step.key === RecordStatus.RECEIVED) {
    dateStr = record.receivedDate || d.receivedDate || (recAny.createdAt ? String(recAny.createdAt).substring(0, 10) : '');
    timeStr = recAny.receivedTime || d.receivedTime || (recAny.createdAt ? String(recAny.createdAt).substring(11, 16) : '');
  } else if (normKey.includes('thẩm định') || normKey.includes('chuyên viên') || normKey.includes('ngoại nghiệp') || normKey.includes('đo đạc') || step.key === RecordStatus.APPRAISAL || step.key === RecordStatus.ASSIGNED) {
    dateStr = record.assignedDate || d.assignedDate || record.receivedDate || (recAny.createdAt ? String(recAny.createdAt).substring(0, 10) : '');
    timeStr = recAny.assignedTime || d.assignedTime || recAny.receivedTime || d.receivedTime || '07:30';
  } else if (normKey.includes('thuế') || step.isTaxPhase) {
    dateStr = recAny.taxTransferredDate || d.taxTransferredDate || record.taxNoticeDate || record.assignedDate || record.receivedDate || '';
    timeStr = recAny.taxTransferredTime || d.taxTransferredTime || '07:30';
  } else if (normKey.includes('in gcn') || normKey.includes('in giấy')) {
    dateStr = recAny.certPrintDate || d.certPrintDate || record.assignedDate || record.receivedDate || '';
    timeStr = recAny.certPrintTime || d.certPrintTime || '07:30';
  } else if (normKey.includes('ký') || normKey.includes('duyệt')) {
    dateStr = recAny.signedDate || d.signedDate || record.approvalDate || record.assignedDate || record.receivedDate || '';
    timeStr = '07:30';
  } else {
    dateStr = record.assignedDate || d.assignedDate || record.receivedDate || (recAny.createdAt ? String(recAny.createdAt).substring(0, 10) : '');
    timeStr = recAny.assignedTime || d.assignedTime || '07:30';
  }

  if (dateStr) {
    const parsed = parseSafeDate(dateStr);
    if (parsed) {
      if (timeStr && timeStr.includes(':')) {
        const [hh, mm] = timeStr.split(':').map(Number);
        if (!isNaN(hh) && !isNaN(mm)) {
          parsed.setHours(hh, mm, 0, 0);
        }
      } else {
        parsed.setHours(7, 30, 0, 0);
      }
      return parsed;
    }
  }

  if (recAny.createdAt) {
    const dt = new Date(recAny.createdAt);
    if (!isNaN(dt.getTime())) return dt;
  }

  return new Date();
};

/**
 * Xử lý phân loại quy trình Cấp giấy dựa trên Mã Thủ tục (Chỉ trả về nhóm nếu đúng là Cấp giấy 3.x.x)
 */
export const getRegistrationWorkflowCategory = (type: string | undefined | null): string => {
  if (!type || typeof type !== 'string' || !type.trim()) {
    return 'unclassified';
  }
  const code = type.trim();
  // Nếu là mã 1.x (Lưu trữ) hoặc 2.x (Đo đạc) -> Trả về unclassified ngay lập tức
  if (code.startsWith('1.') || code.startsWith('2.')) {
    return 'unclassified';
  }

  const fullConfig = loadRegistrationSlaFullConfig();
  const matchedItem = fullConfig.procedureItems.find(p => p.module === 'dangky' && (p.code === code || code.includes(p.code)));
  return matchedItem ? matchedItem.id : (code.startsWith('3.') || code.includes('3.') ? 'proc_3_2_1' : 'unclassified');
};

/**
 * Cấu hình quy trình Cấp giấy mặc định
 */
export const DEFAULT_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'unclassified',
  title: 'Quy trình Cấp giấy',
  subtitle: 'Thiết lập quy trình và SLA',
  standardDays: 0,
  steps: [],
};

export const getRegistrationWorkflow = (recordType?: string | null): RegistrationWorkflowConfig => {
  const fullConfig = loadRegistrationSlaFullConfig();
  const code = (recordType || '').trim();
  
  // Tìm thủ tục Cấp giấy phù hợp
  let matchedItem = fullConfig.procedureItems.find(p => p.module === 'dangky' && (p.code === code || (code && code.includes(p.code))));
  if (!matchedItem && code) {
    const codePart = code.split(' ')[0];
    matchedItem = fullConfig.procedureItems.find(p => p.module === 'dangky' && (p.code === codePart || codePart.includes(p.code)));
  }
  if (!matchedItem) {
    matchedItem = fullConfig.procedureItems.find(p => p.module === 'dangky') || fullConfig.procedureItems[0];
  }

  const isProcNoSla = Boolean(matchedItem.isNoSla);
  const totalDays = isProcNoSla ? 0 : matchedItem.steps.reduce((sum, s) => {
    if (s.isNoSla) return sum;
    return sum + (s.durationDays || 0);
  }, 0);

  const steps: WorkflowStep[] = matchedItem.steps.map(s => {
    const isStepNoSla = isProcNoSla || Boolean(s.isNoSla);
    return {
      key: s.name,
      label: s.name,
      shortLabel: s.name,
      description: s.description || `Bước ${s.stepNumber}: ${s.name}`,
      badgeColor: isStepNoSla ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800',
      durationHours: isStepNoSla ? 0 : s.durationHours,
      durationDays: isStepNoSla ? 0 : s.durationDays,
      durationLabel: isStepNoSla ? 'Không tính SLA' : `${s.durationDays} ngày`,
      isTaxPhase: s.name.toLowerCase().includes('thue') || s.name.includes('Thuế'),
      isPostingPhase: s.name.toLowerCase().includes('niem yet') || s.name.includes('Niêm Yết') || s.name.includes('Niêm yết'),
    };
  });

  return {
    category: matchedItem.id,
    title: matchedItem.name,
    subtitle: `Mã thủ tục: ${matchedItem.code} (${matchedItem.steps.length} bước)`,
    standardDays: totalDays,
    steps,
  };
};

export const getWorkflowStepIndex = (
  currentStatus: RecordStatus | string,
  steps: WorkflowStep[]
): number => {
  if (!currentStatus || !steps || steps.length === 0) return -1;
  return steps.findIndex(s => s.key === currentStatus || s.label === currentStatus);
};

export const getNextWorkflowStep = (
  currentStatus: RecordStatus | string,
  steps: WorkflowStep[]
): WorkflowStep | null => {
  const idx = getWorkflowStepIndex(currentStatus, steps);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1];
};

export const getPrevWorkflowStep = (
  currentStatus: RecordStatus | string,
  steps: WorkflowStep[]
): WorkflowStep | null => {
  const idx = getWorkflowStepIndex(currentStatus, steps);
  if (idx <= 0) return null;
  return steps[idx - 1];
};

/**
 * Hàm tính số giờ làm việc (Khung 8h/ngày: 7:30 - 11:30 & 13:30 - 17:30)
 */
export const calculateWorkingHours = (
  startStr: string,
  endStr?: string | Date | null,
  holidays: any = DEFAULT_HOLIDAYS
): number => {
  if (!startStr) return 0;
  const startDate = parseSafeDate(startStr);
  if (!startDate) return 0;
  const endDate = endStr ? (typeof endStr === 'string' ? parseSafeDate(endStr) : endStr) : new Date();
  if (!endDate || endDate < startDate) return 0;

  const diffMs = endDate.getTime() - startDate.getTime();
  const diffHours = diffMs / (1000 * 3600);
  return Math.max(0, Number(diffHours.toFixed(1)));
};

export const formatWorkingHours = (hours: number): string => {
  if (!hours || hours <= 0) return '0 phút';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
};

export const calculateWorkingDaysBetween = (
  startDateStr: string,
  endDateStr: string,
  holidays: any = DEFAULT_HOLIDAYS
): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = parseSafeDate(startDateStr);
  const end = parseSafeDate(endDateStr);
  if (!start || !end || end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

export const addWorkingDays = (
  startDateStr: string,
  days: number,
  holidays: any = DEFAULT_HOLIDAYS
): string => {
  if (!startDateStr) return '';
  const dt = parseSafeDate(startDateStr) || new Date();
  let added = 0;
  const result = new Date(dt);
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return formatDateKey(result);
};

export const addCalendarDays = (startDateStr: string, days: number): string => {
  if (!startDateStr) return '';
  const dt = parseSafeDate(startDateStr) || new Date();
  dt.setDate(dt.getDate() + days);
  return formatDateKey(dt);
};

export const calculateRegistrationDeadline = (
  record: Partial<RecordFile>,
  holidays?: any
): {
  deadline: string;
  standardDays: number;
  category: string;
  workingDays: number;
  hasPostingNotice?: boolean;
  postingEndDate?: string;
} => {
  const workflow = getRegistrationWorkflow(record.recordType || (record as any).procedureCode || '');
  const receivedDate = record.receivedDate || formatDateKey(new Date());
  const standardDays = workflow.standardDays;
  const calculatedDeadline = standardDays > 0 ? addWorkingDays(receivedDate, Math.ceil(standardDays), holidays) : (receivedDate || '');

  return {
    deadline: calculatedDeadline || record.deadline || '',
    standardDays,
    category: workflow.category,
    workingDays: standardDays,
    hasPostingNotice: workflow.steps.some(s => s.isPostingPhase),
    postingEndDate: workflow.steps.some(s => s.isPostingPhase) ? addWorkingDays(receivedDate, 15, holidays) : '',
  };
};

export const getAppointmentInfo = (record: Partial<RecordFile>): AppointmentInfo => {
  const d = record.deadline || record.receivedDate || '—';
  return {
    phase: 'final_result',
    label: 'Hẹn trả kết quả',
    shortLabel: 'Hẹn trả GCN',
    appointmentDate: d,
    formattedAppointmentDate: d ? d.split('-').reverse().join('/') : '—',
    description: 'Thời hạn giải quyết theo quy trình',
  };
};

export const getStepSlaInfo = (
  record: Partial<RecordFile>,
  stepKey?: RecordStatus | string,
  holidays: any = DEFAULT_HOLIDAYS
): StepSlaInfo => {
  const workflow = getRegistrationWorkflow(record.recordType || (record as any).procedureCode || '');
  const steps = workflow?.steps || [];
  const currentStepName = stepKey || record.status || (steps[0]?.label || 'Tiếp nhận');
  const currentStep = steps.find(s => s.key === currentStepName || s.label === currentStepName || s.statusKey === currentStepName) || steps[0] || {
    key: RecordStatus.RECEIVED,
    label: 'Tiếp nhận hồ sơ',
    shortLabel: 'Tiếp nhận',
    description: 'Tiếp nhận hồ sơ',
    durationHours: 8,
    durationDays: 1
  };

  const stepShortName = currentStep.shortLabel || currentStep.label || currentStep.name || 'Khâu xử lý';
  const durationHours = currentStep.durationHours ?? (currentStep.durationDays ? currentStep.durationDays * 8 : 8);
  const durationDays = currentStep.durationDays ?? (durationHours / 8);

  const isCompleted = [
    RecordStatus.HANDOVER,
    RecordStatus.RETURNED,
    RecordStatus.WITHDRAWN,
    RecordStatus.REJECTED,
    RecordStatus.SIGNED
  ].includes(record.status as RecordStatus) || Boolean(record.exportDate || record.resultReturnedDate);

  if (isCompleted) {
    return {
      step: currentStep,
      durationHours,
      durationDays,
      durationLabel: `${durationDays} ngày (${durationHours}h)`,
      elapsedHours: durationHours,
      elapsedLabel: `${durationHours} giờ`,
      remainingHours: 0,
      remainingLabel: '0 giờ',
      status: 'completed',
      isOverdue: false,
      isCompleted: true,
      overdueHours: 0,
      overdueLabel: '0 giờ',
      percent: 100,
      startTime: null,
      badgeText: `[${stepShortName}: Đã xong]`,
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold',
    };
  }

  const d = (typeof record.data === 'object' && record.data !== null) ? record.data : {};
  const isPaused = Boolean(
    currentStep.isSlaPaused ||
    (currentStep as any).isNoSla ||
    currentStep.isPostingPhase ||
    currentStep.isTaxPhase ||
    d.isSlaPaused ||
    d.isNoSla ||
    record.status === RecordStatus.PENDING_POSTING ||
    record.status === RecordStatus.PENDING_TAX_NOTICE
  );

  if (isPaused) {
    return {
      step: currentStep,
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Không tính SLA',
      elapsedHours: 0,
      elapsedLabel: '0 giờ',
      remainingHours: 0,
      remainingLabel: 'Tạm dừng SLA',
      status: 'paused',
      isOverdue: false,
      isPaused: true,
      pauseReason: currentStep.isPostingPhase ? 'Niêm yết 30 ngày' : 'Chờ thông báo thuế',
      overdueHours: 0,
      overdueLabel: '0 giờ',
      percent: 50,
      startTime: null,
      badgeText: `[${stepShortName}: ⏸️ Tạm dừng SLA]`,
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
    };
  }

  const startDateTime = getStepStartDateTime(record, currentStep);
  const normalizedStart = normalizeToWorkingStart(startDateTime, holidays);
  const stepDeadline = addWorkingHours(normalizedStart, durationHours, holidays);
  const now = new Date();

  if (now > stepDeadline) {
    const overdueWorkingHours = calculateWorkingHoursBetween(stepDeadline, now, holidays);
    const isOverdueInHours = overdueWorkingHours < 8;
    
    let overdueLabel = '';
    let badgeText = '';

    if (isOverdueInHours) {
      const h = Math.max(1, Math.round(overdueWorkingHours));
      overdueLabel = `${h} giờ`;
      badgeText = `[${stepShortName}: Quá hạn ${h} giờ]`;
    } else {
      const days = Math.floor(overdueWorkingHours / 8);
      const remH = Math.round(overdueWorkingHours % 8);
      if (days >= 30) {
        const m = Math.floor(days / 30);
        const remD = days % 30;
        overdueLabel = remD > 0 ? `${m} tháng ${remD} ngày` : `${m} tháng`;
        badgeText = `[${stepShortName}: Quá hạn ${overdueLabel}]`;
      } else if (remH > 0 && days <= 3) {
        overdueLabel = `${days} ngày ${remH} giờ`;
        badgeText = `[${stepShortName}: Quá hạn ${days} ngày ${remH} giờ]`;
      } else {
        overdueLabel = `${days} ngày`;
        badgeText = `[${stepShortName}: Quá hạn ${days} ngày]`;
      }
    }

    return {
      step: currentStep,
      durationHours,
      durationDays,
      durationLabel: `${durationDays} ngày (${durationHours}h)`,
      elapsedHours: durationHours + overdueWorkingHours,
      elapsedLabel: `${Math.round(durationHours + overdueWorkingHours)} giờ`,
      remainingHours: 0,
      remainingLabel: 'Hết hạn',
      status: 'overdue',
      isOverdue: true,
      overdueHours: overdueWorkingHours,
      overdueLabel,
      percent: 100,
      startTime: normalizedStart.toISOString(),
      badgeText,
      badgeClass: 'bg-red-100 text-red-700 border border-red-200 font-bold',
    };
  } else {
    const remainingHours = calculateWorkingHoursBetween(now, stepDeadline, holidays);
    const elapsedWorkingHours = calculateWorkingHoursBetween(normalizedStart, now, holidays);
    const percent = durationHours > 0 ? Math.min(99, Math.round((elapsedWorkingHours / durationHours) * 100)) : 0;
    const isWarning = remainingHours <= 4;

    let remainingLabel = '';
    let badgeText = '';

    if (remainingHours <= 8) {
      const h = Math.max(1, Math.round(remainingHours));
      remainingLabel = `${h} giờ`;
      badgeText = `[${stepShortName}: Còn ${h} giờ]`;
    } else {
      const days = Math.floor(remainingHours / 8);
      remainingLabel = `${days} ngày`;
      badgeText = `[${stepShortName}: Còn ${days} ngày]`;
    }

    return {
      step: currentStep,
      durationHours,
      durationDays,
      durationLabel: `${durationDays} ngày (${durationHours}h)`,
      elapsedHours: elapsedWorkingHours,
      elapsedLabel: `${Math.round(elapsedWorkingHours)} giờ`,
      remainingHours,
      remainingLabel,
      status: isWarning ? 'warning' : 'ontime',
      isOverdue: false,
      isWarning,
      overdueHours: 0,
      overdueLabel: '0 giờ',
      percent,
      startTime: normalizedStart.toISOString(),
      badgeText,
      badgeClass: isWarning ? 'bg-orange-100 text-orange-700 border border-orange-200 font-bold' : 'bg-blue-50 text-blue-700 border border-blue-200 font-medium',
    };
  }
};

/**
 * Hàm lấy huy hiệu SLA / Quá hạn tổng hợp hiển thị ngay dưới Mã hồ sơ
 */
export const getRecordSlaBadge = (record: RecordFile | Partial<RecordFile>, holidays: any = DEFAULT_HOLIDAYS): {
  isOverdue: boolean;
  isApproaching: boolean;
  isPaused: boolean;
  label: string;
  badgeClass: string;
} | null => {
  if (!record) return null;

  // 1. Kiểm tra trạng thái hoàn thành
  const statusLower = String(record.status || '').toLowerCase().trim();
  const completedStatuses = [
    RecordStatus.HANDOVER,
    RecordStatus.RETURNED,
    RecordStatus.WITHDRAWN,
    RecordStatus.REJECTED,
    RecordStatus.SIGNED,
    'completed',
    'handover',
    'returned',
    'withdrawn',
    'rejected',
    'signed'
  ];
  const d = (typeof record.data === 'object' && record.data !== null) ? record.data : {};
  if (
    completedStatuses.includes(record.status as any) ||
    completedStatuses.includes(statusLower) ||
    record.exportDate ||
    record.exportBatch ||
    record.resultReturnedDate ||
    d.ngay_hoan_thanh ||
    d.exportBatch
  ) {
    return null;
  }

  // 2. Kiểm tra trạng thái tạm dừng: chờ bổ sung hoặc niêm yết
  if (
    record.status === RecordStatus.PENDING_SUPPLEMENT ||
    statusLower === 'pending_supplement' ||
    record.status === RecordStatus.PENDING_POSTING ||
    statusLower === 'pending_posting' ||
    record.status === RecordStatus.PENDING_TAX_NOTICE ||
    statusLower === 'pending_tax_notice' ||
    d.isSlaPaused ||
    d.isNoSla
  ) {
    return {
      isOverdue: false,
      isApproaching: false,
      isPaused: true,
      label: '⏸️ Tạm dừng tính SLA',
      badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold'
    };
  }

  // 3. Đối với hồ sơ Cấp giấy: Tính SLA chi tiết cho từng khâu
  const recType = String(record.recordType || (record as any).procedureCode || (record as any).department || '').trim();
  const dept = String((record as any).department || d.department || '').trim();
  const isArchive = recType.startsWith('1.') || (record as any).type === 'saoluc' || (record as any).type === 'congvan' || (record as any).type === 'vaoso' || isArchiveRecordType(recType) || record.sourceTable === 'luutru_records';
  const isSurvey = recType.startsWith('2.') || isSurveyRecordType(recType) || isSurveyRecordType(record.content);
  const isRegistration = !isArchive && !isSurvey && (dept.toLowerCase().includes('đăng ký') || dept.toLowerCase().includes('cấp giấy') || recType.startsWith('3.') || recType.startsWith('4.'));

  if (isRegistration) {
    const sla = getStepSlaInfo(record, undefined, holidays);
    if (sla.isPaused) {
      return {
        isOverdue: false,
        isApproaching: false,
        isPaused: true,
        label: '⏸️ Tạm dừng tính SLA',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold'
      };
    }
    if (sla.isOverdue) {
      return {
        isOverdue: true,
        isApproaching: false,
        isPaused: false,
        label: `Quá hạn ${sla.overdueLabel}`,
        badgeClass: 'bg-red-100 text-red-700 border border-red-200 font-bold'
      };
    }
    // Sắp trễ hạn: chỉ đổi màu khi còn <= 1h làm việc, không hiển thị chữ thời gian
    if (sla.remainingHours <= 1 && sla.remainingHours > 0) {
      return {
        isOverdue: false,
        isApproaching: true,
        isPaused: false,
        label: '',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-400 font-bold'
      };
    }
    return null;
  }

  // 4. Đối với các hồ sơ khác (Đo đạc 2.x, Lưu trữ 1.x, v.v.): Tính quá hạn theo mốc giờ làm việc của hạn trả kết quả
  const deadlineRaw = record.deadline || d.hen_tra || d.deadline || (record as any).hen_tra;
  if (!deadlineRaw) return null;
  const deadlineDate = parseSafeDate(deadlineRaw);
  if (!deadlineDate) return null;

  // Hạn chót chuẩn theo hành chính là 17:30 của ngày hẹn trả
  if (typeof deadlineRaw === 'string' && !deadlineRaw.includes('T') && !deadlineRaw.includes(':')) {
    deadlineDate.setHours(17, 30, 0, 0);
  } else if (deadlineDate.getHours() === 0 && deadlineDate.getMinutes() === 0) {
    deadlineDate.setHours(17, 30, 0, 0);
  }

  const now = new Date();

  if (now > deadlineDate) {
    const overdueWorkingHours = calculateWorkingHoursBetween(deadlineDate, now, holidays);
    let label = '';
    if (overdueWorkingHours < 8) {
      const h = Math.max(1, Math.round(overdueWorkingHours));
      label = `Quá hạn ${h} giờ`;
    } else {
      const days = Math.floor(overdueWorkingHours / 8);
      const remH = Math.round(overdueWorkingHours % 8);
      if (days >= 30) {
        const m = Math.floor(days / 30);
        const remD = days % 30;
        label = remD > 0 ? `Quá hạn ${m} tháng ${remD} ngày` : `Quá hạn ${m} tháng`;
      } else if (remH > 0 && days <= 3) {
        label = `Quá hạn ${days} ngày ${remH} giờ`;
      } else {
        label = `Quá hạn ${days} ngày`;
      }
    }
    return {
      isOverdue: true,
      isApproaching: false,
      isPaused: false,
      label,
      badgeClass: 'bg-red-100 text-red-700 border border-red-200 font-bold'
    };
  }

  // Sắp quá hạn khi còn <= 1h làm việc trước hạn chót: Chỉ đổi màu, không hiển thị text
  const remainingHours = calculateWorkingHoursBetween(now, deadlineDate, holidays);
  if (remainingHours <= 1 && remainingHours > 0) {
    return {
      isOverdue: false,
      isApproaching: true,
      isPaused: false,
      label: '',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-400 font-bold'
    };
  }

  return null;
};

// Aliases and compatibility helpers for registration module components
export type RegistrationProcedureConfig = RegistrationWorkflowConfig;
export type RegistrationStepConfig = WorkflowStep;
export type StepSlaResult = StepSlaInfo;

export interface WorkingHoursConfig {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
}

export const getProcedureByRecordType = getRegistrationWorkflow;
export const calculateRecordStepSla = getStepSlaInfo;

export const formatDurationShort = (hours: number): string => `${hours}h`;
export const formatMinutesToVietnamese = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
};

export const DEFAULT_PROCEDURES: RegistrationWorkflowConfig[] = [];
export const loadProceduresConfig = () => DEFAULT_PROCEDURES;
export const saveProceduresConfig = (_cfg: any) => {};
export const resetProceduresToDefault = () => DEFAULT_PROCEDURES;
export const loadWorkingHoursConfig = (): WorkingHoursConfig => ({
  morningStart: '07:30',
  morningEnd: '11:30',
  afternoonStart: '13:00',
  afternoonEnd: '17:00',
});
export const saveWorkingHoursConfig = (_cfg: any) => {};

/**
 * Giải quyết Mốc ngày và Thông tin Người được giao / Người thực hiện cho từng bước trong quy trình
 */
export const resolveWorkflowStepDetails = (
  step: WorkflowStep,
  record: any,
  employees: Employee[] = [],
  users: User[] = []
): { date: string | null; assigneeInfo: string | null; isAssigned: boolean } => {
  if (!step || !record) return { date: null, assigneeInfo: null, isAssigned: false };

  const normKey = (step.key || step.label || step.name || '').toString().toLowerCase().trim();
  const d = (typeof record.data === 'object' && record.data !== null) ? record.data : {};

  const findStaff = (idOrName?: string) => {
    if (!idOrName) return '';
    const keyStr = String(idOrName).trim();
    if (!keyStr) return '';
    const u = users.find(x => x.employeeId === keyStr || x.id === keyStr || x.name === keyStr || (x as any).email === keyStr);
    const e = employees.find(x => x.id === keyStr || x.name === keyStr || x.id === u?.employeeId);
    const name = e?.name || u?.name || keyStr;
    const pos = e?.position || (u as any)?.position || '';
    return pos ? `${name} (${pos})` : name;
  };

  let assigneeInfo: string | null = null;
  let date: string | null = null;
  let isAssigned = false;

  // 1. Dùng dateField nếu quy định sẵn
  if (step.dateField && (record as any)[step.dateField]) {
    date = (record as any)[step.dateField];
  }

  // 2. Tra cứu theo loại bước
  if (normKey.includes('tiếp nhận') || normKey.includes('receive') || step.key === RecordStatus.RECEIVED) {
    const rBy = record.receivedBy || d.receivedBy || d.created_by || record.created_by;
    if (rBy) {
      assigneeInfo = findStaff(rBy);
      isAssigned = true;
    }
    date = date || record.receivedDate || d.receivedDate || d.ngay_nhan || (record.createdAt ? String(record.createdAt).substring(0, 10) : null);
  } 
  else if (normKey.includes('thẩm định') || normKey.includes('chuyên viên') || normKey.includes('ngoại nghiệp') || normKey.includes('đo đạc') || step.key === RecordStatus.APPRAISAL || step.key === RecordStatus.ASSIGNED) {
    const aTo = record.assignedTo || d.assignedTo || d.assigned_to || d.nguoi_thuc_hien || record.surveyorId || d.surveyorId;
    if (aTo) {
      assigneeInfo = findStaff(aTo);
      isAssigned = true;
    }
    date = date || record.assignedDate || d.assignedDate || d.assigned_date || record.completedWorkDate || d.completedWorkDate;
  }
  else if (normKey.includes('thuế') || normKey.includes('tax') || step.isTaxPhase) {
    const aTo = record.assignedTo || d.assignedTo || d.assigned_to || d.nguoi_thuc_hien;
    if (aTo) {
      assigneeInfo = findStaff(aTo);
      isAssigned = true;
    }
    date = date || record.taxTransferredDate || d.taxTransferredDate || record.taxNoticeDate || d.taxNoticeDate || record.assignedDate || d.assignedDate;
  }
  else if (normKey.includes('in gcn') || normKey.includes('in giấy')) {
    const aTo = record.assignedTo || d.assignedTo || d.assigned_to || d.nguoi_thuc_hien;
    if (aTo) {
      assigneeInfo = findStaff(aTo);
      isAssigned = true;
    }
    date = date || record.certPrintDate || d.certPrintDate || record.assignedDate || d.assignedDate;
  }
  else if (normKey.includes('kiểm tra') || step.key === RecordStatus.PENDING_CHECK) {
    const cBy = record.checkedBy || d.checkedBy || d.checked_by || record.assignedTo || d.assignedTo;
    if (cBy) {
      assigneeInfo = findStaff(cBy);
      isAssigned = true;
    }
    date = date || record.checkedDate || d.checkedDate || record.assignedDate || d.assignedDate;
  }
  else if (normKey.includes('ký') || normKey.includes('duyệt') || step.key === RecordStatus.PENDING_SIGN || step.key === RecordStatus.SIGNED) {
    const sTo = record.submittedTo || d.submittedTo || d.submitted_to || record.assignedTo || d.assignedTo;
    if (sTo) {
      assigneeInfo = findStaff(sTo);
      isAssigned = true;
    }
    date = date || record.signedDate || d.signedDate || record.approvalDate || d.approvalDate;
  }
  else if (normKey.includes('bàn giao') || normKey.includes('trả kết quả') || normKey.includes('trả gcn') || step.key === RecordStatus.RETURNED || step.key === RecordStatus.HANDOVER) {
    if (record.receiverName) {
      assigneeInfo = `Người nhận: ${record.receiverName}`;
      isAssigned = true;
    } else if (record.returnedBy || d.returnedBy) {
      assigneeInfo = `Người trả: ${findStaff(record.returnedBy || d.returnedBy)}`;
      isAssigned = true;
    }
    date = date || record.resultReturnedDate || d.resultReturnedDate || record.completedWorkDate || d.completedWorkDate;
  }
  else {
    const aTo = record.assignedTo || d.assignedTo || d.assigned_to || d.nguoi_thuc_hien;
    if (aTo) {
      assigneeInfo = findStaff(aTo);
      isAssigned = true;
    }
    date = date || record.assignedDate || d.assignedDate;
  }

  return { date, assigneeInfo, isAssigned };
};


