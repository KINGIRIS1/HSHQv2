
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message } from './types';
import { DEFAULT_WARDS as STATIC_WARDS, isArchiveRecordType } from './constants';
import Login from './components/Login'; 
import MainLayout from './components/layout/MainLayout';
import AppRoutes from './components/AppRoutes';
import AppModals from './components/AppModals';

import { DEFAULT_VISIBLE_COLUMNS, confirmAction, COLUMN_DEFS } from './utils/appHelpers';
import { exportReportToExcel, exportReturnedListToExcel } from './utils/excelExport';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; 
import { updateRecordApi, saveEmployeeApi, saveUserApi, forceUpdateRecordsBatchApi, updateRecordsBatchById } from './services/api';
import { migrateCungCapTaiLieu } from './services/apiArchive';
import * as XLSX from 'xlsx-js-style';
import { CheckCircle, AlertTriangle } from 'lucide-react';

import { useAppData } from './hooks/useAppData';
import { useRecordFilter } from './hooks/useRecordFilter';
import { useReminderSystem } from './hooks/useReminderSystem';
import { useGlobalChatListener } from './hooks/useGlobalChatListener';

import { useIsMobile } from './hooks/useIsMobile';
import MobileLayout from './components/layout/MobileLayout';
import MobileRoutes from './components/mobile/MobileRoutes';
import SubmitModal from './components/receive-record/SubmitModal';
import GlobalConfirmModal from './components/GlobalConfirmModal';
import GlobalAlertModal from './components/GlobalAlertModal';
import { checkAndTriggerWeeklyBackup, downloadBackupAsFile } from './services/backupService';

