import React from "react";
import { isViewAllowedForUser } from "../config/roleConfig";
import {
  RecordFile,
  Employee,
  User,
  UserRole,
  Holiday,
  RolePermissions,
  DepartmentPermissions,
  DEFAULT_ROLE_PERMISSIONS,
} from "../types";
import { STATUS_LABELS, SELECTABLE_STATUSES } from "../constants";
import { COLUMN_DEFS, removeVietnameseTones, matchDepartmentKey } from "../utils/appHelpers";

// Components
import DashboardView from "./DashboardView";
import PersonalProfile from "./PersonalProfile";
import ReceiveRecord from "./ReceiveRecord";
import ReceiveContract from "./ReceiveContract";
import ExcerptManagement from "./ExcerptManagement";
import UtilitiesView from "./UtilitiesView";
import AccountSettingsView from "./AccountSettingsView";
import ReportSection from "./ReportSection";
import RecordRow from "./RecordRow";
import WorkScheduleView from "./WorkScheduleView";
import SaoLucView from "./archive/SaoLucView";
import CongVanView from "./archive/CongVanView";
import RegistrationRecords from "./RegistrationRecords";
import SystemView from "./SystemView";
import BarcodeGeneratorView from "./BarcodeGeneratorView";

const formatDateDDMMYYYY = (isoStr: string) => {
  if (!isoStr) return "";
  const dateOnly = isoStr.includes("T") ? isoStr.split("T")[0] : isoStr;
  const parts = dateOnly.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoStr;
};

// Icons
import {
  Search,
  ListChecks,
  History,
  FileCheck,
  Calendar,
  X,
  CalendarRange,
  MapPin,
  Filter,
  User as UserIcon,
  AlertTriangle,
  ShieldAlert,
  Clock,
  SlidersHorizontal,
  Plus,
  FileSpreadsheet,
  Layers,
  CheckCircle,
  CheckCircle2,
  FileSignature,
  UserPlus,
  FileOutput,
  CheckSquare,
  Square,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  FileText,
  UserPlus as UserPlusIcon,
  ClipboardList,
  Send,
  RefreshCw,
  Undo2,
  CalendarClock,
} from "lucide-react";

interface AppRoutesProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  receiveRecordResetKey?: number;
  currentUser: User;
  records: RecordFile[];
  employees: Employee[];
  users: User[];
  wards: string[];
  holidays: Holiday[];
  rolePermissions: RolePermissions;
  departmentPermissions: DepartmentPermissions;

  // States & Setters passed from App
  setUnreadMessages: (n: number) => void;
  notificationEnabled: boolean;
  setNotificationEnabled: (enabled: boolean) => void;
  recordToLiquidate: RecordFile | null;
  setRecordToLiquidate: (r: RecordFile | null) => void;
  recordToCreateContract: RecordFile | null;
  setRecordToCreateContract: (r: RecordFile | null) => void;
  recordForMapCorrection: RecordFile | null;

  // Handlers
  handleViewRecord: (r: RecordFile) => void;
  handleMapCorrectionRequest: (r: RecordFile) => void;
  handleAddOrUpdateRecord: (r: RecordFile) => Promise<RecordFile | null>;
  handleDeleteRecord: (id: string) => Promise<boolean>;
  handleHandOverRecords?: (recordIds: string[]) => Promise<void>;
  handleUpdateUser: (u: User, isUpdate: boolean) => void;
  handleDeleteUser: (username: string) => void;
  handleSaveEmployee: (emp: Employee) => void;
  handleDeleteEmployee: (id: string) => void;
  handleDeleteAllData: () => Promise<boolean>;
  onRefreshData: () => void;
  setWards: React.Dispatch<React.SetStateAction<string[]>>;
  onResetWards: () => void;
  handleQuickUpdate: (
    id: string,
    field: keyof RecordFile,
    value: string,
  ) => void;
  handleUpdateCurrentAccount: (data: any) => Promise<boolean>;

  // Report Props
  globalReportContent: string;
  isGeneratingReport: boolean;
  handleGlobalGenerateReport: (
    fromDate: string,
    toDate: string,
    title?: string,
    data?: RecordFile[],
  ) => void;
  handleExportReportExcel: (
    from: string,
    to: string,
    ward: string,
    title?: string,
    data?: RecordFile[],
  ) => void;

  // List Logic Props
  filteredRecords: RecordFile[];
  paginatedRecords: RecordFile[];
  totalPages: number;
  warningCount: { overdue: number; approaching: number };
  searchTerm: string;
  setSearchTerm: (s: string) => void;

  filterDate: string;
  setFilterDate: (s: string) => void;
  filterSpecificDate: string;
  setFilterSpecificDate: (s: string) => void;
  filterAssignedDate: string;
  setFilterAssignedDate: (s: string) => void;
  filterFromDate: string;
  setFilterFromDate: (s: string) => void;
  filterToDate: string;
  setFilterToDate: (s: string) => void;
  filterAssignedFromDate?: string;
  setFilterAssignedFromDate?: (s: string) => void;
  filterAssignedToDate?: string;
  setFilterAssignedToDate?: (s: string) => void;
  showAdvancedDateFilter: boolean;
  setShowAdvancedDateFilter: (b: boolean) => void;

  filterWard: string;
  setFilterWard: (s: string) => void;
  filterRecordType: string;
  setFilterRecordType: (s: string) => void;
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  filterEmployee: string;
  setFilterEmployee: (s: string) => void;
  warningFilter: string;
  setWarningFilter: React.Dispatch<React.SetStateAction<any>>;
  handoverTab: string;
  setHandoverTab: React.Dispatch<React.SetStateAction<any>>;

  sortConfig: any;
  setSortConfig: (c: any) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;

  selectedRecordIds: Set<string>;
  setSelectedRecordIds?: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelectAll: () => void;
  toggleSelectRecord: (id: string) => void;
  visibleColumns: Record<string, boolean>;
  setVisibleColumns: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;

  // Modal Openers
  setIsModalOpen: (b: boolean) => void;
  setEditingRecord: (r: RecordFile | null) => void;
  handleMarkAsRejected: () => void;
  setIsImportModalOpen: (b: boolean) => void;
  setImportModalMode?: (mode: 'create' | 'update') => void;
  setIsBulkUpdateModalOpen: (b: boolean) => void;
  setIsAddToBatchModalOpen: (b: boolean) => void;
  setIsReturnHandoverModalOpen?: (b: boolean) => void;
  handleExportReturnedList: () => void;
  handleConfirmSignBatch: () => void;
  setAssignTargetRecords: (r: RecordFile[]) => void;
  setIsAssignModalOpen: (b: boolean) => void;
  setSubmitTargetRecords: (r: RecordFile[]) => void;
  setIsSubmitModalOpen: (b: boolean) => void;
  setIsSubmitCheckModalOpen: (b: boolean) => void; // MỚI: Trình kiểm tra
  setExportModalType: (t: "handover" | "check_list") => void;
  setIsExportModalOpen: (b: boolean) => void;
  setDeletingRecord: (r: RecordFile | null) => void;
  setIsDeleteModalOpen: (b: boolean) => void;
  isDiagnosticModalOpen?: boolean;
  setIsDiagnosticModalOpen?: (b: boolean) => void;
  advanceStatus: (r: RecordFile) => void;
  handleOpenReturnModal: (r: RecordFile) => void;
  columnOrder: string[];
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;
  onBulkUpdate?: (field: keyof RecordFile, value: any, customDate?: string, targetRecordIds?: string[]) => Promise<void>;
  handleOpenRejectReturnModal?: (records: RecordFile[]) => void;
  handleOpenExtendModal?: (records: RecordFile[]) => void;
}

