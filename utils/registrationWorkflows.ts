import { RecordStatus, RecordFile } from '../types';
import { getShortRecordType, DEFAULT_HOLIDAYS } from '../constants';
import { parseSafeDate, formatDateKey, getSolarDateFromLunar } from './appHelpers';

export type RegistrationWorkflowCategory = 
  | 'tax_transfer'   // Có nghĩa vụ tài chính (chuyển thuế, chờ GNT)
  | 'fast_track'     // Đăng ký biến động không thuế (cấp đổi, đính chính, đổi TT)
  | 'gdbd'           // Giao dịch bảo đảm / Thế chấp (alias tương thích ngược)
  | 'gdbd_register'  // 3.8.1 Đăng ký thế chấp (3 ngày làm việc = 24 giờ)
  | 'gdbd_release'   // 3.8.2 Xóa thế chấp / Giải chấp (1 ngày làm việc = 8 giờ)
  | 'lost_cert'      // Cấp lại do mất không thuế (có niêm yết 30 ngày)
  | 'lost_cert_tax'  // Cấp lại do mất có thuế (có niêm yết 30 ngày + chuyển thuế)
  | 'split_plot'     // Tách - hợp thửa đất (15 ngày làm việc)
  | 'unclassified';  // Hồ sơ chưa phân loại / thiếu loại

export interface WorkflowStep {
  key: RecordStatus;
  label: string;
  shortLabel: string;
  description: string;
  dateField?: keyof RecordFile;
  badgeColor: string;
  durationHours: number; // Số giờ làm việc quy định (8h/ngày)
  durationDays: number; // Số ngày làm việc quy định (durationHours / 8)
  durationLabel: string; // Nhãn hiển thị (VD: "1 ngày", "4 giờ", "2 ngày", "7 ngày")
  isTaxPhase?: boolean; // Đánh dấu thuộc khâu cơ quan Thuế
  isPostingPhase?: boolean; // Đánh dấu thuộc khâu niêm yết 30 ngày tại UBND xã
}

export interface RegistrationWorkflowConfig {
  category: RegistrationWorkflowCategory;
  title: string;
  subtitle: string;
  standardDays: number;
  steps: WorkflowStep[];
}

// 1. Luồng Thuế: 3.1.1, 3.1.2, 3.1.3, 3.2.2, 3.3.2, 3.4.2, 3.6.1 (Tổng 13 ngày = 104 giờ làm việc)
const TAX_TRANSFER_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'tax_transfer',
  title: 'Quy trình Có nghĩa vụ tài chính (Chuyển thuế)',
  subtitle: 'Áp dụng cho Chuyển quyền, Thừa kế, Chuyển MĐSD, Cấp đổi/Cấp lại có phát sinh thuế',
  standardDays: 13,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận đầu vào, kiểm tra thành phần hồ sơ và cấp biên nhận',
      dateField: 'receivedDate',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.APPRAISAL,
      label: 'Chờ thẩm định',
      shortLabel: 'Thẩm định',
      description: 'Kiểm tra pháp lý, xác nhận trích lục và lập Phiếu chuyển thông tin địa chính',
      dateField: 'appraisalDate',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày',
    },
    {
      key: RecordStatus.TAX_TRANSFER,
      label: 'Chờ chuyển thuế',
      shortLabel: 'Chuyển thuế',
      description: 'Lập và chuyển phiếu thông tin địa chính sang cơ quan thuế',
      dateField: 'taxTransferDate',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      durationHours: 16,
      durationDays: 2,
      durationLabel: '2 ngày',
    },
    {
      key: RecordStatus.PENDING_TAX_KV7,
      label: 'Chờ thuế khu vực 7',
      shortLabel: 'Thuế KV7',
      description: 'Cơ quan Thuế thụ lý tính nghĩa vụ tài chính: Không tính vào thời hạn quy trình',
      dateField: 'taxKv7Date',
      badgeColor: 'bg-violet-100 text-violet-800 border-violet-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Không tính hạn',
      isTaxPhase: true,
    },
    {
      key: RecordStatus.PENDING_TAX_PAYMENT,
      label: 'Chờ Giấy nộp tiền',
      shortLabel: 'Chờ GNT',
      description: 'Chờ người sử dụng đất nộp tiền vào NSNN và nộp chứng từ: Không tính vào thời hạn quy trình',
      dateField: 'taxPaymentDate',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Không tính hạn',
      isTaxPhase: true,
    },
    {
      key: RecordStatus.PENDING_PRINT_CERT,
      label: 'Chờ in GCN / Trang 4',
      shortLabel: 'In GCN',
      description: 'Dành toàn bộ thời gian còn lại của Chi nhánh cho in phôi GCN mới hoặc xác nhận trang 4',
      dateField: 'printCertDate',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      durationHours: 56, // 104h - (4h + 8h + 16h + 8h + 4h + 4h + 4h) = 56h = 7 ngày
      durationDays: 7,
      durationLabel: '7 ngày',
    },
    {
      key: RecordStatus.PENDING_CHECK,
      label: 'Chờ kiểm tra',
      shortLabel: 'Kiểm tra',
      description: 'Tổ trưởng / Phụ trách chuyên môn kiểm tra tính chuẩn xác của hồ sơ và phôi GCN',
      dateField: 'pendingCheckDate',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày',
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Chờ ký duyệt',
      shortLabel: 'Ký duyệt',
      description: 'Trình Giám đốc / Phó Giám đốc Chi nhánh ký duyệt Giấy chứng nhận',
      dateField: 'submissionDate',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Chờ bàn giao',
      shortLabel: 'Chờ bàn giao',
      description: 'Lãnh đạo đã ký duyệt, vào sổ cấp GCN và chuẩn bị bàn giao Một cửa',
      dateField: 'approvalDate',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.HANDOVER,
      label: 'Đã giao 1 cửa',
      shortLabel: 'Giao 1 cửa',
      description: 'Đã bàn giao kết quả sang Bộ phận Tiếp nhận và Trả kết quả (Một cửa)',
      dateField: 'completedDate',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Đã trả kết quả',
      shortLabel: 'Đã trả',
      description: 'Công dân đã nhận Giấy chứng nhận và hoàn tất thủ tục',
      dateField: 'resultReturnedDate',
      badgeColor: 'bg-green-100 text-green-800 border-green-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Hoàn tất',
    },
  ],
};

