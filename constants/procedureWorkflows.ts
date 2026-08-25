import { DangKyRecord, DangKyStatusType } from '../types';
import { PROCEDURE_CATALOG, detectProcedureId, getProcedureById } from './procedures';

export interface WorkflowStep {
  id: string;                      // Unique ID for step item (e.g. 'tiep_nhan', 'tham_dinh', 'step_123')
  code: string;                    // Standard step key: 'tiep_nhan' | 'tham_dinh' | 'phieu_chuyen_thue' | 'thue_kv7' | 'thong_bao_thue' | 'in_gcn' | 'trinh_kiem_tra' | 'trinh_ky' | 'hoan_thanh' | 'tra_ket_qua' | 'custom'
  name: string;                    // Display step name (e.g. 'TIẾP NHẬN MỚI', 'THẨM ĐỊNH HỒ SƠ')
  slaLabel: string;                // Display SLA string (e.g. '4 giờ', '2 ngày', '1 ngày')
  slaHours: number;                // Numeric SLA hours (e.g. 4, 16, 8, 40)
  isExcludedFromTotalSla: boolean; // Nếu chọn sẽ không tính vào tổng quy trình giải quyết (Dừng SLA / Thời gian ngoài)
  dateField?: keyof DangKyRecord | string;
  staffField?: keyof DangKyRecord | string;
  statusMatch?: DangKyStatusType | string;
  iconType?: string;
  colorScheme?: 'emerald' | 'blue' | 'orange' | 'amber' | 'yellow' | 'purple' | 'indigo' | 'green' | 'red' | 'gray';
  description?: string;
}

export interface StandardStepTemplate {
  code: string;
  defaultName: string;
  defaultSlaLabel: string;
  defaultSlaHours: number;
  isExcludedFromTotalSla: boolean;
  dateField: keyof DangKyRecord;
  staffField: keyof DangKyRecord;
  statusMatch: DangKyStatusType;
  colorScheme: 'emerald' | 'blue' | 'orange' | 'amber' | 'yellow' | 'purple' | 'indigo' | 'green' | 'red' | 'gray';
  description: string;
}

/**
 * Working hours configuration:
 * Ca Sáng: 07:30 - 11:30 (4h)
 * Ca Chiều: 13:30 - 17:30 (4h)
 * Chuẩn: 8 giờ làm việc / ngày
 */
export const WORKING_HOURS_PER_DAY = 8;
export const WORKING_TIME_CONFIG = {
  morning: { start: '07:30', end: '11:30', hours: 4 },
  afternoon: { start: '13:30', end: '17:30', hours: 4 },
  totalHoursPerDay: 8
};

/**
 * Format numeric hours into friendly Vietnamese SLA string based on 8h/day
 */
export const formatHoursToSlaLabel = (hours: number): string => {
  if (hours <= 0) return '0 giờ';
  
  if (hours % WORKING_HOURS_PER_DAY === 0) {
    const days = hours / WORKING_HOURS_PER_DAY;
    return `${days} ngày`;
  }
  
  if (hours % 4 === 0) {
    const days = hours / WORKING_HOURS_PER_DAY;
    if (days === 0.5) return '4 giờ';
    return `${days} ngày`;
  }
  
  if (hours < WORKING_HOURS_PER_DAY) {
    return `${hours} giờ`;
  }

  const days = Math.floor(hours / WORKING_HOURS_PER_DAY);
  const remainingHours = hours % WORKING_HOURS_PER_DAY;
  if (remainingHours === 0) return `${days} ngày`;
  return `${days} ngày ${remainingHours}h`;
};

/**
 * Parse string SLA label into numeric hours (8h = 1 working day)
 */
export const parseSlaLabelToHours = (label: string): number | null => {
  if (!label || !label.trim()) return null;
  const clean = label.toLowerCase().trim().replace(/,/g, '.');
  
  let totalHours = 0;
  let matched = false;

  // Check for fractional days: e.g. "1/2 ngày", "1/2 ngay"
  if (clean.includes('1/2') && (clean.includes('ngày') || clean.includes('ngay'))) {
    totalHours += 4;
    matched = true;
  }

  // Check for days: e.g. "2.5 ngày", "2 ngày", "1ngay", "3 d", "3 days"
  const dayMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:ngày|ngay|d|day|days)/);
  if (dayMatch) {
    totalHours += parseFloat(dayMatch[1]) * WORKING_HOURS_PER_DAY;
    matched = true;
  }

  // Check for hours: e.g. "4 giờ", "4h", "12 gio", "6 tiếng", "6 tieng"
  const hourMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:giờ|gio|h|tiếng|tieng|hour|hours)/);
  if (hourMatch) {
    totalHours += parseFloat(hourMatch[1]);
    matched = true;
  }

  if (matched) {
    return Math.round(totalHours * 10) / 10;
  }

  // If user just entered a raw number
  const numOnly = parseFloat(clean);
  if (!isNaN(numOnly)) {
    return numOnly;
  }

  return null;
};

