import React, { useState, useMemo, useEffect, useRef } from "react";
import { RecordFile, RecordStatus, User, Employee, Contract, UserRole } from "../types";
import StatusBadge from "./StatusBadge";
import {
  Briefcase,
  ArrowRight,
  CheckCircle,
  Clock,
  Send,
  AlertTriangle,
  UserCog,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Bell,
  CalendarClock,
  FileCheck,
  Map as MapIcon,
  CheckSquare,
  ClipboardList,
  FileDown,
  Undo,
  FileX,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Calendar,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { getShortRecordType, isArchiveRecordType, STATUS_LABELS } from "../constants";
import { confirmAction, cleanSyncNotes } from "../utils/appHelpers";
import { updateRecordApi, fetchContracts } from "../services/api";
import {
  fetchArchiveRecords,
  ArchiveRecord,
  saveArchiveRecord,
} from "../services/apiArchive";
import SubmitModal from "./receive-record/SubmitModal";
import SystemAnnexTemplate from "./receive-record/SystemAnnexTemplate";
import {
  generateDocxBlobAsync,
  hasTemplate,
  STORAGE_KEYS,
} from "../services/docxService";
import saveAs from "file-saver";

interface PersonalProfileProps {
  user: User;
  records: RecordFile[];
  isDirector?: boolean;
  users: User[];
  employees: Employee[];
  onUpdateStatus: (record: RecordFile, newStatus: RecordStatus) => void;
  onUpdateRecord?: (record: RecordFile) => Promise<RecordFile | null>;
  onViewRecord: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void;
  onMapCorrection?: (record: RecordFile) => void; // New Handler Prop
}

function removeVietnameseTones(str: string): string {
  if (!str) return "";
  str = str.toLowerCase();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  str = str.replace(/\u02C6|\u0306|\u031B/g, "");
  str = str.replace(/ + /g, " ");
  str = str.trim();
  return str;
}

const PersonalProfile: React.FC<PersonalProfileProps> = ({
  user,
  records,
  isDirector,
  users,
  employees,
  onUpdateStatus,
  onUpdateRecord,
  onViewRecord,
  onCreateLiquidation,
  onMapCorrection,
}) => {
  // Thêm tab 'pending_sign'
  const [activeTab, setActiveTab] = useState<
    | "all"
    | "pending"
    | "pending_check"
    | "pending_sign"
    | "finished"
    | "reminder"
  >(isDirector ? "pending_sign" : "pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(20);
  const itemsPerPage = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [filterRecordType, setFilterRecordType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as Node)
      ) {
        setIsFilterPopoverOpen(false);
      }
    };
    if (isFilterPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFilterPopoverOpen]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterFromDate) count++;
    if (filterToDate) count++;
    if (filterRecordType && filterRecordType !== "all") count++;
    if (filterStatus && filterStatus !== "all") count++;
    return count;
  }, [filterFromDate, filterToDate, filterRecordType, filterStatus]);

  useEffect(() => {
    setCurrentPage(1);
    setMobileVisibleCount(20);
  }, [activeTab, searchTerm, filterFromDate, filterToDate, filterRecordType, filterStatus]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof RecordFile;
    direction: "asc" | "desc";
  }>({
    key: "deadline",
    direction: "desc",
  });

  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitCheckModalOpen, setIsSubmitCheckModalOpen] = useState(false);
  const [submitTargetRecords, setSubmitTargetRecords] = useState<RecordFile[]>(
    [],
  );
  const [isAnnexModalOpen, setIsAnnexModalOpen] = useState(false);
  const [annexTargetRecord, setAnnexTargetRecord] = useState<RecordFile | null>(
    null,
  );

  // States for Return/Recall features
  const [returnModalConfig, setReturnModalConfig] = useState<{
    isOpen: boolean;
    record: RecordFile | null;
    type: "return_record";
  }>({
    isOpen: false,
    record: null,
    type: "return_record",
  });
  const [returnReason, setReturnReason] = useState("");

  const currentEmployee = useMemo(() => {
    return employees.find((e) => e.id === user.employeeId);
  }, [employees, user.employeeId]);

  const isDirectorUser = useMemo(() => {
    const pos = currentEmployee?.position?.toLowerCase() || '';
    const dept = currentEmployee?.department?.toLowerCase() || '';
    return (
      isDirector ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUBADMIN ||
      pos.includes("giám đốc") ||
      pos.includes("phó giám đốc") ||
      dept.includes("ban giám đốc") ||
      dept.includes("ban lãnh đạo")
    );
  }, [isDirector, user.role, currentEmployee]);

  useEffect(() => {
    const loadArchive = async () => {
      const saoluc = await fetchArchiveRecords("saoluc");
      const congvan = await fetchArchiveRecords("congvan");
      setArchiveRecords([...saoluc, ...congvan]);
    };
    const loadContracts = async () => {
      try {
        const fetched = await fetchContracts();
        setContracts(fetched);
      } catch (err) {
        console.error("Error loading contracts:", err);
      }
    };
    loadArchive();
    loadContracts();
  }, []);

  const myRecords = useMemo((): RecordFile[] => {
    const mainRecords = records.filter((r) => {
      if (!user.employeeId) return false;
      if (isDirector) {
        if (r.assignedTo === user.employeeId) return true;
        if (r.submittedTo === user.employeeId) {
          const reachedSignStage =
            r.status === RecordStatus.PENDING_SIGN ||
            r.status === RecordStatus.SIGNED ||
            r.status === RecordStatus.HANDOVER ||
            r.status === RecordStatus.RETURNED;
          return reachedSignStage;
        }
        return false;
      }
      // Nếu là người kiểm tra, họ có thể thấy hồ sơ được giao cho họ HOẶC hồ sơ trình cho họ kiểm tra
      const isCheckerUser =
        employees
          .find((e) => e.id === user.employeeId)
          ?.position?.toLowerCase()
          .includes("tổ") &&
        (employees
          .find((e) => e.id === user.employeeId)
          ?.department?.toLowerCase()
          .includes("đo đạc") ||
          employees
            .find((e) => e.id === user.employeeId)
            ?.department?.toLowerCase()
            .includes("kỹ thuật"));
      if (isCheckerUser) {
        // Chỉ hiển thị hồ sơ giao xử lý (assignedTo) HOẶC hồ sơ đã tới khâu kiểm tra (status >= PENDING_CHECK) nếu họ là người kiểm tra (checkedBy)
        if (r.assignedTo === user.employeeId) return true;
        if (r.checkedBy === user.employeeId) {
          const reachedCheckStage =
            r.status !== RecordStatus.RECEIVED &&
            r.status !== RecordStatus.ASSIGNED &&
            r.status !== RecordStatus.IN_PROGRESS &&
            r.status !== RecordStatus.COMPLETED_WORK;
          return reachedCheckStage;
        }
        return false;
      }
      return r.assignedTo === user.employeeId;
    });

    const mappedArchives = archiveRecords
      .filter((r) => {
        if (!user.employeeId) return false;
        if (isDirector) {
          if (r.data?.assigned_to === user.employeeId) return true;
          if (r.data?.submitted_to === user.employeeId || r.data?.submittedTo === user.employeeId) {
            let status: RecordStatus = RecordStatus.RECEIVED;
            const rawSt = String(r.status || '').toLowerCase();
            if (rawSt === 'assigned') status = RecordStatus.ASSIGNED;
            else if (rawSt === 'executed' || rawSt === 'completed_work') status = RecordStatus.COMPLETED_WORK;
            else if (rawSt === 'pending_supplement') status = RecordStatus.PENDING_SUPPLEMENT;
            else if (rawSt === 'pending_check') status = RecordStatus.PENDING_CHECK;
            else if (rawSt === 'checked') status = RecordStatus.CHECKED;
            else if (rawSt === 'pending_sign') status = RecordStatus.PENDING_SIGN;
            else if (rawSt === 'signed') status = RecordStatus.SIGNED;
            else if (rawSt === 'handover') status = RecordStatus.HANDOVER;
            else if (rawSt === 'completed') status = RecordStatus.RETURNED;

            const reachedSignStage =
              status === RecordStatus.PENDING_SIGN ||
              status === RecordStatus.SIGNED ||
              status === RecordStatus.HANDOVER ||
              status === RecordStatus.RETURNED;
            return reachedSignStage;
          }
          return false;
        }
        const isCheckerUser =
          employees
            .find((e) => e.id === user.employeeId)
            ?.position?.toLowerCase()
            .includes("tổ") &&
          (employees
            .find((e) => e.id === user.employeeId)
            ?.department?.toLowerCase()
            .includes("đo đạc") ||
            employees
              .find((e) => e.id === user.employeeId)
              ?.department?.toLowerCase()
              .includes("kỹ thuật"));
        if (isCheckerUser) {
          if (r.data?.assigned_to === user.employeeId) return true;
          if (r.data?.checked_by === user.employeeId) {
            // Map status của archive để kiểm tra xem đã tới khâu kiểm tra chưa
            let status: RecordStatus = RecordStatus.RECEIVED;
            const rawSt = String(r.status || '').toLowerCase();
            if (rawSt === 'assigned') status = RecordStatus.ASSIGNED;
            else if (rawSt === 'in_progress') status = RecordStatus.IN_PROGRESS;
            else if (rawSt === 'executed' || rawSt === 'completed_work') status = RecordStatus.COMPLETED_WORK;
            else if (rawSt === 'pending_supplement') status = RecordStatus.PENDING_SUPPLEMENT;
            else if (rawSt === 'pending_check') status = RecordStatus.PENDING_CHECK;
            else if (rawSt === 'checked') status = RecordStatus.CHECKED;
            else if (rawSt === 'pending_sign') status = RecordStatus.PENDING_SIGN;
            else if (rawSt === 'signed') status = RecordStatus.SIGNED;
            else if (rawSt === 'handover') status = RecordStatus.HANDOVER;
            else if (rawSt === 'completed') status = RecordStatus.RETURNED;

            const reachedCheckStage =
              status !== RecordStatus.RECEIVED &&
              status !== RecordStatus.ASSIGNED &&
              status !== RecordStatus.IN_PROGRESS &&
              status !== RecordStatus.COMPLETED_WORK;
            return reachedCheckStage;
          }
          return false;
        }
        return r.data?.assigned_to === user.employeeId;
      })
      .map((r) => {
        // Map status
        let status = RecordStatus.RECEIVED;
        if (r.status === "assigned") status = RecordStatus.ASSIGNED;
        else if (r.status === "executed") status = RecordStatus.COMPLETED_WORK;
        else if (r.status === "pending_sign")
          status = RecordStatus.PENDING_SIGN;
        else if (r.status === "signed") status = RecordStatus.SIGNED;
        else if (r.status === "completed") status = RecordStatus.RETURNED;

        return {
          id: r.id,
          code: r.so_hieu,
          customerName: r.noi_nhan_gui, // Sao lục: Chủ sử dụng, Công văn: Cơ quan phát hành
          recordType: r.type === "saoluc" ? "Sao lục" : "Công văn",
          content: r.trich_yeu,
          receivedDate: r.ngay_thang,
          deadline: r.data?.hen_tra,
          status: status,
          assignedTo: r.data?.assigned_to,
          ward: r.data?.xa_phuong,
          submissionDate: r.type === "congvan" ? r.ngay_thang : undefined, // Example mapping
          // Fill other required fields with defaults or null
          phoneNumber: null,
          cccd: null,
          landPlot: r.data?.thua_dat,
          mapSheet: r.data?.to_ban_do,
          area: null,
          address: null,
          group: null,
          assignedDate: r.data?.assigned_date,
          approvalDate: null,
          completedDate: null,
          notes: null,
          privateNotes: null,
          personalNotes: null,
          authorizedBy: null,
          authDocType: null,
          otherDocs: null,
          exportBatch: null,
          exportDate: null,
          measurementNumber: null,
          excerptNumber: null,
          reminderDate: null,
          lastRemindedAt: null,
          receiptNumber: null,
          receiverName: null,
          resultReturnedDate: null,
          needsMapCorrection: false,
        } as RecordFile;
      });

    // Khử trùng lặp 100%: Dùng Map theo id để đảm bảo mỗi hồ sơ chỉ xuất hiện 1 lần duy nhất
    const recordsMap = new Map<string, RecordFile>();

    // 1. Nạp hồ sơ từ mainRecords (đã bao gồm land_records, dangky_records và luutru_records nạp từ hệ thống)
    mainRecords.forEach((r) => {
      if (r && r.id) {
        recordsMap.set(r.id, r);
      }
    });

    // 2. Hợp nhất từ mappedArchives: Nếu id đã tồn tại thì bổ sung thông tin thiếu, KHÔNG tạo bản ghi trùng
    mappedArchives.forEach((ar) => {
      if (!ar || !ar.id) return;
      if (!recordsMap.has(ar.id)) {
        recordsMap.set(ar.id, ar);
      } else {
        const existing = recordsMap.get(ar.id)!;
        recordsMap.set(ar.id, {
          ...ar,
          ...existing,
          customerName: existing.customerName || ar.customerName,
          content: existing.content || ar.content,
          recordType: existing.recordType || ar.recordType,
        });
      }
    });

    return Array.from(recordsMap.values());
  }, [records, archiveRecords, user.employeeId]);

  const availableRecordTypes = useMemo(() => {
    const set = new Set<string>();
    myRecords.forEach(r => {
      if (r.recordType) {
        set.add(getShortRecordType(r.recordType));
      }
    });
    return Array.from(set).sort();
  }, [myRecords]);

  const isChecker = useMemo(() => {
    if (!user.employeeId) return false;
    const emp = employees.find((e) => e.id === user.employeeId);
    if (!emp) return false;
    const isDoDac =
      emp.department?.toLowerCase().includes("đo đạc") ||
      emp.department?.toLowerCase().includes("kỹ thuật");
    const isLeader =
      emp.position?.toLowerCase().includes("tổ trưởng") ||
      emp.position?.toLowerCase().includes("tổ phó");
    return isDoDac && isLeader;
  }, [user.employeeId, employees]);

  const isMeasurementTeam = useMemo(() => {
    if (!user.employeeId) return false;
    const emp = employees.find((e) => e.id === user.employeeId);
    if (!emp) return false;
    return (
      emp.department?.toLowerCase().includes("đo đạc") ||
      emp.department?.toLowerCase().includes("kỹ thuật") ||
      emp.position?.toLowerCase().includes("đo đạc")
    );
  }, [user.employeeId, employees]);

  const hasInitializedRef = React.useRef(false);
  useEffect(() => {
    if (isChecker && !hasInitializedRef.current) {
      setActiveTab("pending_check");
      hasInitializedRef.current = true;
    }
  }, [isChecker]);

  // 0. Tất cả hồ sơ cá nhân
  const allMyRecords = useMemo(() => {
    return filterAndSort([...myRecords], searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 1. Hồ sơ Đang thực hiện (ASSIGNED, IN_PROGRESS, COMPLETED_WORK)
  const pendingRecords = useMemo(() => {
    let list = myRecords.filter(
      (r) =>
        r.status === RecordStatus.ASSIGNED ||
        r.status === RecordStatus.IN_PROGRESS ||
        r.status === RecordStatus.COMPLETED_WORK,
    );
    return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 3. Hồ sơ Chờ kiểm tra (PENDING_CHECK) - Dành cho Tổ trưởng/Tổ phó
  const pendingCheckRecords = useMemo(() => {
    let list = myRecords.filter(
      (r) =>
        r.status === RecordStatus.PENDING_CHECK ||
        r.status === RecordStatus.CHECKED,
    );
    return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 4. Hồ sơ Chờ ký (PENDING_SIGN) - Chuyển thành Tab chính
  const reviewRecords = useMemo(() => {
    let list = myRecords.filter((r) => r.status === RecordStatus.PENDING_SIGN);
    return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 4. Hồ sơ Hoàn thành (SIGNED, HANDOVER, RETURNED, REJECTED, WITHDRAWN)
  const finishedRecords = useMemo(() => {
    let list = myRecords.filter(
      (r) =>
        r.status === RecordStatus.SIGNED ||
        r.status === RecordStatus.HANDOVER ||
        r.status === RecordStatus.RETURNED ||
        r.status === RecordStatus.REJECTED ||
        r.status === RecordStatus.WITHDRAWN,
    );
    return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 5. Hồ sơ Có hẹn nhắc việc
  const reminderRecords = useMemo(() => {
    let list = myRecords.filter(
      (r) =>
        r.reminderDate &&
        r.status !== RecordStatus.HANDOVER &&
        r.status !== RecordStatus.WITHDRAWN &&
        r.status !== RecordStatus.REJECTED &&
        r.status !== RecordStatus.RETURNED,
    );
    // Logic search & sort riêng cho reminder
    if (searchTerm) {
      const lowerSearch = removeVietnameseTones(searchTerm);
      const rawSearch = searchTerm.toLowerCase();
      list = list.filter((r) => {
        const nameNorm = removeVietnameseTones(r.customerName || "");
        const codeRaw = (r.code || "").toLowerCase();
        return nameNorm.includes(lowerSearch) || codeRaw.includes(rawSearch);
      });
    }
    return list.sort((a, b) => {
      const timeA = new Date(a.reminderDate!).getTime();
      const timeB = new Date(b.reminderDate!).getTime();
      return timeA - timeB;
    });
  }, [myRecords, searchTerm]);

  // Helper filter & sort chung
  function filterAndSort(list: RecordFile[], term: string, sort: any) {
    // 1. Time range filter
    if (filterFromDate) {
      list = list.filter(r => {
        const d = r.receivedDate ? r.receivedDate.split('T')[0] : '';
        return d >= filterFromDate;
      });
    }
    if (filterToDate) {
      list = list.filter(r => {
        const d = r.receivedDate ? r.receivedDate.split('T')[0] : '';
        return d <= filterToDate;
      });
    }

    // 2. Record type filter
    if (filterRecordType && filterRecordType !== 'all') {
      list = list.filter(r => {
        const short = getShortRecordType(r.recordType);
        return short === filterRecordType || r.recordType === filterRecordType;
      });
    }

    // 3. Status filter
    if (filterStatus && filterStatus !== 'all') {
      list = list.filter(r => r.status === filterStatus);
    }

    // 4. Search term
    if (term) {
      const lowerSearch = removeVietnameseTones(term);
      const rawSearch = term.toLowerCase();
      list = list.filter((r) => {
        const nameNorm = removeVietnameseTones(r.customerName || "");
        const codeRaw = (r.code || "").toLowerCase();
        const wardNorm = removeVietnameseTones(r.ward || "");
        return (
          nameNorm.includes(lowerSearch) ||
          codeRaw.includes(rawSearch) ||
          wardNorm.includes(lowerSearch)
        );
      });
    }
    return list.sort((a, b) => {
      const aValue = a[sort.key as keyof RecordFile];
      const bValue = b[sort.key as keyof RecordFile];
      if (!aValue) return 1;
      if (!bValue) return -1;
      if (aValue < bValue) return sort.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Tổng hợp các chỉ số
  const completedTotal = finishedRecords.length;

  // Xác định danh sách hiển thị dựa trên Tab đang chọn
  const displayRecords =
    activeTab === "all"
      ? allMyRecords
      : activeTab === "pending"
        ? pendingRecords
        : activeTab === "pending_check"
          ? pendingCheckRecords
          : activeTab === "pending_sign"
            ? reviewRecords
            : activeTab === "finished"
              ? finishedRecords
              : reminderRecords;

  const totalPages = Math.ceil(displayRecords.length / itemsPerPage);

  const paginatedDisplayRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return displayRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [displayRecords, currentPage, itemsPerPage]);

  const handleSort = (key: keyof RecordFile) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleExportExcel = () => {
    if (displayRecords.length === 0) {
      alert("Không có hồ sơ nào theo kết quả lọc để xuất Excel.");
      return;
    }

    const title = "DANH SÁCH HỒ SƠ CÁ NHÂN";
    const subTitle = `TỔNG SỐ HỒ SƠ: ${displayRecords.length} ${filterFromDate || filterToDate ? `(Từ ${filterFromDate || 'đầu'} đến ${filterToDate || 'nay'})` : ''}`;
    const displayDate = `Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`;

    const headers = [
      "STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Số Điện Thoại", "CCCD", 
      "Loại Hồ Sơ", "Ngày Nhận", "Hẹn Trả", "Trạng Thái", "Ngày Giao Việc", "Xã/Phường", 
      "Số Tờ", "Số Thửa", "Diện Tích", "Địa Chỉ", "Nội Dung", "Ghi Chú"
    ];

    const dataRows = displayRecords.map((r, idx) => [
      idx + 1,
      r.code || "",
      r.customerName || "",
      r.phoneNumber || "",
      r.cccd || "",
      r.recordType || "",
      r.receivedDate ? r.receivedDate.split("T")[0].split("-").reverse().join("/") : "",
      r.deadline ? r.deadline.split("T")[0].split("-").reverse().join("/") : "",
      (r.status && STATUS_LABELS[r.status as RecordStatus]) ? STATUS_LABELS[r.status as RecordStatus] : (r.status || ""),
      r.assignedDate ? r.assignedDate.split("T")[0].split("-").reverse().join("/") : "",
      r.ward || "",
      r.mapSheet || "",
      r.landPlot || "",
      r.area || "",
      r.address || "",
      cleanSyncNotes(r.content) || "",
      cleanSyncNotes(r.notes) || ""
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    const headerRows = [
      ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
      ["Độc lập - Tự do - Hạnh phúc"],
      [""],
      [title],
      [displayDate.toUpperCase()],
      [subTitle],
      [""]
    ];

    const tableHeaderRowIndex = headerRows.length;
    headerRows.push(headers);

    XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: "A1" });

    const dataOriginRow = headerRows.length + 1;
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: `A${dataOriginRow}` });

    const totalCols = headers.length;
    const lastDataRow = (dataOriginRow - 1) + dataRows.length;
    const footerStartRow = lastDataRow + 2;

    const midPoint = Math.floor(totalCols / 2);
    const leftStart = 0;
    const leftEnd = midPoint - 1;
    const rightStart = midPoint + 1;
    const rightEnd = totalCols - 1;

    const footerRow1 = new Array(totalCols).fill("");
    footerRow1[leftStart] = "NGƯỜI LẬP BÁO CÁO";
    footerRow1[rightStart] = "PHỤ TRÁCH / LÃNH ĐẠO";

    const footerRow2 = new Array(totalCols).fill("");
    footerRow2[leftStart] = "(Ký và ghi rõ họ tên)";
    footerRow2[rightStart] = "(Ký và ghi rõ họ tên)";

    XLSX.utils.sheet_add_aoa(ws, [footerRow1, footerRow2], { origin: `A${footerStartRow + 1}` });

    // Column widths
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 16 }, // Mã HS
      { wch: 25 }, // Chủ SD
      { wch: 14 }, // SĐT
      { wch: 16 }, // CCCD
      { wch: 20 }, // Loại HS
      { wch: 12 }, // Ngày nhận
      { wch: 12 }, // Hẹn trả
      { wch: 15 }, // Trạng thái
      { wch: 14 }, // Ngày Giao Việc
      { wch: 18 }, // Xã/Phường
      { wch: 8 },  // Số tờ
      { wch: 8 },  // Số thửa
      { wch: 10 }, // Diện tích
      { wch: 25 }, // Địa chỉ
      { wch: 30 }, // Nội dung
      { wch: 25 }, // Ghi chú
    ];

    // Row heights
    const wsrows = [];
    for (let i = 0; i <= tableHeaderRowIndex; i++) {
      wsrows.push({ hpx: 30 });
    }
    for (let i = 0; i < dataRows.length; i++) {
      wsrows.push({ hpx: 25 });
    }
    wsrows.push({ hpx: 25 }, { hpx: 25 }, { hpx: 30 }, { hpx: 30 });
    ws['!rows'] = wsrows;

    // Merges
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols - 1 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: totalCols - 1 } },
      { s: { r: footerStartRow, c: leftStart }, e: { r: footerStartRow, c: leftEnd } },
      { s: { r: footerStartRow + 1, c: leftStart }, e: { r: footerStartRow + 1, c: leftEnd } },
      { s: { r: footerStartRow, c: rightStart }, e: { r: footerStartRow, c: rightEnd } },
      { s: { r: footerStartRow + 1, c: rightStart }, e: { r: footerStartRow + 1, c: rightEnd } },
    ];
    ws['!merges'] = merges;

    // Styles
    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const styles = {
      nationalTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
      nationalSlogan: { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center", vertical: "center" } },
      reportTitle: { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
      reportSubTitle: { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center", vertical: "center" } },
      tableHeader: { font: { name: "Times New Roman", sz: 11, bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borderStyle, fill: { fgColor: { rgb: "E0E0E0" } } },
      tableData: { font: { name: "Times New Roman", sz: 11 }, border: borderStyle, alignment: { vertical: "center", wrapText: true } },
      tableDataCenter: { font: { name: "Times New Roman", sz: 11 }, border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } },
      sigTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
      sigNote: { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center", vertical: "center" } }
    };

    if (ws['A1']) ws['A1'].s = styles.nationalTitle;
    if (ws['A2']) ws['A2'].s = styles.nationalSlogan;
    if (ws['A4']) ws['A4'].s = styles.reportTitle;
    if (ws['A5']) ws['A5'].s = styles.reportSubTitle;
    if (ws['A6']) ws['A6'].s = styles.reportSubTitle;

    for (let c = 0; c < totalCols; c++) {
      const headerCell = XLSX.utils.encode_cell({ r: tableHeaderRowIndex, c: c });
      if (!ws[headerCell]) ws[headerCell] = { v: "", t: "s" };
      ws[headerCell].s = styles.tableHeader;

      for (let r = tableHeaderRowIndex + 1; r <= lastDataRow; r++) {
        const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
        if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
        const colName = headers[c];
        const centerCols = ["STT", "Số Tờ", "Số Thửa", "Hẹn Trả", "Ngày Nhận", "Trạng Thái", "Ngày Giao Việc"];
        if (centerCols.includes(colName)) ws[cellRef].s = styles.tableDataCenter;
        else ws[cellRef].s = styles.tableData;
      }
    }

    const giaoRef = XLSX.utils.encode_cell({ r: footerStartRow, c: leftStart });
    const giaoNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: leftStart });
    const nhanRef = XLSX.utils.encode_cell({ r: footerStartRow, c: rightStart });
    const nhanNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: rightStart });

    if (ws[giaoRef]) ws[giaoRef].s = styles.sigTitle;
    if (ws[giaoNoteRef]) ws[giaoNoteRef].s = styles.sigNote;
    if (ws[nhanRef]) ws[nhanRef].s = styles.sigTitle;
    if (ws[nhanNoteRef]) ws[nhanNoteRef].s = styles.sigNote;

    XLSX.utils.book_append_sheet(wb, ws, "HoSoCaNhan");
    XLSX.writeFile(wb, `Danh_Sach_Ho_So_Ca_Nhan_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- ACTIONS ---

  // --- ACTIONS ---

  const handleUpdateRecordAndNotes = async (
    record: RecordFile,
    newStatus: RecordStatus,
    logEntry?: string,
    archiveStatus?: string,
    archiveAction?: string
  ) => {
    try {
      const isArchive = record.recordType === "Sao lục" || record.recordType === "Công văn";
      const nowIso = new Date().toISOString();
      const currentPrivateNotes = record.privateNotes || "";
      const newPrivateNotes = logEntry
        ? (currentPrivateNotes ? `${currentPrivateNotes}\n${logEntry}` : logEntry)
        : currentPrivateNotes;

      if (isArchive) {
        const historyEntry = {
          action: archiveAction || "Cập nhật",
          status: archiveStatus || "assigned",
          timestamp: nowIso,
          user: user.name,
        };

        const currentArchive = archiveRecords.find((r) => r.id === record.id);
        if (currentArchive) {
          const oldHistory = Array.isArray(currentArchive.data?.history)
            ? currentArchive.data.history
            : [];
          const newHistory = [...oldHistory, historyEntry];

          await saveArchiveRecord({
            ...currentArchive,
            id: record.id,
            status: (archiveStatus || "assigned") as any,
            so_hieu: currentArchive.so_hieu || record.code || '',
            noi_nhan_gui: currentArchive.noi_nhan_gui || record.customerName || '',
            trich_yeu: currentArchive.trich_yeu || record.content || '',
            data: {
              ...currentArchive.data,
              history: newHistory,
              privateNotes: newPrivateNotes,
            },
          });
        }
      } else {
        const updatedRecord: RecordFile = {
          ...record,
          status: newStatus,
          privateNotes: newPrivateNotes,
        };

        // Cập nhật các mốc thời gian chuyển trạng thái tương ứng
        if (newStatus === RecordStatus.REJECTED) {
          updatedRecord.completedDate = nowIso;
        } else if (newStatus === RecordStatus.COMPLETED_WORK) {
          updatedRecord.completedWorkDate = nowIso;
        } else if (newStatus === RecordStatus.PENDING_CHECK) {
          updatedRecord.pendingCheckDate = nowIso;
        } else if (newStatus === RecordStatus.CHECKED) {
          updatedRecord.checkedDate = nowIso;
        } else if (newStatus === RecordStatus.PENDING_SIGN) {
          updatedRecord.submissionDate = nowIso;
        }

        if (onUpdateRecord) {
          await onUpdateRecord(updatedRecord);
        } else {
          await updateRecordApi(updatedRecord);
          onUpdateStatus(record, newStatus);
        }
      }

      // Refresh dữ liệu lưu trữ nếu có
      if (isArchive) {
        const saoluc = await fetchArchiveRecords("saoluc");
        const congvan = await fetchArchiveRecords("congvan");
        setArchiveRecords([...saoluc, ...congvan]);
      }
    } catch (err) {
      console.error("Lỗi khi cập nhật hồ sơ:", err);
      alert("Đã xảy ra lỗi khi thực hiện thao tác.");
    }
  };

  const handleOpenReturnModal = (record: RecordFile) => {
    setReturnReason("");
    setReturnModalConfig({
      isOpen: true,
      record: record,
      type: "return_record",
    });
  };

  const handleConfirmReturnModal = async () => {
    const { record } = returnModalConfig;
    if (!record) return;
    if (!returnReason.trim()) {
      alert("Vui lòng nhập lý do.");
      return;
    }

    // Lấy ngày tháng mặc định thời điểm lưu
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const displayTime = `${day}/${month}/${year}`;

    // 1. Trả hồ sơ (chỉ ghi chú nội dung, giữ nguyên trạng thái cũ vì hồ sơ phải hoàn thiện quy trình như trình kiểm tra trình ký rồi mới chuyển 1 cửa)
    const logEntry = `[Trả hồ sơ - ${displayTime}] Lý do: ${returnReason.trim()}`;
    await handleUpdateRecordAndNotes(
      record,
      record.status,
      logEntry,
      undefined,
      "Ghi chú trả hồ sơ"
    );

    setReturnModalConfig({ isOpen: false, record: null, type: "return_record" });
  };



  const handleMarkAsDone = async (record: RecordFile) => {
    if (
      await confirmAction(
        `Xác nhận đã hoàn thành công việc cho hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đã thực hiện".`,
      )
    ) {
      if (record.recordType === "Sao lục" || record.recordType === "Công văn") {
        // Handle Archive Record
        const archiveType =
          record.recordType === "Sao lục" ? "saoluc" : "congvan";
        // Find original record to get full data if needed, or just update status
        // We need to append history as well.

        const historyEntry = {
          action: "Thực hiện xong",
          status: "executed",
          timestamp: new Date().toISOString(),
          user: user.name,
        };

        // We need to fetch the current record to get its data.history
        // Or we can just use the one from archiveRecords state
        const currentArchive = archiveRecords.find((r) => r.id === record.id);
        if (currentArchive) {
          const oldHistory = Array.isArray(currentArchive.data?.history)
            ? currentArchive.data.history
            : [];
          const newHistory = [...oldHistory, historyEntry];

          await saveArchiveRecord({
            ...currentArchive,
            id: record.id,
            status: "executed",
            so_hieu: currentArchive.so_hieu || record.code || '',
            noi_nhan_gui: currentArchive.noi_nhan_gui || record.customerName || '',
            trich_yeu: currentArchive.trich_yeu || record.content || '',
            data: { ...currentArchive.data, history: newHistory },
          });

          // Refresh data
          const saoluc = await fetchArchiveRecords("saoluc");
          const congvan = await fetchArchiveRecords("congvan");
          setArchiveRecords([...saoluc, ...congvan]);
        }
      } else {
        // Normal Record
        onUpdateStatus(record, RecordStatus.COMPLETED_WORK);
      }
    }
  };

  const handleMarkAsChecked = async (record: RecordFile) => {
    if (
      await confirmAction(
        `Xác nhận đã kiểm tra hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đã kiểm tra".`,
      )
    ) {
      onUpdateStatus(record, RecordStatus.CHECKED);
    }
  };

  const handleForwardToSign = async (record: RecordFile) => {
    setSubmitTargetRecords([record]);
    setIsSubmitModalOpen(true);
  };

  const handleForwardToCheck = async (record: RecordFile) => {
    setSubmitTargetRecords([record]);
    setIsSubmitCheckModalOpen(true);
  };

  const handleSignRecord = async (record: RecordFile) => {
    if (
      await confirmAction(
        `Xác nhận ký duyệt hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Chờ bàn giao" (Đã ký).`
      )
    ) {
      const nowIso = new Date().toISOString();
      if (
        record.recordType === "Sao lục" ||
        record.recordType === "Công văn" ||
        isArchiveRecordType(record.recordType)
      ) {
        const historyEntry = {
          action: "Ký duyệt",
          status: "signed",
          timestamp: nowIso,
          user: user.name,
        };
        const currentArchive = archiveRecords.find((r) => r.id === record.id);
        if (currentArchive) {
          const oldHistory = Array.isArray(currentArchive.data?.history)
            ? currentArchive.data.history
            : [];
          const newHistory = [...oldHistory, historyEntry];
          await saveArchiveRecord({
            ...currentArchive,
            id: record.id,
            status: "signed",
            so_hieu: currentArchive.so_hieu || record.code || '',
            noi_nhan_gui: currentArchive.noi_nhan_gui || record.customerName || '',
            trich_yeu: currentArchive.trich_yeu || record.content || '',
            data: {
              ...currentArchive.data,
              history: newHistory,
              approvalDate: nowIso,
            },
          });
          const saoluc = await fetchArchiveRecords("saoluc");
          const congvan = await fetchArchiveRecords("congvan");
          setArchiveRecords([...saoluc, ...congvan]);
        }
      } else {
        const updatedRecord: RecordFile = {
          ...record,
          status: RecordStatus.SIGNED,
          approvalDate: nowIso,
        };
        if (onUpdateRecord) {
          await onUpdateRecord(updatedRecord);
        } else {
          await updateRecordApi(updatedRecord);
          onUpdateStatus(record, RecordStatus.SIGNED);
        }
      }
    }
  };

  const handleConfirmSubmit = async (directorId: string) => {
    const targets = [...submitTargetRecords];
    if (targets.length === 0) return;

    // 1. Đóng modal ngay lập tức và làm mới danh sách đã chọn để trải nghiệm tức thì, không giật lag
    setIsSubmitModalOpen(false);
    setSubmitTargetRecords([]);

    // 2. Cập nhật Optimistic UI ngay lập tức cho các hồ sơ
    targets.forEach((record) => {
      onUpdateStatus(record, RecordStatus.PENDING_SIGN);
    });

    try {
      const nowIso = new Date().toISOString();
      let hasArchive = false;

      // 3. Xử lý đồng thời (parallel) toàn bộ hồ sơ trong nền
      await Promise.all(
        targets.map(async (record) => {
          if (
            record.recordType === "Sao lục" ||
            record.recordType === "Công văn"
          ) {
            hasArchive = true;
            const historyEntry = {
              action: "Trình ký",
              status: "pending_sign",
              timestamp: nowIso,
              user: user.name,
            };

            const currentArchive = archiveRecords.find((r) => r.id === record.id);
            if (currentArchive) {
              const oldHistory = Array.isArray(currentArchive.data?.history)
                ? currentArchive.data.history
                : [];
              const newHistory = [...oldHistory, historyEntry];

              return saveArchiveRecord({
                ...currentArchive,
                id: record.id,
                status: "pending_sign",
                so_hieu: currentArchive.so_hieu || record.code || '',
                noi_nhan_gui: currentArchive.noi_nhan_gui || record.customerName || '',
                trich_yeu: currentArchive.trich_yeu || record.content || '',
                data: {
                  ...currentArchive.data,
                  history: newHistory,
                  submitted_to: directorId,
                  submittedTo: directorId,
                  submissionDate: nowIso,
                },
              });
            }
          } else {
            // Normal Record
            const updatedRecord: RecordFile = {
              ...record,
              status: RecordStatus.PENDING_SIGN,
              completedWorkDate: record.completedWorkDate || nowIso,
              checkedDate: record.checkedDate || nowIso,
              submittedTo: directorId,
              submissionDate: nowIso,
            };

            if (onUpdateRecord) {
              return onUpdateRecord(updatedRecord);
            } else {
              return updateRecordApi(updatedRecord);
            }
          }
        })
      );

      // Làm mới dữ liệu lưu trữ nếu có hồ sơ lưu trữ
      if (hasArchive) {
        const [saoluc, congvan] = await Promise.all([
          fetchArchiveRecords("saoluc"),
          fetchArchiveRecords("congvan"),
        ]);
        setArchiveRecords([...saoluc, ...congvan]);
      }
    } catch (error) {
      console.error("Error submitting records:", error);
    }
  };

  const getAnnexContractCode = (recordCode: string, contractsList: Contract[]): string => {
    const recCode = (recordCode || "").trim();
    if (!recCode) return "";

    const cleanRecCode = recCode.toLowerCase();
    const foundContract = contractsList.find(
      (c) =>
        (c.customerAddress && c.customerAddress.trim().toLowerCase() === cleanRecCode) ||
        (c.code && c.code.trim().toLowerCase() === cleanRecCode)
    );

    const rawContractCode = foundContract && foundContract.code ? foundContract.code : recCode;
    const cleanContract = rawContractCode.trim();

    // Nếu trùng với mã số biên nhận hoặc rỗng, giữ nguyên theo mã hợp đồng
    if (!cleanContract) return recCode;
    if (cleanContract.toLowerCase() === cleanRecCode) {
      return cleanContract;
    }

    // Nếu đã có định dạng /HĐDV/ thì giữ nguyên
    if (cleanContract.includes("/HĐDV/")) {
      return cleanContract;
    }

    // Nếu là mã hệ thống (hoặc dạng khác mã biên nhận):
    // Thử tìm chuỗi số từ 2 đến 4 chữ số ở cuối làm số thứ tự (MÃ HĐ)
    const seqMatch = cleanContract.match(/(\d+)$/);
    if (seqMatch) {
      const seq = seqMatch[1]; // Ví dụ: "0521"
      
      // Thử tìm năm 4 chữ số trong mã hợp đồng (ví dụ: "2026")
      const yearMatch = cleanContract.match(/\b(20\d{2})\b/);
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
      
      return `${seq}/HĐDV/${year}`;
    }

    return cleanContract;
  };

  const handleExportAnnex = async (record: RecordFile) => {
    const hasAnnexTemplate = hasTemplate(STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX);
    if (!hasAnnexTemplate) {
      alert(
        "Chưa có mẫu Phụ lục gia hạn hợp đồng nào được cấu hình trong hệ thống.\nVui lòng vào mục Cài đặt hệ thống để cấu hình mẫu này.",
      );
      return;
    }

    // Lấy thời gian mốc hợp đồng
    const dateHD = {
      day: "...",
      month: "...",
      year: "...",
    };

    const rDate = record.receivedDate || record.issueDate;
    if (rDate) {
      const d = new Date(rDate);
      if (!isNaN(d.getTime())) {
        dateHD.day = String(d.getDate()).padStart(2, "0");
        dateHD.month = String(d.getMonth() + 1).padStart(2, "0");
        dateHD.year = String(d.getFullYear());
      }
    }

    const finalContractCode = getAnnexContractCode(record.code || "", contracts);

    const printData = {
      MA_HS: finalContractCode,
      NGAY_HD: dateHD.day,
      THANG_HD: dateHD.month,
      NAM_HD: dateHD.year,
      TEN: (record.customerName || "").toUpperCase(),
      DIACHI: record.address || record.customerAddress || record.ward || "",
      SDT: record.phoneNumber || "",
    };

    try {
      const blob = await generateDocxBlobAsync(
        STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX,
        printData,
      );
      if (blob) {
        const fileName = `Phu_Luc_Gia_Han_${record.code || "HS"}.docx`;

        const electron = (window as any).electronAPI;
        if (electron && electron.saveAndOpenFile) {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            if (!electron?.saveAndOpenFile) return;
            const base64Data = (reader.result as string).split(",")[1];
            const result = await electron.saveAndOpenFile({
              fileName: fileName,
              base64Data: base64Data,
            });
            if (!result.success) {
              alert(`Lỗi khi lưu file: ${result.message}`);
            }
          };
        } else {
          // Web Fallback
          saveAs(blob, fileName);
        }
      }
    } catch (err: any) {
      console.error("Lỗi khi xuất phụ lục:", err);
      alert("Lỗi xuất phụ lục: " + err.message);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "---";
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "---";
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${time} ${d}/${m}`;
  };

  const getDeadlineStatus = (record: RecordFile) => {
    // 1. Kiểm tra nếu đã hoàn thành/xuất hồ sơ thì KHÔNG tính trễ hạn
    // Nếu có exportBatch hoặc exportDate hoặc status là HANDOVER/RETURNED/SIGNED -> Coi như xong
    if (
      record.status === RecordStatus.HANDOVER ||
      record.status === RecordStatus.RETURNED ||
      record.status === RecordStatus.WITHDRAWN ||
      record.status === RecordStatus.REJECTED ||
      record.status === RecordStatus.SIGNED ||
      record.exportBatch ||
      record.exportDate ||
      record.resultReturnedDate
    ) {
      return { color: "text-gray-600", icon: null, text: "" };
    }

    // 2. Nếu chưa xong, kiểm tra deadline
    const deadlineStr = record.deadline;
    if (!deadlineStr) return { color: "text-gray-600", icon: null, text: "" };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineStr);
    deadline.setHours(0, 0, 0, 0);

    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0)
      return {
        color: "text-red-600 font-bold",
        icon: <AlertCircle size={14} />,
        text: "(Quá hạn)",
      };
    if (diffDays <= 2)
      return {
        color: "text-orange-600 font-bold",
        icon: <Clock size={14} />,
        text: "(Gấp)",
      };
    return { color: "text-gray-600", icon: null, text: "" };
  };

  const renderSortHeader = (label: string, key: keyof RecordFile) => {
    const isSorted = sortConfig.key === key;
    return (
      <div
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => handleSort(key)}
      >
        {label}
        <span className="text-gray-400">
          {isSorted ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp size={12} className="text-blue-600" />
            ) : (
              <ArrowDown size={12} className="text-blue-600" />
            )
          ) : (
            <ArrowUpDown size={12} />
          )}
        </span>
      </div>
    );
  };

  // Helper để lấy tên Tab hiện tại cho placeholder
  const getTabLabel = () => {
    switch (activeTab) {
      case "all":
        return "Tất cả hồ sơ";
      case "pending":
        return "Đang thực hiện";
      case "pending_check":
        return "Kiểm tra";
      case "pending_sign":
        return "Trình ký";
      case "finished":
        return "Hoàn thành";
      case "reminder":
        return "Nhắc việc";
      default:
        return "danh sách";
    }
  };

  if (!user.employeeId) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="bg-orange-100 p-4 rounded-full mb-4">
          <UserCog size={48} className="text-orange-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Tài khoản chưa liên kết nhân sự
        </h2>
        <p className="text-gray-600 max-w-md mb-6">
          Tài khoản <strong>{user.username}</strong> hiện là quản trị viên hệ
          thống nhưng chưa được liên kết với hồ sơ nhân viên cụ thể.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up overflow-hidden">
      {/* Header thống kê */}
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 shrink-0">
        <div className="text-center md:text-left w-full md:w-auto">
          <h2 className="text-lg md:text-2xl font-bold text-gray-800 flex items-center justify-center md:justify-start gap-1.5 md:gap-2">
            <Briefcase className="text-blue-600 w-5 h-5 md:w-6 md:h-6" />
            Xin chào, {user.name}
          </h2>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5 md:mt-1">
            Danh sách hồ sơ bạn đang phụ trách.
          </p>
        </div>
        <div className={`grid ${isChecker || isMeasurementTeam ? "grid-cols-5" : "grid-cols-4"} sm:flex gap-1.5 md:gap-3 w-full md:w-auto justify-center`}>
          <div 
            onClick={() => { setActiveTab("all"); setCurrentPage(1); setSearchTerm(""); }}
            className={`cursor-pointer active:scale-95 transition-all text-center px-3 py-2.5 bg-slate-50 rounded-lg border ${activeTab === "all" ? "ring-2 ring-slate-600 border-slate-500 font-extrabold shadow-sm bg-slate-100" : "border-slate-200 hover:border-slate-400"} min-w-0 md:min-w-[100px] flex flex-col justify-center`}
            title="Xem tất cả hồ sơ"
          >
            <div className="text-xs md:text-sm text-slate-700 uppercase font-bold tracking-wide leading-tight">
              Tất cả
            </div>
          </div>
          <div 
            onClick={() => { setActiveTab("pending"); setCurrentPage(1); setSearchTerm(""); }}
            className={`cursor-pointer active:scale-95 transition-all text-center px-3 py-2.5 bg-blue-50/60 rounded-lg border ${activeTab === "pending" ? "ring-2 ring-blue-500 border-blue-400 font-extrabold shadow-sm bg-blue-50" : "border-blue-100 hover:border-blue-300"} min-w-0 md:min-w-[110px] flex flex-col justify-center`}
            title="Xem danh sách đang thực hiện"
          >
            <div className="text-xs md:text-sm text-blue-700 uppercase font-bold tracking-wide leading-tight">
              Đang thực hiện
            </div>
          </div>
          {(isChecker || isMeasurementTeam) && (
            <div 
              onClick={() => { setActiveTab("pending_check"); setCurrentPage(1); setSearchTerm(""); }}
              className={`cursor-pointer active:scale-95 transition-all text-center px-3 py-2.5 bg-orange-50/60 rounded-lg border ${activeTab === "pending_check" ? "ring-2 ring-orange-500 border-orange-400 font-extrabold shadow-sm bg-orange-50" : "border-orange-100 hover:border-orange-300"} min-w-0 md:min-w-[110px] flex flex-col justify-center`}
              title="Xem danh sách kiểm tra"
            >
              <div className="text-xs md:text-sm text-orange-700 uppercase font-bold tracking-wide leading-tight">
                Kiểm tra
              </div>
            </div>
          )}
          <div 
            onClick={() => { setActiveTab("pending_sign"); setCurrentPage(1); setSearchTerm(""); }}
            className={`cursor-pointer active:scale-95 transition-all text-center px-3 py-2.5 bg-purple-50/60 rounded-lg border ${activeTab === "pending_sign" ? "ring-2 ring-purple-500 border-purple-400 font-extrabold shadow-sm bg-purple-50" : "border-purple-100 hover:border-purple-300"} min-w-0 md:min-w-[110px] flex flex-col justify-center`}
            title="Xem danh sách trình ký"
          >
            <div className="text-xs md:text-sm text-purple-700 uppercase font-bold tracking-wide leading-tight">
              Trình ký
            </div>
          </div>
          <div 
            onClick={() => { setActiveTab("finished"); setCurrentPage(1); setSearchTerm(""); }}
            className={`cursor-pointer active:scale-95 transition-all text-center px-3 py-2.5 bg-green-50/60 rounded-lg border ${activeTab === "finished" ? "ring-2 ring-green-500 border-green-400 font-extrabold shadow-sm bg-green-50" : "border-green-100 hover:border-green-300"} min-w-0 md:min-w-[110px] flex flex-col justify-center`}
            title="Xem danh sách hoàn thành"
          >
            <div className="text-xs md:text-sm text-green-700 uppercase font-bold tracking-wide leading-tight">
              Hoàn thành
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-0">
        {/* SEARCH & ACTIONS */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                type="text"
                placeholder={`Tìm trong ${getTabLabel()}...`}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white shadow-sm"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {!isDirector && (
              <button
                onClick={() => {
                  setActiveTab(activeTab === "reminder" ? "pending" : "reminder");
                  setCurrentPage(1);
                  setSearchTerm("");
                }}
                className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shadow-sm border ${
                  activeTab === "reminder"
                    ? "bg-pink-600 text-white border-pink-700"
                    : "bg-white text-pink-700 border-pink-200 hover:bg-pink-50"
                }`}
                title={`Nhắc việc (${reminderRecords.length})`}
              >
                <Bell size={16} />
                <span>({reminderRecords.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 w-full md:w-auto">
            {/* LỌC BUTTON (POPOVER LIKE ĐO ĐẠC) */}
            <div className="relative inline-block" ref={filterPopoverRef}>
              <button
                onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 ${
                  activeFilterCount > 0
                    ? "border-blue-300 text-blue-700 bg-blue-50/50"
                    : ""
                }`}
                title="Mở bộ lọc tìm kiếm"
              >
                <Filter size={16} />
                {activeFilterCount > 0 && (
                  <span className="bg-red-500 text-white text-[11px] px-1.5 py-0.2 rounded-full font-extrabold">
                    {activeFilterCount}
                  </span>
                )}
                {isFilterPopoverOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {/* POPOVER DROPDOWN CARD */}
              {isFilterPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-fade-in text-gray-800">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                    <div className="flex items-center gap-2 font-bold text-blue-700 text-base">
                      <Filter size={18} />
                      <span>Bộ lọc tìm kiếm</span>
                    </div>
                    <button
                      onClick={() => setIsFilterPopoverOpen(false)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
                    {/* 1. Thời gian */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                        <Calendar size={14} className="text-gray-500" />
                        <span>Thời gian:</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Từ ngày</span>
                          <input
                            type="date"
                            value={filterFromDate}
                            onChange={(e) => setFilterFromDate(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Đến ngày</span>
                          <input
                            type="date"
                            value={filterToDate}
                            onChange={(e) => setFilterToDate(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Loại hồ sơ */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                        <Filter size={14} className="text-gray-500" />
                        <span>Loại hồ sơ:</span>
                      </label>
                      <select
                        value={filterRecordType}
                        onChange={(e) => setFilterRecordType(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">Tất cả loại HS</option>
                        {availableRecordTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Trạng thái hồ sơ */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                        <SlidersHorizontal size={14} className="text-gray-500" />
                        <span>Trạng thái hồ sơ:</span>
                      </label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">Mọi trạng thái</option>
                        <option value={RecordStatus.RECEIVED}>Đã tiếp nhận</option>
                        <option value={RecordStatus.ASSIGNED}>Đã giao việc</option>
                        <option value={RecordStatus.IN_PROGRESS}>Đang thực hiện</option>
                        <option value={RecordStatus.COMPLETED_WORK}>Đã xong việc</option>
                        <option value={RecordStatus.PENDING_CHECK}>Chờ kiểm tra</option>
                        <option value={RecordStatus.CHECKED}>Đã kiểm tra</option>
                        <option value={RecordStatus.PENDING_SIGN}>Chờ ký</option>
                        <option value={RecordStatus.SIGNED}>Đã ký</option>
                        <option value={RecordStatus.HANDOVER}>Đã bàn giao</option>
                        <option value={RecordStatus.RETURNED}>Đã trả kết quả</option>
                      </select>
                    </div>

                    {/* Reset Button */}
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setFilterFromDate("");
                          setFilterToDate("");
                          setFilterRecordType("all");
                          setFilterStatus("all");
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

            {/* XUẤT EXCEL BUTTON WITH EMBEDDED RECORD COUNT PILL */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 rounded-lg text-sm font-bold transition-all whitespace-nowrap shadow-xs cursor-pointer ml-auto md:ml-0"
              title="Xuất danh sách hồ sơ ra file Excel"
            >
              <FileDown size={16} className="text-emerald-600" />
              <span>Xuất Excel</span>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-extrabold tracking-wide">
                {displayRecords.length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {displayRecords.length > 0 ? (
            <>
              {/* Desktop view (Table) */}
              <div className="hidden md:block">
                <table className="w-full text-left table-fixed min-w-[1160px]">
                  <thead className="bg-white border-b border-gray-200 text-xs text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3 w-[120px]">
                        {renderSortHeader("Mã HS", "code")}
                      </th>
                      <th className="p-3 w-[180px]">
                        {renderSortHeader("Chủ sử dụng", "customerName")}
                      </th>
                      <th className="p-3 w-[115px]">
                        {renderSortHeader("Loại hồ sơ", "recordType")}
                      </th>
                      <th className="p-3 w-[130px]">
                        {renderSortHeader("Ngày giao việc", "assignedDate")}
                      </th>
                      <th className="p-3 w-[110px]">
                        {renderSortHeader("Ngày trình", "submissionDate")}
                      </th>

                      <th className="p-3 w-[150px]">
                        {activeTab === "reminder" ? (
                          <div className="flex items-center gap-1 text-pink-600">
                            <CalendarClock size={14} /> Thời gian nhắc
                          </div>
                        ) : (
                          renderSortHeader("Hẹn trả", "deadline")
                        )}
                      </th>

                      {activeTab === "pending_check" && (
                        <th className="p-3 w-[150px]">Người kiểm tra</th>
                      )}

                      <th className="p-3 text-center w-[120px]">Trạng thái</th>
                      <th className="p-3 text-center w-[100px]">Chỉnh lý</th>
                      <th className="p-3 text-center w-[180px]">Thao tác chính</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {paginatedDisplayRecords.map((r, index) => {
                      const deadlineStatus = getDeadlineStatus(r);
                      const rowClass =
                        activeTab === "reminder"
                          ? "hover:bg-pink-50/50 bg-pink-50/10"
                          : "hover:bg-blue-50/50";

                      return (
                        <tr key={r.id} className={`${rowClass} transition-colors`}>
                          <td className="p-3 text-center text-gray-400 text-xs align-middle">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="p-3 font-medium text-blue-600 align-middle">
                            <div className="truncate" title={r.code || ""}>
                              {r.code}
                            </div>
                          </td>
                          <td className="p-3 font-medium text-gray-800 align-middle">
                            <div className="truncate" title={r.customerName || ""}>
                              {r.customerName}
                            </div>
                          </td>
                          <td className="p-3 text-gray-600 align-middle">
                            <div className="truncate" title={r.recordType || ""}>
                              {getShortRecordType(r.recordType || undefined)}
                            </div>
                          </td>
                          <td className="p-3 text-gray-600 align-middle text-center">
                            {formatDate(r.assignedDate || undefined)}
                          </td>
                          <td className="p-3 text-gray-600 align-middle text-center">
                            {formatDate(r.submissionDate || undefined)}
                          </td>

                          <td className="p-3 align-middle">
                            {activeTab === "reminder" ? (
                              <div className="flex items-center gap-1.5 text-pink-700 font-bold bg-pink-100 px-2 py-1 rounded w-fit text-xs">
                                <Bell size={12} className="fill-pink-700" />
                                {formatDateTime(r.reminderDate || undefined)}
                              </div>
                            ) : (
                              <div
                                className={`flex items-center gap-1.5 ${deadlineStatus.color}`}
                              >
                                {deadlineStatus.icon}
                                <span>{formatDate(r.deadline || undefined)}</span>
                                <span className="text-[10px] uppercase ml-1">
                                  {deadlineStatus.text}
                                </span>
                              </div>
                            )}
                          </td>

                          {activeTab === "pending_check" && (
                            <td className="p-3 text-gray-600 align-middle">
                              <div
                                className="truncate"
                                title={
                                  r.checkedBy
                                    ? employees.find((e) => e.id === r.checkedBy)
                                        ?.name
                                    : ""
                                }
                              >
                                {r.checkedBy
                                  ? employees.find((e) => e.id === r.checkedBy)
                                      ?.name
                                  : "---"}
                              </div>
                            </td>
                          )}

                          <td className="p-3 text-center align-middle">
                            <StatusBadge status={r.status} />
                          </td>

                          <td className="p-3 text-center align-middle">
                            {onMapCorrection && !(isArchiveRecordType(r.recordType || '') || r.sourceTable === 'luutru_records') && (
                              <button
                                onClick={() => onMapCorrection(r)}
                                className={`flex items-center justify-center gap-1 px-2 py-1 rounded border transition-all text-[10px] font-bold shadow-sm mx-auto ${
                                  r.needsMapCorrection
                                    ? "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 w-full"
                                    : "bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50"
                                }`}
                                title={
                                  r.needsMapCorrection
                                    ? "Đang có yêu cầu. Bấm để HỦY."
                                    : "Yêu cầu chỉnh lý bản đồ"
                                }
                              >
                                <MapIcon
                                  size={14}
                                  className={
                                    r.needsMapCorrection ? "fill-orange-100" : ""
                                  }
                                />
                                {r.needsMapCorrection && <span>CHỈNH LÝ</span>}
                              </button>
                            )}
                          </td>

                          <td className="p-3 align-middle">
                            <div className="flex justify-center gap-2 flex-wrap">
                              <button
                                onClick={() => onViewRecord(r)}
                                className="px-2 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-white hover:border-blue-300 hover:text-blue-600 text-xs font-medium transition-all shadow-sm"
                              >
                                Chi tiết
                              </button>

                              {/* Nút Trả hồ sơ (Ghi chú nội bộ) cho cá nhân */}
                              {activeTab === "pending" && (
                                <button
                                  onClick={() => handleOpenReturnModal(r)}
                                  title="Ghi nhận lý do trả hồ sơ vào ghi chú nội bộ để tiếp tục quy trình kiểm tra, trình ký"
                                  className="px-2 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 hover:text-red-700 text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                                >
                                  <FileX size={14} /> Trả hồ sơ
                                </button>
                              )}

                              {/* Logic nút chuyển trạng thái theo từng Tab */}
                              {activeTab === "pending" &&
                                (isArchiveRecordType(r.recordType) ? (
                                  <button
                                    onClick={() => handleForwardToSign(r)}
                                    title="Trình ký"
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                                  >
                                    <Send size={14} /> Trình ký
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleForwardToCheck(r)}
                                    title="Trình kiểm tra"
                                    className="px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                                  >
                                    <ClipboardList size={14} /> Trình kiểm tra
                                  </button>
                                ))}

                              {activeTab === "pending_check" &&
                                (r.status === RecordStatus.PENDING_CHECK ||
                                  r.status === RecordStatus.CHECKED) &&
                                isChecker && (
                                  <button
                                    onClick={() => handleForwardToSign(r)}
                                    title="Trình ký"
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                                  >
                                    <Send size={14} /> Trình ký
                                  </button>
                                )}

                              {isDirectorUser && r.status === RecordStatus.PENDING_SIGN && (
                                <button
                                  onClick={() => handleSignRecord(r)}
                                  title="Ký duyệt hồ sơ"
                                  className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                  <FileCheck size={14} /> Ký duyệt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View (20 items per batch + Xem thêm) */}
              <div className="block md:hidden space-y-3 p-1">
                {displayRecords.slice(0, mobileVisibleCount).map((r, index) => {
                  const deadlineStatus = getDeadlineStatus(r);
                  const isArchiveType = isArchiveRecordType(r.recordType);
                  const checkerEmp = r.checkedBy ? employees.find((e) => e.id === r.checkedBy) : null;

                  return (
                    <div key={r.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-3 hover:border-blue-200 transition-all">
                      {/* Top row with code and status */}
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-600 text-sm font-mono">{r.code}</span>
                        <div className="flex items-center gap-1.5">
                          {r.needsMapCorrection && (
                            <span className="p-1 bg-orange-100 text-orange-600 rounded" title="Cần chỉnh lý bản đồ">
                              <MapIcon size={12} className="fill-orange-100" />
                            </span>
                          )}
                          <StatusBadge status={r.status} />
                        </div>
                      </div>

                      {/* Info grid using icons/symbols */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5 col-span-2">
                          <span className="text-gray-400 font-bold" title="Chủ sử dụng">👤</span>
                          <span className="font-semibold text-gray-800 truncate">{r.customerName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <span className="text-gray-400 font-bold" title="Loại hồ sơ">📄</span>
                          <span className="truncate" title={r.recordType || ""}>{getShortRecordType(r.recordType || undefined)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 font-bold" title="Ngày giao">📥</span>
                          <span>{formatDate(r.assignedDate || undefined) || "---"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 font-bold" title="Ngày trình">📤</span>
                          <span>{formatDate(r.submissionDate || undefined) || "---"}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 col-span-2">
                          {activeTab === "reminder" ? (
                            <div className="flex items-center gap-1 text-pink-700 font-bold bg-pink-50 px-2 py-0.5 rounded text-[11px]">
                              <Bell size={10} className="fill-pink-700" />
                              <span>Nhắc: {formatDateTime(r.reminderDate || undefined)}</span>
                            </div>
                          ) : (
                            <div className={`flex items-center gap-1 ${deadlineStatus.color} font-medium`}>
                              {deadlineStatus.icon || <Clock size={12} />}
                              <span>Hẹn trả: {formatDate(r.deadline || undefined)}</span>
                              <span className="text-[9px] uppercase px-1 bg-current/10 rounded ml-1">
                                {deadlineStatus.text}
                              </span>
                            </div>
                          )}
                        </div>

                        {activeTab === "pending_check" && r.checkedBy && (
                          <div className="flex items-center gap-1.5 col-span-2 text-gray-500">
                            <span>🔍 Người KT:</span>
                            <span className="font-medium text-gray-700">
                              {employees.find((e) => e.id === r.checkedBy)?.name || "---"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="border-t border-gray-100 pt-3 flex justify-between items-center gap-2">
                        {onMapCorrection && !(isArchiveRecordType(r.recordType || '') || r.sourceTable === 'luutru_records') && (
                          <button
                            onClick={() => onMapCorrection(r)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              r.needsMapCorrection
                                ? "bg-orange-50 text-orange-600 border-orange-200"
                                : "bg-white text-gray-400 border-gray-200"
                            }`}
                            title={r.needsMapCorrection ? "Hủy yêu cầu chỉnh lý bản đồ" : "Yêu cầu chỉnh lý bản đồ"}
                          >
                            <MapIcon size={14} className={r.needsMapCorrection ? "fill-orange-100" : ""} />
                          </button>
                        )}

                        <div className="flex gap-1.5 ml-auto flex-wrap justify-end">
                          <button
                            onClick={() => onViewRecord(r)}
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 text-xs font-medium"
                          >
                            Chi tiết
                          </button>

                          {activeTab === "pending" && (
                            <button
                              onClick={() => handleOpenReturnModal(r)}
                              className="px-2.5 py-1.5 border border-red-200 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-100 transition-all"
                              title="Trả hồ sơ"
                            >
                              <FileX size={14} /> Trả hồ sơ
                            </button>
                          )}

                          {activeTab === "pending" &&
                            (isArchiveType ? (
                              <button
                                onClick={() => handleForwardToSign(r)}
                                className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                              >
                                <Send size={12} /> Trình ký
                              </button>
                            ) : (
                              <button
                                onClick={() => handleForwardToCheck(r)}
                                className="px-2.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                              >
                                <ClipboardList size={12} /> Trình KT
                              </button>
                            ))}

                          {activeTab === "pending_check" &&
                            (r.status === RecordStatus.PENDING_CHECK ||
                              r.status === RecordStatus.CHECKED) &&
                            isChecker && (
                              <button
                                onClick={() => handleForwardToSign(r)}
                                className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                              >
                                <Send size={12} /> Trình ký
                              </button>
                            )}

                          {isDirectorUser && r.status === RecordStatus.PENDING_SIGN && (
                            <button
                              onClick={() => handleSignRecord(r)}
                              className="px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                              title="Ký duyệt hồ sơ"
                            >
                              <FileCheck size={12} /> Ký duyệt
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {displayRecords.length > mobileVisibleCount && (
                  <div className="pt-4 pb-6 flex flex-col items-center gap-2">
                    <button 
                      onClick={() => setMobileVisibleCount(prev => prev + 20)}
                      className="w-full max-w-sm py-2.5 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Xem thêm {displayRecords.length - mobileVisibleCount} hồ sơ
                    </button>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Đang hiển thị {Math.min(mobileVisibleCount, displayRecords.length)} / {displayRecords.length} hồ sơ
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <CheckCircle size={48} className="text-gray-200 mb-2" />
              <p>
                {searchTerm
                  ? "Không tìm thấy hồ sơ phù hợp."
                  : "Không có hồ sơ nào trong danh sách này."}
              </p>
            </div>
          )}
        </div>

        {/* PAGINATION FOOTER (Desktop only; mobile uses smooth infinite scroll) */}
        {displayRecords.length > 0 && (
          <div className="border-t border-gray-100 p-3 bg-gray-50 hidden md:flex justify-between items-center shrink-0">
            <span className="text-xs text-gray-500">
              Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> -{" "}
              <strong>
                {Math.min(currentPage * itemsPerPage, displayRecords.length)}
              </strong>{" "}
              trên tổng <strong>{displayRecords.length}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs font-medium mx-2">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <SubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        records={submitTargetRecords}
        users={users}
        employees={employees}
        onConfirm={handleConfirmSubmit}
      />

      <SubmitModal
        isOpen={isSubmitCheckModalOpen}
        onClose={() => setIsSubmitCheckModalOpen(false)}
        records={submitTargetRecords}
        users={users}
        employees={employees}
        isCheckMode={true}
        onConfirm={async (checkerId) => {
          const targets = [...submitTargetRecords];
          if (targets.length === 0) return;

          // 1. Đóng modal ngay lập tức và làm mới danh sách đã chọn để trải nghiệm tức thì, không giật lag
          setIsSubmitCheckModalOpen(false);
          setSubmitTargetRecords([]);

          // 2. Cập nhật Optimistic UI ngay lập tức
          targets.forEach((record) => {
            onUpdateStatus(record, RecordStatus.PENDING_CHECK);
          });

          try {
            const nowIso = new Date().toISOString();
            let hasArchive = false;

            // 3. Xử lý đồng thời (parallel) toàn bộ hồ sơ trong nền
            await Promise.all(
              targets.map(async (record) => {
                if (isArchiveRecordType(record.recordType)) {
                  hasArchive = true;
                  const historyEntry = {
                    action: "Trình kiểm tra",
                    status: "pending_check",
                    timestamp: nowIso,
                    user: user.name,
                  };

                  const currentArchive = archiveRecords.find(
                    (r) => r.id === record.id,
                  );
                  if (currentArchive) {
                    const oldHistory = Array.isArray(currentArchive.data?.history)
                      ? currentArchive.data.history
                      : [];
                    const newHistory = [...oldHistory, historyEntry];

                    return saveArchiveRecord({
                      ...currentArchive,
                      id: record.id,
                      status: "pending_check",
                      so_hieu: currentArchive.so_hieu || record.code || '',
                      noi_nhan_gui: currentArchive.noi_nhan_gui || record.customerName || '',
                      trich_yeu: currentArchive.trich_yeu || record.content || '',
                      data: {
                        ...currentArchive.data,
                        history: newHistory,
                        checked_by: checkerId,
                        checkedBy: checkerId,
                      },
                    });
                  }
                } else {
                  // Hồ sơ Đo đạc thường
                  const updatedRecord: RecordFile = {
                    ...record,
                    status: RecordStatus.PENDING_CHECK,
                    completedWorkDate: record.completedWorkDate || nowIso,
                    pendingCheckDate: nowIso,
                    checkedBy: checkerId,
                  };

                  if (onUpdateRecord) {
                    return onUpdateRecord(updatedRecord);
                  } else {
                    return updateRecordApi(updatedRecord);
                  }
                }
              })
            );

            // Làm mới dữ liệu lưu trữ nếu có hồ sơ lưu trữ
            if (hasArchive) {
              const [saoluc, congvan] = await Promise.all([
                fetchArchiveRecords("saoluc"),
                fetchArchiveRecords("congvan"),
              ]);
              setArchiveRecords([...saoluc, ...congvan]);
            }
          } catch (err) {
            console.error("Lỗi khi trình kiểm tra:", err);
          }
        }}
      />

      {isAnnexModalOpen && annexTargetRecord && (
        <SystemAnnexTemplate
          data={{
            ...annexTargetRecord,
            code: getAnnexContractCode(annexTargetRecord.code || "", contracts)
          }}
          employees={employees}
          onClose={() => {
            setIsAnnexModalOpen(false);
            setAnnexTargetRecord(null);
          }}
        />
      )}

      {/* Hộp thoại Trả hồ sơ / Trả về bước trước */}
      {returnModalConfig.isOpen && returnModalConfig.record && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-fade-in-up">
            {/* Header */}
            <div className={`p-5 text-white flex items-center gap-2 ${
              returnModalConfig.type === 'return_record' ? 'bg-gradient-to-r from-red-600 to-red-500' : 'bg-gradient-to-r from-amber-500 to-amber-600'
            }`}>
              {returnModalConfig.type === 'return_record' ? <FileX size={20} /> : <Undo size={20} />}
              <div>
                <h3 className="font-bold text-lg leading-tight">
                  Trả Hồ Sơ
                </h3>
                <p className="text-xs text-white/80 mt-0.5">
                  Mã hồ sơ: <span className="font-mono font-bold text-white">{returnModalConfig.record.code}</span>
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Lý do trả hồ sơ
                </label>
                <textarea
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none font-medium"
                  placeholder="Nhập lý do trả hồ sơ (sẽ lưu vào Ghi chú nội bộ)..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReturnModalConfig({ isOpen: false, record: null, type: "return_record" })}
                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold text-sm active:scale-95 transition-all shadow-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReturnModal}
                className={`px-4 py-2.5 text-white rounded-xl font-bold text-sm active:scale-95 transition-all shadow-sm flex items-center gap-1.5 ${
                  returnModalConfig.type === 'return_record'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-100'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
                }`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalProfile;
