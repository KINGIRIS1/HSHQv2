import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RecordFile, Employee, User, RecordStatus } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, RECORD_TYPES } from '../../constants';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { exportCustomRecordsToExcel } from '../../utils/excelExport';
import { 
    Search, 
    Filter, 
    SlidersHorizontal, 
    X, 
    FileSpreadsheet, 
    Eye, 
    Pencil, 
    CalendarClock, 
    ChevronLeft, 
    ChevronRight, 
    RotateCcw,
    ChevronDown,
    ChevronUp,
    Calendar,
    ArrowUpDown,
    CheckSquare,
    Square,
    Bell,
    Phone,
    AlertCircle,
    Clock,
    Printer,
    Trash2,
    FileCheck
} from 'lucide-react';
import { DetailModal } from '../DetailModal';
import { ExtendDeadlineModal } from '../ExtendDeadlineModal';
import { isRecordOverdue, isRecordApproaching, toTitleCase } from '../../utils/appHelpers';

interface RecordSearchProps {
    records: RecordFile[];
    wards: string[];
    currentUser: User;
    employees: Employee[];
    onEdit: (record: RecordFile) => void;
    onDelete: (record: RecordFile) => void;
    onPrint: (record: RecordFile) => void;
    onSave: (record: RecordFile) => Promise<RecordFile | null>;
    isExtendView?: boolean;
    onReturnResult?: (record: RecordFile) => void;
}

const SEARCH_COLUMN_DEFS = [
  { key: 'code', label: 'MÃ HỒ SƠ', className: 'w-[120px] text-center' },
  { key: 'customer', label: 'THÔNG TIN CHỦ SỬ DỤNG', className: 'w-64 text-center' }, 
  { key: 'type', label: 'LOẠI HỒ SƠ', className: 'w-[115px] text-center' },
  { key: 'ward', label: 'XÃ PHƯỜNG', className: 'w-32 text-center' },
  { key: 'deadline', label: 'THỜI HẠN XỬ LÝ', className: 'w-[200px] text-center' },
  { key: 'mapSheet', label: 'TỜ', className: 'w-16 text-center' }, 
  { key: 'landPlot', label: 'THỬA', className: 'w-16 text-center' }, 
  { key: 'assigned', label: 'GIAO NHÂN VIÊN', className: 'w-48 text-center' },
  { key: 'completed', label: 'HOÀN THÀNH / ĐỢT', className: 'w-32 text-center' },
  { key: 'tech', label: 'TĐ / TL', className: 'w-20 text-center' },
  { key: 'receipt', label: 'BIÊN LAI', className: 'w-20 text-center' },
  { key: 'status', label: 'TRẠNG THÁI', className: 'w-32 text-center' },
];

const DEFAULT_VISIBLE_COLUMNS: Record<string, boolean> = {
    code: true, 
    customer: true, 
    deadline: true,
    ward: true, 
    mapSheet: true, 
    landPlot: true, 
    assigned: true, 
    completed: true,
    type: true, 
    tech: false, 
    receipt: true, 
    status: true
};