// 2. Luồng Không Thuế: 3.2.1, 3.5.1, 3.7.1, 3.7.2 (Tổng 7 ngày = 56 giờ làm việc, không qua thẩm định)
const FAST_TRACK_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'fast_track',
  title: 'Quy trình Đăng ký biến động không thuế',
  subtitle: 'Áp dụng cho Cấp đổi, Gia hạn, Đính chính, Cập nhật thông tin CCCD / Hộ khẩu',
  standardDays: 7,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận đầu vào, kiểm tra tính đầy đủ của hồ sơ biến động',
      dateField: 'receivedDate',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.PENDING_PRINT_CERT,
      label: 'Chờ in GCN / Chỉnh lý trang 4',
      shortLabel: 'In / Chỉnh lý',
      description: 'Không qua thẩm định, chuyển thẳng in phôi GCN mới hoặc xác nhận Trang 4 với thời gian còn lại',
      dateField: 'printCertDate',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      durationHours: 32, // 56h - (4h + 8h + 4h + 4h + 4h) = 32h = 4.0 ngày
      durationDays: 4,
      durationLabel: '4 ngày',
    },
    {
      key: RecordStatus.PENDING_CHECK,
      label: 'Chờ kiểm tra',
      shortLabel: 'Kiểm tra',
      description: 'Tổ trưởng kiểm tra kỹ thuật và đối chiếu hồ sơ lưu',
      dateField: 'pendingCheckDate',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày',
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Chờ ký duyệt',
      shortLabel: 'Ký duyệt',
      description: 'Trình lãnh đạo Chi nhánh ký duyệt GCN hoặc xác nhận Trang 4',
      dateField: 'submissionDate',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Chờ bàn giao',
      shortLabel: 'Chờ bàn giao',
      description: 'Đã ký duyệt, đóng dấu và chuyển sổ theo dõi',
      dateField: 'approvalDate',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.HANDOVER,
      label: 'Đã giao 1 cửa',
      shortLabel: 'Giao 1 cửa',
      description: 'Bàn giao hồ sơ hoàn thành sang Bộ phận Một cửa',
      dateField: 'completedDate',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Đã trả kết quả',
      shortLabel: 'Đã trả',
      description: 'Người sử dụng đất đã nhận lại kết quả',
      dateField: 'resultReturnedDate',
      badgeColor: 'bg-green-100 text-green-800 border-green-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Hoàn tất',
    },
  ],
};

// 3a. Luồng Đăng ký Thế chấp / GDBD: 3.8.1 (Tổng 3 ngày = 24 giờ làm việc)
const GDBD_REGISTER_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'gdbd_register',
  title: 'Quy trình Đăng ký Thế chấp / Giao dịch bảo đảm (3.8.1)',
  subtitle: 'Áp dụng cho Đăng ký biện pháp bảo đảm bằng QSDĐ, tài sản gắn liền với đất (3 ngày làm việc)',
  standardDays: 3,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận đơn yêu cầu đăng ký biện pháp bảo đảm và hợp đồng thế chấp',
      dateField: 'receivedDate',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.APPRAISAL,
      label: 'Chờ thẩm định & Tra cứu ngăn chặn',
      shortLabel: 'Tra cứu & Thẩm định',
      description: 'Tra cứu cơ sở dữ liệu ngăn chặn, cập nhật vào sổ theo dõi đăng ký biện pháp bảo đảm',
      dateField: 'appraisalDate',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày',
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Chờ ký duyệt',
      shortLabel: 'Ký duyệt',
      description: 'Trình lãnh đạo Chi nhánh ký chứng nhận ĐKBPBĐ',
      dateField: 'submissionDate',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Chờ bàn giao',
      shortLabel: 'Chờ bàn giao',
      description: 'Đã đóng dấu hoàn tất, chuẩn bị giao kết quả',
      dateField: 'approvalDate',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.HANDOVER,
      label: 'Đã giao 1 cửa',
      shortLabel: 'Giao 1 cửa',
      description: 'Chuyển Bộ phận Một cửa giao trả Ngân hàng / Chủ sử dụng đất',
      dateField: 'completedDate',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Đã trả kết quả',
      shortLabel: 'Đã trả',
      description: 'Đã giao kết quả hoàn thành',
      dateField: 'resultReturnedDate',
      badgeColor: 'bg-green-100 text-green-800 border-green-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Hoàn tất',
    },
  ],
};

// 3b. Luồng Xóa Đăng ký Thế chấp / Giải chấp: 3.8.2 (Tổng 1 ngày làm việc = 8 giờ)
const GDBD_RELEASE_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'gdbd_release',
  title: 'Quy trình Xóa Đăng ký Thế chấp / Giải chấp (3.8.2)',
  subtitle: 'Áp dụng cho Xóa đăng ký biện pháp bảo đảm (Giải chấp) - Giải quyết trong 1 ngày làm việc (8 giờ)',
  standardDays: 1,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận văn bản thông báo giải chấp / xóa thế chấp của tổ chức tín dụng',
      dateField: 'receivedDate',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      durationHours: 1,
      durationDays: 0.125,
      durationLabel: '1 giờ',
    },
    {
      key: RecordStatus.APPRAISAL,
      label: 'Xóa đăng ký & Cập nhật CSDL ngăn chặn',
      shortLabel: 'Xác nhận xóa',
      description: 'Kiểm tra hồ sơ gốc, xóa đăng ký thế chấp trên sổ địa chính và CSDL ngăn chặn',
      dateField: 'appraisalDate',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Chờ ký duyệt',
      shortLabel: 'Ký duyệt',
      description: 'Lãnh đạo Chi nhánh ký duyệt xác nhận xóa thế chấp',
      dateField: 'submissionDate',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      durationHours: 1,
      durationDays: 0.125,
      durationLabel: '1 giờ',
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Chờ bàn giao',
      shortLabel: 'Chờ bàn giao',
      description: 'Đóng dấu hoàn tất, chuyển bàn giao',
      dateField: 'approvalDate',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      durationHours: 1,
      durationDays: 0.125,
      durationLabel: '1 giờ',
    },
    {
      key: RecordStatus.HANDOVER,
      label: 'Đã giao 1 cửa',
      shortLabel: 'Giao 1 cửa',
      description: 'Bàn giao Bộ phận Một cửa giao trả kết quả cho người sử dụng đất',
      dateField: 'completedDate',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      durationHours: 1,
      durationDays: 0.125,
      durationLabel: '1 giờ',
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Đã trả kết quả',
      shortLabel: 'Đã trả',
      description: 'Hoàn tất thủ tục xóa thế chấp',
      dateField: 'resultReturnedDate',
      badgeColor: 'bg-green-100 text-green-800 border-green-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Hoàn tất',
    },
  ],
};

// Giữ alias tương thích
const GDBD_WORKFLOW = GDBD_REGISTER_WORKFLOW;

