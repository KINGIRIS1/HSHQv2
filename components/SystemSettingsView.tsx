
import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, Cloud, Loader2, CheckCircle, Save, Globe, Calendar, Plus, Trash2, ShieldAlert, Key, FolderArchive, Upload, Download, RefreshCw, FolderOpen, LayoutDashboard, SlidersHorizontal, Eye, EyeOff, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Search, RotateCcw, FileSpreadsheet, Clock, CheckCircle2 } from 'lucide-react';
import { Holiday, UserRole, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS, AVAILABLE_PERMISSIONS, Employee, RecordStatus, User, RecordFile } from '../types';
import { fetchHolidays, saveHolidays, testDatabaseConnection, saveUpdateInfo, fetchUpdateInfo, getSystemSetting, saveSystemSetting, fetchSystemEvents } from '../services/api';
import { fetchRecords } from '../services/apiRecords';
import { APP_VERSION, DEFAULT_HOLIDAYS, STATUS_LABELS } from '../constants';
import { confirmAction, calculateDeadlineHelper, matchDepartmentKey } from '../utils/appHelpers';
import { createFullBackupData, downloadBackupAsFile, saveBackupToServer, restoreFullBackupToSupabase } from '../services/backupService';
import { 
  getExcelBackupDirectory, 
  saveExcelBackupDirectory, 
  getLastExcelBackupTime, 
  performExcelBackup, 
  EXCEL_BACKUP_FILENAME, 
  EXCEL_BACKUP_PERIOD_DAYS 
} from '../services/excelBackupService';
import { isConfigured } from '../services/supabaseClient';

const PERMISSION_DEPARTMENTS = [
  { id: 'Tổ Lưu trữ', name: 'Tổ Lưu trữ', label: 'Tổ Lưu trữ', desc: 'Bộ phận phụ trách lưu trữ, khai thác thông tin đất đai và hồ sơ lưu trữ' },
  { id: 'Tổ Đo đạc', name: 'Tổ Đo đạc', label: 'Tổ Đo đạc', desc: 'Bộ phận phụ trách đo đạc, chỉnh lý bản đồ và trích đo địa chính' }
];

const ROLES_FOR_DEPARTMENT = [
  { role: UserRole.TEAM_LEADER, label: 'TEAM_LEADER (Team Leader)', badge: 'Quản lý' },
  { role: UserRole.EMPLOYEE, label: 'EMPLOYEE (Nhân viên)', badge: 'Xử lý' },
  { role: UserRole.ONEDOOR, label: 'ONEDOOR (Một cửa)', badge: 'Tiếp nhận / Trả KQ' }
];

const ROLE_OPTIONS = [
  { role: UserRole.SUBADMIN, label: 'SUBADMIN', name: 'SUBADMIN', badge: 'Phân quyền & Quản lý', desc: 'Quyền quản trị hệ thống và cấu hình phân quyền' },
  { role: UserRole.TEAM_LEADER, label: 'TEAM_LEADER', name: 'TEAM_LEADER', badge: 'Quản lý tác vụ', desc: 'Kiểm tra hồ sơ, giao việc, trích lục, hợp đồng' },
  { role: UserRole.EMPLOYEE, label: 'EMPLOYEE', name: 'EMPLOYEE', badge: 'Xử lý chuyên môn', desc: 'Xử lý hồ sơ, biên bản VPHC, hợp đồng' },
  { role: UserRole.ONEDOOR, label: 'ONEDOOR', name: 'ONEDOOR', badge: 'Tiếp nhận & Trả KQ', desc: 'Tiếp nhận hồ sơ mới, bàn giao và trả kết quả' },
  { role: UserRole.ADMIN, label: 'ADMIN', name: 'ADMIN', badge: 'Toàn quyền', desc: 'Toàn quyền truy cập tất cả chức năng' },
];

