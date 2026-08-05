
import { RecordStatus, Employee, RecordFile, User, UserRole, Contract } from './types';

// CẤU HÌNH KẾT NỐI
// QUAN TRỌNG: Để dùng Cloud (Supabase), hãy dán URL dự án vào đây.
// Nếu dùng Mạng LAN (Local), đổi lại thành 'http://localhost:3005'
export const API_BASE_URL = 'https://dajjhubrhybodggbqapt.supabase.co'; 

// PHIÊN BẢN HIỆN TẠI CỦA ỨNG DỤNG
export const APP_VERSION = '2.1.1';

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận mới',
  [RecordStatus.ASSIGNED]: 'Đã giao việc',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.COMPLETED_WORK]: 'Đã thực hiện', // MỚI: Đã bổ sung
  [RecordStatus.PENDING_CHECK]: 'Chờ kiểm tra',
  [RecordStatus.CHECKED]: 'Đã kiểm tra',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký duyệt',
  [RecordStatus.SIGNED]: 'Đã ký duyệt',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.WITHDRAWN]: 'CSD rút hồ sơ',
  [RecordStatus.REJECTED]: 'Hồ sơ trả',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'bg-gray-100 text-gray-800',
  [RecordStatus.ASSIGNED]: 'bg-blue-100 text-blue-800',
  [RecordStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [RecordStatus.COMPLETED_WORK]: 'bg-cyan-100 text-cyan-800', // MỚI: Đã bổ sung
  [RecordStatus.PENDING_CHECK]: 'bg-orange-100 text-orange-800',
  [RecordStatus.CHECKED]: 'bg-teal-100 text-teal-800',
  [RecordStatus.PENDING_SIGN]: 'bg-purple-100 text-purple-800',
  [RecordStatus.SIGNED]: 'bg-indigo-100 text-indigo-800',
  [RecordStatus.HANDOVER]: 'bg-green-100 text-green-800',
  [RecordStatus.RETURNED]: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
  [RecordStatus.WITHDRAWN]: 'bg-slate-600 text-white',
  [RecordStatus.REJECTED]: 'bg-red-100 text-red-800',
};

export const GROUPS = ['Tân Khai', 'Tân Quan', 'Minh Đức', 'Tân Hưng'];

export const DEFAULT_WARDS = [
  'Tân Khai',
  'Tân Quan',
  'Minh Đức',
  'Tân Hưng'
];

export const WARDS = DEFAULT_WARDS;

// Danh sách loại hồ sơ THÔNG TIN LƯU TRỮ (1.x)
export const ARCHIVE_RECORD_TYPES = [
  '1.1 Sao lục hồ sơ',
  '1.2 Công văn'
];

// Danh sách loại hồ sơ ĐO ĐẠC / CẮM MỐC (2.x)
export const MEASUREMENT_RECORD_TYPES = [
  '2.1 Trích lục',
  '2.2 Trích đo',
  '2.4 Trích đo Cắm mốc',
  '2.5 Trích đo Tách - Hợp thửa',
  '2.3 Cập nhật số thửa'
];

// Danh sách loại hồ sơ CƠ BẢN (Gồm Lưu trữ & Đo đạc)
export const RECORD_TYPES = [
  ...ARCHIVE_RECORD_TYPES,
  ...MEASUREMENT_RECORD_TYPES
];

// Danh sách loại hồ sơ CẤP GIẤY / ĐĂNG KÝ BIẾN ĐỘNG ĐẤT ĐAI
export const CAP_GIAY_RECORD_TYPES = [
  '3.1.1 Chuyển nhượng',
  '3.1.2 Tặng cho',
  '3.1.3 Thừa kế',
  '3.1.4 Thỏa thuận',
  '3.2.1 Cấp đổi',
  '3.2.2 Cấp đổi (có thuế)',
  '3.3.1 Cấp lại',
  '3.3.2 Cấp lại (có thuế)',
  '3.4.1 Tách - hợp thửa',
  '3.5.1 Gia hạn',
  '3.6.1 Chuyển mục đích không xin phép',
  '3.6.2 Chuyển mục đích không xin phép (có thuế)',
  '37.1 Đính chính - Biến động'
];

