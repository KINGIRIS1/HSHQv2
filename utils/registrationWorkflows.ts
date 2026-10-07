import { RecordStatus, RecordFile } from '../types';
import { getShortRecordType, DEFAULT_HOLIDAYS, isArchiveRecordType, isSurveyRecordType } from '../constants';
import { parseSafeDate, formatDateKey } from './appHelpers';
import { getSystemSetting, saveSystemSetting } from '../services/apiSystem';

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
  isPaused?: boolean;
}

export interface RegistrationWorkflowConfig {
  category: RegistrationWorkflowCategory | string;
  title: string;
  subtitle: string;
  standardDays: number;
  steps: WorkflowStep[];
}

export interface CustomRegistrationProcedure {
  id: string;
  code: string;
  name: string;
  standardDays: number;
  description?: string;
  steps: WorkflowStep[];
  isActive?: boolean;
  updatedAt?: string;
}

export const DEFAULT_REGISTRATION_PROCEDURES: CustomRegistrationProcedure[] = [
  {
    id: 'proc_3_1_1',
    code: '3.1.1',
    name: '3.1.1 Chuyển quyền (Chuyển nhượng, Tặng cho, Thừa kế - Có thuế)',
    standardDays: 13,
    description: 'Quy trình giải quyết hồ sơ chuyển quyền sử dụng đất có phát sinh nghĩa vụ tài chính',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Bộ phận Tiếp nhận và Trả kết quả', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định', shortLabel: 'Thẩm định', description: 'Cán bộ thụ lý thẩm định hồ sơ', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.TAX_TRANSFER, label: 'Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', description: 'Lập phiếu chuyển thông tin nghĩa vụ tài chính', badgeColor: 'bg-indigo-100 text-indigo-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)', isTaxPhase: true },
      { key: RecordStatus.PENDING_TAX_KV7, label: 'Thuế Khu vực 7', shortLabel: 'Thuế KV7', description: 'Cơ quan Thuế xác định nghĩa vụ tài chính (5 ngày - Ngoài SLA)', badgeColor: 'bg-violet-100 text-violet-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Thông báo thuế', shortLabel: 'Thông báo thuế', description: 'Chờ người dân nộp thuế vào NSNN (Tạm dừng đếm giờ)', badgeColor: 'bg-amber-100 text-amber-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (40h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Tổ trưởng / Lãnh đạo phòng kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Trình Lãnh đạo Chi nhánh ký duyệt', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Vào sổ cấp GCN và chuyển Bộ phận Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Đã bàn giao và trả kết quả cho người dân (Tạm dừng / Hoàn thành)', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_1_2',
    code: '3.1.2',
    name: '3.1.2 Phân chia quyền sử dụng đất (Có thuế)',
    standardDays: 13,
    description: 'Quy trình phân chia quyền sử dụng đất của vợ chồng hoặc hộ gia đình',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Bộ phận Tiếp nhận và Trả kết quả', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định', shortLabel: 'Thẩm định', description: 'Kiểm tra văn bản phân chia tài sản và hồ sơ', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.TAX_TRANSFER, label: 'Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', description: 'Lập phiếu chuyển cơ quan thuế', badgeColor: 'bg-indigo-100 text-indigo-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)', isTaxPhase: true },
      { key: RecordStatus.PENDING_TAX_KV7, label: 'Thuế Khu vực 7', shortLabel: 'Thuế KV7', description: 'Cơ quan Thuế thụ lý (Ngoài SLA)', badgeColor: 'bg-violet-100 text-violet-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Thông báo thuế', shortLabel: 'Thông báo thuế', description: 'Chờ công dân hoàn thành nghĩa vụ tài chính', badgeColor: 'bg-amber-100 text-amber-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (40h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Lãnh đạo bộ phận kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Trình Lãnh đạo ký duyệt', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Vào sổ và chuyển Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Đã bàn giao và trả kết quả cho người dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_1_3',
    code: '3.1.3',
    name: '3.1.3 Theo Bản án / Quyết định của Tòa án / Thi hành án (Có thuế)',
    standardDays: 13,
    description: 'Quy trình đăng ký biến động đất đai theo Bản án, Quyết định giải quyết tranh chấp',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận hồ sơ và bản án/quy định', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định hồ sơ', shortLabel: 'Thẩm định', description: 'Đối chiếu bản án và hồ sơ địa chính gốc', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.TAX_TRANSFER, label: 'Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', description: 'Lập phiếu chuyển thông tin thuế', badgeColor: 'bg-indigo-100 text-indigo-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)', isTaxPhase: true },
      { key: RecordStatus.PENDING_TAX_KV7, label: 'Thuế Khu vực 7', shortLabel: 'Thuế KV7', description: 'Cơ quan Thuế xác định thuế (Ngoài SLA)', badgeColor: 'bg-violet-100 text-violet-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Thông báo thuế', shortLabel: 'Thông báo thuế', description: 'Chờ nộp tiền vào ngân sách nhà nước', badgeColor: 'bg-amber-100 text-amber-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (40h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Kiểm tra hồ sơ trước khi ký duyệt', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Lãnh đạo Chi nhánh ký duyệt', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật CSDL và chuyển Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Trả kết quả hoàn tất cho công dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_2_1',
    code: '3.2.1',
    name: '3.2.1 Cấp đổi Giấy chứng nhận (Không thuế)',
    standardDays: 5,
    description: 'Quy trình cấp đổi GCN do rách nát, ố nhòe hoặc đổi phôi mới không đổi ranh giới',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Bộ phận Tiếp nhận và Trả kết quả', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định', shortLabel: 'Thẩm định', description: 'Thẩm định hồ sơ và đối chiếu hồ sơ gốc', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Tổ trưởng / Lãnh đạo phòng kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Trình Lãnh đạo Chi nhánh ký duyệt', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 4, durationDays: 0.5, durationLabel: '0.5 ngày (4h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Vào sổ cấp GCN và trả kết quả cho Một cửa', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 4, durationDays: 0.5, durationLabel: '0.5 ngày (4h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Đã trả kết quả cho người dân (Tạm dừng / Hoàn thành)', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_2_2',
    code: '3.2.2',
    name: '3.2.2 Cấp đổi Giấy chứng nhận (Có thuế / Có đo đạc lại)',
    standardDays: 10,
    description: 'Quy trình cấp đổi GCN có phát sinh nghĩa vụ tài chính hoặc xác định lại diện tích',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Bộ phận Tiếp nhận và Trả kết quả', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định hồ sơ', shortLabel: 'Thẩm định', description: 'Thẩm định hồ sơ và kiểm tra ranh giới thửa đất', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)' },
      { key: RecordStatus.TAX_TRANSFER, label: 'Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', description: 'Lập phiếu chuyển nghĩa vụ tài chính', badgeColor: 'bg-indigo-100 text-indigo-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)', isTaxPhase: true },
      { key: RecordStatus.PENDING_TAX_KV7, label: 'Thuế Khu vực 7', shortLabel: 'Thuế KV7', description: 'Cơ quan Thuế xử lý (Ngoài SLA)', badgeColor: 'bg-violet-100 text-violet-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Thông báo thuế', shortLabel: 'Thông báo thuế', description: 'Chờ nộp thuế vào NSNN', badgeColor: 'bg-amber-100 text-amber-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 24, durationDays: 3, durationLabel: '3 ngày (24h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Lãnh đạo phòng kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Trình Lãnh đạo ký duyệt GCN', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật CSDL và bàn giao Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Đã hoàn tất trả kết quả cho người dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_3_1',
    code: '3.3.1',
    name: '3.3.1 Cấp lại Giấy chứng nhận do bị mất (Không thuế)',
    standardDays: 10,
    description: 'Quy trình giải quyết cấp lại GCN sau khi đã hoàn thành niêm yết mất GCN',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận hồ sơ đề nghị cấp lại', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định & Kiểm tra', shortLabel: 'Thẩm định', description: 'Kiểm tra hồ sơ niêm yết và tình trạng ngăn chặn', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 24, durationDays: 3, durationLabel: '3 ngày (24h)' },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 24, durationDays: 3, durationLabel: '3 ngày (24h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Lãnh đạo bộ phận kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Trình Lãnh đạo ký hủy GCN cũ và cấp GCN mới', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật sổ bộ địa chính và chuyển Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Đã hoàn tất trả GCN cho người dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_3_2',
    code: '3.3.2',
    name: '3.3.2 Cấp lại Giấy chứng nhận (Có thuế)',
    standardDays: 15,
    description: 'Quy trình cấp lại GCN có phát sinh truy thu nghĩa vụ tài chính hoặc tiền sử dụng đất',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận hồ sơ', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định hồ sơ', shortLabel: 'Thẩm định', description: 'Kiểm tra hồ sơ gốc và nguồn gốc pháp lý', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 24, durationDays: 3, durationLabel: '3 ngày (24h)' },
      { key: RecordStatus.TAX_TRANSFER, label: 'Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', description: 'Lập phiếu chuyển cơ quan thuế', badgeColor: 'bg-indigo-100 text-indigo-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)', isTaxPhase: true },
      { key: RecordStatus.PENDING_TAX_KV7, label: 'Thuế Khu vực 7', shortLabel: 'Thuế KV7', description: 'Thuế KV7 xác định nghĩa vụ tài chính (Ngoài SLA)', badgeColor: 'bg-violet-100 text-violet-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Thông báo thuế', shortLabel: 'Thông báo thuế', description: 'Chờ nộp tiền vào kho bạc', badgeColor: 'bg-amber-100 text-amber-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (40h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Lãnh đạo phòng kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Trình Lãnh đạo ký duyệt', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật CSDL và bàn giao', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Hoàn tất trả kết quả cho công dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_4_1',
    code: '3.4.1',
    name: '3.4.1 Tách - hợp thửa đất (Không chuyển quyền)',
    standardDays: 12,
    description: 'Quy trình thủ tục tách thửa hoặc hợp thửa đất theo nhu cầu của người sử dụng đất',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Bộ phận Tiếp nhận và Trả kết quả', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định hồ sơ', shortLabel: 'Thẩm định', description: 'Kiểm tra điều kiện tách/hợp thửa và đối chiếu bản vẽ', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (40h)' },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận cho các thửa mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 24, durationDays: 3, durationLabel: '3 ngày (24h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Lãnh đạo bộ phận kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Trình Lãnh đạo ký quyết định / GCN', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật biến động hồ sơ địa chính và chuyển Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Trả kết quả cho người dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_4_2',
    code: '3.4.2',
    name: '3.4.2 Tách thửa chuyển quyền (Tách thửa đồng thời chuyển quyền - Có thuế)',
    standardDays: 13,
    description: 'Quy trình tách thửa đất đồng thời thực hiện thủ tục chuyển nhượng/tặng cho',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận hồ sơ tách thửa chuyển nhượng', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định hồ sơ', shortLabel: 'Thẩm định', description: 'Thẩm định điều kiện tách thửa và hợp đồng chuyển nhượng', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.TAX_TRANSFER, label: 'Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', description: 'Lập phiếu chuyển nghĩa vụ tài chính', badgeColor: 'bg-indigo-100 text-indigo-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)', isTaxPhase: true },
      { key: RecordStatus.PENDING_TAX_KV7, label: 'Thuế Khu vực 7', shortLabel: 'Thuế KV7', description: 'Chi cục Thuế tính thuế (Ngoài SLA)', badgeColor: 'bg-violet-100 text-violet-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Thông báo thuế', shortLabel: 'Thông báo thuế', description: 'Chờ người dân nộp thuế', badgeColor: 'bg-amber-100 text-amber-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận cho các thửa mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (40h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Lãnh đạo phòng kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Lãnh đạo ký duyệt GCN', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Vào sổ địa chính và bàn giao Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Đã hoàn tất trả kết quả cho công dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_5_1',
    code: '3.5.1',
    name: '3.5.1 Gia hạn thời hạn sử dụng đất',
    standardDays: 5,
    description: 'Quy trình xác nhận gia hạn thời hạn sử dụng đất trên Giấy chứng nhận',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận đơn và hồ sơ gia hạn', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định hồ sơ', shortLabel: 'Thẩm định', description: 'Kiểm tra điều kiện gia hạn và đối chiếu quy hoạch', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Lãnh đạo bộ phận kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Lãnh đạo ký xác nhận gia hạn vào trang 4 GCN', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 4, durationDays: 0.5, durationLabel: '0.5 ngày (4h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật CSDL địa chính và chuyển Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 4, durationDays: 0.5, durationLabel: '0.5 ngày (4h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Trả GCN đã gia hạn cho công dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_6_1',
    code: '3.6.1',
    name: '3.6.1 Chuyển mục đích sử dụng đất (Có nghĩa vụ tài chính)',
    standardDays: 15,
    description: 'Quy trình đăng ký biến động sau khi có Quyết định cho phép chuyển mục đích sử dụng đất',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận quyết định và hồ sơ xin cấp GCN', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.APPRAISAL, label: 'Thẩm định hồ sơ', shortLabel: 'Thẩm định', description: 'Thẩm định hồ sơ pháp lý và kiểm tra trích lục bản đồ', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 24, durationDays: 3, durationLabel: '3 ngày (24h)' },
      { key: RecordStatus.TAX_TRANSFER, label: 'Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', description: 'Lập phiếu chuyển thông tin nghĩa vụ tài chính', badgeColor: 'bg-indigo-100 text-indigo-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)', isTaxPhase: true },
      { key: RecordStatus.PENDING_TAX_KV7, label: 'Thuế Khu vực 7', shortLabel: 'Thuế KV7', description: 'Chi cục Thuế xác định tiền sử dụng đất (Ngoài SLA)', badgeColor: 'bg-violet-100 text-violet-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Thông báo thuế', shortLabel: 'Thông báo thuế', description: 'Chờ công dân nộp tiền sử dụng đất vào NSNN', badgeColor: 'bg-amber-100 text-amber-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Ngoài SLA)', isTaxPhase: true, isPaused: true },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In phôi Giấy chứng nhận mới', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 40, durationDays: 5, durationLabel: '5 ngày (40h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Kiểm tra đối chiếu chứng từ nộp tiền và GCN', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 16, durationDays: 2, durationLabel: '2 ngày (16h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Lãnh đạo ký duyệt cấp GCN', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật biến động hồ sơ địa chính và chuyển Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Đã hoàn tất trả kết quả cho công dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_7_1',
    code: '3.7.1',
    name: '3.7.1 Đính chính Giấy chứng nhận',
    standardDays: 7,
    description: 'Quy trình đính chính sai sót thông tin trên GCN đã cấp',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Bộ phận Tiếp nhận và Trả kết quả', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In Giấy chứng nhận', shortLabel: 'In GCN', description: 'In trang đính chính hoặc in lại phôi GCN', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 32, durationDays: 4, durationLabel: '4 ngày (32h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Tổ trưởng / Lãnh đạo phòng kiểm tra', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Trình Lãnh đạo Chi nhánh ký duyệt', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 4, durationDays: 0.5, durationLabel: '0.5 ngày (4h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật CSDL địa chính và chuyển Bộ phận Một cửa', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 4, durationDays: 0.5, durationLabel: '0.5 ngày (4h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Đã trả kết quả cho người dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_7_2',
    code: '3.7.2',
    name: '3.7.2 Đổi thông tin trên Giấy chứng nhận (CCCD, địa chỉ, đổi tên)',
    standardDays: 7,
    description: 'Quy trình cập nhật thay đổi thông tin số CCCD, hộ khẩu hoặc địa chỉ của chủ sử dụng',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận giấy tờ chứng minh thay đổi thông tin', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_PRINT_CERT, label: 'In nội dung chứng nhận', shortLabel: 'In GCN', description: 'In nội dung thay đổi vào trang 4 GCN', badgeColor: 'bg-teal-100 text-teal-800', durationHours: 32, durationDays: 4, durationLabel: '4 ngày (32h)' },
      { key: RecordStatus.PENDING_CHECK, label: 'Trình kiểm tra', shortLabel: 'Trình kiểm tra', description: 'Lãnh đạo kiểm tra thông tin', badgeColor: 'bg-orange-100 text-orange-800', durationHours: 8, durationDays: 1, durationLabel: '1 ngày (8h)' },
      { key: RecordStatus.PENDING_SIGN, label: 'Trình ký duyệt', shortLabel: 'Trình ký duyệt', description: 'Lãnh đạo ký duyệt nội dung thay đổi', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 4, durationDays: 0.5, durationLabel: '0.5 ngày (4h)' },
      { key: RecordStatus.PENDING_HANDOVER, label: 'Hoàn thành', shortLabel: 'Hoàn thành', description: 'Cập nhật cơ sở dữ liệu địa chính', badgeColor: 'bg-cyan-100 text-cyan-800', durationHours: 4, durationDays: 0.5, durationLabel: '0.5 ngày (4h)' },
      { key: RecordStatus.RETURNED, label: 'Trả kết quả', shortLabel: 'Trả kết quả', description: 'Trả GCN đã cập nhật cho công dân', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 0, durationDays: 0, durationLabel: 'Tạm dừng (Hoàn tất)', isPaused: true }
    ]
  },
  {
    id: 'proc_3_8_1',
    code: '3.8.1',
    name: '3.8.1 Đăng ký Giao dịch bảo đảm (Thế chấp)',
    standardDays: 1,
    description: 'Quy trình đăng ký thế chấp quyền sử dụng đất giải quyết trong ngày làm việc',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận hồ sơ thế chấp từ ngân hàng / công dân', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 2, durationDays: 0.25, durationLabel: '2 giờ' },
      { key: RecordStatus.APPRAISAL, label: 'Kiểm tra & Xác nhận', shortLabel: 'Xác nhận', description: 'Kiểm tra thông tin ngăn chặn và ghi nội dung chứng nhận', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 2, durationDays: 0.25, durationLabel: '2 giờ' },
      { key: RecordStatus.PENDING_SIGN, label: 'Ký duyệt', shortLabel: 'Ký duyệt', description: 'Lãnh đạo ký xác nhận đăng ký thế chấp', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 2, durationDays: 0.25, durationLabel: '2 giờ' },
      { key: RecordStatus.RETURNED, label: 'Hoàn thành & Trả KQ', shortLabel: 'Trả KQ', description: 'Vào sổ địa chính và trả kết quả ngay trong ngày', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 2, durationDays: 0.25, durationLabel: '2 giờ' }
    ]
  },
  {
    id: 'proc_3_8_2',
    code: '3.8.2',
    name: '3.8.2 Xóa Đăng ký Giao dịch bảo đảm (Giải chấp)',
    standardDays: 1,
    description: 'Quy trình xóa đăng ký thế chấp quyền sử dụng đất giải quyết trong ngày làm việc',
    steps: [
      { key: RecordStatus.RECEIVED, label: 'Tiếp nhận', shortLabel: 'Tiếp nhận', description: 'Tiếp nhận đơn yêu cầu xóa đăng ký thế chấp', badgeColor: 'bg-gray-100 text-gray-800', durationHours: 2, durationDays: 0.25, durationLabel: '2 giờ' },
      { key: RecordStatus.APPRAISAL, label: 'Kiểm tra & Xóa thế chấp', shortLabel: 'Kiểm tra', description: 'Đối chiếu thông tin đăng ký thế chấp trước đây', badgeColor: 'bg-blue-100 text-blue-800', durationHours: 2, durationDays: 0.25, durationLabel: '2 giờ' },
      { key: RecordStatus.PENDING_SIGN, label: 'Ký duyệt', shortLabel: 'Ký duyệt', description: 'Lãnh đạo ký xác nhận xóa đăng ký thế chấp', badgeColor: 'bg-purple-100 text-purple-800', durationHours: 2, durationDays: 0.25, durationLabel: '2 giờ' },
      { key: RecordStatus.RETURNED, label: 'Hoàn thành & Trả KQ', shortLabel: 'Trả KQ', description: 'Cập nhật sổ địa chính và trả kết quả ngay trong ngày', badgeColor: 'bg-emerald-100 text-emerald-800', durationHours: 2, durationDays: 0.25, durationLabel: '2 giờ' }
    ]
  }
];

let inMemoryProcedures: CustomRegistrationProcedure[] | null = null;

export const compareProcedureCodesAscending = (a: { code?: string }, b: { code?: string }): number => {
  const codeA = (a.code || '').trim();
  const codeB = (b.code || '').trim();
  const partsA = codeA.split('.').map(p => parseInt(p, 10) || 0);
  const partsB = codeB.split('.').map(p => parseInt(p, 10) || 0);
  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return codeA.localeCompare(codeB, 'vi', { numeric: true });
};

export const mergeWithDefaultProcedures = (loaded: CustomRegistrationProcedure[]): CustomRegistrationProcedure[] => {
  let list: CustomRegistrationProcedure[];
  if (!Array.isArray(loaded) || loaded.length === 0) {
    list = [...DEFAULT_REGISTRATION_PROCEDURES];
  } else {
    const existingCodes = new Set(loaded.map(p => (p.code || '').trim()));
    const missingDefaults = DEFAULT_REGISTRATION_PROCEDURES.filter(def => !existingCodes.has(def.code.trim()));
    list = missingDefaults.length > 0 ? [...loaded, ...missingDefaults] : [...loaded];
  }
  return list.sort(compareProcedureCodesAscending);
};

export const loadCustomProceduresSync = (): CustomRegistrationProcedure[] => {
  if (inMemoryProcedures && inMemoryProcedures.length > 0) {
    return inMemoryProcedures;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('registration_workflow_procedures');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = mergeWithDefaultProcedures(parsed);
          inMemoryProcedures = merged;
          return merged;
        }
      }
    }
  } catch (err) {
    console.warn('[REGISTRATION_WORKFLOW] Error loading from localStorage:', err);
  }
  inMemoryProcedures = [...DEFAULT_REGISTRATION_PROCEDURES];
  return inMemoryProcedures;
};

export const fetchProceduresConfigFromCloud = async (): Promise<CustomRegistrationProcedure[]> => {
  try {
    const cloudRaw = await getSystemSetting('registration_workflow_procedures');
    if (cloudRaw) {
      const parsed = JSON.parse(cloudRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged = mergeWithDefaultProcedures(parsed);
        inMemoryProcedures = merged;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('registration_workflow_procedures', JSON.stringify(merged));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('registration_procedures_updated', { detail: merged }));
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('[REGISTRATION_WORKFLOW] Cloud fetch error, using local/default:', err);
  }
  return loadCustomProceduresSync();
};

export const saveProceduresConfig = async (procedures: CustomRegistrationProcedure[]): Promise<boolean> => {
  try {
    inMemoryProcedures = procedures;
    const jsonStr = JSON.stringify(procedures);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('registration_workflow_procedures', jsonStr);
    }
    
    // Lưu vào CSDL Supabase (system_settings)
    await saveSystemSetting('registration_workflow_procedures', jsonStr);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('registration_procedures_updated', { detail: procedures }));
    }
    return true;
  } catch (err) {
    console.error('[REGISTRATION_WORKFLOW] Error saving procedures config:', err);
    return false;
  }
};

export const resetProceduresToDefault = async (): Promise<CustomRegistrationProcedure[]> => {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_REGISTRATION_PROCEDURES));
  await saveProceduresConfig(defaults);
  return defaults;
};

