
// Định nghĩa trạng thái của hồ sơ theo quy trình
export enum RecordStatus {
  RECEIVED = 'RECEIVED',         // Tiếp nhận
  ASSIGNED = 'ASSIGNED',         // Giao nhân viên
  IN_PROGRESS = 'IN_PROGRESS',   // Đang thực hiện
  COMPLETED_WORK = 'COMPLETED_WORK', // Đã thực hiện (Mới: Nhân viên làm xong, chưa trình)
  PENDING_SUPPLEMENT = 'PENDING_SUPPLEMENT', // Chờ bổ sung (Trả dừng quy trình)
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
  [UserRole.SUBADMIN]: ['*'],
  [UserRole.TEAM_LEADER]: [
    'ADD_RECORDS', 'EXPORT_RECORDS',
    'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'LIQUIDATE_CONTRACTS', 'DELETE_CONTRACTS', 'EXPORT_CONTRACTS',
    'dodac_BTN_ASSIGN_STAFF', 'dodac_BTN_SUBMIT_CHECK', 'dodac_BTN_SUBMIT_SIGN', 'dodac_BTN_APPROVE_SIGN', 'dodac_BTN_REJECT_RECORD', 'dodac_HANDOVER_RECORDS', 'dodac_BTN_RETURN_RESULT', 'dodac_VIEW_EXCERPTS', 'dodac_MANAGE_EXCERPTS', 'dodac_BTN_EXTEND_DEADLINE', 'dodac_EDIT_RECORDS', 'dodac_DELETE_RECORDS', 'dodac_VIEW_DETAILS',
    'luutru_BTN_ASSIGN_STAFF', 'luutru_BTN_SUBMIT_CHECK', 'luutru_BTN_SUBMIT_SIGN', 'luutru_BTN_APPROVE_SIGN', 'luutru_BTN_REJECT_RECORD', 'luutru_HANDOVER_RECORDS', 'luutru_BTN_RETURN_RESULT', 'luutru_VIEW_ARCHIVE', 'luutru_MANAGE_ARCHIVE', 'luutru_BTN_EXTEND_DEADLINE', 'luutru_EDIT_RECORDS', 'luutru_DELETE_RECORDS', 'luutru_VIEW_DETAILS',
    'VIEW_SCHEDULE', 'MANAGE_SCHEDULE', 'VIEW_REPORTS', 'VIEW_CHAT', 'VIEW_PERSONAL_PROFILE'
  ],
  [UserRole.ONEDOOR]: [
    'ADD_RECORDS', 'EXPORT_RECORDS',
    'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'LIQUIDATE_CONTRACTS', 'EXPORT_CONTRACTS',
    'VIEW_SCHEDULE', 'VIEW_CHAT', 'VIEW_PERSONAL_PROFILE'
  ],
  [UserRole.EMPLOYEE]: [
    'dodac_BTN_ASSIGN_STAFF', 'dodac_BTN_SUBMIT_CHECK', 'dodac_BTN_SUBMIT_SIGN', 'dodac_BTN_APPROVE_SIGN', 'dodac_BTN_REJECT_RECORD', 'dodac_HANDOVER_RECORDS', 'dodac_BTN_RETURN_RESULT', 'dodac_VIEW_EXCERPTS', 'dodac_MANAGE_EXCERPTS', 'dodac_BTN_EXTEND_DEADLINE', 'dodac_EDIT_RECORDS', 'dodac_DELETE_RECORDS', 'dodac_VIEW_DETAILS',
    'luutru_BTN_ASSIGN_STAFF', 'luutru_BTN_SUBMIT_CHECK', 'luutru_BTN_SUBMIT_SIGN', 'luutru_BTN_APPROVE_SIGN', 'luutru_BTN_REJECT_RECORD', 'luutru_HANDOVER_RECORDS', 'luutru_BTN_RETURN_RESULT', 'luutru_VIEW_ARCHIVE', 'luutru_MANAGE_ARCHIVE', 'luutru_BTN_EXTEND_DEADLINE', 'luutru_EDIT_RECORDS', 'luutru_DELETE_RECORDS', 'luutru_VIEW_DETAILS',
    'VIEW_SCHEDULE', 'VIEW_CHAT', 'VIEW_PERSONAL_PROFILE'
  ]
};

