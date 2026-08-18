
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message, RecordStatusLog } from './types';
import { DEFAULT_WARDS as STATIC_WARDS, isArchiveRecordType, STATUS_LABELS, APP_VERSION } from './constants';
import Login from './components/Login'; 
import MainLayout from './components/layout/MainLayout';
import AppRoutes from './components/AppRoutes';
import AppModals from './components/AppModals';

import { DEFAULT_VISIBLE_COLUMNS, confirmAction, COLUMN_DEFS, processAssignmentTimelineCheck } from './utils/appHelpers';
import { exportReportToExcel, exportReturnedListToExcel } from './utils/excelExport';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; 
import { updateRecordApi, saveEmployeeApi, saveUserApi, forceUpdateRecordsBatchApi, updateRecordsBatchById } from './services/api';
import { migrateArchiveRecordsFromLandRecords } from './services/apiArchive';
import { ReturnOptionType } from './components/RejectReturnStepModal';
import { addActivityLog } from './services/activityLogService';
import * as XLSX from 'xlsx-js-style';
import { CheckCircle, AlertTriangle } from 'lucide-react';

import { useAppData } from './hooks/useAppData';
import { useRecordFilter } from './hooks/useRecordFilter';
import { useReminderSystem } from './hooks/useReminderSystem';

import { useIsMobile } from './hooks/useIsMobile';
import MobileLayout from './components/layout/MobileLayout';
import MobileRoutes from './components/mobile/MobileRoutes';
import UpdateRequiredModal from './components/UpdateRequiredModal';
import SubmitModal from './components/receive-record/SubmitModal';
import GlobalConfirmModal from './components/GlobalConfirmModal';
import GlobalAlertModal from './components/GlobalAlertModal';
import { checkAndTriggerWeeklyBackup, downloadBackupAsFile } from './services/backupService';
import CloudDatabaseInspector from './components/CloudDatabaseInspector';