// 4. Luồng Cấp lại do mất không thuế: 3.3.1 (Tổng 10 ngày VPĐK = 80 giờ + Niêm yết 30 ngày)
const LOST_CERT_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'lost_cert',
  title: 'Quy trình Cấp lại do mất GCN (3.3.1 - Không thuế)',
  subtitle: 'Áp dụng cho Thủ tục Cấp lại GCN do bị mất theo Điều 36 NĐ 101/2024 (Niêm yết 30 ngày tại xã)',
  standardDays: 10,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận đơn cớ mất, đơn đề nghị cấp lại và giấy tờ pháp lý của người sử dụng đất',
      dateField: 'receivedDate',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.APPRAISAL,
      label: 'Thẩm định & Niêm yết 30 ngày',
      shortLabel: 'Thẩm định & Niêm yết',
      description: 'Kiểm tra hồ sơ gốc, gửi công văn đề nghị UBND cấp xã niêm yết công khai mất GCN (30 ngày)',
      dateField: 'appraisalDate',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày (+30 ngày niêm yết)',
      isPostingPhase: true,
    },
    {
      key: RecordStatus.PENDING_PRINT_CERT,
      label: 'Hủy GCN cũ & Chờ in GCN mới',
      shortLabel: 'In GCN mới',
      description: 'Hết thời hạn niêm yết, ban hành QĐ hủy GCN cũ và in phôi GCN mới với thời gian còn lại',
      dateField: 'printCertDate',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      durationHours: 48, // 80h - (4h + 8h + 8h + 4h + 4h + 4h) = 48h = 6.0 ngày
      durationDays: 6,
      durationLabel: '6 ngày',
    },
    {
      key: RecordStatus.PENDING_CHECK,
      label: 'Chờ kiểm tra',
      shortLabel: 'Kiểm tra',
      description: 'Kiểm tra hồ sơ biên bản kết thúc niêm yết và nội dung in trên phôi mới',
      dateField: 'pendingCheckDate',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày',
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Chờ ký duyệt',
      shortLabel: 'Ký duyệt',
      description: 'Trình lãnh đạo ký duyệt cấp Giấy chứng nhận mới',
      dateField: 'submissionDate',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Chờ bàn giao',
      shortLabel: 'Chờ bàn giao',
      description: 'Đã ký duyệt xong, vào sổ cấp GCN và đóng dấu',
      dateField: 'approvalDate',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.HANDOVER,
      label: 'Đã giao 1 cửa',
      shortLabel: 'Giao 1 cửa',
      description: 'Bàn giao Bộ phận Một cửa trả dân',
      dateField: 'completedDate',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Đã trả kết quả',
      shortLabel: 'Đã trả',
      description: 'Công dân đã nhận GCN mới',
      dateField: 'resultReturnedDate',
      badgeColor: 'bg-green-100 text-green-800 border-green-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Hoàn tất',
    },
  ],
};

// 5. Luồng Cấp lại do mất có thuế: 3.3.2 (Tổng 13 ngày VPĐK = 104 giờ + Niêm yết 30 ngày + Liên thông thuế)
const LOST_CERT_TAX_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'lost_cert_tax',
  title: 'Quy trình Cấp lại do mất GCN có thuế (3.3.2)',
  subtitle: 'Áp dụng cho Cấp lại do mất có phát sinh nghĩa vụ tài chính (Niêm yết 30 ngày + Liên thông thuế)',
  standardDays: 13,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận đơn cớ mất, đơn đề nghị cấp lại và hồ sơ trích đo địa chính',
      dateField: 'receivedDate',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.APPRAISAL,
      label: 'Thẩm định & Niêm yết 30 ngày',
      shortLabel: 'Thẩm định & Niêm yết',
      description: 'Kiểm tra hồ sơ gốc, gửi công văn đề nghị UBND cấp xã niêm yết công khai mất GCN (30 ngày)',
      dateField: 'appraisalDate',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày (+30 ngày niêm yết)',
      isPostingPhase: true,
    },
    {
      key: RecordStatus.TAX_TRANSFER,
      label: 'Chờ chuyển thuế',
      shortLabel: 'Chuyển thuế',
      description: 'Thu nhận biên bản hết niêm yết, lập Phiếu chuyển thông tin địa chính gửi Thuế',
      dateField: 'taxTransferDate',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      durationHours: 16,
      durationDays: 2,
      durationLabel: '2 ngày',
    },
    {
      key: RecordStatus.PENDING_TAX_KV7,
      label: 'Chờ thuế khu vực 7',
      shortLabel: 'Thuế KV7',
      description: 'Cơ quan Thuế thụ lý tính nghĩa vụ tài chính và phát hành Thông báo nộp tiền',
      dateField: 'taxKv7Date',
      badgeColor: 'bg-violet-100 text-violet-800 border-violet-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Không tính hạn',
      isTaxPhase: true,
    },
    {
      key: RecordStatus.PENDING_TAX_PAYMENT,
      label: 'Chờ Giấy nộp tiền',
      shortLabel: 'Chờ GNT',
      description: 'Chờ người sử dụng đất nộp tiền vào NSNN và nộp chứng từ xác nhận hoàn thành NVTC',
      dateField: 'taxPaymentDate',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Không tính hạn',
      isTaxPhase: true,
    },
    {
      key: RecordStatus.PENDING_PRINT_CERT,
      label: 'Hủy GCN cũ & Chờ in GCN mới',
      shortLabel: 'In GCN mới',
      description: 'Dành toàn bộ thời gian còn lại của Chi nhánh để ban hành QĐ hủy GCN cũ và in phôi GCN mới',
      dateField: 'printCertDate',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      durationHours: 56, // 104h - (4h + 8h + 16h + 8h + 4h + 4h + 4h) = 56h = 7 ngày
      durationDays: 7,
      durationLabel: '7 ngày',
    },
    {
      key: RecordStatus.PENDING_CHECK,
      label: 'Chờ kiểm tra',
      shortLabel: 'Kiểm tra',
      description: 'Kiểm tra hồ sơ biên bản niêm yết, chứng từ thuế và phôi in mới',
      dateField: 'pendingCheckDate',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày',
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Chờ ký duyệt',
      shortLabel: 'Ký duyệt',
      description: 'Trình lãnh đạo Chi nhánh ký QĐ hủy GCN cũ và ký duyệt GCN mới',
      dateField: 'submissionDate',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Chờ bàn giao',
      shortLabel: 'Chờ bàn giao',
      description: 'Đã ký duyệt xong, vào sổ cấp GCN và đóng dấu',
      dateField: 'approvalDate',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.HANDOVER,
      label: 'Đã giao 1 cửa',
      shortLabel: 'Giao 1 cửa',
      description: 'Bàn giao Bộ phận Một cửa trả kết quả cho công dân',
      dateField: 'completedDate',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Đã trả kết quả',
      shortLabel: 'Đã trả',
      description: 'Công dân đã nhận GCN mới tại Bộ phận Một cửa',
      dateField: 'resultReturnedDate',
      badgeColor: 'bg-green-100 text-green-800 border-green-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Hoàn tất',
    },
  ],
};

// 5. Luồng Tách - Hợp thửa: 3.4.1 (Tổng 15 ngày = 120 giờ làm việc)
const SPLIT_PLOT_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'split_plot',
  title: 'Quy trình Tách thửa - Hợp thửa đất',
  subtitle: 'Áp dụng cho Hồ sơ Tách thửa hoặc Hợp thửa đất đồng thời cấp GCN mới',
  standardDays: 15,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận đơn đề nghị tách/hợp thửa và bản vẽ trích đo địa chính',
      dateField: 'receivedDate',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.APPRAISAL,
      label: 'Thẩm định điều kiện tách/hợp',
      shortLabel: 'Thẩm định',
      description: 'Kiểm tra diện tích tối thiểu, chỉ giới đường đỏ, quy hoạch và trích đo thửa đất',
      dateField: 'appraisalDate',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày',
    },
    {
      key: RecordStatus.PENDING_PRINT_CERT,
      label: 'Chờ in GCN các thửa mới',
      shortLabel: 'In GCN mới',
      description: 'In phôi Giấy chứng nhận cho các thửa đất mới hình thành với thời gian còn lại',
      dateField: 'printCertDate',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      durationHours: 88, // 120h - (4h + 8h + 8h + 4h + 4h + 4h) = 88h = 11.0 ngày
      durationDays: 11,
      durationLabel: '11 ngày',
    },
    {
      key: RecordStatus.PENDING_CHECK,
      label: 'Chờ kiểm tra',
      shortLabel: 'Kiểm tra',
      description: 'Tổ trưởng kiểm tra đối soát hồ sơ địa chính và phôi in mới',
      dateField: 'pendingCheckDate',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày',
    },
    {
      key: RecordStatus.PENDING_SIGN,
      label: 'Chờ ký duyệt',
      shortLabel: 'Ký duyệt',
      description: 'Trình lãnh đạo ký duyệt bộ Giấy chứng nhận mới',
      dateField: 'submissionDate',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.PENDING_HANDOVER,
      label: 'Chờ bàn giao',
      shortLabel: 'Chờ bàn giao',
      description: 'Đã ký duyệt xong, chuẩn bị bàn giao',
      dateField: 'approvalDate',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.HANDOVER,
      label: 'Đã giao 1 cửa',
      shortLabel: 'Giao 1 cửa',
      description: 'Bàn giao hồ sơ hoàn thành sang Bộ phận Một cửa',
      dateField: 'completedDate',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
      durationHours: 4,
      durationDays: 0.5,
      durationLabel: '4 giờ',
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Đã trả kết quả',
      shortLabel: 'Đã trả',
      description: 'Đã bàn giao các GCN mới cho người sử dụng đất',
      dateField: 'resultReturnedDate',
      badgeColor: 'bg-green-100 text-green-800 border-green-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Hoàn tất',
    },
  ],
};