const PERMISSION_GROUPS = [
  {
    id: 'group_tabs',
    title: '1. Quyền Truy cập Tab & Phân hệ Chuyên môn',
    desc: 'Bật/tắt hiển thị các tab và phân hệ chức năng trên thanh điều hướng của người dùng',
    items: [
      { id: 'receive_record', label: 'Tab Tiếp nhận hồ sơ' },
      { id: 'receive_contract', label: 'Tab Quản lý Hợp đồng dịch vụ' },
      { id: 'all_records', label: 'Tab Hồ sơ Đo đạc' },
      { id: 'archive_records', label: 'Tab Hồ sơ Lưu trữ' },
      { id: 'registration_records', label: 'Tab Đăng ký cấp giấy' },
      { id: 'excerpt_management', label: 'Tab Sổ trích lục / Trích đo' },
      { id: 'work_schedule', label: 'Tab Lịch công tác' },
      { id: 'reports', label: 'Tab Báo cáo & Thống kê' },
      { id: 'utilities', label: 'Tab Tiện ích & Công cụ' },
    ]
  },
  {
    id: 'group_actions_onedoor',
    title: '2. Quyền Thao tác - Tiếp nhận & Hợp đồng',
    desc: 'Các nút bấm và hành động tại phân hệ 1 cửa, hồ sơ và hợp đồng dịch vụ',
    items: [
      { id: 'ADD_RECORDS', label: 'Thêm / Nhập mới hồ sơ' },
      { id: 'EXPORT_RECORDS', label: 'Xuất danh sách hồ sơ (Excel)' },
      { id: 'ADD_CONTRACTS', label: 'Thêm mới hợp đồng' },
      { id: 'EDIT_CONTRACTS', label: 'Sửa thông tin hợp đồng' },
      { id: 'LIQUIDATE_CONTRACTS', label: 'Thanh lý / Quyết toán hợp đồng' },
      { id: 'DELETE_CONTRACTS', label: 'Xóa hợp đồng' },
      { id: 'EXPORT_CONTRACTS', label: 'Xuất báo cáo hợp đồng' },
    ]
  },
  {
    id: 'group_actions_dodac',
    title: '3. Quyền Thao tác - Tổ Đo đạc',
    desc: 'Các nút bấm và hành động xử lý chuyên môn tại Tổ Đo đạc',
    items: [
      { id: 'dodac_ADD_RECORDS', label: 'Thêm mới hồ sơ (Đo đạc)' },
      { id: 'dodac_BTN_ASSIGN_STAFF', label: 'Giao việc (Đo đạc)' },
      { id: 'dodac_BTN_SUBMIT_CHECK', label: 'Trình kiểm tra (Đo đạc)' },
      { id: 'dodac_BTN_SUBMIT_SIGN', label: 'Trình ký (Đo đạc)' },
      { id: 'dodac_BTN_APPROVE_SIGN', label: 'Ký duyệt (Đo đạc)' },
      { id: 'dodac_BTN_REJECT_RECORD', label: 'Trả hồ sơ / Từ chối (Đo đạc)' },
      { id: 'dodac_HANDOVER_RECORDS', label: 'Bàn giao 1 cửa (Đo đạc)' },
      { id: 'dodac_BTN_RETURN_RESULT', label: 'Trả kết quả (Đo đạc)' },
      { id: 'dodac_BTN_EXTEND_DEADLINE', label: 'Gia hạn thời gian (Đo đạc)' },
      { id: 'dodac_EDIT_RECORDS', label: 'Sửa hồ sơ (Đo đạc)' },
      { id: 'dodac_DELETE_RECORDS', label: 'Xóa hồ sơ (Đo đạc)' },
      { id: 'dodac_VIEW_DETAILS', label: 'Xem chi tiết hồ sơ (Đo đạc)' },
      { id: 'dodac_VIEW_EXCERPTS', label: 'Xem trích lục bản đồ' },
      { id: 'dodac_MANAGE_EXCERPTS', label: 'Cấp số trích lục bản đồ' },
    ]
  },
  {
    id: 'group_actions_luutru',
    title: '4. Quyền Thao tác - Tổ Lưu trữ',
    desc: 'Các nút bấm và hành động xử lý chuyên môn tại Tổ Lưu trữ',
    items: [
      { id: 'luutru_ADD_RECORDS', label: 'Thêm mới hồ sơ (Lưu trữ)' },
      { id: 'luutru_BTN_ASSIGN_STAFF', label: 'Giao việc (Lưu trữ)' },
      { id: 'luutru_BTN_SUBMIT_CHECK', label: 'Trình kiểm tra (Lưu trữ)' },
      { id: 'luutru_BTN_SUBMIT_SIGN', label: 'Trình ký (Lưu trữ)' },
      { id: 'luutru_BTN_APPROVE_SIGN', label: 'Ký duyệt (Lưu trữ)' },
      { id: 'luutru_BTN_REJECT_RECORD', label: 'Trả hồ sơ / Từ chối (Lưu trữ)' },
      { id: 'luutru_HANDOVER_RECORDS', label: 'Bàn giao 1 cửa (Lưu trữ)' },
      { id: 'luutru_BTN_RETURN_RESULT', label: 'Trả kết quả (Lưu trữ)' },
      { id: 'luutru_BTN_EXTEND_DEADLINE', label: 'Gia hạn thời gian (Lưu trữ)' },
      { id: 'luutru_EDIT_RECORDS', label: 'Sửa hồ sơ (Lưu trữ)' },
      { id: 'luutru_DELETE_RECORDS', label: 'Xóa hồ sơ (Lưu trữ)' },
      { id: 'luutru_VIEW_DETAILS', label: 'Xem chi tiết hồ sơ (Lưu trữ)' },
      { id: 'VIEW_ARCHIVE', label: 'Tra cứu thông tin lưu trữ' },
      { id: 'MANAGE_ARCHIVE', label: 'Quản lý kho lưu trữ (Mượn/trả)' },
    ]
  },
  {
    id: 'group_system_management',
    title: '5. Quyền Quản trị & Tiện ích chung',
    desc: 'Quản lý lịch tuần, chat, nhân sự, tài khoản và cài đặt hệ thống',
    items: [
      { id: 'VIEW_SCHEDULE', label: 'Xem lịch công tác' },
      { id: 'MANAGE_SCHEDULE', label: 'Quản lý lịch công tác' },
      { id: 'VIEW_REPORTS', label: 'Xem báo cáo thống kê' },
      { id: 'VIEW_CHAT', label: 'Sử dụng chat nội bộ' },
      { id: 'VIEW_PERSONAL_PROFILE', label: 'Xem hồ sơ cá nhân' },
      { id: 'MANAGE_EMPLOYEES', label: 'Quản lý danh sách nhân sự' },
      { id: 'MANAGE_USERS', label: 'Quản lý tài khoản người dùng' },
      { id: 'SYSTEM_SETTINGS', label: 'Cài đặt & Phân quyền hệ thống' },
    ]
  }
];

interface SystemSettingsViewProps {
  onDeleteAllData: () => Promise<boolean>;
  onHolidaysChanged?: () => void;
  employees: Employee[];
  users: User[];
  records?: RecordFile[];
  onOpenCloudInspector?: () => void;
}