export const AVAILABLE_PERMISSIONS = [
  { id: 'VIEW_RECORDS', label: 'Xem hồ sơ' },
  { id: 'VIEW_DETAILS', label: 'Xem chi tiết hồ sơ' },
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
  { id: 'LIQUIDATE_CONTRACTS', label: 'Thanh lý hợp đồng' },
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
  { id: 'BTN_ASSIGN_STAFF', label: 'Giao việc' },
  { id: 'BTN_RETURN_RESULT', label: 'Trả kết quả hồ sơ' },
  { id: 'BTN_REJECT_RECORD', label: 'Trả hồ sơ' },
  { id: 'BTN_SUBMIT_SIGN', label: 'Trình ký' },
  { id: 'BTN_APPROVE_SIGN', label: 'Ký duyệt' },
  { id: 'BTN_SUBMIT_CHECK', label: 'Trình kiểm tra' },
  { id: 'BTN_CLOSE_BATCH', label: 'Tạo đợt / Chốt đợt' },
  { id: 'BTN_EXTEND_DEADLINE', label: 'Gia hạn' }
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
  
  issueNumber?: string | null;   // Số phát hành (certificate_code)
  certificateCode?: string | null;
  entryNumber?: string | null;   // Số vào sổ (book_number)
  bookNumber?: string | null;
  issueDate?: string | null;     // Ngày cấp (issue_date)
  residentialArea?: number | null; // Đất ở (residential_area)
  totalArea?: number | null;     // Tổng diện tích (total_area)

  content?: string | null;        
  recordType?: string | null;    
  
  receivedDate?: string | null;   
  receivedBy?: string | null; // Người nhận hồ sơ (ID của user)
  deadline?: string | null;       
  assignedDate?: string | null;  
  
  submissionDate?: string | null; // Ngày trình ký
  submittedTo?: string | null;    // Người được trình ký
  pendingCheckDate?: string | null; // Ngày trình kiểm tra
  checkedBy?: string | null;      // Người kiểm tra
  checkedDate?: string | null;    // Ngày đã kiểm tra
  pendingSignDate?: string | null; // Ngày Trình ký
  completedWorkDate?: string | null; // Ngày đã thực hiện
  approvalDate?: string | null;   // Ngày ký duyệt
  completedDate?: string | null; 
  
  status: RecordStatus;   
  assignedTo?: string | null; 
  employeeName?: string | null;  // NV Xử lý   
  notes?: string | null;         
  privateNotes?: string | null;  
  personalNotes?: string | null; // Ghi chú cá nhân của nhân viên
  
  // Người ủy quyền (authorized_person)
  authorizedBy?: string | null;  
  authorizedPersonName?: string | null; // Họ và tên người ủy quyền
  authorizedPersonId?: string | null;   // CCCD người ủy quyền
  authorizedPersonAddress?: string | null; // Địa chỉ người ủy quyền
  authDocType?: string | null;   
  otherDocs?: string | null;     

  exportBatch?: number | string | null;   
  exportDate?: string | null;    
  handoverWard?: string | null; // Nơi giao trả kết quả
  
  measurementNumber?: string | null; 
  excerptNumber?: string | null;
  
  // Tính năng trả kết quả & Chứng từ
  receiptNumber?: string | null;     // Số biên lai
  invoiceNumber?: string | null;     // Số hóa đơn
  receiptType?: 'Biên Lai' | 'Hóa Đơn' | string | null; 
  receiverName?: string | null;      // Người nhận kết quả
  resultReturnedDate?: string | null; // Ngày trả kết quả cho dân
  feeAmount?: number | null;         // Số tiền thu
  returnedPrice?: number | null;     // Số tiền thực tế khi trả kết quả

  // Tính năng Chốt danh sách bàn giao về phòng chuyên môn (Dành cho hồ sơ đã trả kết quả)
  returnBatch?: number | null;
  returnBatchDate?: string | null;
  returnHandoverDept?: string | null;

  // Tính năng Chỉnh lý bản đồ (Mới)
  needsMapCorrection?: boolean; // True nếu cần lập danh sách chỉnh lý
  explanationPlan?: string | null; // Phương án giải trình (Mới)

  // Đã xuất danh sách giao (Hồ sơ tiếp nhận trong ngày)
  isHandedOver?: boolean;
  is_handover?: boolean;
  data?: Record<string, any>;

  // Giá trực tiếp cho hồ sơ
  price?: number | null;
  advancePayment?: number | null;

  // Gia hạn hồ sơ
  originalDeadline?: string | null;  // Hạn gốc ban đầu
  extendedBy?: string | null;        // Người thực hiện gia hạn
  extendedAt?: string | null;        // Thời gian thực hiện gia hạn

  // Bàn giao kho lưu / Danh sách trả kết quả
  archiveBatchName?: string | null;  // Tên đợt lưu kho (ví dụ: Đợt 1)
  archiveExportDate?: string | null; // Ngày xuất danh sách lưu kho
  archiveBatchDate?: string | null;  // Ngày chốt đợt lưu kho
  updatedAt?: string | null;

  // Lịch sử trạng thái và Bàn giao kho lưu
  statusLogs?: RecordStatusLog[];
  archiveHandoverDate?: string | null;
  archiveHandoverBatch?: number | null;

  // Phân loại bảng Cloud Database
  sourceTable?: 'dangky_records' | 'land_records' | 'archive_records' | 'luutru_records';
}

