import { RecordStatus, RecordFile } from '../types';

/**
 * STATE MACHINE ĐỘC LẬP CHO MODULE CẤP GIẤY / ĐĂNG KÝ BIẾN ĐỘNG
 * Tuân thủ nghiêm ngặt 14 trạng thái khép kín được phê duyệt.
 * Không chia sẻ logic luân chuyển với Module Đo đạc và Module Lưu trữ.
 */

// Danh mục 14 trạng thái hợp lệ duy nhất của Module Cấp giấy
export const CAP_GIAY_STATUSES = [
  RecordStatus.RECEIVED,             // 1. Tiếp nhận hồ sơ
  RecordStatus.APPRAISAL,            // 2. Chờ thẩm định
  RecordStatus.TAX_TRANSFER,         // 3. Chờ chuyển thuế
  RecordStatus.PENDING_TAX_KV7,      // 4. Chờ thuế khu vực 7
  RecordStatus.PENDING_TAX_PAYMENT,  // 5. Chờ Giấy nộp tiền
  RecordStatus.PENDING_PRINT_CERT,   // 6. Chờ in giấy chứng nhận
  RecordStatus.PENDING_CHECK,        // 7. Chờ kiểm tra
  RecordStatus.PENDING_SIGN,         // 8. Chờ ký duyệt
  RecordStatus.PENDING_HANDOVER,     // 9. Chờ bàn giao (Dành riêng cho Cấp giấy)
  RecordStatus.HANDOVER,             // 10. Đã giao 1 cửa
  RecordStatus.RETURNED,             // 11. Đã trả kết quả
  RecordStatus.PENDING_SUPPLEMENT,   // 12. Chờ bổ sung
  RecordStatus.WITHDRAWN,            // 13. Csd rút hồ sơ
  RecordStatus.REJECTED              // 14. Huỷ hồ sơ
] as const;

export type CapGiayStatus = typeof CAP_GIAY_STATUSES[number];

// Tên hiển thị tiếng Việt chuẩn xác 100% theo yêu cầu
export const CAP_GIAY_STATUS_LABELS: Record<CapGiayStatus, string> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận hồ sơ',
  [RecordStatus.APPRAISAL]: 'Chờ thẩm định',
  [RecordStatus.TAX_TRANSFER]: 'Chờ chuyển thuế',
  [RecordStatus.PENDING_TAX_KV7]: 'Chờ thuế khu vực 7',
  [RecordStatus.PENDING_TAX_PAYMENT]: 'Chờ Giấy nộp tiền',
  [RecordStatus.PENDING_PRINT_CERT]: 'Chờ in giấy chứng nhận',
  [RecordStatus.PENDING_CHECK]: 'Chờ kiểm tra',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký duyệt',
  [RecordStatus.PENDING_HANDOVER]: 'Chờ bàn giao',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.PENDING_SUPPLEMENT]: 'Chờ bổ sung',
  [RecordStatus.WITHDRAWN]: 'Csd rút hồ sơ',
  [RecordStatus.REJECTED]: 'Huỷ hồ sơ'
};

// Danh sách các trạng thái CẤM TUYỆT ĐỐI xuất hiện trong Module Cấp giấy
export const CAP_GIAY_FORBIDDEN_STATUSES = [
  RecordStatus.FIELD_WORK,
  RecordStatus.OFFICE_WORK,
  RecordStatus.COMPLETED_WORK,
  RecordStatus.SIGNED
];

// Luồng chuyển trạng thái chính tuần tự (Strict Sequential Main Flow)
export const CAP_GIAY_MAIN_FLOW: CapGiayStatus[] = [
  RecordStatus.RECEIVED,             // Bước 1
  RecordStatus.APPRAISAL,            // Bước 2
  RecordStatus.TAX_TRANSFER,         // Bước 3
  RecordStatus.PENDING_TAX_KV7,      // Bước 4
  RecordStatus.PENDING_TAX_PAYMENT,  // Bước 5
  RecordStatus.PENDING_PRINT_CERT,   // Bước 6
  RecordStatus.PENDING_CHECK,        // Bước 7
  RecordStatus.PENDING_SIGN,         // Bước 8
  RecordStatus.PENDING_HANDOVER,     // Bước 9
  RecordStatus.HANDOVER,             // Bước 10
  RecordStatus.RETURNED              // Bước 11 (Hoàn tất)
];

// Danh mục trạng thái chọn lựa cho Select/Dropdown của Module Cấp giấy
export const CAP_GIAY_SELECTABLE_STATUSES: { key: RecordStatus; label: string }[] = CAP_GIAY_STATUSES.map(st => ({
  key: st,
  label: CAP_GIAY_STATUS_LABELS[st]
}));

/**
 * Kiểm tra xem một giá trị trạng thái có thuộc 14 trạng thái Cấp giấy hợp lệ hay không
 */
export function isCapGiayStatus(status: any): status is CapGiayStatus {
  return typeof status === 'string' && (CAP_GIAY_STATUSES as readonly string[]).includes(status);
}

