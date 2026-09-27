import { RecordStatus, RecordFile } from '../types';
import { getShortRecordType, DEFAULT_HOLIDAYS } from '../constants';
import { parseSafeDate, formatDateKey } from './appHelpers';
import { loadRegistrationSlaFullConfig, ProcedureItemConfig, ProcedureStep } from '../components/registration/RegistrationSlaStatusView';

export type RegistrationProcedureConfig = ProcedureItemConfig;
export type RegistrationStepConfig = ProcedureStep;
export type WorkingHoursConfig = any;
export type RegistrationWorkflowCategory = string;
export type StepSlaResult = any;

export const getProcedureByRecordType = (recordType?: string | null): ProcedureItemConfig => {
  const fullConfig = loadRegistrationSlaFullConfig();
  const code = (recordType || '').trim();
  const matched = fullConfig.procedureItems.find(p => p.code === code || code.includes(p.code))
    || fullConfig.procedureItems.find(p => p.module === 'dangky')
    || fullConfig.procedureItems[0];
  return matched || {
    id: 'default',
    code: '3.1.1',
    name: 'Thủ tục chung',
    steps: []
  };
};

export const loadProceduresConfig = (): ProcedureItemConfig[] => {
  const fullConfig = loadRegistrationSlaFullConfig();
  return fullConfig.procedureItems || [];
};

export const saveProceduresConfig = (_c: any) => {};
export const resetProceduresToDefault = () => [];
export const loadWorkingHoursConfig = () => ({});
export const saveWorkingHoursConfig = (_h: any) => {};
export const DEFAULT_PROCEDURES = [];
export const formatDurationShort = (m: number) => `${m || 0}h`;
export const formatMinutesToVietnamese = (m: number) => `${m || 0} phút`;
export const calculateRecordStepSla = (_r: any, _s?: any, _p?: any) => ({
  elapsedHours: 0,
  remainingHours: 8,
  status: 'ontime',
  isOverdue: false,
  percent: 0,
  overdueHours: 0
});

export interface WorkflowStep {
  key: RecordStatus | string;
  label: string;
  shortLabel: string;
  description: string;
  dateField?: keyof RecordFile;
  badgeColor: string;
  durationHours: number;
  durationDays: number;
  durationLabel: string;
  isTaxPhase?: boolean;
  isPostingPhase?: boolean;
}

export interface RegistrationWorkflowConfig {
  category: RegistrationWorkflowCategory | string;
  title: string;
  subtitle: string;
  standardDays: number;
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
  const matchedItem = fullConfig.procedureItems.find(p => p.module === 'dangky' && (p.code === code || code.includes(p.code)))
    || fullConfig.procedureItems.find(p => p.module === 'dangky')
    || fullConfig.procedureItems[0];

  const totalDays = matchedItem.steps.reduce((sum, s) => sum + (s.durationDays || 0), 0);

  const steps: WorkflowStep[] = matchedItem.steps.map(s => ({
    key: s.name,
    label: s.name,
    shortLabel: s.name,
    description: s.description || `Bước ${s.stepNumber}: ${s.name}`,
    badgeColor: 'bg-blue-100 text-blue-800',
    durationHours: s.durationHours,
    durationDays: s.durationDays || 1,
    durationLabel: `${s.durationDays} ngày`,
    isTaxPhase: s.name.toLowerCase().includes('thue') || s.name.includes('Thuế'),
    isPostingPhase: s.name.toLowerCase().includes('niem yet') || s.name.includes('Niêm Yết') || s.name.includes('Niêm yết'),
  }));

  return {
    category: matchedItem.id,
    title: matchedItem.name,
    subtitle: `Mã thủ tục: ${matchedItem.code} (${matchedItem.steps.length} bước)`,
    standardDays: totalDays,
    steps,
  };
};

export const getWorkflowStepIndex = (
  currentStatusOrStepKey: RecordStatus | string,
  stepsOrProcedureCode?: WorkflowStep[] | string
): number => {
  if (!currentStatusOrStepKey) return -1;
  if (Array.isArray(stepsOrProcedureCode)) {
    const steps = stepsOrProcedureCode;
    return steps.findIndex(s => s.key === currentStatusOrStepKey || s.label === currentStatusOrStepKey);
  } else {
    const procedureCode = stepsOrProcedureCode;
    const workflow = getRegistrationWorkflow(procedureCode || '');
    return workflow.steps.findIndex(s => s.key === currentStatusOrStepKey || s.label === currentStatusOrStepKey);
  }
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
  const standardDays = workflow.standardDays || 10;
  const calculatedDeadline = addWorkingDays(receivedDate, Math.ceil(standardDays), holidays);

  return {
    deadline: record.deadline || calculatedDeadline,
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

export const getRecordSlaBadge = (record: any) => {
  const isOverdue = record?.isOverdue || false;
  const isApproaching = record?.isApproaching || false;
  const isPaused = record?.status === 'PENDING_SUPPLEMENT' || record?.status === 'WITHDRAWN';
  let label = '';
  let badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';

  if (isOverdue) {
    label = 'Quá hạn';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (isApproaching) {
    label = 'Sắp đến hạn';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (isPaused) {
    label = 'Tạm dừng';
    badgeClass = 'bg-slate-50 text-slate-600 border-slate-200';
  }

  return {
    isApproaching,
    isOverdue,
    isPaused,
    label,
    badgeClass
  };
};

export const getStepSlaInfo = (
  record: Partial<RecordFile>,
  stepKey?: RecordStatus
): StepSlaInfo | null => {
  const workflow = getRegistrationWorkflow(record.recordType || (record as any).procedureCode || '');
  if (!workflow || workflow.steps.length === 0) return null;

  const currentStepName = stepKey || record.status || workflow.steps[0].label;
  const currentStep = workflow.steps.find(s => s.key === currentStepName || s.label === currentStepName) || workflow.steps[0];

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

export const resolveWorkflowStepDetails = (stepKey: string, procedureCode?: string) => {
    const workflow = getRegistrationWorkflow(procedureCode || '');
    const step = workflow.steps.find(s => s.key === stepKey || s.label === stepKey) || workflow.steps[0];
    return step;
};


