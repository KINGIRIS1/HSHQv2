
import { RecordStatus, Employee, RecordFile, User, UserRole, Contract } from './types';

// CẤU HÌNH KẾT NỐI
// QUAN TRỌNG: Để dùng Cloud (Supabase), hãy dán URL dự án vào đây.
// Nếu dùng Mạng LAN (Local), đổi lại thành 'http://localhost:3005'
export const API_BASE_URL = 'https://dajjhubrhybodggbqapt.supabase.co'; 

// PHIÊN BẢN HIỆN TẠI CỦA ỨNG DỤNG
export const APP_VERSION = '2.1.1';

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận mới',
  [RecordStatus.ASSIGNED]: 'Đang thực hiện',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.PENDING_CHECK]: 'Chờ kiểm tra',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký duyệt',
  [RecordStatus.SIGNED]: 'Chờ bàn giao',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.PENDING_SUPPLEMENT]: 'Chờ bổ sung',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.WITHDRAWN]: 'CSD rút hồ sơ',
  [RecordStatus.REJECTED]: 'Hồ sơ trả',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'bg-gray-100 text-gray-800 border border-gray-200',
  [RecordStatus.ASSIGNED]: 'bg-blue-100 text-blue-800 border border-blue-200 font-bold',
  [RecordStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800 border border-blue-200 font-bold',
  [RecordStatus.PENDING_CHECK]: 'bg-orange-100 text-orange-800',
  [RecordStatus.PENDING_SIGN]: 'bg-purple-100 text-purple-800',
  [RecordStatus.SIGNED]: 'bg-purple-100 text-purple-800',
  [RecordStatus.HANDOVER]: 'bg-green-100 text-green-800',
  [RecordStatus.PENDING_SUPPLEMENT]: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
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
  '2.3 Cập nhật số thửa',
  '2.4 Trích đo Cắm mốc',
  '2.5 Trích đo Tách - Hợp thửa'
];

// Danh sách loại hồ sơ CẤP GIẤY / ĐĂNG KÝ BIẾN ĐỘNG ĐẤT ĐAI (3.x)
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
  '3.7.1 Đính chính GCN'
];

// Danh sách loại hồ sơ CHÍNH DÙNG CHO TIẾP NHẬN (Tất cả từ 1.1 đến 3.7.1)
export const RECORD_TYPES = [
  ...ARCHIVE_RECORD_TYPES,
  ...MEASUREMENT_RECORD_TYPES,
  ...CAP_GIAY_RECORD_TYPES
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
  '3.7.1 Đính chính GCN': 'Đính chính - Biến động thông tin Giấy chứng nhận',
  '37.1 Đính chính - Biến động': 'Đính chính - Biến động đất đai'
};

