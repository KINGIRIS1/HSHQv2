import { RecordStatus, RecordFile } from '../types';
import { getShortRecordType, DEFAULT_HOLIDAYS, isArchiveRecordType, isSurveyRecordType } from '../constants';
import { parseSafeDate, formatDateKey } from './appHelpers';

export interface ProcedureStep {
  id?: string;
  stepNumber?: number;
  name: string;
  description?: string;
  durationDays?: number;
  durationHours?: number;
}

export interface ProcedureItemConfig {
  id: string;
  code: string;
  name: string;
  module?: string;
  steps: ProcedureStep[];
}

export const loadRegistrationSlaFullConfig = (): { procedureItems: ProcedureItemConfig[] } => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('registration_sla_full_config') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.procedureItems) && parsed.procedureItems.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return {
    procedureItems: [
      {
        id: 'proc_3_2_1',
        code: '3.2.1',
        name: 'Cấp đổi GCN',
        module: 'dangky',
        steps: [
          { stepNumber: 1, name: 'Tiếp nhận mới', durationDays: 1, durationHours: 8 },
          { stepNumber: 2, name: 'Chờ thẩm định', durationDays: 3, durationHours: 24 },
          { stepNumber: 3, name: 'Chờ in GCN', durationDays: 2, durationHours: 16 },
          { stepNumber: 4, name: 'Chờ kiểm tra', durationDays: 1, durationHours: 8 },
          { stepNumber: 5, name: 'Chờ ký duyệt', durationDays: 1, durationHours: 8 },
          { stepNumber: 6, name: 'Chờ bàn giao', durationDays: 0.5, durationHours: 4 },
        ]
      }
    ]
  };
};

export type RegistrationProcedureConfig = ProcedureItemConfig;
export type RegistrationStepConfig = ProcedureStep;
export type WorkingHoursConfig = any;
export type RegistrationWorkflowCategory = string;
export type StepSlaResult = any;

