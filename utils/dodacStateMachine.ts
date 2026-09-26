import { RecordStatus, RecordFile } from '../types';
import { loadRegistrationSlaFullConfig } from '../components/registration/RegistrationSlaStatusView';

/**
 * STATE MACHINE ĐỘC LẬP CHO MODULE ĐO ĐẠC
 * Quản lý quy trình đo đạc thực địa và biên tập bản đồ địa chính.
 */

export const DODAC_STATUSES = [
  RecordStatus.RECEIVED,             // Tiếp nhận mới
  RecordStatus.ASSIGNED,             // Đã phân công
  RecordStatus.IN_PROGRESS,          // Đang thực hiện (Cũ)
  RecordStatus.FIELD_WORK,           // Đo đạc thực địa
  RecordStatus.OFFICE_WORK,          // Biên tập bản đồ
  RecordStatus.COMPLETED_WORK,       // Hoàn thành đo đạc
  RecordStatus.PENDING_CHECK,        // Chờ kiểm tra
  RecordStatus.PENDING_SIGN,         // Chờ ký duyệt
  RecordStatus.SIGNED,               // Chờ bàn giao (Đã ký duyệt)
  RecordStatus.HANDOVER,             // Đã giao 1 cửa
  RecordStatus.RETURNED,             // Đã trả kết quả
  RecordStatus.PENDING_SUPPLEMENT,   // Chờ bổ sung
  RecordStatus.WITHDRAWN,            // CSD rút hồ sơ
  RecordStatus.REJECTED              // Trả hồ sơ
] as const;

export type DodacStatus = typeof DODAC_STATUSES[number];

export const DODAC_STATUS_LABELS: Partial<Record<RecordStatus, string>> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận mới',
  [RecordStatus.ASSIGNED]: 'Đã phân công',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.FIELD_WORK]: 'Đo đạc thực địa',
  [RecordStatus.OFFICE_WORK]: 'Biên tập bản đồ',
  [RecordStatus.COMPLETED_WORK]: 'Hoàn thành đo đạc',
  [RecordStatus.PENDING_CHECK]: 'Chờ kiểm tra',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký duyệt',
  [RecordStatus.SIGNED]: 'Chờ bàn giao',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.PENDING_SUPPLEMENT]: 'Chờ bổ sung',
  [RecordStatus.WITHDRAWN]: 'CSD rút hồ sơ',
  [RecordStatus.REJECTED]: 'Trả hồ sơ'
};

export const DODAC_MAIN_FLOW: DodacStatus[] = [
  RecordStatus.RECEIVED,
  RecordStatus.FIELD_WORK,
  RecordStatus.OFFICE_WORK,
  RecordStatus.COMPLETED_WORK,
  RecordStatus.PENDING_CHECK,
  RecordStatus.PENDING_SIGN,
  RecordStatus.SIGNED,
  RecordStatus.HANDOVER,
  RecordStatus.RETURNED
];

export function isDodacStatus(status: any): status is DodacStatus {
  return typeof status === 'string' && (DODAC_STATUSES as readonly string[]).includes(status);
}

export function getNextDodacStatus(currentStatus: RecordStatus | string): DodacStatus | null {
  if (currentStatus === RecordStatus.RECEIVED || currentStatus === RecordStatus.ASSIGNED) {
    return RecordStatus.FIELD_WORK;
  }
  if (currentStatus === RecordStatus.IN_PROGRESS) {
    return RecordStatus.OFFICE_WORK;
  }
  const idx = DODAC_MAIN_FLOW.indexOf(currentStatus as DodacStatus);
  if (idx >= 0 && idx < DODAC_MAIN_FLOW.length - 1) {
    return DODAC_MAIN_FLOW[idx + 1];
  }
  return null;
}

export function getPreviousDodacStatus(currentStatus: RecordStatus | string): DodacStatus | null {
  const idx = DODAC_MAIN_FLOW.indexOf(currentStatus as DodacStatus);
  if (idx > 0) {
    return DODAC_MAIN_FLOW[idx - 1];
  }
  return null;
}

export interface DodacTransitionValidation {
  valid: boolean;
  reason?: string;
  targetStatus?: DodacStatus;
}

