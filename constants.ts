
import { RecordStatus, Employee, RecordFile, User, UserRole, Contract, AttachedDocItem } from './types';

// CẤU HÌNH KẾT NỐI
// QUAN TRỌNG: Để dùng Cloud (Supabase), hãy dán URL dự án vào đây.
// Nếu dùng Mạng LAN (Local), đổi lại thành 'http://localhost:3005'
export const API_BASE_URL = 'https://lrnfdksqepztnihrkgrr.supabase.co'; 

// PHÒNG BAN & CHỨC VỤ CHUẨN HÓA CỐ ĐỊNH
export const DEPARTMENTS = [
  'Ban Giám đốc',
  'Tổ Lưu trữ',
  'Tổ Đo đạc',
  'Tổ Cấp giấy',
  'Tổ Hành chính'
] as const;

export type DepartmentType = typeof DEPARTMENTS[number];

export const POSITIONS = [
  'Giám Đốc',
  'Phó Giám Đốc',
  'Tổ Trưởng',
  'Tổ Phó',
  'Viên chức',
  'Nhân viên'
] as const;

export type PositionType = typeof POSITIONS[number];

// PHIÊN BẢN HIỆN TẠI CỦA ỨNG DỤNG
export const APP_VERSION = '2.1.3';

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận mới',
  [RecordStatus.ASSIGNED]: 'Giao nhân viên',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.FIELD_WORK]: 'Đo đạc thực địa',
  [RecordStatus.OFFICE_WORK]: 'Biên tập bản đồ',
  [RecordStatus.COMPLETED_WORK]: 'Đã thực hiện',
  [RecordStatus.PENDING_SUPPLEMENT]: 'Chờ bổ sung',
  [RecordStatus.PENDING_CHECK]: 'Chờ kiểm tra',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký duyệt',
  [RecordStatus.SIGNED]: 'Chờ bàn giao',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.WITHDRAWN]: 'CSD rút hồ sơ',
  [RecordStatus.REJECTED]: 'Trả hồ sơ',

  // Nhãn hiển thị cho Module Cấp giấy
  [RecordStatus.APPRAISAL]: 'Chờ thẩm định',
  [RecordStatus.PENDING_POSTING]: 'Chờ niêm yết (30 ngày)',
  [RecordStatus.TAX_TRANSFER]: 'Chờ chuyển thuế',
  [RecordStatus.PENDING_TAX_KV7]: 'Chờ thuế khu vực 7',
  [RecordStatus.PENDING_TAX_NOTICE]: 'Chờ Thông báo thuế',
  [RecordStatus.PENDING_TAX_PAYMENT]: 'Chờ Giấy nộp tiền',
  [RecordStatus.PENDING_PRINT_CERT]: 'Chờ in giấy chứng nhận',
  [RecordStatus.PENDING_HANDOVER]: 'Chờ bàn giao',
};

