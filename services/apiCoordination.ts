import { DepartmentConfig, CoordinationWorkflow, CoordinationWorkflowStep, CoordinationStepLog, RecordFile, DangKyRecord } from '../types';
import { updateRecordApi } from './api';
import { saveDangKyRecordApi } from './apiDangKy';

const DEPARTMENTS_STORAGE_KEY = 'APP_COORDINATION_DEPARTMENTS_V1';
const WORKFLOWS_STORAGE_KEY = 'APP_COORDINATION_WORKFLOWS_V1';

// Danh sách các tổ chuyên môn mặc định
export const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [
  {
    id: 'dept_dodac',
    code: 'DODAC',
    name: 'Tổ Đo đạc',
    leaderName: 'Nguyễn Văn Đo',
    contactPhone: '0901234567',
    description: 'Thực hiện công tác đo vẽ hiện trạng, trích đo địa chính, cắm mốc ranh giới và xác minh thực địa thửa đất.',
    active: true,
    memberCount: 12,
    createdAt: new Date().toISOString()
  },
  {
    id: 'dept_capgiay',
    code: 'CAPGIAY',
    name: 'Tổ Cấp giấy',
    leaderName: 'Trần Thị Giấy',
    contactPhone: '0912345678',
    description: 'Thẩm định điều kiện cấp GCN, luân chuyển phiếu chuyển thuế, in phôi GCN và trình lãnh đạo ký duyệt.',
    active: true,
    memberCount: 15,
    createdAt: new Date().toISOString()
  },
  {
    id: 'dept_luutru',
    code: 'LUUTRU',
    name: 'Tổ Lưu trữ',
    leaderName: 'Lê Văn Lưu',
    contactPhone: '0923456789',
    description: 'Quản lý, tra cứu, trích lục hồ sơ địa chính gốc, bản đồ giải thửa và lưu trữ hồ sơ đã hoàn thành.',
    active: true,
    memberCount: 8,
    createdAt: new Date().toISOString()
  },
  {
    id: 'dept_hanhchinh',
    code: 'HANHCHINH',
    name: 'Tổ Hành chính',
    leaderName: 'Phạm Thị Hành',
    contactPhone: '0934567890',
    description: 'Bộ phận một cửa, tiếp nhận hồ sơ đầu vào, trả kết quả và quản lý văn thư hành chính.',
    active: true,
    memberCount: 6,
    createdAt: new Date().toISOString()
  }
];