/**
 * Lấy trạng thái kế tiếp trong luồng chính của Cấp giấy
 */
export function getNextCapGiayStatus(currentStatus: RecordStatus | string): CapGiayStatus | null {
  const idx = CAP_GIAY_MAIN_FLOW.indexOf(currentStatus as CapGiayStatus);
  if (idx >= 0 && idx < CAP_GIAY_MAIN_FLOW.length - 1) {
    return CAP_GIAY_MAIN_FLOW[idx + 1];
  }
  return null;
}

/**
 * Lấy trạng thái trước đó trong luồng chính của Cấp giấy (cho thao tác trả về bước trước)
 */
export function getPreviousCapGiayStatus(currentStatus: RecordStatus | string): CapGiayStatus | null {
  const idx = CAP_GIAY_MAIN_FLOW.indexOf(currentStatus as CapGiayStatus);
  if (idx > 0) {
    return CAP_GIAY_MAIN_FLOW[idx - 1];
  }
  return null;
}

export interface CapGiayTransitionValidation {
  valid: boolean;
  reason?: string;
  targetStatus?: CapGiayStatus;
}

/**
 * Bộ kiểm soát chuyển trạng thái (State Machine Guard) cho Module Cấp giấy
 */
export function validateCapGiayTransition(
  currentStatus: RecordStatus | string,
  targetStatus: RecordStatus | string,
  previousStatus?: RecordStatus | string | null
): CapGiayTransitionValidation {
  // 1. Chặn các trạng thái bị cấm tuyệt đối
  if ((CAP_GIAY_FORBIDDEN_STATUSES as string[]).includes(String(targetStatus))) {
    return {
      valid: false,
      reason: `Trạng thái "${targetStatus}" bị cấm trong Module Cấp giấy (thuộc về Đo đạc/Lưu trữ).`
    };
  }

  // 2. Chặn trạng thái không nằm trong 14 trạng thái
  if (!isCapGiayStatus(targetStatus)) {
    return {
      valid: false,
      reason: `Trạng thái đích "${targetStatus}" không nằm trong danh mục 14 trạng thái hợp lệ của Cấp giấy.`
    };
  }

  // 3. Trạng thái kết thúc: Đã trả kết quả, CSD rút hồ sơ, Huỷ hồ sơ không thể chuyển tiếp
  if (
    currentStatus === RecordStatus.RETURNED ||
    currentStatus === RecordStatus.WITHDRAWN ||
    currentStatus === RecordStatus.REJECTED
  ) {
    return {
      valid: false,
      reason: `Hồ sơ đã ở trạng thái kết thúc (${CAP_GIAY_STATUS_LABELS[currentStatus as CapGiayStatus] || currentStatus}), không thể chuyển bước.`
    };
  }

  // 4. Cho phép chuyển sang Trạng thái kết thúc bất kỳ lúc nào từ luồng xử lý
  if (targetStatus === RecordStatus.WITHDRAWN || targetStatus === RecordStatus.REJECTED) {
    return { valid: true, targetStatus };
  }

  // 5. Chuyển sang Chờ bổ sung (PENDING_SUPPLEMENT): Cho phép từ mọi bước trong luồng chính
  if (targetStatus === RecordStatus.PENDING_SUPPLEMENT) {
    if (CAP_GIAY_MAIN_FLOW.includes(currentStatus as CapGiayStatus)) {
      return { valid: true, targetStatus };
    }
    return {
      valid: false,
      reason: `Không thể chuyển sang Chờ bổ sung từ trạng thái "${currentStatus}".`
    };
  }

  // 6. Hoàn tất bổ sung (từ PENDING_SUPPLEMENT quay lại):
  if (currentStatus === RecordStatus.PENDING_SUPPLEMENT) {
    if (!previousStatus || !isCapGiayStatus(previousStatus)) {
      return {
        valid: false,
        reason: 'Không xác định được trạng thái trước khi bổ sung (previousStatus) để phục hồi hồ sơ.'
      };
    }
    if (targetStatus !== previousStatus) {
      return {
        valid: false,
        reason: `Quy tắc nghiệp vụ: Hồ sơ bổ sung xong bắt buộc phải quay lại đúng bước đã yêu cầu (${CAP_GIAY_STATUS_LABELS[previousStatus]}), không được nhảy sang "${CAP_GIAY_STATUS_LABELS[targetStatus]}".`
      };
    }
    return { valid: true, targetStatus: previousStatus };
  }

  // 7. Kiểm soát luồng chính tuần tự (Strict sequential)
  const currentIdx = CAP_GIAY_MAIN_FLOW.indexOf(currentStatus as CapGiayStatus);
  const targetIdx = CAP_GIAY_MAIN_FLOW.indexOf(targetStatus);

  if (currentIdx !== -1 && targetIdx !== -1) {
    // Bước kế tiếp ngay sau
    if (targetIdx === currentIdx + 1) {
      return { valid: true, targetStatus };
    }
    // Lùi về đúng 1 bước (cho thao tác trả hồ sơ nội bộ)
    if (targetIdx === currentIdx - 1) {
      return { valid: true, targetStatus };
    }
    // Nhảy cóc bước không hợp lệ
    return {
      valid: false,
      reason: `Không được chuyển nhảy bước từ "${CAP_GIAY_STATUS_LABELS[currentStatus as CapGiayStatus]}" sang "${CAP_GIAY_STATUS_LABELS[targetStatus]}". Phải tuân thủ thứ tự tuần tự của quy trình.`
    };
  }

  return {
    valid: false,
    reason: `Chuyển trạng thái từ "${currentStatus}" sang "${targetStatus}" không hợp lệ.`
  };
}

