import { WorkflowStep, DangKyRecord, RecordFile, Employee, User, RecordStatus } from '../types';
import { getProcedureWorkflow } from '../services/apiWorkflow';
import { detectProcedureId, isArchiveRecordType, isDoDacRecordType } from '../constants/procedures';
import { addWorkingHours, SlaStatusResult, SlaStatusType } from './slaEngine';
import { 
  User as UserIcon, 
  Send, 
  CheckSquare, 
  FileCheck, 
  Printer, 
  Receipt, 
  DollarSign, 
  Clock, 
  Search, 
  FileText,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';

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
 * Maps any record status (DangKy, Survey, Archive, General) to internal workflow stepCode.
 */
export function mapRecordStatusToStepCode(status?: string | null, recordType?: string | null): string {
  if (!status) return 'tiep_nhan';
  const clean = status.trim();

  // Normalize standard Status enum or text
  switch (clean) {
    case RecordStatus.RECEIVED:
    case 'Tiếp nhận mới':
    case 'tiep_nhan':
      return 'tiep_nhan';

    case 'Thẩm định':
    case 'tham_dinh':
      return 'tham_dinh';

    case 'Phiếu chuyển thuế':
    case 'phieu_chuyen_thue':
      return 'phieu_chuyen_thue';

    case 'Chờ Thuế KV7':
    case 'thue_kv7':
      return 'thue_kv7';

    case 'Chờ giấy nộp tiền':
    case 'Thông báo thuế':
    case 'thong_bao_thue':
      return 'thong_bao_thue';

    case 'Chờ In GCN':
    case 'In GCN':
    case 'in_gcn':
      return 'in_gcn';

    case RecordStatus.PENDING_CHECK:
    case RecordStatus.CHECKED:
    case 'Chờ kiểm tra':
    case 'Trình kiểm tra':
    case 'Đã kiểm tra':
    case 'trinh_kiem_tra':
      return 'trinh_kiem_tra';

    case RecordStatus.PENDING_SIGN:
    case RecordStatus.SIGNED:
    case 'Chờ ký duyệt':
    case 'Trình ký':
    case 'Trình ký duyệt':
    case 'Đã ký':
    case 'trinh_ky':
      return 'trinh_ky';

    case RecordStatus.ASSIGNED:
    case RecordStatus.IN_PROGRESS:
    case RecordStatus.COMPLETED_WORK:
    case 'Đã phân công':
    case 'Đang thực hiện':
    case 'Đã thực hiện':
    case 'dang_thuc_hien':
      return isArchiveRecordType(recordType) || isDoDacRecordType(recordType) ? 'dang_thuc_hien' : 'tham_dinh';

    case RecordStatus.HANDOVER:
    case 'Chờ bàn giao':
    case 'Đã giao 1 cửa':
    case 'Hoàn thành':
    case 'hoan_thanh':
      return 'hoan_thanh';

    case RecordStatus.RETURNED:
    case 'Đã trả kết quả':
    case 'tra_ket_qua':
      return 'tra_ket_qua';

    default:
      return 'tiep_nhan';
  }
}

/**
 * Backward compatibility alias for mapDangKyStatusToStepCode
 */
export const mapDangKyStatusToStepCode = mapRecordStatusToStepCode;

/**
 * Gets appropriate icon component for a workflow step code
 */
export function getStepIcon(stepCode: string) {
  switch (stepCode) {
    case 'tiep_nhan':
      return UserIcon;
    case 'dang_thuc_hien':
      return Activity;
    case 'tham_dinh':
      return Search;
    case 'phieu_chuyen_thue':
      return Receipt;
    case 'thue_kv7':
    case 'thong_bao_thue':
      return DollarSign;
    case 'in_gcn':
      return Printer;
    case 'trinh_kiem_tra':
      return Send;
    case 'trinh_ky':
      return Send;
    case 'hoan_thanh':
      return CheckSquare;
    case 'tra_ket_qua':
      return FileCheck;
    default:
      return Layers;
  }
}

/**
 * Gets subtext/performer label for a workflow step code from record data
 */
export function getStepPerformerInfo(
  record: any, 
  stepCode: string, 
  employees: Employee[] = [], 
  users: User[] = []
): string | undefined {
  if (!record) return undefined;

  switch (stepCode) {
    case 'tiep_nhan':
      if (record.receivedBy) {
        const receiver = users.find(u => u.employeeId === record.receivedBy);
        const emp = employees.find(e => e.id === record.receivedBy || (receiver && e.id === receiver.employeeId));
        return receiver ? `${receiver.name} (${emp?.position || 'Tiếp nhận'})` : emp ? `${emp.name} (${emp.position || 'Tiếp nhận'})` : `Cán bộ: ${record.receivedBy}`;
      }
      return undefined;

    case 'dang_thuc_hien':
    case 'tham_dinh':
      if (record.assignedTo || record.data?.assigned_to) {
        const staffId = record.assignedTo || record.data?.assigned_to;
        const emp = employees.find(e => e.id === staffId);
        return emp ? (emp.position ? `${emp.name} (${emp.position})` : emp.name) : `Cán bộ: ${staffId}`;
      }
      return undefined;

    case 'phieu_chuyen_thue':
    case 'thue_kv7':
    case 'thong_bao_thue':
      if (record.taxStaff) {
        const emp = employees.find(e => e.id === record.taxStaff);
        return emp ? `Thuế: ${emp.name}` : `Thuế: ${record.taxStaff}`;
      }
      return undefined;

    case 'in_gcn':
      if (record.printedBy || record.assignedTo) {
        const staffId = record.printedBy || record.assignedTo;
        const emp = employees.find(e => e.id === staffId);
        return emp ? `In GCN: ${emp.name}` : undefined;
      }
      return undefined;

    case 'trinh_kiem_tra':
      if (record.checkedBy) {
        const checker = employees.find(e => e.id === record.checkedBy);
        return checker ? `${checker.name} (${checker.position || 'Kiểm tra'})` : `Kiểm tra: ${record.checkedBy}`;
      }
      return undefined;

    case 'trinh_ky':
      if (record.submittedTo || record.approvedBy) {
        const signerId = record.submittedTo || record.approvedBy;
        const director = users.find(u => u.employeeId === signerId);
        const emp = employees.find(e => e.id === signerId || (director && e.id === director.employeeId));
        if (director) {
          return `${director.name} (${emp?.position || 'Lãnh đạo ký'})`;
        }
        if (emp) {
          return `${emp.name} (${emp.position || 'Lãnh đạo ký'})`;
        }
        return `Ký duyệt: ${signerId}`;
      }
      return undefined;

    case 'hoan_thanh':
      if (record.exportBatch) {
        return `Đợt xuất: ${record.exportBatch}`;
      }
      return undefined;

    case 'tra_ket_qua':
      if (record.receiverName) {
        return `Người nhận: ${record.receiverName}`;
      }
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Calculates deadline and SLA status for all steps of ANY record (DangKy, Survey, Archive, General)
 * dynamically reading directly from the configured Procedure SLA Workflow.
 */
export function calculateRecordStepDeadlines(record: any): StepDeadlineInfo[] {
  if (!record) return [];

  const codeStr = (record.code || record.so_hieu || '').trim();
  const typeStr = (record.recordType || record.type || '').trim();
  let procId = detectProcedureId(codeStr, typeStr);

  if (!procId) {
    if (isArchiveRecordType(typeStr, codeStr) || record.sourceTable === 'luutru_records') {
      procId = (typeStr.includes('Công văn') || codeStr.toUpperCase().startsWith('CV')) ? '1.2' : '1.1';
    } else {
      procId = '3.1.1';
    }
  }

  const workflow = getProcedureWorkflow(procId);
  const currentStepCode = mapRecordStatusToStepCode(record.status, typeStr);

  // Mốc thời gian từng bước từ dữ liệu hồ sơ
  const dateMap: Record<string, string | null> = {
    tiep_nhan: record.receivedDate || record.ngay_thang || null,
    tham_dinh: record.appraisalDate || record.assignedDate || null,
    dang_thuc_hien: record.assignedDate || record.completedWorkDate || null,
    phieu_chuyen_thue: record.taxFormDate || null,
    thue_kv7: record.taxKV7TransferDate || null,
    thong_bao_thue: record.taxNoticeDate || record.taxPaymentReceiptDate || null,
    in_gcn: record.printDate || null,
    trinh_kiem_tra: record.pendingCheckDate || record.checkedDate || null,
    trinh_ky: record.submissionDate || record.approvalDate || null,
    hoan_thanh: record.completedDate || record.exportDate || null,
    tra_ket_qua: record.resultReturnedDate || record.deliveryDate || record.data?.hen_tra || null,
  };

  // Only take active steps configured in the procedure workflow SLA
  const rawSteps = workflow.steps || [];
  const steps = rawSteps.filter(s => s.active !== false);
  const results: StepDeadlineInfo[] = [];

  const currentStepIdx = steps.findIndex(s => s.stepCode === currentStepCode);
  const effectiveCurrentIdx = currentStepIdx >= 0 ? currentStepIdx : 0;

  let previousStepEndDate: Date | null = record.receivedDate ? new Date(record.receivedDate) : (record.ngay_thang ? new Date(record.ngay_thang) : new Date());

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const recordedDateStr = dateMap[step.stepCode] || null;
    const isCurrent = i === effectiveCurrentIdx;
    const isPast = i < effectiveCurrentIdx;

    // Xác định ngày bắt đầu của bước
    let stepStartDate: Date | null = null;
    if (recordedDateStr) {
      stepStartDate = new Date(recordedDateStr);
    } else if (i === 0 && (record.receivedDate || record.ngay_thang)) {
      stepStartDate = new Date(record.receivedDate || record.ngay_thang);
    } else if (previousStepEndDate) {
      stepStartDate = new Date(previousStepEndDate);
    }

    // Tính Deadline cho bước
    let stepDeadlineDate: Date | null = null;
    if (stepStartDate && !isNaN(stepStartDate.getTime())) {
      stepDeadlineDate = addWorkingHours(stepStartDate, step.slaHours || 8);
    }

    // Xác định hoàn thành bước
    const nextStepCode = steps[i + 1]?.stepCode;
    const nextRecordedDateStr = nextStepCode ? dateMap[nextStepCode] : null;
    const isCompleted = isPast || (!isCurrent && (!!nextRecordedDateStr || (!!recordedDateStr && i < effectiveCurrentIdx)));

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
 * Checks if a record is overdue at its CURRENT step.
 */
export function isDangKyStepOverdue(record: any): boolean {
  if (!record || ['Đã giao 1 cửa', 'Đã trả kết quả', 'CSD rút HS', 'Trả hủy hồ sơ', RecordStatus.RETURNED, RecordStatus.REJECTED, RecordStatus.WITHDRAWN].includes(record.status)) {
    return false;
  }
  const stepDeadlines = calculateRecordStepDeadlines(record);
  const currentStep = stepDeadlines.find(s => s.isCurrentStep);
  if (!currentStep || currentStep.excludeFromTotalSla) return false;
  return currentStep.slaStatus.status === 'overdue';
}

/**
 * Checks if a record is approaching deadline at its CURRENT step.
 */
export function isDangKyStepApproaching(record: any): boolean {
  if (!record || ['Đã giao 1 cửa', 'Đã trả kết quả', 'CSD rút HS', 'Trả hủy hồ sơ', RecordStatus.RETURNED, RecordStatus.REJECTED, RecordStatus.WITHDRAWN].includes(record.status)) {
    return false;
  }
  const stepDeadlines = calculateRecordStepDeadlines(record);
  const currentStep = stepDeadlines.find(s => s.isCurrentStep);
  if (!currentStep || currentStep.excludeFromTotalSla) return false;
  return currentStep.slaStatus.status === 'warning';
}