// Danh sách quy trình phối hợp liên tổ mặc định
export const DEFAULT_COORDINATION_WORKFLOWS: CoordinationWorkflow[] = [
  {
    id: 'wf_dodac_capgiay',
    code: 'WF_DODAC_CAPGIAY',
    name: 'Quy trình Đo đạc & Xác minh hiện trạng cấp GCN',
    sourceDept: 'Tổ Cấp giấy',
    targetDept: 'Tổ Đo đạc',
    description: 'Chuyển hồ sơ sang Tổ Đo đạc để kiểm tra hiện trạng, xác minh ranh giới thửa đất trước khi cấp GCN.',
    autoReturnToOrigin: true,
    targetStatusOnReturn: 'Đang thực hiện (Tiếp tục xử lý cấp GCN)',
    notifyOnReturn: true,
    active: true,
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 'step_dodac_1',
        name: 'Tiếp nhận yêu cầu & Phân công nội bộ',
        type: 'reception',
        responsibleDept: 'Tổ Đo đạc',
        slaHours: 4,
        slaDisplay: '4 giờ',
        order: 1,
        requireDocs: false,
        allowRejection: true,
        description: 'Tổ trưởng tiếp nhận hồ sơ phối hợp và phân công cán bộ kỹ thuật đo đạc phụ trách.',
        active: true
      },
      {
        id: 'step_dodac_2',
        name: 'Đo đạc & Xác minh hiện trạng thực địa',
        type: 'verification',
        responsibleDept: 'Tổ Đo đạc',
        slaHours: 24,
        slaDisplay: '3 ngày',
        order: 2,
        requireDocs: true,
        docDescription: 'Bản vẽ trích đo địa chính / Biên bản kiểm tra hiện trạng',
        allowRejection: false,
        description: 'Cán bộ kỹ thuật tiến hành đo đạc thực tế, xác minh ranh giới, diện tích thửa đất.',
        active: true
      },
      {
        id: 'step_dodac_3',
        name: 'Kiểm tra kỹ thuật chuyên môn',
        type: 'inspection',
        responsibleDept: 'Tổ Đo đạc',
        slaHours: 8,
        slaDisplay: '1 ngày',
        order: 3,
        requireDocs: false,
        allowRejection: true,
        description: 'Kiểm tra sai số, đối chiếu với cơ sở dữ liệu bản đồ địa chính.',
        active: true
      },
      {
        id: 'step_dodac_4',
        name: 'Trình ký & Phê duyệt kết quả đo vẽ',
        type: 'signing',
        responsibleDept: 'Tổ Đo đạc',
        slaHours: 8,
        slaDisplay: '1 ngày',
        order: 4,
        requireDocs: true,
        docDescription: 'Bản vẽ trích đo đã ký duyệt / Phiếu kết quả kiểm tra',
        allowRejection: true,
        description: 'Tổ trưởng/Lãnh đạo ký duyệt bản vẽ trích đo và biên bản xác minh.',
        active: true
      },
      {
        id: 'step_dodac_5',
        name: 'Tự động bàn giao & Chuyển trả về Tổ ban đầu',
        type: 'handover',
        responsibleDept: 'Tổ Cấp giấy',
        slaHours: 4,
        slaDisplay: '4 giờ',
        order: 5,
        requireDocs: false,
        allowRejection: false,
        description: 'Hệ thống tự động chuyển hồ sơ và kết quả phối hợp về Tổ Cấp giấy để tiếp tục quy trình.',
        active: true
      }
    ]
  },
  {
    id: 'wf_luutru_trichluc',
    code: 'WF_LUUTRU_TRICHLUC',
    name: 'Quy trình Tra cứu & Trích lục hồ sơ gốc',
    sourceDept: 'Tổ Cấp giấy',
    targetDept: 'Tổ Lưu trữ',
    description: 'Phối hợp với Tổ Lưu trữ để tra cứu hồ sơ địa chính gốc, hồ sơ cấp GCN các thời kỳ trước.',
    autoReturnToOrigin: true,
    targetStatusOnReturn: 'Đang thực hiện',
    notifyOnReturn: true,
    active: true,
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 'step_luutru_1',
        name: 'Tiếp nhận phiếu yêu cầu tra cứu',
        type: 'reception',
        responsibleDept: 'Tổ Lưu trữ',
        slaHours: 4,
        slaDisplay: '4 giờ',
        order: 1,
        requireDocs: false,
        allowRejection: true,
        description: 'Tiếp nhận thông tin số tờ, số thửa, chủ sử dụng cần tra cứu.',
        active: true
      },
      {
        id: 'step_luutru_2',
        name: 'Tra cứu & Xác minh hồ sơ địa chính gốc',
        type: 'verification',
        responsibleDept: 'Tổ Lưu trữ',
        slaHours: 16,
        slaDisplay: '2 ngày',
        order: 2,
        requireDocs: true,
        docDescription: 'Bản scan/photocopy hồ sơ địa chính gốc hoặc sổ mục kê, sổ cấp GCN',
        allowRejection: false,
        description: 'Tra cứu tài liệu lưu trữ, lập phiếu sao lục hồ sơ địa chính.',
        active: true
      },
      {
        id: 'step_luutru_3',
        name: 'Kiểm tra & Thẩm định tính pháp lý tài liệu',
        type: 'inspection',
        responsibleDept: 'Tổ Lưu trữ',
        slaHours: 8,
        slaDisplay: '1 ngày',
        order: 3,
        requireDocs: false,
        allowRejection: true,
        description: 'Đối soát các biến động, thế chấp, ngăn chặn nếu có.',
        active: true
      },
      {
        id: 'step_luutru_4',
        name: 'Trình ký xác nhận trích lục / sao lục',
        type: 'signing',
        responsibleDept: 'Tổ Lưu trữ',
        slaHours: 4,
        slaDisplay: '4 giờ',
        order: 4,
        requireDocs: true,
        docDescription: 'Phiếu cung cấp thông tin/trích lục có ký xác nhận',
        allowRejection: true,
        description: 'Tổ trưởng Tổ Lưu trữ ký xác nhận kết quả tra cứu.',
        active: true
      },
      {
        id: 'step_luutru_5',
        name: 'Tự động chuyển trả kết quả về Tổ ban đầu',
        type: 'handover',
        responsibleDept: 'Tổ Cấp giấy',
        slaHours: 4,
        slaDisplay: '4 giờ',
        order: 5,
        requireDocs: false,
        allowRejection: false,
        description: 'Tự động hoàn thành và trả kết quả về tổ ban đầu tiếp tục thụ lý.',
        active: true
      }
    ]
  },
  {
    id: 'wf_vuongmac_bando',
    code: 'WF_VUONGMAC_BANDO',
    name: 'Quy trình Xử lý vướng mắc quy hoạch & Bản đồ địa chính',
    sourceDept: 'Tổ Cấp giấy',
    targetDept: 'Tổ Đo đạc',
    description: 'Phối hợp xử lý trường hợp chồng lấn ranh giới, sai lệch diện tích giữa bản đồ và thực địa.',
    autoReturnToOrigin: true,
    targetStatusOnReturn: 'Đang thực hiện',
    notifyOnReturn: true,
    active: true,
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 'step_vuongmac_1',
        name: 'Tiếp nhận & Thẩm định nội dung vướng mắc',
        type: 'reception',
        responsibleDept: 'Tổ Đo đạc',
        slaHours: 8,
        slaDisplay: '1 ngày',
        order: 1,
        requireDocs: false,
        allowRejection: true,
        description: 'Phân tích nguyên nhân chênh lệch ranh giới hoặc chồng ghép bản đồ.',
        active: true
      },
      {
        id: 'step_vuongmac_2',
        name: 'Kiểm tra đối chiếu hiện trường & Hồ sơ kỹ thuật',
        type: 'inspection',
        responsibleDept: 'Tổ Đo đạc',
        slaHours: 16,
        slaDisplay: '2 ngày',
        order: 2,
        requireDocs: true,
        docDescription: 'Biên bản làm việc với các bên liên quan / Kết quả đo kiểm',
        allowRejection: false,
        description: 'Cán bộ kỹ thuật kiểm tra hiện trường, lập biên bản đối chiếu ranh giới.',
        active: true
      },
      {
        id: 'step_vuongmac_3',
        name: 'Lập Biên bản giải trình & Phương án xử lý',
        type: 'verification',
        responsibleDept: 'Tổ Đo đạc',
        slaHours: 16,
        slaDisplay: '2 ngày',
        order: 3,
        requireDocs: true,
        docDescription: 'Văn bản đề xuất phương án xử lý chỉnh lý bản đồ',
        allowRejection: true,
        description: 'Đề xuất giải pháp chỉnh lý hoặc điều chỉnh diện tích phù hợp quy định.',
        active: true
      },
      {
        id: 'step_vuongmac_4',
        name: 'Trình lãnh đạo phê duyệt phương án',
        type: 'signing',
        responsibleDept: 'Tổ Đo đạc',
        slaHours: 8,
        slaDisplay: '1 ngày',
        order: 4,
        requireDocs: true,
        docDescription: 'Phiếu duyệt phương án của Lãnh đạo',
        allowRejection: true,
        description: 'Lãnh đạo Chi nhánh / Tổ trưởng ký phê duyệt phương án giải quyết.',
        active: true
      },
      {
        id: 'step_vuongmac_5',
        name: 'Tự động hoàn thành & Chuyển trả về Tổ ban đầu',
        type: 'handover',
        responsibleDept: 'Tổ Cấp giấy',
        slaHours: 4,
        slaDisplay: '4 giờ',
        order: 5,
        requireDocs: false,
        allowRejection: false,
        description: 'Hệ thống tự động chuyển hồ sơ về tổ xuất phát để tiếp tục trình phê duyệt.',
        active: true
      }
    ]
  }
];