function App() {
  const isMobile = useIsMobile(768);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [backupNotification, setBackupNotification] = useState<{ show: boolean, filePath?: string, backupData?: any } | null>(null);
  const [isCloudDatabaseInspectorOpen, setIsCloudDatabaseInspectorOpen] = useState(false);

  // Tự động kiểm tra và thực hiện sao lưu hàng tuần cho admin đã tắt theo yêu cầu

  const [currentView, setCurrentView] = useState('dashboard');
  const [receiveRecordResetKey, setReceiveRecordResetKey] = useState(0);

  const handleSetCurrentView = useCallback((viewId: string) => {
    if (viewId === 'receive_record') {
      setReceiveRecordResetKey(prev => prev + 1);
    }
    setCurrentView(viewId);
  }, []);
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
  const [importModalMode, setImportModalMode] = useState<'create' | 'update'>('create');
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
  const [isReturnHandoverModalOpen, setIsReturnHandoverModalOpen] = useState(false);
  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewExcelName, setPreviewExcelName] = useState('');
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<RecordFile | null>(null);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [isRejectReturnStepModalOpen, setIsRejectReturnStepModalOpen] = useState(false);
  const [rejectReturnTargetRecords, setRejectReturnTargetRecords] = useState<RecordFile[]>([]);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extendTargetRecords, setExtendTargetRecords] = useState<RecordFile[]>([]);

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
              if (currentUser) handleSetCurrentView(viewId);
          });
      }
      return () => {
          if (window.electronAPI && window.electronAPI.removeNavigationListener) {
              window.electronAPI.removeNavigationListener();
          }
      };
  }, [currentUser, handleSetCurrentView]);

  // Sync Templates
  useEffect(() => { syncTemplatesFromCloud(); }, []);

  // Run migration for archive records from land_records to archive_records
  useEffect(() => {
      if (currentUser) {
          migrateArchiveRecordsFromLandRecords();
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

  // Khi có phiên bản mới hoặc admin phát hành bản mới, tự động mở lại popup cập nhật ngay lập tức
  useEffect(() => {
      if (isUpdateAvailable) {
          setUpdateDeferred(false);
      }
  }, [isUpdateAvailable, latestVersion]);

  // Lắng nghe sự kiện phát hành phiên bản từ window / BroadcastChannel để lập tức hiển thị Modal
  useEffect(() => {
      const handleVersionPublished = (e: any) => {
          const ver = e.detail?.version;
          if (ver && ver !== APP_VERSION) {
              setUpdateDeferred(false);
          }
      };
      window.addEventListener('app_version_published', handleVersionPublished);

      let bc: BroadcastChannel | null = null;
      if (typeof BroadcastChannel !== 'undefined') {
          bc = new BroadcastChannel('app_version_channel');
          bc.onmessage = (event) => {
              if (event.data?.type === 'VERSION_PUBLISHED') {
                  if (event.data.version && event.data.version !== APP_VERSION) {
                      setUpdateDeferred(false);
                  }
              }
          };
      }

      return () => {
          window.removeEventListener('app_version_published', handleVersionPublished);
          if (bc) bc.close();
      };
  }, []);

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

  const createStatusLog = useCallback((r: RecordFile, newStatus: RecordStatus | string, note?: string): RecordStatusLog[] => {
      const existing = Array.isArray(r.statusLogs) ? r.statusLogs : [];
      if (r.status === newStatus) return existing;
      const newLog: RecordStatusLog = {
          id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          recordId: r.id,
          previousStatus: r.status || null,
          newStatus: newStatus,
          changedBy: currentUser?.name || currentUser?.username || 'Hệ thống',
          changedAt: new Date().toISOString(),
          note: note || null
      };
      return [newLog, ...existing];
  }, [currentUser]);

  const confirmAssign = async (employeeId: string) => {
      const nowStr = new Date().toISOString();
      const updatedTargets = assignTargetRecords.map(r => ({
          ...r,
          ...processAssignmentTimelineCheck(r, employeeId, nowStr, employees, currentUser)
      }));

      // Optimistic UI update immediately
      setRecords(prev => prev.map(r => {
          const updated = updatedTargets.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      setIsAssignModalOpen(false); 
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã giao ${assignTargetRecords.length} hồ sơ thành công!` });

      // Background batch update for high performance
      try {
          const res = await updateRecordsBatchById(updatedTargets);
          if (!res.success) {
              await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
          }
      } catch (e) {
          console.error("Batch assign error:", e);
          await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
      }
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
              updates.exportDate = targetDateStr;
              updates.is_handover = true;
              updates.handover_date = targetDateStr;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.RETURNED:
              updates.resultReturnedDate = targetDateStr;
              if (!updates.completedDate) updates.completedDate = targetDateStr;
              break;
      }
      return updates;
  };

  const handleBulkUpdate = async (field: keyof RecordFile, value: any, customDateStr?: string, targetRecordIds?: string[], extraData?: { assignedTo?: string; customDate?: string }) => {
      const selectedIds = targetRecordIds && targetRecordIds.length > 0 ? targetRecordIds : Array.from(selectedRecordIds);
      if (selectedIds.length === 0) {
          setToast({ type: 'error', message: 'Không có hồ sơ nào được chọn để cập nhật!' });
          return;
      }

      const targetDateStr = extraData?.customDate || customDateStr || new Date().toISOString();
      const selectedRecords = records.filter(r => selectedIds.includes(r.id));
      if (selectedRecords.length === 0) {
          setToast({ type: 'error', message: 'Không tìm thấy hồ sơ phù hợp!' });
          return;
      }

      const updatedTargets = selectedRecords.map(r => {
          let recordUpdates: any = {};

          if (field === 'status') {
              recordUpdates = { ...getUpdatesForStatusChange(value as RecordStatus, targetDateStr) };
              recordUpdates.statusLogs = createStatusLog(r, value, 'Cập nhật trạng thái hàng loạt');
              
              if (extraData?.assignedTo) {
                  if (value === RecordStatus.RECEIVED) {
                      recordUpdates.receivedBy = extraData.assignedTo;
                  } else if (value === RecordStatus.IN_PROGRESS || value === RecordStatus.ASSIGNED) {
                      recordUpdates.assignedTo = extraData.assignedTo;
                  } else if (value === RecordStatus.PENDING_CHECK || value === RecordStatus.CHECKED) {
                      recordUpdates.checkedBy = extraData.assignedTo;
                  } else if (value === RecordStatus.PENDING_SIGN || value === RecordStatus.SIGNED) {
                      recordUpdates.submittedTo = extraData.assignedTo;
                  } else {
                      recordUpdates.assignedTo = extraData.assignedTo;
                  }
              }

              if (value === RecordStatus.RECEIVED) {
                  if (extraData?.customDate) recordUpdates.receivedDate = extraData.customDate;
              } else if (value === RecordStatus.IN_PROGRESS || value === RecordStatus.ASSIGNED) {
                  if (extraData?.customDate) recordUpdates.assignedDate = extraData.customDate;
              } else if (value === RecordStatus.COMPLETED_WORK) {
                  if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                  if (extraData?.customDate) recordUpdates.completedWorkDate = extraData.customDate;
              } else if (value === RecordStatus.PENDING_CHECK) {
                  if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                  if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                  if (extraData?.customDate) recordUpdates.pendingCheckDate = extraData.customDate;
              } else if (value === RecordStatus.CHECKED) {
                  if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                  if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                  if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                  if (extraData?.customDate) recordUpdates.checkedDate = extraData.customDate;
              } else if (value === RecordStatus.PENDING_SIGN) {
                  if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                  if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                  if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                  if (!r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                  if (extraData?.customDate) recordUpdates.submissionDate = extraData.customDate;
              } else if (value === RecordStatus.SIGNED) {
                  if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                  if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                  if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                  if (!r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                  if (!r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                  if (extraData?.customDate) recordUpdates.approvalDate = extraData.customDate;
              } else if (value === RecordStatus.HANDOVER) {
                  if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                  if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                  if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                  if (!r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                  if (!r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                  if (!r.approvalDate) recordUpdates.approvalDate = targetDateStr;
                  if (extraData?.customDate) recordUpdates.exportDate = extraData.customDate;
              } else if (value === RecordStatus.RETURNED) {
                  if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                  if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                  if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                  if (!r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                  if (!r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                  if (!r.approvalDate) recordUpdates.approvalDate = targetDateStr;
                  if (!r.completedDate) recordUpdates.completedDate = targetDateStr;
                  if (extraData?.customDate) recordUpdates.resultReturnedDate = extraData.customDate;
              }

              if (value === RecordStatus.REJECTED || value === RecordStatus.WITHDRAWN) {
                  recordUpdates.completedDate = r.completedDate || targetDateStr;
              }
          } else if ((field as string) === 'historyStatus') {
              const stepKey = String(value);
              const empName = extraData?.assignedTo;
              const stepDate = extraData?.customDate || customDateStr;

              if (stepKey === 'ASSIGNED') {
                  if (empName) recordUpdates.assignedTo = empName;
                  if (stepDate) recordUpdates.assignedDate = stepDate;
              } else if (stepKey === 'CHECKING') {
                  if (empName) recordUpdates.checkedBy = empName;
                  if (stepDate) recordUpdates.checkedDate = stepDate;
              } else if (stepKey === 'SIGNING') {
                  if (empName) recordUpdates.submittedTo = empName;
                  if (stepDate) recordUpdates.approvalDate = stepDate;
              } else if (stepKey === 'COMPLETED') {
                  if (empName) recordUpdates.created_by = empName;
                  if (stepDate) recordUpdates.completedDate = stepDate;
              } else if (stepKey === 'RETURNED') {
                  if (empName) recordUpdates.returnedBy = empName;
                  if (stepDate) recordUpdates.resultReturnedDate = stepDate;
              }
          } else if (field === 'assignedTo') {
              recordUpdates.assignedTo = value;
              recordUpdates.assignedDate = customDateStr || r.assignedDate || targetDateStr;
              if (r.status === RecordStatus.RECEIVED) {
                  recordUpdates.status = RecordStatus.IN_PROGRESS;
              }
          } else if (field === 'checkedBy' || field === 'submittedTo') {
              recordUpdates[field] = value;
          } else if (field === 'assignedDate') {
              const formattedDate = value ? (value.includes('T') ? value : new Date(value + 'T12:00:00').toISOString()) : targetDateStr;
              recordUpdates.assignedDate = formattedDate;
          } else if (field === 'exportDate') {
              const formattedDate = value ? (value.includes('T') ? value : new Date(value + 'T12:00:00').toISOString()) : targetDateStr;
              recordUpdates.exportDate = formattedDate;
              recordUpdates.handover_date = formattedDate;
          } else if (field === 'exportBatch') {
              recordUpdates.exportBatch = value;
          } else if (field === 'archiveBatchName') {
              recordUpdates.archiveBatchName = value;
              recordUpdates.archiveBatchDate = extraData?.customDate || customDateStr || targetDateStr;
              recordUpdates.archiveExportDate = extraData?.customDate || customDateStr || targetDateStr;
          } else if (field === 'deadline' || field === 'receivedDate' || field === 'resultReturnedDate' || field === 'checkedDate' || field === 'approvalDate') {
              const formattedDate = value ? (value.includes('T') ? value : new Date(value + 'T12:00:00').toISOString()) : targetDateStr;
              recordUpdates[field] = formattedDate;
          } else if (field === 'returnedPrice') {
              recordUpdates[field] = value !== '' && value !== null && value !== undefined ? Number(value) : null;
          } else {
              recordUpdates[field] = value;
          }

          return { ...r, ...recordUpdates };
      });

      setRecords(prev => prev.map(r => {
          const updated = updatedTargets.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      setToast({ type: 'success', message: `Đã cập nhật ${updatedTargets.length} hồ sơ thành công!` });
      setIsBulkUpdateModalOpen(false);
      setSelectedRecordIds(new Set()); 

      try {
          const res = await updateRecordsBatchById(updatedTargets);
          if (!res.success) {
              await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
          }
      } catch (e) {
          console.error("Batch update error:", e);
          await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
      } 
  };

  const handleQuickUpdate = useCallback(async (id: string, field: keyof RecordFile, value: string) => {
      const record = records.find(r => r.id === id); 
      if (!record) return;

      const nowStr = new Date().toISOString();
      let updates: any = { [field]: value };
      
      if (field === 'status') {
          updates = getUpdatesForStatusChange(value as RecordStatus);
          updates.statusLogs = createStatusLog(record, value, 'Cập nhật trạng thái nhanh');
          
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
  }, [records, createStatusLog]);

  const handleOpenReturnModal = useCallback((record: RecordFile) => {
      setReturnRecord(record);
      setIsReturnModalOpen(true);
  }, []);

  const handleConfirmReturnResult = useCallback(async (receiptNumber: string, receiverName: string, returnedPrice: number, receiptType?: 'Biên Lai' | 'Hóa Đơn', customReason?: string) => {
      if (!returnRecord) return;
      const nowStr = new Date().toISOString();
      const typeLabel = receiptType || 'Biên Lai';
      const performer = currentUser?.fullName || currentUser?.name || 'Cán bộ trả';
      const reasonText = customReason?.trim() || `Đã trả kết quả cho ${receiverName}`;
      const formattedNote = `Trả hồ sơ: ${reasonText} (${performer})`;

      const statusLogs = createStatusLog(returnRecord, RecordStatus.RETURNED, `Trả kết quả cho người dân: ${receiverName} (${typeLabel} số: ${receiptNumber}, Số tiền: ${returnedPrice.toLocaleString('vi-VN')}đ)`);
      const updates = { 
          resultReturnedDate: nowStr, 
          status: RecordStatus.RETURNED, 
          receiptNumber: receiptNumber, 
          receiptType: typeLabel,
          receiverName: receiverName,
          returnedPrice: returnedPrice,
          price: returnedPrice,
          notes: formattedNote,
          statusLogs
      }; 
      setRecords(prev => prev.map(r => r.id === returnRecord.id ? { ...r, ...updates } : r));
      await updateRecordApi({ ...returnRecord, ...updates });
      setToast({ type: 'success', message: `Đã ghi nhận trả kết quả hồ sơ ${returnRecord.code} cho ${receiverName}.` });
      setReturnRecord(null);
  }, [returnRecord, createStatusLog, currentUser]);

  const handleMapCorrectionRequest = useCallback(async (record: RecordFile) => {
      const isArchive = isArchiveRecordType(record.recordType || '') || record.sourceTable === 'luutru_records';
      if (isArchive) {
          setToast({ type: 'error', message: 'Hồ sơ lưu trữ không áp dụng tính năng chỉnh lý bản đồ.' });
          return;
      }
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

  const handleBatchUpdateRecords = useCallback(async (updates: Partial<RecordFile>[]) => {
      try {
          const res = await updateRecordsBatchById(updates);
          if (res.success) {
              await loadData();
              setToast({ type: 'success', message: `Đã cập nhật sửa lỗi cho ${res.count} hồ sơ thành công!` });
          } else {
              setToast({ type: 'error', message: 'Cập nhật sửa lỗi hàng loạt thất bại.' });
          }
      } catch (err) {
          console.error("Lỗi khi sửa lỗi hàng loạt:", err);
          setToast({ type: 'error', message: 'Có lỗi xảy ra khi sửa lỗi hàng loạt.' });
      }
  }, [loadData]);

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
          if (nextStatus === RecordStatus.HANDOVER) {
              // Bắt buộc chốt đợt, không được giao lẻ!
              setSelectedRecordIds(new Set([record.id]));
              setIsAddToBatchModalOpen(true);
              return;
          }
          const updates = getUpdatesForStatusChange(nextStatus);
          updates.statusLogs = createStatusLog(record, nextStatus, 'Chuyển trạng thái kế tiếp');
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...record, ...updates });
      }
  }, [createStatusLog]);

  const executeBatchExport = async (batchNumber: number | string, batchDate: string, handoverWard?: string) => {
      const nowStr = new Date().toISOString();
      const candidates = selectedRecordIds.size > 0 ? records.filter(r => selectedRecordIds.has(r.id)) : recordFilterProps.filteredRecords;
      const recordsToExport = selectedRecordIds.size > 0 
          ? candidates 
          : candidates.filter(r => r.status === RecordStatus.SIGNED || ((r.status === RecordStatus.REJECTED || r.status === RecordStatus.WITHDRAWN) && !r.exportBatch) || r.status === RecordStatus.HANDOVER);
      if (recordsToExport.length === 0) return;
      const updatesToApply = recordsToExport.map(r => {
          const nextStatus = r.status === RecordStatus.WITHDRAWN ? RecordStatus.WITHDRAWN : r.status === RecordStatus.REJECTED ? RecordStatus.REJECTED : RecordStatus.HANDOVER;
          const statusLogs = createStatusLog(r, nextStatus, `Chốt xuất giao 1 cửa - ${batchNumber}`);
          const actualHandoverWard = (handoverWard === 'SAME_AS_WARD' || !handoverWard) ? r.ward : handoverWard;
          return { ...r, exportBatch: batchNumber, exportDate: batchDate, status: nextStatus, completedDate: r.completedDate || nowStr, handoverWard: actualHandoverWard, statusLogs };
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
      setToast({ type: 'success', message: `Đã chốt danh sách ${batchNumber} thành công.` });
  };

  const executeReturnBatchHandover = async (batchNumber: number, batchDate: string, deptName: string) => {
      const candidates = selectedRecordIds.size > 0 ? records.filter(r => selectedRecordIds.has(r.id)) : recordFilterProps.filteredRecords;
      const recordsToHandover = candidates.filter(r => r.status === RecordStatus.RETURNED);
      if (recordsToHandover.length === 0) {
          alert("Vui lòng chọn các hồ sơ Đã trả kết quả để chốt bàn giao.");
          return;
      }
      const updatesToApply = recordsToHandover.map(r => {
          const statusLogs = createStatusLog(r, r.status, `Chốt DS bàn giao về phòng chuyên môn (${deptName}) - Đợt ${batchNumber}`);
          return {
              ...r,
              returnBatch: batchNumber,
              returnBatchDate: batchDate,
              returnHandoverDept: deptName,
              statusLogs
          };
      });
      setRecords(prev => prev.map(r => {
          const updated = updatesToApply.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      const results = await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
      if (results.some(res => res === null)) {
          loadData();
          return;
      }
      setSelectedRecordIds(new Set());
      setToast({ type: 'success', message: `Đã chốt danh sách bàn giao ĐỢT ${batchNumber} về ${deptName} thành công.` });
  };

  const handleConfirmSignBatch = async () => {
      if (!canPerformAction) return;
      if (selectedRecordIds.size === 0) { alert("Vui lòng chọn ít nhất một hồ sơ để ký duyệt."); return; }
      const pendingSign = recordFilterProps.filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN && selectedRecordIds.has(r.id));
      if (pendingSign.length === 0) { alert("Các hồ sơ được chọn không ở trạng thái chờ ký."); return; }
      if(await confirmAction(`Xác nhận chuyển ${pendingSign.length} hồ sơ đang chọn sang "Đã ký"?`)) {
          const nowStr = new Date().toISOString();
          const updatedTargets = pendingSign.map(r => ({
              ...r,
              status: RecordStatus.SIGNED,
              approvalDate: nowStr,
              completedDate: null,
              statusLogs: createStatusLog(r, RecordStatus.SIGNED, 'Ký duyệt đợt')
          }));
          setRecords(prev => prev.map(r => {
              const updated = updatedTargets.find(p => p.id === r.id);
              return updated ? updated : r;
          }));
          setSelectedRecordIds(new Set());
          setToast({ type: 'success', message: `Đã chuyển ${pendingSign.length} hồ sơ sang "Đã ký".` });

          try {
              const res = await updateRecordsBatchById(updatedTargets);
              if (!res.success) {
                  await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
              }
          } catch (e) {
              console.error("Batch sign error:", e);
              await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
          }
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
             updates.statusLogs = createStatusLog(r, RecordStatus.REJECTED, 'Đánh dấu hồ sơ trả');
             return { ...r, ...updates };
          });
          
          setRecords(prev => prev.map(r => {
              const updated = updatesToApply.find(u => u.id === r.id);
              return updated ? updated : r;
          }));
          setSelectedRecordIds(new Set());
          setToast({ type: 'success', message: `Đã đánh dấu ${targets.length} hồ sơ thành "Hồ sơ trả".` });

          try {
              const res = await updateRecordsBatchById(updatesToApply);
              if (!res.success) {
                  await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
              }
          } catch (e) {
              console.error("Batch reject error:", e);
              await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
          }
      }
  };

  const handleHandOverRecords = useCallback(async (recordIds: string[]) => {
      if (recordIds.length === 0) return;
      const updates = recordIds.map(id => ({ id, isHandedOver: true }));
      setRecords(prev => prev.map(r => recordIds.includes(r.id) ? { ...r, isHandedOver: true } : r));
      await updateRecordsBatchById(updates);
      setToast({ type: 'success', message: `Đã tự động bàn giao ${recordIds.length} hồ sơ và đồng bộ dữ liệu!` });
  }, [setRecords]);

  const handleOpenRejectReturnModal = useCallback((targets: RecordFile[]) => {
      setRejectReturnTargetRecords(targets);
      setIsRejectReturnStepModalOpen(true);
  }, []);

  const handleOpenExtendModal = useCallback((targets: RecordFile[]) => {
      setExtendTargetRecords(targets);
      setIsExtendModalOpen(true);
  }, []);

  const handleConfirmExtendDeadline = useCallback(async (newDeadline: string, reason: string, executionDateStr: string) => {
      if (extendTargetRecords.length === 0) return;
      const executionDateISO = executionDateStr ? new Date(executionDateStr).toISOString() : new Date().toISOString();
      const newDeadlineISO = new Date(newDeadline).toISOString();
      
      const formatDateVN = (dStr: string) => {
          try {
              const d = new Date(dStr);
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = d.getFullYear();
              return `${day}/${month}/${year}`;
          } catch {
              return dStr;
          }
      };

      const updatedTargets = extendTargetRecords.map(r => {
          const oldDeadlineVN = formatDateVN(r.deadline || '');
          const newDeadlineVN = formatDateVN(newDeadline);
          const execDateVN = formatDateVN(executionDateISO);
          const userLabel = currentUser?.name || currentUser?.username || 'Hệ thống';
          const reasonSuffix = reason && reason.trim() ? `. Lý do: ${reason.trim()}` : '';
          const extensionLog = `[GIA HẠN HẸN TRẢ - ${execDateVN}] Hạn cũ: ${oldDeadlineVN} -> Hạn mới: ${newDeadlineVN}${reasonSuffix} (Thực hiện bởi: ${userLabel})`;

          const existingNotes = r.privateNotes || '';
          const updatedPrivateNotes = existingNotes ? `${existingNotes}\n${extensionLog}` : extensionLog;

          return {
              ...r,
              originalDeadline: r.originalDeadline || r.deadline,
              deadline: newDeadlineISO,
              extendedBy: currentUser?.employeeId || currentUser?.name || currentUser?.username || 'Hệ thống',
              extendedAt: executionDateISO,
              privateNotes: updatedPrivateNotes
          };
      });

      setRecords(prev => prev.map(r => {
          const found = updatedTargets.find(u => u.id === r.id);
          return found ? found : r;
      }));

      await Promise.all(updatedTargets.map(u => updateRecordApi(u)));
      setIsExtendModalOpen(false);
      setExtendTargetRecords([]);
      setSelectedRecordIds(new Set());
      setToast({ type: 'success', message: `Đã gia hạn ngày hẹn cho ${updatedTargets.length} hồ sơ thành công!` });
  }, [extendTargetRecords, currentUser]);

  const handleConfirmRejectReturnStep = useCallback(async (optionType: ReturnOptionType, reason: string, returnDateStr: string) => {
      if (rejectReturnTargetRecords.length === 0) return;
      const targetDateISO = returnDateStr ? new Date(returnDateStr).toISOString() : new Date().toISOString();
      
      const formatDateVN = (dStr: string) => {
          try {
              const d = new Date(dStr);
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = d.getFullYear();
              const hours = String(d.getHours()).padStart(2, '0');
              const mins = String(d.getMinutes()).padStart(2, '0');
              return `${hours}:${mins} ngày ${day}/${month}/${year}`;
          } catch {
              return dStr;
          }
      };

      const updatedTargets = rejectReturnTargetRecords.map(r => {
          const formattedReturnDate = formatDateVN(targetDateISO);
          const userLabel = currentUser?.name || currentUser?.username || 'Hệ thống';
          let newStatus: RecordStatus = RecordStatus.IN_PROGRESS;
          let internalLogNote = '';

          if (optionType === 'pause_supplement') {
              newStatus = RecordStatus.PENDING_SUPPLEMENT;
              internalLogNote = `Trả bổ sung: ${reason || 'Không có lý do'} (Người trả: ${userLabel})`;
          } else if (optionType === 'cancel_reject') {
              newStatus = RecordStatus.REJECTED;
              internalLogNote = `Trả hủy hồ sơ: ${reason || 'Không có lý do'} (Người trả: ${userLabel})`;
          } else {
              newStatus = RecordStatus.IN_PROGRESS;
              internalLogNote = `Trả về cán bộ thụ lý: ${reason || 'Không có lý do'} (Người trả: ${userLabel})`;
          }

          const existingNotes = r.privateNotes || '';
          const updatedPrivateNotes = existingNotes ? `${existingNotes}\n${internalLogNote}` : internalLogNote;

          const newLog: RecordStatusLog = {
              id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              recordId: r.id,
              previousStatus: r.status,
              newStatus: newStatus,
              changedBy: userLabel,
              changedAt: targetDateISO,
              note: `Trả hồ sơ (${optionType}). Lý do: ${reason}`
          };

          addActivityLog({
              performerName: userLabel,
              performerRole: currentUser?.role || 'ONEDOOR',
              actionType: optionType === 'cancel_reject' ? 'DELETE' : 'UPDATE',
              actionLabel: optionType === 'pause_supplement' ? 'Chờ bổ sung' : optionType === 'cancel_reject' ? 'Trả hủy hồ sơ' : 'Trả cán bộ',
              targetType: 'Hồ sơ',
              referenceCode: r.code || r.id,
              details: `Trả hồ sơ ${r.code} (${optionType === 'pause_supplement' ? 'Trả chờ bổ sung' : optionType === 'cancel_reject' ? 'Trả hủy hồ sơ' : 'Trả về cán bộ thụ lý'}). Lý do: ${reason}`,
              recordId: r.id
          });

          return {
              ...r,
              status: newStatus,
              ...(optionType === 'cancel_reject' ? { completedDate: targetDateISO } : {}),
              ...(optionType === 'return_handler' ? { pendingCheckDate: null, submissionDate: null, checkedDate: null, approvalDate: null } : {}),
              privateNotes: updatedPrivateNotes,
              statusLogs: [...(r.statusLogs || []), newLog]
          };
      });

      setRecords(prev => prev.map(r => {
          const found = updatedTargets.find(u => u.id === r.id);
          return found ? found : r;
      }));

      if (viewingRecord) {
          const updatedViewing = updatedTargets.find(u => u.id === viewingRecord.id);
          if (updatedViewing) {
              setViewingRecord(updatedViewing);
          }
      }

      await Promise.all(updatedTargets.map(u => updateRecordApi(u)));
      setIsRejectReturnStepModalOpen(false);
      setRejectReturnTargetRecords([]);
      setSelectedRecordIds(new Set());

      let toastMsg = `Đã thực hiện trả ${updatedTargets.length} hồ sơ thành công!`;
      if (optionType === 'cancel_reject') {
          toastMsg = `Đã trả hủy ${updatedTargets.length} hồ sơ thành công! Hồ sơ đã chuyển sang danh sách Chờ bàn giao 1 cửa.`;
      } else if (optionType === 'pause_supplement') {
          toastMsg = `Đã chuyển ${updatedTargets.length} hồ sơ sang trạng thái Chờ bổ sung!`;
      } else if (optionType === 'return_handler') {
          toastMsg = `Đã trả ${updatedTargets.length} hồ sơ về cho Cán bộ thụ lý!`;
      }
      setToast({ type: 'success', message: toastMsg });
  }, [rejectReturnTargetRecords, currentUser, viewingRecord]);

  if (!currentUser) return (
    <>
      <UpdateRequiredModal 
        visible={isUpdateAvailable && !updateDeferred}
        version={latestVersion}
        downloadStatus={updateStatus}
        progress={updateProgress}
        downloadSpeed={updateSpeed}
        onUpdateNow={handleUpdateNow}
        onUpdateLater={handleUpdateLater}
      />
      <Login 
        onLogin={(user) => {
          setCurrentUser(user);
          setCurrentView('dashboard');
        }} 
        users={users} 
      />
    </>
  );

  if (isMobile) {
    return (
      <>
        <UpdateRequiredModal 
          visible={isUpdateAvailable && !updateDeferred}
          version={latestVersion}
          downloadStatus={updateStatus}
          progress={updateProgress}
          downloadSpeed={updateSpeed}
          onUpdateNow={handleUpdateNow}
          onUpdateLater={handleUpdateLater}
        />
        <MobileLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={handleSetCurrentView}
        onLogout={() => setCurrentUser(null)}
        unreadMessages={unreadMessages}
        activeRemindersCount={activeRemindersCount}
      >
        <MobileRoutes
          currentView={currentView}
          setCurrentView={handleSetCurrentView}
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
            isReturnHandoverModalOpen={isReturnHandoverModalOpen} setIsReturnHandoverModalOpen={setIsReturnHandoverModalOpen}
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
            executeReturnBatchHandover={executeReturnBatchHandover}
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
    </>
    );
  }

  return (
    <MainLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={handleSetCurrentView}
        onLogout={() => setCurrentUser(null)}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isGeneratingReport={isGeneratingReport}
        isUpdateAvailable={isUpdateAvailable} 
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
        onReopenUpdateModal={() => setUpdateDeferred(false)}
    >
        <AppRoutes 
            currentView={currentView}
            setCurrentView={handleSetCurrentView}
            receiveRecordResetKey={receiveRecordResetKey}
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
            onBulkUpdate={handleBulkUpdate}
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
            onOpenCloudInspector={() => setIsCloudDatabaseInspectorOpen(true)}
            
            globalReportContent={globalReportContent}
            isGeneratingReport={isGeneratingReport}
            handleGlobalGenerateReport={handleGlobalGenerateReport}
            handleExportReportExcel={handleExportReportExcel}

            {...recordFilterProps}
            
            selectedRecordIds={selectedRecordIds}
            setSelectedRecordIds={setSelectedRecordIds}
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
            setImportModalMode={setImportModalMode}
            setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            setIsReturnHandoverModalOpen={setIsReturnHandoverModalOpen}
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
            isDiagnosticModalOpen={isDiagnosticModalOpen}
            setIsDiagnosticModalOpen={setIsDiagnosticModalOpen}
            advanceStatus={advanceStatus}
            handleOpenReturnModal={handleOpenReturnModal}
            handleOpenRejectReturnModal={handleOpenRejectReturnModal}
            handleOpenExtendModal={handleOpenExtendModal}
        />

        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            importModalMode={importModalMode}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
            isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
            isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
            isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
            isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            isReturnHandoverModalOpen={isReturnHandoverModalOpen} setIsReturnHandoverModalOpen={setIsReturnHandoverModalOpen}
            isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
            isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            isReturnModalOpen={isReturnModalOpen} setIsReturnModalOpen={setIsReturnModalOpen}
            isDiagnosticModalOpen={isDiagnosticModalOpen} setIsDiagnosticModalOpen={setIsDiagnosticModalOpen}
            isRejectReturnStepModalOpen={isRejectReturnStepModalOpen} setIsRejectReturnStepModalOpen={setIsRejectReturnStepModalOpen}
            isExtendModalOpen={isExtendModalOpen} setIsExtendModalOpen={setIsExtendModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            assignTargetRecords={assignTargetRecords}
            rejectReturnTargetRecords={rejectReturnTargetRecords}
            extendTargetRecords={extendTargetRecords}
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
            executeReturnBatchHandover={executeReturnBatchHandover}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            onCreateContract={(r) => { setRecordToCreateContract(r as RecordFile); setCurrentView('receive_contract'); }}
            handleBulkUpdate={handleBulkUpdate}
            handleBatchUpdateRecords={handleBatchUpdateRecords}
            confirmReturnResult={handleConfirmReturnResult}
            onConfirmRejectReturnStep={handleConfirmRejectReturnStep}
            onOpenRejectReturnModal={(r) => handleOpenRejectReturnModal([r])}
            onConfirmExtendDeadline={handleConfirmExtendDeadline}
            onOpenExtendModal={(r) => handleOpenExtendModal([r])}

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
        <CloudDatabaseInspector isOpen={isCloudDatabaseInspectorOpen} onClose={() => setIsCloudDatabaseInspectorOpen(false)} />
    </MainLayout>
  );
}

export default App;