// 6. Luồng Chưa Phân Loại: Áp dụng khi thiếu hoặc chưa xác định rõ loại hồ sơ
const UNCLASSIFIED_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'unclassified',
  title: 'Hồ sơ chưa phân loại quy trình',
  subtitle: 'Loại hồ sơ chưa được xác định hoặc thiếu thông tin, cần bổ sung loại hồ sơ để tính thời hạn',
  standardDays: 0,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Hồ sơ tiếp nhận chưa được phân loại',
      dateField: 'receivedDate',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Chưa xác định',
    },
    {
      key: RecordStatus.RETURNED,
      label: 'Đã trả kết quả',
      shortLabel: 'Đã trả',
      description: 'Kết thúc',
      dateField: 'resultReturnedDate',
      badgeColor: 'bg-green-100 text-green-800 border-green-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Hoàn tất',
    },
  ],
};

/**
 * Xác định phân loại luồng quy trình dựa trên loại hồ sơ
 * TUYỆT ĐỐI KHÔNG tự động chuyển sang tax_transfer nếu thiếu hoặc không hợp lệ!
 */
export const getRegistrationWorkflowCategory = (type: string | undefined | null): RegistrationWorkflowCategory => {
  if (!type || typeof type !== 'string' || !type.trim()) {
    return 'unclassified';
  }
  const short = getShortRecordType(type);
  const lower = type.toLowerCase().trim();

  // 1. Xóa đăng ký thế chấp / Giải chấp (3.8.2) - 1 ngày làm việc = 8 giờ
  if (
    short === '3.8.2 Xóa ĐK GDBD' ||
    lower.includes('3.8.2') ||
    lower.includes('xóa đk gdbd') ||
    lower.includes('xóa thế chấp') ||
    lower.includes('giải chấp')
  ) {
    return 'gdbd_release';
  }

  // 2. Đăng ký thế chấp / GDBD (3.8.1) - 3 ngày làm việc = 24 giờ
  if (
    short === '3.8.1 Đăng ký GDBD' ||
    lower.includes('3.8.1') ||
    lower.includes('đăng ký gdbd') ||
    lower.includes('đăng ký thế chấp') ||
    (lower.includes('thế chấp') && !lower.includes('xóa')) ||
    (lower.includes('gdbd') && !lower.includes('xóa'))
  ) {
    return 'gdbd_register';
  }

  // 3. Cấp lại do mất có thuế (3.3.2) - 13 ngày làm việc + 30 ngày niêm yết
  if (
    short === '3.3.2 Cấp lại có thuế' ||
    lower.includes('3.3.2') ||
    (lower.includes('cấp lại') && (lower.includes('có thuế') || lower.includes('phát sinh thuế') || lower.includes('chuyển thuế')))
  ) {
    return 'lost_cert_tax';
  }

  // 4. Cấp lại do mất không thuế (3.3.1) - 10 ngày làm việc + 30 ngày niêm yết
  if (
    short === '3.3.1 Cấp lại' ||
    (lower.includes('3.3.1') && !lower.includes('thuế')) ||
    (lower.includes('cấp lại') && lower.includes('mất') && !lower.includes('thuế'))
  ) {
    return 'lost_cert';
  }

  // 5. Tách thửa chuyển quyền (3.4.2) -> Luồng có thuế
  if (
    short === '3.4.2 Tách thửa CQ' ||
    lower.includes('3.4.2') ||
    (lower.includes('tách') && lower.includes('cq'))
  ) {
    return 'tax_transfer';
  }

  // 6. Tách - Hợp thửa thông thường (3.4.1, 3.4.2) - 17 ngày làm việc
  if (
    short === '3.4.1 Tách - hợp thửa' ||
    short === '3.4.2 Tách thửa CQ' ||
    lower.includes('3.4.1') ||
    lower.includes('3.4.2') ||
    (lower.includes('tách') && lower.includes('hợp')) ||
    lower.includes('tách thửa') ||
    lower.includes('hợp thửa')
  ) {
    return 'split_plot';
  }

  // 7. Đăng ký biến động không thuế (3.2.1, 3.5.1, 3.6.1, 3.7.1, 3.7.2)
  if (
    short === '3.2.1 Cấp đổi' ||
    short === '3.5.1 Gia hạn' ||
    short === '3.6.1 Chuyển mục đích' ||
    short === '3.7.1 Đính chính' ||
    short === '3.7.2 Đổi thông tin' ||
    (lower.includes('3.2.1') && !lower.includes('thuế')) ||
    lower.includes('3.5.1') ||
    lower.includes('3.6.1') ||
    lower.includes('3.7.1') ||
    lower.includes('3.7.2') ||
    (lower.includes('cấp đổi') && !lower.includes('thuế')) ||
    lower.includes('gia hạn') ||
    lower.includes('chuyển mục đích') ||
    lower.includes('đính chính') ||
    lower.includes('đổi thông tin')
  ) {
    return 'fast_track';
  }

  // 8. Đăng ký biến động có thuế (3.1.1, 3.1.2, 3.1.3, 3.2.2)
  if (
    short === '3.1.1 Chuyển quyền' ||
    short === '3.1.2 Phân chia quyền' ||
    short === '3.1.3 Theo Bản án / QĐ' ||
    short === '3.2.2 Cấp đổi (có thuế)' ||
    lower.includes('3.1.1') ||
    lower.includes('3.1.2') ||
    lower.includes('3.1.3') ||
    lower.includes('3.2.2') ||
    lower.includes('chuyển quyền') ||
    lower.includes('thừa kế') ||
    lower.includes('tặng cho') ||
    lower.includes('phân chia') ||
    lower.includes('bản án')
  ) {
    return 'tax_transfer';
  }

  // Trường hợp không khớp danh mục đăng ký hợp lệ: Báo unclassified, KHÔNG TỰ Ý CHUYỂN THUẾ!
  console.warn('[RegistrationWorkflow] Hồ sơ thiếu hoặc không khớp danh mục loại hợp lệ:', type);
  return 'unclassified';
};

/**
 * Lấy số ngày làm việc chuẩn theo từng loại thủ tục cụ thể thuộc nhóm 3.x
 */
