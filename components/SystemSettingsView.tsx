
import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, Cloud, Loader2, CheckCircle, Save, Globe, Calendar, Plus, Trash2, ShieldAlert, Key, FileSignature, FolderArchive, Upload, Download, RefreshCw, FolderOpen, LayoutDashboard, SlidersHorizontal, Eye, EyeOff, ArrowLeft, ArrowRight, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { Holiday, UserRole, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS, AVAILABLE_PERMISSIONS, Employee } from '../types';
import { fetchHolidays, saveHolidays, testDatabaseConnection, saveUpdateInfo, fetchUpdateInfo, getSystemSetting, saveSystemSetting } from '../services/api';
import { APP_VERSION } from '../constants';
import { confirmAction, calculateDeadlineHelper } from '../utils/appHelpers';
import { createFullBackupData, downloadBackupAsFile, saveBackupToServer, restoreFullBackupToSupabase } from '../services/backupService';
import { isConfigured } from '../services/supabaseClient';
import { fetchRecords, updateRecordsBatchById } from '../services/apiRecords';
import { auditRecordsDates, normalizeRecordsDatesApi, AuditReport, DateAuditIssue } from '../services/apiAudit';

const PERMISSION_DEPARTMENTS = [
  { id: 'Tổ Đăng ký cấp giấy', name: 'Tổ Cấp giấy', label: 'Tổ Đăng ký cấp giấy (Tổ Cấp giấy)', desc: 'Bộ phận tiếp nhận đăng ký, xử lý biến động và cấp giấy chứng nhận' },
  { id: 'Tổ Thông tin lưu trữ', name: 'Tổ Lưu trữ', label: 'Tổ Thông tin lưu trữ (Tổ Lưu trữ)', desc: 'Bộ phận phụ trách lưu trữ, khai thác thông tin đất đai và hồ sơ lưu trữ' },
  { id: 'Tổ Đo đạc', name: 'Tổ Đo đạc', label: 'Tổ Đo đạc', desc: 'Bộ phận thực hiện đo đạc bản đồ, đo vẽ trích lục và trích đo thửa đất' },
  { id: 'Tổ Hành chính', name: 'Tổ Hành chính', label: 'Tổ Hành chính (Một cửa)', desc: 'Bộ phận hành chính tổng hợp, văn thư, tiếp nhận Một cửa' }
];

interface SystemSettingsViewProps {
  onDeleteAllData: () => Promise<boolean>;
  onHolidaysChanged?: () => void;
  employees: Employee[];
}

