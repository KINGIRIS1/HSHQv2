import React, { useState, useMemo } from 'react';
import { History, RotateCcw, FileSpreadsheet, Trash2, Search, Eye, CheckCircle2, PlusCircle, Activity, FileSignature, AlertCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, LogIn, UserCheck, Settings, FileCheck, Send } from 'lucide-react';
import { RecordFile, User, Employee, SystemActivityLog } from '../types';
import { getAllSystemActivityLogs, clearStoredActivityLogs, exportActivityLogsToExcel } from '../services/activityLogService';

interface ActivityLogViewProps {
    records: RecordFile[];
    users: User[];
    employees: Employee[];
    currentUser?: User;
    onViewRecord?: (record: RecordFile) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
    records = [],
    users = [],
    employees = [],
    currentUser,
    onViewRecord
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAction, setSelectedAction] = useState('all');
    const [selectedTarget, setSelectedTarget] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedLogForDetail, setSelectedLogForDetail] = useState<SystemActivityLog | null>(null);

    // Fetch and aggregate all logs
    const allLogs = useMemo(() => {
        return getAllSystemActivityLogs(records, users, employees);
    }, [records, users, employees, refreshKey]);

    // Filtering
    const filteredLogs = useMemo(() => {
        return allLogs.filter(log => {
            // Search filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const matchName = log.performerName.toLowerCase().includes(term);
                const matchCode = (log.referenceCode || '').toLowerCase().includes(term);
                const matchDetail = log.details.toLowerCase().includes(term);
                if (!matchName && !matchCode && !matchDetail) return false;
            }

            // Action filter
            if (selectedAction !== 'all') {
                const act = selectedAction.toUpperCase();
                if (act === 'CREATE' && log.actionType !== 'CREATE') return false;
                if (act === 'UPDATE' && log.actionType !== 'UPDATE') return false;
                if (act === 'DELETE' && (log.actionType !== 'DELETE' && log.actionType !== 'REJECT')) return false;
                if (act === 'LOGIN' && log.actionType !== 'LOGIN') return false;
                if (act === 'ASSIGN' && log.actionType !== 'ASSIGN') return false;
                if (act === 'SUBMIT_CHECK' && (log.actionType !== 'SUBMIT_CHECK' && log.actionType !== 'PENDING_CHECK')) return false;
                if (act === 'SUBMIT_SIGN' && (log.actionType !== 'SUBMIT_SIGN' && log.actionType !== 'PENDING_SIGN')) return false;
                if (act === 'APPROVE' && (log.actionType !== 'APPROVE' && log.actionType !== 'SIGNED' && log.actionType !== 'CHECKED')) return false;
                if (act === 'RETURN' && (log.actionType !== 'RETURN_RESULT' && log.actionType !== 'RETURN')) return false;
                if (act === 'EXPORT' && log.actionType !== 'EXPORT') return false;
                if (act === 'SYSTEM' && log.actionType !== 'SYSTEM') return false;
            }

            // Target filter
            if (selectedTarget !== 'all') {
                if (selectedTarget === 'record' && log.targetType !== 'Hồ sơ') return false;
                if (selectedTarget === 'employee' && log.targetType !== 'Nhân sự') return false;
                if (selectedTarget === 'contract' && log.targetType !== 'Hợp đồng') return false;
                if (selectedTarget === 'system' && log.targetType !== 'Hệ thống') return false;
            }

            // Date filter
            if (fromDate) {
                const dLog = new Date(log.timestamp);
                const dFrom = new Date(fromDate);
                dFrom.setHours(0, 0, 0, 0);
                if (dLog < dFrom) return false;
            }
            if (toDate) {
                const dLog = new Date(log.timestamp);
                const dTo = new Date(toDate);
                dTo.setHours(23, 59, 59, 999);
                if (dLog > dTo) return false;
            }

            return true;
        });
    }, [allLogs, searchTerm, selectedAction, selectedTarget, fromDate, toDate]);

    // Pagination
    const totalRecords = filteredLogs.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedLogs = useMemo(() => {
        return filteredLogs.slice(startIndex, startIndex + pageSize);
    }, [filteredLogs, startIndex, pageSize]);

    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    const handleExportExcel = () => {
        exportActivityLogsToExcel(filteredLogs);
    };

    const handleClearLogs = () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ nhật ký lịch sử thao tác bộ nhớ tạm?')) {
            clearStoredActivityLogs();
            setRefreshKey(prev => prev + 1);
        }
    };

    const formatLogTime = (isoStr: string) => {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        return `${time} ${date}`;
    };

    const getInitialLetter = (name: string) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        return parts[parts.length - 1].charAt(0).toUpperCase();
    };

    const handleRowCodeClick = (log: SystemActivityLog) => {
        if (log.recordId && onViewRecord) {
            const foundRec = records.find(r => r.id === log.recordId || r.code === log.referenceCode);
            if (foundRec) {
                onViewRecord(foundRec);
                return;
            }
        }
        if (log.referenceCode && onViewRecord) {
            const foundRec = records.find(r => r.code === log.referenceCode);
            if (foundRec) {
                onViewRecord(foundRec);
            }
        }
    };

    const renderActionBadge = (log: SystemActivityLog) => {
        const actionType = (log.actionType || '').toUpperCase();
        const label = log.actionLabel || log.actionType;

        if (actionType === 'CREATE' || label === 'Thêm mới') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                    <PlusCircle size={13} /> Thêm mới
                </span>
            );
        }
        if (actionType === 'UPDATE' || label === 'Cập nhật') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-300">
                    <Activity size={13} /> Cập nhật
                </span>
            );
        }
        if (actionType === 'DELETE' || actionType === 'REJECT' || label === 'Xóa' || label === 'Trả hồ sơ') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-300">
                    <AlertCircle size={13} /> {label || 'Xóa'}
                </span>
            );
        }
        if (actionType === 'LOGIN' || label === 'Đăng nhập') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-300">
                    <LogIn size={13} /> Đăng nhập
                </span>
            );
        }
        if (actionType === 'ASSIGN' || label === 'Phân công' || label === 'Giao việc') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-300">
                    <UserCheck size={13} /> {label || 'Phân công'}
                </span>
            );
        }
        if (actionType === 'RETURN' || actionType === 'RETURN_RESULT' || label === 'Trả kết quả') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-300">
                    <CheckCircle2 size={13} /> Trả kết quả
                </span>
            );
        }
        if (actionType === 'EXPORT' || label === 'Xuất Excel') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
                    <FileSpreadsheet size={13} /> Xuất Excel
                </span>
            );
        }
        if (actionType === 'SYSTEM' || label === 'Cấu hình') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                    <Settings size={13} /> Cấu hình
                </span>
            );
        }
        if (actionType === 'SUBMIT_CHECK' || actionType === 'PENDING_CHECK' || label === 'Trình kiểm tra') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-300">
                    <FileCheck size={13} /> Trình kiểm tra
                </span>
            );
        }
        if (actionType === 'SUBMIT_SIGN' || actionType === 'PENDING_SIGN' || label === 'Trình ký') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-300">
                    <Send size={13} /> Trình ký
                </span>
            );
        }
        if (actionType === 'APPROVE' || actionType === 'SIGNED' || actionType === 'CHECKED' || label === 'Ký duyệt' || label === 'Đã ký') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-300">
                    <FileSignature size={13} /> Ký duyệt
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-300">
                <Activity size={13} /> {label}
            </span>
        );
    };

    return (
        <div className="flex flex-col flex-1 h-full bg-slate-50/50 p-3 sm:p-5 gap-4 overflow-y-auto">
            {/* HEADER CARD */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                        <History size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                Lịch sử thao tác & Nhật ký hệ thống
                            </h2>
                            <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-blue-200">
                                {filteredLogs.length} thao tác
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Ghi lại chi tiết mọi hành động thêm mới, sửa, xóa, phân công và xuất dữ liệu của từng cán bộ.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs shadow-2xs transition-all active:scale-95"
                    >
                        <RotateCcw size={15} />
                        <span>Làm mới</span>
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl font-bold text-xs shadow-2xs transition-all active:scale-95"
                    >
                        <FileSpreadsheet size={15} />
                        <span>Xuất Excel</span>
                    </button>
                    {currentUser?.role === 'ADMIN' && (
                        <button
                            onClick={handleClearLogs}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs shadow-2xs transition-all active:scale-95"
                        >
                            <Trash2 size={15} />
                            <span>Xóa log</span>
                        </button>
                    )}
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm theo nội dung, người dùng, mã hồ sơ..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-10 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>

                {/* Dropdown Action */}
                <select
                    value={selectedAction}
                    onChange={(e) => { setSelectedAction(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer min-w-[170px]"
                >
                    <option value="all">Tất cả hành động</option>
                    <option value="CREATE">Thêm mới (CREATE)</option>
                    <option value="UPDATE">Cập nhật (UPDATE)</option>
                    <option value="ASSIGN">Phân công (ASSIGN)</option>
                    <option value="SUBMIT_CHECK">Trình kiểm tra (SUBMIT_CHECK)</option>
                    <option value="SUBMIT_SIGN">Trình ký (SUBMIT_SIGN)</option>
                    <option value="APPROVE">Ký duyệt (APPROVE)</option>
                    <option value="RETURN">Trả kết quả (RETURN)</option>
                    <option value="DELETE">Xóa (DELETE)</option>
                    <option value="LOGIN">Đăng nhập (LOGIN)</option>
                    <option value="EXPORT">Xuất Excel (EXPORT)</option>
                    <option value="SYSTEM">Cấu hình (SYSTEM)</option>
                </select>

                {/* Dropdown Target */}
                <select
                    value={selectedTarget}
                    onChange={(e) => { setSelectedTarget(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 cursor-pointer min-w-[140px]"
                >
                    <option value="all">Tất cả đối tượng</option>
                    <option value="record">Hồ sơ</option>
                    <option value="employee">Nhân sự</option>
                    <option value="contract">Hợp đồng</option>
                    <option value="system">Hệ thống</option>
                </select>

                {/* Date range */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1">
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none px-2 py-1 cursor-pointer"
                    />
                    <span className="text-slate-400 font-bold text-xs">-</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none px-2 py-1 cursor-pointer"
                    />
                </div>
            </div>

            {/* DATA TABLE CARD */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <th className="py-3.5 px-4 text-center w-12">STT</th>
                                <th className="py-3.5 px-4 w-44">THỜI GIAN</th>
                                <th className="py-3.5 px-4 w-48">NGƯỜI THỰC HIỆN</th>
                                <th className="py-3.5 px-4 w-36">HÀNH ĐỘNG</th>
                                <th className="py-3.5 px-4 w-28">ĐỐI TƯỢNG</th>
                                <th className="py-3.5 px-4 w-40">MÃ THAM CHIẾU</th>
                                <th className="py-3.5 px-4">CHI TIẾT THAO TÁC</th>
                                <th className="py-3.5 px-4 text-center w-16">XEM</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                                        Không tìm thấy lịch sử thao tác phù hợp điều kiện lọc.
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log, idx) => {
                                    const stt = startIndex + idx + 1;
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3.5 px-4 text-center font-bold text-slate-400">{stt}</td>
                                            <td className="py-3.5 px-4 font-semibold text-slate-600 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={13} className="text-slate-400 shrink-0" />
                                                    <span>{formatLogTime(log.timestamp)}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                                        {getInitialLetter(log.performerName)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 leading-tight">{log.performerName}</span>
                                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">{log.performerRole || 'ONEDOOR'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {renderActionBadge(log)}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                    {log.targetType || 'Hồ sơ'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {log.referenceCode && log.referenceCode !== '-' ? (
                                                    <button
                                                        onClick={() => handleRowCodeClick(log)}
                                                        className="font-bold text-blue-600 hover:text-blue-800 font-mono tracking-tight hover:underline cursor-pointer"
                                                    >
                                                        {log.referenceCode}
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-400 font-mono">-</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-700 font-normal leading-relaxed">
                                                {log.details}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <button
                                                    onClick={() => setSelectedLogForDetail(log)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Xem chi tiết nhật ký"
                                                >
                                                    <Eye size={17} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION FOOTER */}
                <div className="mt-auto border-t border-slate-200/80 px-4 py-3 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium">
                    <div>
                        Hiển thị <strong className="text-slate-900">{totalRecords > 0 ? startIndex + 1 : 0} - {Math.min(startIndex + pageSize, totalRecords)}</strong> trên tổng số <strong className="text-blue-700">{totalRecords}</strong> thao tác
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <span>Hiển thị:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none text-slate-700 cursor-pointer shadow-2xs"
                            >
                                <option value={10}>10 dòng/trang</option>
                                <option value={15}>15 dòng/trang</option>
                                <option value={20}>20 dòng/trang</option>
                                <option value={50}>50 dòng/trang</option>
                                <option value={100}>100 dòng/trang</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg hover:bg-slate-200/70 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                title="Trang đầu"
                            >
                                <ChevronsLeft size={16} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg hover:bg-slate-200/70 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                title="Trang trước"
                            >
                                <ChevronLeft size={16} />
                            </button>

                            <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold shadow-2xs text-xs">
                                {currentPage}
                            </span>
                            <span className="text-slate-400 font-bold">/ {totalPages}</span>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage >= totalPages}
                                className="p-1.5 rounded-lg hover:bg-slate-200/70 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                title="Trang sau"
                            >
                                <ChevronRight size={16} />
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage >= totalPages}
                                className="p-1.5 rounded-lg hover:bg-slate-200/70 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                title="Trang cuối"
                            >
                                <ChevronsRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* DETAIL MODAL */}
            {selectedLogForDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[80] p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-scale-up">
                        <div className="bg-slate-900 px-5 py-3.5 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <History size={18} className="text-blue-400" />
                                <span>Chi tiết nhật ký thao tác</span>
                            </div>
                            <button
                                onClick={() => setSelectedLogForDetail(null)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-5 space-y-3 text-xs text-slate-700">
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="font-bold text-slate-500">Thời gian:</span>
                                <span className="font-semibold text-slate-900">{formatLogTime(selectedLogForDetail.timestamp)}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="font-bold text-slate-500">Người thực hiện:</span>
                                <span className="font-bold text-blue-700">{selectedLogForDetail.performerName} ({selectedLogForDetail.performerRole || 'ONEDOOR'})</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="font-bold text-slate-500">Hành động / Đối tượng:</span>
                                <span className="font-semibold text-slate-800">{selectedLogForDetail.actionLabel} - {selectedLogForDetail.targetType}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span className="font-bold text-slate-500">Mã tham chiếu:</span>
                                <span className="font-mono font-bold text-indigo-600">{selectedLogForDetail.referenceCode || '-'}</span>
                            </div>
                            <div>
                                <span className="font-bold text-slate-500 block mb-1">Nội dung chi tiết:</span>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-mono">
                                    {selectedLogForDetail.details}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 px-5 py-3 flex justify-end">
                            <button
                                onClick={() => setSelectedLogForDetail(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityLogView;