const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ 
  onDeleteAllData,
  onHolidaysChanged,
  employees,
  users,
  records,
  onOpenCloudInspector
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'holidays' | 'permissions' | 'data'>('general');
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMsg, setDbTestMsg] = useState('');

  // Update State (Manual Config)
  const [manualVersion, setManualVersion] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);

  // Excel Periodic Auto-Backup
  const [isExecutingExcelBackup, setIsExecutingExcelBackup] = useState(false);
  const [lastExcelBackupTimestamp, setLastExcelBackupTimestamp] = useState<number | null>(null);
  const [excelBackupFeedback, setExcelBackupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Holiday States
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  // Form thêm mới ngày lễ
  const [tempName, setTempName] = useState('');
  const [tempDay, setTempDay] = useState<number>(1);
  const [tempMonth, setTempMonth] = useState<number>(1);
  const [tempIsLunar, setTempIsLunar] = useState(false);
  
  const [savingHolidays, setSavingHolidays] = useState(false);

  // Permissions States
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [departmentPermissions, setDepartmentPermissions] = useState<DepartmentPermissions>({});
  const [selectedRole, setSelectedRole] = useState<UserRole | string>(UserRole.TEAM_LEADER);
  const [selectedDepartmentScope, setSelectedDepartmentScope] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Tổ Lưu trữ');
  const [selectedRoleSub, setSelectedRoleSub] = useState<UserRole | string>(UserRole.EMPLOYEE);
  const [permSearchQuery, setPermSearchQuery] = useState('');
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionTab, setPermissionTab] = useState<'department' | 'role'>('department');

  const allDepartmentOptions = React.useMemo(() => {
    const excludedNormalized = [
      'tổ đăng ký cấp giấy',
      'quản trị hệ thống',
      'ban giám đốc',
      'một cửa',
      'tổ 1 cửa'
    ];

    const baseList = PERMISSION_DEPARTMENTS.map(d => d.id).filter(id => !excludedNormalized.includes(id.toLowerCase().trim()));
    const resultList: string[] = [];

    const addDept = (name: string) => {
      const trimmed = name.trim();
      const lower = trimmed.toLowerCase();
      if (excludedNormalized.includes(lower)) return;

      let standardName = trimmed;
      if (matchDepartmentKey('đo đạc', trimmed)) standardName = 'Tổ Đo đạc';
      else if (matchDepartmentKey('lưu trữ', trimmed)) standardName = 'Tổ Lưu trữ';

      if (!resultList.includes(standardName)) {
        resultList.push(standardName);
      }
    };

    baseList.forEach(addDept);

    if (employees && employees.length > 0) {
      employees.forEach(emp => {
        if (emp.department && emp.department.trim()) {
          addDept(emp.department);
        }
      });
    }

    return resultList.length > 0 ? resultList : ['Tổ Lưu trữ', 'Tổ Đo đạc'];
  }, [employees]);

  // Contract Number Settings States
  const [contractPrefix, setContractPrefix] = useState('HĐ-{năm}-');
  const [contractNextSeq, setContractNextSeq] = useState('1');
  const [isSavingContractSettings, setIsSavingContractSettings] = useState(false);

  // Backup Management States
  const [backupDir, setBackupDir] = useState('');
  const [isSavingBackupDir, setIsSavingBackupDir] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string>('Chưa thực hiện');
  const [isRestoring, setIsRestoring] = useState(false);

  // Custom Dashboard States
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [cardVisibility, setCardVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
      const savedOrder = localStorage.getItem('dashboard_card_order');
      setCardOrder(savedOrder ? JSON.parse(savedOrder) : ['total', 'processing', 'completed', 'withdrawn']);

      const savedVisibility = localStorage.getItem('dashboard_card_visibility');
      setCardVisibility(savedVisibility ? JSON.parse(savedVisibility) : { total: true, processing: true, completed: true, withdrawn: true });
  }, []);

  const handleMoveCard = (index: number, direction: number) => {
      const newOrder = [...cardOrder];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newOrder.length) return;
      
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      
      setCardOrder(newOrder);
      localStorage.setItem('dashboard_card_order', JSON.stringify(newOrder));
  };

  const handleToggleVisibility = (id: string) => {
      const newVisibility = { ...cardVisibility, [id]: !cardVisibility[id] };
      const visibleCount = Object.values(newVisibility).filter(Boolean).length;
      if (visibleCount === 0) {
          alert("Bạn cần giữ lại ít nhất 1 thẻ hiển thị!");
          return;
      }
      setCardVisibility(newVisibility);
      localStorage.setItem('dashboard_card_visibility', JSON.stringify(newVisibility));
  };

  const handleResetConfig = () => {
      const defaultOrder = ['total', 'processing', 'completed', 'withdrawn'];
      const defaultVisibility = { total: true, processing: true, completed: true, withdrawn: true };
      setCardOrder(defaultOrder);
      setCardVisibility(defaultVisibility);
      localStorage.setItem('dashboard_card_order', JSON.stringify(defaultOrder));
      localStorage.setItem('dashboard_card_visibility', JSON.stringify(defaultVisibility));
      alert("Đã khôi phục thiết lập bảng điều khiển mặc định thành công!");
  };

  useEffect(() => {
      loadHolidays();
      loadUpdateConfig();
      loadPermissions();
      loadContractSettings();
      loadBackupSettings();
      loadExcelBackupSettings();

      const handleOpenTab = (e: any) => {
          if (e.detail?.tab) {
              setActiveTab(e.detail.tab);
          }
      };

      const handleExcelSuccess = (e: any) => {
          if (e.detail?.time) {
              setLastExcelBackupTimestamp(e.detail.time);
          }
      };

      window.addEventListener('open_system_settings_tab', handleOpenTab);
      window.addEventListener('excel_backup_success', handleExcelSuccess);

      return () => {
          window.removeEventListener('open_system_settings_tab', handleOpenTab);
          window.removeEventListener('excel_backup_success', handleExcelSuccess);
      };
  }, []);

  const loadExcelBackupSettings = async () => {
      const lastTime = await getLastExcelBackupTime();
      setLastExcelBackupTimestamp(lastTime);
  };

  const handleTriggerExcelBackupNow = async () => {
      setIsExecutingExcelBackup(true);
      setExcelBackupFeedback(null);
      try {
          let currentRecords = records;
          if (!currentRecords || currentRecords.length === 0) {
              currentRecords = await fetchRecords();
          }
          if (!currentRecords || currentRecords.length === 0) {
              setExcelBackupFeedback({ type: 'error', message: 'Không có dữ liệu hồ sơ để sao lưu.' });
              return;
          }
          const result = await performExcelBackup(currentRecords, employees);
          if (result.success) {
              const now = Date.now();
              setLastExcelBackupTimestamp(now);
              setExcelBackupFeedback({
                  type: 'success',
                  message: `Đã sao lưu thành công file ${result.fileName || EXCEL_BACKUP_FILENAME} (${currentRecords.length} hồ sơ)! Tệp Excel đã được tải trực tiếp về thư mục Downloads.`
              });
          } else {
              setExcelBackupFeedback({
                  type: 'error',
                  message: result.error || 'Lỗi khi sao lưu file Excel.'
              });
          }
      } catch (err: any) {
          setExcelBackupFeedback({
              type: 'error',
              message: err.message || 'Lỗi không xác định khi thực hiện sao lưu.'
          });
      } finally {
          setIsExecutingExcelBackup(false);
      }
  };

  const loadBackupSettings = async () => {
      const savedDir = await getSystemSetting('backup_directory');
      if (savedDir !== null && savedDir !== undefined) {
          setBackupDir(savedDir);
      } else {
          setBackupDir('');
      }
      
      const lastTime = localStorage.getItem('last_weekly_backup_time');
      if (lastTime) {
          setLastBackupTime(new Date(parseInt(lastTime, 10)).toLocaleString('vi-VN'));
      } else {
          const cloudTime = await getSystemSetting('last_weekly_backup_time_cloud');
          if (cloudTime) {
              setLastBackupTime(new Date(parseInt(cloudTime, 10)).toLocaleString('vi-VN'));
          }
      }
  };

  const handleSaveBackupDir = async () => {
      setIsSavingBackupDir(true);
      const success = await saveSystemSetting('backup_directory', backupDir.trim());
      setIsSavingBackupDir(false);
      if (success) {
          alert("Đã lưu cấu hình thư mục lưu trữ sao lưu thành công!");
      } else {
          alert("Lỗi khi lưu cấu hình thư mục.");
      }
  };

  const handleManualBackup = async () => {
      try {
          setIsCreatingBackup(true);
          const data = await createFullBackupData();
          const serverResult = await saveBackupToServer(data, backupDir);
          
          const now = Date.now();
          localStorage.setItem('last_weekly_backup_time', now.toString());
          await saveSystemSetting('last_weekly_backup_time_cloud', now.toString()).catch(() => {});
          setLastBackupTime(new Date(now).toLocaleString('vi-VN'));
          
          downloadBackupAsFile(data);
          
          if (serverResult.success) {
              alert(`Sao lưu thành công!\nTệp lưu trữ cục bộ đã được tải xuống và lưu an toàn trên Server tại:\n${serverResult.filePath}`);
          } else {
              alert("Sao lưu thành công! Bản sao lưu đã được tải xuống trực tiếp về máy của bạn.");
          }
      } catch (error: any) {
          alert("Lỗi khi tạo bản sao lưu: " + error.message);
      } finally {
          setIsCreatingBackup(false);
      }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const confirmFirst = await confirmAction(
          "CẢNH BÁO: Khôi phục dữ liệu sẽ xóa toàn bộ dữ liệu hiện tại trong hệ thống và thay thế hoàn toàn bằng dữ liệu từ tệp sao lưu này.\n\nBạn có chắc chắn muốn tiếp tục khôi phục?"
      );
      if (!confirmFirst) {
          e.target.value = ''; // Reset input
          return;
      }
      
      try {
          setIsRestoring(true);
          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                  const content = event.target?.result as string;
                  const backupData = JSON.parse(content);
                  
                  if (!backupData.version || !backupData.data) {
                      throw new Error("Tệp không đúng định dạng sao lưu chuẩn của hệ thống.");
                  }
                  
                  // Gửi dữ liệu khôi phục lên server
                  const response = await fetch('/api/backup/restore', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ backupData })
                  });
                  
                  if (!response.ok) {
                      const errData = await response.json().catch(() => ({}));
                      throw new Error(errData.error || "Không thể khôi phục trên Server.");
                  }
                  
                  // Khôi phục đồng thời lên Supabase nếu có kết nối
                  if (isConfigured) {
                      await restoreFullBackupToSupabase(backupData);
                  }
                  
                  alert("Khôi phục cơ sở dữ liệu hệ thống thành công! Trang web sẽ tự động tải lại để cập nhật.");
                  window.location.reload();
              } catch (err: any) {
                  alert("Lỗi khi khôi phục từ tệp: " + err.message);
              } finally {
                  setIsRestoring(false);
                  e.target.value = ''; // Reset input
              }
          };
          reader.readAsText(file);
      } catch (err: any) {
          alert("Lỗi đọc tệp: " + err.message);
          setIsRestoring(false);
          e.target.value = '';
      }
  };

  const loadContractSettings = async () => {
      const savedPrefix = await getSystemSetting('contract_prefix');
      const savedSeq = await getSystemSetting('contract_next_seq');
      if (savedPrefix !== null && savedPrefix !== undefined) {
          setContractPrefix(savedPrefix);
      } else {
          setContractPrefix('HĐ-{năm}-');
      }
      if (savedSeq !== null && savedSeq !== undefined) {
          setContractNextSeq(savedSeq);
      } else {
          setContractNextSeq('1');
      }
  };

  const handleSaveContractSettings = async () => {
      if (!contractNextSeq.trim() || isNaN(parseInt(contractNextSeq))) {
          alert("Vui lòng nhập số hợp đồng tiếp theo hợp lệ.");
          return;
      }
      setIsSavingContractSettings(true);
      const successPrefix = await saveSystemSetting('contract_prefix', contractPrefix.trim());
      const successSeq = await saveSystemSetting('contract_next_seq', contractNextSeq.trim());
      setIsSavingContractSettings(false);
      if (successPrefix && successSeq) {
          alert('Đã lưu thiết lập Số hợp đồng thành công!');
      } else {
          alert('Lỗi khi lưu thiết lập Số hợp đồng.');
      }
  };

  const loadPermissions = async () => {
      const savedPerms = await getSystemSetting('role_permissions');
      if (savedPerms) {
          try {
              const parsed = JSON.parse(savedPerms);
              Object.keys(DEFAULT_ROLE_PERMISSIONS).forEach(roleKey => {
                  if (!parsed[roleKey]) {
                      parsed[roleKey] = DEFAULT_ROLE_PERMISSIONS[roleKey as UserRole] || [];
                  }
              });
              setRolePermissions(parsed);
          } catch (e) {
              console.error("Failed to parse role_permissions", e);
              setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
          }
      } else {
          setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      }
      const savedDeptPerms = await getSystemSetting('department_permissions');
      if (savedDeptPerms) {
          try {
              const parsedDept = JSON.parse(savedDeptPerms);
              setDepartmentPermissions(parsedDept);
          } catch (e) {
              console.error("Failed to parse department_permissions", e);
          }
      }
  };

  const handleSavePermissions = async () => {
      setIsSavingPermissions(true);
      const successRole = await saveSystemSetting('role_permissions', JSON.stringify(rolePermissions));
      const successDept = await saveSystemSetting('department_permissions', JSON.stringify(departmentPermissions));
      setIsSavingPermissions(false);
      if (successRole && successDept) {
          if (onHolidaysChanged) onHolidaysChanged();
          alert('Đã lưu cấu hình phân quyền thành công! Hệ thống đã cập nhật quyền hạn ngay lập tức.');
      } else {
          alert('Lỗi khi lưu cấu hình phân quyền.');
      }
  };

  const handleResetPermissions = async () => {
      if (await confirmAction("Bạn có chắc chắn muốn khôi phục cấu hình phân quyền về mặc định ban đầu của hệ thống?")) {
          setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
          setDepartmentPermissions({});
          alert("Đã thiết lập lại trạng thái phân quyền mặc định. Nhấn 'Lưu cấu hình phân quyền' để hoàn tất áp dụng.");
      }
  };

  const getDefaultDeptPerms = (deptName: string, role: string): string[] => {
      const basePerms = rolePermissions[role] || DEFAULT_ROLE_PERMISSIONS[role as UserRole] || [];
      if (matchDepartmentKey('đo đạc', deptName)) {
          const ARCHIVE_PERMS = [
              'archive_records', 'archive_sub_all', 'archive_assign_tasks',
              'archive_completed_list', 'archive_pending_check_list', 'archive_check_list',
              'archive_handover_list', 'archive_director_completed', 'VIEW_ARCHIVE', 'MANAGE_ARCHIVE'
          ];
          return basePerms.filter(p => !ARCHIVE_PERMS.includes(p));
      } else if (matchDepartmentKey('lưu trữ', deptName)) {
          const SURVEY_PERMS = [
              'all_records', 'all_sub_all', 'assign_tasks', 'completed_list',
              'pending_check_list', 'check_list', 'handover_list', 'director_completed', 'survey_list'
          ];
          return basePerms.filter(p => !SURVEY_PERMS.includes(p));
      }
      return basePerms;
  };

  const isPermChecked = (permissionId: string): boolean => {
      if (selectedRole === UserRole.ADMIN) return true;

      if (selectedDepartmentScope !== 'all') {
          const compositeKey = `${selectedDepartmentScope}_${selectedRole}`;
          if (departmentPermissions && departmentPermissions[compositeKey]) {
              const deptPerms = departmentPermissions[compositeKey];
              return deptPerms.includes('*') || deptPerms.includes(permissionId);
          }
          const defaultPerms = getDefaultDeptPerms(selectedDepartmentScope, selectedRole as string);
          return defaultPerms.includes('*') || defaultPerms.includes(permissionId);
      }

      const perms = rolePermissions[selectedRole as string] || DEFAULT_ROLE_PERMISSIONS[selectedRole as UserRole] || [];
      return perms.includes('*') || perms.includes(permissionId);
  };

  const toggleDeptRolePerm = (permissionId: string) => {
      if (selectedRole === UserRole.ADMIN) return;

      if (selectedDepartmentScope !== 'all') {
          const compositeKey = `${selectedDepartmentScope}_${selectedRole}`;
          setDepartmentPermissions(prev => {
              const current = prev[compositeKey] || getDefaultDeptPerms(selectedDepartmentScope, selectedRole as string);
              const isRemoving = current.includes(permissionId);
              const updated = isRemoving
                  ? current.filter(p => p !== permissionId)
                  : [...current, permissionId];
              return { ...prev, [compositeKey]: updated };
          });
          return;
      }

      setRolePermissions(prev => {
          const current = prev[selectedRole as string] || DEFAULT_ROLE_PERMISSIONS[selectedRole as UserRole] || [];
          const isRemoving = current.includes(permissionId);
          const updated = isRemoving
              ? current.filter(p => p !== permissionId)
              : [...current, permissionId];
          return { ...prev, [selectedRole as string]: updated };
      });
  };

  const toggleCategoryAll = (itemIds: string[], selectAll: boolean) => {
      if (selectedRole === UserRole.ADMIN) return;

      if (selectedDepartmentScope !== 'all') {
          const compositeKey = `${selectedDepartmentScope}_${selectedRole}`;
          setDepartmentPermissions(prev => {
              const current = prev[compositeKey] || rolePermissions[selectedRole as string] || DEFAULT_ROLE_PERMISSIONS[selectedRole as UserRole] || [];
              const updated = selectAll
                  ? Array.from(new Set([...current, ...itemIds]))
                  : current.filter(p => !itemIds.includes(p));
              return { ...prev, [compositeKey]: updated };
          });
          return;
      }

      setRolePermissions(prev => {
          const current = prev[selectedRole as string] || DEFAULT_ROLE_PERMISSIONS[selectedRole as UserRole] || [];
          const updated = selectAll
              ? Array.from(new Set([...current, ...itemIds]))
              : current.filter(p => !itemIds.includes(p));
          return { ...prev, [selectedRole as string]: updated };
      });
  };

  const handleResetDeptOverride = () => {
      if (selectedDepartmentScope === 'all') return;
      const compositeKey = `${selectedDepartmentScope}_${selectedRole}`;
      setDepartmentPermissions(prev => {
          const copy = { ...prev };
          delete copy[compositeKey];
          return copy;
      });
  };

  const togglePermission = (roleOrDept: string, permissionId: string, isRole: boolean) => {
      if (isRole && roleOrDept === UserRole.ADMIN) return;
      
      if (isRole) {
          setRolePermissions(prev => {
              const currentPerms = prev[roleOrDept] || [];
              const newPerms = currentPerms.includes(permissionId)
                  ? currentPerms.filter(p => p !== permissionId)
                  : [...currentPerms, permissionId];
              return { ...prev, [roleOrDept]: newPerms };
          });
      } else {
          setDepartmentPermissions(prev => {
              const currentPerms = prev[roleOrDept] || [];
              const newPerms = currentPerms.includes(permissionId)
                  ? currentPerms.filter(p => p !== permissionId)
                  : [...currentPerms, permissionId];
              return { ...prev, [roleOrDept]: newPerms };
          });
      }
  };

  // 4 standard departments matching assign tab
  const departments = PERMISSION_DEPARTMENTS.map(d => d.id);

  const loadHolidays = async () => {
      const data = await fetchHolidays();
      // Nếu data rỗng, hiển thị list mặc định nhưng chưa lưu
      if (!data || data.length === 0) {
          setHolidays(DEFAULT_HOLIDAYS);
      } else {
          setHolidays(data);
      }
  };

  const loadUpdateConfig = async () => {
      const info = await fetchUpdateInfo();
      if (info && info.version) setManualVersion(info.version);
      else setManualVersion(APP_VERSION); 
      if (info && info.url) setManualUrl(info.url);
      else setManualUrl('');
  };

  const handleConfirmDeleteData = async () => {
      if (await confirmAction("CẢNH BÁO: Bạn đang xóa TOÀN BỘ dữ liệu trên Cloud.\nHành động này KHÔNG THỂ khôi phục.\nBạn có chắc chắn muốn tiếp tục không?")) {
          if (await confirmAction("XÁC NHẬN LẦN CUỐI: Dữ liệu sẽ bị mất vĩnh viễn. Nhấn OK để Xóa ngay.")) {
              setIsDeletingData(true);
              await onDeleteAllData();
              setIsDeletingData(false);
          }
      }
  };

  const handleTestDatabase = async () => {
      setDbTestStatus('testing');
      setDbTestMsg('Đang kết nối...');
      const result = await testDatabaseConnection();
      setDbTestStatus(result.status === 'SUCCESS' ? 'success' : 'error');
      setDbTestMsg(result.message);
  };

  const handleSaveUpdateConfig = async () => {
      const ver = manualVersion.trim();
      const url = manualUrl.trim();
      if (!ver) {
          alert("Vui lòng nhập số phiên bản.");
          return;
      }
      setIsSavingUpdate(true);
      const success = await saveUpdateInfo(ver, url);
      setIsSavingUpdate(false);
      if (success) {
          // Bắn sự kiện qua BroadcastChannel cho các tab/cửa sổ khác
          if (typeof BroadcastChannel !== 'undefined') {
              try {
                  const bc = new BroadcastChannel('app_version_channel');
                  bc.postMessage({ type: 'VERSION_PUBLISHED', version: ver, url: url });
                  bc.close();
              } catch (e) {
                  console.error("BroadcastChannel error:", e);
              }
          }
          // Bắn sự kiện tức thì trên window ngay lập tức
          window.dispatchEvent(new CustomEvent('app_version_published', { detail: { version: ver, url: url } }));

          if (ver === APP_VERSION) {
              alert(`Lưu cấu hình thành công!\n\nLưu ý: Số phiên bản vừa nhập (${ver}) trùng với phiên bản hiện tại (${APP_VERSION}). Để hiển thị thông báo nâng cấp cho các máy trạm, vui lòng nhập số phiên bản mới hơn (ví dụ: 2.2.0).`);
          }
      } else {
          alert("Lỗi khi lưu cấu hình cập nhật. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.");
      }
  };

  // --- HOLIDAY HANDLERS ---
  const handleAddHoliday = () => {
      if (!tempName.trim()) { alert("Vui lòng nhập tên ngày lễ"); return; }
      if (tempDay < 1 || tempDay > 31 || tempMonth < 1 || tempMonth > 12) { alert("Ngày tháng không hợp lệ"); return; }

      const newId = Math.random().toString(36).substr(2, 9);
      const newHoliday: Holiday = {
          id: newId,
          name: tempName,
          day: tempDay,
          month: tempMonth,
          isLunar: tempIsLunar
      };

      setHolidays(prev => [...prev, newHoliday]);
      // Reset form
      setTempName('');
      setTempDay(1);
      setTempMonth(1);
      setTempIsLunar(false);
  };

  const handleDeleteHoliday = async (id: string) => {
      if(await confirmAction("Xóa ngày lễ này?")) {
          setHolidays(prev => prev.filter(h => h.id !== id));
      }
  };

  const handleSaveHolidays = async () => {
      setSavingHolidays(true);
      const success = await saveHolidays(holidays);
      setSavingHolidays(false);
      if (success) {
          alert('Đã lưu danh sách ngày lễ thành công!');
          // Trigger refresh data ở App cha
          if (onHolidaysChanged) onHolidaysChanged();
      }
      else alert('Lỗi khi lưu ngày lễ.');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full min-h-0 animate-fade-in-up">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-2 overflow-x-auto no-scrollbar shrink-0">
            <button 
                onClick={() => setActiveTab('general')}
                className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'general' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
                <Database size={16} /> Chung
            </button>
            <button 
                onClick={() => setActiveTab('holidays')}
                className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'holidays' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
                <Calendar size={16} /> Ngày nghỉ lễ
            </button>
            <button 
                onClick={() => setActiveTab('permissions')}
                className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'permissions' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
                <Key size={16} /> Phân quyền
            </button>
            <button 
                onClick={() => setActiveTab('data')}
                className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'data' ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
                <AlertTriangle size={16} /> Dữ liệu
            </button>
        </div>

        <div className={`flex-1 bg-slate-50/30 min-h-0 ${
            activeTab === 'permissions' ? 'p-2 md:p-3 overflow-hidden flex flex-col' : 'p-4 md:p-6 overflow-y-auto'
        }`}>
            {activeTab === 'general' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Cloud Database Info */}
                    <div className="bg-white border border-blue-100 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                        <div className="text-center md:text-left">
                            <h3 className="font-black text-blue-800 flex items-center justify-center md:justify-start gap-2 mb-1 tracking-tight"> <Database size={18} /> Cloud Database </h3>
                            <p className="text-xs text-blue-600 font-medium">Kiểm tra kết nối đến cơ sở dữ liệu Supabase.</p>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                            {onOpenCloudInspector && (
                                <button onClick={onOpenCloudInspector} className="w-full md:w-auto px-5 py-2.5 bg-purple-600 text-white font-bold text-xs rounded-xl hover:bg-purple-700 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer">
                                    <Database size={16} /> Kiểm tra 3 Bảng Cloud DB
                                </button>
                            )}
                            {dbTestStatus === 'success' && <div className="text-xs font-black text-green-600 flex items-center gap-1 uppercase tracking-wider"><CheckCircle size={16} /> Kết nối OK!</div>}
                            {dbTestStatus === 'error' && <div className="text-xs font-black text-red-600 uppercase tracking-wider">{dbTestMsg || 'Lỗi!'}</div>}
                            <button onClick={handleTestDatabase} disabled={dbTestStatus === 'testing'} className="w-full md:w-auto px-6 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-medium text-sm rounded-xl hover:bg-blue-100 transition-colors shadow-sm flex items-center justify-center gap-2"> 
                                {dbTestStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : 'Kiểm tra kết nối'} 
                            </button>
                        </div>
                    </div>

                    {/* Excel Periodic Auto-Backup Config */}
                    <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="font-black text-slate-800 flex items-center gap-2 tracking-tight text-base">
                                    <FileSpreadsheet size={20} className="text-emerald-600" />
                                    Sao lưu hồ sơ dự phòng ra Excel
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Hệ thống tự động sao lưu dữ liệu ra file Excel theo chu kỳ 5 ngày và tải về máy. Bạn cũng có thể chủ động bấm nút bên dưới bất kỳ lúc nào để xuất và tải ngay toàn bộ hồ sơ về thư mục <strong>Downloads (Tải về)</strong>.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Tự động theo chu kỳ 5 ngày
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-mono font-bold rounded-full border border-slate-200">
                                    Tên tệp: {EXCEL_BACKUP_FILENAME}
                                </span>
                            </div>
                        </div>

                        {/* Status & Manual Action */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <Clock size={14} className="text-slate-400" />
                                    <span>Lần sao lưu gần nhất:</span>
                                    <strong className="text-slate-800 font-bold">
                                        {lastExcelBackupTimestamp ? new Date(lastExcelBackupTimestamp).toLocaleString('vi-VN') : 'Chưa có lịch sử sao lưu'}
                                    </strong>
                                </div>
                                {lastExcelBackupTimestamp && (
                                    <div className="text-[11px] text-slate-500">
                                        Dự kiến sao lưu tiếp theo: <strong>{new Date(lastExcelBackupTimestamp + EXCEL_BACKUP_PERIOD_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN')}</strong>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={handleTriggerExcelBackupNow}
                                    disabled={isExecutingExcelBackup}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer disabled:opacity-60"
                                >
                                    {isExecutingExcelBackup ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            <span>Đang tạo & tải file...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={14} className="text-emerald-400" />
                                            <span>Sao lưu & Tải file Excel về máy</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {excelBackupFeedback && (
                            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                                excelBackupFeedback.type === 'success' 
                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                                    : 'bg-red-50 border border-red-200 text-red-800'
                            }`}>
                                {excelBackupFeedback.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-red-600 shrink-0" />}
                                <span>{excelBackupFeedback.message}</span>
                            </div>
                        )}
                    </div>

                    {/* Manual Update Config */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                        <h3 className="font-black text-gray-700 flex items-center gap-2 mb-6 tracking-tight">
                            <Cloud size={18} className="text-purple-500" /> Cập nhật phiên bản
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-2">Phiên bản Mới nhất</label>
                                <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-black text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="VD: 1.6.0" value={manualVersion || ''} onChange={(e) => setManualVersion(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500 mb-2">Link tải (Drive / Web)</label>
                                <div className="relative">
                                    <Globe size={16} className="absolute left-4 top-3.5 text-gray-400" />
                                    <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-11 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="https://..." value={manualUrl || ''} onChange={(e) => setManualUrl(e.target.value)} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end">
                            <button onClick={handleSaveUpdateConfig} disabled={isSavingUpdate} className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-800 text-white px-8 py-3 rounded-xl hover:bg-slate-900 text-sm font-medium shadow-lg transition-all active:scale-95">
                                {isSavingUpdate ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Phát hành phiên bản
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'holidays' && (
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div>
                                <h3 className="font-black text-orange-800 flex items-center gap-2 tracking-tight">
                                    <Calendar size={18} /> Cấu hình Ngày nghỉ lễ
                                </h3>
                                <p className="text-[11px] text-orange-600 mt-1 font-medium">
                                    Ngày nghỉ lễ sẽ không được tính vào thời gian hẹn trả kết quả.
                                </p>
                            </div>
                            <button 
                                onClick={handleSaveHolidays} 
                                disabled={savingHolidays}
                                className="w-full md:w-auto bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-700 flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all active:scale-95"
                            >
                                {savingHolidays ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu cấu hình
                            </button>
                        </div>

                        {/* Form thêm mới */}
                        <div className="flex flex-col gap-4 mb-8 bg-orange-50/50 p-5 rounded-2xl border border-orange-100">
                            <p className="text-sm font-medium text-orange-800 mb-1">Thêm ngày lễ mới</p>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                                <div className="sm:col-span-6">
                                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tên ngày lễ</label>
                                    <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="VD: Giỗ tổ" value={tempName || ''} onChange={e => setTempName(e.target.value)} />
                                 </div>
                                 <div className="sm:col-span-2">
                                     <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Ngày</label>
                                     <input type="number" min="1" max="31" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={tempDay ?? 1} onChange={e => setTempDay(parseInt(e.target.value) || 1)} />
                                 </div>
                                 <div className="sm:col-span-2">
                                     <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tháng</label>
                                     <input type="number" min="1" max="12" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all" value={tempMonth ?? 1} onChange={e => setTempMonth(parseInt(e.target.value) || 1)} />
                                 </div>
                                <div className="sm:col-span-2 flex items-end">
                                    <label className="flex items-center cursor-pointer select-none bg-white border border-gray-200 rounded-xl px-3 py-2.5 w-full justify-center hover:bg-gray-50 transition-colors">
                                        <input type="checkbox" className="mr-2 w-4 h-4 text-orange-600 rounded focus:ring-orange-500" checked={tempIsLunar} onChange={e => setTempIsLunar(e.target.checked)} />
                                        <span className="text-xs text-gray-700 font-black uppercase tracking-wider">Âm</span>
                                    </label>
                                </div>
                            </div>
                            <button onClick={handleAddHoliday} className="w-full bg-green-600 text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-2 shadow-md transition-all active:scale-95">
                                <Plus size={16} /> Thêm vào danh sách
                            </button>
                        </div>

                        {/* Danh sách - Desktop Table */}
                        <div className="hidden md:block border border-gray-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-orange-50 text-orange-800 text-sm font-medium uppercase">
                                    <tr>
                                        <th className="p-4">Tên ngày lễ</th>
                                        <th className="p-4 text-center">Ngày/Tháng</th>
                                        <th className="p-4 text-center">Loại lịch</th>
                                        <th className="p-4 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {holidays.map(h => (
                                        <tr key={h.id} className="hover:bg-orange-50/30 transition-colors">
                                            <td className="p-4 font-bold text-slate-700">{h.name}</td>
                                            <td className="p-4 text-center font-black text-slate-600">{h.day}/{h.month}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border ${h.isLunar ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                    {h.isLunar ? 'Âm lịch' : 'Dương lịch'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {holidays.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic font-medium">Chưa có dữ liệu ngày lễ</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Danh sách - Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {holidays.map(h => (
                                <div key={h.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h4 className="font-black text-slate-800 text-sm truncate tracking-tight">{h.name}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-black text-slate-500">{h.day}/{h.month}</span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${h.isLunar ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                {h.isLunar ? 'Âm' : 'Dương'}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-400 hover:text-red-600 p-3 rounded-xl hover:bg-red-50 transition-colors shrink-0">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                            {holidays.length === 0 && (
                                <div className="p-8 text-center text-gray-400 italic font-medium">Chưa có dữ liệu ngày lễ</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'permissions' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 relative">
                    {/* Header tabs (Row 1): Sticky Top */}
                    <div className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2 shadow-2xs">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setPermissionTab('role');
                                    setSelectedDepartmentScope('all');
                                    if (selectedRole === UserRole.ADMIN) setSelectedRole(UserRole.SUBADMIN);
                                }}
                                className={`px-4 py-2 text-xs font-black transition-all border-b-2 ${
                                    permissionTab === 'role'
                                        ? 'border-purple-600 text-purple-800 bg-white rounded-t-xl shadow-2xs'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Theo Vai trò
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPermissionTab('department');
                                    if (selectedDepartmentScope === 'all' || !allDepartmentOptions.includes(selectedDepartmentScope)) {
                                        setSelectedDepartmentScope(allDepartmentOptions[0] || 'Tổ Lưu trữ');
                                    }
                                    if (selectedRole === UserRole.ADMIN || selectedRole === UserRole.SUBADMIN || selectedRole === UserRole.ONEDOOR) {
                                        setSelectedRole(UserRole.TEAM_LEADER);
                                    }
                                }}
                                className={`px-4 py-2 text-xs font-black transition-all border-b-2 ${
                                    permissionTab === 'department'
                                        ? 'border-purple-600 text-purple-800 bg-white rounded-t-xl shadow-2xs'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Theo Phòng ban
                            </button>
                        </div>

                        {/* Search Filter Box & Save / Default Buttons */}
                        <div className="flex items-center gap-2 flex-wrap py-1">
                            <div className="relative w-44 sm:w-56">
                                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm quyền..."
                                    value={permSearchQuery}
                                    onChange={(e) => setPermSearchQuery(e.target.value)}
                                    className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-8 pr-7 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-2xs"
                                />
                                {permSearchQuery && (
                                    <button 
                                        type="button"
                                        onClick={() => setPermSearchQuery('')}
                                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleResetPermissions}
                                type="button"
                                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-all border border-slate-200 flex items-center gap-1.5 active:scale-95 shadow-2xs shrink-0"
                                title="Khôi phục mặc định ban đầu"
                            >
                                <RotateCcw size={14} /> Mặc định
                            </button>
                            <button
                                onClick={handleSavePermissions}
                                disabled={isSavingPermissions}
                                className="px-4 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5 active:scale-95 shrink-0"
                            >
                                {isSavingPermissions ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                Lưu
                            </button>
                        </div>
                    </div>

                    {/* Sub-navigation bar (Row 2): Sticky Top-[49px] */}
                    {permissionTab === 'role' ? (
                        <div className="sticky top-[49px] z-10 bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-6 overflow-x-auto no-scrollbar shrink-0 shadow-2xs">
                            {[
                                { role: UserRole.SUBADMIN, label: 'SUBADMIN' },
                                { role: UserRole.TEAM_LEADER, label: 'TEAM_LEADER' },
                                { role: UserRole.EMPLOYEE, label: 'EMPLOYEE' },
                                { role: UserRole.ONEDOOR, label: 'ONEDOOR' },
                            ].map((item) => {
                                const isSelected = selectedRole === item.role;
                                return (
                                    <button
                                        key={item.role}
                                        type="button"
                                        onClick={() => setSelectedRole(item.role)}
                                        className={`text-xs font-black tracking-wider uppercase transition-all pb-1 border-b-2 ${
                                            isSelected
                                                ? 'border-purple-600 text-purple-800 font-extrabold'
                                                : 'border-transparent text-slate-400 hover:text-slate-600 font-bold'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="sticky top-[49px] z-10 bg-white border-b border-slate-200 px-6 py-2 flex flex-col gap-1.5 shrink-0 shadow-2xs">
                            {/* Department selector */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 shrink-0 mr-1">
                                    PHÒNG / TỔ:
                                </span>
                                {allDepartmentOptions.map((deptName) => {
                                    const isSelected = selectedDepartmentScope === deptName;
                                    const compositeKey = `${deptName}_${selectedRole}`;
                                    const hasCustomOverride = !!(departmentPermissions && departmentPermissions[compositeKey]);
                                    return (
                                        <button
                                            key={deptName}
                                            type="button"
                                            onClick={() => setSelectedDepartmentScope(deptName)}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                                                isSelected
                                                    ? 'bg-purple-700 text-white border-purple-800 shadow-2xs font-black'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span>{deptName}</span>
                                            {hasCustomOverride && (
                                                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-300 animate-pulse' : 'bg-purple-500'}`} title="Đã có cấu hình riêng" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Role selector within Department */}
                            <div className="flex items-center gap-4 pt-1 border-t border-slate-100">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 shrink-0">
                                    VAI TRÒ TRONG TỔ:
                                </span>
                                {[
                                    { role: UserRole.TEAM_LEADER, label: 'TEAM_LEADER' },
                                    { role: UserRole.EMPLOYEE, label: 'EMPLOYEE' }
                                ].map((item) => {
                                    const isSelected = selectedRole === item.role;
                                    return (
                                        <button
                                            key={item.role}
                                            type="button"
                                            onClick={() => setSelectedRole(item.role)}
                                            className={`text-xs font-black tracking-wider uppercase transition-all pb-0.5 border-b-2 ${
                                                isSelected
                                                    ? 'border-purple-600 text-purple-800'
                                                    : 'border-transparent text-slate-400 hover:text-slate-600 font-bold'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Banner info */}
                    <div className="bg-purple-50/50 border-b border-purple-100/60 px-6 py-1.5 flex items-center justify-between text-xs text-purple-950 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold uppercase text-[10px] bg-purple-200/80 px-2 py-0.5 rounded text-purple-900">
                                {selectedRole}
                            </span>
                            <span className="text-slate-600 text-[11px]">
                                {permissionTab === 'role'
                                    ? `Đang thiết lập quyền mặc định cho Vai trò [${selectedRole}]`
                                    : `Đang thiết lập quyền riêng cho [${selectedDepartmentScope}] - [${selectedRole}]`
                                }
                            </span>
                        </div>
                    </div>

                    {/* Categorized Permissions Grid */}
                    <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6 bg-slate-50/60 custom-scrollbar space-y-6">
                        {PERMISSION_GROUPS.filter((group) => {
                            // Khi đang cấu hình phân quyền theo phòng ban cụ thể:
                            if (permissionTab === 'department' && selectedDepartmentScope !== 'all') {
                                const isDodacScope = matchDepartmentKey('đo đạc', selectedDepartmentScope);
                                const isLuutruScope = matchDepartmentKey('lưu trữ', selectedDepartmentScope);
                                
                                // Nếu là Tổ Đo đạc: Ẩn nhóm Tổ Lưu trữ
                                if (isDodacScope && group.id === 'group_luutru') return false;
                                // Nếu là Tổ Lưu trữ: Ẩn nhóm Tổ Đo đạc
                                if (isLuutruScope && group.id === 'group_dodac') return false;
                            }
                            return true;
                        }).map((group) => {
                            const filteredItems = group.items.filter(item => {
                                if (!permSearchQuery.trim()) return true;
                                const q = permSearchQuery.toLowerCase();
                                return (
                                    item.label.toLowerCase().includes(q) ||
                                    item.id.toLowerCase().includes(q)
                                );
                            });

                            if (filteredItems.length === 0) return null;

                            const activeCount = group.items.filter(item => isPermChecked(item.id)).length;
                            const totalCount = group.items.length;
                            const isDisabled = selectedRole === UserRole.ADMIN;

                            return (
                                <div key={group.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all">
                                    {/* Category Header */}
                                    <div className="bg-slate-100/70 border-b border-slate-200/80 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                                <span>{group.title}</span>
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                                    {activeCount}/{totalCount} Bật
                                                </span>
                                            </h4>
                                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                                {group.desc}
                                            </p>
                                        </div>

                                        {!isDisabled && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        group.items.forEach(item => {
                                                            if (!isPermChecked(item.id)) toggleDeptRolePerm(item.id);
                                                        });
                                                    }}
                                                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg border border-purple-200 transition-all"
                                                >
                                                    Chọn tất cả
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        group.items.forEach(item => {
                                                            if (isPermChecked(item.id)) toggleDeptRolePerm(item.id);
                                                        });
                                                    }}
                                                    className="text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 transition-all"
                                                >
                                                    Bỏ chọn
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Category Items Grid */}
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {filteredItems.map((perm) => {
                                            const checked = isPermChecked(perm.id);

                                            return (
                                                <label
                                                    key={perm.id}
                                                    className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                                        isDisabled
                                                            ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200'
                                                            : checked
                                                            ? 'bg-purple-50/80 border-purple-200 shadow-2xs hover:bg-purple-100/50'
                                                            : 'bg-white border-slate-200/90 hover:bg-slate-100/70 shadow-2xs'
                                                    }`}
                                                >
                                                    <div className="shrink-0 flex items-center justify-center">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer disabled:cursor-not-allowed"
                                                            checked={checked}
                                                            onChange={() => toggleDeptRolePerm(perm.id)}
                                                            disabled={isDisabled}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-xs md:text-sm font-bold tracking-tight ${checked ? 'text-purple-900' : 'text-slate-800'}`}>
                                                            {perm.label}
                                                        </div>
                                                        <div className={`text-[10px] font-mono tracking-wider uppercase mt-0.5 ${checked ? 'text-purple-600/80 font-semibold' : 'text-slate-400 font-medium'}`}>
                                                            {perm.id}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'data' && (
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Hộp vùng nguy hiểm */}
                    <div className="border border-red-100 rounded-[2rem] overflow-hidden bg-white shadow-xl shadow-red-50/50">
                        <div className="bg-red-50 p-5 border-b border-red-100">
                            <h3 className="text-red-700 font-black flex items-center gap-2 uppercase tracking-widest text-xs"> 
                                <AlertTriangle size={18} /> 
                                Vùng nguy hiểm
                            </h3>
                        </div>
                        <div className="p-8">
                            <div className="flex flex-col items-center text-center gap-6">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-2">
                                    <ShieldAlert size={32} />
                                </div>
                                <div> 
                                    <h4 className="font-black text-slate-800 text-lg tracking-tight mb-2"> Xóa sạch dữ liệu hệ thống </h4> 
                                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto"> 
                                        Hành động này sẽ xóa vĩnh viễn tất cả <strong>Hồ sơ</strong>, <strong>Hợp đồng</strong>, và <strong>Lịch sử hoạt động</strong> khỏi cơ sở dữ liệu. 
                                        <br/>
                                        <span className="text-red-600 font-black mt-2 block uppercase text-[10px] tracking-wider">Lưu ý: Không thể khôi phục dữ liệu sau khi xóa. Hãy tải tệp sao lưu trước khi thực hiện.</span>
                                    </p> 
                                </div>
                                <button onClick={handleConfirmDeleteData} disabled={isDeletingData} className="w-full md:w-auto px-10 py-3.5 bg-red-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"> 
                                    {isDeletingData ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                                    {isDeletingData ? 'Đang xóa...' : 'Xóa dữ liệu ngay'} 
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default SystemSettingsView;