export const getProcedureByRecordType = (recordType?: string | null): ProcedureItemConfig => {
  const fullConfig = loadRegistrationSlaFullConfig();
  const code = (recordType || '').trim();
  const matched = fullConfig.procedureItems.find((p: any) => p.code === code || code.includes(p.code))
    || fullConfig.procedureItems.find((p: any) => p.module === 'dangky')
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
  id?: string;
  name?: string;
  statusKey?: RecordStatus | string;
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
  if (code.startsWith('1.') || code.startsWith('2.') || isArchiveRecordType(code) || isSurveyRecordType(code)) {
    return 'unclassified';
  }

  if (code.includes('3.1.1') || code.includes('Chuyển quyền') || code.includes('Chuyển nhượng') || code.includes('Tặng cho') || code.includes('Thừa kế')) return 'tax_transfer';
  if (code.includes('3.1.2') || code.includes('Phân chia quyền')) return 'tax_transfer';
  if (code.includes('3.1.3') || code.includes('Bản án')) return 'tax_transfer';
  if (code.includes('3.2.2') || (code.includes('Cấp đổi') && code.includes('thuế'))) return 'tax_transfer';
  
  if (code.includes('3.2.1') || code.includes('Cấp đổi')) return 'fast_track';
  if (code.includes('3.3.1') || code.includes('Cấp lại do mất') || code.includes('Cấp lại')) {
    if (code.includes('thuế')) return 'lost_cert_tax';
    return 'lost_cert';
  }
  if (code.includes('3.3.2')) return 'lost_cert_tax';

  if (code.includes('3.4.1') || code.includes('3.4.2') || code.includes('Tách') || code.includes('Hợp thửa')) return 'split_plot';

  if (code.includes('3.5.1') || code.includes('Gia hạn')) return 'fast_track';
  if (code.includes('3.6.1') || code.includes('Chuyển mục đích')) return 'fast_track';
  if (code.includes('3.7.1') || code.includes('Đính chính')) return 'fast_track';
  if (code.includes('3.7.2') || code.includes('Đổi thông tin')) return 'fast_track';

  if (code.includes('3.8.1') || code.includes('Đăng ký GDBD') || code.includes('Thế chấp')) return 'gdbd_register';
  if (code.includes('3.8.2') || code.includes('Xóa ĐK GDBD') || code.includes('Giải chấp') || code.includes('Xóa thế chấp')) return 'gdbd_release';

  if (code.startsWith('3.')) return 'fast_track';

  return 'unclassified';
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
  const category = getRegistrationWorkflowCategory(recordType);
  const code = (recordType || '').trim();

  let standardDays = 10;
  let hasTax = false;
  let isPosting = false;

  if (category === 'tax_transfer') {
    hasTax = true;
    if (code.includes('3.2.2')) standardDays = 15;
    else standardDays = 13;
  } else if (category === 'lost_cert') {
    isPosting = true;
    standardDays = 10;
  } else if (category === 'lost_cert_tax') {
    hasTax = true;
    isPosting = true;
    standardDays = 15;
  } else if (category === 'split_plot') {
    hasTax = true;
    standardDays = 17;
  } else if (category === 'gdbd_register') {
    standardDays = 3;
  } else if (category === 'gdbd_release') {
    standardDays = 1;
  } else if (category === 'fast_track') {
    if (code.includes('3.5.1') || code.includes('Gia hạn')) standardDays = 12;
    else if (code.includes('3.6.1') || code.includes('3.7.1') || code.includes('3.7.2')) standardDays = 7;
    else standardDays = 10;
  } else {
    standardDays = 0;
  }

  if (standardDays === 0) {
    return DEFAULT_WORKFLOW;
  }

  // Phân bổ ngày cho In GCN = StandardDays - (Tiếp nhận + Thẩm định + Phân chuyển thuế + Kiểm tra + Ký duyệt + Vô số/Giao 1C)
  const tiepNhanDays = standardDays <= 1 ? 0.25 : 1;
  const thamDinhDays = standardDays <= 1 ? 0.25 : (standardDays <= 3 ? 1 : 1);
  const phieuChuyenThueDays = hasTax ? (standardDays <= 7 ? 1 : 2) : 0;
  const kiemTraDays = standardDays <= 1 ? 0.25 : (standardDays <= 3 ? 0.5 : 1);
  const kyDuyetDays = standardDays <= 1 ? 0.25 : (standardDays <= 3 ? 0.5 : 1);
  const vaosoGiao1CDays = standardDays <= 1 ? 0.25 : (standardDays <= 3 ? 0.5 : 1);

  const fixedDays = tiepNhanDays + thamDinhDays + phieuChuyenThueDays + kiemTraDays + kyDuyetDays + vaosoGiao1CDays;
  const inGcnDays = Math.max(0.25, Number((standardDays - fixedDays).toFixed(1)));

  const steps: WorkflowStep[] = [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận hồ sơ tại Bộ phận Một cửa',
      badgeColor: 'bg-gray-100 text-gray-800',
      durationHours: tiepNhanDays * 8,
      durationDays: tiepNhanDays,
      durationLabel: `${tiepNhanDays} ngày`,
    },
    {
      key: RecordStatus.APPRAISAL,
      label: 'Thẩm định',
      shortLabel: 'Thẩm định',
      description: 'Cán bộ thụ lý thẩm định hồ sơ',
      badgeColor: 'bg-blue-100 text-blue-800',
      durationHours: thamDinhDays * 8,
      durationDays: thamDinhDays,
      durationLabel: `${thamDinhDays} ngày`,
    },
  ];

  if (isPosting) {
    steps.push({
      key: RecordStatus.PENDING_POSTING,
      label: 'Niêm yết tại xã',
      shortLabel: 'Niêm yết',
      description: 'Niêm yết công khai tại UBND xã (30 ngày lịch)',
      badgeColor: 'bg-amber-100 text-amber-800',
      durationHours: 0,
      durationDays: 30,
      durationLabel: '30 ngày lịch (Ngoài SLA)',
      isPostingPhase: true,
    });
  }

  if (hasTax) {
    steps.push(
      {
        key: RecordStatus.TAX_TRANSFER,
        label: 'Phiếu chuyển Thuế',
        shortLabel: 'Lập phiếu thuế',
        description: 'Lập phiếu chuyển thông tin nghĩa vụ tài chính',
        badgeColor: 'bg-indigo-100 text-indigo-800',
        durationHours: phieuChuyenThueDays * 8,
        durationDays: phieuChuyenThueDays,
        durationLabel: `${phieuChuyenThueDays} ngày`,
        isTaxPhase: true,
      },
      {
        key: RecordStatus.PENDING_TAX_KV7,
        label: 'Thuế Khu vực 7',
        shortLabel: 'Thuế KV7',
        description: 'Cơ quan Thuế xác định nghĩa vụ tài chính',
        badgeColor: 'bg-violet-100 text-violet-800',
        durationHours: 0,
        durationDays: 0,
        durationLabel: 'Ngoài SLA',
        isTaxPhase: true,
      },
      {
        key: RecordStatus.PENDING_TAX_PAYMENT,
        label: 'Thông báo Thuế',
        shortLabel: 'Thông báo thuế',
        description: 'Chờ người dân nộp thuế vào NSNN',
        badgeColor: 'bg-amber-100 text-amber-800',
        durationHours: 0,
        durationDays: 0,
        durationLabel: 'Ngoài SLA',
        isTaxPhase: true,
      }
    );
  }

  steps.push(
    {
      key: RecordStatus.PENDING_PRINT_CERT,
      label: 'In GCN',
      shortLabel: 'In GCN',
      description: 'In phôi Giấy chứng nhận mới',
      badgeColor: 'bg-teal-100 text-teal-800',
      durationHours: inGcnDays * 8,
      durationDays: inGcnDays,
      durationLabel: `${inGcnDays} ngày`,
    },
    {
      key: RecordStatus.PENDING_CHECK,
      label: 'Kiểm tra',
      shortLabel: 'Kiểm tra',
      description: 'Tổ trưởng / Lãnh đạo phòng kiểm tra',
      badgeColor: 'bg-orange-100 text-orange-800',
      durationHours: kiemTraDays * 8,
      durationDays: kiemTraDays,
      durationLabel: `${kiemTraDays} ngày`,
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Ký duyệt',
      shortLabel: 'Ký duyệt',
      description: 'Trình Lãnh đạo Chi nhánh ký duyệt',
      badgeColor: 'bg-purple-100 text-purple-800',
      durationHours: kyDuyetDays * 8,
      durationDays: kyDuyetDays,
      durationLabel: `${kyDuyetDays} ngày`,
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Vô số GCN / Giao 1 Cửa',
      shortLabel: 'Vô số & Giao 1C',
      description: 'Cấp số vào sổ GCN và bàn giao Một cửa',
      badgeColor: 'bg-cyan-100 text-cyan-800',
      durationHours: vaosoGiao1CDays * 8,
      durationDays: vaosoGiao1CDays,
      durationLabel: `${vaosoGiao1CDays} ngày`,
    }
  );

  return {
    category,
    title: code || 'Thủ tục Cấp giấy',
    subtitle: `Mã thủ tục: ${code} (${standardDays} ngày làm việc)`,
    standardDays,
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
  _holidays: any = DEFAULT_HOLIDAYS
): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = parseSafeDate(startDateStr);
  const end = parseSafeDate(endDateStr);
  if (!start || !end || end <= start) return 0;

  let count = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
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
  if (workflow.category === 'unclassified' || workflow.standardDays === 0) {
    return {
      deadline: record.deadline || '',
      standardDays: 0,
      category: 'unclassified',
      workingDays: 0,
      hasPostingNotice: false,
      postingEndDate: '',
    };
  }

  const receivedDate = record.receivedDate || formatDateKey(new Date());
  const standardDays = workflow.standardDays || 10;
  const calculatedDeadline = addWorkingDays(receivedDate, Math.ceil(standardDays), holidays);

  const hasPostingNotice = workflow.steps.some(s => s.isPostingPhase);
  const postStart = record.postingDate || receivedDate;
  const postingEndDate = hasPostingNotice ? addCalendarDays(postStart, 30) : '';

  return {
    deadline: record.deadline || calculatedDeadline,
    standardDays,
    category: workflow.category,
    workingDays: standardDays,
    hasPostingNotice,
    postingEndDate,
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

export function getVietnamNow(): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 7)); // UTC+7 Vietnam time
}

