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
    X, 
    Users, 
    CheckCircle2, 
    Clock, 
    ArrowRight 
} from 'lucide-react';
import { getNormalizedWard, STATUS_LABELS } from '../../constants';
import { exportDailyStatsToExcel } from '../../utils/excelExport';

interface DailyStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    wards: string[];
    onFilteredRecordsChange?: (records: RecordFile[]) => void;
}

const DailyStatsView: React.FC<DailyStatsViewProps> = ({ records, employees, wards, onFilteredRecordsChange }) => {
    // Modal states
    const [openModalType, setOpenModalType] = useState<'received' | 'assigned' | 'handover' | null>(null);

    // Filter states for Modal
    const [modalFromDate, setModalFromDate] = useState('');
    const [modalToDate, setModalToDate] = useState('');
    const [modalWard, setModalWard] = useState('all');
    const [modalEmployee, setModalEmployee] = useState('all');
    
    // Pagination for Modal
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Reset filters when opening a specific modal
    const handleOpenModal = (type: 'received' | 'assigned' | 'handover') => {
        // Mặc định chọn khoảng thời gian 30 ngày gần nhất để xem nhanh hơn, hoặc để trống để hiển thị tất cả
        setModalFromDate('');
        setModalToDate('');
        setModalWard('all');
        setModalEmployee('all');
        setCurrentPage(1);
        setOpenModalType(type);
    };

    // Calculate total counts for dashboard cards
    const receivedCount = useMemo(() => records.filter(r => !!r.receivedDate).length, [records]);
    const assignedCount = useMemo(() => records.filter(r => !!r.assignedDate).length, [records]);
    const handoverCount = useMemo(() => records.filter(r => !!r.completedDate).length, [records]);

    // Dynamic Record Filtering for Modal
    const modalFilteredRecords = useMemo(() => {
        if (!openModalType) return [];

        return records.filter(r => {
            // 1. Lọc theo khoảng ngày tương ứng của từng Tab
            let matchDate = true;
            if (openModalType === 'received') {
                if (!r.receivedDate) {
                    matchDate = false;
                } else {
                    const rDate = new Date(r.receivedDate);
                    rDate.setHours(0,0,0,0);
                    if (modalFromDate) {
                        const from = new Date(modalFromDate); from.setHours(0,0,0,0);
                        if (rDate < from) matchDate = false;
                    }
                    if (modalToDate) {
                        const to = new Date(modalToDate); to.setHours(23,59,59,999);
                        if (rDate > to) matchDate = false;
                    }
                }
            } else if (openModalType === 'assigned') {
                if (!r.assignedDate) {
                    matchDate = false;
                } else {
                    const rDate = new Date(r.assignedDate);
                    rDate.setHours(0,0,0,0);
                    if (modalFromDate) {
                        const from = new Date(modalFromDate); from.setHours(0,0,0,0);
                        if (rDate < from) matchDate = false;
                    }
                    if (modalToDate) {
                        const to = new Date(modalToDate); to.setHours(23,59,59,999);
                        if (rDate > to) matchDate = false;
                    }
                }
            } else if (openModalType === 'handover') {
                if (!r.completedDate) {
                    matchDate = false;
                } else {
                    const rDate = new Date(r.completedDate);
                    rDate.setHours(0,0,0,0);
                    if (modalFromDate) {
                        const from = new Date(modalFromDate); from.setHours(0,0,0,0);
                        if (rDate < from) matchDate = false;
                    }
                    if (modalToDate) {
                        const to = new Date(modalToDate); to.setHours(23,59,59,999);
                        if (rDate > to) matchDate = false;
                    }
                }
            }

            // 2. Lọc theo Xã/Phường
            let matchWard = true;
            if (modalWard !== 'all') {
                matchWard = getNormalizedWard(r.ward) === modalWard;
            }

            // 3. Lọc theo nhân viên xử lý
            let matchEmployee = true;
            if (modalEmployee !== 'all') {
                if (modalEmployee === 'unassigned') {
                    matchEmployee = !r.assignedTo;
                } else {
                    matchEmployee = r.assignedTo === modalEmployee;
                }
            }

            return matchDate && matchWard && matchEmployee;
        });
    }, [records, openModalType, modalFromDate, modalToDate, modalWard, modalEmployee]);

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [modalFromDate, modalToDate, modalWard, modalEmployee]);

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

        if (openModalType === 'received') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                modalFromDate, 
                modalToDate, 
                '', ''
            );
        } else if (openModalType === 'assigned') {
            exportDailyStatsToExcel(
                modalFilteredRecords, 
                employees, 
                '', '', 
                '', '', 
                modalFromDate, 
                modalToDate
            );
        } else if (openModalType === 'handover') {
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

    const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

    // Get Title of Modal
    const getModalTitle = () => {
        switch (openModalType) {
            case 'received': return 'Danh sách thống kê hồ sơ theo Ngày nhận';
            case 'assigned': return 'Danh sách thống kê hồ sơ theo Ngày giao nhân viên';
            case 'handover': return 'Danh sách thống kê hồ sơ theo Ngày bàn giao 1 cửa';
            default: return '';
        }
    };

    // Get color theme of Modal
    const getModalColorTheme = () => {
        switch (openModalType) {
            case 'received': return { primary: 'bg-blue-600 hover:bg-blue-700', text: 'text-blue-600', ring: 'focus:ring-blue-500' };
            case 'assigned': return { primary: 'bg-indigo-600 hover:bg-indigo-700', text: 'text-indigo-600', ring: 'focus:ring-indigo-500' };
            case 'handover': return { primary: 'bg-emerald-600 hover:bg-emerald-700', text: 'text-emerald-600', ring: 'focus:ring-emerald-500' };
            default: return { primary: 'bg-blue-600 hover:bg-blue-700', text: 'text-blue-600', ring: 'focus:ring-blue-500' };
        }
    };

    const theme = getModalColorTheme();

    return (
        <div className="flex flex-col h-full bg-white p-6 animate-fade-in-up">
            {/* Header section with minimal clean description */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <CalendarDays className="text-blue-600" size={24} />
                    Hệ Thống Thống Kê Theo Ngày
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Lọc, xem và xuất báo cáo dữ liệu hồ sơ đất đai chính xác theo từng mốc tiến trình quan trọng.
                </p>
            </div>

            {/* Main Cards Section - No tables on main view as requested */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
                {/* CARD 1: Ngày nhận */}
                <div className="bg-white rounded-2xl border-2 border-slate-100 hover:border-blue-200 transition-all shadow-sm hover:shadow-md p-6 flex flex-col h-full relative group">
                    <div className="absolute top-4 right-4 bg-blue-50 text-blue-600 rounded-full p-2 group-hover:scale-110 transition-transform">
                        <CalendarDays size={24} />
                    </div>
                    <span className="text-xs font-black tracking-widest text-blue-500 uppercase">TIẾP NHẬN</span>
                    <h3 className="text-lg font-bold text-gray-800 mt-2 mb-1">Thống kê theo ngày nhận</h3>
                    <p className="text-sm text-gray-500 flex-1 mb-6">
                        Quản lý toàn bộ hồ sơ dựa vào ngày bộ phận Một cửa tiếp nhận và đưa vào hệ thống ban đầu.
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                        <div className="text-sm text-gray-600 font-medium">
                            Tổng số: <span className="font-bold text-blue-600 text-lg">{receivedCount}</span> HS
                        </div>
                        <button
                            onClick={() => handleOpenModal('received')}
                            className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl hover:bg-blue-600 hover:text-white font-bold text-sm transition-all"
                        >
                            Xem danh sách <ArrowRight size={14} />
                        </button>
                    </div>
                </div>

                {/* CARD 2: Ngày giao nhân viên */}
                <div className="bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-200 transition-all shadow-sm hover:shadow-md p-6 flex flex-col h-full relative group">
                    <div className="absolute top-4 right-4 bg-indigo-50 text-indigo-600 rounded-full p-2 group-hover:scale-110 transition-transform">
                        <Users size={24} />
                    </div>
                    <span className="text-xs font-black tracking-widest text-indigo-500 uppercase">PHÂN CÔNG VÀO VIỆC</span>
                    <h3 className="text-lg font-bold text-gray-800 mt-2 mb-1">Thống kê theo ngày giao nhân viên</h3>
                    <p className="text-sm text-gray-500 flex-1 mb-6">
                        Theo dõi năng suất và thời hạn bàn giao nhiệm vụ từ lãnh đạo trực tiếp tới từng chuyên viên nghiệp vụ.
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                        <div className="text-sm text-gray-600 font-medium">
                            Đã bàn giao: <span className="font-bold text-indigo-600 text-lg">{assignedCount}</span> HS
                        </div>
                        <button
                            onClick={() => handleOpenModal('assigned')}
                            className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl hover:bg-indigo-600 hover:text-white font-bold text-sm transition-all"
                        >
                            Xem danh sách <ArrowRight size={14} />
                        </button>
                    </div>
                </div>

                {/* CARD 3: Ngày giao 1 cửa */}
                <div className="bg-white rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-all shadow-sm hover:shadow-md p-6 flex flex-col h-full relative group">
                    <div className="absolute top-4 right-4 bg-emerald-50 text-emerald-600 rounded-full p-2 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={24} />
                    </div>
                    <span className="text-xs font-black tracking-widest text-emerald-500 uppercase">HOÀN THÀNH</span>
                    <h3 className="text-lg font-bold text-gray-800 mt-2 mb-1">Thống kê theo ngày giao 1 cửa</h3>
                    <p className="text-sm text-gray-500 flex-1 mb-6">
                        Tổng hợp kết quả đầu ra cuối cùng khi hồ sơ đã ký duyệt duyệt và chuyển lưu hoặc hoàn giao trả dân.
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                        <div className="text-sm text-gray-600 font-medium">
                            Hoàn thành: <span className="font-bold text-emerald-600 text-lg">{handoverCount}</span> HS
                        </div>
                        <button
                            onClick={() => handleOpenModal('handover')}
                            className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white font-bold text-sm transition-all"
                        >
                            Xem danh sách <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* POPUP MODAL FOR LIST DETAILS */}
            {openModalType && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] xl:max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                        
                        {/* Modal Header */}
                        <div className="bg-slate-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                {openModalType === 'received' && <CalendarDays className="text-blue-600" size={24} />}
                                {openModalType === 'assigned' && <Users className="text-indigo-600" size={24} />}
                                {openModalType === 'handover' && <CheckCircle2 className="text-emerald-600" size={24} />}
                                <h3 className="text-lg font-bold text-gray-900">{getModalTitle()}</h3>
                            </div>
                            <button
                                onClick={() => setOpenModalType(null)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal filters toolbar */}
                        <div className="px-6 py-4 bg-slate-50/50 border-b border-gray-100 grid grid-cols-1 lg:grid-cols-12 gap-4 shrink-0 items-end">
                            <div className="lg:col-span-5">
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                    {openModalType === 'received' && 'Khoảng ngày nhận hồ sơ'}
                                    {openModalType === 'assigned' && 'Khoảng ngày giao nhân viên'}
                                    {openModalType === 'handover' && 'Khoảng ngày bàn giao Một cửa'}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="date" 
                                        value={modalFromDate} 
                                        onChange={e => setModalFromDate(e.target.value)} 
                                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm w-full bg-white outline-none focus:border-blue-500 h-[38px]" 
                                        title="Từ ngày" 
                                    />
                                    <span className="text-gray-400 font-semibold shrink-0 px-1 text-xs">đến</span>
                                    <input 
                                        type="date" 
                                        value={modalToDate} 
                                        onChange={e => setModalToDate(e.target.value)} 
                                        className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm w-full bg-white outline-none focus:border-blue-500 h-[38px]" 
                                        title="Đến ngày" 
                                    />
                                </div>
                            </div>

                            <div className="lg:col-span-2">
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

                            <div className="lg:col-span-3">
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

                            <div className="lg:col-span-2">
                                <button 
                                    onClick={handleExportFromModal}
                                    disabled={modalFilteredRecords.length === 0}
                                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full h-[38px]"
                                >
                                    <FileSpreadsheet size={16} className="shrink-0" /> Xuất Excel ({modalFilteredRecords.length})
                                </button>
                            </div>
                        </div>

                        {/* Modal Body - Record Table list */}
                        <div className="flex-1 overflow-auto p-6">
                            <table className="w-full text-left text-sm border border-gray-200 rounded-xl overflow-hidden">
                                <thead className="bg-gray-100 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm z-10 border-b border-gray-200">
                                    <tr>
                                        <th className="p-3 w-12 text-center">STT</th>
                                        <th className="p-3 w-32">Mã biên nhận</th>
                                        <th className="p-3 w-48">Chủ sử dụng đất</th>
                                        <th className="p-3 w-32">Xã / Phường</th>
                                        <th className="p-3 w-28">Ngày nhận</th>
                                        <th className="p-3 w-28">Hẹn trả</th>
                                        <th className="p-3 w-28">Hoàn thành</th>
                                        <th className="p-3 w-36 font-semibold">Cán bộ xử lý</th>
                                        <th className="p-3 w-32 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {paginatedRecords.length > 0 ? paginatedRecords.map((r, i) => {
                                        const emp = employees.find(e => e.id === r.assignedTo);
                                        const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                        return (
                                            <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                                                <td className="p-3 text-center text-gray-500 font-medium">{rowIndex}</td>
                                                <td className="p-3 font-semibold text-blue-700">{r.code}</td>
                                                <td className="p-3 font-semibold text-gray-800">{r.customerName}</td>
                                                <td className="p-3 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                                <td className="p-3 text-gray-600">{formatDate(r.receivedDate)}</td>
                                                <td className="p-3 font-medium text-amber-700">{formatDate(r.deadline)}</td>
                                                <td className="p-3 font-semibold text-emerald-700">{formatDate(r.completedDate || r.resultReturnedDate)}</td>
                                                <td className="p-3 text-gray-600 text-xs font-medium max-w-xs truncate" title={emp?.name}>{emp ? emp.name : '-'}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${
                                                        r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-150 text-green-800 border-green-200 bg-green-50' : 
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
                                            <td colSpan={9} className="p-12 text-center text-gray-400 italic">
                                                Không có dữ liệu phù hợp với bộ lọc nêu trên. Vui lòng thử thay đổi khoảng ngày hoặc địa bàn xã phường.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer / Pagination */}
                        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Hiển thị</span>
                                <select 
                                    value={itemsPerPage} 
                                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="border border-gray-300 rounded px-2 py-0.5 text-xs outline-none bg-white font-medium"
                                >
                                    <option value={10}>10</option>
                                    <option value={15}>15</option>
                                    <option value={30}>30</option>
                                    <option value={50}>50</option>
                                </select>
                                <span className="text-xs text-gray-500">dòng mỗi trang</span>
                            </div>

                            <div className="text-xs font-semibold text-gray-500">
                                Đang chọn lọc <span className="text-slate-800 font-black">{modalFilteredRecords.length}</span> hồ sơ
                            </div>
                            
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft size={16} className="text-gray-600" />
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
                                                        className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center transition-all ${currentPage === pageNum ? `${theme.primary} text-white` : 'text-gray-600 hover:bg-gray-200'}`}
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
                                        className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight size={16} className="text-gray-600" />
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyStatsView;

