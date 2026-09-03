
import { RecordStatus, Employee, RecordFile, User, UserRole, Contract } from './types';

// CẤU HÌNH KẾT NỐI
// QUAN TRỌNG: Để dùng Cloud (Supabase), hãy dán URL dự án vào đây.
// Nếu dùng Mạng LAN (Local), đổi lại thành 'http://localhost:3005'
export const API_BASE_URL = 'https://lrnfdksqepztnihrkgrr.supabase.co'; 

// PHIÊN BẢN HIỆN TẠI CỦA ỨNG DỤNG
export const APP_VERSION = '2.1.1';

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận mới',
  [RecordStatus.ASSIGNED]: 'Đang thực hiện',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.COMPLETED_WORK]: 'Đang thực hiện',
  [RecordStatus.PENDING_SUPPLEMENT]: 'Chờ bổ sung',
  [RecordStatus.PENDING_CHECK]: 'Chờ kiểm tra',
  [RecordStatus.CHECKED]: 'Đã kiểm tra',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký duyệt',
  [RecordStatus.SIGNED]: 'Chờ bàn giao',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.WITHDRAWN]: 'CSD rút hồ sơ',
  [RecordStatus.REJECTED]: 'Trả hồ sơ',
};

export const SELECTABLE_STATUSES: { key: RecordStatus; label: string }[] = [
  { key: RecordStatus.RECEIVED, label: 'Tiếp nhận mới' },
  { key: RecordStatus.IN_PROGRESS, label: 'Đang thực hiện' },
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
  [RecordStatus.COMPLETED_WORK]: 'bg-cyan-100 text-cyan-800', // MỚI: Đã bổ sung
  [RecordStatus.PENDING_SUPPLEMENT]: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
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
  '2.5 Tách-Hợp thửa'
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
  if (t.startsWith('2.3') || t.startsWith('2.6') || t === 'cung cấp số thửa đất' || t === 'cung cấp số thửa' || t === 'cc số thửa' || t === 'cập nhập số thửa' || t === 'cập nhật số thửa' || t === 'cn số thửa' || t.includes('duyệt đơn') || t.includes('duyet don') || t.includes('số thửa') || t.includes('so thua') || t.includes('duyệt đơn & cung cấp số thửa') || t.includes('duyệt đơn-số thửa')) return '2.3 Duyệt đơn';
  if (t.startsWith('2.4') || t === 'cắm mốc' || t === 'trích đo cắm mốc') return '2.4 Cắm mốc';
  if (t.startsWith('2.5') || t === 'tách thửa' || t === 'tách-hợp thửa' || t === 'trích đo tách - hợp thửa') return '2.5 Tách-Hợp thửa';
  if (t.startsWith('2.')) return type;

  // 3. Nhóm 3.x - Đăng ký đất đai / Biến động / Cấp giấy
  if (t.startsWith('3.1')) return '3.1 Đăng ký biến động';
  if (t.startsWith('3.2')) return '3.2 Cấp GCN';
  if (t.startsWith('3.')) return type;

  // Fallbacks for legacy other categories
  if (t.includes('cung cấp tài liệu đất đai') || t.includes('cung cấp dữ liệu') || t.includes('sao lục') || t.includes('sao luc') || t.includes('cc dl đđ')) return '1.1 Sao lục';
  if (t.includes('trích lục quy hoạch')) return '2.1 Trích lục';
  if (t.includes('cung cấp số thửa đất') || t.includes('số thửa') || t.includes('cập nhập số thửa') || t.includes('cập nhật số thửa') || t.includes('2.6') || t.includes('duyệt đơn')) return '2.3 Duyệt đơn';
  if (t.includes('trích đo') && t.includes('cắm mốc')) return '2.4 Cắm mốc';
  if (t.includes('trích đo') && (t.includes('tách') || t.includes('hợp'))) return '2.5 Tách-Hợp thửa';
  if (t.includes('trích đo') || t.includes('2.2')) return '2.2 Trích đo';
  if (t.includes('cắm mốc')) return '2.4 Cắm mốc';
  if (t.includes('trích lục')) return '2.1 Trích lục';
  if (t.includes('tách thửa') || t.includes('hợp thửa')) return '2.5 Tách-Hợp thửa';
  if (t.includes('đăng ký biến động') || t.includes('biến động')) return '3.1 Đăng ký biến động';
  if (t.includes('đăng ký đất đai') || t.includes('cấp giấy') || t.includes('cấp đổi')) return '3.2 Cấp GCN';

  // Legacy fallback
  if (t.includes('thi hành án')) return 'Thi hành án';
  if (t.includes('tòa án')) return 'Tòa án';
  if (t.includes('cmd')) return 'CMD';

  return type; // Trả về nguyên bản nếu không khớp quy tắc rút gọn
};

// Hàm hiển thị tên đầy đủ pháp lý của loại hồ sơ - CHỈ DÙNG KHI IN GIẤY TIẾP NHẬN / GIẤY HẸN TRẢ KẾT QUẢ
export const getFullRecordType = (type: string | null | undefined): string => {
  if (!type) return '';
  const short = getShortRecordType(type);
  if (short === '1.1 Sao lục') return '1.1 Cung cấp dữ liệu đất đai (Sao lục hồ sơ)';
  if (short === '1.2 Công văn') return '1.2 Công văn';
  if (short === '2.1 Trích lục') return '2.1 Trích lục bản đồ địa chính';
  if (short === '2.2 Trích đo') return '2.2 Đo đạc chỉnh lý bản đồ địa chính (Trích đo)';
  if (short === '2.3 Duyệt đơn') return '2.3 Cung cấp số thửa đất và duyệt đơn';
  if (short === '2.4 Cắm mốc') return '2.4 Trích đo Cắm mốc ranh giới thửa đất';
  if (short === '2.5 Tách-Hợp thửa') return '2.5 Trích đo Tách thửa - Hợp thửa đất';
  if (short === '3.1 Đăng ký biến động') return '3.1 Đăng ký biến động quyền sử dụng đất';
  if (short === '3.2 Cấp GCN') return '3.2 Đăng ký cấp đổi, cấp lại Giấy chứng nhận';
  return type;
};

export const isArchiveRecordType = (type: string | null | undefined): boolean => {
  if (!type) return false;
  const t = type.toLowerCase().trim();
  if (t.startsWith('1.') || t.startsWith('1.1') || t.startsWith('1.2')) return true;
  const short = getShortRecordType(type);
  return short.startsWith('1.') || short === '1.1 Sao lục' || short === '1.2 Công văn' || t.includes('sao lục') || t.includes('công văn') || t.includes('cung cấp dữ liệu') || t.includes('cung cấp tài liệu');
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
