import { WorkflowStep, ProcedureWorkflow } from '../types';
import { PROCEDURE_CATALOG, detectProcedureId, isArchiveRecordType } from '../constants/procedures';

const STORAGE_KEY = 'APP_PROCEDURE_WORKFLOWS_V1';

export const STANDARD_STEPS_TEMPLATE = {
  LUU_TRU: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'dang_thuc_hien', stepName: 'Đang thực hiện', slaHours: 56, slaDisplay: '7 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DO_DAC_2_1: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'dang_thuc_hien', stepName: 'Đang thực hiện', slaHours: 48, slaDisplay: '6 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DO_DAC_2_2: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'dang_thuc_hien', stepName: 'Đang thực hiện', slaHours: 208, slaDisplay: '26 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DO_DAC_2_3: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'dang_thuc_hien', stepName: 'Đang thực hiện', slaHours: 72, slaDisplay: '9 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_8_2: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 2, slaDisplay: '2 giờ', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định & Ký duyệt', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 2, slaDisplay: '2 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_8_1: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_6_1: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 16, slaDisplay: '2 ngày', excludeFromTotalSla: false },
    { stepCode: 'phieu_chuyen_thue', stepName: 'Phiếu chuyển thuế', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'thue_kv7', stepName: 'Thuế KV7', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: true },
    { stepCode: 'thong_bao_thue', stepName: 'Thông báo thuế', slaHours: 40, slaDisplay: '5 ngày', excludeFromTotalSla: true },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_7: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 24, slaDisplay: '3 ngày', excludeFromTotalSla: false },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_2_1_3_3_1: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 40, slaDisplay: '5 ngày', excludeFromTotalSla: false },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_5_1: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 56, slaDisplay: '7 ngày', excludeFromTotalSla: false },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_1: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 40, slaDisplay: '5 ngày', excludeFromTotalSla: false },
    { stepCode: 'phieu_chuyen_thue', stepName: 'Phiếu chuyển thuế', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'thue_kv7', stepName: 'Thuế KV7', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: true },
    { stepCode: 'thong_bao_thue', stepName: 'Thông báo thuế', slaHours: 40, slaDisplay: '5 ngày', excludeFromTotalSla: true },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_2_2_3_3_2: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 48, slaDisplay: '6 ngày', excludeFromTotalSla: false },
    { stepCode: 'phieu_chuyen_thue', stepName: 'Phiếu chuyển thuế', slaHours: 16, slaDisplay: '2 ngày', excludeFromTotalSla: false },
    { stepCode: 'thue_kv7', stepName: 'Thuế KV7', slaHours: 16, slaDisplay: '2 ngày', excludeFromTotalSla: true },
    { stepCode: 'thong_bao_thue', stepName: 'Thông báo thuế', slaHours: 40, slaDisplay: '5 ngày', excludeFromTotalSla: true },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_4_1: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 80, slaDisplay: '10 ngày', excludeFromTotalSla: false },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 24, slaDisplay: '3 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_3_4_2: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 56, slaDisplay: '7 ngày', excludeFromTotalSla: false },
    { stepCode: 'phieu_chuyen_thue', stepName: 'Phiếu chuyển thuế', slaHours: 16, slaDisplay: '2 ngày', excludeFromTotalSla: false },
    { stepCode: 'thue_kv7', stepName: 'Thuế KV7', slaHours: 16, slaDisplay: '2 ngày', excludeFromTotalSla: true },
    { stepCode: 'thong_bao_thue', stepName: 'Thông báo thuế', slaHours: 40, slaDisplay: '5 ngày', excludeFromTotalSla: true },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 20, slaDisplay: '2.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 12, slaDisplay: '1.5 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
  DANG_KY_DEFAULT_TAX: [
    { stepCode: 'tiep_nhan', stepName: 'Tiếp nhận mới', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tham_dinh', stepName: 'Thẩm định hồ sơ', slaHours: 16, slaDisplay: '2 ngày', excludeFromTotalSla: false },
    { stepCode: 'phieu_chuyen_thue', stepName: 'Phiếu chuyển thuế', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'thue_kv7', stepName: 'Thuế KV7', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: true },
    { stepCode: 'thong_bao_thue', stepName: 'Thông báo thuế', slaHours: 40, slaDisplay: '5 ngày', excludeFromTotalSla: true },
    { stepCode: 'in_gcn', stepName: 'In Giấy chứng nhận', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_kiem_tra', stepName: 'Trình kiểm tra', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'trinh_ky', stepName: 'Trình ký duyệt', slaHours: 8, slaDisplay: '1 ngày', excludeFromTotalSla: false },
    { stepCode: 'hoan_thanh', stepName: 'Hoàn thành', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: false },
    { stepCode: 'tra_ket_qua', stepName: 'Trả kết quả', slaHours: 4, slaDisplay: '4 giờ', excludeFromTotalSla: true },
  ],
};

// Determine if a procedure needs tax steps by default
export function procedureNeedsTax(procId?: string | null): boolean {
  if (!procId) return true;
  // Procedures with tax: 3.1.1, 3.1.2, 3.1.3, 3.2.2, 3.3.2, 3.4.2, 3.6.1
  const taxProcs = ['3.1.1', '3.1.2', '3.1.3', '3.2.2', '3.3.2', '3.4.2', '3.6.1'];
  return taxProcs.includes(procId);
}

export function getDefaultStepsForProcedure(procId: string): Partial<WorkflowStep>[] {
  if (procId.startsWith('1.')) {
    return STANDARD_STEPS_TEMPLATE.LUU_TRU;
  }
  if (procId.startsWith('2.')) {
    if (procId === '2.1' || procId.startsWith('2.1.')) {
      return STANDARD_STEPS_TEMPLATE.DO_DAC_2_1;
    }
    if (procId === '2.3' || procId.startsWith('2.3.')) {
      return STANDARD_STEPS_TEMPLATE.DO_DAC_2_3;
    }
    return STANDARD_STEPS_TEMPLATE.DO_DAC_2_2;
  }

  // Registration Module 3
  if (procId === '3.8.2') return STANDARD_STEPS_TEMPLATE.DANG_KY_3_8_2;
  if (procId === '3.8.1') return STANDARD_STEPS_TEMPLATE.DANG_KY_3_8_1;
  if (procId === '3.6.1') return STANDARD_STEPS_TEMPLATE.DANG_KY_3_6_1;
  if (procId === '3.7.1' || procId === '3.7.2' || procId.startsWith('3.7.')) return STANDARD_STEPS_TEMPLATE.DANG_KY_3_7;
  if (procId === '3.2.1' || procId === '3.3.1') return STANDARD_STEPS_TEMPLATE.DANG_KY_3_2_1_3_3_1;
  if (procId === '3.5.1') return STANDARD_STEPS_TEMPLATE.DANG_KY_3_5_1;
  if (procId === '3.1.1' || procId === '3.1.2' || procId === '3.1.3' || procId.startsWith('3.1.')) return STANDARD_STEPS_TEMPLATE.DANG_KY_3_1;
  if (procId === '3.2.2' || procId === '3.3.2') return STANDARD_STEPS_TEMPLATE.DANG_KY_3_2_2_3_3_2;
  if (procId === '3.4.1') return STANDARD_STEPS_TEMPLATE.DANG_KY_3_4_1;
  if (procId === '3.4.2') return STANDARD_STEPS_TEMPLATE.DANG_KY_3_4_2;

  const needsTax = procedureNeedsTax(procId);
  return needsTax ? STANDARD_STEPS_TEMPLATE.DANG_KY_DEFAULT_TAX : STANDARD_STEPS_TEMPLATE.DANG_KY_3_2_1_3_3_1;
}

export function getAllProcedureWorkflows(): Record<string, ProcedureWorkflow> {
  const map: Record<string, ProcedureWorkflow> = {};
  
  // Load saved overrides from localStorage
  let saved: Record<string, ProcedureWorkflow> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading workflows:', e);
  }

  PROCEDURE_CATALOG.forEach(proc => {
    if (saved[proc.id]) {
      map[proc.id] = saved[proc.id];
    } else {
      const defaultRawSteps = getDefaultStepsForProcedure(proc.id);
      const steps: WorkflowStep[] = defaultRawSteps.map((s, index) => ({
        id: `${proc.id}-step-${index + 1}`,
        procedureId: proc.id,
        stepCode: s.stepCode || `step_${index + 1}`,
        stepName: s.stepName || `Bước ${index + 1}`,
        order: index + 1,
        slaHours: s.slaHours ?? 8,
        slaDisplay: s.slaDisplay || '1 ngày',
        excludeFromTotalSla: !!s.excludeFromTotalSla,
        active: true
      }));
      map[proc.id] = {
        procedureId: proc.id,
        procedureName: proc.name,
        steps
      };
    }
  });

  return map;
}