export const STANDARD_AVAILABLE_STEPS: StandardStepTemplate[] = [
  {
    code: 'tiep_nhan',
    defaultName: 'TIẾP NHẬN MỚI',
    defaultSlaLabel: '4 giờ',
    defaultSlaHours: 4,
    isExcludedFromTotalSla: false,
    dateField: 'receivedDate',
    staffField: 'receivedBy',
    statusMatch: 'Tiếp nhận mới',
    colorScheme: 'emerald',
    description: 'Tiếp nhận hồ sơ đầu vào tại Một cửa / Bộ phận Đăng ký'
  },
  {
    code: 'tham_dinh',
    defaultName: 'THẨM ĐỊNH HỒ SƠ',
    defaultSlaLabel: '2 ngày',
    defaultSlaHours: 16,
    isExcludedFromTotalSla: false,
    dateField: 'appraisalDate',
    staffField: 'appraisalStaff',
    statusMatch: 'Thẩm định',
    colorScheme: 'blue',
    description: 'Phân công cán bộ thẩm định, kiểm tra pháp lý thửa đất'
  },
  {
    code: 'phieu_chuyen_thue',
    defaultName: 'PHIẾU CHUYỂN THUẾ',
    defaultSlaLabel: '1 ngày',
    defaultSlaHours: 8,
    isExcludedFromTotalSla: false,
    dateField: 'taxFormDate',
    staffField: 'taxFormStaff',
    statusMatch: 'Phiếu chuyển thuế',
    colorScheme: 'orange',
    description: 'Lập phiếu chuyển thông tin địa chính sang cơ quan thuế'
  },
  {
    code: 'thue_kv7',
    defaultName: 'THUẾ KV7',
    defaultSlaLabel: '1 ngày',
    defaultSlaHours: 8,
    isExcludedFromTotalSla: false,
    dateField: 'taxKV7TransferDate',
    staffField: 'taxKV7Staff',
    statusMatch: 'Chờ Thuế KV7',
    colorScheme: 'amber',
    description: 'Chuyển hồ sơ nghĩa vụ tài chính khu vực 7'
  },
  {
    code: 'thong_bao_thue',
    defaultName: 'THÔNG BÁO THUẾ',
    defaultSlaLabel: '5 ngày',
    defaultSlaHours: 40,
    isExcludedFromTotalSla: true, // Mặc định không tính vào tổng SLA cơ quan (chờ công dân / cơ quan thuế)
    dateField: 'taxNoticeDate',
    staffField: 'taxNoticeStaff',
    statusMatch: 'Chờ giấy nộp tiền',
    colorScheme: 'yellow',
    description: 'Chờ cơ quan thuế ra thông báo và công dân thực hiện nghĩa vụ tài chính'
  },
  {
    code: 'in_gcn',
    defaultName: 'IN GIẤY CHỨNG NHẬN',
    defaultSlaLabel: '1 ngày',
    defaultSlaHours: 8,
    isExcludedFromTotalSla: false,
    dateField: 'printDate',
    staffField: 'printStaff',
    statusMatch: 'Chờ In GCN',
    colorScheme: 'purple',
    description: 'In phôi Giấy chứng nhận hoặc in trang bổ sung'
  },
  {
    code: 'trinh_kiem_tra',
    defaultName: 'TRÌNH KIỂM TRA',
    defaultSlaLabel: '1 ngày',
    defaultSlaHours: 8,
    isExcludedFromTotalSla: false,
    dateField: 'pendingCheckDate',
    staffField: 'checkedBy',
    statusMatch: 'Chờ kiểm tra',
    colorScheme: 'amber',
    description: 'Cán bộ kiểm tra / Tổ trưởng kiểm soát hồ sơ'
  },
  {
    code: 'trinh_ky',
    defaultName: 'TRÌNH KÝ DUYỆT',
    defaultSlaLabel: '1 ngày',
    defaultSlaHours: 8,
    isExcludedFromTotalSla: false,
    dateField: 'submissionDate',
    staffField: 'submittedTo',
    statusMatch: 'Chờ ký duyệt',
    colorScheme: 'indigo',
    description: 'Lãnh đạo Chi nhánh ký duyệt hồ sơ và Giấy chứng nhận'
  },
  {
    code: 'hoan_thanh',
    defaultName: 'HOÀN THÀNH / BÀN GIAO',
    defaultSlaLabel: '4 giờ',
    defaultSlaHours: 4,
    isExcludedFromTotalSla: false,
    dateField: 'completedDate',
    staffField: 'exportBatch',
    statusMatch: 'Chờ bàn giao',
    colorScheme: 'green',
    description: 'Đóng gói, vào sổ cấp GCN và chốt đợt bàn giao Một cửa'
  },
  {
    code: 'tra_ket_qua',
    defaultName: 'TRẢ KẾT QUẢ CHO DÂN',
    defaultSlaLabel: '4 giờ',
    defaultSlaHours: 4,
    isExcludedFromTotalSla: false,
    dateField: 'resultReturnedDate',
    staffField: 'receiverName',
    statusMatch: 'Đã trả kết quả',
    colorScheme: 'emerald',
    description: 'Một cửa bàn giao Giấy chứng nhận cho người sử dụng đất'
  }
];