export const getSpecificRegistrationDuration = (type: string | undefined | null): number => {
  if (!type || typeof type !== 'string' || !type.trim()) return 0;
  const short = getShortRecordType(type);
  const lower = type.toLowerCase().trim();

  // 3.8.2 Xóa ĐK GDBD / Giải chấp: 1 ngày làm việc
  if (short === '3.8.2 Xóa ĐK GDBD' || lower.includes('3.8.2') || lower.includes('xóa đk gdbd') || lower.includes('xóa thế chấp') || lower.includes('giải chấp')) {
    return 1;
  }
  // 3.8.1 Đăng ký GDBD / Thế chấp: 3 ngày làm việc
  if (short === '3.8.1 Đăng ký GDBD' || lower.includes('3.8.1') || lower.includes('đăng ký gdbd') || lower.includes('thế chấp')) {
    return 3;
  }
  // 3.6.1, 3.7.1, 3.7.2: 7 ngày làm việc
  if (
    short === '3.6.1 Chuyển mục đích' || short === '3.7.1 Đính chính' || short === '3.7.2 Đổi thông tin' ||
    lower.includes('3.6.1') || lower.includes('3.7.1') || lower.includes('3.7.2') ||
    lower.includes('chuyển mục đích') || lower.includes('đính chính') || lower.includes('đổi thông tin')
  ) {
    return 7;
  }
  // 3.2.1 Cấp đổi, 3.3.1 Cấp lại do mất (thời gian VPĐK): 10 ngày làm việc
  if (
    short === '3.2.1 Cấp đổi' || short === '3.3.1 Cấp lại' ||
    lower.includes('3.2.1') || lower.includes('3.3.1') ||
    (lower.includes('cấp lại') && !lower.includes('thuế'))
  ) {
    return 10;
  }
  // 3.5.1 Gia hạn: 12 ngày làm việc
  if (short === '3.5.1 Gia hạn' || lower.includes('3.5.1') || lower.includes('gia hạn')) {
    return 12;
  }
  // 3.1.1, 3.1.2, 3.1.3: 13 ngày làm việc
  if (
    short === '3.1.1 Chuyển quyền' || short === '3.1.2 Phân chia quyền' || short === '3.1.3 Theo Bản án / QĐ' ||
    lower.includes('3.1.1') || lower.includes('3.1.2') || lower.includes('3.1.3') ||
    lower.includes('chuyển quyền') || lower.includes('phân chia') || lower.includes('bản án')
  ) {
    return 13;
  }
  // 3.2.2 Cấp đổi có thuế, 3.3.2 Cấp lại có thuế: 15 ngày làm việc
  if (
    short === '3.2.2 Cấp đổi (có thuế)' || short === '3.3.2 Cấp lại (có thuế)' ||
    lower.includes('3.2.2') || lower.includes('3.3.2') ||
    (lower.includes('cấp lại') && lower.includes('thuế'))
  ) {
    return 15;
  }
  // 3.4.1 Tách - hợp thửa, 3.4.2 Tách thửa CQ: 17 ngày làm việc
  if (
    short === '3.4.1 Tách - hợp thửa' || short === '3.4.2 Tách thửa CQ' ||
    lower.includes('3.4.1') || lower.includes('3.4.2') ||
    lower.includes('tách') || lower.includes('hợp')
  ) {
    return 17;
  }
  return 0;
};

/**
 * Lấy cấu hình quy trình chi tiết theo loại hồ sơ
 */
export const getRegistrationWorkflow = (type: string | undefined | null): RegistrationWorkflowConfig => {
  const category = getRegistrationWorkflowCategory(type);
  switch (category) {
    case 'gdbd_release':
      return GDBD_RELEASE_WORKFLOW;
    case 'gdbd_register':
    case 'gdbd':
      return GDBD_REGISTER_WORKFLOW;
    case 'lost_cert':
      return LOST_CERT_WORKFLOW;
    case 'lost_cert_tax':
      return LOST_CERT_TAX_WORKFLOW;
    case 'split_plot':
      return SPLIT_PLOT_WORKFLOW;
    case 'fast_track':
      return FAST_TRACK_WORKFLOW;
    case 'tax_transfer':
      return TAX_TRANSFER_WORKFLOW;
    case 'unclassified':
    default:
      return UNCLASSIFIED_WORKFLOW;
  }
};

/**
 * Lấy vị trí index của trạng thái hiện tại trong chuỗi quy trình
 */
export const getWorkflowStepIndex = (currentStatus: RecordStatus, steps: WorkflowStep[]): number => {
  let mapped = currentStatus;
  if (mapped === RecordStatus.SIGNED) {
    mapped = RecordStatus.PENDING_HANDOVER;
  }
  if (mapped === RecordStatus.PENDING_POSTING) {
    mapped = RecordStatus.APPRAISAL;
  }
  if (mapped === RecordStatus.IN_PROGRESS || mapped === RecordStatus.ASSIGNED) {
    mapped = RecordStatus.APPRAISAL;
  }
  const idx = steps.findIndex((s) => s.key === mapped);
  if (idx !== -1) return idx;
  return 0;
};

/**
 * Kiểm tra xem một bước trong quy trình đã hoàn thành hay chưa
 */
export const isWorkflowStepCompleted = (
  currentStatus: RecordStatus,
  targetStepKey: RecordStatus,
  steps: WorkflowStep[]
): boolean => {
  const currentIndex = getWorkflowStepIndex(currentStatus, steps);
  const targetIndex = steps.findIndex((s) => s.key === targetStepKey);
  if (currentIndex === -1 || targetIndex === -1) return false;
  return targetIndex < currentIndex;
};

/**
 * Lấy bước tiếp theo trong quy trình
 */
export const getNextWorkflowStep = (
  currentStatus: RecordStatus,
  steps: WorkflowStep[]
): WorkflowStep | null => {
  const currentIndex = getWorkflowStepIndex(currentStatus, steps);
  if (currentIndex === -1) {
    // Nếu chưa xác định, gợi ý bước đầu tiên hoặc bước thứ 2
    return steps[1] || null;
  }
  if (currentIndex < steps.length - 1) {
    return steps[currentIndex + 1];
  }
  return null; // Đã là bước cuối cùng
};

/**
 * Lấy bước lùi lại trong quy trình
 */
export const getPrevWorkflowStep = (
  currentStatus: RecordStatus,
  steps: WorkflowStep[]
): WorkflowStep | null => {
  const currentIndex = getWorkflowStepIndex(currentStatus, steps);
  if (currentIndex > 0) {
    return steps[currentIndex - 1];
  }
  return null;
};

/**
 * Cấu trúc thông tin tính toán thời gian và cảnh báo SLA cho từng bước
 */
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

/**
 * Định dạng số giờ làm việc thành nhãn dễ đọc (VD: 4 giờ, 1 ngày, 2.5 ngày)
 */
export const formatWorkingHours = (hours: number): string => {
  const rounded = Math.round(hours * 10) / 10;
  if (rounded <= 0) return '0 giờ';
  if (rounded < 8) return `${rounded} giờ`;
  const days = Math.round((rounded / 8) * 10) / 10;
  return Number.isInteger(days) ? `${days} ngày` : `${days} ngày (${rounded}h)`;
};