export const loadRegistrationSlaFullConfig = (): { procedureItems: ProcedureItemConfig[] } => {
  const custom = loadCustomProceduresSync();
  return {
    procedureItems: custom.map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      module: 'dangky',
      steps: c.steps.map((s, idx) => ({
        id: s.id || `step_${idx}`,
        stepNumber: idx + 1,
        name: s.label || s.name || `Bước ${idx + 1}`,
        description: s.description,
        durationDays: s.durationDays,
        durationHours: s.durationHours
      }))
    }))
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
  return loadRegistrationSlaFullConfig().procedureItems;
};

export const loadWorkingHoursConfig = () => ({});
export const saveWorkingHoursConfig = (_h: any) => {};
export const DEFAULT_PROCEDURES = DEFAULT_REGISTRATION_PROCEDURES;
export const formatDurationShort = (m: number) => `${m || 0}h`;
export const formatMinutesToVietnamese = (m: number) => `${m || 0} phút`;

export const formatVietnamDateTime = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const formatVietnamDate = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const getStepStartTime = (record: Partial<RecordFile>, status?: RecordStatus | string): string => {
  const currentStatus = (status || record.status || RecordStatus.RECEIVED) as RecordStatus;
  const rec = record as any;
  
  if (currentStatus === RecordStatus.RECEIVED) {
    return rec.receivedDate || rec.createdAt || rec.created_at || new Date().toISOString();
  }
  if (currentStatus === RecordStatus.APPRAISAL) {
    return rec.appraisalAssignedAt || rec.assignedDate || rec.updatedAt || rec.receivedDate || new Date().toISOString();
  }
  if (currentStatus === RecordStatus.TAX_TRANSFER || currentStatus === RecordStatus.PENDING_TAX_KV7) {
    return rec.taxTransferDate || rec.taxAssignedAt || rec.updatedAt || new Date().toISOString();
  }
  if (currentStatus === RecordStatus.PENDING_TAX_PAYMENT) {
    return rec.taxNoticeDate || rec.taxNotificationDate || rec.updatedAt || new Date().toISOString();
  }
  if (currentStatus === RecordStatus.PENDING_PRINT_CERT) {
    return rec.printStaffAssignedAt || rec.print_staff_assigned_at || rec.updatedAt || new Date().toISOString();
  }
  if (currentStatus === RecordStatus.PENDING_CHECK) {
    return rec.checkAssignedAt || rec.checkDate || rec.checkedDate || rec.updatedAt || new Date().toISOString();
  }
  if (currentStatus === RecordStatus.PENDING_SIGN) {
    return rec.signAssignedAt || rec.signatureDate || rec.signed_date || rec.updatedAt || new Date().toISOString();
  }
  if (currentStatus === RecordStatus.PENDING_HANDOVER || currentStatus === RecordStatus.HANDOVER) {
    return rec.signedDate || rec.handoverDate || rec.handover_date || rec.updatedAt || new Date().toISOString();
  }
  if (currentStatus === RecordStatus.RETURNED) {
    return rec.returnedDate || rec.returned_date || rec.updatedAt || new Date().toISOString();
  }
  return rec.updatedAt || rec.assignedDate || rec.receivedDate || new Date().toISOString();
};

