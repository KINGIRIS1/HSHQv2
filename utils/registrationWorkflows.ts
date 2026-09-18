import { RecordStatus, RecordFile } from '../types';
import { getShortRecordType, DEFAULT_HOLIDAYS } from '../constants';
import { parseSafeDate, formatDateKey, getSolarDateFromLunar, calculateDeadlineHelper } from './appHelpers';

export type RegistrationWorkflowCategory = 
  | 'tax_transfer'   // Có nghĩa vụ tài chính (chuyển thuế, chờ GNT)
  | 'fast_track'     // Đăng ký biến động không thuế (cấp đổi, đính chính, đổi TT)
  | 'gdbd'           // Giao dịch bảo đảm / Thế chấp (nhanh 1-3 ngày)
  | 'lost_cert'      // Cấp lại do mất không thuế (có niêm yết 30 ngày)
  | 'lost_cert_tax'  // Cấp lại do mất có thuế (có niêm yết 30 ngày + chuyển thuế)
  | 'split_plot';    // Tách - hợp thửa đất

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
      description: 'Giai đoạn liên thông thuế: Không tính vào thời gian giải quyết của Chi nhánh',
      dateField: 'taxTransferDate',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Không tính hạn',
      isTaxPhase: true,
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
      durationHours: 72, // 104h - (4h tiếp nhận + 8h thẩm định + 8h kiểm tra + 4h trình ký + 4h ký + 4h bàn giao) = 72h = 9 ngày
      durationDays: 9,
      durationLabel: '9 ngày',
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

