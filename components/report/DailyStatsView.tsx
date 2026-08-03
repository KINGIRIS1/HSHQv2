import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { 
    Download, 
    Search, 
    FileSpreadsheet, 
    ChevronLeft, 
    ChevronRight, 
    MapPin, 
    Users, 
    CheckCircle2, 
    Clock, 
    ArrowRight,
    FileText
} from 'lucide-react';
import { getNormalizedWard, STATUS_LABELS } from '../../constants';
import { exportDailyStatsToExcel } from '../../utils/excelExport';
import { parseSafeDate, removeVietnameseTones } from '../../utils/appHelpers';

interface DailyStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    wards: string[];
    selectedWard?: string;
    fromDate?: string;
    toDate?: string;
    onFilteredRecordsChange?: (records: RecordFile[]) => void;
    onResetDates?: () => void;
}

const DailyStatsView: React.FC<DailyStatsViewProps> = ({ 
    records, 
    employees, 
    wards, 
    selectedWard = 'all',
    fromDate,
    toDate,
    onFilteredRecordsChange,
    onResetDates
}) => {
    // Active selected tab/card type ('received' | 'assigned' | 'handover')
    const [activeTabType, setActiveTabType] = useState<'received' | 'assigned' | 'handover'>('received');

    const handleTabChange = (type: 'received' | 'assigned' | 'handover') => {
        setActiveTabType(type);
        if (onResetDates) {
            onResetDates();
        }
    };

    // Filter states for Daily Stats
    const [modalEmployee, setModalEmployee] = useState('all');
    
    // Effective dates from props
    const effectiveFrom = useMemo(() => fromDate && fromDate !== '1970-01-01' ? fromDate : '', [fromDate]);
    const effectiveTo = useMemo(() => toDate || '', [toDate]);

    // Helper for matching selected ward against record ward
    const isWardMatch = (recordWard?: string) => {
        if (!selectedWard || selectedWard === 'all') return true;
        if (!recordWard) return false;
        const normRWard = removeVietnameseTones(getNormalizedWard(recordWard)).toLowerCase();
        const normTargetWard = removeVietnameseTones(getNormalizedWard(selectedWard)).toLowerCase();
        return normRWard.includes(normTargetWard) || normTargetWard.includes(normRWard);
    };

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);
    const [mobileVisibleCount, setMobileVisibleCount] = useState(20);

    // Dynamic filtering helper per category (to update card counts reactively based on general filters)
    const checkEmpMatch = (rec: RecordFile) => {
        if (modalEmployee === 'all') return true;
        if (modalEmployee === 'unassigned') return !rec.assignedTo && !rec.checkedBy;
        if (rec.assignedTo === modalEmployee) return true;
        const emp = employees.find(e => e.id === modalEmployee);
        const isLeader = emp && (
            emp.position?.toLowerCase().includes('tổ') ||
            emp.position?.toLowerCase().includes('nhóm') ||
            emp.position?.toLowerCase().includes('trưởng') ||
            emp.position?.toLowerCase().includes('phó')
        );
        return isLeader ? rec.checkedBy === modalEmployee : false;
    };

    const filteredReceivedRecords = useMemo(() => {
        return records.filter(r => {
            let matchDate = true;
            const rDate = parseSafeDate(r.receivedDate);
            if (!rDate) {
                matchDate = false;
            } else {
                rDate.setHours(0,0,0,0);
                if (effectiveFrom) {
                    const from = parseSafeDate(effectiveFrom) || new Date(effectiveFrom); from.setHours(0,0,0,0);
                    if (rDate < from) matchDate = false;
                }
                if (effectiveTo) {
                    const to = parseSafeDate(effectiveTo) || new Date(effectiveTo); to.setHours(23,59,59,999);
                    if (rDate > to) matchDate = false;
                }
            }
            const matchWard = isWardMatch(r.ward || undefined);
            const matchEmployee = checkEmpMatch(r);
            return matchDate && matchWard && matchEmployee;
        });
    }, [records, effectiveFrom, effectiveTo, selectedWard, modalEmployee, employees]);

    const filteredAssignedRecords = useMemo(() => {
        return records.filter(r => {
            let matchDate = true;
            const rDate = parseSafeDate(r.assignedDate);
            if (!rDate) {
                matchDate = false;
            } else {
                rDate.setHours(0,0,0,0);
                if (effectiveFrom) {
                    const from = parseSafeDate(effectiveFrom) || new Date(effectiveFrom); from.setHours(0,0,0,0);
                    if (rDate < from) matchDate = false;
                }
                if (effectiveTo) {
                    const to = parseSafeDate(effectiveTo) || new Date(effectiveTo); to.setHours(23,59,59,999);
                    if (rDate > to) matchDate = false;
                }
            }
            const matchWard = isWardMatch(r.ward || undefined);
            const matchEmployee = checkEmpMatch(r);
            return matchDate && matchWard && matchEmployee;
        });
    }, [records, effectiveFrom, effectiveTo, selectedWard, modalEmployee, employees]);

    const filteredHandoverRecords = useMemo(() => {
        return records.filter(r => {
            let matchDate = true;
            const rDate = parseSafeDate(r.completedDate);
            if (!rDate) {
                matchDate = false;
            } else {
                rDate.setHours(0,0,0,0);
                if (effectiveFrom) {
                    const from = parseSafeDate(effectiveFrom) || new Date(effectiveFrom); from.setHours(0,0,0,0);
                    if (rDate < from) matchDate = false;
                }
                if (effectiveTo) {
                    const to = parseSafeDate(effectiveTo) || new Date(effectiveTo); to.setHours(23,59,59,999);
                    if (rDate > to) matchDate = false;
                }
            }
            const matchWard = isWardMatch(r.ward || undefined);
            const matchEmployee = checkEmpMatch(r);
            return matchDate && matchWard && matchEmployee;
        });
    }, [records, effectiveFrom, effectiveTo, selectedWard, modalEmployee, employees]);

    // Main records for the selected card/type
    const modalFilteredRecords = useMemo(() => {
        if (activeTabType === 'received') return filteredReceivedRecords;
        if (activeTabType === 'assigned') return filteredAssignedRecords;
        if (activeTabType === 'handover') return filteredHandoverRecords;
        return [];
    }, [activeTabType, filteredReceivedRecords, filteredAssignedRecords, filteredHandoverRecords]);

    // Send the active filtered list back to the parent component
    useEffect(() => {
        if (onFilteredRecordsChange) {
            onFilteredRecordsChange(modalFilteredRecords);
        }
    }, [modalFilteredRecords, onFilteredRecordsChange]);

    // Reset pagination when any filter changes
    useEffect(() => {
        setCurrentPage(1);
        setMobileVisibleCount(20);
    }, [effectiveFrom, effectiveTo, selectedWard, modalEmployee, activeTabType]);

    // Pagination
    const totalPages = Math.ceil(modalFilteredRecords.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return modalFilteredRecords.slice(start, start + itemsPerPage);
    }, [modalFilteredRecords, currentPage, itemsPerPage]);

    // Export to Excel for Modal Records
    const handleExportFromModal = () => {
        if (modalFilteredRecords.length === 0) {
            alert('Không có hồ sơ nào để xuất.');
            return;
        }

        if (activeTabType === 'received') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                effectiveFrom, 
                effectiveTo, 
                '', ''
            );
        } else if (activeTabType === 'assigned') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                '', '', 
                '', '', 
                effectiveFrom, 
                effectiveTo
            );
        } else if (activeTabType === 'handover') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                '', '', 
                '', '', 
                '', '', 
                effectiveFrom, 
                effectiveTo
            );
        }
    };

    const formatDate = (d?: string | null) => {
        if (!d) return '-';
        const cleanStr = d.split('T')[0];
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
            return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
        return d;
    };

    return (
        <div className="flex flex-col h-full bg-white p-4 md:p-6 animate-fade-in-up overflow-y-auto">
            {/* Shared list layout below the cards */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col flex-1 min-h-[450px]">
                
                {/* Embedded filters toolbar */}
                <div className="px-6 py-3.5 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
                    
                    {/* Status segmented pills replacing date selector */}
                    <div className="flex-1 min-w-[320px]">
                        <div className="inline-flex items-center bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-semibold w-full sm:w-auto h-[38px]">
                            <button
                                type="button"
                                onClick={() => handleTabChange('received')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer h-full ${
                                    activeTabType === 'received'
                                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>Tiếp nhận</span>
                                <span className="font-bold text-blue-600">({filteredReceivedRecords.length})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTabChange('assigned')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer h-full ${
                                    activeTabType === 'assigned'
                                        ? 'bg-white text-emerald-700 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>Giao việc</span>
                                <span className="font-bold text-emerald-600">({filteredAssignedRecords.length})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleTabChange('handover')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer h-full ${
                                    activeTabType === 'handover'
                                        ? 'bg-white text-amber-700 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>Hoàn thành</span>
                                <span className="font-bold text-amber-600">({filteredHandoverRecords.length})</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-300 rounded-lg h-[38px] focus-within:border-blue-500 w-full sm:w-56">
                            <Search size={16} className="text-gray-400 shrink-0" />
                            <select 
                                value={modalEmployee} 
                                onChange={(e) => setModalEmployee(e.target.value)} 
                                className="text-xs outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 w-full p-0"
                            >
                                <option value="all">Tất cả nhân viên</option>
                                <option value="unassigned">Chưa giao</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Single shared Excel button is on the top ReportSection toolbar */}
                    </div>
                </div>

                {/* Desktop Record Table list */}
                <div className="hidden md:block flex-1 overflow-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-xs text-slate-700 uppercase font-black tracking-wider sticky top-0 shadow-sm z-10 border-b border-slate-200">
                            <tr>
                                <th className="p-3.5 w-12 text-center">STT</th>
                                <th className="p-3.5 w-36">Mã biên nhận</th>
                                <th className="p-3.5 w-52">Chủ sử dụng đất</th>
                                <th className="p-3.5 w-32">Xã / Phường</th>
                                <th className="p-3.5 w-32">
                                    {activeTabType === 'received' && 'Ngày tiếp nhận'}
                                    {activeTabType === 'assigned' && 'Ngày giao cán bộ'}
                                    {activeTabType === 'handover' && 'Ngày hoàn thành'}
                                </th>
                                <th className="p-3.5 w-32 text-amber-700">Hạn trả kết quả</th>
                                <th className="p-3.5 w-44">Chuyên viên xử lý</th>
                                <th className="p-3.5 w-32 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 bg-white">
                            {paginatedRecords.length > 0 ? paginatedRecords.map((r, i) => {
                                const emp = employees.find(e => e.id === r.assignedTo);
                                const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                return (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3.5 text-center text-slate-500 font-bold">{rowIndex}</td>
                                        <td className="p-3.5 font-bold text-blue-700">{r.code}</td>
                                        <td className="p-3.5 font-bold text-slate-800">{r.customerName}</td>
                                        <td className="p-3.5 text-slate-600">{getNormalizedWard(r.ward)}</td>
                                        <td className="p-3.5 text-slate-700 font-semibold">
                                            {activeTabType === 'received' && formatDate(r.receivedDate)}
                                            {activeTabType === 'assigned' && formatDate(r.assignedDate)}
                                            {activeTabType === 'handover' && formatDate(r.completedDate || r.resultReturnedDate)}
                                        </td>
                                        <td className="p-3.5 font-semibold text-amber-700">{formatDate(r.deadline)}</td>
                                        <td className="p-3.5 text-slate-600 font-medium text-xs max-w-[160px] truncate" title={emp?.name}>
                                            {emp ? emp.name : '-'}
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${
                                                r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-50 text-green-800 border-green-200' : 
                                                r.status === RecordStatus.WITHDRAWN ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                r.status === RecordStatus.COMPLETED_WORK ? 'bg-teal-100 text-teal-700 border-teal-200' :
                                                'bg-blue-100 text-blue-700 border-blue-200'
                                            }`}>
                                                {STATUS_LABELS[r.status] || r.status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={8} className="p-16 text-center text-slate-400 italic font-medium">
                                        Không có dữ liệu phù hợp với bộ lọc đã chọn. Hãy thay đổi khoảng ngày hoặc địa bàn xã/phường để xem kết quả.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Record List (20 items per batch + Xem thêm) */}
                <div className="block md:hidden flex-1 overflow-y-auto space-y-2.5 p-1">
                    {modalFilteredRecords.length > 0 ? (
                        <>
                            {modalFilteredRecords.slice(0, mobileVisibleCount).map((r, i) => {
                                const emp = employees.find(e => e.id === r.assignedTo);
                                const rowIndex = i + 1;
                                return (
                                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">#{rowIndex}</span>
                                                    <h3 className="font-bold text-slate-800 text-sm truncate">{r.customerName}</h3>
                                                </div>
                                                <div className="text-xs text-blue-600 font-semibold font-mono mt-0.5">{r.code}</div>
                                            </div>
                                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border shrink-0 bg-blue-50 text-blue-700 border-blue-100">
                                                {STATUS_LABELS[r.status] || r.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                                            <div>
                                                <span className="text-slate-400">Địa bàn:</span> <span className="font-medium text-slate-800">{getNormalizedWard(r.ward)}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Tờ/Thửa:</span> <span className="font-medium text-slate-800">{r.mapSheet || '-'}/{r.landPlot || '-'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">
                                                    {activeTabType === 'received' && 'Ngày nhận:'}
                                                    {activeTabType === 'assigned' && 'Ngày giao:'}
                                                    {activeTabType === 'handover' && 'Ngày xong:'}
                                                </span>{' '}
                                                <span className="font-medium text-slate-800">
                                                    {activeTabType === 'received' && formatDate(r.receivedDate)}
                                                    {activeTabType === 'assigned' && formatDate(r.assignedDate)}
                                                    {activeTabType === 'handover' && formatDate(r.completedDate || r.resultReturnedDate)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Hẹn trả:</span> <span className="font-semibold text-amber-700">{formatDate(r.deadline)}</span>
                                            </div>
                                            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/60 mt-0.5">
                                                <span className="text-slate-400">NV xử lý:</span>
                                                <span className="font-semibold text-slate-800">{emp ? emp.name : '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {modalFilteredRecords.length > mobileVisibleCount && (
                                <div className="pt-3 pb-6 flex flex-col items-center gap-2">
                                    <button 
                                        onClick={() => setMobileVisibleCount(prev => prev + 20)}
                                        className="w-full max-w-sm py-2.5 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        Xem thêm {modalFilteredRecords.length - mobileVisibleCount} hồ sơ
                                    </button>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        Đang hiển thị {Math.min(mobileVisibleCount, modalFilteredRecords.length)} / {modalFilteredRecords.length} hồ sơ
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="p-8 text-center text-slate-400 text-sm">Không có dữ liệu phù hợp với bộ lọc.</div>
                    )}
                </div>

                {/* Pagination footer */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 hidden md:flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Hiển thị</span>
                        <select 
                            value={itemsPerPage} 
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="border border-gray-300 rounded px-2.5 py-1 text-xs outline-none bg-white font-bold text-slate-700"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="text-xs text-gray-500 font-medium">dòng mỗi trang</span>
                    </div>

                    <div className="text-xs font-bold text-slate-600">
                        Tổng cộng: <span className="text-blue-700 font-black">{modalFilteredRecords.length}</span> hồ sơ
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} className="text-slate-600" />
                            </button>
                            
                            <div className="flex items-center gap-1 px-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = currentPage;
                                    if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    
                                    if (pageNum > 0 && pageNum <= totalPages) {
                                        return (
                                            <button 
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center transition-all ${
                                                    currentPage === pageNum 
                                                        ? 'bg-slate-800 text-white' 
                                                        : 'text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    }
                                    return null;
                                })}
                            </div>

                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-md hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} className="text-slate-600" />
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DailyStatsView;