export const RecordSearch: React.FC<RecordSearchProps> = ({
    records = [],
    wards = [],
    currentUser,
    employees = [],
    onEdit,
    onDelete,
    onPrint,
    onSave,
    isExtendView = false,
    onReturnResult
}) => {
    // Search keyword
    const [searchKeyword, setSearchKeyword] = useState('');

    // Filter popover state
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const filterPopoverRef = useRef<HTMLDivElement>(null);

    // Filter inputs (immediately applied upon change, matching "Tất cả hồ sơ")
    const [filterWard, setFilterWard] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterRecordType, setFilterRecordType] = useState('all');
    const [filterEmployee, setFilterEmployee] = useState('all');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');

    // Column Config selector state
    const [showColumnSelector, setShowColumnSelector] = useState(false);

    // Column definitions based on view
    const currentColumns = useMemo(() => {
        if (isExtendView) {
            return [
              { key: 'code', label: 'MÃ HỒ SƠ', className: 'w-[100px] text-center' },
              { key: 'customer', label: 'KHÁCH HÀNG', className: 'w-[180px] text-center' }, 
              { key: 'type', label: 'LOẠI HỒ SƠ', className: 'w-[100px] text-center' },
              { key: 'ward', label: 'XÃ PHƯỜNG', className: 'w-[100px] text-center' },
              { key: 'deadlineOld', label: 'THỜI HẠN CŨ', className: 'w-[110px] text-center' },
              { key: 'deadlineNew', label: 'THỜI HẠN MỚI', className: 'w-[110px] text-center' },
              { key: 'mapSheet', label: 'TỜ', className: 'w-[50px] text-center' }, 
              { key: 'landPlot', label: 'THỬA', className: 'w-[50px] text-center' }, 
              { key: 'assigned', label: 'GIAO NHÂN VIÊN', className: 'w-[130px] text-center' },
              { key: 'completed', label: 'HOÀN THÀNH / ĐỢT', className: 'w-[100px] text-center' },
              { key: 'receipt', label: 'BIÊN LAI', className: 'w-[80px] text-center' },
              { key: 'status', label: 'TRẠNG THÁI', className: 'w-[100px] text-center' },
            ];
        }
        return [
          { key: 'code', label: 'MÃ HỒ SƠ', className: 'w-[120px] text-center' },
          { key: 'customer', label: 'THÔNG TIN CHỦ SỬ DỤNG', className: 'w-64 text-center' }, 
          { key: 'type', label: 'LOẠI HỒ SƠ', className: 'w-[115px] text-center' },
          { key: 'ward', label: 'XÃ PHƯỜNG', className: 'w-32 text-center' },
          { key: 'deadline', label: 'THỜI HẠN XỬ LÝ', className: 'w-[200px] text-center' },
          { key: 'mapSheet', label: 'TỜ', className: 'w-16 text-center' }, 
          { key: 'landPlot', label: 'THỬA', className: 'w-16 text-center' }, 
          { key: 'assigned', label: 'GIAO NHÂN VIÊN', className: 'w-48 text-center' },
          { key: 'completed', label: 'HOÀN THÀNH / ĐỢT', className: 'w-32 text-center' },
          { key: 'tech', label: 'TĐ / TL', className: 'w-20 text-center' },
          { key: 'receipt', label: 'BIÊN LAI', className: 'w-20 text-center' },
          { key: 'status', label: 'TRẠNG THÁI', className: 'w-32 text-center' },
        ];
    }, [isExtendView]);

    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
        if (isExtendView) {
            return {
                code: true, 
                customer: true, 
                type: true,
                ward: true, 
                deadlineOld: true,
                deadlineNew: true,
                mapSheet: true, 
                landPlot: true, 
                assigned: true, 
                completed: true,
                receipt: true, 
                status: true
            };
        }
        return DEFAULT_VISIBLE_COLUMNS;
    });

    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        if (isExtendView) {
            return ['code', 'customer', 'type', 'ward', 'deadlineOld', 'deadlineNew', 'mapSheet', 'landPlot', 'assigned', 'completed', 'receipt', 'status'];
        }
        return SEARCH_COLUMN_DEFS.map(c => c.key);
    });

    // Sync state when isExtendView changes
    useEffect(() => {
        setVisibleColumns(isExtendView ? {
            code: true, 
            customer: true, 
            type: true,
            ward: true, 
            deadlineOld: true,
            deadlineNew: true,
            mapSheet: true, 
            landPlot: true, 
            assigned: true, 
            completed: true,
            receipt: true, 
            status: true
        } : DEFAULT_VISIBLE_COLUMNS);
        
        setColumnOrder(isExtendView 
            ? ['code', 'customer', 'type', 'ward', 'deadlineOld', 'deadlineNew', 'mapSheet', 'landPlot', 'assigned', 'completed', 'receipt', 'status']
            : SEARCH_COLUMN_DEFS.map(c => c.key)
        );
    }, [isExtendView]);

    // Helpers to extract extension deadlines
    const getExtensionDates = (r: RecordFile) => {
        const pNotes = r.privateNotes || '';
        const notes = r.notes || '';
        
        const oldMatch = pNotes.match(/Hạn cũ:\s*([0-9/.\-]+)/i) || notes.match(/Hạn cũ:\s*([0-9/.\-]+)/i);
        let oldDeadline = '';
        if (oldMatch && oldMatch[1]) {
            oldDeadline = oldMatch[1];
        } else {
            if (r.deadline) {
                const d = new Date(r.deadline);
                if (!isNaN(d.getTime())) {
                    const prevD = new Date(d);
                    prevD.setDate(prevD.getDate() - 7);
                    oldDeadline = `${String(prevD.getDate()).padStart(2, '0')}/${String(prevD.getMonth() + 1).padStart(2, '0')}/${prevD.getFullYear()}`;
                } else {
                    oldDeadline = '--';
                }
            } else {
                oldDeadline = '--';
            }
        }

        let newDeadline = '';
        if (r.deadline) {
            const d = new Date(r.deadline);
            if (!isNaN(d.getTime())) {
                newDeadline = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            } else {
                newDeadline = r.deadline;
            }
        } else {
            newDeadline = '--';
        }

        return { oldDeadline, newDeadline };
    };

    const filterStatuses = useMemo(() => [
        { value: 'RECEIVED', label: 'Tiếp nhận mới' },
        { value: 'DANG_THUC_HIEN', label: 'Đang thực hiện' },
        { value: 'PENDING_SUPPLEMENT', label: 'Chờ bổ sung' },
        { value: 'PENDING_CHECK', label: 'Chờ kiểm tra' },
        { value: 'CHECKED', label: 'Đã kiểm tra' },
        { value: 'PENDING_SIGN', label: 'Chờ ký duyệt' },
        { value: 'SIGNED', label: 'Chờ bàn giao' },
        { value: 'HANDOVER', label: 'Đã giao 1 cửa' },
        { value: 'RETURNED', label: 'Đã trả kết quả' },
        { value: 'WITHDRAWN', label: 'CSD rút hồ sơ' },
        { value: 'REJECTED', label: 'Trả hồ sơ' }
    ], []);

    // Checkboxes selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Sort config
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Modals
    const [selectedDetailRecord, setSelectedDetailRecord] = useState<RecordFile | null>(null);
    const [selectedExtendRecord, setSelectedExtendRecord] = useState<RecordFile | null>(null);

    // Close popovers when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
                setIsFilterPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset pagination on filter/search update (preserves selectedIds across searches)
    useEffect(() => {
        setCurrentPage(1);
    }, [searchKeyword, filterWard, filterStatus, filterRecordType, filterEmployee, filterFromDate, filterToDate]);

    // Format Dates nicely
    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    // Normalize string for search
    const cleanStr = (s: string) => {
        return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    };

    // Filter count for badge
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterWard !== 'all') count++;
        if (filterStatus !== 'all') count++;
        if (filterRecordType !== 'all') count++;
        if (filterEmployee !== 'all') count++;
        if (filterFromDate) count++;
        if (filterToDate) count++;
        return count;
    }, [filterWard, filterStatus, filterRecordType, filterEmployee, filterFromDate, filterToDate]);

    // Actual Filtering Logic
    const filteredRecords = useMemo(() => {
        let list = [...records];

        // 1. If we are in "Hồ sơ gia hạn" tab, only show extended records
        if (isExtendView) {
            list = list.filter(r => 
                (r.privateNotes || '').includes('[GIA HẠN HẸN TRẢ') || 
                (r.notes || '').includes('[Gia hạn]') ||
                (r.privateNotes || '').includes('[Gia hạn]')
            );
        }

        return list.filter(r => {
            // Search Keyword
            if (searchKeyword) {
                const cleanKeyword = cleanStr(searchKeyword);
                const matchCode = cleanStr(r.code || '').includes(cleanKeyword);
                const matchCustomer = cleanStr(r.customerName || '').includes(cleanKeyword);
                const matchCccd = cleanStr(r.cccd || '').includes(cleanKeyword);
                const matchPhone = cleanStr(r.phoneNumber || '').includes(cleanKeyword);
                const matchSheet = cleanStr(r.mapSheet || '').includes(cleanKeyword);
                const matchPlot = cleanStr(r.landPlot || '').includes(cleanKeyword);

                if (!matchCode && !matchCustomer && !matchCccd && !matchPhone && !matchSheet && !matchPlot) {
                    return false;
                }
            }

            // Ward
            if (filterWard !== 'all') {
                const rWard = getNormalizedWard(r.ward || '').toLowerCase();
                const selWard = getNormalizedWard(filterWard).toLowerCase();
                if (!rWard.includes(selWard)) return false;
            }

            // Status
            if (filterStatus !== 'all') {
                if (filterStatus === 'DANG_THUC_HIEN') {
                    if (r.status !== 'ASSIGNED' && r.status !== 'IN_PROGRESS' && r.status !== 'COMPLETED_WORK') {
                        return false;
                    }
                } else {
                    if (r.status !== filterStatus) return false;
                }
            }

            // Record Type
            if (filterRecordType !== 'all') {
                const rType = getShortRecordType(r.recordType || '').toLowerCase();
                const selType = getShortRecordType(filterRecordType).toLowerCase();
                if (!rType.includes(selType)) return false;
            }

            // Assigned employee
            if (filterEmployee !== 'all') {
                if (r.assignedTo !== filterEmployee) return false;
            }

            // From date
            if (filterFromDate) {
                if (!r.receivedDate) return false;
                const rDate = new Date(r.receivedDate);
                rDate.setHours(0,0,0,0);
                const limitDate = new Date(filterFromDate);
                limitDate.setHours(0,0,0,0);
                if (rDate < limitDate) return false;
            }

            // To date
            if (filterToDate) {
                if (!r.receivedDate) return false;
                const rDate = new Date(r.receivedDate);
                rDate.setHours(0,0,0,0);
                const limitDate = new Date(filterToDate);
                limitDate.setHours(23,59,59,999);
                if (rDate > limitDate) return false;
            }

            return true;
        });
    }, [records, searchKeyword, filterWard, filterStatus, filterRecordType, filterEmployee, filterFromDate, filterToDate, isExtendView]);

    // Sorting Logic
    const sortedRecords = useMemo(() => {
        if (!sortConfig) return filteredRecords;
        const sorted = [...filteredRecords];
        sorted.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof RecordFile] || '';
            let bVal: any = b[sortConfig.key as keyof RecordFile] || '';

            if (sortConfig.key === 'customer') {
                aVal = a.customerName || '';
                bVal = b.customerName || '';
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredRecords, sortConfig]);

    // Paginated list
    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return sortedRecords.slice(startIndex, startIndex + pageSize);
    }, [sortedRecords, currentPage, pageSize]);

    // Total pages
    const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;

    // Checkboxes selection helpers
    const isAllSelectedOnPage = useMemo(() => {
        if (paginatedRecords.length === 0) return false;
        return paginatedRecords.every(r => selectedIds.has(r.id));
    }, [paginatedRecords, selectedIds]);

    const handleSelectAllToggle = () => {
        const newSelected = new Set(selectedIds);
        if (isAllSelectedOnPage) {
            paginatedRecords.forEach(r => newSelected.delete(r.id));
        } else {
            paginatedRecords.forEach(r => newSelected.add(r.id));
        }
        setSelectedIds(newSelected);
    };

    const handleRowSelectToggle = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleResetFilters = () => {
        setFilterWard('all');
        setFilterStatus('all');
        setFilterRecordType('all');
        setFilterEmployee('all');
        setFilterFromDate('');
        setFilterToDate('');
    };

    const handleMoveColumn = (key: string, direction: number) => {
        const idx = columnOrder.indexOf(key);
        if (idx === -1) return;
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= columnOrder.length) return;
        const newOrder = [...columnOrder];
        newOrder[idx] = newOrder[targetIdx];
        newOrder[targetIdx] = key;
        setColumnOrder(newOrder);
    };

    // Excel Export Action
    const handleExportExcel = async () => {
        const recordsToExport = selectedIds.size > 0 
            ? records.filter(r => selectedIds.has(r.id))
            : sortedRecords;

        if (recordsToExport.length === 0) {
            alert("Không có hồ sơ nào để xuất.");
            return;
        }

        const titleText = selectedIds.size > 0 
            ? `DANH SÁCH ${recordsToExport.length} HỒ SƠ ĐƯỢC CHỌN`
            : `DANH SÁCH TRA CỨU HỒ SƠ (${sortedRecords.length} BẢN GHI)`;

        await exportCustomRecordsToExcel(recordsToExport, employees, titleText);
    };

    // Confirm Extend Deadline callback
    const handleConfirmExtend = async (newDeadline: string, reason: string, executionDateStr: string) => {
        if (!selectedExtendRecord) return;
        try {
            const updatedRecord: RecordFile = {
                ...selectedExtendRecord,
                deadline: newDeadline,
                notes: `${selectedExtendRecord.notes || ''}\n[Gia hạn] Đến ngày ${formatDate(newDeadline)}. Lý do: ${reason}`.trim()
            };
            await onSave(updatedRecord);
            setSelectedExtendRecord(null);
            alert("Gia hạn hồ sơ thành công!");
        } catch (e) {
            console.error(e);
            alert("Có lỗi xảy ra khi gia hạn hồ sơ.");
        }
    };

    const handleHeaderClick = (key: string) => {
        let sortKey = key;
        if (key === 'customer') sortKey = 'customerName';
        if (key === 'type') sortKey = 'recordType';
        
        if (sortConfig && sortConfig.key === sortKey) {
            setSortConfig({
                key: sortKey,
                direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
            });
        } else {
            setSortConfig({
                key: sortKey,
                direction: 'asc'
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden shadow-xs border border-gray-100" id="record-search-view">
            
            {/* Top Row: Title & Search Bar matched perfectly to "Tất cả hồ sơ" in "Đo đạc" */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4 bg-white shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {isExtendView ? "Hồ Sơ Gia Hạn" : "Tra cứu hồ sơ"}
                    </h2>
                    
                    {/* Search box style copied from "Tất cả hồ sơ" */}
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            size={18}
                        />
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filter and Actions Row matched perfectly to "Tất cả hồ sơ" in "Đo đạc" */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-2 rounded-lg relative">
                    <div className="flex items-center gap-3">
                        
                        {/* Popover Filter button style copied from "Tất cả hồ sơ" */}
                        <div className="relative inline-block text-left" ref={filterPopoverRef}>
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

                            {/* Filter popover design matched perfectly to "Tất cả hồ sơ" */}
                            {isFilterPopoverOpen && (
                                <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-fade-in text-gray-800">
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
                                        {/* 1. Received Date Filter */}
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
                                                        className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Đến ngày</span>
                                                    <input
                                                        type="date"
                                                        value={filterToDate}
                                                        onChange={(e) => setFilterToDate(e.target.value)}
                                                        className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Record Type */}
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                                                <Filter size={14} className="text-gray-500" />
                                                <span>Loại hồ sơ:</span>
                                            </label>
                                            <select
                                                value={filterRecordType}
                                                onChange={(e) => setFilterRecordType(e.target.value)}
                                                className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none"
                                            >
                                                <option value="all">Tất cả loại HS</option>
                                                {RECORD_TYPES.map((type, idx) => (
                                                    <option key={idx} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 3. Status */}
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                                                <SlidersHorizontal size={14} className="text-gray-500" />
                                                <span>Trạng thái hồ sơ:</span>
                                            </label>
                                            <select
                                                value={filterStatus}
                                                onChange={(e) => setFilterStatus(e.target.value)}
                                                className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none"
                                            >
                                                <option value="all">Mọi trạng thái</option>
                                                {filterStatuses.map((st) => (
                                                    <option key={st.value} value={st.value}>{st.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 4. Assigned To */}
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                                                <Filter size={14} className="text-gray-500" />
                                                <span>Cán bộ xử lý:</span>
                                            </label>
                                            <select
                                                value={filterEmployee}
                                                onChange={(e) => setFilterEmployee(e.target.value)}
                                                className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none"
                                            >
                                                <option value="all">Tất cả cán bộ</option>
                                                {employees.map((emp) => (
                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 5. Ward */}
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1">
                                                <Filter size={14} className="text-gray-500" />
                                                <span>Xã/Phường:</span>
                                            </label>
                                            <select
                                                value={filterWard}
                                                onChange={(e) => setFilterWard(e.target.value)}
                                                className="w-full text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none"
                                            >
                                                <option value="all">Tất cả Xã/Phường</option>
                                                {wards.map((w, idx) => (
                                                    <option key={idx} value={w}>{getNormalizedWard(w)}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* 6. Reset Filters */}
                                        <div className="pt-2">
                                            <button
                                                onClick={handleResetFilters}
                                                className="w-full py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                            >
                                                <RotateCcw size={14} /> Xóa tất cả bộ lọc
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <span className="text-slate-500 text-xs font-semibold">
                            {selectedIds.size > 0 ? (
                                <>Đã chọn <strong className="text-emerald-700 font-bold">{selectedIds.size}</strong> hồ sơ</>
                            ) : (
                                <>Tổng số <strong className="text-slate-700 font-bold">{sortedRecords.length}</strong> hồ sơ</>
                            )}
                        </span>
                    </div>

                    {/* Column Configuration & Export buttons */}
                    <div className="flex items-center gap-2">
                        
                        {/* Excel Export */}
                        <button
                            onClick={handleExportExcel}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#00965e] hover:bg-[#008250] text-white rounded-lg font-bold shadow-xs transition-all active:scale-95 cursor-pointer select-none"
                            title={selectedIds.size > 0 ? `Xuất Excel ${selectedIds.size} hồ sơ đã chọn` : `Xuất Excel toàn bộ ${sortedRecords.length} hồ sơ`}
                        >
                            <FileSpreadsheet size={18} className="text-white shrink-0" />
                            <span className="font-bold text-[14px] leading-tight">Xuất Excel</span>
                            <span className="bg-[#005a36] text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-inner tracking-wider">
                                {(selectedIds.size > 0 ? selectedIds.size : sortedRecords.length).toLocaleString('vi-VN')}
                            </span>
                        </button>

                        {/* Column visibility and ordering selector matched perfectly to "Tất cả hồ sơ" */}
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
                                    {currentColumns.map((col, index) => (
                                        <div
                                            key={col.key}
                                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group/item text-xs"
                                        >
                                            <label className="flex items-center gap-2 cursor-pointer flex-1 select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleColumns[col.key]}
                                                    onChange={() =>
                                                        setVisibleColumns((prev) => ({
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
                                                    disabled={index === currentColumns.length - 1}
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
                    </div>
                </div>
            </div>

            {/* Records Table and Content */}
            <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-left table-fixed min-w-[1200px] border-collapse" id="records-search-table">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                        <tr className="select-none">
                            <th className="p-3 w-12 text-center border-b border-gray-200">
                                <button onClick={handleSelectAllToggle}>
                                    {isAllSelectedOnPage ? (
                                        <CheckSquare size={16} className="text-blue-600" />
                                    ) : (
                                        <Square size={16} className="text-gray-400" />
                                    )}
                                </button>
                            </th>
                            {columnOrder.map(colKey => {
                                const col = currentColumns.find(c => c.key === colKey);
                                if (!col || !visibleColumns[colKey]) return null;
                                return (
                                    <th
                                        key={colKey}
                                        className={`p-3 cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200 group font-bold text-center ${col.className || ''}`}
                                        onClick={() => handleHeaderClick(colKey)}
                                    >
                                        <div className="flex items-center gap-1 justify-center">
                                            <span>{col.label}</span>
                                            <ArrowUpDown size={13} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                                        </div>
                                    </th>
                                );
                            })}
                            <th className="p-3 w-32 text-center bg-gray-50 sticky right-0 shadow-l border-b border-gray-200 font-bold">
                                THAO TÁC
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {paginatedRecords.length === 0 ? (
                            <tr>
                                <td colSpan={currentColumns.length + 2} className="py-12 text-center text-slate-400 font-medium bg-white">
                                    Không tìm thấy hồ sơ nào phù hợp với điều kiện tìm kiếm.
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((r) => {
                                const assignedEmp = employees.find(e => e.id === r.assignedTo);
                                const isOverdue = isRecordOverdue(r);
                                const isApproaching = isRecordApproaching(r);

                                return (
                                    <tr key={r.id} className={`hover:bg-slate-50/70 transition-colors duration-150 ${selectedIds.has(r.id) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="p-3 text-center align-middle">
                                            <button onClick={() => handleRowSelectToggle(r.id)}>
                                                {selectedIds.has(r.id) ? (
                                                    <CheckSquare size={16} className="text-blue-600" />
                                                ) : (
                                                    <Square size={16} className="text-gray-400" />
                                                )}
                                            </button>
                                        </td>

                                        {columnOrder.map(colKey => {
                                            if (!visibleColumns[colKey]) return null;
                                            
                                            switch (colKey) {
                                                case 'code':
                                                    return (
                                                        <td key="code" className="p-3 align-middle font-bold text-blue-600 cursor-pointer text-center" onClick={() => setSelectedDetailRecord(r)}>
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="text-sm font-bold">{r.code}</span>
                                                                {isOverdue && <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded border border-red-200 font-bold">Quá hạn</span>}
                                                            </div>
                                                        </td>
                                                    );
                                                case 'customer':
                                                    return (
                                                        <td key="customer" className="p-3 align-middle text-center">
                                                            <div className="flex flex-col gap-1 items-center">
                                                                <div className="text-sm font-semibold text-gray-900 leading-normal">
                                                                    {toTitleCase(r.customerName || '')}
                                                                </div>
                                                                {r.phoneNumber && (
                                                                    <div className="flex items-center gap-1 text-xs text-gray-500 font-mono">
                                                                        <Phone size={12} />
                                                                        <span>{r.phoneNumber}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                case 'type':
                                                    return (
                                                        <td key="type" className="p-3 align-middle text-center font-semibold text-gray-700">
                                                            {getShortRecordType(r.recordType || undefined)}
                                                        </td>
                                                    );
                                                case 'ward':
                                                    return (
                                                        <td key="ward" className="p-3 align-middle text-center font-medium text-gray-600">
                                                            {getNormalizedWard(r.ward || undefined)}
                                                        </td>
                                                    );
                                                case 'deadline':
                                                    return (
                                                        <td key="deadline" className="p-3 align-middle text-center">
                                                            <div className="flex flex-col w-full bg-white/50 rounded border border-gray-100 overflow-hidden shadow-xs">
                                                                <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-100 text-[11px]">
                                                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase">Nhận</span>
                                                                    <span className="font-semibold text-slate-600 font-mono">{formatDate(r.receivedDate)}</span>
                                                                </div>
                                                                <div className={`flex items-center justify-between px-2 py-1 text-[11px] ${isOverdue ? 'bg-red-50' : isApproaching ? 'bg-orange-50' : 'bg-white'}`}>
                                                                    <span className={`text-[9px] font-extrabold uppercase ${isOverdue ? 'text-red-500' : isApproaching ? 'text-orange-500' : 'text-blue-500'}`}>Trả</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className={`font-bold font-mono ${isOverdue ? 'text-red-600' : isApproaching ? 'text-orange-600' : 'text-blue-700'}`}>{formatDate(r.deadline)}</span>
                                                                        {isOverdue && <AlertCircle size={12} className="text-red-500 animate-pulse" />}
                                                                        {isApproaching && <Clock size={12} className="text-orange-500" />}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                case 'deadlineOld': {
                                                    const { oldDeadline } = getExtensionDates(r);
                                                    return (
                                                        <td key="deadlineOld" className="p-3 align-middle text-center font-bold text-gray-500 font-mono">
                                                            {oldDeadline}
                                                        </td>
                                                    );
                                                }
                                                case 'deadlineNew': {
                                                    const { newDeadline } = getExtensionDates(r);
                                                    return (
                                                        <td key="deadlineNew" className="p-3 align-middle text-center font-bold text-blue-700 font-mono">
                                                            <div className="flex flex-col items-center gap-1 justify-center">
                                                                <span>{newDeadline}</span>
                                                                <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] rounded font-extrabold uppercase tracking-wider">Đã gia hạn</span>
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                case 'mapSheet':
                                                    return (
                                                        <td key="mapSheet" className="p-3 align-middle text-center font-medium text-gray-700">
                                                            {r.mapSheet || '--'}
                                                        </td>
                                                    );
                                                case 'landPlot':
                                                    return (
                                                        <td key="landPlot" className="p-3 align-middle text-center font-medium text-gray-700">
                                                            {r.landPlot || '--'}
                                                        </td>
                                                    );
                                                case 'assigned':
                                                    return (
                                                        <td key="assigned" className="p-3 align-middle text-center">
                                                            {assignedEmp ? (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-[10px] text-gray-400">{formatDate(r.assignedDate)}</span>
                                                                    <span className="font-bold text-blue-600 text-xs">{assignedEmp.name}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300">--</span>
                                                            )}
                                                        </td>
                                                    );
                                                case 'completed':
                                                    return (
                                                        <td key="completed" className="p-3 align-middle text-center">
                                                            {r.returnBatch ? (
                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100">
                                                                    Đợt {r.returnBatch}
                                                                </span>
                                                            ) : '--'}
                                                        </td>
                                                    );
                                                case 'tech':
                                                    return (
                                                        <td key="tech" className="p-3 align-middle text-center font-medium text-slate-500">
                                                            {r.measurementNumber || '--'}
                                                        </td>
                                                    );
                                                case 'receipt':
                                                    return (
                                                        <td key="receipt" className="p-3 align-middle text-center font-mono font-medium text-slate-600">
                                                            {r.receiptNumber || '--'}
                                                        </td>
                                                    );
                                                case 'status':
                                                    return (
                                                        <td key="status" className="p-3 align-middle text-center">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-800'}`}>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                                                {STATUS_LABELS[r.status] || r.status}
                                                            </span>
                                                        </td>
                                                    );
                                                default:
                                                    return null;
                                            }
                                        })}

                                        {/* Actions cell matched to standard row actions */}
                                        <td className="p-3 text-center align-middle sticky right-0 bg-white/90 backdrop-blur-xs border-l border-gray-100">
                                            {isExtendView ? (
                                                <div className="flex justify-center items-center">
                                                    <button
                                                        onClick={() => onPrint(r)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200 transition-all cursor-pointer font-bold text-xs shadow-xs"
                                                        title="In biên nhận"
                                                    >
                                                        <Printer size={14} />
                                                        <span>In biên nhận</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-1 py-0.5">
                                                    {/* Hàng trên: Xem & Gia hạn */}
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setSelectedDetailRecord(r)}
                                                            className="p-1 text-slate-600 hover:text-green-700 hover:bg-green-100/80 rounded transition-colors border border-slate-200/80 bg-white cursor-pointer"
                                                            title="Xem chi tiết"
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedExtendRecord(r)}
                                                            className="p-1 text-indigo-700 hover:bg-indigo-100 rounded transition-colors border border-indigo-200 bg-indigo-50 cursor-pointer"
                                                            title="Gia hạn hẹn trả"
                                                        >
                                                            <CalendarClock size={15} />
                                                        </button>
                                                    </div>
                                                    {/* Hàng dưới: Sửa & (Trả kết quả hoặc Xóa hoặc Placeholder) */}
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => onEdit(r)}
                                                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors border border-blue-200 bg-blue-50/50 cursor-pointer"
                                                            title="Chỉnh sửa"
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        {onReturnResult && r.status === 'HANDOVER' && !r.resultReturnedDate ? (
                                                            <button
                                                                onClick={() => onReturnResult(r)}
                                                                className="p-1 text-emerald-700 hover:bg-emerald-100 rounded transition-colors border border-emerald-200 bg-emerald-50 cursor-pointer animate-pulse"
                                                                title="Trả kết quả"
                                                            >
                                                                <FileCheck size={15} />
                                                            </button>
                                                        ) : (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUBADMIN') ? (
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm(`Bạn có chắc muốn xóa hồ sơ ${r.code}?`)) {
                                                                        await onDelete(r);
                                                                    }
                                                                }}
                                                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors border border-red-200 bg-red-50/50 cursor-pointer"
                                                                title="Xóa"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        ) : (
                                                            <div className="w-[25px] h-[25px]" />
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer matched perfectly */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 text-slate-600 text-xs">
                <div className="flex items-center gap-4">
                    <span>Tổng số: <strong className="text-slate-800 font-bold">{sortedRecords.length}</strong> bản ghi</span>
                    <div className="flex items-center gap-1.5">
                        <span>Hiển thị</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="border border-slate-200 rounded p-1 bg-white text-slate-800 focus:outline-none"
                        >
                            {[5, 10, 20, 50, 100].map(sz => (
                                <option key={sz} value={sz}>{sz}</option>
                            ))}
                        </select>
                        <span>dòng / trang</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <span className="font-semibold px-2">Trang {currentPage} / {totalPages}</span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    >
                        <ChevronRight size={15} />
                    </button>
                </div>
            </div>

            {/* Modals */}
            {selectedDetailRecord && (
                <DetailModal
                    isOpen={!!selectedDetailRecord}
                    onClose={() => setSelectedDetailRecord(null)}
                    record={selectedDetailRecord}
                    employees={employees}
                    users={[]}
                    currentUser={currentUser}
                    onEdit={(r) => {
                        setSelectedDetailRecord(null);
                        onEdit(r);
                    }}
                    onDelete={async (r) => {
                        if (confirm(`Bạn có chắc muốn xóa hồ sơ ${r.code}?`)) {
                            await onDelete(r);
                            setSelectedDetailRecord(null);
                        }
                    }}
                />
            )}

            {selectedExtendRecord && (
                <ExtendDeadlineModal
                    isOpen={!!selectedExtendRecord}
                    onClose={() => setSelectedExtendRecord(null)}
                    records={[selectedExtendRecord]}
                    currentUser={currentUser}
                    employees={employees}
                    onConfirm={handleConfirmExtend}
                />
            )}
        </div>
    );
};