// 3. Luồng Giao dịch bảo đảm: 3.8.1, 3.8.2 (Tổng 3 ngày = 24 giờ làm việc)
const GDBD_WORKFLOW: RegistrationWorkflowConfig = {
  category: 'gdbd',
  title: 'Quy trình Đăng ký Giao dịch bảo đảm / Thế chấp',
  subtitle: 'Áp dụng cho Đăng ký thế chấp (3 ngày) và Xóa đăng ký thế chấp (1 ngày)',
  standardDays: 3,
  steps: [
    {
      key: RecordStatus.RECEIVED,
      label: 'Tiếp nhận hồ sơ',
      shortLabel: 'Tiếp nhận',
      description: 'Tiếp nhận đơn yêu cầu đăng ký biện pháp bảo đảm / xóa đăng ký và hợp đồng thế chấp',
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
      description: 'Trình lãnh đạo Chi nhánh ký chứng nhận ĐKBPBĐ hoặc xác nhận xóa thế chấp',
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
      durationHours: 0,
      durationDays: 0,
      durationLabel: 'Không tính hạn',
      isTaxPhase: true,
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
      durationHours: 72, // 104h - (4h + 8h + 8h + 4h + 4h + 4h) = 72h = 9 ngày
      durationDays: 9,
      durationLabel: '9 ngày',
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

/**
 * Xác định phân loại luồng quy trình dựa trên loại hồ sơ
 */
export const getRegistrationWorkflowCategory = (type: string | undefined | null): RegistrationWorkflowCategory => {
  if (!type) return 'tax_transfer';
  const short = getShortRecordType(type);
  const lower = type.toLowerCase().trim();

  // 1. Giao dịch bảo đảm / Thế chấp (3.8.1, 3.8.2)
  if (
    short.startsWith('3.8') ||
    lower.includes('3.8.1') ||
    lower.includes('3.8.2') ||
    lower.includes('gdbd') ||
    lower.includes('thế chấp') ||
    lower.includes('giải chấp')
  ) {
    return 'gdbd';
  }

  // 2. Cấp lại do mất có thuế (3.3.2)
  if (
    short === '3.3.2 Cấp lại có thuế' ||
    lower.includes('3.3.2') ||
    (lower.includes('cấp lại') && (lower.includes('có thuế') || lower.includes('phát sinh thuế') || lower.includes('chuyển thuế')))
  ) {
    return 'lost_cert_tax';
  }

  // 3. Cấp lại do mất không thuế (3.3.1)
  if (
    short === '3.3.1 Cấp lại' ||
    (lower.includes('3.3.1') && !lower.includes('thuế')) ||
    (lower.includes('cấp lại') && lower.includes('mất') && !lower.includes('thuế'))
  ) {
    return 'lost_cert';
  }

  // 4. Tách - Hợp thửa (3.4.1) - tách thông thường không chuyển quyền
  if (
    short === '3.4.1 Tách - hợp thửa' ||
    (lower.includes('3.4.1') && !lower.includes('cq')) ||
    (lower.includes('tách') && lower.includes('hợp') && !lower.includes('cq'))
  ) {
    return 'split_plot';
  }

  // 5. Đăng ký biến động không thuế (3.2.1, 3.5.1, 3.7.1, 3.7.2)
  if (
    short === '3.2.1 Cấp đổi' ||
    short === '3.5.1 Gia hạn' ||
    short === '3.7.1 Đính chính' ||
    short === '3.7.2 Đổi thông tin' ||
    (lower.includes('3.2.1') && !lower.includes('thuế')) ||
    lower.includes('3.5.1') ||
    lower.includes('3.7.1') ||
    lower.includes('3.7.2') ||
    lower.includes('gia hạn') ||
    lower.includes('đính chính') ||
    lower.includes('đổi thông tin')
  ) {
    return 'fast_track';
  }

  // 6. Mặc định là Luồng Có thuế (3.1.1, 3.1.2, 3.1.3, 3.2.2, 3.4.2, 3.6.1)
  return 'tax_transfer';
};

/**
 * Lấy cấu hình quy trình chi tiết theo loại hồ sơ
 */
export const getRegistrationWorkflow = (type: string | undefined | null): RegistrationWorkflowConfig => {
  const category = getRegistrationWorkflowCategory(type);
  switch (category) {
    case 'gdbd':
      return GDBD_WORKFLOW;
    case 'lost_cert':
      return LOST_CERT_WORKFLOW;
    case 'lost_cert_tax':
      return LOST_CERT_TAX_WORKFLOW;
    case 'split_plot':
      return SPLIT_PLOT_WORKFLOW;
    case 'fast_track':
      return FAST_TRACK_WORKFLOW;
    case 'tax_transfer':
    default:
      return TAX_TRANSFER_WORKFLOW;
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
  phase: 'tax_notice' | 'final_result';
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
 * Tính toán Ngày hẹn trả kết quả theo nghiệp vụ 2 giai đoạn (Hẹn TB Thuế & Hẹn Trả GCN)
 */
export const getAppointmentInfo = (
  record: RecordFile,
  holidays: any[] = DEFAULT_HOLIDAYS
): AppointmentInfo => {
  const category = getRegistrationWorkflowCategory(record.recordType);
  const isTaxCategory = category === 'tax_transfer' || category === 'lost_cert_tax';
  const receivedDate = record.receivedDate || formatDateKey(new Date());

  const isTaxPaid = Boolean(record.taxPaymentDate);
  const postTaxStatuses = [
    RecordStatus.PENDING_PRINT_CERT,
    RecordStatus.PENDING_CHECK,
    RecordStatus.PENDING_SIGN,
    RecordStatus.SIGNED,
    RecordStatus.HANDOVER,
    RecordStatus.RETURNED,
  ];
  const isPostTaxStatus = postTaxStatuses.includes(record.status);

  // Giai đoạn 1: Hồ sơ có thuế nhưng chưa nộp thuế (chờ TB thuế / chờ nộp tiền)
  if (isTaxCategory && !isTaxPaid && !isPostTaxStatus) {
    let appDate = '';
    let desc = '';

    if (category === 'lost_cert_tax') {
      // 3.3.2 Cấp lại có thuế: 30 ngày niêm yết xã + 5 ngày làm việc xác định thuế
      const postingEndDate = record.postingEndDate || addCalendarDays(receivedDate, 30);
      appDate = addWorkingDays(postingEndDate, 5, holidays);
      desc = 'Ngày hẹn dự kiến lấy Thông báo thuế (Bao gồm 30 ngày niêm yết tại UBND xã + 5 ngày làm việc xác định thuế)';
    } else {
      // 3.1.x, 3.2.2, 3.4.2, 3.6.1... các thủ tục có thuế thông thường: 5 ngày làm việc
      appDate = addWorkingDays(receivedDate, 5, holidays);
      desc = 'Ngày hẹn dự kiến lấy Thông báo thuế (5 ngày làm việc từ ngày tiếp nhận hồ sơ)';
    }

    return {
      phase: 'tax_notice',
      label: 'Ngày hẹn lấy Thông báo thuế (Dự kiến)',
      shortLabel: 'Hẹn lấy TB Thuế',
      appointmentDate: appDate,
      formattedAppointmentDate: formatDateToVN(appDate),
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      description: desc,
      isTaxPhase: true,
      isPostingPhase: category === 'lost_cert_tax' && record.status === RecordStatus.PENDING_POSTING,
    };
  }

  // Giai đoạn 2: Đã nộp tiền thuế (hoặc Hồ sơ thuộc luồng Không phát sinh thuế) -> Trả kết quả GCN
  let appDate = '';
  let desc = '';

  if (isTaxCategory) {
    // Đã nộp thuế: Tính từ ngày nộp thuế + 10 ngày làm việc xử lý còn lại của VPĐK
    const baseDate = record.taxPaymentDate || record.printCertDate || receivedDate;
    appDate = addWorkingDays(baseDate, 10, holidays);
    desc = 'Ngày hẹn dự kiến Trả kết quả Giấy chứng nhận (10 ngày làm việc sau khi công dân nộp Giấy nộp tiền thuế)';
  } else if (category === 'lost_cert') {
    // 3.3.1 Cấp lại không thuế: 30 ngày niêm yết xã + 10 ngày làm việc VPĐK
    const postingEndDate = record.postingEndDate || addCalendarDays(receivedDate, 30);
    appDate = addWorkingDays(postingEndDate, 10, holidays);
    desc = 'Ngày hẹn dự kiến Trả kết quả (Bao gồm 30 ngày niêm yết tại UBND xã + 10 ngày làm việc của Chi nhánh)';
  } else {
    // Thủ tục không thuế tiêu chuẩn (Chuyển quyền không thuế, Cấp đổi không thuế, Thế chấp...)
    appDate = record.deadline || calculateDeadlineHelper(record.recordType || '', receivedDate, holidays);
    desc = 'Ngày hẹn dự kiến Trả kết quả theo quy định Chi nhánh';
  }

  return {
    phase: 'final_result',
    label: 'Ngày hẹn Trả kết quả (Dự kiến)',
    shortLabel: 'Hẹn trả GCN',
    appointmentDate: appDate,
    formattedAppointmentDate: formatDateToVN(appDate),
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: desc,
    isTaxPhase: false,
    isPostingPhase: category === 'lost_cert' && record.status === RecordStatus.PENDING_POSTING,
  };
};