function App() {
  const isMobile = useIsMobile(768);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [backupNotification, setBackupNotification] = useState<{ show: boolean, filePath?: string, backupData?: any } | null>(null);

  // Tự động kiểm tra và thực hiện sao lưu hàng tuần cho admin đã tắt theo yêu cầu

  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [notificationEnabled, setNotificationEnabled] = useState(() => {
      const saved = localStorage.getItem('chat_notification_enabled');
      return saved === null ? true : saved === 'true';
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Feature specific states
  const [recordToLiquidate, setRecordToLiquidate] = useState<RecordFile | null>(null);
  const [recordToCreateContract, setRecordToCreateContract] = useState<RecordFile | null>(null);
  const [recordForMapCorrection, setRecordForMapCorrection] = useState<RecordFile | null>(null);

  // Modal & UI States
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try { return JSON.parse(localStorage.getItem('visible_columns') || '') || DEFAULT_VISIBLE_COLUMNS; } catch { return DEFAULT_VISIBLE_COLUMNS; }
  });
  
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('column_order');
          if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                  const validKeys = COLUMN_DEFS.map(c => c.key);
                  const filtered = parsed.filter(k => validKeys.includes(k));
                  const missing = validKeys.filter(k => !filtered.includes(k));
                  return [...filtered, ...missing];
              }
          }
      } catch (e) {
          console.error(e);
      }
      return COLUMN_DEFS.map(c => c.key);
  });

  useEffect(() => {
      localStorage.setItem('column_order', JSON.stringify(columnOrder));
  }, [columnOrder]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetRecords, setAssignTargetRecords] = useState<RecordFile[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitCheckModalOpen, setIsSubmitCheckModalOpen] = useState(false);
  const [submitTargetRecords, setSubmitTargetRecords] = useState<RecordFile[]>([]);
  const [viewingRecord, setViewingRecord] = useState<RecordFile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<RecordFile | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalType, setExportModalType] = useState<'handover' | 'check_list'>('handover');
  const [isAddToBatchModalOpen, setIsAddToBatchModalOpen] = useState(false);
  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewExcelName, setPreviewExcelName] = useState('');
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<RecordFile | null>(null);

  // Report States
  const [globalReportContent, setGlobalReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // --- UPDATE LOGIC STATES ---
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateSpeed, setUpdateSpeed] = useState(0); // Bytes per second
  const [updateDeferred, setUpdateDeferred] = useState(false); // Đã chọn cập nhật sau 10p chưa

  // Toast effect
  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  // Electron Nav Listener
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onNavigateToView) {
          window.electronAPI.onNavigateToView((viewId: string) => {
              if (currentUser) setCurrentView(viewId);
          });
      }
      return () => {
          if (window.electronAPI && window.electronAPI.removeNavigationListener) {
              window.electronAPI.removeNavigationListener();
          }
      };
  }, [currentUser]);

  // Sync Templates
  useEffect(() => { syncTemplatesFromCloud(); }, []);

  // Run migration for Cung cấp tài liệu đất đai
  useEffect(() => {
      if (currentUser) {
          migrateCungCapTaiLieu();
      }
  }, [currentUser]);

  // Save visible columns
  useEffect(() => { localStorage.setItem('visible_columns', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  // --- CUSTOM HOOKS ---
  const { 
      records: rawRecords, employees, users, wards, holidays, rolePermissions, departmentPermissions, connectionStatus, 
      isUpdateAvailable, latestVersion, updateUrl,
      setEmployees, setUsers, setRecords, setWards,
      loadData, handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords,
      handleSaveEmployee, handleDeleteEmployee, handleDeleteAllData, handleUpdateUser, handleDeleteUser
  } = useAppData(currentUser);

  const records = useMemo(() => {
      return rawRecords;
  }, [rawRecords]);

  // Reminder System
  const handleUpdateRecordState = useCallback((id: string, fields: Partial<RecordFile>) => {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
  }, [setRecords]);
  const { activeRemindersCount } = useReminderSystem(records, handleUpdateRecordState, currentUser);

  // Filtering Logic
  const recordFilterProps = useRecordFilter(records, currentUser, currentView, employees);

  const selectedRecordsForBulk = useMemo(() => {
      return records.filter(r => selectedRecordIds.has(r.id));
  }, [records, selectedRecordIds]);

  // Tự động hủy các lựa chọn (deselect) hoặc bỏ tích (uncheck) các hồ sơ đã chọn khi chuyển tab/view
  useEffect(() => {
    setSelectedRecordIds(new Set());
  }, [currentView]);

  // Chat Listener
  useGlobalChatListener(currentUser, currentView, notificationEnabled, setUnreadMessages);

  // Permissions
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser?.role === UserRole.TEAM_LEADER;
  const canPerformAction = isAdmin || isSubadmin || isTeamLeader || currentUser?.role === UserRole.ONEDOOR;

  // --- UPDATE HANDLERS ---
  
  // Lắng nghe sự kiện update từ Electron
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onUpdateStatus) {
          window.electronAPI.onUpdateStatus((data: any) => {
              if (data.status === 'downloading') {
                  setUpdateStatus('downloading');
                  setUpdateProgress(data.progress);
                  if (data.bytesPerSecond) setUpdateSpeed(data.bytesPerSecond);
              } else if (data.status === 'downloaded') {
                  setUpdateStatus('ready');
                  setUpdateProgress(100);
                  // Tự động cài đặt khi tải xong
                  window.electronAPI?.quitAndInstall();
              } else if (data.status === 'error') {
                  setUpdateStatus('error');
                  console.error("Update error:", data.message);
              }
          });
          return () => { if (window.electronAPI?.removeUpdateListener) window.electronAPI.removeUpdateListener(); };
      }
  }, []);

  const handleUpdateNow = async () => {
      if (window.electronAPI?.downloadUpdate) {
          try {
              setUpdateStatus('downloading'); // Chuyển trạng thái ngay để hiện progress bar
              await window.electronAPI.downloadUpdate();
          } catch (e: any) {
              console.error("Download update failed:", e);
              setUpdateStatus('error');
              alert("Lỗi khi tải bản cập nhật: " + (e.message || "Không xác định"));
          }
      } else {
          // Fallback cho web
          if (updateUrl) window.open(updateUrl, '_blank');
      }
  };

  const handleUpdateLater = () => {
      setUpdateDeferred(true);
      // Đặt hẹn giờ 10 phút (600,000 ms)
      setTimeout(() => {
          setToast({ type: 'success', message: 'Bắt đầu tự động cập nhật hệ thống...' });
          handleUpdateNow();
      }, 600000);
  };

  const autoSwitchedHandoverRef = useRef(false);

  useEffect(() => {
      if (currentView !== 'handover_list') {
          autoSwitchedHandoverRef.current = false;
      }
  }, [currentView]);

  // --- LOGIC TỰ ĐỘNG CHUYỂN TAB CHO 1 CỬA ---
  useEffect(() => {
      if (
          currentView === 'handover_list' && 
          currentUser?.role === UserRole.ONEDOOR && 
          recordFilterProps.handoverTab === 'today' &&
          !autoSwitchedHandoverRef.current
      ) {
          autoSwitchedHandoverRef.current = true;
          recordFilterProps.setHandoverTab('history');
      }
  }, [currentView, currentUser?.role, recordFilterProps.handoverTab]);

  // --- HANDLERS (Business Logic) ---

  const handleExportReportExcel = async (fromDateStr: string, toDateStr: string, ward: string, title?: string, data?: RecordFile[]) => {
      if (!currentUser) return;
      await exportReportToExcel(data || records, fromDateStr, toDateStr, ward, employees, title);
  };

  const handleUpdateCurrentAccount = async (data: { name: string; password?: string; department?: string }) => {
      if (!currentUser) return false;
      const updatedUser: User = { ...currentUser, name: data.name, ...(data.password ? { password: data.password } : {}) };
      const savedUser = await saveUserApi(updatedUser, true);
      if (!savedUser) return false;
      if (currentUser.employeeId && data.department) {
          const emp = employees.find(e => e.id === currentUser.employeeId);
          if (emp) {
              const savedEmp = await saveEmployeeApi({ ...emp, department: data.department }, true);
              if (savedEmp) setEmployees(prev => prev.map(e => e.id === emp.id ? savedEmp : e));
          }
      }
      setUsers(prev => prev.map(u => u.username === currentUser.username ? savedUser : u));
      setCurrentUser(savedUser);
      loadData();
      return true;
  };

  const handleGlobalGenerateReport = async (fromDateStr: string, toDateStr: string, title?: string, data?: RecordFile[]) => {
      if (!currentUser) return;
      setIsGeneratingReport(true);
      setGlobalReportContent(''); 
      const from = new Date(fromDateStr); from.setHours(0, 0, 0, 0); 
      const to = new Date(toDateStr); to.setHours(23, 59, 59, 999); 
      
      let filtered = data;
      if (!filtered) {
          filtered = records.filter(r => { if(!r.receivedDate) return false; const rDate = new Date(r.receivedDate); return rDate >= from && rDate <= to; });
      }

      const formatDateVN = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      try {
          const scope = currentUser.role === UserRole.EMPLOYEE ? 'personal' : 'general';
          const result = await generateReport(filtered!, `Từ ngày ${formatDateVN(from)} đến ngày ${formatDateVN(to)}`, scope, currentUser.name, title);
          setGlobalReportContent(result);
      } catch (error) { setGlobalReportContent("Không thể tạo báo cáo. Vui lòng kiểm tra API Key."); } 
      finally { setIsGeneratingReport(false); }
  };

  const onImportRecords = async (data: RecordFile[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => {
      if (mode === 'create') {
          const result = await handleImportRecords(data, onProgress);
          if (result) {
              setToast({ type: 'success', message: `Đã nhập thành công ${data.length} hồ sơ mới.` });
              loadData();
              return true;
          } else {
              setToast({ type: 'error', message: "Lỗi khi nhập dữ liệu. Vui lòng thử lại." });
              return false;
          }
      } else {
          const result = await forceUpdateRecordsBatchApi(data, onProgress);
          if (result.success) {
              setToast({ type: 'success', message: `Đã cập nhật thành công ${result.count} hồ sơ.` });
              loadData();
              return true;
          } else {
              setToast({ type: 'error', message: "Lỗi khi cập nhật dữ liệu. Vui lòng thử lại." });
              return false;
          }
      }
  };

  const toggleSelectAll = useCallback(() => {
      if (selectedRecordIds.size === recordFilterProps.paginatedRecords.length && recordFilterProps.paginatedRecords.length > 0) setSelectedRecordIds(new Set());
      else setSelectedRecordIds(new Set(recordFilterProps.paginatedRecords.map(r => r.id)));
  }, [selectedRecordIds, recordFilterProps.paginatedRecords]);

  const toggleSelectRecord = useCallback((id: string) => {
      setSelectedRecordIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
          return newSet;
      });
  }, []);

  const confirmAssign = async (employeeId: string) => {
      const nowStr = new Date().toISOString();
      const updatedIds = assignTargetRecords.map(r => r.id);
      
      const updates = {
          assignedTo: employeeId,
          status: RecordStatus.ASSIGNED,
          assignedDate: nowStr,
          submissionDate: null,
          approvalDate: null,
          completedDate: null,
          resultReturnedDate: null,
          exportBatch: null,
          exportDate: null
      };

      setRecords(prev => prev.map(r => updatedIds.includes(r.id) ? { ...r, ...updates } : r));
      await Promise.all(assignTargetRecords.map(r => updateRecordApi({ ...r, ...updates } as any)));
      setIsAssignModalOpen(false); 
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã giao ${assignTargetRecords.length} hồ sơ thành công!` });
  };

  const getUpdatesForStatusChange = (newStatus: RecordStatus, customDateStr?: string) => {
      const targetDateStr = customDateStr || new Date().toISOString();
      const updates: any = { status: newStatus };

      switch (newStatus) {
          case RecordStatus.RECEIVED:
              updates.assignedDate = null;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
              break;
          case RecordStatus.ASSIGNED:
          case RecordStatus.IN_PROGRESS:
              updates.assignedDate = targetDateStr;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
              break;
          // MỚI: Trạng thái Đã thực hiện
          case RecordStatus.COMPLETED_WORK:
              // Giữ nguyên assignedDate
              updates.completedWorkDate = targetDateStr;
              updates.pendingCheckDate = null;
              updates.checkedDate = null;
              updates.submissionDate = null; 
              updates.approvalDate = null;
              updates.completedDate = null;
              break;
          case RecordStatus.PENDING_CHECK:
              updates.pendingCheckDate = targetDateStr;
              updates.checkedDate = null;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.CHECKED:
              updates.checkedDate = targetDateStr;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.PENDING_SIGN:
              updates.submissionDate = targetDateStr; 
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.SIGNED:
              updates.approvalDate = targetDateStr; 
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.HANDOVER:
              updates.completedDate = targetDateStr; 
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.RETURNED:
              updates.resultReturnedDate = targetDateStr;
              if (!updates.completedDate) updates.completedDate = targetDateStr;
              break;
      }
      return updates;
  };

  const handleBulkUpdate = async (field: keyof RecordFile, value: any, customDateStr?: string) => {
      const selectedIds = Array.from(selectedRecordIds);
      let baseUpdates: any = { [field]: value };
      const targetDateStr = customDateStr || new Date().toISOString();

      if (field === 'status') {
          baseUpdates = getUpdatesForStatusChange(value as RecordStatus, targetDateStr);
      } else if (field === 'deadline' || field === 'receivedDate') {
          baseUpdates[field] = targetDateStr;
      }
      
      if (field === 'assignedTo') {
          baseUpdates.assignedDate = targetDateStr;
          baseUpdates.status = RecordStatus.ASSIGNED;
          baseUpdates.submissionDate = null;
          baseUpdates.approvalDate = null;
          baseUpdates.completedDate = null;
          baseUpdates.resultReturnedDate = null;
          baseUpdates.exportBatch = null;
          baseUpdates.exportDate = null;

          const targetEmp = employees.find(e => e.id === value);
          const firstWard = targetEmp?.managedWards?.[0];
          if (firstWard) {
              baseUpdates.ward = firstWard;
              baseUpdates.handoverWard = firstWard;
          }
      }

      // Calculate the specific, fully-elaborated target records upfront
      const updatedTargets = records
          .filter(r => selectedIds.includes(r.id))
          .map(r => {
              let recordUpdates = { ...baseUpdates };
              if (field === 'status') {
                  if (value === RecordStatus.PENDING_SIGN) {
                      recordUpdates.completedWorkDate = r.completedWorkDate || targetDateStr;
                      recordUpdates.checkedDate = r.checkedDate || targetDateStr;
                  } else if (value === RecordStatus.PENDING_CHECK) {
                      recordUpdates.completedWorkDate = r.completedWorkDate || targetDateStr;
                  }
                  if (field === 'status' && (value === RecordStatus.REJECTED || value === RecordStatus.WITHDRAWN)) {
                      recordUpdates.completedDate = r.completedDate || targetDateStr;
                      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
                      const prevIdx = flow.indexOf(r.status);
                      if (prevIdx >= 0) {
                          if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                          if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !r.approvalDate) recordUpdates.approvalDate = targetDateStr;
                      }
                  }
              }
              return { ...r, ...recordUpdates };
          });

      setRecords(prev => prev.map(r => {
          const updated = updatedTargets.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      
      await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
      setToast({ type: 'success', message: `Đã cập nhật ${selectedIds.length} hồ sơ thành công!` });
      setSelectedRecordIds(new Set()); 
  };

  const handleQuickUpdate = useCallback(async (id: string, field: keyof RecordFile, value: string) => {
      const record = records.find(r => r.id === id); 
      if (!record) return;

      const nowStr = new Date().toISOString();
      let updates: any = { [field]: value };
      
      if (field === 'status') {
          updates = getUpdatesForStatusChange(value as RecordStatus);
          
          if (value === RecordStatus.PENDING_SIGN) {
              updates.completedWorkDate = record.completedWorkDate || nowStr;
              updates.checkedDate = record.checkedDate || nowStr;
          } else if (value === RecordStatus.PENDING_CHECK) {
              updates.completedWorkDate = record.completedWorkDate || nowStr;
          }
          
          if (value === RecordStatus.REJECTED || value === RecordStatus.WITHDRAWN) {
              updates.completedDate = record.completedDate || nowStr;
              const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
              const prevIdx = flow.indexOf(record.status);
              if (prevIdx >= 0) {
                  if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !record.assignedDate) updates.assignedDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !record.completedWorkDate) updates.completedWorkDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !record.pendingCheckDate) updates.pendingCheckDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !record.checkedDate) updates.checkedDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !record.submissionDate) updates.submissionDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !record.approvalDate) updates.approvalDate = nowStr;
              }
          }
      }

      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      try { 
          await updateRecordApi({ ...record, ...updates }); 
      } catch (e) { 
          console.error("Quick update failed", e); 
      }
  }, [records]);

  const handleOpenReturnModal = useCallback((record: RecordFile) => {
      setReturnRecord(record);
      setIsReturnModalOpen(true);
  }, []);

  const handleConfirmReturnResult = useCallback(async (receiptNumber: string, receiverName: string, returnedPrice: number) => {
      if (!returnRecord) return;
      const nowStr = new Date().toISOString();
      const updates = { 
          resultReturnedDate: nowStr, 
          status: RecordStatus.RETURNED, 
          receiptNumber: receiptNumber, 
          receiverName: receiverName,
          returnedPrice: returnedPrice
      }; 
      setRecords(prev => prev.map(r => r.id === returnRecord.id ? { ...r, ...updates } : r));
      await updateRecordApi({ ...returnRecord, ...updates });
      setToast({ type: 'success', message: `Đã ghi nhận trả kết quả hồ sơ ${returnRecord.code} cho ${receiverName}.` });
      setReturnRecord(null);
  }, [returnRecord]);

  const handleMapCorrectionRequest = useCallback(async (record: RecordFile) => {
      const newValue = !record.needsMapCorrection;
      const updatedRecord = { ...record, needsMapCorrection: newValue };
      setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
      await updateRecordApi(updatedRecord);
      if (newValue) {
          setRecordForMapCorrection(updatedRecord);
          setCurrentView('utilities');
          setToast({ type: 'success', message: `Đã chuyển hồ sơ ${record.code} sang tiện ích chỉnh lý bản đồ.` });
      } else {
          setToast({ type: 'success', message: `Đã HỦY yêu cầu chỉnh lý cho hồ sơ ${record.code}.` });
      }
  }, []);

  const advanceStatus = useCallback(async (record: RecordFile) => {
      if (record.status === RecordStatus.RECEIVED) { 
          setAssignTargetRecords([record]); 
          setIsAssignModalOpen(true); 
          return; 
      }
      if (record.status === RecordStatus.ASSIGNED || record.status === RecordStatus.IN_PROGRESS) {
          // Các loại đi thẳng sang trình kiểm tra (bỏ qua bước trung gian là đã thực hiện)
          setSubmitTargetRecords([record]);
          setIsSubmitCheckModalOpen(true);
          return;
      }
      if (record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED || record.status === RecordStatus.COMPLETED_WORK) {
          // Đi thẳng sang trình ký (bỏ qua bước trung gian là đã kiểm tra)
          setSubmitTargetRecords([record]);
          setIsSubmitModalOpen(true);
          return;
      }
      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
      const idx = flow.indexOf(record.status);
      if (idx < flow.length - 1) {
          const nextStatus = flow[idx + 1];
          const updates = getUpdatesForStatusChange(nextStatus);
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...record, ...updates });
      }
  }, []);

  const executeBatchExport = async (batchNumber: number, batchDate: string, handoverWard?: string) => {
      const nowStr = new Date().toISOString();
      const candidates = selectedRecordIds.size > 0 ? records.filter(r => selectedRecordIds.has(r.id)) : recordFilterProps.filteredRecords;
      const recordsToExport = candidates.filter(r => r.status === RecordStatus.SIGNED || ((r.status === RecordStatus.REJECTED || r.status === RecordStatus.WITHDRAWN) && !r.exportBatch));
      if (recordsToExport.length === 0) return;
      const updatesToApply = recordsToExport.map(r => {
          const nextStatus = r.status === RecordStatus.WITHDRAWN ? RecordStatus.WITHDRAWN : r.status === RecordStatus.REJECTED ? RecordStatus.REJECTED : RecordStatus.HANDOVER;
          return { ...r, exportBatch: batchNumber, exportDate: batchDate, status: nextStatus, completedDate: r.completedDate || nowStr, handoverWard: handoverWard || r.handoverWard };
      });
      setRecords(prev => prev.map(r => {
          const updated = updatesToApply.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      const results = await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
      if (results.some(res => res === null)) {
          loadData(); // Revert on failure
          return;
      }
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã chốt danh sách ĐỢT ${batchNumber} thành công.` });
  };

  const handleConfirmSignBatch = async () => {
      if (!canPerformAction) return;
      if (selectedRecordIds.size === 0) { alert("Vui lòng chọn ít nhất một hồ sơ để ký duyệt."); return; }
      const pendingSign = recordFilterProps.filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN && selectedRecordIds.has(r.id));
      if (pendingSign.length === 0) { alert("Các hồ sơ được chọn không ở trạng thái chờ ký."); return; }
      if(await confirmAction(`Xác nhận chuyển ${pendingSign.length} hồ sơ đang chọn sang "Đã ký"?`)) {
          const nowStr = new Date().toISOString();
          const updates = { status: RecordStatus.SIGNED, approvalDate: nowStr, completedDate: null };
          setRecords(prev => prev.map(r => pendingSign.find(p => p.id === r.id) ? { ...r, ...updates } : r));
          await Promise.all(pendingSign.map(r => updateRecordApi({ ...r, ...updates })));
          setSelectedRecordIds(new Set());
          setToast({ type: 'success', message: `Đã chuyển ${pendingSign.length} hồ sơ sang "Đã ký".` });
      }
  };

  const handleExportReturnedList = () => {
      if (!canPerformAction) return;
      exportReturnedListToExcel(recordFilterProps.filteredRecords, recordFilterProps.filterFromDate, recordFilterProps.filterToDate, recordFilterProps.filterWard);
  };

  const handleMarkAsRejected = async () => {
      if (selectedRecordIds.size === 0) return;
      if (await confirmAction(`Xác nhận đánh dấu ${selectedRecordIds.size} hồ sơ đang chọn thành "Hồ sơ trả"?\n\nHồ sơ sẽ được chuyển vào danh sách Chờ giao của bộ phận 1 cửa.`)) {
          const nowStr = new Date().toISOString();
          const targets = records.filter(r => selectedRecordIds.has(r.id));
          
          const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];

          const updatesToApply = targets.map(r => {
             const updates: any = { status: RecordStatus.REJECTED, completedDate: r.completedDate || nowStr };
             const prevIdx = flow.indexOf(r.status);
             if (prevIdx >= 0) {
                 if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !r.assignedDate) updates.assignedDate = nowStr;
                 if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !r.completedWorkDate) updates.completedWorkDate = nowStr;
                 if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !r.pendingCheckDate) updates.pendingCheckDate = nowStr;
                 if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !r.checkedDate) updates.checkedDate = nowStr;
                 if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !r.submissionDate) updates.submissionDate = nowStr;
                 if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !r.approvalDate) updates.approvalDate = nowStr;
             }
             return { ...r, ...updates };
          });
          
          setRecords(prev => prev.map(r => {
              const updated = updatesToApply.find(u => u.id === r.id);
              return updated ? updated : r;
          }));
          await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
          
          setSelectedRecordIds(new Set());
          setToast({ type: 'success', message: `Đã đánh dấu ${targets.length} hồ sơ thành "Hồ sơ trả".` });
      }
  };

  const handleHandOverRecords = useCallback(async (recordIds: string[]) => {
      if (recordIds.length === 0) return;
      const updates = recordIds.map(id => ({ id, isHandedOver: true }));
      setRecords(prev => prev.map(r => recordIds.includes(r.id) ? { ...r, isHandedOver: true } : r));
      await updateRecordsBatchById(updates);
      setToast({ type: 'success', message: `Đã tự động bàn giao ${recordIds.length} hồ sơ và đồng bộ dữ liệu!` });
  }, [setRecords]);

  if (!currentUser) return (
    <Login 
      onLogin={(user) => {
        setCurrentUser(user);
        setCurrentView('dashboard');
      }} 
      users={users} 
    />
  );

  if (isMobile) {
    return (
      <MobileLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={() => setCurrentUser(null)}
        unreadMessages={unreadMessages}
        activeRemindersCount={activeRemindersCount}
      >
        <MobileRoutes
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
          records={records}
          employees={employees}
          users={users}
          wards={wards}
          holidays={holidays}
          handleViewRecord={(r) => setViewingRecord(r)}
          setEditingRecord={setEditingRecord}
          setIsModalOpen={setIsModalOpen}
          setDeletingRecord={setDeletingRecord}
          setIsDeleteModalOpen={setIsDeleteModalOpen}
          handleUpdateCurrentAccount={handleUpdateCurrentAccount}
          notificationEnabled={notificationEnabled}
          setNotificationEnabled={setNotificationEnabled}
          setUnreadMessages={setUnreadMessages}
          onLogout={() => setCurrentUser(null)}
          onAddUser={(u) => { saveUserApi(u, false).then(res => { if(res) { setUsers(prev => [...prev, res]); loadData(); } }); }}
          onUpdateUser={(u) => handleUpdateUser(u, true)}
          onDeleteUser={handleDeleteUser}
          onSaveEmployee={handleSaveEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onDeleteAllData={handleDeleteAllData}
          onHolidaysChanged={loadData}
          handleQuickUpdate={handleQuickUpdate}
          handleAddOrUpdateRecord={handleAddOrUpdateRecord}
          onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
          onMapCorrection={handleMapCorrectionRequest}
          setWards={setWards}
          onResetWards={() => setWards(STATIC_WARDS)}
          recordForMapCorrection={recordForMapCorrection}
          globalReportContent={globalReportContent}
          isGeneratingReport={isGeneratingReport}
          handleGlobalGenerateReport={handleGlobalGenerateReport}
          handleExportReportExcel={handleExportReportExcel}
        />
        
        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
            isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
            isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
            isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
            isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
            isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            isReturnModalOpen={isReturnModalOpen} setIsReturnModalOpen={setIsReturnModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            assignTargetRecords={assignTargetRecords}
            exportModalType={exportModalType}
            
            previewWorkbook={previewWorkbook} previewExcelName={previewExcelName}

            handleAddOrUpdate={handleAddOrUpdateRecord}
            handleImportRecords={onImportRecords}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            confirmAssign={confirmAssign}
            handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
            confirmDelete={(r) => handleDeleteRecord(r.id)}
            handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
            executeBatchExport={executeBatchExport}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            onCreateContract={(r) => { setRecordToCreateContract(r as RecordFile); setCurrentView('receive_contract'); }}
            handleBulkUpdate={handleBulkUpdate}
            confirmReturnResult={handleConfirmReturnResult}

            employees={employees}
            users={users}
            currentUser={currentUser}
            wards={wards}
            filteredRecords={recordFilterProps.filteredRecords}
            records={records}
            selectedCount={selectedRecordIds.size}
            canPerformAction={canPerformAction}
            selectedRecordsForBulk={selectedRecordsForBulk}
            currentView={currentView}
        />

        {backupNotification?.show && (
            <div className="fixed top-20 right-4 max-w-md bg-white border-l-4 border-blue-600 rounded-xl shadow-2xl p-5 z-50 animate-fade-in-down border border-gray-100">
                <div className="flex gap-4">
                    <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
                        <CheckCircle size={20} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 text-sm tracking-tight mb-1">
                            Sao lưu hệ thống thành công!
                        </h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-3">
                            Hệ thống đã tự động sao lưu dữ liệu hàng tuần dưới dạng file .json.
                            {backupNotification.filePath && (
                                <span className="block font-mono text-[10px] mt-1 bg-gray-50 p-1.5 rounded text-gray-600 truncate border border-gray-100">
                                    Đã lưu: {backupNotification.filePath}
                                </span>
                            )}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (backupNotification.backupData) {
                                        downloadBackupAsFile(backupNotification.backupData);
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 flex items-center gap-1.5"
                            >
                                Tải xuống tệp .json
                            </button>
                            <button
                                onClick={() => setBackupNotification(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95"
                            >
                                Bỏ qua
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {toast && (
            <div className={`fixed bottom-20 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                {toast.message}
            </div>
        )}
        <GlobalConfirmModal />
        <GlobalAlertModal />
      </MobileLayout>
    );
  }

  return (
    <MainLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={() => setCurrentUser(null)}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isGeneratingReport={isGeneratingReport}
        isUpdateAvailable={false} 
        latestVersion={latestVersion}
        updateUrl={updateUrl}
        unreadMessages={unreadMessages}
        warningCount={recordFilterProps.warningCount}
        activeRemindersCount={activeRemindersCount}
        connectionStatus={connectionStatus}
        rolePermissions={rolePermissions}
        departmentPermissions={departmentPermissions}
        employees={employees}
        showUpdateModal={isUpdateAvailable && !updateDeferred}
        updateVersion={latestVersion}
        updateDownloadStatus={updateStatus}
        updateProgress={updateProgress}
        updateSpeed={updateSpeed}
        onUpdateNow={handleUpdateNow}
        onUpdateLater={handleUpdateLater}
    >
        <AppRoutes 
            currentView={currentView}
            setCurrentView={setCurrentView}
            currentUser={currentUser}
            records={records}
            employees={employees}
            users={users}
            wards={wards}
            holidays={holidays}
            rolePermissions={rolePermissions}
            departmentPermissions={departmentPermissions}
            
            setUnreadMessages={setUnreadMessages}
            notificationEnabled={notificationEnabled}
            setNotificationEnabled={setNotificationEnabled}
            recordToLiquidate={recordToLiquidate}
            setRecordToLiquidate={setRecordToLiquidate}
            recordToCreateContract={recordToCreateContract}
            setRecordToCreateContract={setRecordToCreateContract}
            recordForMapCorrection={recordForMapCorrection}
            
            handleViewRecord={(r) => setViewingRecord(r)}
            handleMapCorrectionRequest={handleMapCorrectionRequest}
            handleAddOrUpdateRecord={handleAddOrUpdateRecord}
            handleDeleteRecord={handleDeleteRecord}
            handleHandOverRecords={handleHandOverRecords}
            handleUpdateUser={handleUpdateUser}
            handleDeleteUser={handleDeleteUser}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            setWards={setWards}
            onResetWards={() => setWards(STATIC_WARDS)}
            handleQuickUpdate={handleQuickUpdate}
            handleUpdateCurrentAccount={handleUpdateCurrentAccount}
            
            globalReportContent={globalReportContent}
            isGeneratingReport={isGeneratingReport}
            handleGlobalGenerateReport={handleGlobalGenerateReport}
            handleExportReportExcel={handleExportReportExcel}

            {...recordFilterProps}
            
            selectedRecordIds={selectedRecordIds}
            toggleSelectAll={toggleSelectAll}
            toggleSelectRecord={toggleSelectRecord}
            visibleColumns={visibleColumns}
            setVisibleColumns={setVisibleColumns}
            columnOrder={columnOrder}
            setColumnOrder={setColumnOrder}
            
            setIsModalOpen={setIsModalOpen}
            setEditingRecord={setEditingRecord}
            handleMarkAsRejected={handleMarkAsRejected}
            setIsImportModalOpen={setIsImportModalOpen}
            setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            handleExportReturnedList={handleExportReturnedList}
            handleConfirmSignBatch={handleConfirmSignBatch}
            setAssignTargetRecords={setAssignTargetRecords}
            setIsAssignModalOpen={setIsAssignModalOpen}
            setSubmitTargetRecords={setSubmitTargetRecords}
            setIsSubmitModalOpen={setIsSubmitModalOpen}
            setIsSubmitCheckModalOpen={setIsSubmitCheckModalOpen}
            setExportModalType={setExportModalType}
            setIsExportModalOpen={setIsExportModalOpen}
            setDeletingRecord={setDeletingRecord}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            advanceStatus={advanceStatus}
            handleOpenReturnModal={handleOpenReturnModal}
        />

        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
            isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
            isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
            isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
            isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
            isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            isReturnModalOpen={isReturnModalOpen} setIsReturnModalOpen={setIsReturnModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            assignTargetRecords={assignTargetRecords}
            exportModalType={exportModalType}
            
            previewWorkbook={previewWorkbook} previewExcelName={previewExcelName}

            handleAddOrUpdate={handleAddOrUpdateRecord}
            handleImportRecords={onImportRecords}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            confirmAssign={confirmAssign}
            handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
            confirmDelete={(r) => handleDeleteRecord(r.id)}
            handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
            executeBatchExport={executeBatchExport}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            onCreateContract={(r) => { setRecordToCreateContract(r as RecordFile); setCurrentView('receive_contract'); }}
            handleBulkUpdate={handleBulkUpdate}
            confirmReturnResult={handleConfirmReturnResult}

            employees={employees}
            users={users}
            currentUser={currentUser}
            wards={wards}
            holidays={holidays}
            filteredRecords={recordFilterProps.filteredRecords}
            records={records}
            selectedCount={selectedRecordIds.size}
            canPerformAction={canPerformAction}
            selectedRecordsForBulk={selectedRecordsForBulk}
            currentView={currentView}
        />

         <SubmitModal 
            isOpen={isSubmitModalOpen}
            onClose={() => setIsSubmitModalOpen(false)}
            records={submitTargetRecords}
            users={users}
            employees={employees}
            onConfirm={async (directorId) => {
                try {
                    const nowIso = new Date().toISOString();
                    const updates = submitTargetRecords.map(r => ({
                        ...r,
                        status: RecordStatus.PENDING_SIGN,
                        completedWorkDate: r.completedWorkDate || nowIso,
                        checkedDate: r.checkedDate || nowIso,
                        submissionDate: nowIso,
                        submittedTo: directorId
                    }));
                    await updateRecordsBatchById(updates);
                    setToast({ type: 'success', message: `Đã trình ký ${updates.length} hồ sơ thành công!` });
                    setIsSubmitModalOpen(false);
                    setSubmitTargetRecords([]);
                    setSelectedRecordIds(new Set());
                    loadData();
                } catch (error) {
                    console.error("Lỗi khi trình ký:", error);
                    setToast({ type: 'error', message: 'Có lỗi xảy ra khi trình ký.' });
                }
            }}
        />

        <SubmitModal 
            isOpen={isSubmitCheckModalOpen}
            onClose={() => setIsSubmitCheckModalOpen(false)}
            records={submitTargetRecords}
            users={users}
            employees={employees}
            isCheckMode={true}
            onConfirm={async (checkerId) => {
                try {
                    const nowIso = new Date().toISOString();
                    const updates = submitTargetRecords.map(r => ({
                        ...r,
                        status: RecordStatus.PENDING_CHECK,
                        completedWorkDate: r.completedWorkDate || nowIso,
                        pendingCheckDate: nowIso,
                        checkedBy: checkerId
                    }));
                    await updateRecordsBatchById(updates);
                    setToast({ type: 'success', message: `Đã trình kiểm tra ${updates.length} hồ sơ thành công!` });
                    setIsSubmitCheckModalOpen(false);
                    setSubmitTargetRecords([]);
                    setSelectedRecordIds(new Set());
                    loadData();
                } catch (error) {
                    console.error("Lỗi khi trình kiểm tra:", error);
                    setToast({ type: 'error', message: 'Có lỗi xảy ra khi trình kiểm tra.' });
                }
            }}
        />

        {backupNotification?.show && (
            <div className="fixed top-20 right-4 max-w-md bg-white border-l-4 border-blue-600 rounded-xl shadow-2xl p-5 z-50 animate-fade-in-down border border-gray-100">
                <div className="flex gap-4">
                    <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl h-10 w-10 flex items-center justify-center shrink-0">
                        <CheckCircle size={20} />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-800 text-sm tracking-tight mb-1">
                            Sao lưu hệ thống thành công!
                        </h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-3">
                            Hệ thống đã tự động sao lưu dữ liệu hàng tuần dưới dạng file .json.
                            {backupNotification.filePath && (
                                <span className="block font-mono text-[10px] mt-1 bg-gray-50 p-1.5 rounded text-gray-600 truncate border border-gray-100">
                                    Đã lưu: {backupNotification.filePath}
                                </span>
                            )}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (backupNotification.backupData) {
                                        downloadBackupAsFile(backupNotification.backupData);
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors shadow-sm active:scale-95 flex items-center gap-1.5"
                            >
                                Tải xuống tệp .json
                            </button>
                            <button
                                onClick={() => setBackupNotification(null)}
                                className="bg-gray-100 hover:bg-gray-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors active:scale-95"
                            >
                                Bỏ qua
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {toast && (
            <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                {toast.message}
            </div>
        )}
        <GlobalConfirmModal />
        <GlobalAlertModal />
    </MainLayout>
  );
}

export default App;