// --- CÁC HÀM QUẢN LÝ TỔ CHUYÊN MÔN ---

export function getDepartmentConfigs(): DepartmentConfig[] {
  try {
    const raw = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(DEFAULT_DEPARTMENTS));
      return DEFAULT_DEPARTMENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_DEPARTMENTS;
  } catch (e) {
    console.error('Failed to load department configs:', e);
    return DEFAULT_DEPARTMENTS;
  }
}

export function saveDepartmentConfig(dept: DepartmentConfig): boolean {
  try {
    const list = getDepartmentConfigs();
    const existingIndex = list.findIndex(d => d.id === dept.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...dept, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...dept, createdAt: new Date().toISOString() });
    }
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Failed to save department config:', e);
    return false;
  }
}

export function deleteDepartmentConfig(id: string): boolean {
  try {
    const list = getDepartmentConfigs();
    const filtered = list.filter(d => d.id !== id);
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error('Failed to delete department config:', e);
    return false;
  }
}

export function resetDepartmentsToDefault(): DepartmentConfig[] {
  try {
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(DEFAULT_DEPARTMENTS));
    return DEFAULT_DEPARTMENTS;
  } catch (e) {
    return DEFAULT_DEPARTMENTS;
  }
}

// --- CÁC HÀM QUẢN LÝ QUY TRÌNH PHỐI HỢP ---