export const createDefaultStepsFromCodes = (codes: string[], customSlaMap?: Record<string, { label?: string; hours?: number; excluded?: boolean }>): WorkflowStep[] => {
  return codes.map(code => {
    const template = STANDARD_AVAILABLE_STEPS.find(s => s.code === code) || {
      code,
      defaultName: code.toUpperCase(),
      defaultSlaLabel: '1 ngày',
      defaultSlaHours: 8,
      isExcludedFromTotalSla: false,
      dateField: 'receivedDate' as keyof DangKyRecord,
      staffField: 'receivedBy' as keyof DangKyRecord,
      statusMatch: 'Tiếp nhận mới' as DangKyStatusType,
      colorScheme: 'blue' as const,
      description: ''
    };

    const override = customSlaMap?.[code];

    return {
      id: `step_${code}_${Math.random().toString(36).substring(2, 7)}`,
      code: template.code,
      name: template.defaultName,
      slaLabel: override?.label || template.defaultSlaLabel,
      slaHours: override?.hours !== undefined ? override.hours : template.defaultSlaHours,
      isExcludedFromTotalSla: override?.excluded !== undefined ? override.excluded : template.isExcludedFromTotalSla,
      dateField: template.dateField,
      staffField: template.staffField,
      statusMatch: template.statusMatch,
      colorScheme: template.colorScheme,
      description: template.description
    };
  });
};

/**
 * Build initial default workflow according to procedure category
 */