export const CAP_GIAY_RECORD_TYPE_DESCRIPTIONS: Record<string, string> = {
  '3.1.1 Chuyển nhượng': 'Đăng ký chuyển nhượng quyền sử dụng đất, quyền sở hữu nhà ở',
  '3.1.2 Tặng cho': 'Đăng ký biến động do tặng cho quyền sử dụng đất, tài sản',
  '3.1.3 Thừa kế': 'Đăng ký biến động do thừa kế quyền sử dụng đất, tài sản gắn liền với đất',
  '3.1.4 Thỏa thuận': 'Thỏa thuận phân chia, hợp nhất hoặc biến động tài sản theo thỏa thuận',
  '3.2.1 Cấp đổi': 'Cấp đổi Giấy chứng nhận quyền sử dụng đất, sở hữu nhà ở',
  '3.2.2 Cấp đổi (có thuế)': 'Cấp đổi Giấy chứng nhận quyền sử dụng đất, sở hữu nhà ở (có thuế)',
  '3.3.1 Cấp lại': 'Cấp lại Giấy chứng nhận do bị mất, hư hỏng',
  '3.3.2 Cấp lại (có thuế)': 'Cấp lại Giấy chứng nhận do bị mất, hư hỏng (có thuế)',
  '3.4.1 Tách - hợp thửa': 'Đăng ký biến động do tách thửa, hợp thửa đất',
  '3.5.1 Gia hạn': 'Gia hạn thời hạn sử dụng đất',
  '3.6.1 Chuyển mục đích không xin phép': 'Đăng ký chuyển mục đích sử dụng đất đối với trường hợp không phải xin phép',
  '3.6.2 Chuyển mục đích không xin phép (có thuế)': 'Đăng ký chuyển mục đích sử dụng đất không xin phép (có nghĩa vụ tài chính)',
  '37.1 Đính chính - Biến động': 'Đính chính - Biến động đất đai'
};