export const CAP_GIAY_STEP_ORDER: Record<string, number> = {
  [RecordStatus.RECEIVED]: 1,
  [RecordStatus.APPRAISAL]: 2,
  [RecordStatus.TAX_TRANSFER]: 3,
  [RecordStatus.PENDING_TAX_KV7]: 4,
  [RecordStatus.PENDING_TAX_PAYMENT]: 5,
  [RecordStatus.PENDING_PRINT_CERT]: 6,
  [RecordStatus.PENDING_CHECK]: 7,
  [RecordStatus.PENDING_SIGN]: 8,
  [RecordStatus.PENDING_HANDOVER]: 9,
  [RecordStatus.HANDOVER]: 10,
  [RecordStatus.RETURNED]: 11,
  [RecordStatus.PENDING_SUPPLEMENT]: 12,
  [RecordStatus.WITHDRAWN]: 13,
  [RecordStatus.REJECTED]: 14
};

export const getCapGiayNextMainStatus = getNextCapGiayStatus;

export function getAllowedCapGiayTransitions(
  currentStatus: RecordStatus | string,
  previousStatus?: RecordStatus | string | null
): CapGiayStatus[] {
  if (
    currentStatus === RecordStatus.RETURNED ||
    currentStatus === RecordStatus.WITHDRAWN ||
    currentStatus === RecordStatus.REJECTED
  ) {
    return [];
  }

  if (currentStatus === RecordStatus.PENDING_SUPPLEMENT) {
    const target = previousStatus && isCapGiayStatus(previousStatus) ? (previousStatus as CapGiayStatus) : null;
    return target ? [target] : [];
  }

  const allowed: CapGiayStatus[] = [];
  const next = getNextCapGiayStatus(currentStatus);
  const prev = getPreviousCapGiayStatus(currentStatus);

  if (next) allowed.push(next);
  if (prev) allowed.push(prev);

  allowed.push(RecordStatus.PENDING_SUPPLEMENT, RecordStatus.WITHDRAWN, RecordStatus.REJECTED);
  return Array.from(new Set(allowed));
}

export function getCapGiayWorkflowStage(record: Partial<RecordFile>): { stageIndex: number; stageName: string; category: string } {
  const status = record.status;
  switch (status) {
    case RecordStatus.RECEIVED:
      return { stageIndex: 1, stageName: 'Tiếp nhận', category: 'TIEN_TRINH' };
    case RecordStatus.APPRAISAL:
      return { stageIndex: 2, stageName: 'Thẩm định', category: 'TIEN_TRINH' };
    case RecordStatus.TAX_TRANSFER:
    case RecordStatus.PENDING_TAX_KV7:
    case RecordStatus.PENDING_TAX_PAYMENT:
      return { stageIndex: 3, stageName: 'Nghĩa vụ tài chính', category: 'TIEN_TRINH' };
    case RecordStatus.PENDING_PRINT_CERT:
    case RecordStatus.PENDING_CHECK:
      return { stageIndex: 4, stageName: 'In GCN & Kiểm tra', category: 'TIEN_TRINH' };
    case RecordStatus.PENDING_SIGN:
    case RecordStatus.PENDING_HANDOVER:
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

export function handleCapGiaySupplement(
  record: Partial<RecordFile>,
  reason?: string,
  requestedBy?: string
): Partial<RecordFile> {
  if (record.status === RecordStatus.PENDING_SUPPLEMENT) {
    throw new Error('Hồ sơ đã ở trạng thái Chờ bổ sung.');
  }
  const current = record.status || RecordStatus.RECEIVED;
  if (!isCapGiayStatus(current)) {
    throw new Error(`Trạng thái "${current}" không hợp lệ để tạo yêu cầu bổ sung trong Module Cấp giấy.`);
  }
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

export function resumeFromSupplement(record: RecordFile): { nextStatus: RecordStatus; updates: Partial<RecordFile> } {
  const targetStatus = (record.supplementReturnStatus as RecordStatus) || (record.previousStatus as RecordStatus);
  if (!targetStatus || !isCapGiayStatus(targetStatus)) {
    console.error('CRITICAL: Thiếu supplementReturnStatus / previousStatus khi hoàn thành bổ sung:', record);
    throw new Error('Không xác định được trạng thái trước khi bổ sung (supplementReturnStatus) để phục hồi hồ sơ.');
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
