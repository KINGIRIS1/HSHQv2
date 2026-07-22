
// Định nghĩa trạng thái của hồ sơ theo quy trình
export enum RecordStatus {
  RECEIVED = 'RECEIVED',         // Tiếp nhận
  ASSIGNED = 'ASSIGNED',         // Giao nhân viên
  IN_PROGRESS = 'IN_PROGRESS',   // Đang thực hiện
  COMPLETED_WORK = 'COMPLETED_WORK', // Đã thực hiện (Mới: Nhân viên làm xong, chưa trình)
  PENDING_CHECK = 'PENDING_CHECK', // Chờ kiểm tra
  CHECKED = 'CHECKED',           // Đã kiểm tra
  PENDING_SIGN = 'PENDING_SIGN', // Chờ ký duyệt (Đã trình)
  SIGNED = 'SIGNED',             // Đã ký (Lập danh sách ký)
  HANDOVER = 'HANDOVER',         // Giao 1 cửa (Hoàn thành nội bộ)
  RETURNED = 'RETURNED',         // Đã trả kết quả (Hoàn thành trả dân)
  WITHDRAWN = 'WITHDRAWN',       // CSD rút hồ sơ (Kết thúc)
  REJECTED = 'REJECTED'          // Hồ sơ trả (Trả về OneDoor)
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SUBADMIN = 'SUBADMIN', // Phó quản trị (Quyền như Admin trừ quản lý User)
  TEAM_LEADER = 'TEAM_LEADER', // Nhóm trưởng (Quyền quản lý tác vụ, xem báo cáo, trích lục)
  EMPLOYEE = 'EMPLOYEE',
  ONEDOOR = 'ONEDOOR'    // Bộ phận một cửa (Chỉ tiếp nhận và xem)
}