export const CAP_GIAY_SELECTABLE_STATUSES: { key: RecordStatus; label: string }[] = [
  { key: RecordStatus.RECEIVED, label: 'Tiếp nhận hồ sơ' },
  { key: RecordStatus.APPRAISAL, label: 'Chờ thẩm định' },
  { key: RecordStatus.PENDING_POSTING, label: 'Niêm yết tại xã (30 ngày)' },
  { key: RecordStatus.TAX_TRANSFER, label: 'Chờ chuyển thuế' },
  { key: RecordStatus.PENDING_TAX_KV7, label: 'Chờ thuế khu vực 7' },
  { key: RecordStatus.PENDING_TAX_NOTICE, label: 'Chờ thông báo thuế' },
  { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Chờ giấy nộp tiền' },
  { key: RecordStatus.PENDING_PRINT_CERT, label: 'Chờ in giấy chứng nhận' },
  { key: RecordStatus.PENDING_CHECK, label: 'Chờ kiểm tra' },
  { key: RecordStatus.PENDING_SIGN, label: 'Chờ ký duyệt' },
  { key: RecordStatus.PENDING_HANDOVER, label: 'Chờ bàn giao' },
  { key: RecordStatus.HANDOVER, label: 'Đã giao 1 cửa' },
  { key: RecordStatus.RETURNED, label: 'Đã trả kết quả' },
  { key: RecordStatus.PENDING_SUPPLEMENT, label: 'Chờ bổ sung' },
  { key: RecordStatus.WITHDRAWN, label: 'CSD rút hồ sơ' },
  { key: RecordStatus.REJECTED, label: 'Huỷ hồ sơ' },
];

export const SELECTABLE_STATUSES: { key: RecordStatus; label: string }[] = [
  { key: RecordStatus.RECEIVED, label: 'Tiếp nhận mới' },
  { key: RecordStatus.IN_PROGRESS, label: 'Đang thực hiện' },
  { key: RecordStatus.FIELD_WORK, label: 'Đo đạc thực địa' },
  { key: RecordStatus.OFFICE_WORK, label: 'Biên tập bản đồ' },
  { key: RecordStatus.PENDING_SUPPLEMENT, label: 'Chờ bổ sung' },
  { key: RecordStatus.PENDING_CHECK, label: 'Chờ kiểm tra' },
  { key: RecordStatus.PENDING_SIGN, label: 'Chờ ký duyệt' },
  { key: RecordStatus.SIGNED, label: 'Chờ bàn giao' },
  { key: RecordStatus.HANDOVER, label: 'Đã giao 1 cửa' },
  { key: RecordStatus.RETURNED, label: 'Đã trả kết quả' },
  { key: RecordStatus.WITHDRAWN, label: 'CSD rút hồ sơ' },
  { key: RecordStatus.REJECTED, label: 'Trả hồ sơ' },
];

export const ARCHIVE_SELECTABLE_STATUSES: { key: RecordStatus; label: string }[] = [
  { key: RecordStatus.RECEIVED, label: 'Tiếp nhận mới' },
  { key: RecordStatus.IN_PROGRESS, label: 'Đang thực hiện' },
  { key: RecordStatus.PENDING_SUPPLEMENT, label: 'Chờ bổ sung' },
  { key: RecordStatus.PENDING_SIGN, label: 'Chờ ký duyệt' },
  { key: RecordStatus.SIGNED, label: 'Chờ bàn giao' },
  { key: RecordStatus.HANDOVER, label: 'Đã giao 1 cửa' },
  { key: RecordStatus.RETURNED, label: 'Đã trả kết quả' },
  { key: RecordStatus.WITHDRAWN, label: 'CSD rút hồ sơ' },
  { key: RecordStatus.REJECTED, label: 'Trả hồ sơ' },
];

export const SURVEY_SELECTABLE_STATUSES: { key: RecordStatus; label: string }[] = [
  { key: RecordStatus.RECEIVED, label: 'Tiếp nhận mới' },
  { key: RecordStatus.FIELD_WORK, label: 'Đo đạc thực địa' },
  { key: RecordStatus.OFFICE_WORK, label: 'Biên tập bản đồ' },
  { key: RecordStatus.PENDING_SUPPLEMENT, label: 'Chờ bổ sung' },
  { key: RecordStatus.PENDING_CHECK, label: 'Chờ kiểm tra' },
  { key: RecordStatus.PENDING_SIGN, label: 'Chờ ký duyệt' },
  { key: RecordStatus.SIGNED, label: 'Chờ bàn giao' },
  { key: RecordStatus.HANDOVER, label: 'Đã giao 1 cửa' },
  { key: RecordStatus.RETURNED, label: 'Đã trả kết quả' },
  { key: RecordStatus.WITHDRAWN, label: 'CSD rút hồ sơ' },
  { key: RecordStatus.REJECTED, label: 'Trả hồ sơ' },
];

export const STATUS_COLORS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'bg-gray-100 text-gray-800',
  [RecordStatus.ASSIGNED]: 'bg-blue-100 text-blue-800',
  [RecordStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [RecordStatus.FIELD_WORK]: 'bg-sky-100 text-sky-800 border border-sky-200',
  [RecordStatus.OFFICE_WORK]: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  [RecordStatus.COMPLETED_WORK]: 'bg-cyan-100 text-cyan-800',
  [RecordStatus.PENDING_SUPPLEMENT]: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
  [RecordStatus.PENDING_CHECK]: 'bg-orange-100 text-orange-800',
  [RecordStatus.PENDING_SIGN]: 'bg-purple-100 text-purple-800',
  [RecordStatus.SIGNED]: 'bg-indigo-100 text-indigo-800',
  [RecordStatus.HANDOVER]: 'bg-green-100 text-green-800',
  [RecordStatus.RETURNED]: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
  [RecordStatus.WITHDRAWN]: 'bg-slate-600 text-white',
  [RecordStatus.REJECTED]: 'bg-red-100 text-red-800',

  // Màu sắc riêng cho các trạng thái Cấp giấy
  [RecordStatus.APPRAISAL]: 'bg-blue-100 text-blue-800 border border-blue-200',
  [RecordStatus.PENDING_POSTING]: 'bg-amber-100 text-amber-800 border border-amber-200',
  [RecordStatus.TAX_TRANSFER]: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  [RecordStatus.PENDING_TAX_KV7]: 'bg-violet-100 text-violet-800 border border-violet-200',
  [RecordStatus.PENDING_TAX_NOTICE]: 'bg-amber-100 text-amber-800 border border-amber-200',
  [RecordStatus.PENDING_TAX_PAYMENT]: 'bg-amber-100 text-amber-800 border border-amber-200',
  [RecordStatus.PENDING_PRINT_CERT]: 'bg-teal-100 text-teal-800 border border-teal-200',
  [RecordStatus.PENDING_HANDOVER]: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
};

// Hàm chuẩn hóa và chuyển đổi mọi định dạng trạng thái về RecordStatus chuẩn
export const mapStatusToRecordStatus = (s: string | undefined | null): RecordStatus => {
  if (!s) return RecordStatus.RECEIVED;
  const trimmed = String(s).trim();
  if (Object.values(RecordStatus).includes(trimmed as RecordStatus)) {
    return trimmed as RecordStatus;
  }
  const lower = trimmed.toLowerCase();
  switch (lower) {
    case 'draft':
    case 'received':
    case 'tiếp nhận':
    case 'tiếp nhận mới':
      return RecordStatus.RECEIVED;
    case 'assigned':
    case 'giao nhân viên':
    case 'đã giao':
      return RecordStatus.ASSIGNED;
    case 'in_progress':
    case 'in progress':
    case 'đang thực hiện':
    case 'đang xử lý':
      return RecordStatus.IN_PROGRESS;
    case 'field_work':
    case 'field work':
    case 'đo đạc thực địa':
    case 'thực địa':
      return RecordStatus.FIELD_WORK;
    case 'office_work':
    case 'office work':
    case 'biên tập bản đồ':
    case 'nội nghiệp':
      return RecordStatus.OFFICE_WORK;
    case 'executed':
    case 'completed_work':
    case 'completed work':
    case 'đã thực hiện':
      return RecordStatus.COMPLETED_WORK;
    case 'pending_supplement':
    case 'chờ bổ sung':
    case 'bổ sung':
      return RecordStatus.PENDING_SUPPLEMENT;
    case 'pending_check':
    case 'pending check':
    case 'chờ kiểm tra':
      return RecordStatus.PENDING_CHECK;
    case 'checked':
    case 'đã kiểm tra':
      return RecordStatus.PENDING_SIGN;
    case 'pending_sign':
    case 'pending sign':
    case 'chờ ký duyệt':
    case 'chờ ký':
    case 'đã trình':
      return RecordStatus.PENDING_SIGN;
    case 'signed':
    case 'chờ bàn giao':
    case 'đã ký':
      return RecordStatus.SIGNED;
    case 'handover':
    case 'đã giao 1 cửa':
    case 'giao 1 cửa':
    case 'giao một cửa':
      return RecordStatus.HANDOVER;
    case 'completed':
    case 'returned':
    case 'đã trả kết quả':
    case 'đã trả':
    case 'trả kết quả':
      return RecordStatus.RETURNED;
    case 'withdrawn':
    case 'csd rút hồ sơ':
    case 'rút hồ sơ':
      return RecordStatus.WITHDRAWN;
    case 'rejected':
    case 'trả hồ sơ':
    case 'từ chối':
    case 'huỷ hồ sơ':
    case 'hủy hồ sơ':
      return RecordStatus.REJECTED;
    case 'appraisal':
    case 'chờ thẩm định':
    case 'thẩm định':
      return RecordStatus.APPRAISAL;
    case 'pending_posting':
    case 'chờ niêm yết':
    case 'đang niêm yết':
    case 'niêm yết':
      return RecordStatus.PENDING_POSTING;
    case 'tax_transfer':
    case 'chờ chuyển thuế':
    case 'chuyển thuế':
      return RecordStatus.TAX_TRANSFER;
    case 'pending_tax_kv7':
    case 'chờ thuế khu vực 7':
    case 'thuế khu vực 7':
      return RecordStatus.PENDING_TAX_KV7;
    case 'pending_tax_payment':
    case 'chờ giấy nộp tiền':
    case 'giấy nộp tiền':
      return RecordStatus.PENDING_TAX_PAYMENT;
    case 'pending_print_cert':
    case 'chờ in giấy chứng nhận':
    case 'in giấy chứng nhận':
    case 'in gcn':
      return RecordStatus.PENDING_PRINT_CERT;
    case 'pending_handover':
      return RecordStatus.PENDING_HANDOVER;
    default:
      for (const [key, val] of Object.entries(STATUS_LABELS)) {
        if (val.toLowerCase() === lower) {
          return key as RecordStatus;
        }
      }
      return RecordStatus.RECEIVED;
  }
};

export const GROUPS = ['Tân Khai', 'Tân Quan', 'Minh Đức', 'Tân Hưng'];

export const DEFAULT_WARDS = [
  'Tân Khai',
  'Tân Quan',
  'Minh Đức',
  'Tân Hưng'
];

export const WARDS = DEFAULT_WARDS;

// Danh sách ngày nghỉ lễ mặc định chuẩn quốc gia (Dương lịch & Âm lịch)
export const DEFAULT_HOLIDAYS = [
  { id: '1', name: 'Tết Dương Lịch', day: 1, month: 1, isLunar: false },
  { id: '2', name: 'Giỗ Tổ Hùng Vương', day: 10, month: 3, isLunar: true },
  { id: '3', name: 'Giải phóng Miền Nam', day: 30, month: 4, isLunar: false },
  { id: '4', name: 'Quốc tế Lao động', day: 1, month: 5, isLunar: false },
  { id: '5', name: 'Quốc Khánh', day: 2, month: 9, isLunar: false },
  { id: '6', name: 'Tết Nguyên Đán (Mùng 1)', day: 1, month: 1, isLunar: true },
  { id: '7', name: 'Tết Nguyên Đán (Mùng 2)', day: 2, month: 1, isLunar: true },
  { id: '8', name: 'Tết Nguyên Đán (Mùng 3)', day: 3, month: 1, isLunar: true },
];

// Danh sách loại hồ sơ CƠ BẢN (Dùng cho form Tiếp nhận hồ sơ thường xuyên)
export const RECORD_TYPES = [
  '1.1 Sao lục',
  '1.2 Công văn',
  '2.1 Trích lục',
  '2.2 Trích đo',
  '2.3 Duyệt đơn',
  '2.4 Cắm mốc',
  '2.5 Tách-Hợp thửa',
  '3.1.1 Chuyển quyền',
  '3.1.2 Phân chia quyền',
  '3.1.3 Theo Bản án / QĐ',
  '3.2.1 Cấp đổi',
  '3.2.2 Cấp đổi (có thuế)',
  '3.3.1 Cấp lại',
  '3.3.2 Cấp lại (có thuế)',
  '3.4.1 Tách - hợp thửa',
  '3.4.2 Tách thửa CQ',
  '3.5.1 Gia hạn',
  '3.6.1 Chuyển mục đích',
  '3.7.1 Đính chính',
  '3.7.2 Đổi thông tin',
  '3.8.1 Đăng ký GDBD',
  '3.8.2 Xóa ĐK GDBD'
];

// Danh sách loại hồ sơ MỞ RỘNG (Dùng cho form Thêm mới trong "Tất cả hồ sơ" - Admin/Nội bộ)
export const EXTENDED_RECORD_TYPES = [
  ...RECORD_TYPES
];

// Hàm chuẩn hóa hiển thị tên Xã/Phường (Xóa Xã/Phường/TT)
export const getNormalizedWard = (ward: string | null | undefined): string => {
  if (!ward) return '';
  let w = ward.trim();
  
  // Xóa các tiền tố hành chính thông dụng (không phân biệt hoa thường)
  w = w.replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/yi, '');

  const lower = w.toLowerCase();

  // 1. Xử lý các mã viết tắt đặc biệt
  if (lower === 'tk' || lower === 'tân khai') return 'Tân Khai';
  if (lower === 'md' || lower === 'minh đức') return 'Minh Đức';
  if (lower === 'th' || lower === 'tân hưng') return 'Tân Hưng';
  if (lower === 'tq' || lower === 'tân quan') return 'Tân Quan';

  // 2. Xử lý Title Case (Viết hoa chữ cái đầu mỗi từ)
  return w.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// Hàm hiển thị nhãn đầy đủ cho xã/phường (Phường Tân Khai, Xã Tân Quan, Xã Minh Đức, Xã Tân Hưng) - Dùng cho biên nhận
export const getWardFullLabel = (ward: string | null | undefined): string => {
  if (!ward) return '';
  const normalized = getNormalizedWard(ward);
  if (normalized === 'Tân Khai') {
    return 'Phường Tân Khai';
  }
  return `Xã ${normalized}`;
};

// Hàm hiển thị nhãn rút gọn (Tân Khai, Tân Quan, Minh Đức, Tân Hưng) - Dùng cho bảng và giao diện nhằm tiết kiệm diện tích
export const getWardLabel = (ward: string | null | undefined): string => {
  if (!ward) return '';
  return getNormalizedWard(ward);
};

// Hàm rút gọn tên loại hồ sơ để hiển thị trong Danh sách (Table), Bộ lọc, Modal & Toàn bộ phần mềm
export const getShortRecordType = (type: string | null | undefined): string => {
  if (!type) return '---';
  const t = type.toLowerCase().trim();
  
  // 1. Nhóm 1.x - Lưu trữ / Cung cấp dữ liệu
  if (t.startsWith('1.1') || t === 'cung cấp tài liệu đất đai' || t === 'cung cấp dữ liệu đất đai' || t === 'sao lục' || t === 'sao luc' || t === 'sao lục hồ sơ' || t === '1.1 cc dl đđ' || t === '1.1 sao lục') return '1.1 Sao lục';
  if (t.startsWith('1.2') || t === 'công văn') return '1.2 Công văn';
  if (t.startsWith('1.')) return type;

  // 2. Nhóm 2.x - Đo đạc bản đồ
  if (t.startsWith('2.1') || t === 'trích lục' || t === 'trích lục quy hoạch' || t === 'trích lục qh') return '2.1 Trích lục';
  if (t.startsWith('2.2') || t === '2.3 trích đo' || t === 'trích đo') return '2.2 Trích đo';
  if (t.startsWith('2.3') || t.startsWith('2.6') || t === 'cung cấp số thửa đất' || t === 'cung cấp số thửa' || t === 'cc số thửa' || t === 'cập nhập số thửa' || t === 'cập nhật số thửa' || t === 'cn số thửa' || t.includes('duyệt đơn & cung cấp số thửa') || t.includes('duyệt đơn-số thửa')) return '2.3 Duyệt đơn';
  if (t.startsWith('2.4') || t === 'cắm mốc' || t === 'trích đo cắm mốc') return '2.4 Cắm mốc';
  if (t.startsWith('2.5') || t === 'tách thửa' || t === 'tách-hợp thửa' || t === 'trích đo tách - hợp thửa') return '2.5 Tách-Hợp thửa';
  if (t.startsWith('2.')) return type;

  // 3. Nhóm 3.x - Cấp giấy / Đăng ký đất đai
  if (t.startsWith('3.1.1') || t.includes('3.1.1')) return '3.1.1 Chuyển quyền';
  if (t.startsWith('3.1.2') || t.includes('3.1.2') || t.includes('thỏa thuận vợ chồng') || t.includes('phân chia quyền')) return '3.1.2 Phân chia quyền';
  if (t.startsWith('3.1.3') || t.includes('3.1.3') || t.includes('bản án') || t.includes('thi hành án')) return '3.1.3 Theo Bản án / QĐ';
  if (t.startsWith('3.2.1') || t.includes('3.2.1')) return '3.2.1 Cấp đổi';
  if (t.startsWith('3.2.2') || t.includes('3.2.2') || (t.includes('cấp đổi') && t.includes('thuế'))) return '3.2.2 Cấp đổi (có thuế)';
  if (t.startsWith('3.3.1') || t.includes('3.3.1')) return '3.3.1 Cấp lại';
  if (t.startsWith('3.3.2') || t.includes('3.3.2') || (t.includes('cấp lại') && t.includes('thuế'))) return '3.3.2 Cấp lại (có thuế)';
  if (t.startsWith('3.4.1') || t.includes('3.4.1') || (t.includes('tách') && t.includes('hợp') && !t.includes('cq'))) return '3.4.1 Tách - hợp thửa';
  if (t.startsWith('3.4.2') || t.includes('3.4.2') || (t.includes('tách') && t.includes('cq'))) return '3.4.2 Tách thửa CQ';
  if (t.startsWith('3.5.1') || t.includes('3.5.1') || t.includes('gia hạn')) return '3.5.1 Gia hạn';
  if (t.startsWith('3.6.1') || t.includes('3.6.1') || t.includes('chuyển mục đích')) return '3.6.1 Chuyển mục đích';
  if (t.startsWith('3.7.1') || t.includes('3.7.1') || t.includes('đính chính')) return '3.7.1 Đính chính';
  if (t.startsWith('3.7.2') || t.includes('3.7.2') || t.includes('đổi thông tin') || t.includes('thay đổi thông tin')) return '3.7.2 Đổi thông tin';
  if (t.startsWith('3.8.1') || t.includes('3.8.1') || t.includes('đăng ký gdbd') || t.includes('thế chấp')) return '3.8.1 Đăng ký GDBD';
  if (t.startsWith('3.8.2') || t.includes('3.8.2') || t.includes('xóa đk gdbd') || t.includes('xóa thế chấp') || t.includes('giải chấp')) return '3.8.2 Xóa ĐK GDBD';

  // Fallbacks cho các mã 3.x cũ
  if (t.startsWith('3.1') || t.includes('chuyển quyền') || t.includes('chuyển nhượng') || t.includes('tặng cho') || t.includes('thừa kế') || t.includes('biến động')) return '3.1.1 Chuyển quyền';
  if (t.startsWith('3.2') || t.includes('cấp đổi')) return '3.2.1 Cấp đổi';
  if (t.startsWith('3.3') || t.includes('cấp lại')) return '3.3.1 Cấp lại';
  if (t.startsWith('3.4')) return '3.4.1 Tách - hợp thửa';
  if (t.startsWith('3.5')) return '3.5.1 Gia hạn';
  if (t.startsWith('3.6')) return '3.6.1 Chuyển mục đích';
  if (t.startsWith('3.7')) return '3.7.1 Đính chính';
  if (t.startsWith('3.8')) return '3.8.1 Đăng ký GDBD';
  if (t.startsWith('3.')) return type;

  // Fallbacks for legacy keyword matching
  if (t.includes('cung cấp tài liệu đất đai') || t.includes('cung cấp dữ liệu') || t.includes('sao lục') || t.includes('sao luc') || t.includes('cc dl đđ')) return '1.1 Sao lục';
  if (t.includes('trích lục quy hoạch')) return '2.1 Trích lục';
  if (t.includes('cung cấp số thửa đất') || t.includes('số thửa') || t.includes('cập nhập số thửa') || t.includes('cập nhật số thửa') || t.includes('2.6') || t.includes('duyệt đơn')) return '2.3 Duyệt đơn';
  if (t.includes('trích đo') && t.includes('cắm mốc')) return '2.4 Cắm mốc';
  if (t.includes('trích đo') && (t.includes('tách') || t.includes('hợp'))) return '2.5 Tách-Hợp thửa';
  if (t.includes('trích đo') || t.includes('2.2')) return '2.2 Trích đo';
  if (t.includes('cắm mốc')) return '2.4 Cắm mốc';
  if (t.includes('trích lục')) return '2.1 Trích lục';
  if (t.includes('tách thửa') || t.includes('hợp thửa')) return '2.5 Tách-Hợp thửa';
  if (t.includes('cấp gcn') || t.includes('cấp giấy')) return '3.2.1 Cấp đổi';

  // Legacy fallback
  if (t.includes('thi hành án')) return '3.1.3 Theo Bản án / QĐ';
  if (t.includes('tòa án')) return '3.1.3 Theo Bản án / QĐ';

  return type; // Trả về nguyên bản nếu không khớp quy tắc rút gọn
};

// Hàm hiển thị tên đầy đủ pháp lý của loại hồ sơ CÓ CHỨA MÃ SỐ HIỆU (Dùng cho dòng 'Thủ tục hành chính cần giải quyết' trên Biên nhận)
export const getFullRecordType = (type: string | null | undefined): string => {
  if (!type) return '';
  const short = getShortRecordType(type);
  if (short === '1.1 Sao lục') return '1.1 Sao lục hồ sơ';
  if (short === '1.2 Công văn') return '1.2 Công văn';
  if (short === '2.1 Trích lục') return '2.1 Trích lục bản đồ địa chính';
  if (short === '2.2 Trích đo') return '2.2 Trích đo địa chính';
  if (short === '2.3 Duyệt đơn') return '2.3 Duyệt đơn & Cung cấp số thửa đất';
  if (short === '2.4 Cắm mốc') return '2.4 Trích đo Cắm mốc ranh giới thửa đất';
  if (short === '2.5 Tách-Hợp thửa') return '2.5 Trích đo Tách thửa - Hợp thửa đất';

  // Nhóm 3.x Cấp giấy (tên đầy đủ trên Biên nhận & Giấy hẹn)
  if (short === '3.1.1 Chuyển quyền') return '3.1.1 Chuyển nhượng, Tặng cho, Thừa kế QSDĐ, QSH tài sản';
  if (short === '3.1.2 Phân chia quyền') return '3.1.2 Chuyển quyền theo thỏa thuận vợ chồng, phân chia quyền của hộ gia đình';
  if (short === '3.1.3 Theo Bản án / QĐ') return '3.1.3 Chuyển quyền theo Bản án Tòa án, Quyết định Thi hành án dân sự';
  if (short === '3.2.1 Cấp đổi') return '3.2.1 Cấp đổi GCN (ố nhòe, rách nát, thêm tên vợ/chồng, không đổi diện tích)';
  if (short === '3.2.2 Cấp đổi (có thuế)') return '3.2.2 Cấp đổi GCN do đo đạc lập bản đồ chính quy (thay đổi kích thước/diện tích)';
  if (short === '3.3.1 Cấp lại') return '3.3.1 Cấp lại Giấy chứng nhận do bị mất';
  if (short === '3.3.2 Cấp lại (có thuế)') return '3.3.2 Cấp lại Giấy chứng nhận do bị mất (có thay đổi diện tích/kích thước)';
  if (short === '3.4.1 Tách - hợp thửa') return '3.4.1 Tách thửa đất hoặc Hợp thửa đất không đổi người sử dụng đất';
  if (short === '3.4.2 Tách thửa CQ') return '3.4.2 Tách thửa đất đồng thời thực hiện thủ tục Chuyển quyền';
  if (short === '3.5.1 Gia hạn') return '3.5.1 Xác nhận tiếp tục sử dụng đất nông nghiệp khi hết hạn';
  if (short === '3.6.1 Chuyển mục đích') return '3.6.1 Chuyển mục đích sử dụng đất không phải xin phép';
  if (short === '3.7.1 Đính chính') return '3.7.1 Đính chính Giấy chứng nhận đã cấp có sai sót';
  if (short === '3.7.2 Đổi thông tin') return '3.7.2 ĐKBĐ thay đổi thông tin cá nhân (CCCD, Họ tên, địa chỉ thửa...)';
  if (short === '3.8.1 Đăng ký GDBD') return '3.8.1 Đăng ký Giao dịch bảo đảm (Thế chấp)';
  if (short === '3.8.2 Xóa ĐK GDBD') return '3.8.2 Xóa đăng ký Giao dịch bảo đảm (Xóa thế chấp)';

  return type;
};

// Hàm hiển thị tên đầy đủ pháp lý của loại hồ sơ KHÔNG CHỨA MÃ SỐ HIỆU (Dùng cho ghép Phiếu yêu cầu & làm sạch giấy tờ kèm theo)
export const getFullRecordTypeWithoutCode = (type: string | null | undefined): string => {
  if (!type) return '';
  const full = getFullRecordType(type);
  return full.replace(/^[0-9]+(\.[0-9]+)*\s*/, '').trim();
};

// Hàm tự động ghép "Phiếu yêu cầu " + [Tên đầy đủ của thủ tục in trên biên nhận]
export const getPhieuYeuCauTitle = (type: string | null | undefined): string => {
  if (!type) return 'Phiếu yêu cầu';
  const fullWithoutCode = getFullRecordTypeWithoutCode(type);
  if (!fullWithoutCode) return 'Phiếu yêu cầu';

  let lowerName = fullWithoutCode;
  if (lowerName.startsWith('Trích đo Cắm mốc')) {
    lowerName = 'trích đo cắm mốc ranh giới thửa đất';
  } else if (lowerName.startsWith('Trích đo Tách thửa')) {
    lowerName = 'trích đo tách thửa - hợp thửa đất';
  } else if (lowerName.startsWith('Trích lục bản đồ')) {
    lowerName = 'trích lục bản đồ địa chính';
  } else if (lowerName.startsWith('Trích đo địa chính') || lowerName === 'Trích đo') {
    lowerName = 'trích đo địa chính';
  } else if (lowerName.startsWith('Sao lục hồ sơ') || lowerName === 'Sao lục') {
    lowerName = 'sao lục hồ sơ';
  } else if (lowerName.startsWith('Duyệt đơn')) {
    lowerName = 'duyệt đơn & cung cấp số thửa đất';
  } else {
    lowerName = lowerName.charAt(0).toLowerCase() + lowerName.slice(1);
  }

  return `Phiếu yêu cầu ${lowerName}`;
};

// Hàm loại bỏ hoàn toàn số hiệu mã thủ tục khỏi tên giấy tờ đính kèm
export const cleanDocumentName = (docName: string | null | undefined, recordType?: string | null): string => {
  if (!docName) return '';
  let cleaned = String(docName).trim();

  // Nếu chứa cụm từ "Phiếu yêu cầu" cũ hoặc chung chung, cập nhật lại thành tên Phiếu yêu cầu động
  if (cleaned.toLowerCase().includes('phiếu yêu cầu') || cleaned.toLowerCase().includes('phieu yeu cau')) {
    if (recordType) {
      return getPhieuYeuCauTitle(recordType);
    }
  }

  // Loại bỏ số hiệu mã ở đầu (vd: "2.1 ", "2.2 ", "1.1 ", "3.1.1 ")
  cleaned = cleaned.replace(/^[0-9]+(\.[0-9]+)*\s*/, '').trim();
  return cleaned;
};

// Hàm tự động sinh danh sách giấy tờ kèm theo mặc định cho từng loại thủ tục (1.x, 2.x, 3.x)
export const getDefaultAttachedDocsForType = (type: string | null | undefined): AttachedDocItem[] => {
  if (!type) return [];
  const t = String(type).trim();
  const short = getShortRecordType(t);
  
  if (short.startsWith('3.') || t.startsWith('3.')) {
    // 3.1.1 Chuyển quyền: Thêm "Hợp đồng hoặc văn bản về việc bán hoặc tặng cho hoặc để thừa kế hoặc góp vốn..." vào vị trí số 3
    if (short.startsWith('3.1.1') || t.startsWith('3.1.1') || short.includes('3.1.1') || t.includes('Chuyển quyền')) {
      return [
        { id: '1', name: 'Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '2', name: 'Giấy chứng nhận đã cấp.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '3', name: 'Hợp đồng hoặc văn bản về việc bán hoặc tặng cho hoặc để thừa kế hoặc góp vốn...', type: 'Bản chính', original: 1, copy: 0 },
        { id: '4', name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành (nếu có).', type: 'Bản chính', original: 1, copy: 0 },
        { id: '5', name: 'Hồ sơ kỷ thuật bản đồ địa chính thửa đất', type: 'Bản chính', original: 1, copy: 0 }
      ];
    }

    // 3.1.2 Phân chia quyền: Thêm "Văn bản thỏa thuận về việc thay đổi quyền sử dụng đất..." vào vị trí số 3
    if (short.startsWith('3.1.2') || t.startsWith('3.1.2') || short.includes('3.1.2') || t.includes('Phân chia quyền')) {
      return [
        { id: '1', name: 'Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '2', name: 'Giấy chứng nhận đã cấp.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '3', name: 'Văn bản thỏa thuận về việc thay đổi quyền sử dụng đất...', type: 'Bản chính', original: 1, copy: 0 },
        { id: '4', name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành (nếu có).', type: 'Bản chính', original: 1, copy: 0 },
        { id: '5', name: 'Hồ sơ kỷ thuật bản đồ địa chính thửa đất', type: 'Bản chính', original: 1, copy: 0 }
      ];
    }

    // 3.1.3 Theo Bản án / QĐ: Thêm "QĐ, bản án, Văn bản thỏa thuận về việc thay đổi quyền sử dụng đất..." vào vị trí số 3
    if (short.startsWith('3.1.3') || t.startsWith('3.1.3') || short.includes('3.1.3') || t.includes('Bản án') || t.includes('bản án')) {
      return [
        { id: '1', name: 'Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '2', name: 'Giấy chứng nhận đã cấp.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '3', name: 'QĐ, bản án, Văn bản thỏa thuận về việc thay đổi quyền sử dụng đất...', type: 'Bản chính', original: 1, copy: 0 },
        { id: '4', name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành (nếu có).', type: 'Bản chính', original: 1, copy: 0 },
        { id: '5', name: 'Hồ sơ kỷ thuật bản đồ địa chính thửa đất', type: 'Bản chính', original: 1, copy: 0 }
      ];
    }

    // 3.4.x Tách - hợp thửa: Thêm "Đơn đề nghị tách thửa đất, hợp thửa đất theo quy định." vào vị trí số 3
    if (short.startsWith('3.4.') || t.startsWith('3.4.') || short.includes('3.4.') || t.includes('Tách - hợp') || t.includes('Tách thửa')) {
      return [
        { id: '1', name: 'Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '2', name: 'Giấy chứng nhận đã cấp.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '3', name: 'Đơn đề nghị tách thửa đất, hợp thửa đất theo quy định.', type: 'Bản chính', original: 1, copy: 0 },
        { id: '4', name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành (nếu có).', type: 'Bản chính', original: 1, copy: 0 },
        { id: '5', name: 'Hồ sơ kỷ thuật bản đồ địa chính thửa đất', type: 'Bản chính', original: 1, copy: 0 }
      ];
    }

    // Các thủ tục 3.x khác
    return [
      { id: '1', name: 'Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính', original: 1, copy: 0 },
      { id: '2', name: 'Giấy chứng nhận đã cấp.', type: 'Bản chính', original: 1, copy: 0 },
      { id: '3', name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành (nếu có).', type: 'Bản chính', original: 1, copy: 0 },
      { id: '4', name: 'Hồ sơ kỷ thuật bản đồ địa chính thửa đất', type: 'Bản chính', original: 1, copy: 0 }
    ];
  }
  
  // 2.3 Duyệt đơn & Cung cấp số thửa đất
  if (short.startsWith('2.3') || t.startsWith('2.3') || short.includes('2.3') || t.includes('Duyệt đơn') || t.includes('duyệt đơn')) {
    return [
      { id: '1', name: getPhieuYeuCauTitle(t), type: 'Bản chính', original: 1, copy: 0 },
      { id: '2', name: 'Giấy chứng nhận quyền sử dụng đất đã cấp', type: 'Bản sao', original: 0, copy: 1 },
      { id: '3', name: 'Đơn đề nghị tách thửa đất, hợp thửa đất theo quy định.', type: 'Bản chính', original: 1, copy: 0 },
      { id: '4', name: 'Hồ sơ kỷ thuật bản đồ địa chính thửa đất', type: 'Bản chính', original: 1, copy: 0 }
    ];
  }
  
  if (short.startsWith('1.') || short.startsWith('2.') || t.startsWith('1.') || t.startsWith('2.')) {
    return [
      { id: '1', name: getPhieuYeuCauTitle(t), type: 'Bản chính', original: 1, copy: 0 },
      { id: '2', name: 'Giấy chứng nhận quyền sử dụng đất đã cấp', type: 'Bản sao', original: 0, copy: 1 }
    ];
  }

  return [];
};

export const isArchiveRecordType = (type: string | null | undefined): boolean => {
  if (!type) return false;
  const t = type.trim();
  if (t.startsWith('1.') || t === 'saoluc' || t === 'vaoso' || t === 'congvan') return true;
  const short = getShortRecordType(type);
  return short.startsWith('1.');
};

export const isArchiveRecord = (r: Partial<RecordFile> | null | undefined): boolean => {
  if (!r) return false;
  // Ưu tiên 1: Mã thủ tục (recordType hoặc content) thuộc nhóm 1.x
  if (isArchiveRecordType(r.recordType) || isArchiveRecordType(r.content)) return true;
  
  // Ưu tiên 2: Thủ tục rõ ràng của các nhóm khác thì KHÔNG phải lưu trữ
  const rType = String(r.recordType || r.content || '').trim();
  if (rType) {
    const short = getShortRecordType(rType);
    if (short.startsWith('2.') || short.startsWith('3.')) return false;
  }

  // Ưu tiên 3: Fallback theo group hoặc sourceTable nếu chưa có loại thủ tục
  if (r.sourceTable === 'luutru_records' || r.sourceTable === 'archive_records') return true;
  const groupStr = String(r.group || '').trim();
  if (groupStr.startsWith('1.') || groupStr.toLowerCase().includes('lưu trữ')) return true;
  return false;
};

// Kiểm tra hồ sơ có thuộc thủ tục 1.1 (Sao lục / Cung cấp tài liệu / dữ liệu đất đai) hay không
export const isRecordType11 = (recordOrType: Partial<RecordFile> | string | null | undefined): boolean => {
  if (!recordOrType) return false;
  const str = typeof recordOrType === 'string' 
    ? recordOrType 
    : String(recordOrType.recordType || recordOrType.content || '');
  const t = str.trim();
  const short = getShortRecordType(str);
  return t.startsWith('1.1') || short.startsWith('1.1');
};

// Kiểm tra hồ sơ có thuộc module Đo đạc (nhóm 2.x) hay không - Phân loại theo Mã thủ tục
export const isSurveyRecordType = (recordOrType: Partial<RecordFile> | string | null | undefined): boolean => {
  if (!recordOrType) return true;
  const str = typeof recordOrType === 'string' 
    ? recordOrType 
    : String(recordOrType.recordType || recordOrType.content || '');
  const t = str.trim();

  if (t) {
    const short = getShortRecordType(str);
    if (t.startsWith('2.') || short.startsWith('2.')) return true;
    if (t.startsWith('1.') || short.startsWith('1.') || isArchiveRecordType(str)) return false;
    if (t.startsWith('3.') || short.startsWith('3.') || isCertificateRecordType(str)) return false;
    const lower = str.toLowerCase();
    if (lower.includes('trích lục') || lower.includes('trích đo') || lower.includes('cắm mốc') || lower.includes('đo đạc') || lower.includes('số thửa') || lower.includes('duyệt đơn') || lower.includes('tách thửa') || lower.includes('hợp thửa')) {
      return true;
    }
    return false;
  }

  // Fallback nếu recordType để trống: kiểm tra group hoặc sourceTable
  if (typeof recordOrType === 'object' && recordOrType !== null) {
    const groupStr = String(recordOrType.group || '').trim();
    if (groupStr.startsWith('2.') || groupStr.includes('Đo đạc')) return true;
    if (recordOrType.sourceTable === 'land_records') return true;
    if (recordOrType.sourceTable === 'dangky_records' || recordOrType.sourceTable === 'luutru_records') return false;
  }

  return true;
};

// Kiểm tra hồ sơ có thuộc module Cấp giấy / Đăng ký đất đai (nhóm 3.x) hay không - Phân loại theo Mã thủ tục
export const isCertificateRecordType = (recordOrType: Partial<RecordFile> | string | null | undefined): boolean => {
  if (!recordOrType) return false;

  const str = typeof recordOrType === 'string' 
    ? recordOrType 
    : String(recordOrType.recordType || recordOrType.content || '');
  const t = str.trim();

  if (t) {
    const short = getShortRecordType(str);
    if (t.startsWith('3.') || short.startsWith('3.')) return true;
    if (t.startsWith('1.') || short.startsWith('1.') || isArchiveRecordType(str)) return false;
    if (t.startsWith('2.') || short.startsWith('2.')) return false;
    const lower = str.toLowerCase();
    if (lower.includes('cấp gcn') || 
        lower.includes('đăng ký biến động') || 
        lower.includes('biến động') || 
        lower.includes('cấp giấy') ||
        lower.includes('chuyển quyền') ||
        lower.includes('thế chấp') ||
        lower.includes('cấp đổi') ||
        lower.includes('cấp lại') ||
        lower.includes('gia hạn') ||
        lower.includes('đính chính') ||
        lower.includes('thỏa thuận vợ chồng') ||
        lower.includes('bản án') ||
        lower.includes('thi hành án')) {
      return true;
    }
    return false;
  }

  // Fallback nếu recordType để trống: kiểm tra group hoặc sourceTable
  if (typeof recordOrType === 'object' && recordOrType !== null) {
    const groupStr = String(recordOrType.group || '').trim();
    if (groupStr.startsWith('3.') || groupStr.includes('Đăng ký') || groupStr.includes('Cấp GCN') || groupStr.includes('Cấp giấy')) return true;
    if (recordOrType.sourceTable === 'dangky_records') return true;
  }

  return false;
};

// Hàm lấy tiền tố mã hồ sơ đo đạc theo địa bàn của người phân công tiếp nhận
// Quy tắc: Nếu người tiếp nhận được phân công TRÊN 1 địa bàn (> 1 xã) -> mặc định lấy tiền tố 'TK'.
// Nếu người tiếp nhận được phân công ĐÚNG 1 địa bàn -> lấy tiền tố 2 chữ cái (TK, TQ, TH, MD...).
export const getSurveyRecordPrefix = (
  receivedBy?: string | null,
  employeesList: Employee[] = [],
  wardName?: string | null
): string => {
  // 1. Ưu tiên kiểm tra Cán bộ phân công tiếp nhận
  if (receivedBy) {
    const empList = (employeesList && employeesList.length > 0) ? employeesList : MOCK_EMPLOYEES;
    let target = receivedBy.trim().toLowerCase();

    const USERNAME_MAP: Record<string, string> = {
      anhlvt: 'nv14',
      hieunv: 'nv11',
      hoina: 'nv10',
      hoatm: 'nv215',
      trinh: 'nv497',
      thuantq: 'nv15',
      admin: 'nv919'
    };
    if (USERNAME_MAP[target]) {
      target = USERNAME_MAP[target];
    }
    
    const emp = empList.find(e => 
      (e.id && e.id.toLowerCase() === target) ||
      (e.name && e.name.toLowerCase() === target) ||
      ((e as any).username && (e as any).username.toLowerCase() === target)
    );

    if (emp && emp.managedWards && emp.managedWards.length > 0) {
      // Nếu Cán bộ phụ trách TRÊN 1 địa bàn (> 1 xã) -> mặc định lấy tiền tố 'TK'
      if (emp.managedWards.length > 1) {
        return 'TK';
      }

      // Nếu Cán bộ phụ trách ĐÚNG 1 địa bàn -> Lấy mã địa bàn của xã duy nhất đó
      const singleWard = emp.managedWards[0].trim().toLowerCase();
      if (singleWard.includes('khai')) return 'TK';
      if (singleWard.includes('quan')) return 'TQ';
      if (singleWard.includes('hưng') || singleWard.includes('hung')) return 'TH';
      if (singleWard.includes('đức') || singleWard.includes('duc')) return 'MD';
      if (singleWard.includes('chơn thành') || singleWard.includes('chonthanh')) return 'CT';
      if (singleWard.includes('nha bích') || singleWard.includes('nhabich')) return 'NB';
      if (singleWard.includes('lập') || singleWard.includes('lap')) return 'ML';
      if (singleWard.includes('thắng') || singleWard.includes('thang')) return 'MT';
      if (singleWard.includes('quang minh')) return 'QM';
      if (singleWard.includes('thành tâm')) return 'TT';
      if (singleWard.includes('minh long') || singleWard.includes('minhlong')) return 'MLO';
      if (singleWard.includes('minh hưng') || singleWard.includes('minhhung')) return 'MH';
    }
  }

  // 2. Nếu không chọn Người tiếp nhận hoặc Cán bộ không có cấu hình địa bàn, mới lấy theo tên Xã/Phường trên form
  if (wardName) {
    const w = wardName.trim().toLowerCase();
    if (w.includes('khai')) return 'TK';
    if (w.includes('quan')) return 'TQ';
    if (w.includes('hưng') || w.includes('hung')) return 'TH';
    if (w.includes('đức') || w.includes('duc')) return 'MD';
    if (w.includes('chơn thành') || w.includes('chonthanh')) return 'CT';
    if (w.includes('nha bích') || w.includes('nhabich')) return 'NB';
    if (w.includes('lập') || w.includes('lap')) return 'ML';
    if (w.includes('thắng') || w.includes('thang')) return 'MT';
    if (w.includes('quang minh')) return 'QM';
    if (w.includes('thành tâm')) return 'TT';
    if (w.includes('minh long') || w.includes('minhlong')) return 'MLO';
    if (w.includes('minh hưng') || w.includes('minhhung')) return 'MH';
  }

  return 'TK';
};

export const MOCK_EMPLOYEES: Employee[] = [
  // Ban Giám đốc
  { id: 'NV021', name: 'Huỳnh Duy', department: 'Ban Giám đốc', position: 'Giám đốc', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV022', name: 'Ngô Thị Hồng', department: 'Ban Giám đốc', position: 'Phó Giám đốc', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV023', name: 'Nguyễn Viết Tính', department: 'Ban Giám đốc', position: 'Phó Giám đốc', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },

  // Tổ Đo đạc
  { id: 'NV001', name: 'Vũ Văn Đản', department: 'Tổ Đo đạc', position: 'Tổ phó', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV002', name: 'Kiều Công Kiên', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV003', name: 'Nguyễn Hoàng Nam', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV004', name: 'Phan Hoàng Thiên Phú', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV005', name: 'Lê Văn Dũng', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV006', name: 'Lê Duy Linh', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV007', name: 'Lê Thanh Hòa', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV008', name: 'Ngô Khánh Duy', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV009', name: 'Phạm Trí Hiếu', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV016', name: 'Trần Mạnh Hải', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV035', name: 'Nguyễn Tam Công', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV999', name: 'Nguyễn Thế Long', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },

  // Tổ Lưu trữ
  { id: 'NV688', name: 'Nguyễn Thị Sương', department: 'Tổ Lưu trữ', position: 'Tổ phó', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV013', name: 'Phạm Bá Thanh', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV017', name: 'Nguyễn Xuân Tình', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV018', name: 'Hồ Ngọc Thắng', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV019', name: 'Võ Hà Vui', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV020', name: 'Nguyễn Ngọc Lộc', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },

  // Tổ Cấp giấy
  { id: 'NV321', name: 'Nguyễn Thị Mỹ Quý', department: 'Tổ Cấp giấy', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },

  // Tổ Hành chính & Một cửa
  { id: 'NV010', name: 'Nguyễn Ất Hợi', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Quan'] },
  { id: 'NV011', name: 'Nguyễn Văn Hiếu', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Khai'] },
  { id: 'NV014', name: 'Lê Văn Tuấn Anh', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Minh Đức'] },
  { id: 'NV015', name: 'Trần Quốc Thuận', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Khai'] },
  { id: 'NV215', name: 'Trần Mạnh Hòa', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Khai'] },
  { id: 'NV497', name: 'Nguyễn Hữu Trí', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Hưng'] },
  { id: 'NV919', name: 'Nguyễn Tài Tình', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] }
];

export const MOCK_USERS: User[] = [
  {
    username: 'admin',
    password: '123',
    name: 'Administrator',
    role: UserRole.ADMIN
  }
];

// Dữ liệu mẫu ban đầu nếu Server chưa có gì
const getRelativeDate = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

export const MOCK_RECORDS: RecordFile[] = [
  {
    id: '1',
    code: 'HS-2024-001',
    customerName: 'DỮ LIỆU MẪU (OFFLINE)',
    phoneNumber: '0909123456',
    recordType: 'Trích lục bản đồ địa chính',
    content: 'Vui lòng kết nối Server để xem dữ liệu thực',
    receivedDate: getRelativeDate(0), 
    deadline: getRelativeDate(5),      
    status: RecordStatus.RECEIVED,
    group: 'Tân Quan',
    ward: 'Tân Quan'
  }
];

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c1',
    code: 'HĐ-2024-001',
    customerName: 'Nguyễn Văn A (Mẫu)',
    phoneNumber: '0909123456',
    ward: 'Tân Quan',
    contractType: 'Đo đạc',
    serviceType: 'Đo đạc diện tích dưới 500m2',
    areaType: 'Đất đô thị',
    quantity: 1,
    unitPrice: 1200000,
    vatRate: 8,
    vatAmount: 96000,
    totalAmount: 1296000,
    deposit: 0,
    createdDate: getRelativeDate(-1),
    status: 'PENDING'
  }
];

export const formatDisplayCode = (code?: string) => {
  if (!code) return "";
  const match = code.match(/(\d{6}-\d+)/);
  if (match) {
    return match[1];
  }
  if (code.length > 14) {
    return "..." + code.slice(-12);
  }
  return code;
};

// ==========================================
// TỪ ĐIỂN TÊN VĂN BẢN VÀ MÃ VIẾT TẮT FILE SCAN
// ==========================================
export interface DocumentScanType {
  name: string;
  code: string;
  keywords?: string[];
}

export const DOCUMENT_SCAN_DICTIONARY: DocumentScanType[] = [
  { name: 'Đơn đăng ký đất đai, tài sản gắn liền với đất', code: 'DDK', keywords: ['đăng ký đất đai', 'đăng ký lần đầu', 'ddk'] },
  { name: 'Đơn đăng ký biến động đất đai, tài sản gắn liền với đất', code: 'DDKBD', keywords: ['biến động đất đai', 'biến động', 'ddkbd'] },
  { name: 'Đơn xin cấp đổi Giấy chứng nhận', code: 'DXCD', keywords: ['cấp đổi giấy', 'cấp đổi gcn', 'cấp đổi', 'dxcd'] },
  { name: 'Đơn xin (đề nghị) chuyển mục đích sử dụng đất', code: 'DXCMD', keywords: ['chuyển mục đích', 'dxcmd'] },
  { name: 'Đơn xin (đề nghị) tách thửa đất, hợp thửa đất', code: 'DXTHT', keywords: ['tách thửa', 'hợp thửa', 'tách - hợp', 'dxtht'] },
  { name: 'Đơn xin (đề nghị) gia hạn sử dụng đất', code: 'DGH', keywords: ['gia hạn sử dụng đất', 'gia hạn', 'dgh'] },
  { name: 'Đơn đề nghị sử dụng đất kết hợp đa mục đích', code: 'DMD', keywords: ['đa mục đích', 'dmd'] },
  { name: 'Đơn xin xác nhận lại thời hạn sử dụng đất nông nghiệp', code: 'DXNTH', keywords: ['thời hạn sử dụng đất nông nghiệp', 'đất nông nghiệp', 'dxnth'] },
  { name: 'Đơn xin (đề nghị) giao đất, cho thuê đất', code: 'DXGD', keywords: ['giao đất', 'cho thuê đất', 'dxgd'] },
  { name: 'Đơn xin điều chỉnh thời hạn sử dụng đất của dự án đầu tư', code: 'DDCTH', keywords: ['dự án đầu tư', 'điều chỉnh thời hạn', 'ddcth'] },
  { name: 'Danh sách công khai hồ sơ cấp giấy CNQSDĐ', code: 'DSCK', keywords: ['công khai hồ sơ cấp giấy', 'dsck'] },
  { name: 'Danh sách chủ sử dụng và các thửa đất (mẫu 15)', code: 'DS15', keywords: ['mẫu 15', 'chủ sử dụng và các thửa đất', 'ds15'] },
  { name: 'Hợp đồng chuyển nhượng, tặng cho quyền sử dụng đất', code: 'HDCQ', keywords: ['chuyển nhượng', 'tặng cho', 'thừa kế', 'góp vốn', 'hdcq'] },
  { name: 'Hợp đồng mua bán tài sản bán đấu giá', code: 'HDBDG', keywords: ['bán đấu giá tài sản', 'bán đấu giá', 'hdbdg'] },
  { name: 'Hợp đồng thuê đất, điều chỉnh hợp đồng thuê đất', code: 'HDTD', keywords: ['thuê đất', 'hdtd'] },
  { name: 'Hợp đồng thế chấp quyền sử dụng đất', code: 'HDTHC', keywords: ['thế chấp', 'giao dịch bảo đảm', 'gdbd', 'hdthc'] },
  { name: 'Hoá đơn giá trị gia tăng', code: 'hoadon', keywords: ['hóa đơn', 'hoá đơn', 'vat', 'hoadon'] },
  { name: 'Hợp đồng thi công', code: 'HDTCO', keywords: ['thi công', 'hdtco'] },
  { name: 'Phiếu kiểm tra hồ sơ', code: 'PKTHS', keywords: ['kiểm tra hồ sơ', 'pkths'] },
  { name: 'Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất (Mới)', code: 'GCNM', keywords: ['gcn mới', 'sổ mới', 'gcnm'] },
  { name: 'Giấy chứng nhận quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất', code: 'GCNC', keywords: ['gcn cũ', 'sổ cũ', 'giấy chứng nhận đã cấp', 'gcn đã cấp', 'bản gốc', 'gcnc'] },
  { name: 'Giấy xác nhận đăng ký lần đầu', code: 'GXNDKLD', keywords: ['đăng ký lần đầu', 'gxndkld'] },
  { name: 'Văn bản thỏa thuận phân chia di sản thừa kế', code: 'VBTK', keywords: ['phân chia di sản', 'thừa kế', 'vbtk'] },
  { name: 'Văn bản từ chối nhận di sản thừa kế', code: 'VBTC', keywords: ['từ chối nhận di sản', 'từ chối thừa kế', 'vbtc'] },
  { name: 'Di chúc', code: 'DICHUC', keywords: ['di chúc', 'dichuc'] },
  { name: 'Thông báo công bố công khai di chúc', code: 'CKDC', keywords: ['công khai di chúc', 'ckdc'] },
  { name: 'Biên bản về việc kết thúc công khai công bố di chúc', code: 'BBKTDC', keywords: ['kết thúc công khai di chúc', 'bbktdc'] },
  { name: 'Đơn đề nghị miễn giảm Lệ phí trước bạ, thuế thu nhập cá nhân', code: 'DMG', keywords: ['miễn giảm lệ phí', 'miễn giảm thuế', 'dmg'] },
  { name: 'Đơn đề nghị chuyển hình thức giao đất (cho thuê đất)', code: 'CHTGD', keywords: ['chuyển hình thức giao đất', 'chtgd'] },
  { name: 'Đơn đề nghị điều chỉnh quyết định giao đất (cho thuê đất, cho phép chuyển mục đích)', code: 'DCQDGD', keywords: ['điều chỉnh quyết định giao đất', 'dcqdgd'] },
  { name: 'Tờ trình về việc đăng ký đất đai, tài sản gắn liền với đất (UBND xã)', code: 'TTCG', keywords: ['tờ trình đăng ký đất đai', 'tờ trình ubnd xã', 'ttcg'] },
  { name: 'Tờ trình về việc giao đất (cho thuê đất, cho phép chuyển mục đích)', code: 'TTr', keywords: ['tờ trình giao đất', 'ttr'] },
  { name: 'Tờ khai thuế (trước bạ, thuế TNCN, tiền sử dụng đất)', code: 'TKT', keywords: ['tờ khai thuế', 'trước bạ', 'thuế tncn', 'tkt'] },
  { name: 'Thông báo thuế (trước bạ, thuế TNCN, tiền sử dụng đất)', code: 'TBT', keywords: ['thông báo thuế', 'tbt'] },
  { name: 'Phiếu chuyển thông tin nghĩa vụ tài chính', code: 'PCT', keywords: ['phiếu chuyển', 'nghĩa vụ tài chính', 'pct'] },
  { name: 'Giấy nộp tiền vào Ngân sách nhà nước', code: 'GNT', keywords: ['giấy nộp tiền', 'ngân sách nhà nước', 'gnt'] },
  { name: 'Biên lai thu thuế sử dụng đất phi nông nghiệp', code: 'BLTT', keywords: ['phi nông nghiệp', 'biên lai thu thuế', 'bltt'] },
  { name: 'Thông báo xác nhận Hoàn thành nghĩa vụ tài chính', code: 'HTNVTC', keywords: ['hoàn thành nghĩa vụ tài chính', 'htnvtc'] },
  { name: 'Quyết định cho phép tách thửa', code: 'QDTT', keywords: ['cho phép tách thửa', 'qdtt'] },
  { name: 'Sơ đồ dự kiến tách thửa', code: 'SDTT', keywords: ['sơ đồ dự kiến', 'sdtt'] },
  { name: 'Quyết định giao đất, cho thuê đất', code: 'QDGTD', keywords: ['quyết định giao đất', 'qdgtd'] },
  { name: 'Quyết định cho phép chuyển mục đích', code: 'QDCMD', keywords: ['cho phép chuyển mục đích', 'qdcmd'] },
  { name: 'Quyết định chuyển hình thức giao đất (cho thuê đất)', code: 'QDCHTGD', keywords: ['chuyển hình thức giao đất', 'qdchtgd'] },
  { name: 'Quyết định điều chỉnh quyết định giao đất (cho thuê đất, cho phép chuyển mục đích)', code: 'QDDCGD', keywords: ['điều chỉnh quyết định giao đất', 'qddcgd'] },
  { name: 'Quyết định gia hạn sử dụng đất khi hết thời hạn SDĐ', code: 'QDGH', keywords: ['gia hạn sử dụng đất', 'qdgh'] },
  { name: 'Quyết định điều chỉnh thời hạn SDĐ của dự án đầu tư', code: 'QDDCTH', keywords: ['điều chỉnh thời hạn sdđ', 'qddcth'] },
  { name: 'Quyết định về hình thức sử dụng đất', code: 'QDHTSD', keywords: ['hình thức sử dụng đất', 'qdhtsd'] },
  { name: 'Quyết định phê duyệt phương án bồi thường, hỗ trợ, tái định cư', code: 'QDPDBT', keywords: ['bồi thường', 'hỗ trợ', 'tái định cư', 'qdpdbt'] },
  { name: 'Quyết định thi hành án theo đơn yêu cầu', code: 'QDTHA', keywords: ['thi hành án', 'qdtha'] },
  { name: 'Quyết định phê duyệt điều chỉnh quy hoạch', code: 'QDDCQH', keywords: ['điều chỉnh quy hoạch', 'qddcqh'] },
  { name: 'Quyết định phê duyệt đơn giá', code: 'QDPDDG', keywords: ['phê duyệt đơn giá', 'qdpddg'] },
  { name: 'Quyết định hủy Giấy chứng nhận quyền sử dụng đất', code: 'QDHG', keywords: ['hủy giấy chứng nhận', 'hủy gcn', 'qdhg'] },
  { name: 'Quyết định thu hồi đất', code: 'QDTH', keywords: ['thu hồi đất', 'qdth'] },
  { name: 'Biên bản bán đấu giá tài sản', code: 'BBBDG', keywords: ['bán đấu giá tài sản', 'bbbdg'] },
  { name: 'Biên bản bàn giao đất trên thực địa', code: 'BBGD', keywords: ['bàn giao đất', 'thực địa', 'bbgd'] },
  { name: 'Văn bản đề nghị chấp thuận nhận chuyển nhượng, thuê, góp vốn quyền sdđ', code: 'VBDNCT', keywords: ['chấp thuận nhận chuyển nhượng', 'vbdnct'] },
  { name: 'Văn bản đề nghị thẩm định, phê duyệt phương án sdđ', code: 'PDPASDD', keywords: ['phê duyệt phương án sdđ', 'pdpasdd'] },
  { name: 'Văn bản thỏa thuận quyền sử dụng đất của hộ gia đình', code: 'TTHGD', keywords: ['hộ gia đình', 'vợ và chồng', 'tthgd'] },
  { name: 'Văn bản thỏa thuận về việc xác lập quyền hạn chế đối với thửa đất liền kề', code: 'HCLK', keywords: ['quyền hạn chế đối với thửa đất liền kề', 'hclk'] },
  { name: 'Văn bản thoả thuận về việc chấm dứt quyền hạn chế đối với thửa đất liền kề', code: 'CDLK', keywords: ['chấm dứt quyền hạn chế', 'cdlk'] },
  { name: 'Văn bản chấp thuận cho phép chuyển mục đích', code: 'VBCTCMD', keywords: ['chấp thuận cho phép chuyển mục đích', 'vbctcmd'] },
  { name: 'Biên bản của Hội đồng đăng ký đất đai lần đầu', code: 'BBHDDK', keywords: ['hội đồng đăng ký đất đai', 'bbhddk'] },
  { name: 'Thông báo về việc công khai kết quả thẩm tra xét duyệt hồ sơ cấp giấy chứng nhận quyền sử dụng đất', code: 'TBCKCG', keywords: ['công khai kết quả thẩm tra xét duyệt', 'tbckcg'] },
  { name: 'Biên bản về việc kết thúc thông báo niêm yết công khai kết quả kiểm tra hồ sơ đăng ký cấp GCNQSD đất', code: 'KTCKCG', keywords: ['kết thúc thông báo niêm yết công khai', 'ktckcg'] },
  { name: 'Thông báo về việc chuyển thông tin Giấy chứng nhận bị mất để niêm yết công khai', code: 'TBMG', keywords: ['chuyển thông tin giấy chứng nhận bị mất', 'tbmg'] },
  { name: 'Thông báo về việc niêm yết công khai mất giấy chứng nhận quyền sử dụng đất', code: 'TBCKMG', keywords: ['mất giấy chứng nhận', 'mất gcn', 'tbckmg'] },
  { name: 'Biên bản về việc kết thúc thông báo niêm yết công khai về việc mất GCNQSD đất', code: 'KTCKMG', keywords: ['kết thúc niêm yết mất gcn', 'ktckmg'] },
  { name: 'Bảng liệt kê danh sách các thửa đất cấp giấy', code: 'DSCG', keywords: ['danh sách các thửa đất cấp giấy', 'dscg'] },
  { name: 'Bảng kê khai diện tích đang sử dụng', code: 'BKKDT', keywords: ['kê khai diện tích', 'bkkdt'] },
  { name: 'Phiếu xác nhận kết quả đo đạc', code: 'PXNKQDD', keywords: ['xác nhận kết quả đo đạc', 'pxnkqdd'] },
  { name: 'Phiếu yêu cầu đăng ký biện pháp bảo đảm bằng quyền sử dụng đất, tài sản gắn liền với đất', code: 'DKTC', keywords: ['đăng ký biện pháp bảo đảm', 'đăng ký thế chấp', 'dktc'] },
  { name: 'Phiếu yêu cầu xóa đăng ký biện pháp bảo đảm bằng quyền sử dụng đất, tài sản gắn liền với đất', code: 'DKXTC', keywords: ['xóa đăng ký biện pháp bảo đảm', 'xóa thế chấp', 'xóa đk gdbd', 'dkxtc'] },
  { name: 'Phiếu yêu cầu đăng ký thay đổi nội dung biện pháp bảo đảm bằng quyền sdđ, tài sản gắn liền với đất', code: 'DKTD', keywords: ['thay đổi nội dung biện pháp bảo đảm', 'dktd'] },
  { name: 'Giấy ủy quyền', code: 'GUQ', keywords: ['giấy ủy quyền', 'uỷ quyền', 'guq'] },
  { name: 'Hợp đồng ủy quyền', code: 'HDUQ', keywords: ['hợp đồng ủy quyền', 'hợp đồng uỷ quyền', 'hduq'] },
  { name: 'Quét mã QR', code: 'QR', keywords: ['mã qr', 'qr'] },
  { name: 'Bản mô tả ranh giới, mốc giới thửa đất', code: 'BMT', keywords: ['ranh giới', 'mốc giới', 'bản mô tả', 'bmt'] },
  { name: 'Biên bản kiểm tra, xác minh hiện trạng sử dụng đất', code: 'BBKTHT', keywords: ['xác minh hiện trạng', 'hiện trạng sử dụng đất', 'bbktht'] },
  { name: 'Hồ sơ kỷ thuật bản đồ địa chính thửa đất', code: 'HSKT', keywords: ['hồ sơ kỷ thuật', 'hồ sơ kỹ thuật', 'trích lục', 'đo tách', 'chỉnh lý', 'bản vẽ', 'hskt'] },
  { name: 'Bản vẽ nhà', code: 'BVN', keywords: ['bản vẽ nhà', 'bvn'] },
  { name: 'Giấy xin phép xây dựng', code: 'GPXD', keywords: ['phép xây dựng', 'gpxd'] },
  { name: 'Bản vẽ hoàn công', code: 'BVHC', keywords: ['hoàn công', 'bvhc'] },
  { name: 'Biên bản kiểm tra sai sót trên Giấy chứng nhận', code: 'BBKTSS', keywords: ['sai sót trên giấy chứng nhận', 'bbktss'] },
  { name: 'Giấy tờ liên quan (các loại giấy tờ kèm theo)', code: 'GTLQ', keywords: ['giấy tờ liên quan', 'tài liệu khác', 'gtlq'] },
  { name: 'Giấy chứng nhận kết hôn', code: 'GKH', keywords: ['kết hôn', 'hôn thú', 'gkh'] },
  { name: 'Căn cước công dân', code: 'CCCD', keywords: ['căn cước', 'cccd', 'cmnd'] },
  { name: 'Giấy Khai Sinh', code: 'GKS', keywords: ['khai sinh', 'gks'] },
  { name: 'Quyết định xử phạt', code: 'QDXP', keywords: ['xử phạt', 'vphc', 'qdxp'] },
  { name: 'Đơn cam kết, Giấy cam Kết', code: 'DCK', keywords: ['cam kết', 'dck'] },
  { name: 'Đơn xác nhận, Giấy Xác nhận', code: 'DXN', keywords: ['xác nhận', 'dxn'] },
  { name: 'Phiếu lấy ý kiến khu dân cư', code: 'PLYKDC', keywords: ['ý kiến khu dân cư', 'plykdc'] },
  { name: 'Giấy sang nhượng đất', code: 'GSND', keywords: ['sang nhượng đất', 'giấy tay', 'gsnd'] },
  { name: 'Giấy đề nghị xác nhận các khoản nộp vào ngân sách', code: 'GXNNVTC', keywords: ['khoản nộp vào ngân sách', 'gxnnvtc'] },
  { name: 'Biên bản kiểm tra nghiệm thu công trình xây dựng', code: 'BBNT', keywords: ['nghiệm thu công trình', 'bbnt'] },
  { name: 'Hoàn thành công tác bồi thường hỗ trợ', code: 'HTBTH', keywords: ['hoàn thành công tác bồi thường', 'htbth'] },
  { name: 'Thông báo cập nhật, chỉnh lý biến động', code: 'TBCNBD', keywords: ['cập nhật, chỉnh lý biến động', 'tbcnbd'] },
  { name: 'Văn bản cam kết tài sản riêng', code: 'CKTSR', keywords: ['tài sản riêng', 'cktsr'] }
];

export const getScanCodeForDocName = (nameOrType: string | null | undefined): string => {
  if (!nameOrType) return 'GTLQ';
  const clean = nameOrType.trim();
  const lower = clean.toLowerCase();

  // 1. Khớp chính xác mã viết tắt
  const exactCode = DOCUMENT_SCAN_DICTIONARY.find(d => d.code.toLowerCase() === lower);
  if (exactCode) return exactCode.code;

  // 2. Khớp chính xác tên văn bản
  const exactName = DOCUMENT_SCAN_DICTIONARY.find(d => d.name.toLowerCase() === lower);
  if (exactName) return exactName.code;

  // 3. Khớp theo từ khóa đặc trưng
  for (const item of DOCUMENT_SCAN_DICTIONARY) {
    if (lower.includes(item.name.toLowerCase())) return item.code;
    if (item.keywords?.some(kw => lower.includes(kw.toLowerCase()))) {
      return item.code;
    }
  }

  // 4. Nếu là mã viết tắt dạng ký tự in hoa 2-8 ký tự
  if (/^[A-Za-z0-9_-]{2,8}$/.test(clean)) {
    return clean.toUpperCase();
  }

  return 'GTLQ';
};

export const getDocNameForScanCode = (code: string | null | undefined): string => {
  if (!code) return '';
  const clean = code.trim().toUpperCase();
  const match = DOCUMENT_SCAN_DICTIONARY.find(d => d.code.toUpperCase() === clean);
  return match ? match.name : clean;
};

// Định dạng chuẩn tên file scan: [MÃ_VIẾT_TẮT] [MÃ_HỒ_SƠ].[đuôi_tệp]
export const formatStandardScanFileName = (
  scanCodeOrDocName: string,
  recordCode: string,
  originalFileName: string
): string => {
  const sanitizedCode = (recordCode || 'HS').trim().replace(/[/\\?%*:|"<>]/g, '-');
  const ext = originalFileName.split('.').pop()?.toLowerCase() || 'pdf';
  const abbr = getScanCodeForDocName(scanCodeOrDocName);
  return `${abbr} ${sanitizedCode}.${ext}`;
};
