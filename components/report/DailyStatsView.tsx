import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { 
    CalendarDays, 
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
    CalendarRange,
    FileText
} from 'lucide-react';
import { getNormalizedWard, STATUS_LABELS } from '../../constants';
import { exportDailyStatsToExcel } from '../../utils/excelExport';
import { parseSafeDate } from '../../utils/appHelpers';

interface DailyStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    wards: string[];
    onFilteredRecordsChange?: (records: RecordFile[]) => void;
}

const DailyStatsView: React.FC<DailyStatsViewProps> = ({ records, employees, wards, onFilteredRecordsChange }) => {
    // Active selected tab/card type ('received' | 'assigned' | 'handover')
    const [activeTabType, setActiveTabType] = useState<'received' | 'assigned' | 'handover'>('received');

    // Filter states for Daily Stats
    const [modalFromDate, setModalFromDate] = useState('');
    const [modalToDate, setModalToDate] = useState('');
    const [modalWard, setModalWard] = useState('all');
    const [modalEmployee, setModalEmployee] = useState('all');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Dynamic filtering helper per category (to update card counts reactively based on general filters)
    const filteredReceivedRecords = useMemo(() => {
        return records.filter(r => {
            let matchDate = true;
            const rDate = parseSafeDate(r.receivedDate);
            if (!rDate) {
                matchDate = false;
            } else {
                rDate.setHours(0,0,0,0);
                if (modalFromDate) {
                    const from = parseSafeDate(modalFromDate) || new Date(modalFromDate); from.setHours(0,0,0,0);
                    if (rDate < from) matchDate = false;
                }
                if (modalToDate) {
                    const to = parseSafeDate(modalToDate) || new Date(modalToDate); to.setHours(23,59,59,999);
                    if (rDate > to) matchDate = false;
                }
            }
            const matchWard = modalWard === 'all' || getNormalizedWard(r.ward) === modalWard;
            const matchEmployee = modalEmployee === 'all' || (modalEmployee === 'unassigned' ? !r.assignedTo : r.assignedTo === modalEmployee);
            return matchDate && matchWard && matchEmployee;
        });
    }, [records, modalFromDate, modalToDate, modalWard, modalEmployee]);

    const filteredAssignedRecords = useMemo(() => {
        return records.filter(r => {
            let matchDate = true;
            const rDate = parseSafeDate(r.assignedDate);
            if (!rDate) {
                matchDate = false;
            } else {
                rDate.setHours(0,0,0,0);
                if (modalFromDate) {
                    const from = parseSafeDate(modalFromDate) || new Date(modalFromDate); from.setHours(0,0,0,0);
                    if (rDate < from) matchDate = false;
                }
                if (modalToDate) {
                    const to = parseSafeDate(modalToDate) || new Date(modalToDate); to.setHours(23,59,59,999);
                    if (rDate > to) matchDate = false;
                }
            }
            const matchWard = modalWard === 'all' || getNormalizedWard(r.ward) === modalWard;
            const matchEmployee = modalEmployee === 'all' || (modalEmployee === 'unassigned' ? !r.assignedTo : r.assignedTo === modalEmployee);
            return matchDate && matchWard && matchEmployee;
        });
    }, [records, modalFromDate, modalToDate, modalWard, modalEmployee]);

    const filteredHandoverRecords = useMemo(() => {
        return records.filter(r => {
            let matchDate = true;
            const rDate = parseSafeDate(r.completedDate);
            if (!rDate) {
                matchDate = false;
            } else {
                rDate.setHours(0,0,0,0);
                if (modalFromDate) {
                    const from = parseSafeDate(modalFromDate) || new Date(modalFromDate); from.setHours(0,0,0,0);
                    if (rDate < from) matchDate = false;
                }
                if (modalToDate) {
                    const to = parseSafeDate(modalToDate) || new Date(modalToDate); to.setHours(23,59,59,999);
                    if (rDate > to) matchDate = false;
                }
            }
            const matchWard = modalWard === 'all' || getNormalizedWard(r.ward) === modalWard;
            const matchEmployee = modalEmployee === 'all' || (modalEmployee === 'unassigned' ? !r.assignedTo : r.assignedTo === modalEmployee);
            return matchDate && matchWard && matchEmployee;
        });
    }, [records, modalFromDate, modalToDate, modalWard, modalEmployee]);

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
    }, [modalFromDate, modalToDate, modalWard, modalEmployee, activeTabType]);

    // Pagination
    const totalPages = Math.ceil(modalFilteredRecords.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return modalFilteredRecords.slice(start, start + itemsPerPage);
    }, [modalFilteredRecords, currentPage, itemsPerPage]);

    // Quick range selector logic
    const handleQuickRange = (range: 'all' | 'today' | 'week' | 'month') => {
        const now = new Date();
        if (range === 'all') {
            setModalFromDate('');
            setModalToDate('');
        } else if (range === 'today') {
            const todayStr = now.toISOString().split('T')[0];
            setModalFromDate(todayStr);
            setModalToDate(todayStr);
        } else if (range === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Thứ hai
            const start = new Date(now.setDate(diff));
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            setModalFromDate(start.toISOString().split('T')[0]);
            setModalToDate(end.toISOString().split('T')[0]);
        } else if (range === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            setModalFromDate(start.toISOString().split('T')[0]);
            setModalToDate(end.toISOString().split('T')[0]);
        }
    };

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
                modalFromDate, 
                modalToDate, 
                '', ''
            );
        } else if (activeTabType === 'assigned') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                '', '', 
                '', '', 
                modalFromDate, 
                modalToDate
            );
        } else if (activeTabType === 'handover') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                '', '', 
                '', '', 
                '', '', 
                modalFromDate, 
                modalToDate
            );
        }
    };

    const formatDate = (d?: string | null) => {
        const parsed = parseSafeDate(d);
        return parsed ? parsed.toLocaleDateString('vi-VN') : '-';
    };

    return (
        <div className="flex flex-col h-full bg-white p-4 md:p-6 animate-fade-in-up overflow-y-auto">
            {/* Main Cards Section - Structured like the uploaded image */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 w-full">
                {/* CARD 1: Tiếp nhận */}
                <div 
                    onClick={() => setActiveTabType('received')}
                    className={`cursor-pointer rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:shadow-md active:scale-95 border-2 ${
                        activeTabType === 'received' 
                            ? 'border-blue-600 bg-blue-50/90 shadow-sm' 
                            : 'border-slate-150 bg-blue-50/20 hover:border-blue-200 hover:bg-blue-50/40'
                    }`}
                >
                    <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl flex items-center justify-center shrink-0">
                        <FileText size={18} />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-blue-900 tracking-tight leading-none mb-1">
                            {filteredReceivedRecords.length}
                        </div>
                        <div className="text-[10px] font-bold tracking-wider text-blue-600 uppercase">
                            TIẾP NHẬN
                        </div>
                    </div>
                </div>

                {/* CARD 2: Đã bàn giao */}
                <div 
                    onClick={() => setActiveTabType('assigned')}
                    className={`cursor-pointer rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:shadow-md active:scale-95 border-2 ${
                        activeTabType === 'assigned' 
                            ? 'border-emerald-600 bg-emerald-50/90 shadow-sm' 
                            : 'border-slate-150 bg-emerald-50/20 hover:border-emerald-200 hover:bg-emerald-50/40'
                    }`}
                >
                    <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl flex items-center justify-center shrink-0">
                        <Users size={18} />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-emerald-900 tracking-tight leading-none mb-1">
                            {filteredAssignedRecords.length}
                        </div>
                        <div className="text-[10px] font-bold tracking-wider text-emerald-600 uppercase">
                            ĐÃ BÀN GIAO
                        </div>
                    </div>
                </div>

                {/* CARD 3: Hoàn thành */}
                <div 
                    onClick={() => setActiveTabType('handover')}
                    className={`cursor-pointer rounded-2xl p-3.5 flex items-center gap-3 transition-all hover:shadow-md active:scale-95 border-2 ${
                        activeTabType === 'handover' 
                            ? 'border-amber-600 bg-amber-50/90 shadow-sm' 
                            : 'border-slate-150 bg-amber-50/20 hover:border-amber-200 hover:bg-amber-50/40'
                    }`}
                >
                    <div className="bg-amber-100 text-amber-600 p-2.5 rounded-xl flex items-center justify-center shrink-0">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-amber-900 tracking-tight leading-none mb-1">
                            {filteredHandoverRecords.length}
                        </div>
                        <div className="text-[10px] font-bold tracking-wider text-amber-600 uppercase">
                            HOÀN THÀNH
                        </div>
                    </div>
                </div>
            </div>

            {/* Shared list layout below the cards */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col flex-1 min-h-[450px]">
                
                {/* Embedded filters toolbar */}
                <div className="px-6 py-4 bg-slate-50 border-b border-gray-200 grid grid-cols-1 xl:grid-cols-12 gap-4 items-end shrink-0">
                    
                    {/* Dates input customized */}
                    <div className="xl:col-span-5">
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-bold text-gray-700">
                                {activeTabType === 'received' && 'Khoảng ngày nhận hồ sơ'}
                                {activeTabType === 'assigned' && 'Khoảng ngày giao nhân viên'}
                                {activeTabType === 'handover' && 'Khoảng ngày bàn giao Một cửa'}
                            </label>
                            
                            {/* Quick selector filters */}
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => handleQuickRange('all')}
                                    className="text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:underline bg-slate-200/50 px-1.5 py-0.5 rounded"
                                >
                                    Tất cả
                                </button>
                                <button 
                                    onClick={() => handleQuickRange('today')}
                                    className="text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:underline bg-slate-200/50 px-1.5 py-0.5 rounded"
                                >
                                    Hôm nay
                                </button>
                                <button 
                                    onClick={() => handleQuickRange('week')}
                                    className="text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:underline bg-slate-200/50 px-1.5 py-0.5 rounded"
                                >
                                    Tuần này
                                </button>
                                <button 
                                    onClick={() => handleQuickRange('month')}
                                    className="text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:underline bg-slate-200/50 px-1.5 py-0.5 rounded"
                                >
                                    Tháng này
                                </button>
                            </div>
                        </div>

                        {/* Standard visible editable date inputs */}
                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 shadow-sm h-[38px] w-full text-xs font-bold text-gray-700">
                            <div className="flex items-center gap-1 w-full">
                                <span className="text-gray-400">Từ:</span>
                                <input 
                                    type="date" 
                                    value={modalFromDate} 
                                    onChange={e => setModalFromDate(e.target.value)} 
                                    className="border-none bg-transparent p-0 outline-none text-xs font-bold text-gray-700 focus:ring-0 w-full cursor-pointer" 
                                />
                            </div>
                            <span className="text-gray-400 font-bold shrink-0">-</span>
                            <div className="flex items-center gap-1 w-full">
                                <span className="text-gray-400">Đến:</span>
                                <input 
                                    type="date" 
                                    value={modalToDate} 
                                    onChange={e => setModalToDate(e.target.value)} 
                                    className="border-none bg-transparent p-0 outline-none text-xs font-bold text-gray-700 focus:ring-0 w-full cursor-pointer" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Địa bàn Xã / Phường</label>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-300 rounded-lg h-[38px] focus-within:border-blue-500">
                            <MapPin size={16} className="text-gray-400 shrink-0" />
                            <select 
                                value={modalWard} 
                                onChange={(e) => setModalWard(e.target.value)} 
                                className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 w-full p-0"
                            >
                                <option value="all">Toàn bộ địa bàn</option>
                                {wards.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="xl:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Nhân viên xử lý</label>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-300 rounded-lg h-[38px] focus-within:border-blue-500">
                            <Search size={16} className="text-gray-400 shrink-0" />
                            <select 
                                value={modalEmployee} 
                                onChange={(e) => setModalEmployee(e.target.value)} 
                                className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 w-full p-0"
                            >
                                <option value="all">Tất cả nhân viên</option>
                                <option value="unassigned">Chưa giao</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="xl:col-span-2">
                        <button 
                            onClick={handleExportFromModal}
                            disabled={modalFilteredRecords.length === 0}
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full h-[38px]"
                        >
                            <FileSpreadsheet size={16} className="shrink-0" /> Xuất Excel ({modalFilteredRecords.length})
                        </button>
                    </div>
                </div>

                {/* Record Table list */}
                <div className="flex-1 overflow-auto">
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

                {/* Pagination footer */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
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
