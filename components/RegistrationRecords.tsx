import React, { useState, useEffect, useMemo } from 'react';
import { User, DangKyRecord, DangKyParty, DangKyStatusType, DANG_KY_STATUS_LIST, Employee, RecordFile, DANG_KY_RECORD_TYPES, DANG_KY_DEADLINE_MAP } from '../types';
import { fetchEmployees } from '../services/apiPeople';
import { 
  fetchDangKyRecords, 
  saveDangKyRecordApi, 
  deleteDangKyRecordApi, 
  bulkDeleteDangKyRecordsApi,
  bulkUpdateDangKyRecordsApi,
  normalizeDangKyStatus
} from '../services/apiDangKy';
import { 
  ClipboardList, Plus, Search, Filter, RefreshCw, FileSpreadsheet, 
  Trash2, Edit, Edit3, X, UserPlus, Users, CheckCircle2, 
  ArrowUpDown, BookOpen, Layers, Shield, FileText, DollarSign, Calendar,
  Eye, ArrowRight, Phone, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MapPin, Send, CornerUpLeft,
  Lock, Printer, Download, AlertCircle, FileSignature, AlertTriangle, Clock
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import AssignModal from './AssignModal';
import { RejectReturnStepModal, ReturnOptionType } from './RejectReturnStepModal';
import ExcelPreviewModal from './ExcelPreviewModal';
import DangKyDetailModal from './DangKyDetailModal';
import DangKyRecordModal from './DangKyRecordModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { 
  removeVietnameseTones,
  isDangKyRecordOverdue,
  isDangKyRecordApproaching
} from '../utils/appHelpers';
import { addActivityLog } from '../services/activityLogService';

const NEXT_STATUS_MAP: Record<DangKyStatusType, DangKyStatusType> = {
  'Tiếp nhận mới': 'Thẩm định',
  'Thẩm định': 'Phiếu chuyển thuế',
  'Phiếu chuyển thuế': 'Chờ Thuế KV7',
  'Chờ Thuế KV7': 'Chờ giấy nộp tiền',
  'Chờ giấy nộp tiền': 'Chờ In GCN',
  'Chờ In GCN': 'Chờ kiểm tra',
  'Chờ kiểm tra': 'Chờ ký duyệt',
  'Chờ ký duyệt': 'Chờ bàn giao',
  'Chờ bàn giao': 'Đã giao 1 cửa',
  'Đã giao 1 cửa': 'Đã trả kết quả',
  'Đã trả kết quả': 'Đã trả kết quả',
  'Chờ bổ sung': 'Thẩm định',
  'CSD rút HS': 'CSD rút HS',
  'Trả hủy hồ sơ': 'Trả hủy hồ sơ'
};

interface RegistrationRecordsProps {
    currentUser: User;
    wards: string[];
    holidays?: any[];
}

const getStatusBadgeClass = (status: DangKyStatusType) => {
    switch (status) {
        case 'Tiếp nhận mới':
            return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'Thẩm định':
            return 'bg-purple-100 text-purple-800 border-purple-300';
        case 'Phiếu chuyển thuế':
            return 'bg-amber-100 text-amber-800 border-amber-300';
        case 'Chờ Thuế KV7':
            return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'Chờ giấy nộp tiền':
            return 'bg-orange-100 text-orange-800 border-orange-300';
        case 'Chờ In GCN':
            return 'bg-indigo-100 text-indigo-800 border-indigo-300';
        case 'Chờ kiểm tra':
            return 'bg-cyan-100 text-cyan-800 border-cyan-300';
        case 'Chờ ký duyệt':
            return 'bg-teal-100 text-teal-800 border-teal-300';
        case 'Chờ bàn giao':
            return 'bg-sky-100 text-sky-800 border-sky-300';
        case 'Đã giao 1 cửa':
            return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        case 'Đã trả kết quả':
            return 'bg-green-100 text-green-800 border-green-300';
        case 'Chờ bổ sung':
            return 'bg-rose-100 text-rose-800 border-rose-300';
        case 'CSD rút HS':
            return 'bg-slate-100 text-slate-700 border-slate-300';
        case 'Trả hủy hồ sơ':
            return 'bg-red-100 text-red-800 border-red-300';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-300';
    }
};

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const dateOnly = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = dateOnly.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
};

const formatCurrency = (amount?: number | string) => {
    if (!amount) return '0 ₫';
    const num = Number(amount);
    if (isNaN(num)) return '0 ₫';
    return num.toLocaleString('vi-VN') + ' ₫';
};

type MainTabType = 'all' | 'unassigned' | 'tbt' | 'in_gcn' | 'kiem_tra' | 'trinh_ky' | 'giao_1_cua';
type TbtSubTabType = 'tham_dinh' | 'phieu_chuyen_thue' | 'thue_kv7' | 'thong_bao_thue';
type Giao1CuaSubTabType = 'cho_ban_giao' | 'cho_tra_kq' | 'da_tra_kq';