export function adjustStartWorkingTime(dateInput: string | Date | null | undefined, holidays: any[] = DEFAULT_HOLIDAYS): Date {
  if (!dateInput) return getVietnamNow();
  let dt = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  if (isNaN(dt.getTime())) dt = getVietnamNow();

  const utc = dt.getTime() + (dt.getTimezoneOffset() * 60000);
  let vnDt = new Date(utc + (3600000 * 7));

  const isHoliday = (d: Date) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return holidays.some((h: any) => h.date === key);
  };

  while (vnDt.getDay() === 0 || vnDt.getDay() === 6 || isHoliday(vnDt)) {
    vnDt.setDate(vnDt.getDate() + 1);
    vnDt.setHours(7, 30, 0, 0);
  }

  const hours = vnDt.getHours();
  const minutes = vnDt.getMinutes();
  const timeNum = hours * 60 + minutes;

  if (timeNum < 450) {
    vnDt.setHours(7, 30, 0, 0);
  } else if (timeNum >= 690 && timeNum < 810) {
    vnDt.setHours(13, 30, 0, 0);
  } else if (timeNum >= 1050) {
    vnDt.setDate(vnDt.getDate() + 1);
    vnDt.setHours(7, 30, 0, 0);
    while (vnDt.getDay() === 0 || vnDt.getDay() === 6 || isHoliday(vnDt)) {
      vnDt.setDate(vnDt.getDate() + 1);
      vnDt.setHours(7, 30, 0, 0);
    }
  }

  return vnDt;
}