export interface RecordStatusLog {
  id: string;
  recordId: string;
  previousStatus?: string | null;
  newStatus: string;
  changedBy: string;
  changedAt: string;
  note?: string | null;
}

export interface SystemActivityLog {
  id: string;
  timestamp: string;
  performerName: string;
  performerRole?: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RETURN_RESULT' | 'APPROVE' | 'ASSIGN' | 'HANDOVER' | string;
  actionLabel: string;
  targetType: string;
  referenceCode?: string;
  details: string;
  recordId?: string;
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
  cccd?: string | null;            // Số CCCD/CMND chủ sử dụng
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
  recordType?: string | null; // Loại hồ sơ liên kết

  // Cán bộ & Ghi chú
  assignedTo?: string | null; // Cán bộ phụ trách
  notes?: string | null;      // Ghi chú hợp đồng / thanh lý

  // Số lượng đặc thù
  plotCount?: number | null;     // Số thửa (cho Đo đạc)
  markerCount?: number | null;   // Số mốc (cho Cắm mốc)
  splitItems?: SplitItem[]; // Danh sách tách thửa (lưu JSON)

  // Tài chính (Thu tiền 1 lần khi hoàn tất)
  quantity: number;       // Số lượng chung (để tính tiền cơ bản)
  unitPrice: number;      
  vatRate: number;        // % Thuế
  vatAmount: number;      // Tiền thuế
  totalAmount: number;    
  deposit: number;        // Luôn = 0 (Thu 1 lần)
  content?: string | null;       
  
  createdDate: string;    
  status: 'PENDING' | 'COMPLETED';

  // Thanh lý (Liên kết theo Mã HĐ / Hồ sơ)
  liquidationArea?: number | null; // Diện tích thanh lý thực tế
  liquidationAmount?: number | null; // Giá trị thanh lý thực tế (tiền)
  liquidationDate?: string | null; // Ngày thanh lý hợp đồng thực tế
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

declare global {
  interface Window {
    electronAPI?: any;
  }
}