/**
 * Tính số giờ làm việc hành chính giữa 2 mốc thời gian
 * - Giờ hành chính: Sáng 7:30 - 11:30 (4h), Chiều 13:00 - 17:00 (4h) = 8h/ngày
 * - Bỏ qua Thứ Bảy (6) và Chủ Nhật (0)
 */
export const calculateWorkingHours = (
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined = new Date()
): number => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return 0;
  }

  let totalMs = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  // Duyệt từng ngày
  while (current <= endDay) {
    const dayOfWeek = current.getDay();
    // Bỏ qua Thứ Bảy (6) và Chủ Nhật (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const curYear = current.getFullYear();
      const curMonth = current.getMonth();
      const curDate = current.getDate();

      // Buổi sáng: 7:30 - 11:30
      const morningStart = new Date(curYear, curMonth, curDate, 7, 30, 0);
      const morningEnd = new Date(curYear, curMonth, curDate, 11, 30, 0);

      const mStart = Math.max(start.getTime(), morningStart.getTime());
      const mEnd = Math.min(end.getTime(), morningEnd.getTime());
      if (mEnd > mStart) {
        totalMs += mEnd - mStart;
      }

      // Buổi chiều: 13:00 - 17:00
      const afternoonStart = new Date(curYear, curMonth, curDate, 13, 0, 0);
      const afternoonEnd = new Date(curYear, curMonth, curDate, 17, 0, 0);

      const aStart = Math.max(start.getTime(), afternoonStart.getTime());
      const aEnd = Math.min(end.getTime(), afternoonEnd.getTime());
      if (aEnd > aStart) {
        totalMs += aEnd - aStart;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  const totalHours = totalMs / (1000 * 60 * 60);
  return Math.round(totalHours * 10) / 10;
};

/**
 * Tính toán trạng thái SLA của một bước trong quy trình hồ sơ
 */
export const getStepSlaInfo = (
  record: RecordFile,
  targetStepKey?: RecordStatus
): StepSlaInfo | null => {
  const workflow = getRegistrationWorkflow(record.recordType);
  const currentStatus = record.status || RecordStatus.RECEIVED;
  const currentIndex = getWorkflowStepIndex(currentStatus, workflow.steps);

  const stepKey = targetStepKey || currentStatus;
  const stepIndex = workflow.steps.findIndex((s) => s.key === stepKey);
  if (stepIndex === -1) return null;

  const step = workflow.steps[stepIndex];
  const isCurrent = stepIndex === currentIndex;
  const isCompleted = currentIndex > stepIndex;
  const isWaiting = currentIndex < stepIndex;

  // Tìm thời điểm bắt đầu bước
  let startTime: string | null = null;
  let endTime: string | null = null;

  if (record.statusLogs && record.statusLogs.length > 0) {
    const enterLog = record.statusLogs.find((l) => l.newStatus === step.key);
    if (enterLog && enterLog.changedAt) {
      startTime = enterLog.changedAt;
    }
    if (isCompleted) {
      const nextLog = record.statusLogs.find(
        (l) => l.previousStatus === step.key && l.changedAt
      );
      if (nextLog && nextLog.changedAt) {
        endTime = nextLog.changedAt;
      }
    }
  }

  // Fallback từ các trường ngày trên record nếu chưa có statusLogs
  if (!startTime && step.dateField && record[step.dateField]) {
    const rawDate = record[step.dateField] as string;
    // Gán 7:30 sáng làm việc của ngày đó nếu chỉ có YYYY-MM-DD
    startTime = rawDate.length === 10 ? `${rawDate}T07:30:00` : rawDate;
  }

  if (!startTime && isCurrent) {
    if (record.receivedDate) {
      const rawDate = record.receivedDate;
      startTime = rawDate.length === 10 ? `${rawDate}T07:30:00` : rawDate;
    } else if (record.assignedDate) {
      const rawDate = record.assignedDate;
      startTime = rawDate.length === 10 ? `${rawDate}T07:30:00` : rawDate;
    }
  }

  // Đang ở trạng thái bổ sung hoặc giai đoạn liên thông thuế / niêm yết xã
  const isSpecialSupplement =
    record.status === RecordStatus.PENDING_SUPPLEMENT ||
    record.status === RecordStatus.WITHDRAWN ||
    record.status === RecordStatus.REJECTED;

  const isTaxPhase = !!step.isTaxPhase;
  const isPostingPhase = !!step.isPostingPhase;
  const isPausedPhase = isSpecialSupplement || isTaxPhase || isPostingPhase;

  if (isWaiting) {
    return {
      step,
      durationHours: step.durationHours,
      durationDays: step.durationDays,
      durationLabel: step.durationLabel,
      elapsedHours: 0,
      elapsedLabel: '0 giờ',
      remainingHours: step.durationHours,
      remainingLabel: (isTaxPhase || isPostingPhase) ? 'Không tính quy trình' : step.durationLabel,
      status: 'waiting',
      isOverdue: false,
      overdueHours: 0,
      overdueLabel: '',
      percent: 0,
      startTime: null,
    };
  }

  if (isCompleted) {
    const elapsedHours = startTime
      ? calculateWorkingHours(startTime, endTime || undefined)
      : 0;
    return {
      step,
      durationHours: step.durationHours,
      durationDays: step.durationDays,
      durationLabel: step.durationLabel,
      elapsedHours,
      elapsedLabel: isTaxPhase
        ? `Liên thông (${formatWorkingHours(elapsedHours)})`
        : isPostingPhase
        ? `Niêm yết (${formatWorkingHours(elapsedHours)})`
        : formatWorkingHours(elapsedHours),
      remainingHours: 0,
      remainingLabel: '0 giờ',
      status: 'completed',
      isOverdue: false,
      overdueHours: 0,
      overdueLabel: '',
      percent: 100,
      startTime,
    };
  }

  // Bước hiện tại
  if (isPausedPhase) {
    const elapsedHours = startTime ? calculateWorkingHours(startTime) : 0;
    let label = 'Tạm dừng';
    let remaining = 'Tạm dừng tính hạn';
    if (isTaxPhase) {
      label = `Liên thông (${formatWorkingHours(elapsedHours)})`;
      remaining = 'Liên thông thuế (Không tính hạn quy trình)';
    } else if (isPostingPhase) {
      label = `Đang niêm yết (${formatWorkingHours(elapsedHours)})`;
      remaining = 'Niêm yết tại UBND xã (Không tính hạn VPĐK)';
    }

    return {
      step,
      durationHours: step.durationHours,
      durationDays: step.durationDays,
      durationLabel: (isTaxPhase || isPostingPhase) ? 'Không tính hạn' : step.durationLabel,
      elapsedHours,
      elapsedLabel: label,
      remainingHours: 0,
      remainingLabel: remaining,
      status: 'paused',
      isOverdue: false,
      overdueHours: 0,
      overdueLabel: '',
      percent: 0,
      startTime,
    };
  }

  const elapsedHours = startTime ? calculateWorkingHours(startTime) : 0;
  const isOverdue = step.durationHours > 0 && elapsedHours > step.durationHours;
  const overdueHours = isOverdue ? Math.round((elapsedHours - step.durationHours) * 10) / 10 : 0;
  const remainingHours = Math.max(0, Math.round((step.durationHours - elapsedHours) * 10) / 10);

  const percent =
    step.durationHours > 0
      ? Math.min(100, Math.round((elapsedHours / step.durationHours) * 100))
      : 100;

  let status: 'ontime' | 'warning' | 'overdue' = 'ontime';
  if (isOverdue) {
    status = 'overdue';
  } else if (step.durationHours > 0 && elapsedHours >= step.durationHours * 0.75) {
    status = 'warning';
  }

  return {
    step,
    durationHours: step.durationHours,
    durationDays: step.durationDays,
    durationLabel: step.durationLabel,
    elapsedHours,
    elapsedLabel: formatWorkingHours(elapsedHours),
    remainingHours,
    remainingLabel: formatWorkingHours(remainingHours),
    status,
    isOverdue,
    overdueHours,
    overdueLabel: isOverdue ? `Trễ ${formatWorkingHours(overdueHours)}` : '',
    percent,
    startTime,
  };
};

/**
 * Cấu trúc ngày hẹn giải quyết (2 Giai đoạn: Hẹn lấy TB Thuế và Hẹn Trả kết quả GCN)
 */
export interface AppointmentInfo {
  phase: 'tax_notice' | 'final_result' | 'unclassified';
  label: string;
  shortLabel: string;
  appointmentDate: string; // YYYY-MM-DD
  formattedAppointmentDate: string; // DD/MM/YYYY
  badgeColor: string;
  description: string;
  isTaxPhase: boolean;
  isPostingPhase: boolean;
}

/**
 * Định dạng chuỗi ngày YYYY-MM-DD thành DD/MM/YYYY
 */
export const formatDateToVN = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  if (dateStr.includes('/')) return dateStr;
  const d = parseSafeDate(dateStr);
  if (!d) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Cộng số ngày lịch (calendar days) từ một mốc ngày
 */
export const addCalendarDays = (startDateStr: string | Date | null | undefined, daysToAdd: number): string => {
  if (!startDateStr) return '';
  const start = parseSafeDate(startDateStr) || new Date();
  const d = new Date(start.getTime());
  d.setDate(d.getDate() + daysToAdd);
  return formatDateKey(d);
};

/**
 * Cộng số ngày làm việc hành chính (bỏ qua Thứ 7, Chủ Nhật và các ngày nghỉ lễ)
 */
export const addWorkingDays = (
  startDateStr: string | Date | null | undefined,
  daysToAdd: number,
  holidays: any[] = DEFAULT_HOLIDAYS
): string => {
  if (!startDateStr) return '';
  const parsedStart = parseSafeDate(startDateStr);
  if (!parsedStart) return '';
  if (daysToAdd <= 0) return formatDateKey(parsedStart);
  
  const startDate = new Date(parsedStart.getTime());
  let currentDate = new Date(startDate.getTime());
  
  const holidaySet = new Set<string>();
  const currentYear = startDate.getFullYear();
  const yearsToCheck = [currentYear, currentYear + 1];

  const effectiveHolidays = (Array.isArray(holidays) && holidays.length > 0) ? holidays : DEFAULT_HOLIDAYS;

  if (effectiveHolidays && effectiveHolidays.length > 0) {
    effectiveHolidays.forEach(h => {
      yearsToCheck.forEach(year => {
        if (h.isLunar) {
          const solarDate = getSolarDateFromLunar(h.day, h.month, year);
          if (solarDate) holidaySet.add(formatDateKey(solarDate));
        } else {
          const solarDate = new Date(year, h.month - 1, h.day);
          holidaySet.add(formatDateKey(solarDate));
        }
      });
    });
  }

  let count = 0;
  while (count < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay();
    const dateString = formatDateKey(currentDate);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(dateString);

    if (!isWeekend && !isHoliday) {
      count++;
    }
  }

  return formatDateKey(currentDate);
};

/**
 * Đếm số ngày làm việc hành chính giữa 2 mốc thời gian (loại trừ T7, CN, ngày lễ)
 * Phục vụ tính thời gian tạm dừng (PAUSE) để gia hạn deadline khi RESUME
 */
export const calculateWorkingDaysBetween = (
  startDateStr: string | Date | null | undefined,
  endDateStr: string | Date | null | undefined,
  holidays: any[] = DEFAULT_HOLIDAYS
): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = parseSafeDate(startDateStr);
  const end = parseSafeDate(endDateStr);
  if (!start || !end || start >= end) return 0;

  const holidaySet = new Set<string>();
  const currentYear = start.getFullYear();
  const yearsToCheck = [currentYear, currentYear + 1, end.getFullYear()];
  const effectiveHolidays = (Array.isArray(holidays) && holidays.length > 0) ? holidays : DEFAULT_HOLIDAYS;

  effectiveHolidays.forEach(h => {
    yearsToCheck.forEach(year => {
      if (h.isLunar) {
        const solarDate = getSolarDateFromLunar(h.day, h.month, year);
        if (solarDate) holidaySet.add(formatDateKey(solarDate));
      } else {
        const solarDate = new Date(year, h.month - 1, h.day);
        holidaySet.add(formatDateKey(solarDate));
      }
    });
  });

  let workingDays = 0;
  const cur = new Date(start.getTime());
  cur.setHours(0, 0, 0, 0);
  const endBoundary = new Date(end.getTime());
  endBoundary.setHours(0, 0, 0, 0);

  while (cur < endBoundary) {
    cur.setDate(cur.getDate() + 1);
    const dayOfWeek = cur.getDay();
    const dateStr = formatDateKey(cur);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      workingDays++;
    }
  }

  return workingDays;
};

