
import { RecordStatus, Employee, RecordFile, User, UserRole, Contract } from './types';

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
export const APP_VERSION = '2.1.1';

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
  [RecordStatus.TAX_TRANSFER]: 'Chờ chuyển thuế',
  [RecordStatus.PENDING_TAX_KV7]: 'Chờ thuế khu vực 7',
  [RecordStatus.PENDING_TAX_PAYMENT]: 'Chờ Giấy nộp tiền',
  [RecordStatus.PENDING_PRINT_CERT]: 'Chờ in giấy chứng nhận',
  [RecordStatus.PENDING_HANDOVER]: 'Chờ bàn giao',
};

export const CAP_GIAY_SELECTABLE_STATUSES: { key: RecordStatus; label: string }[] = [
  { key: RecordStatus.RECEIVED, label: 'Tiếp nhận hồ sơ' },
  { key: RecordStatus.APPRAISAL, label: 'Chờ thẩm định' },
  { key: RecordStatus.TAX_TRANSFER, label: 'Chờ chuyển thuế' },
  { key: RecordStatus.PENDING_TAX_KV7, label: 'Chờ thuế khu vực 7' },
  { key: RecordStatus.PENDING_TAX_PAYMENT, label: 'Chờ Giấy nộp tiền' },
  { key: RecordStatus.PENDING_PRINT_CERT, label: 'Chờ in giấy chứng nhận' },
  { key: RecordStatus.PENDING_CHECK, label: 'Chờ kiểm tra' },
  { key: RecordStatus.PENDING_SIGN, label: 'Chờ ký duyệt' },
  { key: RecordStatus.PENDING_HANDOVER, label: 'Chờ bàn giao' },
  { key: RecordStatus.HANDOVER, label: 'Đã giao 1 cửa' },
  { key: RecordStatus.RETURNED, label: 'Đã trả kết quả' },
  { key: RecordStatus.PENDING_SUPPLEMENT, label: 'Chờ bổ sung' },
  { key: RecordStatus.WITHDRAWN, label: 'Csd rút hồ sơ' },
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
  [RecordStatus.TAX_TRANSFER]: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  [RecordStatus.PENDING_TAX_KV7]: 'bg-violet-100 text-violet-800 border border-violet-200',
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

// Hàm hiển thị tên đầy đủ pháp lý của loại hồ sơ - CHỈ DÙNG KHI IN GIẤY TIẾP NHẬN / GIẤY HẸN TRẢ KẾT QUẢ
export const getFullRecordType = (type: string | null | undefined): string => {
  if (!type) return '';
  const short = getShortRecordType(type);
  if (short === '1.1 Sao lục') return '1.1 Sao lục hồ sơ';
  if (short === '1.2 Công văn') return '1.2 Công văn';
  if (short === '2.1 Trích lục') return '2.1 Trích lục bản đồ địa chính';
  if (short === '2.2 Trích đo') return '2.2 Trích đo';
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

export const isArchiveRecordType = (type: string | null | undefined): boolean => {
  if (!type) return false;
  const t = type.trim();
  if (t.startsWith('1.') || t === 'saoluc' || t === 'vaoso' || t === 'congvan') return true;
  const short = getShortRecordType(type);
  return short.startsWith('1.');
};

export const isArchiveRecord = (r: Partial<RecordFile> | null | undefined): boolean => {
  if (!r) return false;
  if (r.sourceTable === 'luutru_records' || r.sourceTable === 'archive_records') return true;
  const type = String(r.recordType || '').trim();
  const code = String(r.code || '').trim();
  if (type.startsWith('1.') || code.startsWith('1.')) return true;
  return isArchiveRecordType(r.recordType) || isArchiveRecordType(r.content);
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

// Kiểm tra hồ sơ có thuộc module Đo đạc (nhóm 2.x) hay không
export const isSurveyRecordType = (recordOrType: Partial<RecordFile> | string | null | undefined): boolean => {
  if (!recordOrType) return true;
  const str = typeof recordOrType === 'string' 
    ? recordOrType 
    : String(recordOrType.recordType || recordOrType.content || '');
  const t = str.trim();
  if (t.startsWith('1.') || isArchiveRecordType(str)) return false;
  if (t.startsWith('3.') || isCertificateRecordType(str)) return false;
  return true;
};

// Kiểm tra hồ sơ có thuộc module Cấp giấy / Đăng ký đất đai (nhóm 3.x) hay không
export const isCertificateRecordType = (recordOrType: Partial<RecordFile> | string | null | undefined): boolean => {
  if (!recordOrType) return false;

  if (typeof recordOrType === 'object' && recordOrType !== null) {
    if (recordOrType.sourceTable === 'luutru_records' || recordOrType.sourceTable === 'archive_records') return false;
    const code = String(recordOrType.code || '').trim();
    if (code.toUpperCase().startsWith('LT-') || code.startsWith('1.')) return false;
    const dept = String((recordOrType as any).department || '').toLowerCase();
    if (dept.includes('lưu trữ') || dept.includes('luu tru')) return false;
  }

  const str = typeof recordOrType === 'string' 
    ? recordOrType 
    : String(recordOrType.recordType || recordOrType.content || '');
  const t = str.trim();
  if (t.startsWith('1.') || isArchiveRecordType(str)) return false;

  const short = getShortRecordType(str);
  if (t.startsWith('3.') || short.startsWith('3.')) return true;
  const lower = str.toLowerCase();
  return lower.includes('cấp gcn') || 
         lower.includes('đăng ký biến động') || 
         lower.includes('biến động') || 
         lower.includes('cấp giấy') ||
         lower.includes('chuyển quyền') ||
         lower.includes('thế chấp') ||
         lower.includes('cấp đổi') ||
         lower.includes('cấp lại') ||
         lower.includes('gia hạn') ||
         lower.includes('đính chính');
};

// Hàm lấy tiền tố mã hồ sơ đo đạc theo địa bàn của người phân công tiếp nhận
// Quy tắc: Nếu người tiếp nhận được phân công TRÊN 1 địa bàn (> 1 xã) -> không lấy tiền tố.
// Chỉ lấy tiền tố 2 chữ cái (TK, TQ, TH, MD) nếu người tiếp nhận được phân công ĐÚNG 1 địa bàn.
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
      // Nếu Cán bộ phụ trách TRÊN 1 địa bàn (> 1 xã) -> BỎ MÃ ĐỊA BÀN ở đầu mã hồ sơ!
      if (emp.managedWards.length > 1) {
        return '';
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

  return '';
};

export const MOCK_EMPLOYEES: Employee[] = [
  // Ban Giám đốc
  { id: 'NV021', name: 'Huỳnh Duy', department: 'Ban Giám đốc', position: 'Giám đốc', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV022', name: 'Ngô Thị Hồng', department: 'Ban Giám đốc', position: 'Phó Giám đốc', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV023', name: 'Nguyễn Viết Tính', department: 'Ban Giám đốc', position: 'Phó Giám đốc', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },

  // Tổ Đo đạc
  { id: 'NV1', name: 'Vũ Văn Đản', department: 'Tổ Đo đạc', position: 'Tổ phó', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV16', name: 'Trần Mạnh Hải', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV4', name: 'Phan Hoàng Thiên Phú', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV5', name: 'Lê Văn Dũng', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV6', name: 'Lê Duy Linh', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV7', name: 'Lê Thanh Hòa', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV8', name: 'Ngô Khánh Duy', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV9', name: 'Phạm Trí Hiếu', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV2', name: 'Kiều Công Kiên', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV3', name: 'Nguyễn Hoàng Nam', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV35', name: 'Nguyễn Tam Công', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV999', name: 'Nguyễn Thế Long', department: 'Tổ Đo đạc', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },

  // Tổ Lưu trữ
  { id: 'NV016', name: 'Nguyễn Thị Sương', department: 'Tổ Lưu trữ', position: 'Tổ phó', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV13', name: 'Phạm Bá Thanh', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV018', name: 'Hồ Ngọc Thắng', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV017', name: 'Nguyễn Xuân Tình', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV019', name: 'Võ Hà Vui', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },
  { id: 'NV020', name: 'Nguyễn Ngọc Lộc', department: 'Tổ Lưu trữ', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },

  // Tổ Cấp giấy
  { id: 'NV321', name: 'Nguyễn Thị Mỹ Quý', department: 'Tổ Cấp giấy', position: 'Nhân viên', managedWards: ['Tân Khai', 'Minh Đức', 'Tân Hưng', 'Tân Quan'] },

  // Tổ Hành chính & Một cửa
  { id: 'NV14', name: 'Lê Văn Tuấn Anh', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Minh Đức'] },
  { id: 'NV11', name: 'Nguyễn Văn Hiếu', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Khai'] },
  { id: 'NV10', name: 'Nguyễn Ất Hợi', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Quan'] },
  { id: 'NV215', name: 'Trần Mạnh Hòa', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Khai'] },
  { id: 'NV497', name: 'Nguyễn Hữu Trí', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Hưng'] },
  { id: 'NV15', name: 'Trần Quốc Thuận', department: 'Tổ Hành chính', position: 'Nhân viên', managedWards: ['Tân Khai'] },
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