const AppRoutes: React.FC<AppRoutesProps> = (props) => {
  // Simplify destructuring to avoid TS errors with complex objects
  const {
    currentView,
    currentUser,
    records,
    employees,
    users,
    wards,
    holidays,
    rolePermissions,
    departmentPermissions,
  } = props;

  // Kiểm tra quyền truy cập View chủ động (RBAC)
  const isAllowed = isViewAllowedForUser(currentUser, employees || [], currentView, rolePermissions, departmentPermissions);
  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm m-6">
        <span className="text-4xl mb-4">🔒</span>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Quyền truy cập bị hạn chế</h2>
        <p className="text-slate-500 text-sm max-w-md leading-relaxed mb-6">
          Tài khoản của bạn ({currentUser.name} - {currentUser.role}) không có quyền truy cập phân hệ này. Vui lòng liên hệ Quản trị viên nếu đây là một sự nhầm lẫn.
        </p>
        <button 
          onClick={() => props.setCurrentView("dashboard")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 text-sm shadow-md"
        >
          Quay lại Trang chủ
        </button>
      </div>
    );
  }

  // Tự động bỏ chọn hồ sơ khi chuyển tab bàn giao
  React.useEffect(() => {
    props.setSelectedRecordIds?.(new Set());
  }, [props.handoverTab]);

  const hasPermission = (permissionId: string) => {
    if (currentUser.role === UserRole.ADMIN) return true;

    const rolePerms = (rolePermissions && rolePermissions[currentUser.role]) || DEFAULT_ROLE_PERMISSIONS[currentUser.role] || [];
    return rolePerms.includes("*") || rolePerms.includes(permissionId);
  };

  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubadmin = currentUser.role === UserRole.SUBADMIN;

  // Xác định xem user có thuộc Ban giám đốc không
  const isDirector = React.useMemo(() => {
    if (!currentUser.employeeId) return false;
    const emp = employees.find((e) => e.id === currentUser.employeeId);
    return emp
      ? emp.department?.trim().toLowerCase() === "ban giám đốc" ||
          emp.department?.trim().toLowerCase() === "ban lãnh đạo"
      : false;
  }, [currentUser.employeeId, employees]);

  // canPerformAction is kept for backward compatibility, but we should use hasPermission where possible
  const canPerformAction =
    isAdmin ||
    isSubadmin ||
    currentUser.role === UserRole.TEAM_LEADER ||
    currentUser.role === UserRole.ONEDOOR ||
    isDirector;

  const [showColumnSelector, setShowColumnSelector] = React.useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = React.useState(false);
  const filterPopoverRef = React.useRef<HTMLDivElement>(null);
  const [receiveRecordSubTab, setReceiveRecordSubTab] = React.useState<'create' | 'list' | 'bulk' | 'update' | 'vphc'>('create');
  const addMenuRef = React.useRef<HTMLDivElement>(null);
  const ignoreSubTabResetRef = React.useRef(false);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setIsFilterPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (props.filterFromDate || props.filterToDate) count++;
    if (props.filterAssignedFromDate || props.filterAssignedToDate) count++;
    if (props.filterWard && props.filterWard !== 'all') count++;
    if (props.filterRecordType && props.filterRecordType !== 'all') count++;
    if (props.filterStatus && props.filterStatus !== 'all') count++;
    if (props.filterEmployee && props.filterEmployee !== 'all') count++;
    return count;
  }, [props.filterFromDate, props.filterToDate, props.filterAssignedFromDate, props.filterAssignedToDate, props.filterWard, props.filterRecordType, props.filterStatus, props.filterEmployee]);

  const navigateToReceiveRecordSubTab = (subTab: 'create' | 'list' | 'bulk' | 'update' | 'vphc') => {
    ignoreSubTabResetRef.current = true;
    setReceiveRecordSubTab(subTab);
    props.setCurrentView('receive_record');
  };

  // Mặc định mở tab 'create' (Nhập mới) khi click trực tiếp vào tab Hồ sơ chính, trừ khi điều hướng từ lối tắt cụ thể
  React.useEffect(() => {
    if (ignoreSubTabResetRef.current) {
      ignoreSubTabResetRef.current = false;
      return;
    }
    setReceiveRecordSubTab('create');
  }, [props.receiveRecordResetKey, props.currentView]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const orderedColumnDefs = React.useMemo(() => {
    return [...COLUMN_DEFS].sort((a, b) => {
      const indexA = (props.columnOrder || []).indexOf(a.key);
      const indexB = (props.columnOrder || []).indexOf(b.key);
      return (indexA !== -1 ? indexA : 999) - (indexB !== -1 ? indexB : 999);
    });
  }, [props.columnOrder]);

  const handleMoveColumn = (key: string, direction: -1 | 1) => {
    const newOrder = [...(props.columnOrder || COLUMN_DEFS.map(c => c.key))];
    const index = newOrder.indexOf(key);
    if (index === -1) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newOrder.length) return;
    
    // Swap
    const temp = newOrder[index];
    newOrder[index] = newOrder[newIndex];
    newOrder[newIndex] = temp;
    
    props.setColumnOrder(newOrder);
  };

  // --- RENDER RECORD LIST (Extracted to be used in switch) ---
  const renderRecordList = () => {
    // Kiểm tra xem có đang ở chế độ xem Hồ sơ đo đạc (bao gồm tất cả các tab con)
    const isMeasurementView = [
      "all_records",
      "assign_tasks",
      "completed_list",
      "pending_check_list",
      "check_list",
      "handover_list",
      "director_completed",
    ].includes(currentView);
    const isOtherView = [
      "other_records",
      "other_assign_tasks",
      "other_check_list",
      "other_handover_list",
      "other_director_completed",
    ].includes(currentView);
    const isArchiveMeasurementView = [
      "archive_records",
      "archive_assign_tasks",
      "archive_completed_list",
      "archive_pending_check_list",
      "archive_check_list",
      "archive_handover_list",
      "archive_director_completed",
    ].includes(currentView);

    const isSpecializedTab = !["all_records", "other_records", "archive_records"].includes(currentView);

    let title = "Danh sách Hồ sơ";
    if (
      currentView === "check_list" ||
      currentView === "other_check_list" ||
      currentView === "archive_check_list" ||
      currentView === "archive_check_list"
    )
      title = isDirector ? "Danh sách Chờ ký" : "Danh sách Trình Ký";
    else if (
      currentView === "director_completed" ||
      currentView === "other_director_completed" ||
      currentView === "archive_director_completed"
    )
      title = "Danh sách Hoàn thành";
    else if (currentView === "handover_list")
      title = "Danh sách Giao 1 cửa (Hồ sơ đo đạc)";
    else if (currentView === "archive_handover_list")
      title = "Danh sách Giao 1 cửa (Hồ sơ lưu trữ)";
    else if (currentView === "other_handover_list")
      title = "Danh sách Giao 1 cửa (Hồ sơ khác)";
    else if (
      currentView === "assign_tasks" ||
      currentView === "other_assign_tasks" ||
      currentView === "archive_assign_tasks" ||
      currentView === "archive_assign_tasks"
    )
      title = "Hồ sơ chưa giao";
    else if (
      currentView === "completed_list" ||
      currentView === "archive_completed_list"
    )
      title = "Hồ sơ đang thực hiện";
    else if (
      currentView === "pending_check_list" ||
      currentView === "archive_pending_check_list"
    )
      title = "Hồ sơ chờ kiểm tra";
    else if (currentView === "all_records") title = "Hồ sơ đo đạc";
    else if (currentView === "other_records") title = "Hồ sơ khác";
    else if (currentView === "archive_records")
      title = "Lưu trữ (Cung cấp TLĐĐ)";
    else if (currentView === "archive_completed_list") title = "Đang thực hiện";
    else if (currentView === "archive_pending_check_list")
      title = "Chờ kiểm tra";

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
          <>
            {/* SUB-HEADER TABS FOR MEASUREMENT RECORDS */}
            {isMeasurementView && (
          <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
            {!isDirector && (
              <>
                {isViewAllowedForUser(currentUser, employees, "all_records", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("all_records")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "all_records" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <FileText size={16} /> Tất cả hồ sơ
                  </button>
                )}

                {isViewAllowedForUser(currentUser, employees, "assign_tasks", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("assign_tasks")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "assign_tasks" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <UserPlusIcon size={16} /> Chưa giao
                  </button>
                )}

                {isViewAllowedForUser(currentUser, employees, "completed_list", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("completed_list")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "completed_list" || currentView === "archive_completed_list" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <CheckSquare size={16} /> Đang thực hiện
                  </button>
                )}

                {isViewAllowedForUser(currentUser, employees, "pending_check_list", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("pending_check_list")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "pending_check_list" ? "border-orange-600 text-orange-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <ClipboardList size={16} /> Kiểm tra
                  </button>
                )}
              </>
            )}

            {isViewAllowedForUser(currentUser, employees, "check_list", rolePermissions, departmentPermissions) && (
              <button
                onClick={() => props.setCurrentView("check_list")}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "check_list" ? "border-purple-600 text-purple-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                <ClipboardList size={16} /> {isDirector ? "Chờ ký" : "Trình ký"}
              </button>
            )}

            {isDirector && isViewAllowedForUser(currentUser, employees, "director_completed", rolePermissions, departmentPermissions) && (
              <button
                onClick={() => props.setCurrentView("director_completed")}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "director_completed" ? "border-green-600 text-green-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                <CheckSquare size={16} /> Hoàn thành
              </button>
            )}

            {!isDirector && isViewAllowedForUser(currentUser, employees, "handover_list", rolePermissions, departmentPermissions) && (
                <button
                  onClick={() => props.setCurrentView("handover_list")}
                  className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "handover_list" ? "border-green-600 text-green-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  <Send size={16} /> Giao 1 cửa
                </button>
              )}
          </div>
        )}

        {/* SUB-HEADER TABS FOR ARCHIVE RECORDS */}
        {isArchiveMeasurementView && (
          <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
            {!isDirector && (
              <>
                {isViewAllowedForUser(currentUser, employees, "archive_records", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("archive_records")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "archive_records" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <FileText size={16} /> Tất cả hồ sơ
                  </button>
                )}

                {isViewAllowedForUser(currentUser, employees, "archive_assign_tasks", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("archive_assign_tasks")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "archive_assign_tasks" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <UserPlusIcon size={16} /> Chưa giao
                  </button>
                )}

                {isViewAllowedForUser(currentUser, employees, "archive_completed_list", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("archive_completed_list")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "archive_completed_list" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <CheckSquare size={16} /> Đang thực hiện
                  </button>
                )}

                {isViewAllowedForUser(currentUser, employees, "archive_pending_check_list", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("archive_pending_check_list")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "archive_pending_check_list" ? "border-orange-600 text-orange-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <ClipboardList size={16} /> Kiểm tra
                  </button>
                )}
              </>
            )}

            {isViewAllowedForUser(currentUser, employees, "archive_check_list", rolePermissions, departmentPermissions) && (
              <button
                onClick={() => props.setCurrentView("archive_check_list")}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "archive_check_list" ? "border-purple-600 text-purple-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                <ClipboardList size={16} /> {isDirector ? "Chờ ký" : "Trình ký"}
              </button>
            )}

            {isDirector && isViewAllowedForUser(currentUser, employees, "archive_director_completed", rolePermissions, departmentPermissions) && (
              <button
                onClick={() =>
                  props.setCurrentView("archive_director_completed")
                }
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "archive_director_completed" ? "border-green-600 text-green-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                <CheckSquare size={16} /> Hoàn thành
              </button>
            )}

            {!isDirector && isViewAllowedForUser(currentUser, employees, "archive_handover_list", rolePermissions, departmentPermissions) && (
                <button
                  onClick={() => props.setCurrentView("archive_handover_list")}
                  className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "archive_handover_list" ? "border-green-600 text-green-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  <Send size={16} /> Giao 1 cửa
                </button>
              )}
          </div>
        )}

        {/* SUB-HEADER TABS FOR OTHER RECORDS */}
        {isOtherView && (
          <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
            {!isDirector && (
              <>
                {isViewAllowedForUser(currentUser, employees, "other_records", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("other_records")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "other_records" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <FileText size={16} /> Tất cả hồ sơ
                  </button>
                )}

                {isViewAllowedForUser(currentUser, employees, "other_assign_tasks", rolePermissions, departmentPermissions) && (
                  <button
                    onClick={() => props.setCurrentView("other_assign_tasks")}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "other_assign_tasks" ? "border-blue-600 text-blue-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <UserPlusIcon size={16} /> Chưa giao
                  </button>
                )}
              </>
            )}

            {isViewAllowedForUser(currentUser, employees, "other_check_list", rolePermissions, departmentPermissions) && (
              <button
                onClick={() => props.setCurrentView("other_check_list")}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "other_check_list" ? "border-purple-600 text-purple-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                <ClipboardList size={16} /> {isDirector ? "Chờ ký" : "Trình ký"}
              </button>
            )}

            {isDirector && isViewAllowedForUser(currentUser, employees, "other_director_completed", rolePermissions, departmentPermissions) && (
              <button
                onClick={() => props.setCurrentView("other_director_completed")}
                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "other_director_completed" ? "border-green-600 text-green-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                <CheckSquare size={16} /> Hoàn thành
              </button>
            )}

            {!isDirector && isViewAllowedForUser(currentUser, employees, "other_handover_list", rolePermissions, departmentPermissions) && (
                <button
                  onClick={() => props.setCurrentView("other_handover_list")}
                  className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === "other_handover_list" ? "border-green-600 text-green-700 bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  <Send size={16} /> Giao 1 cửa
                </button>
              )}
          </div>
        )}

        <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {title}
              {!canPerformAction && (
                <span className="text-xs font-normal text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full border">
                  Chỉ xem
                </span>
              )}
            </h2>
            <div className="relative flex-1 sm:w-64 max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={props.searchTerm}
                onChange={(e) => props.setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg relative">
            {(currentView === "handover_list" ||
              currentView === "other_handover_list" ||
              currentView === "archive_handover_list") && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                  <button
                    onClick={() => {
                      props.setHandoverTab("today");
                      props.setSelectedRecordIds?.(new Set());
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${props.handoverTab === "today" ? "bg-green-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    <ListChecks size={16} /> Chờ bàn giao
                  </button>
                  <button
                    onClick={() => {
                      props.setHandoverTab("history");
                      props.setSelectedRecordIds?.(new Set());
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${props.handoverTab === "history" ? "bg-green-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    <History size={16} /> Chờ trả kết quả
                  </button>
                  <button
                    onClick={() => {
                      props.setHandoverTab("returned");
                      props.setSelectedRecordIds?.(new Set());
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${props.handoverTab === "returned" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    <FileCheck size={16} /> Đã trả kết quả
                  </button>
                </div>

                {/* Chốt DS (khi ở tab today - Chờ bàn giao và có chọn hồ sơ) */}
                {props.handoverTab === "today" && props.selectedRecordIds.size > 0 && (
                  <button
                    onClick={() => props.setIsAddToBatchModalOpen(true)}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm transition-all animate-pulse cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle size={16} /> Chốt DS ({props.selectedRecordIds.size})
                  </button>
                )}

                {/* Chốt HS lưu (khi ở tab returned - Đã trả kết quả và có chọn hồ sơ) */}
                {props.handoverTab === "returned" && props.selectedRecordIds.size > 0 && (
                  <button
                    onClick={() => props.setIsReturnHandoverModalOpen?.(true)}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-emerald-700 text-sm font-bold shadow-sm transition-all cursor-pointer animate-pulse whitespace-nowrap"
                    title="Chốt danh sách hồ sơ lưu tại Đã trả kết quả"
                  >
                    <Send size={16} /> Chốt HS lưu ({props.selectedRecordIds.size})
                  </button>
                )}
              </div>
            )}

            {currentView !== "handover_list" &&
              currentView !== "other_handover_list" &&
              currentView !== "archive_handover_list" && (
                <div className="relative inline-block" ref={filterPopoverRef}>
                  <button
                    onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm ${
                      activeFilterCount > 0
                        ? "bg-blue-700 text-white ring-2 ring-blue-300"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                    title="Mở bộ lọc tìm kiếm"
                  >
                    <Filter size={16} />
                    <span>Lọc</span>
                    {activeFilterCount > 0 && (
                      <span className="bg-red-500 text-white text-[11px] px-1.5 py-0.2 rounded-full font-extrabold">
                        {activeFilterCount}
                      </span>
                    )}
                    {isFilterPopoverOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {/* POPOVER DROPDOWN CARD */}
                  {isFilterPopoverOpen && (
                    <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-fade-in text-gray-800">
                      {/* Popover Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                        <div className="flex items-center gap-2 font-bold text-blue-700 text-base">
                          <Filter size={18} />
                          <span>Bộ lọc tìm kiếm</span>
                        </div>
                        <button
                          onClick={() => setIsFilterPopoverOpen(false)}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
                        {/* 1. Xã / Phường */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                            <MapPin size={14} className="text-gray-500" />
                            <span>Địa danh (Xã/Phường):</span>
                          </label>
                          <select
                            value={props.filterWard}
                            onChange={(e) => props.setFilterWard(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="all">Tất cả Xã/Phường</option>
                            {wards.map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Thời gian nhận hồ sơ */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                            <Calendar size={14} className="text-gray-500" />
                            <span>Thời gian nhận hồ sơ:</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Từ ngày</span>
                              <input
                                type="date"
                                value={props.filterFromDate}
                                onChange={(e) => props.setFilterFromDate(e.target.value)}
                                className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Đến ngày</span>
                              <input
                                type="date"
                                value={props.filterToDate}
                                onChange={(e) => props.setFilterToDate(e.target.value)}
                                className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 3. Thời gian giao NV */}
                        {(currentView === "all_records" || currentView === "other_records" || currentView === "archive_records") && (
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                              <Calendar size={14} className="text-gray-500" />
                              <span>Thời gian giao NV:</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Từ ngày</span>
                                <input
                                  type="date"
                                  value={props.filterAssignedFromDate || ""}
                                  onChange={(e) => props.setFilterAssignedFromDate && props.setFilterAssignedFromDate(e.target.value)}
                                  className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Đến ngày</span>
                                <input
                                  type="date"
                                  value={props.filterAssignedToDate || ""}
                                  onChange={(e) => props.setFilterAssignedToDate && props.setFilterAssignedToDate(e.target.value)}
                                  className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 4. Loại hồ sơ */}
                        {isMeasurementView && (
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                              <Filter size={14} className="text-gray-500" />
                              <span>Loại hồ sơ Đo đạc:</span>
                            </label>
                            <select
                              value={props.filterRecordType}
                              onChange={(e) => props.setFilterRecordType(e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="all">Tất cả loại HS</option>
                              <option value="2.1 Trích lục">2.1 Trích lục</option>
                              <option value="2.2 Trích đo">2.2 Trích đo</option>
                              <option value="2.3 Cập nhật số thửa">2.3 Cập nhật số thửa</option>
                              <option value="2.4 Trích đo Cắm mốc">2.4 Trích đo Cắm mốc</option>
                              <option value="2.5 Trích đo Tách - Hợp thửa">2.5 Trích đo Tách - Hợp thửa</option>
                            </select>
                          </div>
                        )}

                        {isArchiveMeasurementView && (
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                              <Filter size={14} className="text-gray-500" />
                              <span>Loại hồ sơ Lưu trữ:</span>
                            </label>
                            <select
                              value={props.filterRecordType}
                              onChange={(e) => props.setFilterRecordType(e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="all">Tất cả loại HS</option>
                              <option value="1.1 Sao lục">1.1 Sao lục</option>
                              <option value="1.2 Công văn">1.2 Công văn</option>
                            </select>
                          </div>
                        )}

                        {/* 5. Trạng thái hồ sơ */}
                        {(currentView === "all_records" || currentView === "other_records" || currentView === "archive_records") && (
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                              <SlidersHorizontal size={14} className="text-gray-500" />
                              <span>Trạng thái hồ sơ:</span>
                            </label>
                            <select
                              value={props.filterStatus}
                              onChange={(e) => props.setFilterStatus(e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="all">Mọi trạng thái</option>
                              {SELECTABLE_STATUSES.map((item) => (
                                <option key={item.key} value={item.key}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* 6. Cán bộ xử lý */}
                        {canPerformAction && (currentView === "all_records" || currentView === "other_records" || currentView === "archive_records") && (
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                              <UserIcon size={14} className="text-gray-500" />
                              <span>Cán bộ xử lý:</span>
                            </label>
                            <select
                              value={props.filterEmployee}
                              onChange={(e) => props.setFilterEmployee(e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="all">Tất cả cán bộ</option>
                              <option value="unassigned">Chưa giao</option>
                              {employees
                                .filter((emp) => {
                                  const d = removeVietnameseTones((emp.department || "").toLowerCase());
                                  if (isArchiveMeasurementView) return d.includes("luu tru");
                                  if (isMeasurementView)
                                    return (
                                      d.includes("do dac") ||
                                      d.includes("ky thuat") ||
                                      d.includes("to do") ||
                                      d.includes("dia chinh") ||
                                      d.includes("noi nghiep") ||
                                      d.includes("ngoai nghiep")
                                    );
                                  return true;
                                })
                                .map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}

                        {/* 7. Reset filters button */}
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              props.setFilterFromDate("");
                              props.setFilterToDate("");
                              if (props.setFilterAssignedFromDate) props.setFilterAssignedFromDate("");
                              if (props.setFilterAssignedToDate) props.setFilterAssignedToDate("");
                              props.setFilterWard("all");
                              props.setFilterRecordType("all");
                              props.setFilterStatus("all");
                              props.setFilterEmployee("all");
                            }}
                            className="w-full py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <RefreshCw size={14} /> Xóa tất cả bộ lọc
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            {(currentView === "all_records" ||
              currentView === "other_records" ||
              currentView === "archive_records") && (
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      props.setWarningFilter((prev: any) =>
                        prev === "overdue" ? "none" : "overdue",
                      )
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${props.warningFilter === "overdue" ? "bg-red-600 text-white" : "bg-white text-red-600"}`}
                  >
                    <AlertTriangle size={16} /> {props.warningCount.overdue}
                  </button>
                  <button
                    onClick={() =>
                      props.setWarningFilter((prev: any) =>
                        prev === "approaching" ? "none" : "approaching",
                      )
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${props.warningFilter === "approaching" ? "bg-orange-500 text-white" : "bg-white text-orange-600"}`}
                  >
                    <Clock size={16} /> {props.warningCount.approaching}
                  </button>
                </div>
              )}

            {canPerformAction && !["handover_list", "other_handover_list", "archive_handover_list"].includes(currentView) && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="h-6 w-px bg-gray-300 mx-1"></div>
                <div className="relative inline-block text-left" ref={addMenuRef}>
                  <button
                    onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-bold text-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                    title="Thêm hồ sơ hoặc nhập từ Excel"
                  >
                    <Plus size={16} />
                    <span>Nhập mới</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isAddMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isAddMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100">
                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          props.setIsModalOpen(true);
                          props.setEditingRecord(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Plus size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">Nhập hồ sơ mới</div>
                          <div className="text-[11px] text-slate-500">Tạo thủ công một hồ sơ</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          navigateToReceiveRecordSubTab('bulk');
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2.5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <FileSpreadsheet size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">Tiếp nhận hàng loạt</div>
                          <div className="text-[11px] text-slate-500">Nhập danh sách từ Excel</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          if (props.setImportModalMode) props.setImportModalMode('update');
                          props.setIsImportModalOpen(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2.5 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <RefreshCw size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">Cập nhật thông tin</div>
                          <div className="text-[11px] text-slate-500">Đổi trạng thái, cán bộ, hạn trả...</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Các nút thao tác theo lô chính đặt cạnh Nhập mới */}
                {props.selectedRecordIds.size > 0 && (
                  <>
                    {/* Bulk Assign (Giao việc) */}
                    {(currentView === "assign_tasks" ||
                      currentView === "other_assign_tasks" ||
                      currentView === "archive_assign_tasks") &&
                      (hasPermission('BTN_ASSIGN_STAFF') || hasPermission('ASSIGN_RECORDS')) && (
                        <button
                          onClick={() => {
                            const targets = records.filter((r) =>
                              props.selectedRecordIds.has(r.id),
                            );
                            props.setAssignTargetRecords(targets);
                            props.setIsAssignModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm transition-all animate-pulse cursor-pointer whitespace-nowrap"
                        >
                          <UserPlus size={16} /> Giao việc ({props.selectedRecordIds.size})
                        </button>
                      )}

                    {/* Bulk Approve / Sign (Ký Duyệt) */}
                    {(currentView === "check_list" ||
                      currentView === "other_check_list" ||
                      currentView === "archive_check_list") &&
                      (hasPermission('BTN_APPROVE_SIGN') || hasPermission('BTN_SUBMIT_SIGN') || hasPermission('SIGN_RECORDS')) && (
                        <button
                          onClick={props.handleConfirmSignBatch}
                          className="flex items-center gap-1.5 bg-purple-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-purple-700 text-sm font-bold shadow-sm transition-all animate-pulse cursor-pointer whitespace-nowrap"
                        >
                          <FileSignature size={16} /> Ký Duyệt ({props.selectedRecordIds.size})
                        </button>
                      )}

                    {/* Bulk Submit Check (Trình Kiểm Tra) */}
                    {(hasPermission('BTN_SUBMIT_CHECK') || hasPermission('BTN_SUBMIT_SIGN')) &&
                      (currentView === "completed_list") && (
                        <button
                          onClick={() => {
                            const targets = records.filter((r) =>
                              props.selectedRecordIds.has(r.id),
                            );
                            props.setSubmitTargetRecords(targets);
                            props.setIsSubmitCheckModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 bg-orange-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-orange-700 text-sm font-bold shadow-sm transition-all animate-pulse cursor-pointer whitespace-nowrap"
                        >
                          <ClipboardList size={16} /> Trình Kiểm Tra ({props.selectedRecordIds.size})
                        </button>
                      )}

                    {/* Bulk Submit Sign (Trình Ký) */}
                    {hasPermission('BTN_SUBMIT_SIGN') &&
                      (currentView === "archive_completed_list" ||
                       currentView === "pending_check_list" ||
                       currentView === "archive_pending_check_list") && (
                        <button
                          onClick={() => {
                            const targets = records.filter((r) =>
                              props.selectedRecordIds.has(r.id),
                            );
                            props.setSubmitTargetRecords(targets);
                            props.setIsSubmitModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 bg-indigo-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-bold shadow-sm transition-all animate-pulse cursor-pointer whitespace-nowrap"
                        >
                          <FileSignature size={16} /> Trình Ký ({props.selectedRecordIds.size})
                        </button>
                      )}

                    {/* Bulk Handover (Bàn giao 1 cửa) */}
                    {(currentView === "director_completed" ||
                      currentView === "other_director_completed" ||
                      currentView === "archive_director_completed") &&
                      (hasPermission('HANDOVER_RECORDS') || hasPermission('EXPORT_RECORDS')) && (
                        <button
                          onClick={() => {
                            props.setExportModalType("handover");
                            props.setIsExportModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 bg-teal-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-teal-700 text-sm font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Send size={16} /> Bàn giao 1 cửa ({props.selectedRecordIds.size})
                        </button>
                      )}
                  </>
                )}
              </div>
            )}

            {/* Action buttons on the right side */}
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {/* Thao tác Trả hồ sơ & Xử lý All bên phải khi có chọn hồ sơ */}
              {props.selectedRecordIds.size > 0 && (
                <>
                  {/* Bulk Reject (Trả hồ sơ) - Bỏ ở các tab bàn giao/trả kết quả */}
                  {!["handover_list", "other_handover_list", "archive_handover_list"].includes(currentView) &&
                    (hasPermission('BTN_REJECT_RECORD') || hasPermission('REJECT_RECORDS') ||
                     hasPermission('dodac_BTN_REJECT_RECORD') || hasPermission('luutru_BTN_REJECT_RECORD')) && (
                    <button
                      onClick={() => {
                        const targets = records.filter((r) =>
                          props.selectedRecordIds.has(r.id),
                        );
                        if (props.handleOpenRejectReturnModal) {
                          props.handleOpenRejectReturnModal(targets);
                        } else if (props.handleMarkAsRejected) {
                          props.handleMarkAsRejected();
                        }
                      }}
                      className="flex items-center gap-1.5 bg-rose-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-rose-700 text-sm font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                      title="Trả hồ sơ"
                    >
                      <Undo2 size={16} /> Trả hồ sơ ({props.selectedRecordIds.size})
                    </button>
                  )}

                  {/* Bulk Update (Xử lý All) */}
                  <button
                    onClick={() => props.setIsBulkUpdateModalOpen(true)}
                    className="flex items-center gap-1.5 bg-orange-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-orange-700 shadow-sm text-sm font-bold animate-pulse cursor-pointer whitespace-nowrap"
                    title="Xử lý All"
                  >
                    <Layers size={16} /> Xử lý All ({props.selectedRecordIds.size})
                  </button>
                </>
              )}
              {/* Tab "Đã trả kết quả": Xuất Excel TKQ */}
              {(currentView === "handover_list" ||
                currentView === "other_handover_list" ||
                currentView === "archive_handover_list") &&
                props.handoverTab === "returned" && (
                  <button
                    onClick={props.handleExportReturnedList}
                    className="flex items-center gap-1.5 bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg hover:bg-emerald-800 text-sm font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
                    title="Xuất file Excel cho danh sách Đã trả kết quả (TKQ)"
                  >
                    <FileSpreadsheet size={16} /> Xuất Excel TKQ
                  </button>
                )}

              {/* Các tab "Chờ bàn giao" & "Chờ trả kết quả": Nút Xuất DS */}
              {(currentView === "director_completed" ||
                currentView === "other_director_completed" ||
                currentView === "archive_director_completed" ||
                ((currentView === "handover_list" ||
                  currentView === "other_handover_list" ||
                  currentView === "archive_handover_list") &&
                 props.handoverTab !== "returned")) && (
                <button
                  onClick={() => {
                    props.setExportModalType("handover");
                    props.setIsExportModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-white text-gray-700 border border-gray-300 px-3.5 py-1.5 rounded-lg hover:bg-gray-50 text-sm font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  title="Xuất danh sách hồ sơ ra file Excel"
                >
                  <FileOutput size={16} className="text-emerald-600" />
                  <span>Xuất DS</span>
                </button>
              )}

              {/* Nút Cài đặt cột tiêu đề bảng */}
              {(currentView === "all_records" ||
                currentView === "other_records" ||
                currentView === "archive_records") && (
                <div className="relative">
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 shadow-xs flex items-center justify-center cursor-pointer"
                    title="Cài đặt cột tiêu đề bảng"
                  >
                    <SlidersHorizontal size={18} className="text-gray-600" />
                  </button>
                  {showColumnSelector && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-2 divide-y divide-gray-100 max-h-96 overflow-y-auto">
                      {orderedColumnDefs.map((col, index) => (
                        <div
                          key={col.key}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group/item"
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1 select-none">
                            <input
                              type="checkbox"
                              checked={props.visibleColumns[col.key]}
                              onChange={() =>
                                props.setVisibleColumns((prev) => ({
                                  ...prev,
                                  [col.key]: !prev[col.key],
                                }))
                              }
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 font-medium">
                              {col.label}
                            </span>
                          </label>
                          <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <button
                              disabled={index === 0}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleMoveColumn(col.key, -1);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded disabled:opacity-30"
                              title="Di chuyển lên"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              disabled={index === orderedColumnDefs.length - 1}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleMoveColumn(col.key, 1);
                              }}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded disabled:opacity-30"
                              title="Di chuyển xuống"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0 bg-white">
          <table className="w-full text-left table-fixed min-w-[1200px] border-collapse">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0 shadow-sm z-10">
              <tr>
                <th className="p-3 w-10 text-center">
                  {(canPerformAction || hasPermission('BTN_SUBMIT_SIGN')) ? (
                    <button onClick={props.toggleSelectAll}>
                      {props.selectedRecordIds.size ===
                        props.paginatedRecords.length &&
                      props.paginatedRecords.length > 0 ? (
                        <CheckSquare size={16} className="text-blue-600" />
                      ) : (
                        <Square size={16} className="text-gray-400" />
                      )}
                    </button>
                  ) : (
                    "#"
                  )}
                </th>
                {orderedColumnDefs.map(
                  (col) =>
                    props.visibleColumns[col.key] && (
                      <th
                        key={col.key}
                        className={`p-3 cursor-pointer hover:bg-gray-100 transition-colors group select-none ${col.className || ""}`}
                        onClick={() => {
                          if (props.sortConfig.key === col.sortKey) {
                            props.setSortConfig({
                              key: col.sortKey,
                              direction:
                                props.sortConfig.direction === "asc"
                                  ? "desc"
                                  : "asc",
                            });
                          } else {
                            props.setSortConfig({
                              key: col.sortKey,
                              direction: "asc",
                            });
                          }
                        }}
                      >
                        <div
                          className={`flex items-center gap-1 ${col.className?.includes("text-center") ? "justify-center" : ""}`}
                        >
                          {col.label}
                          {props.sortConfig.key === col.sortKey ? (
                            props.sortConfig.direction === "asc" ? (
                              <ArrowUpDown
                                size={14}
                                className="text-blue-600"
                              />
                            ) : (
                              <ArrowUpDown
                                size={14}
                                className="text-blue-600 rotate-180"
                              />
                            )
                          ) : (
                            <ArrowUpDown
                              size={14}
                              className="text-gray-300 opacity-0 group-hover:opacity-100"
                            />
                          )}
                        </div>
                      </th>
                    ),
                )}
                {canPerformAction && (
                  <th className="p-3 w-28 text-center bg-gray-50 sticky right-0 shadow-l">
                    THAO TÁC
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {props.paginatedRecords.length > 0 ? (
                props.paginatedRecords.map((r) => (
                  <RecordRow
                    key={r.id}
                    record={r}
                    employees={employees}
                    visibleColumns={props.visibleColumns}
                    columnOrder={props.columnOrder}
                    isSelected={props.selectedRecordIds.has(r.id)}
                    canPerformAction={canPerformAction}
                    isSpecializedTab={isSpecializedTab}
                    currentUser={currentUser}
                    onToggleSelect={props.toggleSelectRecord}
                    onView={props.handleViewRecord}
                    onEdit={(rec) => {
                      props.setEditingRecord(rec);
                      props.setIsModalOpen(true);
                    }}
                    onDelete={(rec) => {
                      props.setDeletingRecord(rec);
                      props.setIsDeleteModalOpen(true);
                    }}
                    onAdvanceStatus={props.advanceStatus}
                    onQuickUpdate={props.handleQuickUpdate}
                    onReturnResult={props.handleOpenReturnModal}
                    onMapCorrection={props.handleMapCorrectionRequest}
                    canSelect={canPerformAction || hasPermission('BTN_SUBMIT_SIGN')}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={
                      Object.values(props.visibleColumns).filter((v) => v)
                        .length + 2
                    }
                    className="p-8 text-center text-gray-400 italic"
                  >
                    Không có dữ liệu hiển thị.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {props.paginatedRecords.length > 0 && (
          <div className="border-t border-gray-200 p-3 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span>
                Tổng số: <strong>{props.filteredRecords.length}</strong> bản ghi
              </span>
              <div className="flex items-center gap-2">
                <span>Hiển thị</span>
                <select
                  value={props.itemsPerPage}
                  onChange={(e) =>
                    props.setItemsPerPage(Number(e.target.value))
                  }
                  className="border border-gray-300 rounded px-2 py-1 bg-white outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  props.setCurrentPage(Math.max(props.currentPage - 1, 1))
                }
                disabled={props.currentPage === 1}
                className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-medium">
                Trang {props.currentPage} / {props.totalPages}
              </span>
              <button
                onClick={() =>
                  props.setCurrentPage(
                    Math.min(props.currentPage + 1, props.totalPages),
                  )
                }
                disabled={props.currentPage === props.totalPages}
                className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
          </>
      </div>
    );
  };

  switch (currentView) {
    case "dashboard":
      return (
        <DashboardView
          records={records}
          currentUser={currentUser}
          employees={employees}
          setCurrentView={props.setCurrentView}
        />
      );
    case "work_schedule":
      return <WorkScheduleView currentUser={currentUser} />;
    case "personal_profile":
      return (
        <PersonalProfile
          user={currentUser}
          records={records}
          isDirector={isDirector}
          users={users}
          employees={employees}
          onUpdateStatus={(r, status) =>
            props.handleQuickUpdate(r.id, "status", status)
          }
          onUpdateRecord={props.handleAddOrUpdateRecord}
          onViewRecord={props.handleViewRecord}
          onCreateLiquidation={(r) => {
            props.setRecordToLiquidate(r);
            props.setCurrentView("receive_contract");
          }}
          onMapCorrection={props.handleMapCorrectionRequest}
        />
      );
    case "receive_record":
      return (
        <ReceiveRecord
          key={`receive_record_${receiveRecordSubTab}_${props.receiveRecordResetKey || 0}`}
          initialTab={receiveRecordSubTab}
          onSave={props.handleAddOrUpdateRecord}
          onDelete={props.handleDeleteRecord}
          wards={wards}
          employees={employees}
          currentUser={currentUser}
          records={records}
          holidays={holidays}
          rolePermissions={rolePermissions}
          departmentPermissions={departmentPermissions}
          onCreateContract={(r) => {
            props.setRecordToCreateContract(r as RecordFile);
            props.setCurrentView("receive_contract");
          }}
          onHandOverRecords={props.handleHandOverRecords}
          onBulkUpdate={props.onBulkUpdate}
        />
      );
    case "receive_contract":
      return (
        <ReceiveContract
          onSave={(r) => props.handleAddOrUpdateRecord(r)}
          wards={wards}
          currentUser={currentUser}
          employees={employees}
          records={records}
          recordToLiquidate={props.recordToLiquidate}
          onClearRecordToLiquidate={() => props.setRecordToLiquidate(null)}
          recordToCreateContract={props.recordToCreateContract}
          onClearRecordToCreateContract={() => props.setRecordToCreateContract(null)}
        />
      );

    case "excerpt_management":
      return (
        <ExcerptManagement
          currentUser={currentUser}
          records={records}
          onUpdateRecord={(id, num, type) =>
            props.handleQuickUpdate(
              id,
              type === "trichluc" ? "excerptNumber" : "measurementNumber",
              num,
            )
          }
          wards={wards}
          onAddWard={(w) => props.setWards((prev) => [...prev, w])}
          onDeleteWard={(w) =>
            props.setWards((prev) => prev.filter((x) => x !== w))
          }
          onResetWards={props.onResetWards}
        />
      );
    case "utilities":
      return (
        <UtilitiesView
          currentUser={currentUser}
          employees={employees}
          initialRecordForCorrection={props.recordForMapCorrection}
          records={records}
          onUpdateRecord={(id, num, type) =>
            props.handleQuickUpdate(
              id,
              type === "trichluc" ? "excerptNumber" : "measurementNumber",
              num,
            )
          }
          wards={wards}
          onAddWard={(w) => props.setWards((prev) => [...prev, w])}
          onDeleteWard={(w) =>
            props.setWards((prev) => prev.filter((x) => x !== w))
          }
          onResetWards={props.onResetWards}
          onSaveRecord={props.handleAddOrUpdateRecord}
          holidays={holidays}
          onRefreshData={props.onRefreshData}
        />
      );
    case "registration_records":
      return <RegistrationRecords currentUser={currentUser} wards={wards} />;
    case "congvan_records":
      return <CongVanView currentUser={currentUser} />;
    case "barcode_generator":
      return <BarcodeGeneratorView />;
    case "account_settings":
      return (
        <AccountSettingsView
          currentUser={currentUser}
          linkedEmployee={employees.find(
            (e) => e.id === currentUser.employeeId,
          )}
          onUpdate={props.handleUpdateCurrentAccount}
          notificationEnabled={props.notificationEnabled}
          setNotificationEnabled={props.setNotificationEnabled}
        />
      );
    case "system_dashboard":
      if (currentUser.role === UserRole.EMPLOYEE || currentUser.role === UserRole.ONEDOOR) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white rounded-2xl shadow-sm border border-red-100 max-w-lg mx-auto my-12">
            <div className="bg-red-50 p-4 rounded-full text-red-600 mb-4">
              <ShieldAlert size={48} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Truy cập bị từ chối</h2>
            <p className="text-sm text-gray-500 mb-4">Bạn không có quyền truy cập vào mục Cài đặt hệ thống.</p>
          </div>
        );
      }
      return (
        <SystemView
          currentUser={currentUser}
          users={users}
          employees={employees}
          onAddUser={(u) => props.handleUpdateUser(u, false)}
          onUpdateUser={(u) => props.handleUpdateUser(u, true)}
          onDeleteUser={props.handleDeleteUser}
          onSaveEmployee={props.handleSaveEmployee}
          onDeleteEmployee={props.handleDeleteEmployee}
          wards={wards}
          onDeleteAllData={props.handleDeleteAllData}
          onHolidaysChanged={props.onRefreshData}
        />
      );
    case "reports":
      return (
        <ReportSection
          reportContent={props.globalReportContent}
          isGenerating={props.isGeneratingReport}
          onGenerate={props.handleGlobalGenerateReport}
          onExportExcel={props.handleExportReportExcel}
          records={records}
          employees={employees}
          wards={wards}
          currentUser={props.currentUser}
        />
      );
    default:
      // This now handles 'all_records', 'assign_tasks', 'check_list', 'handover_list'
      return renderRecordList();
  }
};

export default AppRoutes;