export function getProcedureWorkflow(procedureId?: string | null): ProcedureWorkflow {
  const all = getAllProcedureWorkflows();
  if (procedureId && all[procedureId]) {
    return all[procedureId];
  }
  // Fallback to first available or default full tax workflow
  const firstKey = Object.keys(all)[0];
  if (firstKey && all[firstKey]) return all[firstKey];

  return {
    procedureId: procedureId || '3.1.1',
    procedureName: 'Thủ tục đăng ký',
    steps: STANDARD_STEPS_TEMPLATE.DANG_KY_DEFAULT_TAX.map((s, idx) => ({
      id: `default-${idx + 1}`,
      procedureId: procedureId || '3.1.1',
      stepCode: s.stepCode,
      stepName: s.stepName,
      order: idx + 1,
      slaHours: s.slaHours,
      slaDisplay: s.slaDisplay,
      excludeFromTotalSla: s.excludeFromTotalSla,
      active: true
    }))
  };
}

export function saveProcedureWorkflow(workflow: ProcedureWorkflow): boolean {
  try {
    const all = getAllProcedureWorkflows();
    all[workflow.procedureId] = workflow;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    
    // Dispatch event to synchronize timeline modals & views across the app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workflow_config_updated', { 
        detail: { procedureId: workflow.procedureId, workflow } 
      }));
    }
    return true;
  } catch (e) {
    console.error('Error saving workflow:', e);
    return false;
  }
}