export const calculateRecordStepSla = (
  record: Partial<RecordFile>,
  stepKey?: RecordStatus | string,
  procedureCode?: string
): StepSlaResult => {
  const workflow = getRegistrationWorkflow(procedureCode || record.recordType || (record as any).procedureCode || '');
  const steps = workflow.steps;
  const currentStepIndex = getWorkflowStepIndex(stepKey || record.status || '', steps);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const currentStep = steps[activeIndex] || steps[0];

  if (!currentStep) {
    return {
      elapsedHours: 0,
      remainingHours: 8,
      status: 'ontime',
      isOverdue: false,
      isPaused: false,
      percent: 0,
      overdueHours: 0,
      remainingLabel: 'Còn 8 giờ 00',
      overdueLabel: '0 giờ',
      stepHeaderText: 'Định mức: 8h'
    };
  }

  // Nếu là bước Tạm dừng / Ngoài SLA hoặc hồ sơ được tích chọn Tạm dừng SLA
  const isStepPaused = currentStep.isPaused === true ||
    record.isSlaPaused === true ||
    currentStep.durationHours === 0 || 
    currentStep.key === RecordStatus.PENDING_TAX_KV7 || 
    currentStep.key === RecordStatus.PENDING_TAX_PAYMENT ||
    currentStep.key === RecordStatus.RETURNED ||
    record.status === RecordStatus.PENDING_SUPPLEMENT ||
    record.status === RecordStatus.WITHDRAWN ||
    record.status === RecordStatus.REJECTED;

  if (isStepPaused) {
    let pauseReason = 'Theo quy định';
    if (record.isSlaPaused) pauseReason = record.slaPausedReason || 'Tạm dừng SLA';
    else if (currentStep.key === RecordStatus.PENDING_TAX_KV7) pauseReason = 'Cơ quan Thuế thụ lý (Ngoài SLA)';
    else if (currentStep.key === RecordStatus.PENDING_TAX_PAYMENT) pauseReason = 'Chờ nộp thuế NSNN';
    else if (currentStep.key === RecordStatus.RETURNED) pauseReason = 'Đã hoàn thành trả kết quả';
    else if (record.status === RecordStatus.PENDING_SUPPLEMENT) pauseReason = 'Chờ bổ sung hồ sơ';

    return {
      elapsedHours: 0,
      remainingHours: 0,
      status: 'paused',
      isOverdue: false,
      isPaused: true,
      pauseReason,
      percent: 100,
      overdueHours: 0,
      remainingLabel: 'Tạm dừng SLA',
      overdueLabel: '0 giờ',
      stepHeaderText: `Tạm dừng tính SLA (${pauseReason})`
    };
  }

  const durationHours = currentStep.durationHours || 8;
  const totalAllowedMinutes = durationHours * 60;
  
  // Thời gian bắt đầu của bước tính từ lúc giao/tiếp nhận khâu này
  const startTimeStr = getStepStartTime(record, currentStep.key || record.status);
  const startDt = adjustStartWorkingTime(startTimeStr);
  const nowDt = getVietnamNow();

  let workingMinutesPassed = 0;
  const curr = new Date(startDt);

  if (nowDt > startDt) {
    let limit = 0;
    while (curr < nowDt && limit < 1500) {
      limit++;
      const day = curr.getDay();
      if (day !== 0 && day !== 6) {
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
  }

  const elapsedHours = Number((workingMinutesPassed / 60).toFixed(1));
  const remainingMinutes = totalAllowedMinutes - workingMinutesPassed;
  const remainingHours = Math.max(0, Number((remainingMinutes / 60).toFixed(1)));
  const percent = Math.min(100, Math.round((workingMinutesPassed / totalAllowedMinutes) * 100));

  if (remainingMinutes >= 0) {
    const rh = Math.floor(remainingMinutes / 60);
    const rm = remainingMinutes % 60;
    const remainingLabel = `Còn ${rh} giờ ${rm.toString().padStart(2, '0')}`;
    const isApproaching = remainingMinutes <= totalAllowedMinutes * 0.2 || remainingMinutes <= 120;

    return {
      elapsedHours,
      remainingHours,
      status: isApproaching ? 'warning' : 'ontime',
      isOverdue: false,
      isPaused: false,
      percent,
      overdueHours: 0,
      remainingLabel,
      overdueLabel: '0 giờ',
      stepHeaderText: `Định mức: ${currentStep.durationLabel || `${durationHours}h`} (${remainingLabel})`
    };
  } else {
    const overdueMins = Math.abs(remainingMinutes);
    const oh = Math.floor(overdueMins / 60);
    const om = overdueMins % 60;
    const overdueLabel = oh >= 1 
      ? `Quá hạn ${oh} giờ ${om > 0 ? om.toString().padStart(2, '0') : '00'}`
      : `Quá hạn ${overdueMins}p`;

    return {
      elapsedHours,
      remainingHours: 0,
      status: 'overdue',
      isOverdue: true,
      isPaused: false,
      percent: 100,
      overdueHours: Number((overdueMins / 60).toFixed(1)),
      remainingLabel: '0 giờ',
      overdueLabel,
      stepHeaderText: `Quá hạn bước: ${overdueLabel}`
    };
  }
};

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
  isPaused?: boolean;
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

  // Nhóm 1: Thủ tục có thuế (10 bước): 3.1.1, 3.1.2, 3.1.3, 3.4.2, 3.2.2
  if (code.includes('3.1.1') || code.includes('Chuyển quyền') || code.includes('Chuyển nhượng') || code.includes('Tặng cho') || code.includes('Thừa kế') || code.includes('Góp vốn')) return 'tax_transfer';
  if (code.includes('3.1.2') || code.includes('Phân chia quyền')) return 'tax_transfer';
  if (code.includes('3.1.3') || code.includes('Bản án') || code.includes('Tòa án') || code.includes('Thi hành án')) return 'tax_transfer';
  if (code.includes('3.4.2') || (code.includes('Tách') && (code.includes('thay đổi') || code.includes('chuyển quyền')))) return 'tax_transfer';
  if (code.includes('3.2.2') || (code.includes('Cấp đổi') && (code.includes('thuế') || code.includes('đo đạc')))) return 'tax_transfer';

  // Nhóm 2: Thủ tục 3.7.1, 3.7.2 (Đính chính / Đổi thông tin)
  if (code.includes('3.7.1') || code.includes('3.7.2') || code.includes('Đính chính') || code.includes('Đổi thông tin') || code.includes('đổi tên')) return 'correction';

  // Các nhóm khác
  if (code.includes('3.2.1') || code.includes('Cấp đổi')) return 'fast_track_exchange';
  if (code.includes('3.3.1') || code.includes('Cấp lại do mất') || code.includes('Cấp lại')) {
    if (code.includes('thuế')) return 'lost_cert_tax';
    return 'lost_cert';
  }
  if (code.includes('3.3.2')) return 'lost_cert_tax';

  if (code.includes('3.4.1') || code.includes('Tách') || code.includes('Hợp thửa')) return 'split_plot';
  if (code.includes('3.5.1') || code.includes('Gia hạn')) return 'fast_track';
  if (code.includes('3.6.1') || code.includes('Chuyển mục đích')) return 'fast_track';

  if (code.includes('3.8.1') || code.includes('Đăng ký GDBD') || code.includes('Thế chấp')) return 'gdbd_register';
  if (code.includes('3.8.2') || code.includes('Xóa ĐK GDBD') || code.includes('Giải chấp') || code.includes('Xóa thế chấp')) return 'gdbd_release';

  if (code.startsWith('3.')) return 'tax_transfer';

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
  const code = (recordType || '').trim();

  // 1. Kiểm tra cấu hình tùy biến động được lưu bởi người dùng
  if (code) {
    const configuredProcedures = loadCustomProceduresSync();
    const cLower = code.toLowerCase();
    const matchedCustom = configuredProcedures.find(p => {
      if (p.isActive === false) return false;
      const pCode = (p.code || '').trim().toLowerCase();
      if (!pCode) return false;
      return cLower === pCode || cLower.startsWith(pCode) || cLower.includes(pCode) || (p.name && cLower.includes(p.name.toLowerCase()));
    });

    if (matchedCustom && Array.isArray(matchedCustom.steps) && matchedCustom.steps.length > 0) {
      return {
        category: matchedCustom.code,
        title: matchedCustom.name || matchedCustom.code,
        subtitle: `Mã thủ tục: ${matchedCustom.code} (${matchedCustom.standardDays} ngày làm việc - ${matchedCustom.steps.length} bước)`,
        standardDays: matchedCustom.standardDays,
        steps: matchedCustom.steps,
      };
    }
  }

  const category = getRegistrationWorkflowCategory(recordType);

  // ----------------------------------------------------
  // NHÓM 1: THỦ TỤC CÓ THUẾ (3.1.1, 3.1.2, 3.1.3, 3.4.2, 3.2.2)
  // Gồm đúng 10 bước chuẩn theo yêu cầu:
  // Bước 1 tiếp nhận (1 ngày)
  // Bước 2 thẩm định (1 ngày)
  // Bước 3 phiếu chuyển thuế (2 ngày)
  // Bước 4 Thuế Khu vực 7 (5 ngày không tính vào tổng quy trình)
  // Bước 5 Thông báo thuế (tạm dừng)
  // Bước 6 In Giấy chứng nhận (5 ngày)
  // Bước 7 Trình kiểm tra (1 ngày)
  // Bước 8 trình ký duyệt (1 ngày)
  // Bước 9 Hoàn thành (1 ngày)
  // Bước 10 Trả kết quả (tạm dừng)
  // Tổng SLA VPĐKĐĐ = 13 ngày làm việc (104 giờ)
  // ----------------------------------------------------
  if (category === 'tax_transfer' || code.includes('3.1.1') || code.includes('3.1.2') || code.includes('3.1.3') || code.includes('3.4.2') || code.includes('3.2.2')) {
    const steps: WorkflowStep[] = [
      {
        key: RecordStatus.RECEIVED,
        label: 'Tiếp nhận',
        shortLabel: 'Tiếp nhận',
        description: 'Bộ phận Tiếp nhận và Trả kết quả',
        badgeColor: 'bg-gray-100 text-gray-800',
        durationHours: 8,
        durationDays: 1,
        durationLabel: '1 ngày (8h)',
      },
      {
        key: RecordStatus.APPRAISAL,
        label: 'Thẩm định',
        shortLabel: 'Thẩm định',
        description: 'Cán bộ thụ lý thẩm định hồ sơ',
        badgeColor: 'bg-blue-100 text-blue-800',
        durationHours: 8,
        durationDays: 1,
        durationLabel: '1 ngày (8h)',
      },
      {
        key: RecordStatus.TAX_TRANSFER,
        label: 'Phiếu chuyển thuế',
        shortLabel: 'Phiếu chuyển thuế',
        description: 'Lập phiếu chuyển thông tin nghĩa vụ tài chính',
        badgeColor: 'bg-indigo-100 text-indigo-800',
        durationHours: 16,
        durationDays: 2,
        durationLabel: '2 ngày (16h)',
        isTaxPhase: true,
      },
      {
        key: RecordStatus.PENDING_TAX_KV7,
        label: 'Thuế Khu vực 7',
        shortLabel: 'Thuế KV7',
        description: 'Cơ quan Thuế xác định nghĩa vụ tài chính (5 ngày - Ngoài SLA)',
        badgeColor: 'bg-violet-100 text-violet-800',
        durationHours: 40,
        durationDays: 5,
        durationLabel: '5 ngày (Ngoài SLA)',
        isTaxPhase: true,
      },
      {
        key: RecordStatus.PENDING_TAX_PAYMENT,
        label: 'Thông báo thuế',
        shortLabel: 'Thông báo thuế',
        description: 'Chờ người dân nộp thuế vào NSNN (Tạm dừng đếm giờ)',
        badgeColor: 'bg-amber-100 text-amber-800',
        durationHours: 0,
        durationDays: 0,
        durationLabel: 'Tạm dừng (Ngoài SLA)',
        isTaxPhase: true,
      },
      {
        key: RecordStatus.PENDING_PRINT_CERT,
        label: 'In Giấy chứng nhận',
        shortLabel: 'In GCN',
        description: 'In phôi Giấy chứng nhận mới',
        badgeColor: 'bg-teal-100 text-teal-800',
        durationHours: 40,
        durationDays: 5,
        durationLabel: '5 ngày (40h)',
      },
      {
        key: RecordStatus.PENDING_CHECK,
        label: 'Trình kiểm tra',
        shortLabel: 'Trình kiểm tra',
        description: 'Tổ trưởng / Lãnh đạo phòng kiểm tra',
        badgeColor: 'bg-orange-100 text-orange-800',
        durationHours: 8,
        durationDays: 1,
        durationLabel: '1 ngày (8h)',
      },
      {
        key: RecordStatus.PENDING_SIGN,
        label: 'Trình ký duyệt',
        shortLabel: 'Trình ký duyệt',
        description: 'Trình Lãnh đạo Chi nhánh ký duyệt',
        badgeColor: 'bg-purple-100 text-purple-800',
        durationHours: 8,
        durationDays: 1,
        durationLabel: '1 ngày (8h)',
      },
      {
        key: RecordStatus.PENDING_HANDOVER,
        label: 'Hoàn thành',
        shortLabel: 'Hoàn thành',
        description: 'Vào sổ cấp GCN và chuyển Bộ phận Một cửa',
        badgeColor: 'bg-cyan-100 text-cyan-800',
        durationHours: 8,
        durationDays: 1,
        durationLabel: '1 ngày (8h)',
      },
      {
        key: RecordStatus.RETURNED,
        label: 'Trả kết quả',
        shortLabel: 'Trả kết quả',
        description: 'Đã bàn giao và trả kết quả cho người dân (Tạm dừng / Hoàn thành)',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        durationHours: 0,
        durationDays: 0,
        durationLabel: 'Tạm dừng (Hoàn tất)',
      }
    ];

    return {
      category: 'tax_transfer',
      title: code || 'Thủ tục Cấp giấy có thuế',
      subtitle: `Mã thủ tục: ${code} (13 ngày làm việc - 10 bước)`,
      standardDays: 13,
      steps,
    };
  }

  // ----------------------------------------------------
  // NHÓM 2: THỦ TỤC 3.7.1, 3.7.2 (ĐÍNH CHÍNH / ĐỔI THÔNG TIN)
  // Bước 1 tiếp nhận (1 ngày)
  // Bước 6 In Giấy chứng nhận (4 ngày)
  // Bước 7 Trình kiểm tra (1 ngày)
  // Bước 8 trình ký duyệt (0.5 ngày)
  // Bước 9 Hoàn thành (0.5 ngày)
  // Bước 10 Trả kết quả (tạm dừng)
  // Tổng SLA VPĐKĐĐ = 7 ngày làm việc (56 giờ)
  // ----------------------------------------------------
  if (category === 'correction' || code.includes('3.7.1') || code.includes('3.7.2') || code.includes('Đính chính') || code.includes('Đổi thông tin')) {
    const steps: WorkflowStep[] = [
      {
        key: RecordStatus.RECEIVED,
        label: 'Tiếp nhận',
        shortLabel: 'Tiếp nhận',
        description: 'Bộ phận Tiếp nhận và Trả kết quả',
        badgeColor: 'bg-gray-100 text-gray-800',
        durationHours: 8,
        durationDays: 1,
        durationLabel: '1 ngày (8h)',
      },
      {
        key: RecordStatus.PENDING_PRINT_CERT,
        label: 'In Giấy chứng nhận',
        shortLabel: 'In GCN',
        description: 'In phôi / đính chính thông tin Giấy chứng nhận',
        badgeColor: 'bg-teal-100 text-teal-800',
        durationHours: 32,
        durationDays: 4,
        durationLabel: '4 ngày (32h)',
      },
      {
        key: RecordStatus.PENDING_CHECK,
        label: 'Trình kiểm tra',
        shortLabel: 'Trình kiểm tra',
        description: 'Tổ trưởng / Lãnh đạo phòng kiểm tra',
        badgeColor: 'bg-orange-100 text-orange-800',
        durationHours: 8,
        durationDays: 1,
        durationLabel: '1 ngày (8h)',
      },
      {
        key: RecordStatus.PENDING_SIGN,
        label: 'Trình ký duyệt',
        shortLabel: 'Trình ký duyệt',
        description: 'Trình Lãnh đạo Chi nhánh ký duyệt',
        badgeColor: 'bg-purple-100 text-purple-800',
        durationHours: 4,
        durationDays: 0.5,
        durationLabel: '0.5 ngày (4h)',
      },
      {
        key: RecordStatus.PENDING_HANDOVER,
        label: 'Hoàn thành',
        shortLabel: 'Hoàn thành',
        description: 'Cập nhật CSDL địa chính và chuyển Bộ phận Một cửa',
        badgeColor: 'bg-cyan-100 text-cyan-800',
        durationHours: 4,
        durationDays: 0.5,
        durationLabel: '0.5 ngày (4h)',
      },
      {
        key: RecordStatus.RETURNED,
        label: 'Trả kết quả',
        shortLabel: 'Trả kết quả',
        description: 'Đã trả kết quả cho người dân (Tạm dừng / Hoàn thành)',
        badgeColor: 'bg-emerald-100 text-emerald-800',
        durationHours: 0,
        durationDays: 0,
        durationLabel: 'Tạm dừng (Hoàn tất)',
      }
    ];

    return {
      category: 'correction',
      title: code || 'Thủ tục Đính chính / Đổi thông tin',
      subtitle: `Mã thủ tục: ${code} (7 ngày làm việc - 6 bước)`,
      standardDays: 7,
      steps,
    };
  }

  // ----------------------------------------------------
  // CÁC THỦ TỤC CẤP GIẤY KHÁC
  // ----------------------------------------------------
  let standardDays = 10;
  if (category === 'gdbd_register' || category === 'gdbd_release') {
    standardDays = 1;
  } else if (category === 'fast_track_exchange') {
    standardDays = 5;
  } else if (category === 'split_plot') {
    standardDays = 12;
  }

  const steps: WorkflowStep[] = [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận',
      shortLabel: 'Tiếp nhận',
      description: 'Bộ phận Tiếp nhận và Trả kết quả',
      badgeColor: 'bg-gray-100 text-gray-800',
      durationHours: standardDays <= 1 ? 2 : 8,
      durationDays: standardDays <= 1 ? 0.25 : 1,
      durationLabel: standardDays <= 1 ? '2h' : '1 ngày',
    },
    {
      key: RecordStatus.APPRAISAL,
      label: 'Thẩm định',
      shortLabel: 'Thẩm định',
      description: 'Cán bộ thụ lý thẩm định hồ sơ',
      badgeColor: 'bg-blue-100 text-blue-800',
      durationHours: standardDays <= 1 ? 2 : Math.max(8, (standardDays - 4) * 8),
      durationDays: standardDays <= 1 ? 0.25 : Math.max(1, standardDays - 4),
      durationLabel: `${standardDays <= 1 ? 0.25 : Math.max(1, standardDays - 4)} ngày`,
    },
    {
      key: RecordStatus.PENDING_PRINT_CERT,
      label: 'In Giấy chứng nhận',
      shortLabel: 'In GCN',
      description: 'In phôi Giấy chứng nhận mới',
      badgeColor: 'bg-teal-100 text-teal-800',
      durationHours: standardDays <= 1 ? 2 : 16,
      durationDays: standardDays <= 1 ? 0.25 : 2,
      durationLabel: `${standardDays <= 1 ? 0.25 : 2} ngày`,
    },
    {
      key: RecordStatus.PENDING_CHECK,
      label: 'Trình kiểm tra',
      shortLabel: 'Trình kiểm tra',
      description: 'Tổ trưởng / Lãnh đạo phòng kiểm tra',
      badgeColor: 'bg-orange-100 text-orange-800',
      durationHours: standardDays <= 1 ? 1 : 8,
      durationDays: standardDays <= 1 ? 0.125 : 1,
      durationLabel: `${standardDays <= 1 ? 0.125 : 1} ngày`,
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Trình ký duyệt',
      shortLabel: 'Trình ký duyệt',
      description: 'Trình Lãnh đạo Chi nhánh ký duyệt',
      badgeColor: 'bg-purple-100 text-purple-800',
      durationHours: standardDays <= 1 ? 1 : 8,
      durationDays: standardDays <= 1 ? 0.125 : 1,
      durationLabel: `${standardDays <= 1 ? 0.125 : 1} ngày`,
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Hoàn thành',
      shortLabel: 'Hoàn thành',
      description: 'Vào sổ cấp GCN và chuyển Bộ phận Một cửa',
      badgeColor: 'bg-cyan-100 text-cyan-800',
      durationHours: standardDays <= 1 ? 0 : 8,
      durationDays: standardDays <= 1 ? 0 : 1,
      durationLabel: `${standardDays <= 1 ? 0 : 1} ngày`,
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Trả kết quả',
      shortLabel: 'Trả kết quả',
      description: 'Đã trả kết quả cho người dân (Tạm dừng / Hoàn thành)',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Tạm dừng',
    }
  ];

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
  const calc = calculateRegistrationDeadline(record);
  const d = record.deadline || calc.deadline || record.receivedDate || '—';
  return {
    phase: 'final_result',
    label: 'Hẹn trả kết quả',
    shortLabel: 'Hẹn trả GCN',
    appointmentDate: d,
    formattedAppointmentDate: d && d !== '—' ? d.split('-').reverse().join('/') : '—',
    description: `Thời hạn giải quyết theo quy trình (${calc.standardDays || 13} ngày làm việc)`,
  };
};

