import { WorkflowStep, DangKyRecord, RecordFile } from '../types';
import { getProcedureWorkflow } from '../services/apiWorkflow';
import { detectProcedureId } from '../constants/procedures';
import { addWorkingHours, SlaStatusResult, SlaStatusType } from './slaEngine';

export interface StepDeadlineInfo {
  stepCode: string;
  stepName: string;
  slaHours: number;
  slaDisplay: string;
  excludeFromTotalSla: boolean;
  startDate: string | null;
  endDate: string | null;
  deadlineDate: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  slaStatus: SlaStatusResult;
  isCurrentStep: boolean;
  timeRemainingText?: string;
}

/**
 * Maps normalized DangKy status to internal workflow stepCode.
 */
export function mapDangKyStatusToStepCode(status?: string | null): string {
  if (!status) return 'tiep_nhan';
  const clean = status.trim();
  switch (clean) {
    case 'Tiếp nhận mới':
      return 'tiep_nhan';
    case 'Thẩm định':
      return 'tham_dinh';
    case 'Phiếu chuyển thuế':
      return 'phieu_chuyen_thue';
    case 'Chờ Thuế KV7':
      return 'thue_kv7';
    case 'Chờ giấy nộp tiền':
    case 'Thông báo thuế':
      return 'thong_bao_thue';
    case 'Chờ In GCN':
    case 'In GCN':
      return 'in_gcn';
    case 'Chờ kiểm tra':
    case 'Trình kiểm tra':
      return 'trinh_kiem_tra';
    case 'Chờ ký duyệt':
    case 'Trình ký':
      return 'trinh_ky';
    case 'Chờ bàn giao':
    case 'Đang thực hiện':
      return 'dang_thuc_hien';
    case 'Đã giao 1 cửa':
    case 'Hoàn thành':
      return 'hoan_thanh';
    case 'Đã trả kết quả':
      return 'tra_ket_qua';
    default:
      return 'tiep_nhan';
  }
}

/**
 * Calculates deadline and SLA status for all steps of a DangKy record based on its procedure workflow.
 */