export function getCoordinationWorkflows(): CoordinationWorkflow[] {
  try {
    const raw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(DEFAULT_COORDINATION_WORKFLOWS));
      return DEFAULT_COORDINATION_WORKFLOWS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_COORDINATION_WORKFLOWS;
  } catch (e) {
    console.error('Failed to load coordination workflows:', e);
    return DEFAULT_COORDINATION_WORKFLOWS;
  }
}

export function getCoordinationWorkflowById(id: string): CoordinationWorkflow | undefined {
  const list = getCoordinationWorkflows();
  return list.find(w => w.id === id);
}

export function saveCoordinationWorkflow(wf: CoordinationWorkflow): boolean {
  try {
    const list = getCoordinationWorkflows();
    const existingIndex = list.findIndex(w => w.id === wf.id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...wf, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...wf, createdAt: new Date().toISOString() });
    }
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('Failed to save coordination workflow:', e);
    return false;
  }
}

export function deleteCoordinationWorkflow(id: string): boolean {
  try {
    const list = getCoordinationWorkflows();
    const filtered = list.filter(w => w.id !== id);
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error('Failed to delete coordination workflow:', e);
    return false;
  }
}

export function resetCoordinationWorkflowsToDefault(): CoordinationWorkflow[] {
  try {
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(DEFAULT_COORDINATION_WORKFLOWS));
    return DEFAULT_COORDINATION_WORKFLOWS;
  } catch (e) {
    return DEFAULT_COORDINATION_WORKFLOWS;
  }
}

// --- ENGINE TỰ ĐỘNG HÓA CHUYỂN BƯỚC & TỰ ĐỘNG CHUYỂN TRẢ VỀ TỔ BAN ĐẦU ---

export interface StartCoordinationParams {
  workflowId?: string;
  sourceDept: string;
  targetDept: string;
  notes: string;
  user: { name: string; username?: string; role?: string };
}