export interface RegistrationDeadlineResult {
  deadline: string;
  appointmentDate: string;
  category: RegistrationWorkflowCategory;
  workingDays: number;
  hasPostingNotice: boolean;
  postingEndDate?: string;
  description: string;
  phase: 'tax_notice' | 'final_result' | 'unclassified';
}

/**
 * SINGLE SOURCE OF TRUTH: Tính toán Deadline và Ngày hẹn cho toàn bộ Module Đăng ký / Cấp giấy
 * Tuân thủ nghiêm ngặt 4 loại thời gian và quy chế phối hợp:
 * 1. Fast-track (3.2.1: 10 ngày, 3.5.1: 12 ngày, 3.6.1: 7 ngày, 3.7.1: 7 ngày, 3.7.2: 7 ngày)
 * 2. GDBD Xóa thế chấp (3.8.2): 1 ngày làm việc (8 giờ)
 * 3. GDBD Đăng ký thế chấp (3.8.1): 3 ngày làm việc (24 giờ)
 * 4. Tách - hợp thửa (3.4.1, 3.4.2): 17 ngày làm việc
 * 5. Cấp lại mất không thuế (3.3.1): 10 ngày làm việc VPĐK + 30 ngày niêm yết (tính từ postingDate)
 * 6. Cấp lại mất có thuế (3.3.2): 15 ngày làm việc VPĐK + 30 ngày niêm yết
 * 7. Có thuế thông thường (3.1.1, 3.1.2, 3.1.3: 13 ngày; 3.2.2: 15 ngày)
 *    - Giai đoạn 1 (Chưa nộp thuế): Hẹn lấy TB Thuế = receivedDate + 5 ngày làm việc
 *    - Hạn xử lý chuẩn (deadline): receivedDate + statutory workingDays
 * 8. Chưa phân loại: Trả về rỗng, KHÔNG tự ý default sang thuế!
 */
