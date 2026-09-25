import { RecordStatus, RecordFile, Employee, User } from '../types';
import { getShortRecordType, DEFAULT_HOLIDAYS } from '../constants';
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
  stepHeaderText?: string;
  pauseReason?: string;
  overdueHours: number;
  overdueLabel: string;
  percent: number;
  startTime: string | null;
}

export interface AppointmentInfo {
  phase: 'tax_notice' | 'final_result' | 'unclassified';
  label: string;
  shortLabel: string;
  appointmentDate: string | null;
  formattedAppointmentDate: string;
  description: string;
}

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
  _extraArg?: any
): StepSlaInfo => {
  const workflow = getRegistrationWorkflow(record.recordType || (record as any).procedureCode || '');
  const steps = workflow?.steps || [];
  const currentStepName = stepKey || record.status || (steps[0]?.label || 'Tiếp nhận');
  const currentStep = steps.find(s => s.key === currentStepName || s.label === currentStepName || s.statusKey === currentStepName) || steps[0] || {
    key: RecordStatus.RECEIVED,
    label: 'Tiếp nhận hồ sơ',
    shortLabel: 'Tiếp nhận',
    description: 'Tiếp nhận hồ sơ'
  };

  const durationHours = currentStep.durationHours || 8;
  const durationDays = currentStep.durationDays || 1;

  return {
    step: currentStep,
    durationHours,
    durationDays,
    durationLabel: `${durationDays} ngày (${durationHours}h)`,
    elapsedHours: 0,
    elapsedLabel: '0 giờ',
    remainingHours: durationHours,
    remainingLabel: `${durationHours} giờ`,
    status: 'ontime',
    isOverdue: false,
    overdueHours: 0,
    overdueLabel: '0 giờ',
    percent: 0,
    startTime: record.updatedAt || record.receivedDate || null,
  };
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
    const u = users.find(x => x.employeeId === keyStr || x.id === keyStr || x.name === keyStr || x.email === keyStr);
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