export async function executeStartCoordination(
  record: RecordFile | DangKyRecord,
  params: StartCoordinationParams
): Promise<{ success: boolean; record: any; message: string }> {
  try {
    const workflows = getCoordinationWorkflows();
    const matchedWf = params.workflowId 
      ? workflows.find(w => w.id === params.workflowId) 
      : workflows.find(w => w.sourceDept === params.sourceDept && w.targetDept === params.targetDept && w.active);

    const nowStr = new Date().toLocaleString('vi-VN');
    const firstStep = matchedWf?.steps?.[0];
    
    const initialLog: CoordinationStepLog = {
      id: `log_${Date.now()}`,
      stepId: firstStep?.id || 'step_init',
      stepName: firstStep?.name || 'Khởi tạo phối hợp liên tổ',
      stepType: firstStep?.type || 'reception',
      performer: params.user.name,
      dept: params.sourceDept,
      completedAt: nowStr,
      note: `Bàn giao sang ${params.targetDept}: ${params.notes}`,
      status: 'in_progress'
    };

    const logMsg = `[Phối hợp liên tổ] ${params.sourceDept} chuyển phối hợp sang ${params.targetDept} bởi ${params.user.name} lúc ${nowStr}.${matchedWf ? ` Quy trình: ${matchedWf.name}.` : ''} Yêu cầu: ${params.notes}`;
    const newPrivateNotes = record.privateNotes ? `${record.privateNotes}\n${logMsg}` : logMsg;

    const updatedRecord: any = {
      ...record,
      originalDept: record.originalDept || params.sourceDept,
      coordinationDept: params.targetDept,
      coordinationWorkflowId: matchedWf?.id || null,
      coordinationStatus: 'in_progress',
      coordinationCurrentStepId: firstStep?.id || null,
      coordinationCurrentStepIndex: 0,
      coordinationNotes: params.notes,
      coordinationStepLogs: [initialLog],
      privateNotes: newPrivateNotes
    };

    // Update in database / backend
    if ('sourceTable' in record && record.sourceTable === 'dangky_records') {
      await saveDangKyRecordApi(updatedRecord as DangKyRecord);
    } else {
      await updateRecordApi(updatedRecord as RecordFile);
    }

    return {
      success: true,
      record: updatedRecord,
      message: `Đã chuyển phối hợp sang ${params.targetDept} thành công!`
    };
  } catch (e: any) {
    console.error('Error starting coordination:', e);
    return {
      success: false,
      record,
      message: e.message || 'Lỗi khi khởi tạo phối hợp liên tổ.'
    };
  }
}

export interface AdvanceCoordinationParams {
  nextStepIndex: number;
  note?: string;
  attachedDocs?: string[];
  user: { name: string; username?: string; role?: string };
}