const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ 
  onDeleteAllData,
  onHolidaysChanged,
  employees
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'holidays' | 'permissions' | 'data' | 'audit'>('general');
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [dbTestStatus, setDbTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dbTestMsg, setDbTestMsg] = useState('');
  
  // Audit States
  const [records, setRecords] = useState<any[]>([]);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [selectedIssueTypeFilter, setSelectedIssueTypeFilter] = useState<string>('all');
  
  // Trạng thái lưu trữ các giá trị đang chỉnh sửa tạm thời trong danh sách sửa nhanh
  const [editingDates, setEditingDates] = useState<Record<string, { receivedDate: string, deadline: string }>>({});
  // Trạng thái đang lưu cho từng hồ sơ cụ thể
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  // Trạng thái xử lý hàng loạt
  const [isBatchFixing, setIsBatchFixing] = useState(false);

  const loadAndAuditData = async () => {
      try {
          setIsAuditing(true);
          const data = await fetchRecords();
          setRecords(data);
          
          let activeHolidays = holidays;
          if (!activeHolidays || activeHolidays.length === 0) {
              const hData = await fetchHolidays();
              setHolidays(hData);
              activeHolidays = hData;
          }
          
          const report = auditRecordsDates(data, activeHolidays);
          setAuditReport(report);
          
          // Khởi tạo/cập nhật editingDates cho các hồ sơ có vấn đề
          const initialEditing: Record<string, { receivedDate: string, deadline: string }> = {};
          report.issues.forEach(issue => {
              if (issue.record && !initialEditing[issue.recordId]) {
                  initialEditing[issue.recordId] = {
                      receivedDate: issue.record.receivedDate || '',
                      deadline: issue.record.deadline || ''
                  };
              }
          });
          setEditingDates(prev => ({ ...initialEditing, ...prev }));
      } catch (err) {
          console.error("Error running audit:", err);
      } finally {
          setIsAuditing(false);
      }
  };

  const handleSaveSingleRecordDates = async (recordId: string) => {
      const editVal = editingDates[recordId];
      if (!editVal) return;
      
      try {
          setSavingRecordId(recordId);
          const res = await updateRecordsBatchById([{
              id: recordId,
              receivedDate: editVal.receivedDate || null,
              deadline: editVal.deadline || null
          }]);
          
          if (res.success) {
              await loadAndAuditData();
          } else {
              alert("Không thể cập nhật ngày tháng cho hồ sơ này.");
          }
      } catch (error: any) {
          alert("Lỗi: " + error.message);
      } finally {
          setSavingRecordId(null);
      }
  };

  const handleBatchFixMismatchedDeadlines = async () => {
      if (!auditReport || auditReport.issues.length === 0) return;
      
      const mismatchIssues = auditReport.issues.filter(i => 
          (i.issueType === 'mismatched_deadline' || (i.issueType === 'missing' && i.field === 'deadline')) && 
          i.record && i.record.receivedDate
      );
      
      if (mismatchIssues.length === 0) {
          alert("Không tìm thấy hồ sơ nào có hạn giải quyết lệch chuẩn hoặc thiếu hạn giải quyết để tự động sửa.");
          return;
      }
      
      const confirmRun = await confirmAction(
          `Hệ thống phát hiện ${mismatchIssues.length} hồ sơ có hạn giải quyết chưa chuẩn xác hoặc đang bị thiếu.\n\nBạn có muốn tự động tính toán lại hạn giải quyết chuẩn và cập nhật hàng loạt cho tất cả ${mismatchIssues.length} hồ sơ này không?`
      );
      if (!confirmRun) return;
      
      try {
          setIsBatchFixing(true);
          const updates = mismatchIssues.map(issue => {
              const rec = issue.record!;
              const suggested = calculateDeadlineHelper(rec.recordType || '', rec.receivedDate || '', holidays);
              return {
                  id: rec.id,
                  deadline: suggested
              };
          });
          
          const res = await updateRecordsBatchById(updates);
          if (res.success) {
              alert(`Tự động sửa hàng loạt thành công!\nĐã cập nhật hạn giải quyết chuẩn cho ${res.count} hồ sơ.`);
              await loadAndAuditData();
          } else {
              alert("Có lỗi xảy ra trong quá trình cập nhật hàng loạt.");
          }
      } catch (error: any) {
          alert("Lỗi: " + error.message);
      } finally {
          setIsBatchFixing(false);
      }
  };

  const handleRunNormalization = async () => {
      const confirmRun = await confirmAction(
          "Bạn có chắc chắn muốn chuẩn hóa tất cả các trường ngày tháng (Ngày nhận và Hạn giải quyết) hiện có về định dạng chuẩn ISO YYYY-MM-DD không?\n\nHệ thống sẽ loại bỏ mọi thông tin giờ/phút/giây thừa và đưa dữ liệu về dạng chuẩn duy nhất."
      );
      if (!confirmRun) return;

      try {
          setIsNormalizing(true);
          const result = await normalizeRecordsDatesApi(records);
          if (result.success) {
              alert(`Chuẩn hóa dữ liệu ngày tháng thành công!\nĐã cập nhật ${result.count} hồ sơ.`);
              await loadAndAuditData();
          } else {
              alert("Gặp lỗi trong quá trình chuẩn hóa dữ liệu ngày tháng.");
          }
      } catch (err: any) {
          alert("Lỗi: " + err.message);
      } finally {
          setIsNormalizing(false);
      }
  };

  useEffect(() => {
      if (activeTab === 'audit') {
          loadAndAuditData();
      }
  }, [activeTab]);
  
  // Update State (Manual Config)
  const [manualVersion, setManualVersion] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [isSavingUpdate, setIsSavingUpdate] = useState(false);

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
  const [selectedRole, setSelectedRole] = useState<UserRole | string>(UserRole.SUBADMIN);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionTab, setPermissionTab] = useState<'role' | 'department'>('role');

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
  }, []);

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
              setRolePermissions(JSON.parse(savedPerms));
          } catch (e) {
              console.error("Failed to parse role_permissions", e);
          }
      }
      const savedDeptPerms = await getSystemSetting('department_permissions');
      if (savedDeptPerms) {
          try {
              setDepartmentPermissions(JSON.parse(savedDeptPerms));
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
          alert('Đã lưu cấu hình phân quyền thành công! Cần tải lại trang để áp dụng.');
      } else {
          alert('Lỗi khi lưu cấu hình phân quyền.');
      }
  };

  const togglePermission = (roleOrDept: string, permissionId: string, isRole: boolean) => {
      if (isRole && roleOrDept === UserRole.ADMIN) return; // Cannot edit ADMIN permissions
      
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
      if (data.length === 0) {
          setHolidays([
              { id: '1', name: 'Tết Dương Lịch', day: 1, month: 1, isLunar: false },
              { id: '2', name: 'Giỗ Tổ Hùng Vương', day: 10, month: 3, isLunar: true },
              { id: '3', name: 'Giải phóng Miền Nam', day: 30, month: 4, isLunar: false },
              { id: '4', name: 'Quốc tế Lao động', day: 1, month: 5, isLunar: false },
              { id: '5', name: 'Quốc Khánh', day: 2, month: 9, isLunar: false },
              { id: '6', name: 'Tết Nguyên Đán (Mùng 1)', day: 1, month: 1, isLunar: true },
              { id: '7', name: 'Tết Nguyên Đán (Mùng 2)', day: 2, month: 1, isLunar: true },
              { id: '8', name: 'Tết Nguyên Đán (Mùng 3)', day: 3, month: 1, isLunar: true },
          ]);
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
      if (!manualVersion.trim()) {
          alert("Vui lòng nhập số phiên bản.");
          return;
      }
      setIsSavingUpdate(true);
      const success = await saveUpdateInfo(manualVersion.trim(), manualUrl.trim());
      setIsSavingUpdate(false);
      if (success) {
          alert(`Đã phát hành phiên bản ${manualVersion}!\nTất cả người dùng sẽ nhận được thông báo cập nhật sau vài giây.`);
      } else {
          alert("Lỗi khi lưu cấu hình cập nhật. Vui lòng thử lại.");
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 shrink-0">
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 tracking-tight">
                <ShieldAlert className="text-red-600" size={20} />
                Cấu hình Hệ thống (Admin)
            </h2>
        </div>

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
            <button 
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'audit' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
                <FileSignature size={16} /> Kiểm tra ngày tháng
            </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-50/30">
            {activeTab === 'general' && (
                <div className="space-y-6 max-w-4xl mx-auto">
                    {/* Cloud Database Info */}
                    <div className="bg-white border border-blue-100 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                        <div className="text-center md:text-left">
                            <h3 className="font-black text-blue-800 flex items-center justify-center md:justify-start gap-2 mb-1 tracking-tight"> <Database size={18} /> Cloud Database </h3>
                            <p className="text-xs text-blue-600 font-medium">Kiểm tra kết nối đến cơ sở dữ liệu Supabase.</p>
                        </div>
                        <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                            {dbTestStatus === 'success' && <div className="text-xs font-black text-green-600 flex items-center gap-1 uppercase tracking-wider"><CheckCircle size={16} /> Kết nối OK!</div>}
                            {dbTestStatus === 'error' && <div className="text-xs font-black text-red-600 uppercase tracking-wider">{dbTestMsg || 'Lỗi!'}</div>}
                            <button onClick={handleTestDatabase} disabled={dbTestStatus === 'testing'} className="w-full md:w-auto px-6 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-medium text-sm rounded-xl hover:bg-blue-100 transition-colors shadow-sm flex items-center justify-center gap-2"> 
                                {dbTestStatus === 'testing' ? <Loader2 className="animate-spin" size={16} /> : 'Kiểm tra kết nối'} 
                            </button>
                        </div>
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
                <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="bg-white border border-purple-100 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
                        <div className="text-center md:text-left">
                            <h3 className="font-black text-purple-800 flex items-center justify-center md:justify-start gap-2 mb-1 tracking-tight"> <Key size={18} /> Phân quyền hệ thống </h3>
                            <p className="text-xs text-purple-600 font-medium">Cấu hình quyền truy cập cho từng nhóm người dùng.</p>
                        </div>
                        <button 
                            onClick={handleSavePermissions}
                            disabled={isSavingPermissions}
                            className="w-full md:w-auto px-6 py-2.5 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-purple-700 transition-all shadow-md shadow-purple-100 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                        >
                            {isSavingPermissions ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            Lưu phân quyền
                        </button>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex border-b border-gray-200 bg-gray-100 px-2">
                            <button
                                onClick={() => { setPermissionTab('role'); setSelectedRole(UserRole.SUBADMIN); }}
                                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${permissionTab === 'role' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Theo Vai trò
                            </button>
                            <button
                                onClick={() => { setPermissionTab('department'); setSelectedRole(departments[0] || ''); }}
                                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${permissionTab === 'department' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                Theo Phòng ban
                            </button>
                        </div>
                        {permissionTab === 'role' ? (
                            <div className="flex border-b border-gray-200 bg-gray-50 px-2 overflow-x-auto no-scrollbar">
                                {Object.values(UserRole).filter(r => r !== UserRole.ADMIN).map(role => (
                                    <button
                                        key={role}
                                        onClick={() => setSelectedRole(role)}
                                        className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${selectedRole === role ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 bg-purple-50/50 border-b border-gray-200">
                                <div className="text-xs text-purple-800 font-bold uppercase tracking-wider mb-3 px-1">
                                    Chọn Phòng ban / Tổ chuyên môn để phân quyền:
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    {PERMISSION_DEPARTMENTS.map(dept => {
                                        const isSelected = selectedRole === dept.id;
                                        return (
                                            <button
                                                key={dept.id}
                                                type="button"
                                                onClick={() => setSelectedRole(dept.id)}
                                                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? 'bg-white border-purple-500 shadow-md ring-2 ring-purple-100' 
                                                        : 'bg-white/60 border-gray-200 hover:bg-white hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-purple-600 animate-pulse' : 'bg-gray-300'}`} />
                                                    <span className={`text-xs md:text-sm font-bold ${isSelected ? 'text-purple-700 font-black' : 'text-gray-700'}`}>
                                                        {dept.name}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-gray-500 mt-1 font-semibold leading-tight line-clamp-1" title={dept.id}>
                                                    {dept.id}
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-2 leading-relaxed font-medium line-clamp-2">
                                                    {dept.desc}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {AVAILABLE_PERMISSIONS.map(perm => {
                                    const hasPerm = permissionTab === 'role' 
                                        ? (rolePermissions[selectedRole]?.includes(perm.id) || rolePermissions[selectedRole]?.includes('*'))
                                        : (departmentPermissions[selectedRole]?.includes(perm.id) || departmentPermissions[selectedRole]?.includes('*'));
                                    return (
                                        <label key={perm.id} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${hasPerm ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                                            <div className="mt-0.5">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                    checked={hasPerm}
                                                    onChange={() => togglePermission(selectedRole, perm.id, permissionTab === 'role')}
                                                    disabled={permissionTab === 'role' && selectedRole === UserRole.ADMIN}
                                                />
                                            </div>
                                            <div>
                                                <div className={`text-sm font-bold ${hasPerm ? 'text-purple-900' : 'text-gray-700'}`}>{perm.label}</div>
                                                <div className="text-xs text-gray-500 mt-0.5 font-mono">{perm.id}</div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
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

            {activeTab === 'audit' && (
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header Action Card */}
                    <div className="bg-white border border-teal-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in-up">
                        <div className="space-y-1">
                            <h3 className="font-black text-teal-800 text-lg flex items-center gap-2 tracking-tight">
                                <FileSignature size={22} className="text-teal-600" />
                                Kiểm tra & Chuẩn hóa Dữ liệu Ngày tháng
                            </h3>
                            <p className="text-xs text-teal-600 font-medium">
                                Thực hiện kiểm tra tính toàn vẹn và chạy một lần để chuẩn hóa tất cả các giá trị về định dạng ISO YYYY-MM-DD, loại bỏ giờ/phút/giây thừa.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={loadAndAuditData}
                                disabled={isAuditing || isNormalizing}
                                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
                            >
                                <RefreshCw size={14} className={isAuditing ? 'animate-spin' : ''} />
                                {isAuditing ? 'Đang kiểm tra...' : 'Chạy lại kiểm tra'}
                            </button>
                            <button
                                onClick={handleRunNormalization}
                                disabled={isAuditing || isNormalizing || !auditReport || auditReport.issues.filter((i: any) => i.issueType === 'has_time' || i.issueType === 'invalid_format').length === 0}
                                className="px-5 py-2.5 bg-teal-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-teal-700 flex items-center justify-center gap-2 shadow-md shadow-teal-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                title="Chạy hàm chuẩn hóa một lần trên toàn bộ các giá trị ngày tháng có giờ/phút/giây thừa hoặc sai định dạng."
                            >
                                {isNormalizing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {isNormalizing ? 'Đang chuẩn hóa...' : 'Chạy chuẩn hóa ngay'}
                            </button>
                        </div>
                    </div>

                    {isAuditing && !auditReport ? (
                        <div className="bg-white border border-gray-100 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                            <Loader2 className="animate-spin text-teal-600 mb-4" size={40} />
                            <h4 className="font-bold text-gray-700 text-sm">Đang tải và kiểm tra toàn bộ cơ sở dữ liệu...</h4>
                            <p className="text-xs text-gray-400 mt-1">Hệ thống đang quét các trường receivedDate và deadline của các hồ sơ.</p>
                        </div>
                    ) : auditReport ? (
                        <>
                            {/* Dashboard Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Scanned */}
                                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tổng hồ sơ quét</div>
                                    <div className="text-3xl font-black text-slate-800 tracking-tight">{auditReport.totalRecords}</div>
                                    <div className="text-[11px] text-gray-400 mt-2 font-medium">Toàn bộ hồ sơ trong hệ thống</div>
                                </div>
                                {/* Issues */}
                                <div className={`bg-white border rounded-2xl p-5 shadow-sm ${auditReport.issueRecordsCount > 0 ? 'border-red-100' : 'border-green-100'}`}>
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hồ sơ có vấn đề</div>
                                    <div className={`text-3xl font-black tracking-tight ${auditReport.issueRecordsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {auditReport.issueRecordsCount}
                                    </div>
                                    <div className="text-[11px] text-gray-400 mt-2 font-medium">Cần chuẩn hóa hoặc chỉnh sửa thủ công</div>
                                </div>
                                {/* Cleanliness Rate */}
                                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tỷ lệ dữ liệu sạch</div>
                                    <div className="text-3xl font-black text-teal-600 tracking-tight">
                                        {auditReport.totalRecords > 0 
                                            ? `${((auditReport.cleanRecordsCount / auditReport.totalRecords) * 100).toFixed(1)}%`
                                            : '100%'}
                                    </div>
                                    <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                        <div 
                                            className="bg-teal-500 h-full rounded-full transition-all duration-500" 
                                            style={{ width: `${auditReport.totalRecords > 0 ? (auditReport.cleanRecordsCount / auditReport.totalRecords) * 100 : 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Statistics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Received Date Metrics */}
                                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                                    <h4 className="font-black text-slate-700 text-sm border-b border-gray-100 pb-3 flex items-center justify-between">
                                        <span>Ngày tiếp nhận (receivedDate)</span>
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">Thống kê</span>
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium">Bị thiếu hoặc rỗng:</span>
                                            <span className={`font-black ${auditReport.receivedDateMissing > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                                                {auditReport.receivedDateMissing} hồ sơ
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium">Có chứa giờ/phút/giây thừa (Cần dọn dẹp):</span>
                                            <span className={`font-black ${auditReport.receivedDateHasTime > 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                                                {auditReport.receivedDateHasTime} hồ sơ
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium">Sai định dạng hoặc lỗi phân tích:</span>
                                            <span className={`font-black ${auditReport.receivedDateInvalid > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                                {auditReport.receivedDateInvalid} hồ sơ
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Deadline Metrics */}
                                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                                    <h4 className="font-black text-slate-700 text-sm border-b border-gray-100 pb-3 flex items-center justify-between">
                                        <span>Hạn giải quyết (deadline)</span>
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">Thống kê</span>
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium">Bị thiếu hoặc rỗng:</span>
                                            <span className="font-black text-slate-700">
                                                {auditReport.deadlineMissing} hồ sơ
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium">Có chứa giờ/phút/giây thừa (Cần dọn dẹp):</span>
                                            <span className={`font-black ${auditReport.deadlineHasTime > 0 ? 'text-indigo-600' : 'text-slate-700'}`}>
                                                {auditReport.deadlineHasTime} hồ sơ
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500 font-medium">Sai định dạng hoặc lỗi phân tích:</span>
                                            <span className={`font-black ${auditReport.deadlineInvalid > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                                {auditReport.deadlineInvalid} hồ sơ
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs border-t border-dashed border-gray-100 pt-2">
                                            <span className="text-gray-500 font-medium flex items-center gap-1">
                                                <AlertTriangle size={12} className="text-amber-500" />
                                                Hạn giải quyết trước ngày nhận:
                                            </span>
                                            <span className={`font-black ${auditReport.logicalErrors > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                                {auditReport.logicalErrors} lỗi logic
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs border-t border-dashed border-gray-100 pt-2">
                                            <span className="text-gray-500 font-medium flex items-center gap-1">
                                                <Calendar size={12} className="text-teal-500" />
                                                Hạn lệch so với quy quy chuẩn (thủ tục):
                                            </span>
                                            <span className={`font-black ${auditReport.mismatchedDeadlines > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                                                {auditReport.mismatchedDeadlines} hồ sơ
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Chức năng Phân tích & Sửa nhanh ngày trả lệch chuẩn */}
                            <div className="bg-white border border-teal-100 rounded-2xl p-6 shadow-sm space-y-4">
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-4">
                                    <div>
                                        <h4 className="font-black text-slate-800 text-base flex items-center gap-2">
                                            <SlidersHorizontal size={18} className="text-teal-600" />
                                            Công cụ Phân tích & Sửa nhanh Ngày tháng / Hạn giải quyết
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Phân tích hồ sơ sai lệch so với thời gian xử lý quy định của từng thủ tục và hỗ trợ sửa nhanh hoặc áp dụng tự động hàng loạt.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleBatchFixMismatchedDeadlines}
                                        disabled={isBatchFixing}
                                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-colors shrink-0"
                                    >
                                        {isBatchFixing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        Tự động sửa toàn bộ ngày hẹn lệch chuẩn
                                    </button>
                                </div>

                                {/* Danh sách hồ sơ lệch chuẩn để sửa nhanh */}
                                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                                    {auditReport.issues.filter(i => 
                                        i.issueType === 'mismatched_deadline' || 
                                        (i.issueType === 'missing' && i.field === 'deadline') ||
                                        i.issueType === 'logical_error'
                                    ).length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 italic text-xs font-semibold">
                                            🎉 Tuyệt vời! Không phát hiện hồ sơ nào bị lệch hạn giải quyết hoặc sai logic thời gian.
                                        </div>
                                    ) : (
                                        auditReport.issues
                                            .filter(i => 
                                                i.issueType === 'mismatched_deadline' || 
                                                (i.issueType === 'missing' && i.field === 'deadline') ||
                                                i.issueType === 'logical_error'
                                            )
                                            .map((issue, idx) => {
                                                const rec = issue.record;
                                                if (!rec) return null;
                                                
                                                const currentEdit = editingDates[issue.recordId] || {
                                                    receivedDate: rec.receivedDate || '',
                                                    deadline: rec.deadline || ''
                                                };
                                                
                                                const suggested = calculateDeadlineHelper(rec.recordType || '', currentEdit.receivedDate, holidays);
                                                const isMismatch = currentEdit.deadline !== suggested;

                                                return (
                                                    <div 
                                                        key={`quick-fix-${issue.recordId}-${idx}`} 
                                                        className="border border-slate-100 bg-slate-50/40 rounded-xl p-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 hover:border-teal-200 transition-colors"
                                                    >
                                                         {/* Thông tin hồ sơ */}
                                                         <div className="space-y-1.5 flex-1 min-w-0">
                                                             <div className="flex flex-wrap items-center gap-2">
                                                                 <span className="font-mono font-black text-slate-800 text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                                                                     {rec.code || 'KHÔNG MÃ'}
                                                                 </span>
                                                                 <span className="font-bold text-slate-700 text-xs truncate">
                                                                     {rec.customerName || 'Chưa rõ tên'}
                                                                 </span>
                                                                 <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                                                     {rec.ward || 'Chưa rõ xã'}
                                                                 </span>
                                                             </div>
                                                             <p className="text-[11px] text-gray-500 font-medium">
                                                                 <span className="font-bold text-teal-700">Thủ tục:</span> {rec.recordType || 'Chưa phân loại'}
                                                             </p>
                                                             <p className="text-[11px] text-amber-600 font-bold flex items-center gap-1 leading-relaxed">
                                                                 <AlertTriangle size={12} className="shrink-0" />
                                                                 {issue.description}
                                                             </p>
                                                         </div>

                                                         {/* Các ô nhập ngày tháng chỉnh sửa nhanh */}
                                                         <div className="flex flex-wrap items-center gap-3 shrink-0">
                                                             {/* Ngày nhận */}
                                                             <div className="flex flex-col gap-1">
                                                                 <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ngày nhận</label>
                                                                 <input 
                                                                     type="date" 
                                                                     value={currentEdit.receivedDate}
                                                                     onChange={(e) => setEditingDates(prev => ({
                                                                         ...prev,
                                                                         [issue.recordId]: {
                                                                             receivedDate: e.target.value,
                                                                             deadline: prev[issue.recordId]?.deadline || ''
                                                                         }
                                                                     }))}
                                                                     className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-teal-500 outline-none bg-white"
                                                                 />
                                                             </div>

                                                             {/* Hạn giải quyết */}
                                                             <div className="flex flex-col gap-1">
                                                                 <div className="flex justify-between items-center">
                                                                     <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Hạn giải quyết</label>
                                                                     {suggested && isMismatch && (
                                                                         <button 
                                                                             onClick={() => setEditingDates(prev => ({
                                                                                 ...prev,
                                                                                 [issue.recordId]: {
                                                                                     receivedDate: prev[issue.recordId]?.receivedDate || '',
                                                                                     deadline: suggested
                                                                                 }
                                                                             }))}
                                                                             className="text-[10px] text-teal-600 hover:text-teal-800 font-extrabold flex items-center gap-0.5 ml-2 hover:underline"
                                                                             title="Áp dụng hạn đề xuất theo quy định"
                                                                         >
                                                                             Áp dụng đề xuất
                                                                         </button>
                                                                     )}
                                                                 </div>
                                                                 <div className="relative">
                                                                     <input 
                                                                         type="date" 
                                                                         value={currentEdit.deadline}
                                                                         onChange={(e) => setEditingDates(prev => ({
                                                                             ...prev,
                                                                             [issue.recordId]: {
                                                                                 receivedDate: prev[issue.recordId]?.receivedDate || '',
                                                                                 deadline: e.target.value
                                                                             }
                                                                         }))}
                                                                         className={`border rounded-lg px-2 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-teal-500 outline-none bg-white ${
                                                                             isMismatch ? 'border-amber-300 bg-amber-50/10 text-amber-700' : 'border-gray-200'
                                                                        }`}
                                                                     />
                                                                 </div>
                                                             </div>

                                                             {/* Hạn đề xuất nhãn */}
                                                             {suggested && (
                                                                 <div className="flex flex-col gap-1 justify-center">
                                                                     <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Đề xuất</span>
                                                                     <span className="px-2 py-1.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-lg text-xs font-bold font-mono">
                                                                         {suggested}
                                                                     </span>
                                                                 </div>
                                                             )}

                                                             {/* Hành động Cập nhật */}
                                                             <div className="flex items-end h-[46px]">
                                                                 <button
                                                                     onClick={() => handleSaveSingleRecordDates(issue.recordId)}
                                                                     disabled={savingRecordId === issue.recordId}
                                                                     className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 h-[32px] self-end"
                                                                 >
                                                                     {savingRecordId === issue.recordId ? (
                                                                         <Loader2 size={12} className="animate-spin" />
                                                                     ) : (
                                                                         <Save size={12} />
                                                                     )}
                                                                     Lưu
                                                                 </button>
                                                             </div>
                                                         </div>
                                                     </div>
                                                 );
                                             })
                                     )}
                                 </div>
                             </div>

                             {/* Detailed Issues Table Card */}
                            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h4 className="font-black text-slate-800 text-sm">Danh sách các phát hiện bất thường</h4>
                                        <p className="text-xs text-gray-400 mt-1">Hiển thị {
                                            auditReport.issues.filter((issue: DateAuditIssue) => {
                                                if (selectedIssueTypeFilter !== 'all' && issue.issueType !== selectedIssueTypeFilter) return false;
                                                if (auditSearchQuery.trim() !== '') {
                                                    const q = auditSearchQuery.toLowerCase();
                                                    return (
                                                        issue.recordCode.toLowerCase().includes(q) ||
                                                        issue.customerName.toLowerCase().includes(q) ||
                                                        issue.description.toLowerCase().includes(q)
                                                    );
                                                }
                                                return true;
                                            }).length
                                        } kết quả phù hợp với bộ lọc hiện tại.</p>
                                    </div>
                                    
                                    {/* Filters Row */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                                        {/* Search Box */}
                                        <div className="relative w-full sm:w-64">
                                            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                                            <input 
                                                type="text" 
                                                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                                                placeholder="Tìm mã hồ sơ, tên chủ..."
                                                value={auditSearchQuery}
                                                onChange={e => setAuditSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        {/* Issue Type Select */}
                                        <select
                                            className="border border-gray-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-teal-500 outline-none bg-white font-bold text-gray-600"
                                            value={selectedIssueTypeFilter}
                                            onChange={e => setSelectedIssueTypeFilter(e.target.value)}
                                        >
                                            <option value="all">Tất cả loại vấn đề</option>
                                            <option value="missing">Thiếu thông tin</option>
                                            <option value="has_time">Chứa giờ/phút/giây</option>
                                            <option value="invalid_format">Định dạng không hợp lệ</option>
                                            <option value="logical_error">Lỗi logic (Hạn trước nhận)</option>
                                            <option value="mismatched_deadline">Hạn giải quyết lệch chuẩn</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs divide-y divide-gray-100">
                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                            <tr>
                                                <th className="p-4">Mã hồ sơ</th>
                                                <th className="p-4">Tên khách hàng</th>
                                                <th className="p-4 text-center">Trường lỗi</th>
                                                <th className="p-4">Giá trị thô</th>
                                                <th className="p-4 text-center">Phân loại</th>
                                                <th className="p-4">Mô tả chi tiết</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {auditReport.issues
                                                .filter((issue: DateAuditIssue) => {
                                                    if (selectedIssueTypeFilter !== 'all' && issue.issueType !== selectedIssueTypeFilter) return false;
                                                    if (auditSearchQuery.trim() !== '') {
                                                        const q = auditSearchQuery.toLowerCase();
                                                        return (
                                                            issue.recordCode.toLowerCase().includes(q) ||
                                                            issue.customerName.toLowerCase().includes(q) ||
                                                            issue.description.toLowerCase().includes(q)
                                                        );
                                                    }
                                                    return true;
                                                })
                                                .map((issue: DateAuditIssue, idx: number) => (
                                                    <tr key={`${issue.recordId}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-4 font-mono font-bold text-slate-800">{issue.recordCode}</td>
                                                        <td className="p-4 font-semibold text-slate-700">{issue.customerName}</td>
                                                        <td className="p-4 text-center">
                                                            <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                                                                {issue.field}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-slate-500 font-mono">{issue.originalValue || <span className="italic text-gray-300">Rỗng (null)</span>}</td>
                                                        <td className="p-4 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                                issue.issueType === 'missing' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                issue.issueType === 'has_time' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                                issue.issueType === 'invalid_format' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                issue.issueType === 'logical_error' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                                'bg-amber-100 text-amber-800 border-amber-300'
                                                            }`}>
                                                                {issue.issueType === 'missing' ? 'Thiếu dữ liệu' :
                                                                 issue.issueType === 'has_time' ? 'Chứa giờ' :
                                                                 issue.issueType === 'invalid_format' ? 'Sai định dạng' :
                                                                 issue.issueType === 'logical_error' ? 'Lỗi logic' :
                                                                 'Lệnh hạn chuẩn'}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-slate-600 font-medium">{issue.description}</td>
                                                    </tr>
                                                ))}
                                            {auditReport.issues.filter((issue: DateAuditIssue) => {
                                                if (selectedIssueTypeFilter !== 'all' && issue.issueType !== selectedIssueTypeFilter) return false;
                                                if (auditSearchQuery.trim() !== '') {
                                                    const q = auditSearchQuery.toLowerCase();
                                                    return (
                                                        issue.recordCode.toLowerCase().includes(q) ||
                                                        issue.customerName.toLowerCase().includes(q) ||
                                                        issue.description.toLowerCase().includes(q)
                                                    );
                                                }
                                                return true;
                                            }).length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-gray-400 italic font-semibold">
                                                        Không tìm thấy bất kỳ hồ sơ lỗi nào trùng khớp với bộ lọc.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                            <p className="text-sm font-semibold text-gray-400">Không có báo cáo kiểm tra được tải.</p>
                            <button onClick={loadAndAuditData} className="mt-3 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">
                                Quét toàn bộ hệ thống
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default SystemSettingsView;