export function calculateRecordStepDeadlines(record: DangKyRecord): StepDeadlineInfo[] {
  const procId = detectProcedureId(record.code, record.recordType) || '3.1.1';
  const workflow = getProcedureWorkflow(procId);
  const currentStepCode = mapDangKyStatusToStepCode(record.status);

  // Mốc thời gian từng bước từ dữ liệu hồ sơ
  const dateMap: Record<string, string | null> = {
    tiep_nhan: record.receivedDate || null,
    tham_dinh: record.appraisalDate || record.assignedDate || null,
    phieu_chuyen_thue: record.taxFormDate || null,
    thue_kv7: record.taxKV7TransferDate || null,
    thong_bao_thue: record.taxNoticeDate || record.taxPaymentReceiptDate || null,
    in_gcn: record.printDate || null,
    trinh_kiem_tra: record.pendingCheckDate || null,
    trinh_ky: record.submissionDate || null,
    dang_thuc_hien: record.assignedDate || null,
    hoan_thanh: record.completedDate || record.exportDate || null,
    tra_ket_qua: record.resultReturnedDate || (record as any).deliveryDate || null,
  };

  const steps = workflow.steps || [];
  const results: StepDeadlineInfo[] = [];

  let previousStepEndDate: Date | null = record.receivedDate ? new Date(record.receivedDate) : new Date();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const recordedDateStr = dateMap[step.stepCode] || null;
    const isCurrent = step.stepCode === currentStepCode;

    // Xác định ngày bắt đầu của bước
    let stepStartDate: Date | null = null;
    if (recordedDateStr) {
      stepStartDate = new Date(recordedDateStr);
    } else if (i === 0 && record.receivedDate) {
      stepStartDate = new Date(record.receivedDate);
    } else if (previousStepEndDate) {
      stepStartDate = new Date(previousStepEndDate);
    }

    // Tính Deadline cho bước
    let stepDeadlineDate: Date | null = null;
    if (stepStartDate && !isNaN(stepStartDate.getTime())) {
      stepDeadlineDate = addWorkingHours(stepStartDate, step.slaHours || 8);
    }

    // Ngày hoàn thành bước (nếu bước tiếp theo đã có ngày hoặc bước này đã kết thúc)
    const nextStepCode = steps[i + 1]?.stepCode;
    const nextRecordedDateStr = nextStepCode ? dateMap[nextStepCode] : null;
    const isCompleted = !isCurrent && (!!nextRecordedDateStr || (!!recordedDateStr && i < steps.findIndex(s => s.stepCode === currentStepCode)));

    // Xác định trạng thái SLA
    let slaResult: SlaStatusResult = {
      status: 'ontime',
      label: 'Trong hạn',
      colorClass: 'text-emerald-600',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
    let timeRemainingText = '';

    if (step.excludeFromTotalSla) {
      slaResult = {
        status: 'ontime',
        label: 'Tạm dừng SLA',
        colorClass: 'text-sky-600',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
      };
      timeRemainingText = 'Không tính vào tổng SLA';
    } else if (isCompleted) {
      slaResult = {
        status: 'ontime',
        label: 'Đã hoàn thành',
        colorClass: 'text-slate-600',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
      };
      timeRemainingText = 'Hoàn tất bước';
    } else if (isCurrent && stepDeadlineDate) {
      const now = new Date();
      const diffMs = stepDeadlineDate.getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));

      if (diffHours < 0) {
        slaResult = {
          status: 'overdue',
          label: 'Quá hạn khâu',
          colorClass: 'text-rose-600',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse'
        };
        timeRemainingText = `Trễ ${Math.abs(diffHours)} giờ`;
      } else if (diffHours <= 4) {
        slaResult = {
          status: 'warning',
          label: 'Sắp đến hạn',
          colorClass: 'text-amber-600',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold'
        };
        timeRemainingText = `Còn ${diffHours} giờ`;
      } else {
        slaResult = {
          status: 'ontime',
          label: 'Đúng hạn',
          colorClass: 'text-emerald-600',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
        timeRemainingText = `Còn ${diffHours} giờ`;
      }
    }

    results.push({
      stepCode: step.stepCode,
      stepName: step.stepName,
      slaHours: step.slaHours,
      slaDisplay: step.slaDisplay,
      excludeFromTotalSla: step.excludeFromTotalSla,
      startDate: stepStartDate ? stepStartDate.toISOString() : null,
      endDate: recordedDateStr,
      deadlineDate: stepDeadlineDate ? stepDeadlineDate.toISOString() : null,
      status: isCompleted ? 'completed' : isCurrent ? 'in_progress' : 'pending',
      slaStatus: slaResult,
      isCurrentStep: isCurrent,
      timeRemainingText
    });

    if (recordedDateStr) {
      previousStepEndDate = new Date(recordedDateStr);
    } else if (stepDeadlineDate) {
      previousStepEndDate = stepDeadlineDate;
    }
  }

  return results;
}

/**
 * Checks if a DangKyRecord is overdue at its CURRENT step.
 */
export function isDangKyStepOverdue(record: DangKyRecord): boolean {
  if (['Đã giao 1 cửa', 'Đã trả kết quả', 'CSD rút HS', 'Trả hủy hồ sơ'].includes(record.status)) {
    return false;
  }
  const stepDeadlines = calculateRecordStepDeadlines(record);
  const currentStep = stepDeadlines.find(s => s.isCurrentStep);
  if (!currentStep || currentStep.excludeFromTotalSla) return false;
  return currentStep.slaStatus.status === 'overdue';
}

/**
 * Checks if a DangKyRecord is approaching deadline at its CURRENT step.
 */
export function isDangKyStepApproaching(record: DangKyRecord): boolean {
  if (['Đã giao 1 cửa', 'Đã trả kết quả', 'CSD rút HS', 'Trả hủy hồ sơ'].includes(record.status)) {
    return false;
  }
  const stepDeadlines = calculateRecordStepDeadlines(record);
  const currentStep = stepDeadlines.find(s => s.isCurrentStep);
  if (!currentStep || currentStep.excludeFromTotalSla) return false;
  return currentStep.slaStatus.status === 'warning';
}
