
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message, RecordStatusLog } from './types';
import { DEFAULT_WARDS as STATIC_WARDS, isArchiveRecordType, STATUS_LABELS, APP_VERSION, isCapGiayRecord, isTaxDefaultRecordType, getDefaultCapGiaySubStep, getCapGiaySubStepLabel } from './constants';
import Login from './components/Login'; 
import MainLayout from './components/layout/MainLayout';
import AppRoutes from './components/AppRoutes';
import AppModals from './components/AppModals';

import { DEFAULT_VISIBLE_COLUMNS, confirmAction, COLUMN_DEFS, processAssignmentTimelineCheck, calculateDeadlineHelperByDays, getCapGiayStepSLA, parseSafeDate } from './utils/appHelpers';
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

import { useIsMobile } from './hooks/useIsMobile';
import MobileLayout from './components/layout/MobileLayout';
import MobileRoutes from './components/mobile/MobileRoutes';
import UpdateRequiredModal from './components/UpdateRequiredModal';
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
  const [extendTargetRecord, setExtendTargetRecord] = useState<RecordFile | null>(null);
  const [extendTargetRecords, setExtendTargetRecords] = useState<RecordFile[]>([]);
  const [isSupplementModalOpen, setIsSupplementModalOpen] = useState(false);
  const [supplementTargetRecords, setSupplementTargetRecords] = useState<RecordFile[]>([]);

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
      const from = parseSafeDate(fromDateStr) || new Date(); from.setHours(0, 0, 0, 0); 
      const to = parseSafeDate(toDateStr) || new Date(); to.setHours(23, 59, 59, 999); 
      
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

  const confirmAssign = async (employeeId: string, selectedSubStep?: string) => {
      const nowStr = new Date().toISOString();
      const todayStr = nowStr.split('T')[0];

      const updatedTargets = assignTargetRecords.map(r => {
          const isCG = isCapGiayRecord(r);
          let updatedSubStep = r.capGiaySubStep;

          if (isCG) {
              if (selectedSubStep) {
                  updatedSubStep = selectedSubStep;
              } else if (!updatedSubStep) {
                  updatedSubStep = getDefaultCapGiaySubStep(r.recordType);
              }
          }

          const hasThamdinh = r.capGiaySubStep === 'tham_dinh' || selectedSubStep === 'tham_dinh';
          const stepSLA = getCapGiayStepSLA(updatedSubStep, hasThamdinh);
          const newDeadline = isCG ? calculateDeadlineHelperByDays(stepSLA, todayStr, holidays) : r.deadline;

          const baseAssignment = processAssignmentTimelineCheck(r, employeeId, nowStr, employees, currentUser);

          return {
              ...r,
              ...baseAssignment,
              ...(isCG ? { capGiaySubStep: updatedSubStep, deadline: newDeadline } : {})
          };
      });

      setRecords(prev => prev.map(r => {
          const updated = updatedTargets.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
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
          case RecordStatus.IN_PROGRESS:
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
          case RecordStatus.PENDING_CHECK:
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

  const handleBulkUpdate = async (field: keyof RecordFile, value: any, customDateStr?: string, targetRecordIds?: string[], assignedToValue?: string) => {
      const selectedIds = targetRecordIds && targetRecordIds.length > 0 ? targetRecordIds : Array.from(selectedRecordIds);
      if (selectedIds.length === 0) {
          setToast({ type: 'error', message: 'Không có hồ sơ nào được chọn để cập nhật!' });
          return;
      }

      const targetDateStr = customDateStr || new Date().toISOString();
      const selectedRecords = records.filter(r => selectedIds.includes(r.id));
      if (selectedRecords.length === 0) {
          setToast({ type: 'error', message: 'Không tìm thấy hồ sơ phù hợp!' });
          return;
      }

      const VALID_STATUSES = [
          RecordStatus.RECEIVED,
          RecordStatus.ASSIGNED,
          RecordStatus.IN_PROGRESS,
          RecordStatus.PENDING_CHECK,
          RecordStatus.PENDING_SIGN,
          RecordStatus.PENDING_SUPPLEMENT,
          RecordStatus.SIGNED,
          RecordStatus.HANDOVER,
          RecordStatus.RETURNED,
          RecordStatus.WITHDRAWN,
          RecordStatus.REJECTED
      ];

      if (field === 'status' && value && !VALID_STATUSES.includes(value as RecordStatus)) {
          setToast({ type: 'error', message: `Trạng thái "${value}" không hợp lệ! Vui lòng chỉ chọn trạng thái đúng quy trình.` });
          return;
      }

      const updatedTargets = selectedRecords.map(r => {
          let recordUpdates: any = {};

          if (field && value !== '' && value !== undefined) {
              if (field === 'status') {
                  recordUpdates = { ...getUpdatesForStatusChange(value as RecordStatus, targetDateStr) };
                  recordUpdates.statusLogs = createStatusLog(r, value, 'Cập nhật trạng thái hàng loạt');

                  if (value === RecordStatus.PENDING_CHECK || value === RecordStatus.PENDING_CHECK) {
                      if (!r.checkedBy && currentUser?.employeeId) recordUpdates.checkedBy = currentUser.employeeId;
                  } else if (value === RecordStatus.PENDING_SIGN || value === RecordStatus.SIGNED) {
                      if (!r.submittedTo && currentUser?.employeeId) recordUpdates.submittedTo = currentUser.employeeId;
                  }

                  if (value === RecordStatus.IN_PROGRESS) {
                      if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                  } else if (value === RecordStatus.PENDING_CHECK) {
                      if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                      if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                  } else if (value === RecordStatus.PENDING_CHECK) {
                      if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                      if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                      if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                  } else if (value === RecordStatus.PENDING_SIGN) {
                      if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                      if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                      if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                      if (!r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                  } else if (value === RecordStatus.SIGNED) {
                      if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                      if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                      if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                      if (!r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                      if (!r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                      if (isCapGiayRecord(r)) {
                          recordUpdates.capGiaySubStep = 'giao_mot_cua';
                      }
                  } else if (value === RecordStatus.HANDOVER) {
                      if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                      if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                      if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                      if (!r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                      if (!r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                      if (!r.approvalDate) recordUpdates.approvalDate = targetDateStr;
                  } else if (value === RecordStatus.RETURNED) {
                      if (!r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                      if (!r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                      if (!r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                      if (!r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                      if (!r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                      if (!r.approvalDate) recordUpdates.approvalDate = targetDateStr;
                      if (!r.completedDate) recordUpdates.completedDate = targetDateStr;
                  }

                  if (value === RecordStatus.REJECTED || value === RecordStatus.WITHDRAWN) {
                      recordUpdates.completedDate = r.completedDate || targetDateStr;
                  }
              } else if (field === 'assignedTo') {
                  recordUpdates.assignedTo = value;
                  recordUpdates.assignedDate = customDateStr || r.assignedDate || targetDateStr;
                  if (r.status === RecordStatus.RECEIVED) {
                      recordUpdates.status = RecordStatus.IN_PROGRESS;
                  }
              } else if (['deadline', 'receivedDate', 'resultReturnedDate', 'assignedDate', 'completedWorkDate', 'checkedDate', 'submissionDate', 'approvalDate', 'completedDate'].includes(field as string)) {
                  const formattedDate = value ? (value.includes('T') ? value : new Date(value + 'T12:00:00').toISOString()) : null;
                  recordUpdates[field] = formattedDate;
                  if (field === 'checkedDate') {
                      recordUpdates.pendingCheckDate = formattedDate;
                  }
              } else if (field === 'exportDate') {
                  const formattedDate = value ? (value.includes('T') ? value : new Date(value + 'T12:00:00').toISOString()) : targetDateStr;
                  recordUpdates.exportDate = formattedDate;
                  recordUpdates.handover_date = formattedDate;
              } else if (field === 'exportBatch') {
                  recordUpdates.exportBatch = value;
              } else if (field === 'deadline' || field === 'receivedDate' || field === 'resultReturnedDate') {
                  const formattedDate = value ? (value.includes('T') ? value : new Date(value + 'T12:00:00').toISOString()) : targetDateStr;
                  recordUpdates[field] = formattedDate;
              } else if (field === 'returnedPrice') {
                  recordUpdates[field] = value !== '' && value !== null && value !== undefined ? Number(value) : null;
              } else {
                  recordUpdates[field] = value;
              }
          }

          if (assignedToValue) {
              recordUpdates.assignedTo = assignedToValue;
              if (!r.assignedDate && field !== 'status') {
                  recordUpdates.assignedDate = customDateStr || targetDateStr;
              }
              if (field !== 'status' && r.status === RecordStatus.RECEIVED) {
                  recordUpdates.status = RecordStatus.IN_PROGRESS;
              }
          }

          return { ...r, ...recordUpdates };
      });

      setRecords(prev => prev.map(r => {
          const updated = updatedTargets.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      
      await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
      setToast({ type: 'success', message: `Đã cập nhật ${updatedTargets.length} hồ sơ thành công!` });
      setIsBulkUpdateModalOpen(false);
      setSelectedRecordIds(new Set()); 
  };

  const handleQuickUpdate = useCallback(async (id: string, field: keyof RecordFile, value: string) => {
      const record = records.find(r => r.id === id); 
      if (!record) return;

      const nowStr = new Date().toISOString();
      let updates: any = { [field]: value };
      
      if (field === 'capGiaySubStep') {
          if (value === 'hoan_thien_trinh_duyet' && (record.capGiaySubStep === 'cho_nop_thue' || record.capGiaySubStep === 'cho_giay_nop_tien')) {
              const todayStr = nowStr.split('T')[0];
              const newDeadline = calculateDeadlineHelperByDays(5, todayStr, holidays || []);
              updates.status = RecordStatus.RECEIVED;
              updates.assignedTo = "";
              updates.deadline = newDeadline;
              updates.statusLogs = createStatusLog(record, record.status, 'Xác nhận đã nộp tiền thuế → Trả về bước giao việc (chờ phân công in & hoàn thiện, SLA 5 ngày)');
              setToast({ type: 'success', message: `Hồ sơ ${record.code} đã xác nhận nộp thuế, đã trả về bước giao việc cho người in!` });
          }
      }

      if (field === 'status') {
          const VALID_STATUSES = [
              RecordStatus.RECEIVED,
              RecordStatus.ASSIGNED,
              RecordStatus.IN_PROGRESS,
              RecordStatus.PENDING_CHECK,
              RecordStatus.PENDING_SIGN,
              RecordStatus.PENDING_SUPPLEMENT,
              RecordStatus.SIGNED,
              RecordStatus.HANDOVER,
              RecordStatus.RETURNED,
              RecordStatus.WITHDRAWN,
              RecordStatus.REJECTED
          ];
          if (!VALID_STATUSES.includes(value as RecordStatus)) {
              setToast({ type: 'error', message: `Trạng thái "${value}" không thuộc danh sách quy trình hợp lệ!` });
              return;
          }

          updates = getUpdatesForStatusChange(value as RecordStatus);
          updates.statusLogs = createStatusLog(record, value, 'Cập nhật trạng thái nhanh');

          if (value === RecordStatus.PENDING_CHECK || value === RecordStatus.PENDING_CHECK) {
              if (!record.checkedBy && currentUser?.employeeId) updates.checkedBy = currentUser.employeeId;
          } else if (value === RecordStatus.PENDING_SIGN || value === RecordStatus.SIGNED) {
              if (!record.submittedTo && currentUser?.employeeId) updates.submittedTo = currentUser.employeeId;
          }
          
          if (value === RecordStatus.PENDING_SIGN) {
              updates.completedWorkDate = record.completedWorkDate || nowStr;
              updates.checkedDate = record.checkedDate || nowStr;
          } else if (value === RecordStatus.PENDING_CHECK) {
              updates.completedWorkDate = record.completedWorkDate || nowStr;
          }
          
          if (value === RecordStatus.REJECTED || value === RecordStatus.WITHDRAWN) {
              updates.completedDate = record.completedDate || nowStr;
              const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.PENDING_CHECK, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
              const prevIdx = flow.indexOf(record.status);
              if (prevIdx >= 0) {
                  if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !record.assignedDate) updates.assignedDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.IN_PROGRESS) && !record.completedWorkDate) updates.completedWorkDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !record.pendingCheckDate) updates.pendingCheckDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !record.checkedDate) updates.checkedDate = nowStr;
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

  const handleConfirmReturnResult = useCallback(async (receiptNumber: string, receiverName: string, returnedPrice: number, receiptType?: 'Biên Lai' | 'Hóa Đơn') => {
      if (!returnRecord) return;
      const nowStr = new Date().toISOString();
      const typeLabel = receiptType || 'Biên Lai';
      const statusLogs = createStatusLog(returnRecord, RecordStatus.RETURNED, `Trả kết quả cho người dân: ${receiverName} (${typeLabel} số: ${receiptNumber}, Số tiền: ${returnedPrice.toLocaleString('vi-VN')})`);
      const updates = { 
          resultReturnedDate: nowStr, 
          status: RecordStatus.RETURNED, 
          receiptNumber: receiptNumber, 
          receiptType: typeLabel,
          receiverName: receiverName,
          returnedPrice: returnedPrice,
          statusLogs
      }; 
      setRecords(prev => prev.map(r => r.id === returnRecord.id ? { ...r, ...updates } : r));
      await updateRecordApi({ ...returnRecord, ...updates });
      setToast({ type: 'success', message: `Đã ghi nhận trả kết quả hồ sơ ${returnRecord.code} cho ${receiverName}.` });
      setReturnRecord(null);
  }, [returnRecord, createStatusLog]);

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
      // 1. Nếu là Hồ sơ bị trả / tạm dừng / bổ sung -> Chuyển về bước Chờ giao việc
      if (record.status === RecordStatus.RETURNED || record.status === RecordStatus.REJECTED || record.capGiaySubStep === 'cho_bo_sung') {
          const oldAssigned = record.assignedTo || record.lastAssignedTo || null;
          const updates: Partial<RecordFile> = {
              status: RecordStatus.RECEIVED,
              lastAssignedTo: oldAssigned,
              assignedTo: null,
              assignedDate: null,
              completedDate: null,
              resultReturnedDate: null,
              statusLogs: createStatusLog(record, RecordStatus.RECEIVED, 'Chuyển về bước Chờ giao việc để phân công thực hiện tiếp')
          };
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...record, ...updates });
          setToast({ 
              type: 'success', 
              message: `Hồ sơ ${record.code} đã chuyển về bước Chờ giao việc.${oldAssigned ? ' (Hệ thống đã ghi nhớ người thụ lý cũ)' : ''}` 
          });
          return;
      }

      if (record.status === RecordStatus.HANDOVER || record.status === RecordStatus.WITHDRAWN || record.resultReturnedDate) {
          return;
      }

      if (record.status === RecordStatus.RECEIVED) { 
          setAssignTargetRecords([record]); 
          setIsAssignModalOpen(true); 
          return; 
      }
      if (record.status === RecordStatus.ASSIGNED || record.status === RecordStatus.IN_PROGRESS) {
          if (isCapGiayRecord(record)) {
              const currentSubStep = record.capGiaySubStep || 'tham_dinh';
              let nextSubStep = '';
              if (currentSubStep === 'tiep_nhan' || currentSubStep === 'tiep_nhan_giao_viec') {
                  nextSubStep = 'tham_dinh';
              } else if (currentSubStep === 'tham_dinh' || currentSubStep === 'tham_tra') {
                  nextSubStep = isTaxDefaultRecordType(record.recordType) ? 'phieu_chuyen_thue' : 'in_hoan_thien';
              } else if (currentSubStep === 'phieu_chuyen_thue') {
                  nextSubStep = 'cho_tbt';
              } else if (currentSubStep === 'cho_tbt') {
                  nextSubStep = 'cho_gnt';
              } else if (currentSubStep === 'cho_gnt' || currentSubStep === 'cho_nop_thue' || currentSubStep === 'cho_giay_nop_tien') {
                  nextSubStep = 'in_hoan_thien';
              } else if (currentSubStep === 'in_hoan_thien' || currentSubStep === 'hoan_thien_trinh_duyet') {
                  setSubmitTargetRecords([record]);
                  setIsSubmitCheckModalOpen(true);
                  return;
              } else {
                  setSubmitTargetRecords([record]);
                  setIsSubmitCheckModalOpen(true);
                  return;
              }

              if (nextSubStep) {
                  const subStepLabel = getCapGiaySubStepLabel(nextSubStep);
                  const updates: Partial<RecordFile> = {
                      capGiaySubStep: nextSubStep,
                      statusLogs: createStatusLog(record, record.status, `Chuyển bước nhỏ: ${subStepLabel}`)
                  };

                  if (nextSubStep === 'in_hoan_thien' && (currentSubStep === 'cho_gnt' || currentSubStep === 'cho_nop_thue' || currentSubStep === 'cho_giay_nop_tien')) {
                      const nowStr = new Date().toISOString();
                      const todayStr = nowStr.split('T')[0];
                      const newDeadline = calculateDeadlineHelperByDays(5, todayStr, holidays || []);
                      updates.status = RecordStatus.RECEIVED;
                      updates.assignedTo = "";
                      updates.deadline = newDeadline;
                      updates.statusLogs = createStatusLog(record, record.status, 'Xác nhận đã nộp tiền thuế → Trả về bước giao việc (chờ phân công in & hoàn thiện, SLA 5 ngày)');
                  }

                  setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
                  await updateRecordApi({ ...record, ...updates });
                  setToast({ type: 'success', message: `Hồ sơ ${record.code} đã cập nhật sang bước: ${subStepLabel}` });
                  return;
              }
          }

          // Các loại không phải cấp giấy đi thẳng sang trình kiểm tra
          setSubmitTargetRecords([record]);
          setIsSubmitCheckModalOpen(true);
          return;
      }
      if (record.status === RecordStatus.PENDING_CHECK || (record.status as any) === RecordStatus.IN_PROGRESS) {
          // Đi thẳng sang trình ký (bỏ qua bước trung gian là đã kiểm tra)
          setSubmitTargetRecords([record]);
          setIsSubmitModalOpen(true);
          return;
      }
      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.PENDING_CHECK, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
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
      const recordsToExport = candidates.filter(r => r.status === RecordStatus.SIGNED || ((r.status === RecordStatus.REJECTED || r.status === RecordStatus.WITHDRAWN) && !r.exportBatch));
      if (recordsToExport.length === 0) return;
      const updatesToApply = recordsToExport.map(r => {
          const nextStatus = r.status === RecordStatus.WITHDRAWN ? RecordStatus.WITHDRAWN : r.status === RecordStatus.REJECTED ? RecordStatus.REJECTED : RecordStatus.HANDOVER;
          const statusLogs = createStatusLog(r, nextStatus, `Chốt xuất giao 1 cửa - ${batchNumber}`);
          return { ...r, exportBatch: batchNumber, exportDate: batchDate, status: nextStatus, completedDate: r.completedDate || nowStr, handoverWard: handoverWard || r.handoverWard, statusLogs };
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
              ...(isCapGiayRecord(r) ? { capGiaySubStep: 'giao_mot_cua' } : {}),
              statusLogs: createStatusLog(r, RecordStatus.SIGNED, 'Ký duyệt đợt')
          }));
          setRecords(prev => prev.map(r => {
              const updated = updatedTargets.find(p => p.id === r.id);
              return updated ? updated : r;
          }));
          await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
          setSelectedRecordIds(new Set());
          setToast({ type: 'success', message: `Đã chuyển ${pendingSign.length} hồ sơ sang "Đã ký".` });
      }
  };

  const handleExportReturnedList = () => {
      if (!canPerformAction) return;
      exportReturnedListToExcel(recordFilterProps.filteredRecords, recordFilterProps.filterFromDate, recordFilterProps.filterToDate, recordFilterProps.filterWard);
  };

  const handleOpenRejectReturnModal = useCallback((targets: RecordFile[]) => {
      setRejectReturnTargetRecords(targets);
      setIsRejectReturnStepModalOpen(true);
  }, []);

  const handleOpenExtendModal = useCallback((targets: RecordFile[]) => {
      setExtendTargetRecords(targets);
      setIsExtendModalOpen(true);
  }, []);

  const handleOpenSupplementModal = useCallback((targets: RecordFile | RecordFile[]) => {
      const list = Array.isArray(targets) ? targets : [targets];
      setSupplementTargetRecords(list);
      setIsSupplementModalOpen(true);
  }, []);

  const handleConfirmSupplement = useCallback(async (note: string) => {
      if (supplementTargetRecords.length === 0) return;
      const nowStr = new Date().toLocaleString('vi-VN');
      const userLabel = currentUser
        ? `${currentUser.name} (${currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Quản trị'})`
        : 'Hệ thống';

      const updatedTargets = supplementTargetRecords.map(r => {
        const supplementNote = `[Tiếp nhận bổ sung] Ghi chú: ${note.trim()} (Bởi: ${userLabel} lúc ${nowStr})`;
        const existingNotes = r.privateNotes || '';
        const updatedPrivateNotes = existingNotes ? `${existingNotes}\n${supplementNote}` : supplementNote;

        const targetStatus = r.assignedTo ? RecordStatus.IN_PROGRESS : RecordStatus.RECEIVED;

        return {
          ...r,
          status: targetStatus,
          privateNotes: updatedPrivateNotes,
          statusLogs: createStatusLog(r, targetStatus, `Tiếp nhận bổ sung: ${note.trim()}`)
        };
      });

      setRecords(prev => prev.map(r => {
          const found = updatedTargets.find(u => u.id === r.id);
          return found ? found : r;
      }));

      await Promise.all(updatedTargets.map(r => updateRecordApi(r)));

      setToast({ 
        type: 'success', 
        message: `Đã tiếp nhận bổ sung cho ${updatedTargets.length} hồ sơ thành công!` 
      });
  }, [supplementTargetRecords, currentUser]);

  const handleConfirmExtendDeadline = useCallback(async (extendDate: string, reason: string) => {
      if (extendTargetRecords.length === 0) return;
      const nowStr = new Date().toLocaleString('vi-VN');
      const userLabel = currentUser
        ? `${currentUser.name} (${currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Quản trị'})`
        : 'Hệ thống';

      const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return 'Chưa có';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? 'Chưa có' : d.toLocaleDateString('vi-VN');
      };

      const updatedTargets = extendTargetRecords.map(r => {
        const extensionNote = `[Gia hạn ngày hẹn] Hạn cũ: ${formatDate(r.deadline)} -> Hạn mới: ${formatDate(extendDate)}. Lý do: ${reason.trim()} (Bởi: ${userLabel} lúc ${nowStr})`;
        const existingNotes = r.privateNotes || '';
        const updatedPrivateNotes = existingNotes ? `${existingNotes}\n${extensionNote}` : extensionNote;

        return {
          ...r,
          deadline: extendDate,
          privateNotes: updatedPrivateNotes
        };
      });

      setRecords(prev => prev.map(r => {
          const found = updatedTargets.find(u => u.id === r.id);
          return found ? found : r;
      }));

      await Promise.all(updatedTargets.map(r => updateRecordApi(r)));

      setToast({ 
        type: 'success', 
        message: `Đã gia hạn ngày hẹn cho ${updatedTargets.length} hồ sơ thành công!` 
      });
  }, [extendTargetRecords, currentUser]);

  const handleMarkAsRejected = useCallback(() => {
      if (selectedRecordIds.size === 0) return;
      const validTargets = records.filter(r => 
          selectedRecordIds.has(r.id) && 
          r.status !== RecordStatus.HANDOVER && 
          r.status !== RecordStatus.RETURNED && 
          r.status !== RecordStatus.WITHDRAWN
      );
      if (validTargets.length === 0) {
          setToast({ type: 'error', message: 'Không có hồ sơ hợp lệ (ở các bước trước Giao 1 cửa) để thực hiện thao tác trả!' });
          return;
      }
      handleOpenRejectReturnModal(validTargets);
  }, [selectedRecordIds, records, handleOpenRejectReturnModal]);

  const handleHandOverRecords = useCallback(async (recordIds: string[]) => {
      if (recordIds.length === 0) return;
      const updates = recordIds.map(id => ({ id, isHandedOver: true }));
      setRecords(prev => prev.map(r => recordIds.includes(r.id) ? { ...r, isHandedOver: true } : r));
      await updateRecordsBatchById(updates);
      setToast({ type: 'success', message: `Đã tự động bàn giao ${recordIds.length} hồ sơ và đồng bộ dữ liệu!` });
  }, [setRecords]);

  const handleConfirmRejectReturnStep = useCallback(async (reason: string, returnDateStr: string, returnOption: 'REJECT' | 'PAUSE' | 'PREVIOUS_STEP' = 'PREVIOUS_STEP') => {
      if (rejectReturnTargetRecords.length === 0) return;
      const targetDateISO = returnDateStr ? new Date(returnDateStr).toISOString() : new Date().toISOString();
      const nowStr = targetDateISO;

      const updatedTargets = rejectReturnTargetRecords.map(r => {
          const oldAssigned = r.assignedTo || r.lastAssignedTo || null;

          if (returnOption === 'REJECT') {
              const internalLogNote = `[TRẢ HỦY - ${new Date(targetDateISO).toLocaleDateString('vi-VN')}] Lý do: ${reason}`;
              const existingNotes = r.privateNotes || '';
              const updatedPrivateNotes = existingNotes ? `${existingNotes}\n${internalLogNote}` : internalLogNote;
              return {
                  ...r,
                  status: RecordStatus.REJECTED,
                  completedDate: r.completedDate || nowStr,
                  lastAssignedTo: oldAssigned,
                  assignedTo: oldAssigned,
                  privateNotes: updatedPrivateNotes
              };
          } else if (returnOption === 'PAUSE') {
              const internalLogNote = `[TẠM DỪNG / CHỜ BỔ SUNG - ${new Date(targetDateISO).toLocaleDateString('vi-VN')}] Lý do: ${reason}`;
              const existingNotes = r.privateNotes || '';
              const updatedPrivateNotes = existingNotes ? `${existingNotes}\n${internalLogNote}` : internalLogNote;
              return {
                  ...r,
                  status: RecordStatus.PENDING_SUPPLEMENT, // Trạng thái Chờ bổ sung
                  lastAssignedTo: oldAssigned,
                  assignedTo: oldAssigned,
                  privateNotes: updatedPrivateNotes
              };
          } else {
              // PREVIOUS_STEP (Trả về / Sửa)
              const dateHistoryLines: string[] = [];
              if (r.pendingCheckDate) {
                  const pDate = new Date(r.pendingCheckDate);
                  if (!isNaN(pDate.getTime())) {
                      dateHistoryLines.push(`${pDate.toLocaleDateString('vi-VN')} trình kiểm tra`);
                  }
              }
              if (r.submissionDate) {
                  const sDate = new Date(r.submissionDate);
                  if (!isNaN(sDate.getTime())) {
                      dateHistoryLines.push(`${sDate.toLocaleDateString('vi-VN')} trình ký`);
                  }
              }

              let internalLogNote = `[TRẢ VỀ / SỬA - ${new Date(targetDateISO).toLocaleDateString('vi-VN')}]`;
              if (dateHistoryLines.length > 0) {
                  internalLogNote += `\n` + dateHistoryLines.join('\n');
              }
              internalLogNote += `\nlý do trả: ${reason}`;

              const existingNotes = r.privateNotes || '';
              const updatedPrivateNotes = existingNotes ? `${existingNotes}\n${internalLogNote}` : internalLogNote;

              return {
                  ...r,
                  status: RecordStatus.IN_PROGRESS, // Chuyển về Đang thực hiện
                  assignedTo: oldAssigned,         // Giữ cán bộ thụ lý
                  lastAssignedTo: oldAssigned,
                  // Reset ngày tháng các bước để làm lại từ đầu
                  pendingCheckDate: null,
                  submissionDate: null,
                  checkedDate: null,
                  approvalDate: null,
                  completedDate: null,
                  completedWorkDate: null,
                  privateNotes: updatedPrivateNotes
              };
          }
      });

      setRecords(prev => prev.map(r => {
          const found = updatedTargets.find(u => u.id === r.id);
          return found ? found : r;
      }));

      await Promise.all(updatedTargets.map(u => updateRecordApi(u)));
      setIsRejectReturnStepModalOpen(false);
      setRejectReturnTargetRecords([]);
      setSelectedRecordIds(new Set());
      const msg = returnOption === 'REJECT' 
          ? `Đã trả hủy ${updatedTargets.length} hồ sơ thành công!` 
          : returnOption === 'PAUSE' 
          ? `Đã chuyển ${updatedTargets.length} hồ sơ sang trạng thái Chờ bổ sung!` 
          : `Đã trả ${updatedTargets.length} hồ sơ về cho cán bộ thụ lý sửa chữa hoàn thiện!`;
      setToast({ type: 'success', message: msg });
  }, [rejectReturnTargetRecords]);

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
            isExtendModalOpen={isExtendModalOpen} setIsExtendModalOpen={setIsExtendModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            extendTargetRecord={extendTargetRecord} setExtendTargetRecord={setExtendTargetRecord}
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
            rolePermissions={rolePermissions}
            departmentPermissions={departmentPermissions}
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
            setIsExtendModalOpen={setIsExtendModalOpen}
            setExtendTargetRecord={setExtendTargetRecord}
            handleOpenExtendModal={handleOpenExtendModal}
            advanceStatus={advanceStatus}
            handleOpenReturnModal={handleOpenReturnModal}
            handleOpenRejectReturnModal={handleOpenRejectReturnModal}
            handleOpenSupplementModal={handleOpenSupplementModal}
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
            isSupplementModalOpen={isSupplementModalOpen} setIsSupplementModalOpen={setIsSupplementModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            extendTargetRecord={extendTargetRecord} setExtendTargetRecord={setExtendTargetRecord}
            extendTargetRecords={extendTargetRecords}
            supplementTargetRecords={supplementTargetRecords}
            assignTargetRecords={assignTargetRecords}
            rejectReturnTargetRecords={rejectReturnTargetRecords}
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
            onConfirmExtendDeadline={handleConfirmExtendDeadline}
            onConfirmSupplement={handleConfirmSupplement}
            onOpenRejectReturnModal={(r) => handleOpenRejectReturnModal([r])}
            onOpenExtendModal={(r) => handleOpenExtendModal([r])}
            onOpenSupplementModal={(r) => handleOpenSupplementModal([r])}

            employees={employees}
            users={users}
            currentUser={currentUser}
            wards={wards}
            holidays={holidays}
            rolePermissions={rolePermissions}
            departmentPermissions={departmentPermissions}
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