export const getDefaultWorkflowForProcedure = (procedureId: string): WorkflowStep[] => {
  // 1. Nhóm ĐKBĐ có thuế đầy đủ (3.1.1, 3.1.2, 3.1.3, 3.2.2, 3.3.2, 3.4.2)
  if (['3.1.1', '3.1.2', '3.1.3', '3.2.2', '3.3.2', '3.4.2'].includes(procedureId)) {
    return createDefaultStepsFromCodes([
      'tiep_nhan',
      'tham_dinh',
      'phieu_chuyen_thue',
      'thue_kv7',
      'thong_bao_thue',
      'in_gcn',
      'trinh_kiem_tra',
      'trinh_ky',
      'hoan_thanh',
      'tra_ket_qua'
    ], {
      thong_bao_thue: { label: '5 ngày', hours: 40, excluded: true }
    });
  }

  // 2. Nhóm Tách - Hợp thửa không đổi người SDĐ (3.4.1) & Đo đạc cấp đổi không thuế (3.2.1, 3.3.1)
  // Quy trình: Tiếp nhận -> Thẩm định -> In GCN -> Kiểm tra -> Trình ký -> Hoàn thành -> Trả KQ (Không có bước Thuế)
  if (['3.4.1', '3.2.1', '3.3.1'].includes(procedureId)) {
    return createDefaultStepsFromCodes([
      'tiep_nhan',
      'tham_dinh',
      'in_gcn',
      'trinh_kiem_tra',
      'trinh_ky',
      'hoan_thanh',
      'tra_ket_qua'
    ], {
      tham_dinh: { label: '3 ngày', hours: 24, excluded: false },
      in_gcn: { label: '2 ngày', hours: 16, excluded: false }
    });
  }

  // 3. Nhóm Thế chấp & Xóa thế chấp (3.8.1, 3.8.2)
  // Thời gian xử lý siêu nhanh (1-3 ngày), không qua Thuế hay In GCN phôi mới
  if (['3.8.1', '3.8.2'].includes(procedureId)) {
    const isXoa = procedureId === '3.8.2';
    return createDefaultStepsFromCodes([
      'tiep_nhan',
      'tham_dinh',
      'trinh_kiem_tra',
      'trinh_ky',
      'hoan_thanh',
      'tra_ket_qua'
    ], {
      tiep_nhan: { label: isXoa ? '2 giờ' : '4 giờ', hours: isXoa ? 2 : 4, excluded: false },
      tham_dinh: { label: isXoa ? '2 giờ' : '8 giờ', hours: isXoa ? 2 : 8, excluded: false },
      trinh_kiem_tra: { label: isXoa ? '1 giờ' : '4 giờ', hours: isXoa ? 1 : 4, excluded: false },
      trinh_ky: { label: isXoa ? '1 giờ' : '4 giờ', hours: isXoa ? 1 : 4, excluded: false },
      hoan_thanh: { label: '1 giờ', hours: 1, excluded: false },
      tra_ket_qua: { label: '1 giờ', hours: 1, excluded: false }
    });
  }

  // 4. Nhóm Gia hạn (3.5.1), Chuyển mục đích (3.6.1), Đính chính (3.7.1, 3.7.2)
  if (['3.5.1', '3.6.1', '3.7.1', '3.7.2'].includes(procedureId)) {
    return createDefaultStepsFromCodes([
      'tiep_nhan',
      'tham_dinh',
      'in_gcn',
      'trinh_kiem_tra',
      'trinh_ky',
      'hoan_thanh',
      'tra_ket_qua'
    ], {
      in_gcn: { label: '1 ngày', hours: 8, excluded: false }
    });
  }

  // Mặc định chung cho các thủ tục Đăng ký khác
  return createDefaultStepsFromCodes([
    'tiep_nhan',
    'tham_dinh',
    'phieu_chuyen_thue',
    'thue_kv7',
    'thong_bao_thue',
    'in_gcn',
    'trinh_kiem_tra',
    'trinh_ky',
    'hoan_thanh',
    'tra_ket_qua'
  ]);
};

const STORAGE_KEY = 'registration_procedure_workflows_v2';

/**
 * Load all saved procedure workflows from LocalStorage
 */
export const getAllProcedureWorkflows = (): Record<string, WorkflowStep[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading procedure workflows from storage:', err);
  }
  return {};
};

/**
 * Get configured workflow for a specific procedure ID or record type / code
 */
export const getProcedureWorkflow = (procedureIdOrType?: string | null, recordCode?: string | null): WorkflowStep[] => {
  let procId = '3.1.1';
  if (procedureIdOrType) {
    const foundProc = getProcedureById(procedureIdOrType);
    if (foundProc) {
      procId = foundProc.id;
    } else {
      procId = detectProcedureId(recordCode, procedureIdOrType);
    }
  } else if (recordCode) {
    procId = detectProcedureId(recordCode, null);
  }

  const allSaved = getAllProcedureWorkflows();
  if (allSaved[procId] && Array.isArray(allSaved[procId]) && allSaved[procId].length > 0) {
    return allSaved[procId];
  }

  return getDefaultWorkflowForProcedure(procId);
};

/**
 * Save customized workflow for a specific procedure
 */
export const saveProcedureWorkflow = (procedureId: string, steps: WorkflowStep[]): void => {
  try {
    const allSaved = getAllProcedureWorkflows();
    allSaved[procedureId] = steps;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allSaved));

    // Dispatch global event for live update across all open components
    window.dispatchEvent(new CustomEvent('registration_workflow_changed', {
      detail: { procedureId, steps }
    }));
  } catch (err) {
    console.error('Error saving procedure workflow:', err);
  }
};

/**
 * Reset customized workflow back to system default for a procedure
 */
export const resetProcedureWorkflow = (procedureId: string): WorkflowStep[] => {
  try {
    const allSaved = getAllProcedureWorkflows();
    delete allSaved[procedureId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allSaved));

    const defaultSteps = getDefaultWorkflowForProcedure(procedureId);

    window.dispatchEvent(new CustomEvent('registration_workflow_changed', {
      detail: { procedureId, steps: defaultSteps }
    }));

    return defaultSteps;
  } catch (err) {
    console.error('Error resetting procedure workflow:', err);
    return getDefaultWorkflowForProcedure(procedureId);
  }
};