export const calculateRegistrationDeadline = (
  record: Partial<RecordFile>,
  holidays: any[] = DEFAULT_HOLIDAYS
): RegistrationDeadlineResult => {
  const category = getRegistrationWorkflowCategory(record.recordType);
  const workingDays = getSpecificRegistrationDuration(record.recordType);

  if (category === 'unclassified' || workingDays === 0) {
    return {
      deadline: '',
      appointmentDate: '',
      category: 'unclassified',
      workingDays: 0,
      hasPostingNotice: false,
      description: 'Hồ sơ chưa được phân loại quy trình hợp lệ, cần bổ sung loại hồ sơ để tính thời hạn.',
      phase: 'unclassified',
    };
  }

  const receivedDate = record.receivedDate ? record.receivedDate.split('T')[0] : '';
  if (!receivedDate) {
    return {
      deadline: '',
      appointmentDate: '',
      category,
      workingDays,
      hasPostingNotice: category === 'lost_cert' || category === 'lost_cert_tax',
      description: 'Chưa có ngày tiếp nhận hồ sơ.',
      phase: 'unclassified',
    };
  }

  // 1. Cấp lại do mất (3.3.1 & 3.3.2): Bắt buộc có postingDate (30 ngày niêm yết + workingDays)
  if (category === 'lost_cert' || category === 'lost_cert_tax') {
    let postingEndDate: string | undefined = undefined;
    if (record.postingEndDate) {
      postingEndDate = record.postingEndDate.split('T')[0];
    } else if (record.postingDate) {
      postingEndDate = addCalendarDays(record.postingDate.split('T')[0], 30);
    }

    if (postingEndDate) {
      const deadline = addWorkingDays(postingEndDate, workingDays, holidays);
      const isTaxPaid = Boolean(record.taxPaymentDate);
      const isLostCertTax = category === 'lost_cert_tax';
      const postTaxStatuses = [
        RecordStatus.PENDING_PRINT_CERT,
        RecordStatus.PENDING_CHECK,
        RecordStatus.PENDING_SIGN,
        RecordStatus.PENDING_HANDOVER,
        RecordStatus.HANDOVER,
        RecordStatus.RETURNED,
      ];
      const isPostTax = isTaxPaid || postTaxStatuses.includes(record.status as RecordStatus);

      let phase: 'tax_notice' | 'final_result' = 'final_result';
      let appointmentDate = deadline;

      if (isLostCertTax && !isPostTax) {
        phase = 'tax_notice';
        appointmentDate = addWorkingDays(postingEndDate, 5, holidays);
      }

      return {
        deadline,
        appointmentDate,
        category,
        workingDays,
        hasPostingNotice: true,
        postingEndDate,
        description: isLostCertTax && !isPostTax
          ? 'Hẹn lấy Thông báo thuế (30 ngày niêm yết tại UBND xã + 5 ngày làm việc chuyển và xác định thuế)'
          : `Hẹn trả kết quả Cấp lại GCN do mất (30 ngày niêm yết tại UBND xã + ${workingDays} ngày làm việc Chi nhánh)`,
        phase,
      };
    }

    // Chưa có postingDate: Không tính bừa deadline
    return {
      deadline: '',
      appointmentDate: '',
      category,
      workingDays,
      hasPostingNotice: true,
      description: 'Chờ xác định ngày niêm yết công khai tại UBND cấp xã (30 ngày lịch theo Điều 36 NĐ 101/2024).',
      phase: category === 'lost_cert_tax' ? 'tax_notice' : 'final_result',
    };
  }

  // 2. Có thuế thông thường (3.1.1, 3.1.2, 3.1.3, 3.2.2)
  if (category === 'tax_transfer') {
    const statutoryDeadline = addWorkingDays(receivedDate, workingDays, holidays);
    const isTaxPaid = Boolean(record.taxPaymentDate);
    const postTaxStatuses = [
      RecordStatus.PENDING_PRINT_CERT,
      RecordStatus.PENDING_CHECK,
      RecordStatus.PENDING_SIGN,
      RecordStatus.PENDING_HANDOVER,
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
    ];
    const isPostTax = isTaxPaid || postTaxStatuses.includes(record.status as RecordStatus);

    if (isPostTax) {
      return {
        deadline: statutoryDeadline,
        appointmentDate: statutoryDeadline,
        category,
        workingDays,
        hasPostingNotice: false,
        description: `Hẹn trả kết quả Giấy chứng nhận (${workingDays} ngày làm việc theo quy định)`,
        phase: 'final_result',
      };
    }

    // Giai đoạn 1: Chờ thông báo thuế (5 ngày làm việc từ ngày tiếp nhận)
    const taxNoticeDate = addWorkingDays(receivedDate, 5, holidays);
    return {
      deadline: statutoryDeadline,
      appointmentDate: taxNoticeDate,
      category,
      workingDays,
      hasPostingNotice: false,
      description: 'Hẹn lấy Thông báo nộp thuế (5 ngày làm việc từ ngày tiếp nhận hồ sơ)',
      phase: 'tax_notice',
    };
  }

  // 3. Các luồng không thuế khác (fast_track, gdbd_register, gdbd_release, split_plot)
  const deadline = addWorkingDays(receivedDate, workingDays, holidays);
  return {
    deadline,
    appointmentDate: deadline,
    category,
    workingDays,
    hasPostingNotice: false,
    description: `Hẹn trả kết quả theo quy định (${workingDays} ngày làm việc)`,
    phase: 'final_result',
  };
};

/**
 * Tính toán Ngày hẹn trả kết quả theo nghiệp vụ 2 giai đoạn (Hẹn TB Thuế & Hẹn Trả GCN)
 * Trực tiếp sử dụng calculateRegistrationDeadline để đảm bảo 100% đồng nhất
 */
export const getAppointmentInfo = (
  record: RecordFile,
  holidays: any[] = DEFAULT_HOLIDAYS
): AppointmentInfo => {
  const calc = calculateRegistrationDeadline(record, holidays);
  const category = getRegistrationWorkflowCategory(record.recordType);

  if (calc.phase === 'tax_notice') {
    return {
      phase: 'tax_notice',
      label: 'Ngày hẹn lấy Thông báo thuế (Dự kiến)',
      shortLabel: 'Hẹn lấy TB Thuế',
      appointmentDate: calc.appointmentDate,
      formattedAppointmentDate: formatDateToVN(calc.appointmentDate),
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      description: calc.description,
      isTaxPhase: true,
      isPostingPhase: (category === 'lost_cert' || category === 'lost_cert_tax') && record.status === RecordStatus.APPRAISAL,
    };
  }

  return {
    phase: calc.phase,
    label: calc.phase === 'unclassified' ? 'Chưa phân loại' : 'Ngày hẹn Trả kết quả (Dự kiến)',
    shortLabel: calc.phase === 'unclassified' ? 'Chưa phân loại' : 'Hẹn trả GCN',
    appointmentDate: calc.appointmentDate,
    formattedAppointmentDate: formatDateToVN(calc.appointmentDate),
    badgeColor: calc.phase === 'unclassified'
      ? 'bg-slate-100 text-slate-700 border-slate-300'
      : 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: calc.description,
    isTaxPhase: false,
    isPostingPhase: (category === 'lost_cert' || category === 'lost_cert_tax') && record.status === RecordStatus.APPRAISAL,
  };
};