export function validateDodacTransition(
  currentStatus: RecordStatus | string,
  targetStatus: RecordStatus | string,
  previousStatus?: RecordStatus | string | null
): DodacTransitionValidation {
  if (!isDodacStatus(targetStatus)) {
    return {
      valid: false,
      reason: `Trạng thái "${targetStatus}" không thuộc Module Đo đạc.`
    };
  }

  if (
    currentStatus === RecordStatus.RETURNED ||
    currentStatus === RecordStatus.WITHDRAWN ||
    currentStatus === RecordStatus.REJECTED
  ) {
    return {
      valid: false,
      reason: 'Hồ sơ đã kết thúc, không thể chuyển bước.'
    };
  }

  if (targetStatus === RecordStatus.WITHDRAWN || targetStatus === RecordStatus.REJECTED) {
    return { valid: true, targetStatus };
  }

  if (targetStatus === RecordStatus.PENDING_SUPPLEMENT) {
    return { valid: true, targetStatus };
  }

  if (currentStatus === RecordStatus.PENDING_SUPPLEMENT) {
    if (!previousStatus || !isDodacStatus(previousStatus)) {
      return {
        valid: false,
        reason: 'Không xác định được trạng thái trước khi bổ sung.'
      };
    }
    return { valid: true, targetStatus: previousStatus as DodacStatus };
  }

  return { valid: true, targetStatus };
}

export function getAllowedDodacTransitions(
  currentStatus: RecordStatus | string,
  previousStatus?: RecordStatus | string | null
): DodacStatus[] {
  if (
    currentStatus === RecordStatus.RETURNED ||
    currentStatus === RecordStatus.WITHDRAWN ||
    currentStatus === RecordStatus.REJECTED
  ) {
    return [];
  }

  if (currentStatus === RecordStatus.PENDING_SUPPLEMENT) {
    return previousStatus && isDodacStatus(previousStatus) ? [previousStatus as DodacStatus] : [];
  }

  const allowed: DodacStatus[] = [
    RecordStatus.FIELD_WORK,
    RecordStatus.OFFICE_WORK,
    RecordStatus.COMPLETED_WORK,
    RecordStatus.PENDING_CHECK,
    RecordStatus.PENDING_SIGN,
    RecordStatus.SIGNED,
    RecordStatus.HANDOVER,
    RecordStatus.RETURNED,
    RecordStatus.PENDING_SUPPLEMENT,
    RecordStatus.WITHDRAWN,
    RecordStatus.REJECTED
  ];

  return Array.from(new Set(allowed));
}

export function getDodacWorkflowStage(record: Partial<RecordFile>): { stageIndex: number; stageName: string; category: string } {
  const status = record.status;
  switch (status) {
    case RecordStatus.RECEIVED:
    case RecordStatus.ASSIGNED:
      return { stageIndex: 1, stageName: 'Tiếp nhận & Phân công', category: 'TIEN_TRINH' };
    case RecordStatus.FIELD_WORK:
      return { stageIndex: 2, stageName: 'Đo đạc thực địa', category: 'TIEN_TRINH' };
    case RecordStatus.OFFICE_WORK:
    case RecordStatus.IN_PROGRESS:
      return { stageIndex: 3, stageName: 'Biên tập bản đồ', category: 'TIEN_TRINH' };
    case RecordStatus.COMPLETED_WORK:
    case RecordStatus.PENDING_CHECK:
      return { stageIndex: 4, stageName: 'Kiểm tra kỹ thuật', category: 'TIEN_TRINH' };
    case RecordStatus.PENDING_SIGN:
    case RecordStatus.SIGNED:
    case RecordStatus.HANDOVER:
      return { stageIndex: 5, stageName: 'Phê duyệt & Bàn giao', category: 'TIEN_TRINH' };
    case RecordStatus.RETURNED:
      return { stageIndex: 6, stageName: 'Đã trả kết quả', category: 'HOAN_THANH' };
    case RecordStatus.PENDING_SUPPLEMENT:
      return { stageIndex: 12, stageName: 'Chờ bổ sung', category: 'BO_SUNG' };
    case RecordStatus.WITHDRAWN:
      return { stageIndex: 13, stageName: 'CSD rút hồ sơ', category: 'KET_THUC' };
    case RecordStatus.REJECTED:
      return { stageIndex: 14, stageName: 'Huỷ hồ sơ', category: 'KET_THUC' };
    default:
      return { stageIndex: 0, stageName: 'Chưa xác định', category: 'TIEN_TRINH' };
  }
}