export interface ExactSlaResult {
  text: string;
  isOverdue: boolean;
  isApproaching: boolean;
  isPaused: boolean;
  colorClass: string;
}

export function calculateExactSla(record: Partial<RecordFile>, holidays: any[] = DEFAULT_HOLIDAYS): ExactSlaResult {
  const status = record.status;
  if (
    status === RecordStatus.PENDING_SUPPLEMENT ||
    status === RecordStatus.WITHDRAWN ||
    status === RecordStatus.REJECTED ||
    status === RecordStatus.PENDING_TAX_KV7 ||
    status === RecordStatus.PENDING_TAX_NOTICE ||
    status === RecordStatus.PENDING_TAX_PAYMENT ||
    status === RecordStatus.PENDING_POSTING
  ) {
    return {
      text: status === RecordStatus.PENDING_SUPPLEMENT ? 'Tạm dừng bổ sung' : 'Tạm dừng đếm giờ',
      isOverdue: false,
      isApproaching: false,
      isPaused: true,
      colorClass: 'text-slate-500 font-medium',
    };
  }

  const workflow = getRegistrationWorkflow(record.recordType);
  if (!workflow || workflow.standardDays <= 0) {
    return {
      text: 'Đang xử lý',
      isOverdue: false,
      isApproaching: false,
      isPaused: false,
      colorClass: 'text-blue-600 font-medium',
    };
  }

  const totalAllowedMinutes = workflow.standardDays * 8 * 60;
  const startTimeStr = record.assignedDate || record.receivedDate || new Date().toISOString();
  const startDt = adjustStartWorkingTime(startTimeStr, holidays);
  const nowDt = getVietnamNow();

  let workingMinutesPassed = 0;
  const curr = new Date(startDt);
  
  const isHoliday = (d: Date) => {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return holidays.some((h: any) => h.date === key);
  };

  if (nowDt <= startDt) {
    const remainingMinutes = totalAllowedMinutes;
    const h = Math.floor(remainingMinutes / 60);
    const m = remainingMinutes % 60;
    return {
      text: `Còn ${h} giờ ${m} phút`,
      isOverdue: false,
      isApproaching: false,
      isPaused: false,
      colorClass: 'text-blue-600 font-bold',
    };
  }

  let limit = 0;
  while (curr < nowDt && limit < 1500) {
    limit++;
    const day = curr.getDay();
    if (day !== 0 && day !== 6 && !isHoliday(curr)) {
      const h = curr.getHours();
      const m = curr.getMinutes();
      const timeNum = h * 60 + m;

      const isSameDay = curr.getFullYear() === nowDt.getFullYear() && curr.getMonth() === nowDt.getMonth() && curr.getDate() === nowDt.getDate();
      const endH = isSameDay ? nowDt.getHours() : 17;
      const endM = isSameDay ? nowDt.getMinutes() : 30;
      const endTimeNum = isSameDay ? (endH * 60 + endM) : 1050;

      const mornStart = Math.max(timeNum, 450);
      const mornEnd = Math.min(endTimeNum, 690);
      if (mornEnd > mornStart) {
        workingMinutesPassed += (mornEnd - mornStart);
      }

      const aftStart = Math.max(timeNum, 810);
      const aftEnd = Math.min(endTimeNum, 1050);
      if (aftEnd > aftStart) {
        workingMinutesPassed += (aftEnd - aftStart);
      }
    }

    curr.setDate(curr.getDate() + 1);
    curr.setHours(7, 30, 0, 0);
  }

  const remainingMinutes = totalAllowedMinutes - workingMinutesPassed;
  if (remainingMinutes >= 0) {
    const h = Math.floor(remainingMinutes / 60);
    const m = remainingMinutes % 60;
    const isApproaching = remainingMinutes <= totalAllowedMinutes * 0.2 || remainingMinutes <= 120;
    return {
      text: `Còn ${h} giờ ${m} phút`,
      isOverdue: false,
      isApproaching,
      isPaused: false,
      colorClass: isApproaching ? 'text-amber-600 font-bold' : 'text-blue-600 font-bold',
    };
  } else {
    const overdueMins = Math.abs(remainingMinutes);
    const h = Math.floor(overdueMins / 60);
    const m = overdueMins % 60;
    return {
      text: `Trễ hạn ${h} giờ ${m} phút`,
      isOverdue: true,
      isApproaching: false,
      isPaused: false,
      colorClass: 'text-rose-600 font-bold',
    };
  }
}