// Danh sách loại hồ sơ MỞ RỘNG (Dùng cho form Thêm mới trong "Tất cả hồ sơ" - Admin/Nội bộ)
export const EXTENDED_RECORD_TYPES = [
  ...RECORD_TYPES,
  ...CAP_GIAY_RECORD_TYPES
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

// Hàm rút gọn tên loại hồ sơ để hiển thị trong Danh sách (Table)
export const getShortRecordType = (type: string | null | undefined): string => {
  if (!type) return '---';
  const t = type.toLowerCase().trim();
  
  if (t.startsWith('1.1') || t === 'cung cấp tài liệu đất đai' || t === 'cung cấp dữ liệu đất đai' || t === 'sao lục' || t === 'sao luc' || t === 'sao lục hồ sơ' || t === '1.1 cc dl đđ' || t === '1.1 sao lục') return '1.1 Sao lục';
  if (t.startsWith('1.2') || t === 'công văn') return '1.2 Công văn';
  if (t.includes('trích lục quy hoạch') || t.includes('trích lục qh') || t === '2.2 trích lục qh' || t === '2.2 trích lục quy hoạch' || t.startsWith('2.1') || t === 'trích lục') return '2.1 Trích lục';
  if (t.startsWith('2.3') || t.startsWith('2.2') || t === 'trích đo') return '2.2 Trích đo';
  if (t.startsWith('2.4') || t === 'cắm mốc' || t === 'trích đo cắm mốc') return '2.4 Cắm mốc';
  if (t.startsWith('2.5') || t === 'tách thửa' || t === 'tách-hợp thửa' || t === 'trích đo tách - hợp thửa') return '2.5 Tách-Hợp thửa';
  if (t.startsWith('2.6') || t.startsWith('2.3') || t === 'cung cấp số thửa đất' || t === 'cung cấp số thửa' || t === 'cc số thửa' || t === 'cập nhập số thửa' || t === 'cập nhật số thửa' || t === 'cn số thửa') return '2.3 CN Số Thửa';

  // Các thủ tục Cấp giấy / Biến động mới
  if (t.startsWith('3.1.1') || (t.includes('chuyển nhượng') && !t.includes('trích đo'))) return '3.1.1 Chuyển nhượng';
  if (t.startsWith('3.1.2') || t.includes('tặng cho')) return '3.1.2 Tặng cho';
  if (t.startsWith('3.1.3') || t.includes('thừa kế')) return '3.1.3 Thừa kế';
  if (t.startsWith('3.1.4') || (t.includes('thỏa thuận') && !t.includes('phân chia'))) return '3.1.4 Thỏa thuận';
  if (t.startsWith('3.2.1') || t === '3.2.1 cấp đổi' || (t.includes('cấp đổi') && !t.includes('thuế'))) return '3.2.1 Cấp đổi';
  if (t.startsWith('3.2.2') || (t.includes('cấp đổi') && t.includes('thuế'))) return '3.2.2 Cấp đổi (có thuế)';
  if (t.startsWith('3.3.1') || t === '3.3.1 cấp lại' || (t.includes('cấp lại') && !t.includes('thuế'))) return '3.3.1 Cấp lại';
  if (t.startsWith('3.3.2') || (t.includes('cấp lại') && t.includes('thuế'))) return '3.3.2 Cấp lại (có thuế)';
  if (t.startsWith('3.4.1') || t.includes('tách - hợp thửa') || (t.includes('tách') && t.includes('hợp') && !t.includes('trích đo'))) return '3.4.1 Tách - hợp thửa';
  if (t.startsWith('3.5.1') || t.includes('gia hạn')) return '3.5.1 Gia hạn';
  if (t.startsWith('3.6.2') || (t.includes('chuyển mục đích') && t.includes('có thuế'))) return '3.6.2 Chuyển mục đích (có thuế)';
  if (t.startsWith('3.6.1') || t.includes('chuyển mục đích')) return '3.6.1 Chuyển mục đích không xin phép';
  if (t.startsWith('37.1') || t.startsWith('3.5.2') || t.includes('đính chính')) return '37.1 Đính chính - Biến động';

  // Fallbacks for legacy other categories
  if (t.includes('cung cấp tài liệu đất đai') || t.includes('cung cấp dữ liệu') || t.includes('sao lục') || t.includes('sao luc') || t.includes('cc dl đđ')) return '1.1 Sao lục';
  if (t.includes('trích lục quy hoạch') || t.includes('trích lục qh')) return '2.1 Trích lục';
  if (t.includes('cung cấp số thửa đất') || t.includes('số thửa') || t.includes('cập nhập số thửa') || t.includes('cập nhật số thửa')) return '2.3 CN Số Thửa';
  if (t.includes('trích đo') && t.includes('cắm mốc')) return '2.4 Cắm mốc';
  if (t.includes('trích đo') && (t.includes('tách') || t.includes('hợp'))) return '2.5 Tách-Hợp thửa';
  if (t.includes('trích đo')) return '2.2 Trích đo';
  if (t.includes('cắm mốc')) return '2.4 Cắm mốc';
  if (t.includes('trích lục')) return '2.1 Trích lục';

  return type; // Trả về nguyên bản nếu không khớp quy tắc rút gọn
};

export const isArchiveRecordType = (type: string | null | undefined): boolean => {
  const short = getShortRecordType(type);
  return short === '1.1 Sao lục' || short === '1.2 Công văn';
};

export const MOCK_EMPLOYEES: Employee[] = [
  { 
    id: 'emp1', 
    name: 'Nguyễn Văn A', 
    department: 'Tổ Đo đạc', 
    position: 'Tổ trưởng',
    managedWards: ['Tân Quan'] 
  },
  { 
    id: 'emp2', 
    name: 'Trần Thị B', 
    department: 'Tổ Cấp giấy', 
    position: 'Chuyên viên',
    managedWards: ['Minh Đức', 'Tân Khai'] 
  },
  { 
    id: 'emp3', 
    name: 'Lê Văn C', 
    department: 'Ban Giám đốc', 
    position: 'Phó Giám đốc',
    managedWards: [] 
  },
  { 
    id: 'emp4', 
    name: 'Phạm Thị D', 
    department: 'Tổ Lưu trữ', 
    position: 'Tổ trưởng',
    managedWards: [] 
  },
  { 
    id: 'emp5', 
    name: 'Hoàng Văn E', 
    department: 'Tổ Lưu trữ', 
    position: 'Chuyên viên',
    managedWards: [] 
  },
  {
    id: 'emp6',
    name: 'Nguyễn Văn Thắng',
    department: 'Tổ Hành chính',
    position: 'Tổ trưởng',
    managedWards: []
  },
  {
    id: 'emp7',
    name: 'Trần Thị Mai',
    department: 'Tổ Hành chính',
    position: 'Chuyên viên (Một cửa)',
    managedWards: []
  }
];

export const MOCK_USERS: User[] = [
  {
    username: 'admin',
    password: '123',
    name: 'Administrator',
    role: UserRole.ADMIN
  },
  {
    username: 'manager',
    password: '123',
    name: 'Phó Giám Đốc',
    role: UserRole.SUBADMIN,
    employeeId: 'emp3'
  },
  {
    username: 'nv_a',
    password: '123',
    name: 'Nguyễn Văn A',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp1'
  },
  {
    username: 'nv_b',
    password: '123',
    name: 'Trần Thị B',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp2'
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

export const CAP_GIAY_SUB_STEPS = [
  { id: 'tham_dinh', label: 'Thẩm tra', shortLabel: 'Thẩm tra', slaDays: 1, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { id: 'phieu_chuyen_thue', label: 'Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', slaDays: 2, color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { id: 'cho_nop_thue', label: 'Chờ giấy nộp tiền', shortLabel: 'Chờ giấy nộp tiền', slaDays: 0, color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { id: 'hoan_thien_trinh_duyet', label: 'In & Hoàn thiện', shortLabel: 'In & Hoàn thiện', slaDays: 5, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
] as const;

export const isCapGiayRecord = (record: RecordFile | Partial<RecordFile> | null | undefined): boolean => {
  if (!record || !record.recordType) return false;
  const t = record.recordType.toLowerCase();
  const shortType = getShortRecordType(record.recordType).toLowerCase();
  if (['cmd', 'tòa án', 'toa an', 'thi hành án', 'thi hanh an'].some(x => t.includes(x) || shortType.includes(x))) {
    return false;
  }
  return (
    t.includes('cấp giấy') ||
    t.includes('gcn') ||
    t.includes('đăng ký') ||
    t.includes('dang ky') ||
    t.includes('biến động') ||
    t.includes('bien dong') ||
    t.includes('cấp đổi') ||
    t.includes('cấp lại') ||
    t.includes('chuyển nhượng') ||
    t.includes('tặng cho') ||
    t.includes('thừa kế') ||
    t.includes('thỏa thuận') ||
    t.includes('gia hạn') ||
    t.includes('đính chính') ||
    t.includes('chuyển mục đích') ||
    t.startsWith('3.') ||
    t.startsWith('37.') ||
    shortType.startsWith('3.') ||
    shortType.startsWith('37.')
  );
};

// Các thủ tục có thuế mặc định: 3.6.1, 3.6.2, 3.1.1 đến 3.1.4, 3.2.2, 3.3.2
export const isTaxDefaultRecordType = (type: string | null | undefined): boolean => {
  if (!type) return false;
  const t = type.toLowerCase().trim();
  const short = getShortRecordType(type);
  return (
    short.startsWith('3.1.1') ||
    short.startsWith('3.1.2') ||
    short.startsWith('3.1.3') ||
    short.startsWith('3.1.4') ||
    short.startsWith('3.6.1') ||
    short.startsWith('3.6.2') ||
    short.startsWith('3.2.2') ||
    short.startsWith('3.3.2') ||
    t.includes('chuyển nhượng') ||
    t.includes('tặng cho') ||
    t.includes('thừa kế') ||
    t.includes('thỏa thuận') ||
    t.includes('chuyển mục đích') ||
    t.includes('có thuế')
  );
};

// Xác định bước mặc định ban đầu cho hồ sơ Cấp giấy:
// - Hồ sơ có thuế: Phiếu chuyển thuế (phieu_chuyen_thue)
// - Hồ sơ Cấp lại GCN (3.3.1 - không thuế nhưng cần thẩm định): Thẩm định (tham_dinh)
// - Các hồ sơ không thuế còn lại (Cấp đổi 3.2.1, Tách - hợp thửa 3.4.1, Gia hạn 3.5.1, Đính chính 37.1...): Hoàn thiện in GCN (hoan_thien_trinh_duyet)
export const getDefaultCapGiaySubStep = (type?: string | null): string => {
  if (!type) return 'tham_dinh';
  const t = type.toLowerCase().trim();
  const short = getShortRecordType(type);

  // 1. Nếu là thủ tục Cấp lại (3.3.1 - không thuế) -> Mặc định cần Thẩm định (Bước 1)
  if (short.startsWith('3.3.1') || (t.includes('cấp lại') && !t.includes('thuế'))) {
    return 'tham_dinh';
  }

  // 2. Nếu là thủ tục Có thuế -> Mặc định Phiếu chuyển thuế (Bước 2)
  if (isTaxDefaultRecordType(type)) {
    return 'phieu_chuyen_thue';
  }

  // 3. Với các hồ sơ không thuế còn lại (3.2.1 Cấp đổi, 3.4.1 Tách - hợp thửa, 3.5.1 Gia hạn, 37.1 Đính chính...)
  // Mặc định giao việc tại In và Hoàn thiện GCN (Bước 4: hoan_thien_trinh_duyet)
  return 'hoan_thien_trinh_duyet';
};

export const getRecordPlotCount = (record: RecordFile | Partial<RecordFile> | null | undefined): number => {
  if (!record) return 0;
  if (!record.landPlot || typeof record.landPlot !== 'string' || !record.landPlot.trim()) {
    return 1; // Mặc định tính 1 thửa đất
  }
  const str = record.landPlot.trim();
  const parts = str.split(/[,;+\n]|\bvà\b/i).map(p => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts.length : 1;
};

export const getCapGiaySubStepLabel = (subStep?: string | null): string => {
  if (!subStep || subStep === 'tham_dinh' || subStep === 'tham_tra') return 'Thẩm tra';
  if (subStep === 'phieu_chuyen_thue') return 'Phiếu chuyển thuế';
  if (subStep === 'cho_nop_thue' || subStep === 'cho_giay_nop_tien') return 'Chờ giấy nộp tiền';
  if (subStep === 'hoan_thien_trinh_duyet' || subStep === 'in_hoan_thien') return 'In & Hoàn thiện';
  if (subStep === 'vo_so_gcn') return 'Vô số GCN';
  if (subStep === 'cho_ban_giao') return 'Chờ bàn giao';
  return subStep;
};

export const getCapGiaySubStepFullLabel = (subStep?: string | null): string => {
  if (!subStep || subStep === 'tham_dinh' || subStep === 'tham_tra') return 'Thẩm tra';
  if (subStep === 'phieu_chuyen_thue') return 'Phiếu chuyển thuế';
  if (subStep === 'cho_nop_thue' || subStep === 'cho_giay_nop_tien') return 'Chờ giấy nộp tiền';
  if (subStep === 'hoan_thien_trinh_duyet' || subStep === 'in_hoan_thien') return 'In & Hoàn thiện';
  if (subStep === 'vo_so_gcn') return 'Vô số GCN & Ngày ký';
  if (subStep === 'cho_ban_giao') return 'Chờ bàn giao 1 cửa';
  return subStep;
};

export const getCapGiaySubStepBadgeColor = (subStep?: string | null): string => {
  if (!subStep || subStep === 'tham_dinh') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (subStep === 'phieu_chuyen_thue') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (subStep === 'cho_nop_thue') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (subStep === 'hoan_thien_trinh_duyet') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (subStep === 'vo_so_gcn') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (subStep === 'cho_ban_giao') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

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