export async function executeAdvanceCoordinationStep(
  record: RecordFile | DangKyRecord,
  params: AdvanceCoordinationParams
): Promise<{ success: boolean; record: any; isAutoReturned: boolean; message: string }> {
  try {
    const workflows = getCoordinationWorkflows();
    const wf = workflows.find(w => w.id === record.coordinationWorkflowId);
    const steps = wf?.steps || [];
    const currentStepIndex = record.coordinationCurrentStepIndex ?? 0;
    const currentStep = steps[currentStepIndex];
    const nextStep = steps[params.nextStepIndex];
    const nowStr = new Date().toLocaleString('vi-VN');

    // Create log for completed step
    const completedLog: CoordinationStepLog = {
      id: `log_${Date.now()}`,
      stepId: currentStep?.id || `step_${currentStepIndex}`,
      stepName: currentStep?.name || `Bước ${currentStepIndex + 1}`,
      stepType: currentStep?.type || 'verification',
      performer: params.user.name,
      dept: record.coordinationDept || 'Tổ phối hợp',
      completedAt: nowStr,
      note: params.note || 'Hoàn tất bước',
      status: 'completed',
      docs: params.attachedDocs
    };

    const stepLogs = [...(record.coordinationStepLogs || []), completedLog];
    const isFinalStep = params.nextStepIndex >= steps.length || (nextStep && nextStep.type === 'handover');
    const shouldAutoReturn = (wf?.autoReturnToOrigin ?? true) && (isFinalStep || params.nextStepIndex >= steps.length - 1);

    if (shouldAutoReturn || isFinalStep) {
      // LUỒNG TỰ ĐỘNG CHUYỂN HỒ SƠ VỀ TỔ BAN ĐẦU
      const origDept = record.originalDept || 'Tổ ban đầu';
      const logMsg = `[Tự động chuyển trả] ${record.coordinationDept || 'Tổ phối hợp'} đã hoàn tất quy trình phối hợp (${wf?.name || 'Quy trình liên tổ'}) và tự động chuyển trả hồ sơ về ${origDept} bởi ${params.user.name} lúc ${nowStr}.${params.note ? ` Ghi chú: ${params.note}` : ''}`;
      const newPrivateNotes = record.privateNotes ? `${record.privateNotes}\n${logMsg}` : logMsg;

      const finalHandoverLog: CoordinationStepLog = {
        id: `log_${Date.now() + 1}`,
        stepId: 'step_auto_return',
        stepName: 'Tự động bàn giao & Chuyển trả về Tổ ban đầu',
        stepType: 'handover',
        performer: 'Hệ thống tự động',
        dept: origDept,
        completedAt: nowStr,
        note: `Đã hoàn tất phối hợp, bàn giao trả về ${origDept}`,
        status: 'completed'
      };

      const updatedRecord: any = {
        ...record,
        coordinationStatus: 'completed',
        coordinationDept: null, // Xóa gán tạm để trả quyền về tổ ban đầu
        coordinationCurrentStepId: null,
        coordinationCurrentStepIndex: steps.length,
        coordinationStepLogs: [...stepLogs, finalHandoverLog],
        privateNotes: newPrivateNotes
      };

      if ('sourceTable' in record && record.sourceTable === 'dangky_records') {
        await saveDangKyRecordApi(updatedRecord as DangKyRecord);
      } else {
        await updateRecordApi(updatedRecord as RecordFile);
      }

      return {
        success: true,
        record: updatedRecord,
        isAutoReturned: true,
        message: `Quy trình phối hợp hoàn tất! Hệ thống đã tự động chuyển trả hồ sơ về ${origDept}.`
      };
    } else {
      // CHUYỂN SANG BƯỚC TIẾP THEO TRONG TỔ PHỐI HỢP
      const logMsg = `[Tiến độ phối hợp] Đã hoàn thành bước "${currentStep?.name || `Bước ${currentStepIndex + 1}`}" và chuyển sang bước "${nextStep?.name || `Bước ${params.nextStepIndex + 1}`}" bởi ${params.user.name} lúc ${nowStr}.${params.note ? ` Ghi chú: ${params.note}` : ''}`;
      const newPrivateNotes = record.privateNotes ? `${record.privateNotes}\n${logMsg}` : logMsg;

      const updatedRecord: any = {
        ...record,
        coordinationCurrentStepId: nextStep?.id || null,
        coordinationCurrentStepIndex: params.nextStepIndex,
        coordinationStepLogs: stepLogs,
        privateNotes: newPrivateNotes
      };

      if ('sourceTable' in record && record.sourceTable === 'dangky_records') {
        await saveDangKyRecordApi(updatedRecord as DangKyRecord);
      } else {
        await updateRecordApi(updatedRecord as RecordFile);
      }

      return {
        success: true,
        record: updatedRecord,
        isAutoReturned: false,
        message: `Đã hoàn tất bước và chuyển sang: ${nextStep?.name || `Bước ${params.nextStepIndex + 1}`}!`
      };
    }
  } catch (e: any) {
    console.error('Error advancing coordination step:', e);
    return {
      success: false,
      record,
      isAutoReturned: false,
      message: e.message || 'Có lỗi xảy ra khi chuyển bước.'
    };
  }
}