/**
 * Calculate total SLA summary for a list of steps
 */
export const calculateTotalSlaHours = (steps: WorkflowStep[]) => {
  let totalHours = 0;
  let excludedHours = 0;
  let includedCount = 0;
  let excludedCount = 0;

  steps.forEach(step => {
    const h = Number(step.slaHours) || 0;
    if (step.isExcludedFromTotalSla) {
      excludedHours += h;
      excludedCount++;
    } else {
      totalHours += h;
      includedCount++;
    }
  });

  const totalDays = Math.round((totalHours / 8) * 10) / 10;
  const excludedDays = Math.round((excludedHours / 8) * 10) / 10;

  return {
    totalHours,
    totalDays,
    excludedHours,
    excludedDays,
    includedCount,
    excludedCount,
    allStepsCount: steps.length
  };
};

/**
 * Helper to get DangKy module procedures list for the selector dropdown
 */
export const getRegistrationProceduresList = () => {
  return PROCEDURE_CATALOG.filter(p => p.module === 'dangky');
};

/**
 * Helper to get next status dynamically according to procedure workflow
 */
export const getNextStatusForDangKyRecord = (record: DangKyRecord): DangKyStatusType => {
  const currentStatus = record.status;
  
  // Handling special edge statuses
  if (currentStatus === 'Chờ bổ sung') return 'Thẩm định';
  if (currentStatus === 'CSD rút HS' || currentStatus === 'Trả hủy hồ sơ' || currentStatus === 'Đã trả kết quả') {
    return currentStatus;
  }

  const steps = getProcedureWorkflow(record.recordType, record.code);
  if (!steps || steps.length === 0) {
    return 'Thẩm định';
  }

  // Find index of current step in configured sequence
  const currentIndex = steps.findIndex(step => {
    if (step.statusMatch && step.statusMatch === currentStatus) return true;
    if (step.name && step.name.toLowerCase() === currentStatus.toLowerCase()) return true;
    return false;
  });

  if (currentIndex >= 0 && currentIndex < steps.length - 1) {
    const nextStep = steps[currentIndex + 1];
    return (nextStep.statusMatch as DangKyStatusType) || 'Thẩm định';
  }

  // If already at or past the last step
  if (currentIndex === steps.length - 1) {
    return (steps[currentIndex].statusMatch as DangKyStatusType) || currentStatus;
  }

  // Fallback if not matched: find first step after tiep_nhan
  return (steps[1]?.statusMatch as DangKyStatusType) || 'Thẩm định';
};

/**
 * Helper to check if a step code is active in a procedure
 */
export const isStepActiveInProcedure = (procedureIdOrType?: string, stepCode?: string): boolean => {
  if (!stepCode) return false;
  const steps = getProcedureWorkflow(procedureIdOrType);
  return steps.some(s => s.code === stepCode);
};

/**
 * Helper to get only valid workflow statuses for a procedure (+ common special statuses)
 */
export const getValidStatusesForDangKyRecord = (procedureIdOrType?: string, code?: string): DangKyStatusType[] => {
  const steps = getProcedureWorkflow(procedureIdOrType, code);
  const statusSet = new Set<DangKyStatusType>();

  steps.forEach(s => {
    if (s.statusMatch) {
      statusSet.add(s.statusMatch as DangKyStatusType);
    }
  });

  // Always include standard start and finish
  statusSet.add('Tiếp nhận mới');
  statusSet.add('Chờ bàn giao');
  statusSet.add('Đã giao 1 cửa');
  statusSet.add('Đã trả kết quả');

  // Special branch statuses
  statusSet.add('Chờ bổ sung');
  statusSet.add('CSD rút HS');
  statusSet.add('Trả hủy hồ sơ');

  // Preserve order according to standard DANG_KY_STATUS_LIST
  const ALL_ORDER: DangKyStatusType[] = [
    'Tiếp nhận mới',
    'Thẩm định',
    'Phiếu chuyển thuế',
    'Chờ Thuế KV7',
    'Chờ giấy nộp tiền',
    'Chờ In GCN',
    'Chờ kiểm tra',
    'Chờ ký duyệt',
    'Chờ bàn giao',
    'Đã giao 1 cửa',
    'Đã trả kết quả',
    'Chờ bổ sung',
    'CSD rút HS',
    'Trả hủy hồ sơ'
  ];

  return ALL_ORDER.filter(st => statusSet.has(st));
};