export function resetProcedureWorkflowToDefault(procedureId: string): ProcedureWorkflow {
  try {
    const all = getAllProcedureWorkflows();
    const proc = PROCEDURE_CATALOG.find(p => p.id === procedureId);
    const defaultRawSteps = getDefaultStepsForProcedure(procedureId);
    const steps: WorkflowStep[] = defaultRawSteps.map((s, index) => ({
      id: `${procedureId}-step-${index + 1}`,
      procedureId: procedureId,
      stepCode: s.stepCode || `step_${index + 1}`,
      stepName: s.stepName || `Bước ${index + 1}`,
      order: index + 1,
      slaHours: s.slaHours ?? 8,
      slaDisplay: s.slaDisplay || '1 ngày',
      excludeFromTotalSla: !!s.excludeFromTotalSla,
      active: true
    }));
    const newWorkflow: ProcedureWorkflow = {
      procedureId,
      procedureName: proc ? proc.name : procedureId,
      steps
    };
    all[procedureId] = newWorkflow;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    // Dispatch event to synchronize timeline modals & views across the app
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('workflow_config_updated', { 
        detail: { procedureId, workflow: newWorkflow } 
      }));
    }
    return newWorkflow;
  } catch (e) {
    console.error('Error resetting workflow:', e);
    return getProcedureWorkflow(procedureId);
  }
}

/**
 * Checks if a specific step (e.g. 'trinh_kiem_tra') is configured and active in the procedure SLA workflow.
 */
export function procedureHasStep(recordOrTypeOrProcId: any, stepCode: string = 'trinh_kiem_tra'): boolean {
  if (!recordOrTypeOrProcId) return false;

  let procId: string = '';
  if (typeof recordOrTypeOrProcId === 'string') {
    const s = recordOrTypeOrProcId.trim();
    if (s.startsWith('1.') || s === '1.1' || s === '1.2' || isArchiveRecordType(s)) {
      procId = (s.includes('1.2') || s.toUpperCase().includes('CÔNG VĂN') || s.toUpperCase().startsWith('CV')) ? '1.2' : '1.1';
    } else {
      procId = detectProcedureId(s, s);
    }
  } else if (typeof recordOrTypeOrProcId === 'object') {
    const rec = recordOrTypeOrProcId;
    const codeStr = (rec.code || rec.so_hieu || '').trim();
    const typeStr = (rec.recordType || rec.type || '').trim();
    const sourceTable = rec.sourceTable || '';

    if (isArchiveRecordType(typeStr, codeStr) || sourceTable === 'luutru_records' || typeStr === 'saoluc' || typeStr === 'congvan') {
      procId = (typeStr.includes('Công văn') || typeStr === 'congvan' || codeStr.toUpperCase().startsWith('CV')) ? '1.2' : '1.1';
    } else {
      procId = detectProcedureId(codeStr, typeStr);
    }
  }

  if (!procId) procId = '1.1';

  const wf = getProcedureWorkflow(procId);
  if (!wf || !wf.steps || wf.steps.length === 0) {
    // If no custom workflow is found, fallback based on procedure prefix
    if (procId.startsWith('1.')) return false; // Archive default has no trinh_kiem_tra
    if (procId === '2.3' || procId === '3.8.1' || procId === '3.8.2') return false;
    return true;
  }

  return wf.steps.some(s => {
    if (s.active === false) return false;
    const c = (s.stepCode || '').toLowerCase();
    const n = (s.stepName || '').toLowerCase();
    if (stepCode === 'trinh_kiem_tra') {
      return c === 'trinh_kiem_tra' || c === 'kiem_tra' || n.includes('kiểm tra');
    }
    return c === stepCode.toLowerCase() || n.includes(stepCode.toLowerCase());
  });
}