export const getRecordSlaBadge = (record: any) => {
  const isOverdue = record?.isOverdue || false;
  const isApproaching = record?.isApproaching || false;
  const isPaused = record?.isSlaPaused === true || record?.status === 'PENDING_SUPPLEMENT' || record?.status === 'WITHDRAWN';
  let label = '';
  let badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';

  if (isPaused) {
    label = record?.isSlaPaused ? (record?.slaPausedReason || 'Tạm dừng SLA') : 'Tạm dừng';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-300 font-bold';
  } else if (isOverdue) {
    label = 'Quá hạn';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (isApproaching) {
    label = 'Sắp đến hạn';
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
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

  const sla = calculateRecordStepSla(record, currentStep.key as RecordStatus, record.recordType || '');

  return {
    step: currentStep,
    durationHours: currentStep.durationHours,
    durationDays: currentStep.durationDays,
    durationLabel: currentStep.durationLabel,
    elapsedHours: sla.elapsedHours,
    elapsedLabel: `${sla.elapsedHours}h`,
    remainingHours: sla.remainingHours,
    remainingLabel: sla.remainingLabel,
    status: sla.status as any,
    isOverdue: sla.isOverdue,
    overdueHours: sla.overdueHours,
    overdueLabel: sla.overdueLabel,
    percent: sla.percent,
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
  if (record.isSlaPaused) {
    return {
      text: record.slaPausedReason || 'Tạm dừng SLA',
      isOverdue: false,
      isApproaching: false,
      isPaused: true,
      colorClass: 'text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200',
    };
  }

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
      colorClass: isApproaching ? 'text-amber-500 font-bold' : 'text-emerald-600 font-bold',
    };
  } else {
    const overdueMins = Math.abs(remainingMinutes);
    const h = Math.floor(overdueMins / 60);
    const m = overdueMins % 60;
    return {
      text: `Quá hạn ${h} giờ ${m} phút`,
      isOverdue: true,
      isApproaching: false,
      isPaused: false,
      colorClass: 'text-red-600 font-bold',
    };
  }
}