import { loadRegistrationSlaFullConfig } from '../components/registration/RegistrationSlaStatusView';

export function getDodacWorkflow(procedureCode?: string | null): {
  code: string;
  name: string;
  hasFieldWork: boolean;
  standardDays: number;
  steps: { stepNumber: number; name: string; durationDays: number; durationHours: number }[];
} {
  const code = (procedureCode || '').trim();
  const fullConfig = loadRegistrationSlaFullConfig();
  
  const matchedItem = fullConfig.procedureItems.find(p => p.module === 'dodac' && (p.code === code || code.includes(p.code)));

  if (matchedItem) {
    const totalDays = matchedItem.steps.reduce((sum, s) => sum + (s.durationDays || 0), 0);
    return {
      code: matchedItem.code,
      name: matchedItem.name,
      hasFieldWork: !!matchedItem.hasFieldWork,
      standardDays: totalDays,
      steps: matchedItem.steps.map(s => ({
        stepNumber: s.stepNumber,
        name: s.name,
        durationDays: s.durationDays,
        durationHours: s.durationHours,
      })),
    };
  }

  const isNoFieldWork = code.includes('2.1') || code.includes('2.3');

  if (isNoFieldWork) {
    return {
      code: 'DODAC_NO_FIELD',
      name: 'Đo đạc không thực địa (2.1, 2.3)',
      hasFieldWork: false,
      standardDays: 6,
      steps: [
        { stepNumber: 1, name: 'Tiếp nhận mới', durationDays: 1, durationHours: 8 },
        { stepNumber: 2, name: 'Biên tập bản đồ', durationDays: 2, durationHours: 16 },
        { stepNumber: 3, name: 'Kiểm tra', durationDays: 1, durationHours: 8 },
        { stepNumber: 4, name: 'Trình ký', durationDays: 1, durationHours: 8 },
        { stepNumber: 5, name: 'Hoàn Thành', durationDays: 0.5, durationHours: 4 },
        { stepNumber: 6, name: 'Trả kết quả', durationDays: 0.5, durationHours: 4 },
      ]
    };
  }

  // Mặc định nhóm có thực địa (2.2, 2.4, 2.5)
  return {
    code: 'DODAC_FIELD',
    name: 'Đo đạc có thực địa (2.2, 2.4, 2.5)',
    hasFieldWork: true,
    standardDays: 8,
    steps: [
      { stepNumber: 1, name: 'Tiếp nhận mới', durationDays: 1, durationHours: 8 },
      { stepNumber: 2, name: 'Đo đạc thực địa', durationDays: 2, durationHours: 16 },
      { stepNumber: 3, name: 'Biên tập bản đồ', durationDays: 2, durationHours: 16 },
      { stepNumber: 4, name: 'Kiểm tra', durationDays: 1, durationHours: 8 },
      { stepNumber: 5, name: 'Trình ký', durationDays: 1, durationHours: 8 },
      { stepNumber: 6, name: 'Hoàn Thành', durationDays: 0.5, durationHours: 4 },
      { stepNumber: 7, name: 'Trả kết quả', durationDays: 0.5, durationHours: 4 },
    ]
  };
}

export function handleDodacSupplement(
  record: Partial<RecordFile>,
  reason?: string,
  requestedBy?: string
): Partial<RecordFile> {
  const current = record.status || RecordStatus.RECEIVED;
  const now = new Date().toISOString();
  return {
    status: RecordStatus.PENDING_SUPPLEMENT,
    previousStatus: current,
    supplementReturnStatus: current,
    supplementReason: reason || record.supplementReason || null,
    supplementRequestedBy: requestedBy || null,
    supplementRequestedAt: now,
    supplementStartedAt: now,
  };
}

export function resumeDodacFromSupplement(record: RecordFile): { nextStatus: RecordStatus; updates: Partial<RecordFile> } {
  const targetStatus = (record.supplementReturnStatus as RecordStatus) || (record.previousStatus as RecordStatus);
  if (!targetStatus) {
    throw new Error('Không xác định được trạng thái trước khi bổ sung (supplementReturnStatus) cho hồ sơ Đo đạc.');
  }
  const now = new Date().toISOString();
  return {
    nextStatus: targetStatus,
    updates: {
      status: targetStatus,
      supplementCompletedAt: now,
      supplementReturnedDate: now,
      previousStatus: undefined,
      supplementReturnStatus: undefined,
    },
  };
}