// Danh sách loại hồ sơ MỞ RỘNG
export const EXTENDED_RECORD_TYPES = RECORD_TYPES;

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
export const getShortRecordType = (
  typeOrRecord?: string | { recordType?: string | null; receivedDate?: string | null; deadline?: string | null } | null,
  receivedDateParam?: string | null,
  deadlineParam?: string | null
): string => {
  let type: string | null | undefined = null;
  let receivedDate: string | null | undefined = receivedDateParam;
  let deadline: string | null | undefined = deadlineParam;

  if (typeof typeOrRecord === 'object' && typeOrRecord !== null) {
    type = typeOrRecord.recordType;
    receivedDate = typeOrRecord.receivedDate;
    deadline = typeOrRecord.deadline;
  } else {
    type = typeOrRecord as string;
  }

  if (!type) return '---';
  const t = type.toLowerCase().trim();
  
  if (t.startsWith('1.1') || t === 'cung cấp tài liệu đất đai' || t === 'cung cấp dữ liệu đất đai' || t === 'sao lục' || t === 'sao luc' || t === 'sao lục hồ sơ' || t === '1.1 cc dl đđ' || t === '1.1 sao lục') return '1.1 Sao lục';
  if (t.startsWith('1.2') || t === 'công văn') return '1.2 Công văn';
  if (t.includes('trích lục quy hoạch') || t.includes('trích lục qh') || t === '2.1 trích lục qh' || t === '2.1 trích lục quy hoạch' || t.startsWith('2.1') || t === 'trích lục') return '2.1 Trích lục';

  if (t.startsWith('2.2') || t === 'trích đo' || (t.includes('trích đo') && !t.includes('cắm mốc') && !t.includes('tách') && !t.includes('hợp') && !t.startsWith('2.3'))) {
    return '2.2 Trích đo';
  }

  // Xử lý 2.3 (Trước đây 2.3 là Trích đo, nay 2.3 là CN Số Thửa và 2.2 là Trích đo)
  if (t.startsWith('2.3') || t === 'cung cấp số thửa đất' || t === 'cung cấp số thửa' || t === 'cc số thửa' || t === 'cập nhập số thửa' || t === 'cập nhật số thửa' || t === 'cn số thửa') {
    if (t.includes('trích đo')) {
      return '2.2 Trích đo';
    }
    const dateStr = receivedDate || deadline;
    if (dateStr) {
      const year = parseInt(String(dateStr).substring(0, 4), 10);
      if (!isNaN(year) && year < 2025) {
        return '2.2 Trích đo';
      }
    }
    return '2.3 CN Số Thửa';
  }

  if (t.startsWith('2.4') || t === 'cắm mốc' || t === 'trích đo cắm mốc') return '2.4 Cắm mốc';
  if (t.startsWith('2.5') || t === 'tách thửa' || t === 'tách-hợp thửa' || t === 'trích đo tách - hợp thửa') return '2.5 Tách-Hợp thửa';

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
  if (t.startsWith('3.7.1') || t.startsWith('37.1') || t.startsWith('3.5.2') || t.includes('đính chính')) return '3.7.1 Đính chính GCN';

  // Fallbacks for legacy other categories
  if (t.includes('cung cấp tài liệu đất đai') || t.includes('cung cấp dữ liệu') || t.includes('sao lục') || t.includes('sao luc') || t.includes('cc dl đđ')) return '1.1 Sao lục';
  if (t.includes('trích lục quy hoạch') || t.includes('trích lục qh')) return '2.1 Trích lục';
  if (t.includes('cung cấp số thửa đất') || t.includes('số thửa') || t.includes('cập nhập số thửa') || t.includes('cập nhật số thửa')) {
    const dateStr = receivedDate || deadline;
    if (dateStr) {
      const year = parseInt(String(dateStr).substring(0, 4), 10);
      if (!isNaN(year) && year < 2025) {
        return '2.2 Trích đo';
      }
    }
    return '2.3 CN Số Thửa';
  }
  if (t.includes('trích đo') && t.includes('cắm mốc')) return '2.4 Cắm mốc';
  if (t.includes('trích đo') && (t.includes('tách') || t.includes('hợp'))) return '2.5 Tách-Hợp thửa';
  if (t.includes('trích đo')) {
    return '2.2 Trích đo';
  }
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
  { id: 'tiep_nhan', label: '1. Tiếp nhận', shortLabel: 'Tiếp nhận', slaDays: 1, color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
  { id: 'tham_dinh', label: '2. Thẩm định', shortLabel: 'Thẩm định', slaDays: 1, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { id: 'phieu_chuyen_thue', label: '3. Phiếu chuyển thuế', shortLabel: 'Phiếu chuyển thuế', slaDays: 2, color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { id: 'cho_tbt', label: '4. Chờ TBT (5 ngày)', shortLabel: 'Chờ TBT', slaDays: 5, color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
  { id: 'cho_nop_thue', label: '5. Chờ nộp thuế (GNT)', shortLabel: 'Chờ nộp thuế', slaDays: 0, color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { id: 'hoan_thien_trinh_duyet', label: '6. In & Hoàn thiện', shortLabel: 'In & Hoàn thiện', slaDays: 3, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { id: 'kiem_tra', label: '7. Kiểm tra', shortLabel: 'Kiểm tra', slaDays: 1, color: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100' },
  { id: 'trinh_ky', label: '8. Trình ký', shortLabel: 'Trình ký', slaDays: 1, color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
  { id: 'vo_so_gcn', label: '9. Vô số GCN', shortLabel: 'Vô số GCN', slaDays: 1, color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100' },
  { id: 'cho_ban_giao', label: '10. Giao 1 cửa', shortLabel: 'Giao 1 cửa', slaDays: 1, color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
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
  return 'tiep_nhan';
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
  if (subStep === 'tiep_nhan') return 'Tiếp nhận';
  if (!subStep || subStep === 'tham_dinh' || subStep === 'tham_tra') return 'Thẩm định';
  if (subStep === 'phieu_chuyen_thue') return 'Phiếu chuyển thuế';
  if (subStep === 'cho_tbt') return 'Chờ TBT';
  if (subStep === 'cho_nop_thue' || subStep === 'cho_giay_nop_tien') return 'Chờ nộp thuế (GNT)';
  if (subStep === 'hoan_thien_trinh_duyet' || subStep === 'in_hoan_thien') return 'In & Hoàn thiện';
  if (subStep === 'kiem_tra') return 'Kiểm tra';
  if (subStep === 'trinh_ky') return 'Trình ký';
  if (subStep === 'vo_so_gcn') return 'Vô số GCN';
  if (subStep === 'cho_ban_giao') return 'Giao 1 cửa';
  return subStep;
};

export const getCapGiaySubStepFullLabel = (subStep?: string | null): string => {
  if (subStep === 'tiep_nhan') return '1. Tiếp nhận';
  if (!subStep || subStep === 'tham_dinh' || subStep === 'tham_tra') return '2. Thẩm định';
  if (subStep === 'phieu_chuyen_thue') return '3. Phiếu chuyển thuế';
  if (subStep === 'cho_tbt') return '4. Chờ TBT (5 ngày)';
  if (subStep === 'cho_nop_thue' || subStep === 'cho_giay_nop_tien') return '5. Chờ nộp thuế (GNT)';
  if (subStep === 'hoan_thien_trinh_duyet' || subStep === 'in_hoan_thien') return '6. In & Hoàn thiện';
  if (subStep === 'kiem_tra') return '7. Kiểm tra';
  if (subStep === 'trinh_ky') return '8. Trình ký';
  if (subStep === 'vo_so_gcn') return '9. Vô số GCN & Ngày ký';
  if (subStep === 'cho_ban_giao') return '10. Giao 1 cửa';
  return subStep;
};

export const getCapGiaySubStepBadgeColor = (subStep?: string | null): string => {
  if (subStep === 'tiep_nhan') return 'bg-slate-50 text-slate-700 border-slate-200';
  if (!subStep || subStep === 'tham_dinh') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (subStep === 'phieu_chuyen_thue') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (subStep === 'cho_tbt') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (subStep === 'cho_nop_thue') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (subStep === 'hoan_thien_trinh_duyet') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (subStep === 'kiem_tra') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (subStep === 'trinh_ky') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (subStep === 'vo_so_gcn') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (subStep === 'cho_ban_giao') return 'bg-rose-50 text-rose-700 border-rose-200';
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