const RegistrationRecords: React.FC<RegistrationRecordsProps> = ({ currentUser, wards, holidays = [] }) => {
    // Workflow Tabs State
    const [activeMainTab, setActiveMainTab] = useState<MainTabType>('all');
    const [activeTbtSubTab, setActiveTbtSubTab] = useState<TbtSubTabType>('tham_dinh');
    const [activeGiao1CuaSubTab, setActiveGiao1CuaSubTab] = useState<Giao1CuaSubTabType>('cho_ban_giao');
    
    // Data & Loading
    const [records, setRecords] = useState<DangKyRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Filters & Pagination
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
    const [selectedWardFilter, setSelectedWardFilter] = useState<string>('all');
    const [selectedRecordTypeFilter, setSelectedRecordTypeFilter] = useState<string>('all');
    const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
    const [filterFromDate, setFilterFromDate] = useState<string>('');
    const [filterToDate, setFilterToDate] = useState<string>('');
    const [warningFilter, setWarningFilter] = useState<'all' | 'overdue' | 'approaching'>('all');
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState<boolean>(false);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);

    // Selected Rows for Bulk Action & Modals
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
    const [assignStaffModalOpen, setAssignStaffModalOpen] = useState<boolean>(false);
    const [assignStaffInput, setAssignStaffInput] = useState<string>('');
    const [returnModalOpen, setReturnModalOpen] = useState<boolean>(false);
    const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState<boolean>(false);
    const [isSubmitCheckModalOpen, setIsSubmitCheckModalOpen] = useState<boolean>(false);
    const [isSubmitSignModalOpen, setIsSubmitSignModalOpen] = useState<boolean>(false);
    const [employeesList, setEmployeesList] = useState<Employee[]>([]);

    // --- State Chốt Đợt Bàn Giao 1 Cửa ---
    const [isLockModalOpen, setIsLockModalOpen] = useState<boolean>(false);
    const [lockMode, setLockMode] = useState<'new' | 'existing'>('new');
    const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');

    // --- State Xuất DS Bàn Giao 1 Cửa ---
    const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
    const [selectedExportBatch, setSelectedExportBatch] = useState<string>('all');

    // --- State Preview Excel ---
    const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [previewFileName, setPreviewFileName] = useState<string>('');
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

    // Selected Records Adapted for AssignModal and RejectReturnStepModal
    const selectedDangKyRecords = useMemo(() => {
        return records.filter(r => selectedIds.has(r.id));
    }, [records, selectedIds]);

    const adaptedSelectedRecords = useMemo((): RecordFile[] => {
        return selectedDangKyRecords.map(r => ({
            id: r.id,
            code: r.code || r.id,
            customerName: (r.owners && r.owners.length > 0 ? r.owners.map(o => o.name).filter(Boolean).join(', ') : '') || 'Chưa có tên',
            phoneNumber: '',
            cccd: (r.owners && r.owners.length > 0 ? r.owners.map(o => o.cccd).filter(Boolean).join(', ') : '') || '',
            customerAddress: (r.owners && r.owners.length > 0 ? r.owners.map(o => o.address).filter(Boolean).join(', ') : '') || '',
            ward: r.ward || '',
            landPlot: '',
            mapSheet: '',
            area: r.totalArea ? Number(r.totalArea) : null,
            address: r.ward || '',
            status: r.status as any,
            receivedDate: r.receivedDate || '',
            deadline: r.deadline || '',
            assignedTo: r.appraisalStaff || r.checkedBy || '',
            assignedDate: r.appraisalDate || '',
            notes: r.notes || '',
            recordType: r.recordType || 'Đăng ký biến động',
            bookNumber: r.entryNumber || '',
            certificateCode: r.issueNumber || ''
        } as unknown as RecordFile));
    }, [selectedDangKyRecords]);

    // Count Active Filters
    const exportBatchList = useMemo(() => {
        const batches = new Set<string>();
        records.forEach(r => {
            if (r.exportBatch && r.exportBatch.trim()) {
                batches.add(r.exportBatch.trim());
            }
        });
        return Array.from(batches).sort();
    }, [records]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (selectedStatusFilter !== 'all') count++;
        if (selectedWardFilter !== 'all') count++;
        if (selectedRecordTypeFilter !== 'all') count++;
        if (selectedBatchFilter !== 'all') count++;
        if (filterFromDate) count++;
        if (filterToDate) count++;
        return count;
    }, [selectedStatusFilter, selectedWardFilter, selectedRecordTypeFilter, selectedBatchFilter, filterFromDate, filterToDate]);

    const handleClearFilters = () => {
        setSelectedStatusFilter('all');
        setSelectedWardFilter('all');
        setSelectedRecordTypeFilter('all');
        setSelectedBatchFilter('all');
        setFilterFromDate('');
        setFilterToDate('');
    };

    // Modal state for Detail, Add/Edit & Delete
    const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
    const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<DangKyRecord | null>(null);

    const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
    const [selectedRecordForEdit, setSelectedRecordForEdit] = useState<DangKyRecord | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
    const [recordToDelete, setRecordToDelete] = useState<DangKyRecord | null>(null);

    // Load data
    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchDangKyRecords();
            setRecords(data);
        } catch (e) {
            console.error('Error loading DangKy records:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        fetchEmployees().then(data => setEmployeesList(data || [])).catch(() => {});
    }, []);

    // Tự động chuyển về trang 1 và bỏ chọn khi đổi Tab
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set());
    }, [activeMainTab, activeTbtSubTab, activeGiao1CuaSubTab]);

    // Tự động chuyển về trang 1 khi đổi bộ lọc tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedStatusFilter, selectedWardFilter, selectedBatchFilter, filterFromDate, filterToDate, warningFilter, pageSize]);

    // Tab Record Counts Memo
    const counts = useMemo(() => {
        const all = records.length;
        const unassigned = records.filter(r => (!r.appraisalStaff || r.appraisalStaff.trim() === '') && (!r.checkedBy || r.checkedBy.trim() === '')).length;
        const thamDinh = records.filter(r => normalizeDangKyStatus(r.status) === 'Thẩm định').length;
        
        // TBT Group
        const phieuChuyenThue = records.filter(r => normalizeDangKyStatus(r.status) === 'Phiếu chuyển thuế').length;
        const thueKv7 = records.filter(r => normalizeDangKyStatus(r.status) === 'Chờ Thuế KV7').length;
        const thongBaoThue = records.filter(r => normalizeDangKyStatus(r.status) === 'Chờ giấy nộp tiền').length;
        const tbtTotal = phieuChuyenThue + thueKv7 + thongBaoThue;

        const inGcn = records.filter(r => normalizeDangKyStatus(r.status) === 'Chờ In GCN').length;
        const kiemTra = records.filter(r => normalizeDangKyStatus(r.status) === 'Chờ kiểm tra').length;
        const trinhKy = records.filter(r => normalizeDangKyStatus(r.status) === 'Chờ ký duyệt').length;

        // Giao 1 Cửa Group
        const choBanGiao = records.filter(r => normalizeDangKyStatus(r.status) === 'Chờ bàn giao').length;
        const choTraKq = records.filter(r => normalizeDangKyStatus(r.status) === 'Đã giao 1 cửa').length;
        const daTraKq = records.filter(r => normalizeDangKyStatus(r.status) === 'Đã trả kết quả').length;
        const giao1CuaTotal = choBanGiao + choTraKq + daTraKq;

        // Overdue & Approaching counts
        const overdueCount = records.filter(r => isDangKyRecordOverdue(r)).length;
        const approachingCount = records.filter(r => isDangKyRecordApproaching(r)).length;

        return {
            all,
            unassigned,
            thamDinh,
            phieuChuyenThue,
            thueKv7,
            thongBaoThue,
            tbtTotal,
            inGcn,
            kiemTra,
            trinhKy,
            choBanGiao,
            choTraKq,
            daTraKq,
            giao1CuaTotal,
            overdueCount,
            approachingCount
        };
    }, [records]);

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const todayFmt = useMemo(() => formatDate(todayStr), [todayStr]);

    // Danh sách các đợt đã từng được chốt trong hệ thống
    const historyBatches = useMemo(() => {
        const batchesMap: Record<string, { label: string; date: string; count: number }> = {};
        records.forEach(r => {
            const batchName = r.exportBatch;
            if (batchName && batchName.trim()) {
                const label = batchName.trim();
                const dateStr = r.completedDate || r.resultReturnedDate || r.updatedAt || todayStr;
                if (!batchesMap[label]) {
                    batchesMap[label] = {
                        label,
                        date: dateStr.includes('T') ? dateStr.split('T')[0] : dateStr,
                        count: 0
                    };
                }
                batchesMap[label].count++;
            }
        });

        return Object.values(batchesMap).sort((a, b) => {
            const getNum = (str: string) => {
                const match = str.match(/Đợt\s*(\d+)/i) || str.match(/\d+/);
                return match ? parseInt(match[1] || match[0], 10) : 0;
            };
            return getNum(b.label) - getNum(a.label);
        });
    }, [records, todayStr]);

    // Tính toán đợt tiếp theo
    const nextBatchInfo = useMemo(() => {
        let maxBatch = 0;
        historyBatches.forEach(b => {
            const match = b.label.match(/Đợt\s*(\d+)/i) || b.label.match(/\d+/);
            if (match) {
                const num = parseInt(match[1] || match[0], 10);
                if (num > maxBatch) maxBatch = num;
            }
        });
        const nextNum = maxBatch + 1;
        return {
            num: nextNum,
            label: `Đợt ${nextNum}`
        };
    }, [historyBatches]);

    useEffect(() => {
        if (isLockModalOpen) {
            setLockMode('new');
            if (historyBatches.length > 0) {
                setSelectedExistingBatch(historyBatches[0].label);
            } else {
                setSelectedExistingBatch('');
            }
        }
    }, [isLockModalOpen, historyBatches]);

    useEffect(() => {
        if (isExportModalOpen) {
            if (historyBatches.length > 0) {
                setSelectedExportBatch(historyBatches[0].label);
            } else {
                setSelectedExportBatch('all');
            }
        }
    }, [isExportModalOpen, historyBatches]);

    // Confirm "Chốt DS Bàn Giao"
    const handleConfirmLockBatch = async () => {
        if (selectedIds.size === 0) return;

        let finalBatchName = '';
        if (lockMode === 'new') {
            finalBatchName = nextBatchInfo.label;
        } else {
            if (!selectedExistingBatch) {
                alert('Vui lòng chọn đợt cũ!');
                return;
            }
            finalBatchName = selectedExistingBatch;
        }

        const targetArray = Array.from(selectedIds);
        try {
            await bulkUpdateDangKyRecordsApi(targetArray, {
                exportBatch: finalBatchName,
                status: 'Đã giao 1 cửa',
                completedDate: todayStr
            });
            await loadData();
            alert(`Đã chốt danh sách bàn giao [${finalBatchName}] thành công cho ${selectedIds.size} hồ sơ sang "Đã giao 1 cửa"!`);
            setSelectedIds(new Set());
            setIsLockModalOpen(false);
        } catch (err) {
            console.error('Error locking batch:', err);
            alert('Có lỗi khi chốt đợt bàn giao!');
        }
    };

    // Calculate Export Filtered Records
    const exportTargetRecords = useMemo(() => {
        if (selectedExportBatch === 'all') {
            const batched = records.filter(r => Boolean(r.exportBatch && r.exportBatch.trim()));
            if (batched.length > 0) return batched;
            return records.filter(r => normalizeDangKyStatus(r.status) === 'Chờ bàn giao' || normalizeDangKyStatus(r.status) === 'Đã giao 1 cửa');
        }
        return records.filter(r => r.exportBatch === selectedExportBatch);
    }, [records, selectedExportBatch]);

    // Generate Excel Workbook matching styling standards
    const generateWorkbook = (): { wb: XLSX.WorkBook, fileName: string } | null => {
        if (exportTargetRecords.length === 0) {
            alert('Không có hồ sơ nào thỏa mãn điều kiện xuất!');
            return null;
        }

        let batchNameStr = selectedExportBatch === 'all' ? 'TẤT CẢ CÁC ĐỢT' : selectedExportBatch.toUpperCase();
        if (selectedExportBatch !== 'all' && !/^ĐỢT/i.test(batchNameStr)) {
            batchNameStr = `ĐỢT ${batchNameStr}`;
        }

        const firstBatchRecord = exportTargetRecords.find(r => r.completedDate || r.resultReturnedDate);
        const batchRawDate = firstBatchRecord?.completedDate || firstBatchRecord?.resultReturnedDate || todayStr;
        const batchDateStr = formatDate(batchRawDate);

        let subTitle = "";
        if (selectedExportBatch === 'all') {
            subTitle = `${batchNameStr}  -  TỔNG SỐ HỒ SƠ: ${exportTargetRecords.length}`;
        } else {
            subTitle = `${batchNameStr} - NGÀY ${batchDateStr} - TỔNG SỐ HỒ SƠ: ${exportTargetRecords.length}`;
        }

        const title = "DANH SÁCH BÀN GIAO HỒ SƠ 1 CỬA";

        const tableHeader = [
            "STT", 
            "Mã Hồ Sơ", 
            "Người Đứng Tên GCN / Chủ Sử Dụng", 
            "Địa Danh (Xã/Phường)", 
            "Thửa", 
            "Tờ", 
            "Loại Hồ Sơ", 
            "Hẹn Trả",
            "Số Phát Hành / Vào Sổ"
        ];

        const dataRows = exportTargetRecords.map((r, idx) => {
            const ownerNames = r.owners && r.owners.length > 0 
                ? r.owners.map(o => o.name).filter(Boolean).join(', ') 
                : (r.transferees && r.transferees.length > 0 ? r.transferees.map(t => t.name).filter(Boolean).join(', ') : '');
            const issueOrEntry = [r.issueNumber ? `GCN: ${r.issueNumber}` : '', r.entryNumber ? `Sổ: ${r.entryNumber}` : ''].filter(Boolean).join(' | ');

            return [
                idx + 1,
                r.code || '',
                ownerNames || 'Chưa cập nhật',
                r.ward || '',
                r.landPlot || '',
                r.mapSheet || '',
                r.recordType || 'Cấp giấy',
                formatDate(r.deadline) || '',
                issueOrEntry || r.notes || ''
            ];
        });

        const headerRows = [
            ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
            ["Độc lập - Tự do - Hạnh phúc"],
            [""],
            [title],
            [subTitle],
            ["Kèm theo đầy đủ hồ sơ gốc"],
            [""],
            tableHeader
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(headerRows);

        const dataStartRowIdx = headerRows.length; // 8 (0-indexed -> Row 9)
        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: `A${dataStartRowIdx + 1}` });

        const totalDataRows = dataRows.length;
        const footerStartRowIdx = dataStartRowIdx + totalDataRows + 2;

        const totalCols = tableHeader.length; // 9
        const footerRow1 = new Array(totalCols).fill("");
        footerRow1[1] = "BÊN GIAO HỒ SƠ";
        footerRow1[6] = "BÊN NHẬN HỒ SƠ";

        const footerRow2 = new Array(totalCols).fill("");
        footerRow2[1] = "(Ký và ghi rõ họ tên)";
        footerRow2[6] = "(Ký và ghi rõ họ tên)";

        XLSX.utils.sheet_add_aoa(ws, [footerRow1, footerRow2], { origin: `A${footerStartRowIdx + 1}` });

        const lastColIdx = totalCols - 1; // 8 (A through I)
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: lastColIdx } },
            { s: { r: 4, c: 0 }, e: { r: 4, c: lastColIdx } },
            { s: { r: 5, c: 0 }, e: { r: 5, c: lastColIdx } },
            { s: { r: footerStartRowIdx, c: 1 }, e: { r: footerStartRowIdx, c: 3 } },
            { s: { r: footerStartRowIdx + 1, c: 1 }, e: { r: footerStartRowIdx + 1, c: 3 } },
            { s: { r: footerStartRowIdx, c: 6 }, e: { r: footerStartRowIdx, c: 8 } },
            { s: { r: footerStartRowIdx + 1, c: 6 }, e: { r: footerStartRowIdx + 1, c: 8 } }
        ];

        ws['!cols'] = [
            { wch: 6 },  // STT
            { wch: 22 }, // Mã HS
            { wch: 30 }, // Chủ Sử Dụng
            { wch: 18 }, // Địa Danh
            { wch: 8 },  // Thửa
            { wch: 8 },  // Tờ
            { wch: 24 }, // Loại HS
            { wch: 14 }, // Hẹn Trả
            { wch: 22 }  // Số Phát Hành / Vào Sổ
        ];

        const fontName = "Times New Roman";
        const thinBorder = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

        const titleMainStyle = { font: { name: fontName, sz: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
        const titleSubStyle = { font: { name: fontName, sz: 12, bold: true, underline: true }, alignment: { horizontal: "center", vertical: "center" } };
        const reportTitleStyle = { font: { name: fontName, sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center", vertical: "center" } };
        const reportSubTitleStyle = { font: { name: fontName, sz: 12, italic: true }, alignment: { horizontal: "center", vertical: "center" } };
        const handoverNoteStyle = { font: { name: fontName, sz: 11, italic: true }, alignment: { horizontal: "center", vertical: "center" } };

        const headerStyle = {
            font: { name: fontName, sz: 11, bold: true },
            border: thinBorder,
            fill: { fgColor: { rgb: "E0E0E0" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
        };

        const cellLeftStyle = {
            font: { name: fontName, sz: 11 },
            border: thinBorder,
            alignment: { vertical: "center", wrapText: true }
        };
        const cellCenterStyle = { ...cellLeftStyle, alignment: { horizontal: "center", vertical: "center" } };

        if (ws['A1']) ws['A1'].s = titleMainStyle;
        if (ws['A2']) ws['A2'].s = titleSubStyle;
        if (ws['A4']) ws['A4'].s = reportTitleStyle;
        if (ws['A5']) ws['A5'].s = reportSubTitleStyle;
        if (ws['A6']) ws['A6'].s = handoverNoteStyle;

        const tableHeaderRowIdx = 7;
        for (let c = 0; c <= lastColIdx; c++) {
            const ref = XLSX.utils.encode_cell({ r: tableHeaderRowIdx, c });
            if (!ws[ref]) ws[ref] = { v: "", t: "s" };
            ws[ref].s = headerStyle;
        }

        for (let r = dataStartRowIdx; r < dataStartRowIdx + totalDataRows; r++) {
            for (let c = 0; c <= lastColIdx; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) ws[ref] = { v: "", t: "s" };

                if ([0, 4, 5, 7].includes(c)) {
                    ws[ref].s = cellCenterStyle;
                } else {
                    ws[ref].s = cellLeftStyle;
                }
            }
        }

        const footerTitleStyle = { font: { name: fontName, sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
        const footerSubTitleStyle = { font: { name: fontName, sz: 11, italic: true }, alignment: { horizontal: "center", vertical: "center" } };

        const leftFooterRef = XLSX.utils.encode_cell({ r: footerStartRowIdx, c: 1 });
        const leftFooterSubRef = XLSX.utils.encode_cell({ r: footerStartRowIdx + 1, c: 1 });
        const rightFooterRef = XLSX.utils.encode_cell({ r: footerStartRowIdx, c: 6 });
        const rightFooterSubRef = XLSX.utils.encode_cell({ r: footerStartRowIdx + 1, c: 6 });

        if (ws[leftFooterRef]) ws[leftFooterRef].s = footerTitleStyle;
        if (ws[leftFooterSubRef]) ws[leftFooterSubRef].s = footerSubTitleStyle;
        if (ws[rightFooterRef]) ws[rightFooterRef].s = footerTitleStyle;
        if (ws[rightFooterSubRef]) ws[rightFooterSubRef].s = footerSubTitleStyle;

        const cleanBatch = selectedExportBatch === 'all' ? 'Tat_Ca_Dot' : removeVietnameseTones(batchNameStr.replace(/\s+/g, '_'));
        const dateFormattedForFile = batchDateStr.replace(/\//g, '_');
        const safeToday = todayStr.replace(/-/g, '');
        const fileName = `Giao_1_Cua_Dang_Ky_${cleanBatch}_Ngay_${dateFormattedForFile}_${safeToday}`;

        XLSX.utils.book_append_sheet(wb, ws, 'DanhSachBanGiao');

        return { wb, fileName };
    };

    const handleDownloadExcel = () => {
        const result = generateWorkbook();
        if (!result) return;
        const { wb, fileName } = result;
        XLSX.writeFile(wb, `${fileName}.xlsx`);
        setIsExportModalOpen(false);
    };

    const handlePrintPreview = () => {
        const result = generateWorkbook();
        if (!result) return;
        const { wb, fileName } = result;
        setPreviewWorkbook(wb);
        setPreviewFileName(fileName);
        setIsExportModalOpen(false);
        setIsPreviewModalOpen(true);
    };

    // Filter Records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const currentNormStatus = normalizeDangKyStatus(r.status);

            // Main Tab Status Filter
            if (activeMainTab === 'unassigned') {
                const isNew = currentNormStatus === 'Tiếp nhận mới';
                const hasNoStaff = (!r.appraisalStaff || r.appraisalStaff.trim() === '') && (!r.checkedBy || r.checkedBy.trim() === '');
                if (!isNew || !hasNoStaff) return false;
            } else if (activeMainTab === 'tbt') {
                if (activeTbtSubTab === 'tham_dinh' && currentNormStatus !== 'Thẩm định') return false;
                if (activeTbtSubTab === 'phieu_chuyen_thue' && currentNormStatus !== 'Phiếu chuyển thuế') return false;
                if (activeTbtSubTab === 'thue_kv7' && currentNormStatus !== 'Chờ Thuế KV7') return false;
                if (activeTbtSubTab === 'thong_bao_thue' && currentNormStatus !== 'Chờ giấy nộp tiền') return false;
            } else if (activeMainTab === 'in_gcn') {
                if (currentNormStatus !== 'Chờ In GCN') return false;
            } else if (activeMainTab === 'kiem_tra') {
                if (currentNormStatus !== 'Chờ kiểm tra') return false;
            } else if (activeMainTab === 'trinh_ky') {
                if (currentNormStatus !== 'Chờ ký duyệt') return false;
            } else if (activeMainTab === 'giao_1_cua') {
                if (activeGiao1CuaSubTab === 'cho_ban_giao' && currentNormStatus !== 'Chờ bàn giao') return false;
                if (activeGiao1CuaSubTab === 'cho_tra_kq' && currentNormStatus !== 'Đã giao 1 cửa') return false;
                if (activeGiao1CuaSubTab === 'da_tra_kq' && currentNormStatus !== 'Đã trả kết quả') return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const codeMatch = r.code.toLowerCase().includes(term);
                const ownerMatch = (r.owners || []).some(o => 
                    o.name.toLowerCase().includes(term) || (o.cccd || '').toLowerCase().includes(term)
                );
                const transfereeMatch = (r.transferees || []).some(t => 
                    t.name.toLowerCase().includes(term) || (t.cccd || '').toLowerCase().includes(term)
                );
                const issueMatch = (r.issueNumber || '').toLowerCase().includes(term);
                const entryMatch = (r.entryNumber || '').toLowerCase().includes(term);
                const wardMatch = (r.ward || '').toLowerCase().includes(term);
                const typeMatch = (r.recordType || '').toLowerCase().includes(term);
                const batchMatch = (r.exportBatch || '').toLowerCase().includes(term);
                const plotMatch = (r.landPlot || '').toLowerCase().includes(term);
                const sheetMatch = (r.mapSheet || '').toLowerCase().includes(term);

                if (!codeMatch && !ownerMatch && !transfereeMatch && !issueMatch && !entryMatch && !wardMatch && !typeMatch && !batchMatch && !plotMatch && !sheetMatch) {
                    return false;
                }
            }

            if (selectedStatusFilter !== 'all' && currentNormStatus !== selectedStatusFilter) {
                return false;
            }

            if (selectedWardFilter !== 'all' && r.ward !== selectedWardFilter) {
                return false;
            }

            if (selectedRecordTypeFilter !== 'all' && (r.recordType || '') !== selectedRecordTypeFilter) {
                return false;
            }

            if (filterFromDate && r.receivedDate) {
                const dateStr = r.receivedDate.includes('T') ? r.receivedDate.split('T')[0] : r.receivedDate;
                if (dateStr < filterFromDate) return false;
            }

            if (filterToDate && r.receivedDate) {
                const dateStr = r.receivedDate.includes('T') ? r.receivedDate.split('T')[0] : r.receivedDate;
                if (dateStr > filterToDate) return false;
            }

            if (warningFilter === 'overdue' && !isDangKyRecordOverdue(r)) {
                return false;
            }

            if (warningFilter === 'approaching' && !isDangKyRecordApproaching(r)) {
                return false;
            }

            return true;
        });
    }, [records, activeMainTab, activeTbtSubTab, activeGiao1CuaSubTab, searchTerm, selectedStatusFilter, selectedWardFilter, selectedRecordTypeFilter, selectedBatchFilter, filterFromDate, filterToDate, warningFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRecords.slice(start, start + pageSize);
    }, [filteredRecords, currentPage, pageSize]);

    // Selection Toggles
    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedRecords.map(r => r.id)));
        }
    };

    const toggleSelectRow = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    // Customer Priority Helper (Transferee > Owner > Authorized)
    const getPrimaryCustomer = (r: DangKyRecord) => {
        // Priority 1: Transferee
        if (r.transferees && r.transferees.length > 0 && r.transferees[0].name?.trim()) {
            const t = r.transferees[0];
            return {
                name: t.name,
                phone: t.phone || '',
                roleLabel: 'Người nhận CQ',
                roleColor: 'bg-teal-50 text-teal-700 border-teal-200'
            };
        }
        // Priority 2: Owner
        if (r.owners && r.owners.length > 0 && r.owners[0].name?.trim()) {
            const o = r.owners[0];
            return {
                name: o.name,
                phone: o.phone || '',
                roleLabel: 'Chủ sử dụng',
                roleColor: 'bg-blue-50 text-blue-700 border-blue-200'
            };
        }
        // Priority 3: Authorized
        if (r.authorizedPersonName && r.authorizedPersonName.trim()) {
            return {
                name: r.authorizedPersonName,
                phone: r.authorizedPersonPhone || '',
                roleLabel: 'Người UQ',
                roleColor: 'bg-amber-50 text-amber-700 border-amber-200'
            };
        }
        return {
            name: 'Chưa nhập tên',
            phone: '',
            roleLabel: '-',
            roleColor: 'bg-gray-50 text-gray-400 border-gray-200'
        };
    };

    // Quick Step Transition per record with modal assignment rules
    const handleNextStatus = async (r: DangKyRecord) => {
        const normStatus = normalizeDangKyStatus(r.status);
        const nextStatus = NEXT_STATUS_MAP[r.status];
        if (!nextStatus || nextStatus === r.status) return;

        setSelectedIds(new Set([r.id]));

        if (normStatus === 'Phiếu chuyển thuế' || normStatus === 'Chờ Thuế KV7') {
            // Direct advance without assignment modal for 2 Tax steps (Phiếu chuyển thuế -> Thuế KV7, Thuế KV7 -> Thông báo thuế)
            try {
                const currentDateStr = new Date().toISOString().split('T')[0];
                const updated: DangKyRecord = { ...r, status: nextStatus };
                if (nextStatus === 'Chờ Thuế KV7') updated.taxKV7TransferDate = currentDateStr;
                else if (nextStatus === 'Chờ giấy nộp tiền') updated.taxNoticeDate = currentDateStr;

                await saveDangKyRecordApi(updated);
                addActivityLog({
                    performerName: currentUser.fullName || currentUser.username,
                    performerRole: 'DANGKY',
                    actionType: 'UPDATE',
                    actionLabel: 'Chuyển bước quy trình',
                    targetType: 'Đăng ký',
                    referenceCode: r.code || r.id,
                    details: `Chuyển trạng thái hồ sơ Đăng ký ${r.code} từ "${r.status}" sang "${nextStatus}"`
                });
                loadData();
                setSelectedIds(new Set());
            } catch (e) {
                console.error('Lỗi khi chuyển bước:', e);
            }
        } else if (normStatus === 'Chờ ký duyệt') {
            // Direct advance from Chờ ký duyệt to Chờ bàn giao without sign modal
            try {
                const currentDateStr = new Date().toISOString().split('T')[0];
                const updated: DangKyRecord = { ...r, status: 'Chờ bàn giao', completedDate: currentDateStr };
                await saveDangKyRecordApi(updated);
                addActivityLog({
                    performerName: currentUser.fullName || currentUser.username,
                    performerRole: 'DANGKY',
                    actionType: 'UPDATE',
                    actionLabel: 'Hoàn thành ký duyệt',
                    targetType: 'Đăng ký',
                    referenceCode: r.code || r.id,
                    details: `Xác nhận ký duyệt và chuyển hồ sơ Đăng ký ${r.code} sang "Chờ bàn giao"`
                });
                loadData();
                setSelectedIds(new Set());
            } catch (e) {
                console.error('Lỗi khi chuyển bước:', e);
            }
        } else if (normStatus === 'Chờ kiểm tra' || nextStatus === 'Chờ ký duyệt') {
            setIsSubmitSignModalOpen(true);
        } else if (nextStatus === 'Chờ kiểm tra') {
            setIsSubmitCheckModalOpen(true);
        } else if (['Thẩm định', 'Phiếu chuyển thuế', 'Chờ In GCN'].includes(normStatus) || ['Thẩm định', 'Phiếu chuyển thuế', 'Chờ In GCN'].includes(nextStatus)) {
            setAssignStaffModalOpen(true);
        } else {
            try {
                const currentDateStr = new Date().toISOString().split('T')[0];
                const updated: DangKyRecord = { ...r, status: nextStatus };
                if (nextStatus === 'Chờ bàn giao') updated.completedDate = currentDateStr;
                else if (nextStatus === 'Đã trả kết quả') updated.resultReturnedDate = currentDateStr;

                await saveDangKyRecordApi(updated);
                addActivityLog({
                    performerName: currentUser.fullName || currentUser.username,
                    performerRole: 'DANGKY',
                    actionType: 'UPDATE',
                    actionLabel: 'Chuyển bước quy trình',
                    targetType: 'Đăng ký',
                    referenceCode: r.code || r.id,
                    details: `Chuyển trạng thái hồ sơ Đăng ký ${r.code} từ "${r.status}" sang "${nextStatus}"`
                });
                loadData();
                setSelectedIds(new Set());
            } catch (e) {
                console.error('Lỗi khi chuyển bước:', e);
            }
        }
    };

    const handleAssignAndAdvance = async (employeeId: string) => {
        const emp = employeesList.find(e => e.id === employeeId);
        const empName = emp ? emp.name : employeeId;
        if (!empName || selectedIds.size === 0) return;
        try {
            const idsToUpdate = Array.from(selectedIds);
            const currentDateStr = new Date().toISOString().split('T')[0];

            for (const id of idsToUpdate) {
                const rec = records.find(r => r.id === id);
                if (!rec) continue;
                const normSt = normalizeDangKyStatus(rec.status);
                const nextSt = NEXT_STATUS_MAP[rec.status] || rec.status;
                const nextNormSt = normalizeDangKyStatus(nextSt);
                const payload: Partial<DangKyRecord> = {
                    status: nextSt,
                };

                if (nextNormSt === 'Thẩm định') {
                    payload.appraisalStaff = empName;
                    payload.appraisalDate = currentDateStr;
                } else if (nextNormSt === 'Phiếu chuyển thuế' || nextNormSt === 'Chờ Thuế KV7' || nextNormSt === 'Chờ giấy nộp tiền') {
                    payload.taxFormStaff = empName;
                    payload.taxFormDate = currentDateStr;
                } else if (nextNormSt === 'Chờ In GCN') {
                    payload.printStaff = empName;
                    payload.printDate = currentDateStr;
                } else if (nextNormSt === 'Chờ kiểm tra') {
                    payload.checkedBy = empName;
                    payload.pendingCheckDate = currentDateStr;
                } else if (nextNormSt === 'Chờ ký duyệt') {
                    payload.submittedTo = empName;
                    payload.submissionDate = currentDateStr;
                } else {
                    payload.appraisalStaff = empName;
                    payload.appraisalDate = currentDateStr;
                }

                await saveDangKyRecordApi({ ...rec, ...payload });
            }
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'ASSIGN',
                actionLabel: 'Phân công & Chuyển bước',
                targetType: 'Đăng ký',
                referenceCode: `${idsToUpdate.length} hồ sơ`,
                details: `Phân công cán bộ "${empName}" và chuyển bước cho ${idsToUpdate.length} hồ sơ Đăng ký`
            });
            loadData();
            setSelectedIds(new Set());
            setAssignStaffModalOpen(false);
        } catch (e) {
            console.error('Error in handleAssignAndAdvance:', e);
        }
    };

    // Bulk Update Handler for Xử lý All
    const handleBulkUpdateAll = async (
        field: string,
        value: any,
        customDate?: string,
        extraData?: { assignedTo?: string }
    ) => {
        const idsToUpdate = selectedIds.size > 0 ? Array.from(selectedIds) : filteredRecords.map(r => r.id);
        if (idsToUpdate.length === 0) {
            alert('Không có hồ sơ nào để cập nhật.');
            return;
        }
        try {
            const updatePayload: Partial<DangKyRecord> = {};

            if (field === 'status') {
                updatePayload.status = value as DangKyStatusType;
                const targetDate = customDate || new Date().toISOString().split('T')[0];
                
                if (value === 'Thẩm định') {
                    if (extraData?.assignedTo) updatePayload.appraisalStaff = extraData.assignedTo;
                    updatePayload.appraisalDate = targetDate;
                } else if (value === 'Phiếu chuyển thuế') {
                    updatePayload.taxFormDate = targetDate;
                } else if (value === 'Chờ Thuế KV7') {
                    updatePayload.taxKV7TransferDate = targetDate;
                } else if (value === 'Chờ giấy nộp tiền') {
                    updatePayload.taxNoticeDate = targetDate;
                } else if (value === 'Chờ In GCN') {
                    updatePayload.printDate = targetDate;
                } else if (value === 'Chờ kiểm tra') {
                    if (extraData?.assignedTo) updatePayload.checkedBy = extraData.assignedTo;
                    updatePayload.pendingCheckDate = targetDate;
                } else if (value === 'Chờ ký duyệt') {
                    if (extraData?.assignedTo) updatePayload.submittedTo = extraData.assignedTo;
                    updatePayload.submissionDate = targetDate;
                } else if (value === 'Chờ bàn giao') {
                    updatePayload.completedDate = targetDate;
                } else if (value === 'Đã giao 1 cửa') {
                    if (customDate) updatePayload.exportBatch = customDate;
                } else if (value === 'Đã trả kết quả') {
                    updatePayload.resultReturnedDate = targetDate;
                }
            } else if (field === 'appraisalStaff') {
                updatePayload.appraisalStaff = value;
                if (customDate) updatePayload.appraisalDate = customDate;
            } else if (field === 'checkedBy') {
                updatePayload.checkedBy = value;
                if (customDate) updatePayload.pendingCheckDate = customDate;
            } else if (field === 'submittedTo') {
                updatePayload.submittedTo = value;
                if (customDate) updatePayload.submissionDate = customDate;
            } else if (field === 'ward') {
                updatePayload.ward = value;
            } else if (field === 'deadline') {
                updatePayload.deadline = value;
            } else if (field === 'receivedDate') {
                updatePayload.receivedDate = value;
            } else if (field === 'exportBatch') {
                updatePayload.exportBatch = value;
            } else if (field === 'receiptNumber') {
                updatePayload.receiptNumber = value;
            } else if (field === 'feeAmount') {
                updatePayload.feeAmount = Number(value) || 0;
            } else if (field === 'notes') {
                updatePayload.notes = value;
            }

            await bulkUpdateDangKyRecordsApi(idsToUpdate, updatePayload);
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'UPDATE',
                actionLabel: 'Cập nhật hàng loạt',
                targetType: 'Đăng ký',
                referenceCode: `${idsToUpdate.length} hồ sơ`,
                details: `Cập nhật hàng loạt trường [${field}] cho ${idsToUpdate.length} hồ sơ Đăng ký`
            });
            loadData();
            setSelectedIds(new Set());
            setIsBulkUpdateModalOpen(false);
        } catch (e) {
            console.error('Error during bulk update:', e);
        }
    };

    // Confirm Trình Kiểm Tra
    const handleSubmitCheckConfirm = async (checkerName: string, dateStr?: string) => {
        if (selectedIds.size === 0 || !checkerName) return;
        try {
            const idsToUpdate = Array.from(selectedIds);
            const targetDate = dateStr || new Date().toISOString().split('T')[0];
            await bulkUpdateDangKyRecordsApi(idsToUpdate, {
                status: 'Chờ kiểm tra',
                checkedBy: checkerName,
                pendingCheckDate: targetDate
            });
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'SUBMIT_CHECK',
                actionLabel: 'Trình kiểm tra',
                targetType: 'Đăng ký',
                referenceCode: `${idsToUpdate.length} hồ sơ`,
                details: `Trình cán bộ "${checkerName}" kiểm tra ${idsToUpdate.length} hồ sơ Đăng ký`
            });
            loadData();
            setSelectedIds(new Set());
            setIsSubmitCheckModalOpen(false);
        } catch (e) {
            console.error('Lỗi khi trình kiểm tra:', e);
        }
    };

    // Confirm Trình Ký Duyệt
    const handleSubmitSignConfirm = async (directorName: string, dateStr?: string) => {
        if (selectedIds.size === 0 || !directorName) return;
        try {
            const idsToUpdate = Array.from(selectedIds);
            const targetDate = dateStr || new Date().toISOString().split('T')[0];
            await bulkUpdateDangKyRecordsApi(idsToUpdate, {
                status: 'Chờ ký duyệt',
                submittedTo: directorName,
                submissionDate: targetDate
            });
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'SUBMIT_SIGN',
                actionLabel: 'Trình ký duyệt',
                targetType: 'Đăng ký',
                referenceCode: `${idsToUpdate.length} hồ sơ`,
                details: `Trình lãnh đạo "${directorName}" ký duyệt ${idsToUpdate.length} hồ sơ Đăng ký`
            });
            loadData();
            setSelectedIds(new Set());
            setIsSubmitSignModalOpen(false);
        } catch (e) {
            console.error('Lỗi khi trình ký duyệt:', e);
        }
    };

    // Batch Assign Staff
    const handleBatchAssign = async (staffName: string) => {
        if (!staffName || selectedIds.size === 0) return;
        try {
            const idsToUpdate = Array.from(selectedIds);
            const currentDateStr = new Date().toISOString().split('T')[0];
            await bulkUpdateDangKyRecordsApi(idsToUpdate, { 
                appraisalStaff: staffName, 
                appraisalDate: currentDateStr,
                status: 'Thẩm định' 
            });
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'ASSIGN',
                actionLabel: 'Phân công hàng loạt',
                targetType: 'Đăng ký',
                referenceCode: `${idsToUpdate.length} hồ sơ`,
                details: `Phân công cán bộ "${staffName}" phụ trách ${idsToUpdate.length} hồ sơ Đăng ký`
            });
            loadData();
            setSelectedIds(new Set());
        } catch (e) {
            console.error('Error assigning staff:', e);
        }
    };

    // Batch Status Updates (Trình kiểm tra, Trình ký, Ký duyệt)
    const handleBatchUpdateStatus = async (targetStatus: DangKyStatusType, reason?: string) => {
        if (selectedIds.size === 0) return;
        try {
            const idsToUpdate = Array.from(selectedIds);
            const updatePayload: Partial<DangKyRecord> = { status: targetStatus };
            if (reason) {
                updatePayload.notes = reason;
            }
            await bulkUpdateDangKyRecordsApi(idsToUpdate, updatePayload);
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'UPDATE',
                actionLabel: 'Cập nhật trạng thái',
                targetType: 'Đăng ký',
                referenceCode: `${idsToUpdate.length} hồ sơ`,
                details: `Cập nhật trạng thái sang "${targetStatus}" cho ${idsToUpdate.length} hồ sơ Đăng ký`
            });
            loadData();
            setSelectedIds(new Set());
        } catch (e) {
            console.error('Error updating status:', e);
        }
    };

    // Confirm Return / Supplement from RejectReturnStepModal
    const handleRejectReturnConfirm = async (optionType: ReturnOptionType, reason: string, returnDateStr: string) => {
        if (selectedIds.size === 0) return;
        try {
            let targetStatus: DangKyStatusType = 'Chờ bổ sung';
            if (optionType === 'pause_supplement') {
                targetStatus = 'Chờ bổ sung';
            } else if (optionType === 'cancel_reject') {
                targetStatus = 'Trả hủy hồ sơ';
            } else if (optionType === 'return_handler') {
                targetStatus = 'Tiếp nhận mới';
            }
            const idsToUpdate = Array.from(selectedIds);
            const reasonText = reason.trim() ? `[Trả/Bổ sung]: ${reason.trim()}` : '';
            await bulkUpdateDangKyRecordsApi(idsToUpdate, { 
                status: targetStatus,
                notes: reasonText || undefined
            });
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'DELETE',
                actionLabel: 'Trả / Bổ sung hồ sơ',
                targetType: 'Đăng ký',
                referenceCode: `${idsToUpdate.length} hồ sơ`,
                details: `Chuyển ${idsToUpdate.length} hồ sơ Đăng ký sang trạng thái "${targetStatus}"${reason ? ` (Lý do: ${reason})` : ''}`
            });
            loadData();
            setSelectedIds(new Set());
            setReturnModalOpen(false);
        } catch (e) {
            console.error('Lỗi khi thực hiện trả hồ sơ:', e);
        }
    };

    // Handle Open Modals
    const handleOpenAdd = () => {
        setSelectedRecordForEdit(null);
        setIsRecordModalOpen(true);
    };

    const handleOpenEdit = (record: DangKyRecord) => {
        setSelectedRecordForEdit(record);
        setIsRecordModalOpen(true);
    };

    const handleOpenDetail = (record: DangKyRecord) => {
        setSelectedRecordForDetail(record);
        setIsDetailModalOpen(true);
    };

    const handleDeleteClick = (record: DangKyRecord) => {
        setRecordToDelete(record);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!recordToDelete) return;
        const idToDelete = recordToDelete.id;
        const codeToDelete = recordToDelete.code;

        // Optimistic UI update: Remove immediately from state
        setRecords(prev => prev.filter(r => r.id !== idToDelete && r.code !== codeToDelete));
        setIsDeleteModalOpen(false);

        try {
            await deleteDangKyRecordApi(idToDelete);
            if (codeToDelete && codeToDelete !== idToDelete) {
                await deleteDangKyRecordApi(codeToDelete);
            }
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'DELETE',
                actionLabel: 'Xóa hồ sơ',
                targetType: 'Đăng ký',
                referenceCode: codeToDelete || idToDelete,
                details: `Xóa hồ sơ Đăng ký mã: ${codeToDelete || idToDelete}`
            });
            // Sync with backend
            const updated = await fetchDangKyRecords();
            setRecords(updated);
        } catch (err) {
            console.error('Delete error:', err);
            alert('Lỗi khi xóa hồ sơ!');
            loadData();
        } finally {
            setRecordToDelete(null);
        }
    };

    const handleConfirmBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const targetIds = Array.from(selectedIds);
        const idSet = new Set(targetIds);

        // Optimistic UI update
        setRecords(prev => prev.filter(r => !idSet.has(r.id) && !idSet.has(r.code)));
        setIsBulkDeleteModalOpen(false);

        try {
            await bulkDeleteDangKyRecordsApi(targetIds);
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: 'DELETE',
                actionLabel: 'Xóa hàng loạt',
                targetType: 'Đăng ký',
                referenceCode: `${targetIds.length} hồ sơ`,
                details: `Xóa hàng loạt ${targetIds.length} hồ sơ Đăng ký`
            });
            const updated = await fetchDangKyRecords();
            setRecords(updated);
            setSelectedIds(new Set());
        } catch (err) {
            console.error('Delete error:', err);
            alert('Lỗi khi xóa hồ sơ!');
            loadData();
        }
    };

    // Save Record from DangKyRecordModal
    const handleSaveRecord = async (recordToSave: DangKyRecord) => {
        try {
            const isEdit = records.some(r => r.id === recordToSave.id || (recordToSave.code && r.code === recordToSave.code));
            await saveDangKyRecordApi(recordToSave);
            addActivityLog({
                performerName: currentUser.fullName || currentUser.username,
                performerRole: 'DANGKY',
                actionType: isEdit ? 'UPDATE' : 'CREATE',
                actionLabel: isEdit ? 'Cập nhật hồ sơ' : 'Thêm mới hồ sơ',
                targetType: 'Đăng ký',
                referenceCode: recordToSave.code || recordToSave.id,
                details: `${isEdit ? 'Cập nhật thông tin' : 'Tạo mới'} hồ sơ Đăng ký mã: ${recordToSave.code || recordToSave.id}`
            });
            // Optimistic update
            setRecords(prev => {
                const idx = prev.findIndex(r => r.id === recordToSave.id || (recordToSave.code && r.code === recordToSave.code));
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = recordToSave;
                    return next;
                } else {
                    return [recordToSave, ...prev];
                }
            });
            loadData();
        } catch (err) {
            console.error('Save error:', err);
            alert('Có lỗi xảy ra khi lưu dữ liệu!');
            throw err;
        }
    };

    // Export Excel
    const handleExportExcel = () => {
        if (filteredRecords.length === 0) {
            alert('Không có dữ liệu để xuất Excel!');
            return;
        }

        const excelData = filteredRecords.map((r, idx) => ({
            'STT': idx + 1,
            'Mã hồ sơ': r.code,
            'Chủ sử dụng': (r.owners || []).map(o => o.name).join('\n'),
            'CCCD chủ': (r.owners || []).map(o => o.cccd || '').join('\n'),
            'Địa chỉ chủ': (r.owners || []).map(o => o.address || '').join('\n'),
            'Người nhận chuyển quyền': (r.transferees || []).map(t => t.name).join('\n'),
            'CCCD nhận chuyển quyền': (r.transferees || []).map(t => t.cccd || '').join('\n'),
            'Địa chỉ người nhận': (r.transferees || []).map(t => t.address || '').join('\n'),
            'Số phát hành GCN': r.issueNumber || '',
            'Số vào sổ': r.entryNumber || '',
            'Tổng diện tích (m2)': r.totalArea || 0,
            'Đất ở ONT/ODT (m2)': r.residentialArea || 0,
            'Xã/Phường': r.ward || '',
            'Loại hồ sơ': r.recordType || '',
            'Người ủy quyền': r.authorizedPersonName || '',
            'CCCD người UQ': r.authorizedPersonId || '',
            'Địa chỉ người UQ': r.authorizedPersonAddress || '',
            'Ngày nhận': formatDate(r.receivedDate),
            'Hẹn trả': formatDate(r.deadline),
            'Ngày Thẩm định': formatDate(r.appraisalDate),
            'NV Thẩm định': r.appraisalStaff || '',
            'Ngày Phiếu chuyển thuế': formatDate(r.taxFormDate),
            'NV Phiếu chuyển': r.taxFormStaff || '',
            'Ngày Chuyển Thuế KV7': formatDate(r.taxKV7TransferDate),
            'Ngày TBT': formatDate(r.taxNoticeDate),
            'Ngày GNT': formatDate(r.taxPaymentReceiptDate),
            'Ngày In': formatDate(r.printDate),
            'NV In GCN': r.printStaff || '',
            'Ngày Trình KT': formatDate(r.pendingCheckDate),
            'Người Kiểm tra': r.checkedBy || '',
            'Ngày Trình ký': formatDate(r.submissionDate),
            'Người ký': r.submittedTo || '',
            'Hoàn thành': formatDate(r.completedDate),
            'Đợt xuất': r.exportBatch || '',
            'Ngày Trả kết quả': formatDate(r.resultReturnedDate),
            'Số Biên lai': r.receiptNumber || '',
            'Số Hóa đơn': r.invoiceNumber || '',
            'Số tiền thu (VNĐ)': r.feeAmount || 0,
            'Trạng thái': r.status,
            'Ghi chú': r.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Hồ sơ Đăng ký');
        XLSX.writeFile(wb, `Danh_Sach_Ho_So_Dang_Ky_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
            {/* TOP HEADER MAIN WORKFLOW TABS */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-3 overflow-x-auto justify-between items-center gap-2">
                <div className="flex items-center space-x-1 pt-1 overflow-x-auto">
                    <button 
                        onClick={() => setActiveMainTab('all')}
                        className={`px-4 py-3 text-sm font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeMainTab === 'all' ? 'border-blue-600 text-blue-700 bg-white shadow-xs' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <Layers size={16}/> Tất cả hồ sơ
                    </button>

                    <button 
                        onClick={() => setActiveMainTab('unassigned')}
                        className={`px-4 py-3 text-sm font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeMainTab === 'unassigned' ? 'border-orange-500 text-orange-700 bg-white shadow-xs' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <UserPlus size={16} className="text-orange-500" /> Chưa giao
                    </button>

                    <button 
                        onClick={() => setActiveMainTab('tbt')}
                        className={`px-4 py-3 text-sm font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeMainTab === 'tbt' ? 'border-amber-600 text-amber-700 bg-white shadow-xs' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <DollarSign size={16}/> TBT
                    </button>

                    <button 
                        onClick={() => setActiveMainTab('in_gcn')}
                        className={`px-4 py-3 text-sm font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeMainTab === 'in_gcn' ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <FileText size={16}/> In GCN
                    </button>

                    <button 
                        onClick={() => setActiveMainTab('kiem_tra')}
                        className={`px-4 py-3 text-sm font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeMainTab === 'kiem_tra' ? 'border-cyan-600 text-cyan-700 bg-white shadow-xs' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <Shield size={16}/> Kiểm tra
                    </button>

                    <button 
                        onClick={() => setActiveMainTab('trinh_ky')}
                        className={`px-4 py-3 text-sm font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeMainTab === 'trinh_ky' ? 'border-teal-600 text-teal-700 bg-white shadow-xs' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <CheckCircle2 size={16}/> Trình ký
                    </button>

                    <button 
                        onClick={() => setActiveMainTab('giao_1_cua')}
                        className={`px-4 py-3 text-sm font-bold rounded-t-lg border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeMainTab === 'giao_1_cua' ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs' : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                    >
                        <Users size={16}/> Giao 1 cửa
                    </button>
                </div>
            </div>

            {/* ROW 2: SEARCH BAR (Căn bên phải) */}
            <div className="flex flex-wrap justify-end items-center px-4 pt-3 pb-1 bg-slate-50 gap-2">
                {/* Search Bar */}
                <div className="relative w-full sm:w-1/3 min-w-[280px] max-w-md">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Tìm theo Mã HS, Chủ sở hữu, CCCD, Thửa/Tờ, Số phôi..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-2xs"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-hidden flex flex-col px-4 pb-4 space-y-3 bg-slate-50">
                    {/* ROW 3: TOOLBAR, SUBTABS & FILTERS */}
                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
                        {/* Left Side: Subtabs + Popover Filter Button + Batch Actions */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* Subtabs for TBT on Row 3 (far left, no icons/counts/prefixes) */}
                            {activeMainTab === 'tbt' && (
                                <div className="flex bg-amber-50 p-1 rounded-lg border border-amber-200 gap-1 items-center mr-1">
                                    <button 
                                        onClick={() => setActiveTbtSubTab('tham_dinh')}
                                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeTbtSubTab === 'tham_dinh' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-900 hover:bg-amber-100'}`}
                                    >
                                        Thẩm định
                                    </button>
                                    <button 
                                        onClick={() => setActiveTbtSubTab('phieu_chuyen_thue')}
                                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeTbtSubTab === 'phieu_chuyen_thue' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-900 hover:bg-amber-100'}`}
                                    >
                                        Phiếu chuyển thuế
                                    </button>
                                    <button 
                                        onClick={() => setActiveTbtSubTab('thue_kv7')}
                                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeTbtSubTab === 'thue_kv7' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-900 hover:bg-amber-100'}`}
                                    >
                                        Thuế KV7
                                    </button>
                                    <button 
                                        onClick={() => setActiveTbtSubTab('thong_bao_thue')}
                                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeTbtSubTab === 'thong_bao_thue' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-900 hover:bg-amber-100'}`}
                                    >
                                        Thông báo thuế
                                    </button>
                                </div>
                            )}

                            {/* Subtabs for Giao 1 cửa on Row 3 (far left, no icons/counts/prefixes) */}
                            {activeMainTab === 'giao_1_cua' && (
                                <div className="flex bg-emerald-50 p-1 rounded-lg border border-emerald-200 gap-1 items-center mr-1">
                                    <button 
                                        onClick={() => setActiveGiao1CuaSubTab('cho_ban_giao')}
                                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeGiao1CuaSubTab === 'cho_ban_giao' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-900 hover:bg-emerald-100'}`}
                                    >
                                        Chờ bàn giao
                                    </button>
                                    <button 
                                        onClick={() => setActiveGiao1CuaSubTab('cho_tra_kq')}
                                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeGiao1CuaSubTab === 'cho_tra_kq' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-900 hover:bg-emerald-100'}`}
                                    >
                                        Chờ trả KQ
                                    </button>
                                    <button 
                                        onClick={() => setActiveGiao1CuaSubTab('da_tra_kq')}
                                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeGiao1CuaSubTab === 'da_tra_kq' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-900 hover:bg-emerald-100'}`}
                                    >
                                        Đã trả KQ
                                    </button>
                                </div>
                            )}

                            {/* Consolidated Popover Filter Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                        activeFilterCount > 0
                                            ? "bg-blue-50 border-blue-300 text-blue-700 shadow-2xs"
                                             : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                                    }`}
                                >
                                    <Filter size={14} className={activeFilterCount > 0 ? "text-blue-600" : "text-gray-500"} />
                                    <span>Bộ lọc tìm kiếm</span>
                                    {activeFilterCount > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ml-0.5">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                    {isFilterPopoverOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>

                                {/* POPOVER FILTER CARD */}
                                {isFilterPopoverOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsFilterPopoverOpen(false)}></div>
                                        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-100 text-gray-800">
                                            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                                                <div className="flex items-center gap-2 font-bold text-blue-700 text-sm">
                                                    <Filter size={16} />
                                                    <span>Bộ lọc tìm kiếm</span>
                                                </div>
                                                <button
                                                    onClick={() => setIsFilterPopoverOpen(false)}
                                                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                                                {/* 1. Xã / Phường */}
                                                <div>
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                                                        <MapPin size={14} className="text-gray-500" />
                                                        <span>Địa danh (Xã/Phường):</span>
                                                    </label>
                                                    <select
                                                        value={selectedWardFilter}
                                                        onChange={(e) => setSelectedWardFilter(e.target.value)}
                                                        className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                    >
                                                        <option value="all">Tất cả Xã/Phường</option>
                                                        {wards.map((w) => (
                                                            <option key={w} value={w}>{w}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* 2. Trạng thái */}
                                                <div>
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                                                        <CheckCircle2 size={14} className="text-gray-500" />
                                                        <span>Trạng thái hồ sơ:</span>
                                                    </label>
                                                    <select
                                                        value={selectedStatusFilter}
                                                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                                                        className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                    >
                                                        <option value="all">Tất cả trạng thái ({records.length})</option>
                                                        {DANG_KY_STATUS_LIST.map((st) => (
                                                            <option key={st} value={st}>
                                                                {st} ({records.filter(r => normalizeDangKyStatus(r.status) === st).length})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* 3. Loại hồ sơ */}
                                                <div>
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                                                        <FileText size={14} className="text-gray-500" />
                                                        <span>Loại hồ sơ:</span>
                                                    </label>
                                                    <select
                                                        value={selectedRecordTypeFilter}
                                                        onChange={(e) => setSelectedRecordTypeFilter(e.target.value)}
                                                        className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                    >
                                                        <option value="all">Tất cả loại hồ sơ</option>
                                                        {DANG_KY_RECORD_TYPES.map((type) => (
                                                            <option key={type} value={type}>
                                                                {type} ({DANG_KY_DEADLINE_MAP[type] || 10} ngày)
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* 3. Thời gian nhận */}
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

                                                {/* 4. Cảnh báo hạn xử lý */}
                                                <div>
                                                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                                                        <AlertTriangle size={14} className="text-gray-500" />
                                                        <span>Cảnh báo thời hạn xử lý:</span>
                                                    </label>
                                                    <select
                                                        value={warningFilter}
                                                        onChange={(e) => setWarningFilter(e.target.value as any)}
                                                        className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                                    >
                                                        <option value="all">Tất cả hồ sơ</option>
                                                        <option value="overdue">🔴 Đã quá hạn xử lý ({counts.overdueCount})</option>
                                                        <option value="approaching">🟡 Sắp đến hạn xử lý ({counts.approachingCount})</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Footer inside Popover */}
                                            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                                                <button
                                                    onClick={handleClearFilters}
                                                    className="text-xs text-gray-500 hover:text-red-600 font-semibold transition-colors cursor-pointer"
                                                >
                                                    Xóa bộ lọc
                                                </button>
                                                <button
                                                    onClick={() => setIsFilterPopoverOpen(false)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                                >
                                                    Áp dụng
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* 2 ICON CHẾ ĐỘ LỌC NHANH (QUÁ HẠN & SẮP ĐẾN HẠN) TẠI HÀNG THỨ 3 - CHỈ ĐỂ ICON + SỐ LƯỢNG */}
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setWarningFilter(prev => prev === 'overdue' ? 'all' : 'overdue')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs border cursor-pointer ${
                                        warningFilter === 'overdue'
                                            ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-200'
                                            : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                    }`}
                                    title="Lọc các hồ sơ đã quá hạn xử lý"
                                >
                                    <AlertTriangle size={15} className={warningFilter === 'overdue' ? 'text-white' : 'text-red-500'} />
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                                        warningFilter === 'overdue' ? 'bg-white text-red-600' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {counts.overdueCount}
                                    </span>
                                </button>

                                <button
                                    onClick={() => setWarningFilter(prev => prev === 'approaching' ? 'all' : 'approaching')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs border cursor-pointer ${
                                        warningFilter === 'approaching'
                                            ? 'bg-orange-500 text-white border-orange-500 ring-2 ring-orange-200'
                                            : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'
                                    }`}
                                    title="Lọc các hồ sơ sắp đến hạn xử lý (còn <= 3 ngày)"
                                >
                                    <Clock size={15} className={warningFilter === 'approaching' ? 'text-white' : 'text-orange-500'} />
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                                        warningFilter === 'approaching' ? 'bg-white text-orange-600' : 'bg-orange-100 text-orange-800'
                                    }`}>
                                        {counts.approachingCount}
                                    </span>
                                </button>
                            </div>

                            {/* Nút Nhập Mới / Cập nhật thông tin (đặt cạnh thao tác Lọc) */}
                            <div className="relative">
                                <div className="flex rounded-lg shadow-2xs overflow-hidden border border-blue-600">
                                    <button 
                                        onClick={handleOpenAdd}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                                    >
                                        <Plus size={14} /> Nhập mới
                                    </button>
                                    <button
                                        onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                                        className="bg-blue-700 hover:bg-blue-800 text-white px-1.5 py-1.5 border-l border-blue-500 flex items-center justify-center transition-all cursor-pointer"
                                        title="Thao tác tiếp nhận & Cập nhật"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                </div>

                                {isAddMenuOpen && (
                                    <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100">
                                        <button
                                            onClick={() => {
                                                setIsAddMenuOpen(false);
                                                handleOpenAdd();
                                            }}
                                            className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors"
                                        >
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                                <Plus size={16} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-xs">Nhập hồ sơ mới</div>
                                                <div className="text-[10px] text-slate-500">Tạo mới thủ công một hồ sơ Đăng ký</div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setIsAddMenuOpen(false);
                                                setIsBulkUpdateModalOpen(true);
                                            }}
                                            className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-600 flex items-center gap-2.5 transition-colors"
                                        >
                                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                                <RefreshCw size={16} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-xs">Cập nhật thông tin</div>
                                                <div className="text-[10px] text-slate-500">Đổi trạng thái, cán bộ, hạn trả...</div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Xuất DS Bàn Giao 1 Cửa (hiển thị tại Tab Giao 1 Cửa) */}
                            {activeMainTab === 'giao_1_cua' && (
                                <button 
                                    onClick={() => setIsExportModalOpen(true)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer"
                                    title="Xuất danh sách bàn giao 1 Cửa (Excel)"
                                >
                                    <FileSpreadsheet size={14} /> Xuất DS
                                </button>
                            )}

                            {/* Direct Action Buttons per Tab Context when Records are Selected (NO 'Đã chọn' label) */}
                            {selectedIds.size > 0 && (
                                <div className="flex items-center gap-1.5 animate-fade-in text-xs font-medium">
                                    {/* Giao việc: ONLY show in 'unassigned' tab (Chưa giao) */}
                                    {activeMainTab === 'unassigned' && (
                                        <button 
                                            onClick={() => setAssignStaffModalOpen(true)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                            title="Phân công cán bộ thụ lý"
                                        >
                                            <UserPlus size={14} /> Giao việc ({selectedIds.size})
                                        </button>
                                    )}

                                    {/* Trình kiểm tra (tại tab In GCN hoặc Thẩm định thuộc TBT) */}
                                    {(activeMainTab === 'in_gcn' || (activeMainTab === 'tbt' && activeTbtSubTab === 'tham_dinh')) && (
                                        <button 
                                            onClick={() => setIsSubmitCheckModalOpen(true)}
                                            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                            title="Trình kiểm tra hồ sơ"
                                        >
                                            <Shield size={14} /> Trình kiểm tra ({selectedIds.size})
                                        </button>
                                    )}

                                    {/* Trình ký duyệt (tại tab Kiểm tra) */}
                                    {activeMainTab === 'kiem_tra' && (
                                        <button 
                                            onClick={() => setIsSubmitSignModalOpen(true)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                            title="Trình ký duyệt hồ sơ"
                                        >
                                            <Send size={14} /> Trình ký ({selectedIds.size})
                                        </button>
                                    )}

                                    {/* Ký duyệt (tại tab Trình ký) */}
                                    {activeMainTab === 'trinh_ky' && (
                                        <button 
                                            onClick={() => handleBatchUpdateStatus('Chờ bàn giao')}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                            title="Duyệt / Chờ bàn giao"
                                        >
                                            <CheckCircle2 size={14} /> Ký duyệt ({selectedIds.size})
                                        </button>
                                    )}

                                    {/* Chốt DS Bàn Giao 1 Cửa */}
                                    {activeMainTab === 'giao_1_cua' && activeGiao1CuaSubTab === 'cho_ban_giao' && (
                                        <button 
                                            onClick={() => setIsLockModalOpen(true)}
                                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                            title="Chốt danh sách bàn giao 1 Cửa"
                                        >
                                            <Lock size={14} /> Chốt DS ({selectedIds.size})
                                        </button>
                                    )}

                                    {/* Xác nhận Đã trả kết quả */}
                                    {activeMainTab === 'giao_1_cua' && activeGiao1CuaSubTab === 'cho_tra_kq' && (
                                        <button 
                                            onClick={() => handleBatchUpdateStatus('Đã trả kết quả')}
                                            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                            title="Xác nhận đã trả kết quả"
                                        >
                                            <CheckCircle2 size={14} /> Đã trả KQ ({selectedIds.size})
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right Side: Trả hồ sơ, Xóa & Xử lý All Buttons placed on the far right */}
                        {selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 ml-auto">
                                <button 
                                    onClick={() => setReturnModalOpen(true)}
                                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                    title="Trả hồ sơ / Yêu cầu bổ sung"
                                >
                                    <CornerUpLeft size={14} /> Trả hồ sơ ({selectedIds.size})
                                </button>
                                <button 
                                    onClick={() => setIsBulkDeleteModalOpen(true)}
                                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                    title="Xóa các hồ sơ đã chọn"
                                >
                                    <Trash2 size={14} /> Xóa ({selectedIds.size})
                                </button>
                                <button 
                                    onClick={() => setIsBulkUpdateModalOpen(true)}
                                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                    title="Cập nhật hàng loạt nhiều thông tin"
                                >
                                    <Layers size={14} /> Xử lý All ({selectedIds.size})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* TABLE AREA */}
                    <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10 text-xs uppercase shadow-sm select-none">
                                        <th className="p-3 text-center border-r border-gray-200/60 w-10">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0} 
                                                onChange={toggleSelectAll} 
                                                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                                            />
                                        </th>
                                        <th className="p-3 border-r border-gray-200/60 min-w-[120px]">MÃ HỒ SƠ</th>
                                        <th className="p-3 border-r border-gray-200/60 min-w-[210px]">THÔNG TIN CHỦ SỬ DỤNG</th>
                                        <th className="p-3 border-r border-gray-200/60 min-w-[130px]">LOẠI HỒ SƠ</th>
                                        <th className="p-3 border-r border-gray-200/60 text-center min-w-[145px]">THỜI HẠN XỬ LÝ</th>
                                        <th className="p-3 border-r border-gray-200/60 text-center min-w-[110px]">XÃ PHƯỜNG</th>
                                        <th className="p-3 border-r border-gray-200/60 text-center w-16">TỜ</th>
                                        <th className="p-3 border-r border-gray-200/60 text-center w-16">THỬA</th>
                                        <th className="p-3 border-r border-gray-200/60 text-center min-w-[130px]">GIAO NHÂN VIÊN</th>

                                        <th className="p-3 border-r border-gray-200/60 text-center min-w-[120px]">HOÀN THÀNH ĐỢT</th>
                                        <th className="p-3 border-r border-gray-200/60 text-center min-w-[140px]">TRẠNG THÁI</th>
                                        <th className="p-3 text-center w-[90px] sticky right-0 bg-gray-50 z-20 shadow-xs">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={11} className="p-8 text-center text-gray-500 font-medium">
                                                Đang tải danh sách hồ sơ đăng ký...
                                            </td>
                                        </tr>
                                    ) : paginatedRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="p-8 text-center text-gray-500 font-medium">
                                                Không tìm thấy hồ sơ nào thỏa mãn điều kiện!
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedRecords.map((r) => {
                                            const cust = getPrimaryCustomer(r);
                                            const isSelected = selectedIds.has(r.id);
                                            const isOverdue = isDangKyRecordOverdue(r);
                                            const isApproaching = isDangKyRecordApproaching(r);

                                            return (
                                                <tr 
                                                    key={r.id} 
                                                    className={`transition-all duration-200 group border-l-4 ${
                                                        isOverdue 
                                                            ? 'bg-red-50/50 border-l-red-500 hover:bg-red-50' 
                                                            : isApproaching 
                                                            ? 'bg-orange-50/50 border-l-orange-500 hover:bg-orange-50' 
                                                            : isSelected 
                                                            ? 'bg-blue-50/50 border-l-blue-500 hover:bg-blue-50' 
                                                            : 'border-l-transparent hover:bg-slate-50/80'
                                                    }`}
                                                >
                                                    <td className="p-3 text-center border-r border-gray-100">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectRow(r.id)}
                                                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                                                        />
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100 font-bold font-mono text-blue-600 text-sm whitespace-nowrap">
                                                        <span>{r.code}</span>
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100">
                                                        <div className="space-y-1">
                                                            <div className="font-medium text-gray-900 text-sm">
                                                                {cust.name}
                                                            </div>
                                                            {cust.phone ? (
                                                                <div className="text-sm text-gray-600 font-mono flex items-center gap-1.5">
                                                                    <Phone size={13} className="text-gray-500 shrink-0" />
                                                                    <span>{cust.phone}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-xs text-gray-400 italic">--</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100 text-gray-700 text-sm">
                                                        {r.recordType || '--'}
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100">
                                                        <div className="flex flex-col w-full max-w-[155px] mx-auto bg-white/50 rounded border border-gray-200/80 overflow-hidden shadow-2xs">
                                                            <div className="flex items-center justify-between px-2 py-1 bg-gray-50/80 border-b border-gray-200/60" title="Ngày tiếp nhận">
                                                                <span className="text-[10px] font-sans font-extrabold text-slate-400 uppercase tracking-tight mr-2">Nhận</span>
                                                                <span className="text-xs font-semibold text-slate-600 font-mono whitespace-nowrap">{formatDate(r.receivedDate) || '--'}</span>
                                                            </div>
                                                            
                                                            <div className={`flex items-center justify-between px-2 py-1 ${isOverdue ? 'bg-red-50' : isApproaching ? 'bg-orange-50' : 'bg-white'}`} title="Hẹn trả kết quả">
                                                                <span className={`text-[10px] font-sans font-extrabold uppercase tracking-tight mr-2 ${isOverdue ? 'text-red-500' : isApproaching ? 'text-orange-500' : 'text-blue-600'}`}>Trả</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-xs font-bold font-mono whitespace-nowrap ${isOverdue ? 'text-red-600' : isApproaching ? 'text-orange-600' : 'text-blue-700'}`}>
                                                                        {formatDate(r.deadline) || '--'}
                                                                    </span>
                                                                    {isOverdue && <AlertCircle size={13} className="text-red-500 animate-pulse shrink-0" />}
                                                                    {isApproaching && <Clock size={13} className="text-orange-500 shrink-0" />}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100 text-sm text-gray-700 text-center">
                                                        {r.ward || '--'}
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100 text-sm text-slate-700 text-center font-bold font-mono">
                                                        {r.mapSheet || '--'}
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100 text-sm text-slate-700 text-center font-bold font-mono">
                                                        {r.landPlot || '--'}
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100 text-center">
                                                        {r.appraisalStaff || r.checkedBy ? (
                                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                                {r.appraisalDate && (
                                                                    <span className="text-xs font-semibold text-slate-600 font-mono whitespace-nowrap">
                                                                        {formatDate(r.appraisalDate)}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                    {r.appraisalStaff || r.checkedBy}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">--</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100 text-center">
                                                        {r.exportBatch ? (
                                                            <span className="text-emerald-600 text-[11px] font-extrabold">{r.exportBatch}</span>
                                                        ) : r.completedDate ? (
                                                            <span className="text-emerald-600 text-[10px] font-medium font-mono">{formatDate(r.completedDate)}</span>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">--</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100 text-center">
                                                        {(() => {
                                                            const normStatus = normalizeDangKyStatus(r.status);
                                                            return (
                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs whitespace-nowrap ${getStatusBadgeClass(normStatus)}`}>
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
                                                                    {normStatus}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="p-3 text-center sticky right-0 bg-white z-10 shadow-xs">
                                                        <div className="grid grid-cols-2 gap-1 w-[60px] mx-auto">
                                                            <button 
                                                                onClick={() => handleOpenDetail(r)}
                                                                className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-400 bg-white transition-all shadow-2xs cursor-pointer"
                                                                title="Xem chi tiết"
                                                            >
                                                                <Eye size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleNextStatus(r)}
                                                                className="w-7 h-7 flex items-center justify-center border border-emerald-300 rounded-lg text-emerald-600 hover:bg-emerald-50 bg-white transition-all shadow-2xs cursor-pointer"
                                                                title={`Chuyển bước tiếp theo: ${NEXT_STATUS_MAP[r.status] || ''}`}
                                                            >
                                                                <ArrowRight size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleOpenEdit(r)}
                                                                className="w-7 h-7 flex items-center justify-center border border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 bg-white transition-all shadow-2xs cursor-pointer"
                                                                title="Chỉnh sửa hồ sơ"
                                                            >
                                                                <Edit3 size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteClick(r)}
                                                                className="w-7 h-7 flex items-center justify-center border border-red-300 rounded-lg text-red-500 hover:bg-red-50 bg-white transition-all shadow-2xs cursor-pointer"
                                                                title="Xóa hồ sơ"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* PAGINATION FOOTER */}
                        {filteredRecords.length > 0 && (
                            <div className="border-t border-gray-200 p-3 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 text-xs text-gray-600">
                                <div className="flex items-center gap-4">
                                    <span>
                                        Tổng số: <strong>{filteredRecords.length}</strong> bản ghi
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span>Hiển thị</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="border border-gray-300 rounded px-2 py-1 bg-white outline-none cursor-pointer"
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
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                                        title="Trang trước"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="font-medium">
                                        Trang {currentPage} / {totalPages}
                                    </span>
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                                        title="Trang sau"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            {/* DETAIL MODAL (Replicated from Đo Đạc / Measurement Module) */}
            <DangKyDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                record={selectedRecordForDetail}
                employees={employeesList}
                currentUser={currentUser}
                onEdit={(r) => {
                    handleOpenEdit(r);
                }}
                onDelete={(r) => {
                    handleDeleteClick(r);
                }}
                onStatusAdvance={(r) => {
                    handleNextStatus(r);
                }}
                onRefreshData={loadData}
            />

            {/* RECORD MODAL: ADD / EDIT (Replicated from Đo Đạc / Measurement Module) */}
            <DangKyRecordModal
                isOpen={isRecordModalOpen}
                onClose={() => setIsRecordModalOpen(false)}
                onSave={handleSaveRecord}
                initialData={selectedRecordForEdit}
                employees={employeesList}
                currentUser={currentUser}
                wards={wards}
                holidays={holidays}
            />

            {/* DELETE CONFIRM MODAL */}
            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setRecordToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Xác nhận xóa hồ sơ đăng ký"
                message="Bạn có chắc chắn muốn xóa hồ sơ đăng ký này? Hành động này không thể hoàn tác."
                record={recordToDelete ? {
                    code: recordToDelete.code,
                    customerName: recordToDelete.owners?.[0]?.name,
                    receivedDate: recordToDelete.receivedDate,
                    deadline: recordToDelete.deadline
                } : null}
            />

            {/* BULK DELETE CONFIRM MODAL */}
            <DeleteConfirmModal
                isOpen={isBulkDeleteModalOpen}
                onClose={() => setIsBulkDeleteModalOpen(false)}
                onConfirm={handleConfirmBulkDelete}
                title="Xác nhận xóa các hồ sơ đã chọn"
                message={`Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedIds.size} hồ sơ đăng ký đã chọn? Hành động này không thể hoàn tác.`}
            />

            {/* ASSIGN STAFF MODAL (From Measurement Module Design) */}
            <AssignModal 
                isOpen={assignStaffModalOpen}
                onClose={() => setAssignStaffModalOpen(false)}
                onConfirm={handleAssignAndAdvance}
                employees={employeesList}
                selectedRecords={adaptedSelectedRecords}
                currentUser={currentUser}
                filterDepartment="Tổ Cấp giấy"
            />

            {/* RETURN / REJECT MODAL (From Measurement Module Design) */}
            <RejectReturnStepModal 
                isOpen={returnModalOpen}
                onClose={() => setReturnModalOpen(false)}
                records={adaptedSelectedRecords}
                currentUser={currentUser}
                employees={employeesList}
                onConfirm={handleRejectReturnConfirm}
            />

            {/* --- MODAL XỬ LÝ ALL (BULK UPDATE MODAL) --- */}
            {isBulkUpdateModalOpen && (
                <BulkUpdateDangKyModal
                    isOpen={isBulkUpdateModalOpen}
                    onClose={() => setIsBulkUpdateModalOpen(false)}
                    selectedCount={selectedIds.size > 0 ? selectedIds.size : filteredRecords.length}
                    employees={employeesList}
                    wards={wards}
                    onConfirm={handleBulkUpdateAll}
                />
            )}

            {/* --- MODAL TRÌNH KIỂM TRA --- */}
            {isSubmitCheckModalOpen && (
                <SubmitCheckDangKyModal
                    isOpen={isSubmitCheckModalOpen}
                    onClose={() => setIsSubmitCheckModalOpen(false)}
                    selectedCount={selectedIds.size}
                    employees={employeesList}
                    onConfirm={handleSubmitCheckConfirm}
                />
            )}

            {/* --- MODAL TRÌNH KÝ DUYỆT --- */}
            {isSubmitSignModalOpen && (
                <SubmitSignDangKyModal
                    isOpen={isSubmitSignModalOpen}
                    onClose={() => setIsSubmitSignModalOpen(false)}
                    selectedCount={selectedIds.size}
                    employees={employeesList}
                    onConfirm={handleSubmitSignConfirm}
                />
            )}

            {/* --- MODAL CHỐT ĐỢT BÀN GIAO 1 CỬA --- */}
            {isLockModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scale-up">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                                    <Lock size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Chốt đợt bàn giao 1 Cửa</h3>
                                    <p className="text-xs text-gray-500">Đang chọn <span className="font-bold text-amber-600">{selectedIds.size}</span> hồ sơ</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsLockModalOpen(false)}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 my-5 text-xs">
                            <label className="block font-semibold text-gray-700">Hình thức chốt đợt:</label>

                            {/* Option 1: Đợt mới */}
                            <label 
                                onClick={() => setLockMode('new')}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                                    lockMode === 'new' 
                                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20' 
                                        : 'border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <input 
                                    type="radio" 
                                    name="lockMode" 
                                    checked={lockMode === 'new'} 
                                    onChange={() => setLockMode('new')}
                                    className="mt-0.5 text-amber-600 focus:ring-amber-500" 
                                />
                                <div className="space-y-1">
                                    <div className="font-bold text-gray-900 flex items-center gap-2">
                                        <span>Tạo đợt mới:</span>
                                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-extrabold border border-amber-300">
                                            {nextBatchInfo.label}
                                        </span>
                                    </div>
                                    <p className="text-gray-500 text-[11px]">
                                        Tự động tăng số đợt và ghi nhận ngày hôm nay ({todayFmt}). Chuyển trạng thái sang "Đã giao 1 cửa".
                                    </p>
                                </div>
                            </label>

                            {/* Option 2: Đợt cũ */}
                            <label 
                                onClick={() => setLockMode('existing')}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                                    lockMode === 'existing' 
                                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20' 
                                        : 'border-gray-200 hover:bg-gray-50'
                                } ${historyBatches.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <input 
                                    type="radio" 
                                    name="lockMode" 
                                    checked={lockMode === 'existing'} 
                                    onChange={() => setLockMode('existing')}
                                    disabled={historyBatches.length === 0}
                                    className="mt-0.5 text-amber-600 focus:ring-amber-500" 
                                />
                                <div className="space-y-1.5 flex-1">
                                    <div className="font-bold text-gray-900">
                                        Bổ sung vào đợt cũ đã có:
                                    </div>
                                    {historyBatches.length > 0 ? (
                                        <select 
                                            value={selectedExistingBatch}
                                            onChange={(e) => {
                                                setSelectedExistingBatch(e.target.value);
                                                setLockMode('existing');
                                            }}
                                            disabled={lockMode !== 'existing'}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden font-medium disabled:bg-gray-100"
                                        >
                                            {historyBatches.map(b => (
                                                <option key={b.label} value={b.label}>
                                                    {b.label} (Ngày {formatDate(b.date)} - {b.count} HS)
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <p className="text-gray-400 italic text-[11px]">Chưa có đợt nào trong lịch sử</p>
                                    )}
                                </div>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                            <button 
                                type="button" 
                                onClick={() => setIsLockModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button 
                                type="button" 
                                onClick={handleConfirmLockBatch}
                                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-md shadow-amber-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                <Lock size={14} /> Xác nhận chốt đợt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL XUẤT DANH SÁCH BÀN GIAO 1 CỬA --- */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-scale-up">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    <FileSpreadsheet size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Xuất danh sách bàn giao 1 Cửa</h3>
                                    <p className="text-xs text-gray-500">Mẫu bàn giao tiêu chuẩn kèm chữ ký</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsExportModalOpen(false)}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 my-5 text-xs">
                            <div>
                                <label className="block font-semibold text-gray-700 mb-1.5">Chọn đợt muốn xuất dữ liệu:</label>
                                <select 
                                    value={selectedExportBatch}
                                    onChange={(e) => setSelectedExportBatch(e.target.value)}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden font-medium"
                                >
                                    <option value="all">-- Tất cả các đợt --</option>
                                    {historyBatches.map(b => (
                                        <option key={b.label} value={b.label}>
                                            {b.label} ({formatDate(b.date)} - {b.count} hồ sơ)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-gray-600 space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span>Tổng số hồ sơ trong đợt chọn:</span>
                                    <span className="font-bold text-emerald-700 text-sm">{exportTargetRecords.length}</span>
                                </div>
                                <p className="text-[11px] text-gray-500 italic">
                                    File Excel xuất ra chuẩn phông chữ Times New Roman, định dạng căn lề bảng và 2 vị trí ký nhận bàn giao.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-100">
                            <button 
                                type="button" 
                                onClick={() => setIsExportModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                            >
                                Đóng
                            </button>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    onClick={handlePrintPreview}
                                    disabled={exportTargetRecords.length === 0}
                                    className="px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                >
                                    <Printer size={14} /> Xem trước & In
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleDownloadExcel}
                                    disabled={exportTargetRecords.length === 0}
                                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                >
                                    <Download size={14} /> Tải file Excel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL XEM TRƯỚC VÀ IN EXCEL --- */}
            <ExcelPreviewModal 
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                workbook={previewWorkbook}
                fileName={previewFileName}
            />
        </div>
    );
};

// ==========================================
// MODAL: BULK UPDATE DANG KY (XỬ LÝ ALL)
// ==========================================
interface BulkUpdateDangKyModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    employees: Employee[];
    wards: string[];
    onConfirm: (field: string, value: any, customDate?: string, extraData?: { assignedTo?: string }) => void;
}

const BulkUpdateDangKyModal: React.FC<BulkUpdateDangKyModalProps> = ({
    isOpen,
    onClose,
    selectedCount,
    employees,
    wards,
    onConfirm
}) => {
    const [targetField, setTargetField] = useState<string>('status');
    const [targetValue, setTargetValue] = useState<string>('Thẩm định');
    const [statusEmployee, setStatusEmployee] = useState<string>('');
    const [customDate, setCustomDate] = useState<string>('');

    if (!isOpen) return null;

    const getFilteredEmployees = () => {
        if (targetField === 'submittedTo' || (targetField === 'status' && targetValue === 'Chờ ký duyệt')) {
            const directors = employees.filter(emp => {
                const pos = (emp.position || '').toLowerCase();
                const dept = (emp.department || '').toLowerCase();
                return pos.includes('giám đốc') || pos.includes('lãnh đạo') || dept.includes('giám đốc') || dept.includes('lãnh đạo');
            });
            return directors.length > 0 ? directors : employees;
        }
        if (targetField === 'checkedBy' || (targetField === 'status' && targetValue === 'Chờ kiểm tra')) {
            const checkers = employees.filter(emp => {
                const pos = (emp.position || '').toLowerCase();
                const dept = (emp.department || '').toLowerCase();
                const isLeader = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng') || pos.includes('phó') || pos.includes('kiểm tra');
                const isRegistration = dept.includes('đăng ký') || dept.includes('cấp giấy');
                return isLeader || isRegistration;
            });
            return checkers.length > 0 ? checkers : employees;
        }
        const regEmps = employees.filter(emp => {
            const dept = (emp.department || '').toLowerCase();
            return dept.includes('đăng ký') || dept.includes('cấp giấy');
        });
        return regEmps.length > 0 ? regEmps : employees;
    };

    const filteredEmployees = getFilteredEmployees();
    const requiresEmployee = targetField === 'status' && (targetValue === 'Thẩm định' || targetValue === 'Chờ kiểm tra' || targetValue === 'Chờ ký duyệt');

    const handleConfirm = () => {
        if (!targetValue) {
            alert('Vui lòng chọn hoặc nhập giá trị mới cần cập nhật.');
            return;
        }
        onConfirm(
            targetField,
            targetValue,
            customDate || undefined,
            requiresEmployee && statusEmployee ? { assignedTo: statusEmployee } : undefined
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-scale-up">
                {/* Header */}
                <div className="bg-orange-600 px-5 py-4 flex items-center justify-between text-white shadow-sm">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                            <Layers size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base leading-tight">Cập nhật hàng loạt (Xử lý All)</h3>
                            <p className="text-xs text-orange-100 font-medium mt-0.5">
                                Đang chọn áp dụng: <span className="font-extrabold text-white">{selectedCount}</span> hồ sơ
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-lg text-orange-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Step 1 */}
                    <div className="space-y-1.5 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                        <label className="block text-xs font-bold text-gray-800">
                            1. Chọn thông tin cần thay đổi:
                        </label>
                        <select
                            value={targetField}
                            onChange={(e) => {
                                const newField = e.target.value;
                                setTargetField(newField);
                                if (newField === 'status') setTargetValue('Thẩm định');
                                else if (newField === 'appraisalStaff' || newField === 'checkedBy' || newField === 'submittedTo') setTargetValue(filteredEmployees[0]?.name || '');
                                else if (newField === 'ward') setTargetValue(wards[0] || '');
                                else setTargetValue('');
                                setStatusEmployee('');
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                        >
                            <option value="status">Trạng thái hồ sơ (Quy trình 14 bước)</option>
                            <option value="appraisalStaff">Cán bộ thẩm định / xử lý</option>
                            <option value="checkedBy">Cán bộ kiểm tra</option>
                            <option value="submittedTo">Lãnh đạo ký duyệt</option>
                            <option value="ward">Địa bàn Xã / Phường</option>
                            <option value="deadline">Hạn trả kết quả</option>
                            <option value="receivedDate">Ngày tiếp nhận hồ sơ</option>
                            <option value="exportBatch">Số đợt xuất bàn giao 1 Cửa</option>
                            <option value="receiptNumber">Số biên lai / Hóa đơn</option>
                            <option value="feeAmount">Số tiền phí / lệ phí (VNĐ)</option>
                            <option value="notes">Ghi chú hồ sơ</option>
                        </select>
                    </div>

                    {/* Step 2 */}
                    <div className="space-y-1.5 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                        <label className="block text-xs font-bold text-gray-800">
                            2. Chọn giá trị mới:
                        </label>

                        {targetField === 'status' && (
                            <select
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                            >
                                {DANG_KY_STATUS_LIST.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        )}

                        {(targetField === 'appraisalStaff' || targetField === 'checkedBy' || targetField === 'submittedTo') && (
                            <select
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                            >
                                <option value="">-- Chọn cán bộ --</option>
                                {filteredEmployees.map(emp => (
                                    <option key={emp.id} value={emp.name}>
                                        {emp.name} {emp.position ? `- ${emp.position}` : ''} {emp.department ? `(${emp.department})` : ''}
                                    </option>
                                ))}
                            </select>
                        )}

                        {targetField === 'ward' && (
                            <select
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                            >
                                <option value="">-- Chọn Xã / Phường --</option>
                                {wards.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                        )}

                        {(targetField === 'deadline' || targetField === 'receivedDate') && (
                            <input
                                type="date"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        )}

                        {(targetField === 'exportBatch' || targetField === 'receiptNumber' || targetField === 'notes') && (
                            <input
                                type="text"
                                placeholder="Nhập giá trị mới..."
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        )}

                        {targetField === 'feeAmount' && (
                            <input
                                type="number"
                                placeholder="Nhập số tiền..."
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                            />
                        )}
                    </div>

                    {/* Step 3: Chọn cán bộ phụ trách nếu đổi sang trạng thái Thẩm định/Kiểm tra/Ký duyệt */}
                    {requiresEmployee && (
                        <div className="space-y-1.5 bg-orange-50/70 p-3.5 rounded-xl border border-orange-200">
                            <label className="block text-xs font-bold text-orange-900">
                                3. Chọn nhân viên phụ trách ({targetValue === 'Chờ ký duyệt' ? 'Ban Giám Đốc' : targetValue === 'Chờ kiểm tra' ? 'Người kiểm tra' : 'Người thẩm định'}):
                            </label>
                            <select
                                value={statusEmployee}
                                onChange={(e) => setStatusEmployee(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                            >
                                <option value="">-- Chọn cán bộ --</option>
                                {filteredEmployees.map(emp => (
                                    <option key={emp.id} value={emp.name}>
                                        {emp.name} {emp.position ? `- ${emp.position}` : ''} {emp.department ? `(${emp.department})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Step 4: Chọn ngày thực hiện */}
                    <div className="space-y-1.5 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                        <label className="block text-xs font-bold text-gray-800">
                            {requiresEmployee ? '4.' : '3.'} Xác định ngày thực hiện / giao việc (Tùy chọn):
                        </label>
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                        <p className="text-[11px] text-gray-500">
                            Bỏ trống nếu muốn tự động lấy theo ngày hiện tại.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-md shadow-orange-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                        <CheckCircle2 size={14} /> Cập nhật ngay ({selectedCount})
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// MODAL: TRÌNH KIỂM TRA ĐĂNG KÝ
// ==========================================
interface SubmitCheckDangKyModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    employees: Employee[];
    onConfirm: (checkerName: string, dateStr?: string) => void;
}

const SubmitCheckDangKyModal: React.FC<SubmitCheckDangKyModalProps> = ({
    isOpen,
    onClose,
    selectedCount,
    employees,
    onConfirm
}) => {
    const [selectedChecker, setSelectedChecker] = useState<string>('');

    if (!isOpen) return null;

    const leaders = employees.filter(emp => {
        const pos = (emp.position || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        const isCapGiay = dept.includes('cấp giấy') || dept.includes('đăng ký');
        const isToTruongPho = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng') || pos.includes('phó');
        return isCapGiay && isToTruongPho;
    });
    const targetEmployees = leaders.length > 0 ? leaders : employees.filter(emp => {
        const pos = (emp.position || '').toLowerCase();
        return pos.includes('tổ trưởng') || pos.includes('tổ phó');
    });
    const finalCheckEmployees = targetEmployees.length > 0 ? targetEmployees : employees;

    const handleConfirm = () => {
        if (!selectedChecker) {
            alert('Vui lòng chọn cán bộ phụ trách kiểm tra.');
            return;
        }
        const realtimeDate = new Date().toISOString().split('T')[0];
        onConfirm(selectedChecker, realtimeDate);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-scale-up">
                <div className="bg-orange-600 p-4 flex justify-between items-center text-white">
                    <h2 className="text-base font-bold flex items-center gap-2">
                        <Shield size={20} />
                        Trình Kiểm Tra Hồ Sơ
                    </h2>
                    <button onClick={onClose} className="text-orange-200 hover:text-white transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <p className="text-gray-700 text-xs font-medium mb-1">
                            Bạn đang trình kiểm tra <span className="font-bold text-orange-600 text-sm">{selectedCount}</span> hồ sơ Đăng ký.
                        </p>
                        <p className="text-xs text-gray-500">
                            Vui lòng chọn Tổ trưởng / Tổ phó / Cán bộ phụ trách kiểm tra:
                        </p>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {finalCheckEmployees.map(emp => (
                            <label
                                key={emp.id}
                                className={`flex items-center p-2.5 border rounded-xl cursor-pointer transition-all ${
                                    selectedChecker === emp.name
                                        ? 'border-orange-500 bg-orange-50 shadow-2xs font-semibold'
                                        : 'border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="checkerEmp"
                                    value={emp.name}
                                    checked={selectedChecker === emp.name}
                                    onChange={(e) => setSelectedChecker(e.target.value)}
                                    className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                                />
                                <div className="ml-3 text-xs">
                                    <span className="block text-gray-900 font-bold">{emp.name}</span>
                                    <span className="block text-gray-500 text-[11px]">
                                        {emp.position || 'Cán bộ'} {emp.department ? `(${emp.department})` : ''}
                                    </span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!selectedChecker}
                            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                                selectedChecker
                                    ? 'bg-orange-600 hover:bg-orange-700 cursor-pointer shadow-orange-600/20 active:scale-95'
                                    : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        >
                            <CheckCircle2 size={14} />
                            Xác nhận trình kiểm tra ({selectedCount})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// MODAL: TRÌNH KÝ DUYỆT ĐĂNG KÝ
// ==========================================
interface SubmitSignDangKyModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    employees: Employee[];
    onConfirm: (directorName: string, dateStr?: string) => void;
}

const SubmitSignDangKyModal: React.FC<SubmitSignDangKyModalProps> = ({
    isOpen,
    onClose,
    selectedCount,
    employees,
    onConfirm
}) => {
    const [selectedDirector, setSelectedDirector] = useState<string>('');

    if (!isOpen) return null;

    const directors = employees.filter(emp => {
        const pos = (emp.position || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        return pos.includes('giám đốc') || pos.includes('lãnh đạo') || dept.includes('giám đốc') || dept.includes('ban lãnh đạo');
    });
    const targetDirectors = directors.length > 0 ? directors : employees;

    const handleConfirm = () => {
        if (!selectedDirector) {
            alert('Vui lòng chọn người được trình ký duyệt.');
            return;
        }
        const realtimeDate = new Date().toISOString().split('T')[0];
        onConfirm(selectedDirector, realtimeDate);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-scale-up">
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <h2 className="text-base font-bold flex items-center gap-2">
                        <Send size={20} />
                        Trình Ký Duyệt Hồ Sơ
                    </h2>
                    <button onClick={onClose} className="text-indigo-200 hover:text-white transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <p className="text-gray-700 text-xs font-medium mb-1">
                            Bạn đang trình ký <span className="font-bold text-indigo-600 text-sm">{selectedCount}</span> hồ sơ Đăng ký.
                        </p>
                        <p className="text-xs text-gray-500">
                            Vui lòng chọn Giám đốc / Phó Giám đốc để trình ký duyệt:
                        </p>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {targetDirectors.map(dir => (
                            <label
                                key={dir.id}
                                className={`flex items-center p-2.5 border rounded-xl cursor-pointer transition-all ${
                                    selectedDirector === dir.name
                                        ? 'border-indigo-500 bg-indigo-50 shadow-2xs font-semibold'
                                        : 'border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="directorEmp"
                                    value={dir.name}
                                    checked={selectedDirector === dir.name}
                                    onChange={(e) => setSelectedDirector(e.target.value)}
                                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                />
                                <div className="ml-3 text-xs">
                                    <span className="block text-gray-900 font-bold">{dir.name}</span>
                                    <span className="block text-gray-500 text-[11px]">
                                        {dir.position || 'Giám đốc/Phó giám đốc'} {dir.department ? `(${dir.department})` : ''}
                                    </span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!selectedDirector}
                            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                                selectedDirector
                                    ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-indigo-600/20 active:scale-95'
                                    : 'bg-gray-300 cursor-not-allowed'
                            }`}
                        >
                            <CheckCircle2 size={14} />
                            Xác nhận trình ký ({selectedCount})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegistrationRecords;