export type RolePermissions = Record<string, string[]>;
export type DepartmentPermissions = Record<string, string[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.ADMIN]: ['*'],
  [UserRole.SUBADMIN]: ['VIEW_RECORDS', 'ADD_RECORDS', 'EDIT_RECORDS', 'DELETE_RECORDS', 'ASSIGN_RECORDS', 'CHECK_RECORDS', 'SIGN_RECORDS', 'HANDOVER_RECORDS', 'RETURN_RECORDS', 'EXPORT_RECORDS', 'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'DELETE_CONTRACTS', 'EXPORT_CONTRACTS', 'VIEW_EXCERPTS', 'MANAGE_EXCERPTS', 'VIEW_ARCHIVE', 'MANAGE_ARCHIVE', 'VIEW_REPORTS', 'MANAGE_EMPLOYEES', 'VIEW_CHAT', 'VIEW_SCHEDULE', 'MANAGE_SCHEDULE', 'VIEW_PERSONAL_PROFILE', 'BTN_REJECT_RECORD', 'BTN_SUBMIT_SIGN', 'BTN_CLOSE_BATCH'],
  [UserRole.TEAM_LEADER]: ['VIEW_RECORDS', 'EDIT_RECORDS', 'ASSIGN_RECORDS', 'CHECK_RECORDS', 'EXPORT_RECORDS', 'VIEW_CONTRACTS', 'VIEW_EXCERPTS', 'MANAGE_EXCERPTS', 'VIEW_ARCHIVE', 'VIEW_REPORTS', 'VIEW_CHAT', 'VIEW_SCHEDULE', 'VIEW_PERSONAL_PROFILE', 'BTN_REJECT_RECORD', 'BTN_SUBMIT_SIGN', 'BTN_CLOSE_BATCH'],
  [UserRole.ONEDOOR]: ['VIEW_RECORDS', 'ADD_RECORDS', 'HANDOVER_RECORDS', 'RETURN_RECORDS', 'EXPORT_RECORDS', 'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'VIEW_EXCERPTS', 'VIEW_ARCHIVE', 'VIEW_CHAT', 'VIEW_SCHEDULE', 'BTN_REJECT_RECORD', 'BTN_CLOSE_BATCH'],
  [UserRole.EMPLOYEE]: ['VIEW_RECORDS', 'EDIT_RECORDS', 'VIEW_CONTRACTS', 'VIEW_EXCERPTS', 'VIEW_ARCHIVE', 'VIEW_CHAT', 'VIEW_SCHEDULE', 'VIEW_PERSONAL_PROFILE', 'BTN_SUBMIT_SIGN']
};

export const AVAILABLE_PERMISSIONS = [
  { id: 'VIEW_RECORDS', label: 'Xem hồ sơ' },
  { id: 'ADD_RECORDS', label: 'Thêm hồ sơ' },
  { id: 'EDIT_RECORDS', label: 'Sửa hồ sơ' },
  { id: 'DELETE_RECORDS', label: 'Xóa hồ sơ' },
  { id: 'ASSIGN_RECORDS', label: 'Giao hồ sơ' },
  { id: 'CHECK_RECORDS', label: 'Kiểm tra hồ sơ' },
  { id: 'SIGN_RECORDS', label: 'Ký duyệt hồ sơ' },
  { id: 'HANDOVER_RECORDS', label: 'Bàn giao hồ sơ' },
  { id: 'RETURN_RECORDS', label: 'Trả kết quả hồ sơ' },
  { id: 'EXPORT_RECORDS', label: 'Xuất danh sách hồ sơ' },
  { id: 'VIEW_CONTRACTS', label: 'Xem hợp đồng' },
  { id: 'ADD_CONTRACTS', label: 'Thêm hợp đồng' },
  { id: 'EDIT_CONTRACTS', label: 'Sửa hợp đồng' },
  { id: 'DELETE_CONTRACTS', label: 'Xóa hợp đồng' },
  { id: 'EXPORT_CONTRACTS', label: 'Xuất danh sách hợp đồng' },
  { id: 'VIEW_EXCERPTS', label: 'Xem trích lục' },
  { id: 'MANAGE_EXCERPTS', label: 'Quản lý trích lục' },
  { id: 'VIEW_ARCHIVE', label: 'Xem lưu trữ' },
  { id: 'MANAGE_ARCHIVE', label: 'Quản lý lưu trữ' },
  { id: 'VIEW_REPORTS', label: 'Xem báo cáo' },
  { id: 'MANAGE_USERS', label: 'Quản lý người dùng' },
  { id: 'MANAGE_EMPLOYEES', label: 'Quản lý nhân sự' },
  { id: 'SYSTEM_SETTINGS', label: 'Cài đặt hệ thống' },
  { id: 'VIEW_CHAT', label: 'Sử dụng nội bộ' },
  { id: 'VIEW_SCHEDULE', label: 'Xem lịch công tác' },
  { id: 'MANAGE_SCHEDULE', label: 'Quản lý lịch công tác' },
  { id: 'VIEW_PERSONAL_PROFILE', label: 'Xem hồ sơ cá nhân' },
  { id: 'BTN_REJECT_RECORD', label: 'Nút: Trả hồ sơ' },
  { id: 'BTN_SUBMIT_SIGN', label: 'Nút: Trình ký / Trình KT' },
  { id: 'BTN_CLOSE_BATCH', label: 'Nút: Tạo đợt / Chốt đợt' }
];

export interface User {
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  employeeId?: string;
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  position?: string; // MỚI: Tách riêng chức vụ
  managedWards: string[];
}

export interface RecordFile {
  id: string;
  code: string;           
  customerName: string;   
  phoneNumber?: string | null;   
  cccd?: string | null;          
  customerAddress?: string | null;
  
  ward?: string | null;          
  landPlot?: string | null;      
  mapSheet?: string | null;      
  area?: number | null;          
  address?: string | null;       
  group?: string | null;         
  
  issueNumber?: string | null;   // Số phát hành
  entryNumber?: string | null;   // Số vào sổ
  issueDate?: string | null;     // Ngày cấp
  residentialArea?: number | null; // Đất ở

  content?: string | null;        
  recordType?: string | null;    
  
  receivedDate?: string | null;   
  receivedBy?: string | null; // Người nhận hồ sơ (ID của user)
  deadline?: string | null;       
  assignedDate?: string | null;  
  
  submissionDate?: string | null; // Ngày trình ký
  submittedTo?: string | null;    // Người được trình ký (ID của giám đốc)
  pendingCheckDate?: string | null; // Ngày trình kiểm tra
  checkedBy?: string | null;      // Người kiểm tra (ID của tổ trưởng/tổ phó)
  checkedDate?: string | null;    // Ngày đã kiểm tra
  completedWorkDate?: string | null; // Ngày đã thực hiện
  approvalDate?: string | null;   // Ngày ký duyệt
  completedDate?: string | null; 
  
  status: RecordStatus;   
  assignedTo?: string | null;    
  notes?: string | null;         
  privateNotes?: string | null;  
  personalNotes?: string | null; // Ghi chú cá nhân của nhân viên
  
  authorizedBy?: string | null;  
  authDocType?: string | null;   
  otherDocs?: string | null;     

  exportBatch?: number | null;   
  exportDate?: string | null;    
  handoverWard?: string | null; // Nơi giao trả kết quả (nếu khác địa chỉ thửa đất)
  
  measurementNumber?: string | null; 
  excerptNumber?: string | null;
  
  // Tính năng nhắc nhở
  reminderDate?: string | null;      // Thời gian đặt lịch nhắc
  lastRemindedAt?: string | null;    // Thời gian đã thông báo lần cuối
  deadlineReminded?: boolean | null; // Đã nhắc nhở hết hạn giải quyết (nhắc 1 lần)

  // Tính năng trả kết quả
  receiptNumber?: string | null;     // Số biên lai
  receiverName?: string | null;      // Người nhận kết quả (Mới)
  resultReturnedDate?: string | null; // Ngày trả kết quả cho dân
  returnedPrice?: number | null;     // Số tiền thực tế khi trả kết quả (Mới)

  // Tính năng Chỉnh lý bản đồ (Mới)
  needsMapCorrection?: boolean; // True nếu cần lập danh sách chỉnh lý
  explanationPlan?: string | null; // Phương án giải trình (Mới)

  // Đã xuất danh sách giao (Hồ sơ tiếp nhận trong ngày)
  isHandedOver?: boolean;

  // Giá trực tiếp cho hồ sơ
  price?: number | null;
  advancePayment?: number | null;
}

// Interface cho Item tách thửa
export interface SplitItem {
  serviceName: string; // Loại sản phẩm (VD: Tách thửa < 100m2)
  quantity: number;
  price: number;
  area?: number; // Diện tích thửa mới tách
  landPlot?: string; // MỚI: Số thửa
  mapSheet?: string; // MỚI: Tờ bản đồ
}

// Interface riêng cho Hợp Đồng (Lưu table khác)
export interface Contract {
  id: string;
  code: string;           
  customerName: string;
  phoneNumber?: string | null;
  customerAddress?: string | null;
  ward?: string | null;
  address?: string | null;
  landPlot?: string | null;
  mapSheet?: string | null;
  area?: number | null;
  
  // Phân loại logic
  contractType: 'Đo đạc' | 'Tách thửa' | 'Cắm mốc' | 'Trích lục'; // Đã bổ sung Trích lục
  serviceType: string;    // Tên dịch vụ chi tiết (VD: Đo đạc tòa án)
  areaType: string;       // Khu vực (Đất đô thị / Nông thôn)

  // Số lượng đặc thù
  plotCount?: number | null;     // Số thửa (cho Đo đạc)
  markerCount?: number | null;   // Số mốc (cho Cắm mốc)
  splitItems?: SplitItem[]; // Danh sách tách thửa (lưu JSON)

  // Tài chính
  quantity: number;       // Số lượng chung (để tính tiền cơ bản)
  unitPrice: number;      
  vatRate: number;        // % Thuế
  vatAmount: number;      // Tiền thuế
  totalAmount: number;    
  deposit: number;        
  content?: string | null;       
  
  createdDate: string;    
  status: 'PENDING' | 'COMPLETED';

  // Thanh lý
  liquidationArea?: number | null; // Diện tích thanh lý thực tế
  liquidationAmount?: number | null; // MỚI: Giá trị thanh lý thực tế (tiền)
}

// Interface cho Bảng giá (Cập nhật theo hình ảnh)
export interface PriceItem {
  id: string;
  serviceGroup?: string;  // Loại HS (VD: Đo đạc tòa án)
  areaType?: string;      // Khu vực (Đất đô thị/nông thôn)
  serviceName: string;    // Tên sản phẩm
  minArea: number;        // DTMin
  maxArea: number;        // DTMax
  unit: string;           // Đơn vị
  price: number;          // Giá sản phẩm
  vatRate: number;        // VAT
  vatIsPercent: boolean;  // VAT_IS_PERCENT
}

export interface ReportData {
  total: number;
  completed: number;
  processing: number;
  overdue: number;
  weeklySummary: string;
}

// Interface cho Nhóm Chat
export interface ChatGroup {
  id: string;
  name: string;
  type: 'CUSTOM' | 'SYSTEM'; // SYSTEM là nhóm mặc định nếu cần
  created_by?: string;
  created_at?: string;
  members?: string[];
}

// Interface cho Tin nhắn Chat
export interface Message {
  id: string;
  group_id?: string; // ID nhóm chat, nếu null hoặc 'GENERAL' là nhóm chung
  sender_username: string;
  sender_name: string;
  content: string;
  file_url?: string;
  file_name?: string;
  file_type?: string; // 'image' | 'document' | 'other'
  created_at: string;
  
  // Tính năng mới
  reply_to_id?: string | null;       // ID tin nhắn gốc
  reply_to_content?: string | null; // Nội dung tin nhắn gốc (snapshot)
  reply_to_sender?: string | null;  // Người gửi tin nhắn gốc
  reactions?: Record<string, string>; // { "username": "❤️", "username2": "👍" }
}

// Interface cho Ngày nghỉ lễ
export interface Holiday {
  id: string;
  name: string;       // Tên ngày lễ (VD: Tết Nguyên Đán)
  day: number;        // Ngày
  month: number;      // Tháng
  isLunar: boolean;   // true = Âm lịch, false = Dương lịch
}

// Interface cho Lịch công tác
export interface WorkSchedule {
  id: string;
  date: string;       // Ngày công tác (YYYY-MM-DD)
  executors: string;  // Người thực hiện (Lưu dạng chuỗi text: "Nguyễn Văn A, Trần B")
  content: string;    // Văn bản / Nội dung công tác
  partner: string;    // Cơ quan phối hợp
  created_at: string; // Ngày tạo
  created_by: string; // Người tạo
}

// Interface Notification (Chuyển từ UtilitiesView sang đây để tránh Circular Dependency)
export type NotifyType = 'success' | 'error' | 'info';
export type NotifyFunction = (message: string, type?: NotifyType) => void;
