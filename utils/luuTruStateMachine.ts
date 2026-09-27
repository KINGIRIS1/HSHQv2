import { RecordStatus, RecordFile } from '../types';

/**
 * STATE MACHINE ĐỘC LẬP CHO MODULE LƯU TRỮ
 * Quản lý quy trình cung cấp thông tin, sao lục bản trích đo và dịch vụ thông tin đất đai.
 */

export const LUU_TRU_STATUSES = [
  RecordStatus.RECEIVED,             // Tiếp nhận mới
  RecordStatus.ASSIGNED,             // Đã phân công
  RecordStatus.IN_PROGRESS,          // Đang thực hiện
  RecordStatus.PENDING_SUPPLEMENT,   // Chờ bổ sung
  RecordStatus.PENDING_SIGN,         // Chờ ký duyệt
  RecordStatus.SIGNED,               // Chờ bàn giao (Đã ký)
  RecordStatus.HANDOVER,             // Đã giao 1 cửa
  RecordStatus.RETURNED,             // Đã trả kết quả
  RecordStatus.WITHDRAWN,            // CSD rút hồ sơ
  RecordStatus.REJECTED              // Trả hồ sơ
] as const;

export type LuuTruStatus = typeof LUU_TRU_STATUSES[number];

export const LUU_TRU_STATUS_LABELS: Partial<Record<RecordStatus, string>> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận mới',
  [RecordStatus.ASSIGNED]: 'Đã phân công',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.PENDING_SUPPLEMENT]: 'Chờ bổ sung',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký duyệt',
  [RecordStatus.SIGNED]: 'Chờ bàn giao',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.WITHDRAWN]: 'CSD rút hồ sơ',
  [RecordStatus.REJECTED]: 'Trả hồ sơ'
};

export const LUU_TRU_MAIN_FLOW: LuuTruStatus[] = [
  RecordStatus.RECEIVED,
  RecordStatus.ASSIGNED,
  RecordStatus.IN_PROGRESS,
  RecordStatus.PENDING_SIGN,
  RecordStatus.SIGNED,
  RecordStatus.HANDOVER,
  RecordStatus.RETURNED
];

export function isLuuTruStatus(status: any): status is LuuTruStatus {
  return typeof status === 'string' && (LUU_TRU_STATUSES as readonly string[]).includes(status);
}

export function getNextLuuTruStatus(currentStatus: RecordStatus | string): LuuTruStatus | null {
  if (currentStatus === RecordStatus.RECEIVED) return RecordStatus.ASSIGNED;
  if (currentStatus === RecordStatus.ASSIGNED) return RecordStatus.IN_PROGRESS;
  if (currentStatus === RecordStatus.IN_PROGRESS) return RecordStatus.PENDING_SIGN;
  if (currentStatus === RecordStatus.PENDING_SIGN) return RecordStatus.SIGNED;
  if (currentStatus === RecordStatus.SIGNED) return RecordStatus.HANDOVER;
  if (currentStatus === RecordStatus.HANDOVER) return RecordStatus.RETURNED;
  return null;
}

export function validateLuuTruTransition(
  currentStatus: RecordStatus | string,
  targetStatus: RecordStatus | string,
  previousStatus?: RecordStatus | string | null
): { valid: boolean; reason?: string; targetStatus?: LuuTruStatus } {
  if (!isLuuTruStatus(targetStatus)) {
    return { valid: false, reason: `Trạng thái "${targetStatus}" không thuộc Module Lưu trữ.` };
  }

  if (
    currentStatus === RecordStatus.RETURNED ||
    currentStatus === RecordStatus.WITHDRAWN ||
    currentStatus === RecordStatus.REJECTED
  ) {
    return { valid: false, reason: 'Hồ sơ đã ở trạng thái kết thúc.' };
  }

  if (targetStatus === RecordStatus.WITHDRAWN || targetStatus === RecordStatus.REJECTED) {
    return { valid: true, targetStatus };
  }

  if (targetStatus === RecordStatus.PENDING_SUPPLEMENT) {
    return { valid: true, targetStatus };
  }

  if (currentStatus === RecordStatus.PENDING_SUPPLEMENT) {
    if (!previousStatus || !isLuuTruStatus(previousStatus)) {
      return { valid: false, reason: 'Không xác định được trạng thái trước khi bổ sung.' };
    }
    return { valid: true, targetStatus: previousStatus as LuuTruStatus };
  }

  return { valid: true, targetStatus };
}

export function getAllowedLuuTruTransitions(
  currentStatus: RecordStatus | string,
  previousStatus?: RecordStatus | string | null
): LuuTruStatus[] {
  if (
    currentStatus === RecordStatus.RETURNED ||
    currentStatus === RecordStatus.WITHDRAWN ||
    currentStatus === RecordStatus.REJECTED
  ) {
    return [];
  }

  if (currentStatus === RecordStatus.PENDING_SUPPLEMENT) {
    return previousStatus && isLuuTruStatus(previousStatus) ? [previousStatus as LuuTruStatus] : [];
  }

  return [
    RecordStatus.ASSIGNED,
    RecordStatus.IN_PROGRESS,
    RecordStatus.PENDING_SIGN,
    RecordStatus.SIGNED,
    RecordStatus.HANDOVER,
    RecordStatus.RETURNED,
    RecordStatus.PENDING_SUPPLEMENT,
    RecordStatus.WITHDRAWN,
    RecordStatus.REJECTED
  ];
}

export function getLuuTruWorkflowStage(record: Partial<RecordFile>): { stageIndex: number; stageName: string; category: string } {
  const status = record.status;
  switch (status) {
    case RecordStatus.RECEIVED:
    case RecordStatus.ASSIGNED:
      return { stageIndex: 1, stageName: 'Tiếp nhận & Phân công', category: 'TIEN_TRINH' };
    case RecordStatus.IN_PROGRESS:
      return { stageIndex: 2, stageName: 'Đang khai thác / Trích lục', category: 'TIEN_TRINH' };
    case RecordStatus.PENDING_SIGN:
    case RecordStatus.SIGNED:
    case RecordStatus.HANDOVER:
      return { stageIndex: 3, stageName: 'Duyệt & Giao trả', category: 'TIEN_TRINH' };
    case RecordStatus.RETURNED:
      return { stageIndex: 4, stageName: 'Đã trả kết quả', category: 'HOAN_THANH' };
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

export function handleLuuTruSupplement(
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

export function resumeLuuTruFromSupplement(record: RecordFile): { nextStatus: RecordStatus; updates: Partial<RecordFile> } {
  const targetStatus = (record.supplementReturnStatus as RecordStatus) || (record.previousStatus as RecordStatus);
  if (!targetStatus) {
    throw new Error('Không xác định được trạng thái trước khi bổ sung (supplementReturnStatus) cho hồ sơ Lưu trữ.');
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
