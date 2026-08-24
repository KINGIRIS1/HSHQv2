import React, { useState, useMemo } from 'react';
import { Search, X, Printer, CalendarClock, Calendar, CalendarDays, CalendarRange, Clock, MapPin } from 'lucide-react';
import { RecordFile, Employee, User } from '../../types';
import { getShortRecordType, getWardLabel } from '../../constants';
import { removeVietnameseTones, toTitleCase } from '../../utils/appHelpers';
import StatusBadge from '../StatusBadge';

interface ExtendedRecordsViewProps {
    records: RecordFile[];
    employees: Employee[];
    currentUser: User;
    wards?: string[];
    onPrintReceipt?: (record: RecordFile) => void;
    onViewRecord?: (record: RecordFile) => void;
}

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

export const ExtendedRecordsView: React.FC<ExtendedRecordsViewProps> = ({
    records = [],
    employees = [],
    currentUser,
    wards = [],
    onPrintReceipt,
    onViewRecord
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [datePreset, setDatePreset] = useState<'all' | 'week' | 'month' | 'today'>('all');
    const [selectedWard, setSelectedWard] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Filter only extended records (records with originalDeadline or extendedBy)
    const extendedRecords = useMemo(() => {
        return records.filter(r => Boolean(r.originalDeadline || r.extendedBy || r.extendedAt));
    }, [records]);

    // Filter by search keyword, date preset/range, ward
    const filteredRecords = useMemo(() => {
        return extendedRecords.filter(r => {
            // Search term
            if (searchTerm.trim()) {
                const term = removeVietnameseTones(searchTerm.toLowerCase().trim());
                const code = removeVietnameseTones(r.code || '').toLowerCase();
                const name = removeVietnameseTones(r.customerName || '').toLowerCase();
                const phone = (r.phoneNumber || '').toLowerCase();
                const plot = (r.landPlot || '').toLowerCase();
                const sheet = (r.mapSheet || '').toLowerCase();
                const ward = removeVietnameseTones(r.ward || '').toLowerCase();
                const type = removeVietnameseTones(r.recordType || '').toLowerCase();

                const extEmp = employees.find(e => e.id === r.extendedBy || e.id === r.assignedTo);
                const extEmpName = extEmp ? removeVietnameseTones(extEmp.name || '').toLowerCase() : '';

                const matchesSearch = code.includes(term) ||
                    name.includes(term) ||
                    phone.includes(term) ||
                    plot === term ||
                    sheet === term ||
                    ward.includes(term) ||
                    type.includes(term) ||
                    extEmpName.includes(term);

                if (!matchesSearch) return false;
            }

            // Ward filter
            if (selectedWard !== 'all' && r.ward !== selectedWard) {
                return false;
            }

            // Date filter (based on extendedAt or deadline or originalDeadline)
            const recDateStr = r.extendedAt || r.deadline || r.receivedDate;
            if (!recDateStr) return datePreset === 'all';

            const rDate = new Date(recDateStr);
            if (isNaN(rDate.getTime())) return datePreset === 'all';

            const now = new Date();

            if (datePreset === 'today') {
                const isToday = rDate.getFullYear() === now.getFullYear() &&
                    rDate.getMonth() === now.getMonth() &&
                    rDate.getDate() === now.getDate();
                if (!isToday) return false;
            } else if (datePreset === 'week') {
                const startOfWeek = new Date(now);
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                startOfWeek.setDate(diff);
                startOfWeek.setHours(0, 0, 0, 0);
                if (rDate < startOfWeek || rDate > now) return false;
            } else if (datePreset === 'month') {
                const isMonth = rDate.getFullYear() === now.getFullYear() &&
                    rDate.getMonth() === now.getMonth();
                if (!isMonth) return false;
            }

            if (fromDate) {
                const fDate = new Date(fromDate);
                fDate.setHours(0, 0, 0, 0);
                if (rDate < fDate) return false;
            }

            if (toDate) {
                const tDate = new Date(toDate);
                tDate.setHours(23, 59, 59, 999);
                if (rDate > tDate) return false;
            }

            return true;
        });
    }, [extendedRecords, searchTerm, selectedWard, datePreset, fromDate, toDate, employees]);

    const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRecords.slice(start, start + pageSize);
    }, [filteredRecords, currentPage, pageSize]);

    const cellClass = "p-3 align-middle text-slate-700 border-b border-slate-100 transition-colors";

    return (
        <div className="flex flex-col h-full bg-slate-50/50 rounded-xl overflow-hidden animate-fade-in">
            {/* Horizontal Filter Bar matching image */}
            <div className="p-3 bg-white border-b border-slate-200 shrink-0 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {/* Search Input */}
                    <div className="relative min-w-[220px] flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Tìm kiếm mã, chủ sử dụng, SĐT, tờ, thửa..."
                            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium text-slate-800"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Ward Dropdown Filter */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs shrink-0">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <select
                            value={selectedWard}
                            onChange={(e) => { setSelectedWard(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent font-medium text-slate-800 outline-none cursor-pointer"
                        >
                            <option value="all">Toàn bộ địa bàn</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{getWardLabel(w)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Range Selector matching image */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs shrink-0">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span className="text-slate-500 font-medium">Từ:</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent font-medium text-slate-800 outline-none w-28 cursor-pointer"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent font-medium text-slate-800 outline-none w-28 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-3 sm:p-4 min-h-0">
                {filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <div className="p-3 bg-amber-50 text-amber-500 rounded-full mb-3">
                            <CalendarClock size={32} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700 mb-1">Không tìm thấy hồ sơ gia hạn phù hợp</h3>
                        <p className="text-xs text-slate-500 max-w-sm">
                            Vui lòng thử thay đổi từ khóa hoặc khoảng thời gian tìm kiếm.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
                        <div className="overflow-auto max-h-[calc(100vh-220px)] min-h-[350px]">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[11px] sticky top-0 z-10 shadow-xs">
                                        <th className="p-3 w-12 text-center">STT</th>
                                        <th className="p-3 w-[120px] text-center">MÃ HỒ SƠ</th>
                                        <th className="p-3 w-60 text-center">CHỦ SỬ DỤNG</th>
                                        <th className="p-3 w-40 text-center">LOẠI HỒ SƠ</th>
                                        <th className="p-3 w-28 text-center">HẠN GỐC</th>
                                        <th className="p-3 w-28 text-center">GIA HẠN MỚI</th>
                                        <th className="p-3 w-36 text-center">NGƯỜI THỰC HIỆN</th>
                                        <th className="p-3 w-32 text-center">TRẠNG THÁI</th>
                                        <th className="p-3 w-24 text-center sticky right-0 bg-slate-50 z-20">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {paginatedRecords.map((record, index) => {
                                        const globalIndex = (currentPage - 1) * pageSize + index + 1;
                                        const executor = employees.find(e => e.id === record.extendedBy || e.id === record.assignedTo);

                                        return (
                                            <tr key={record.id} className="hover:bg-amber-50/40 transition-colors">
                                                <td className={`${cellClass} text-center font-mono text-slate-500`}>
                                                    {globalIndex}
                                                </td>
                                                <td className={`${cellClass} text-center font-bold font-mono text-blue-700 cursor-pointer`} onClick={() => onViewRecord?.(record)}>
                                                    {record.code}
                                                </td>
                                                <td className={`${cellClass} text-center font-bold text-slate-800`}>
                                                    {toTitleCase(record.customerName)}
                                                    {record.ward && (
                                                        <div className="text-[10px] font-normal text-slate-500">
                                                            {getWardLabel(record.ward)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={`${cellClass} text-center text-slate-700`}>
                                                    {getShortRecordType(record.recordType)}
                                                </td>
                                                <td className={`${cellClass} text-center font-bold font-mono text-slate-600`}>
                                                    {formatDate(record.originalDeadline || record.deadline)}
                                                </td>
                                                <td className={`${cellClass} text-center font-bold font-mono text-amber-700 bg-amber-50/80 rounded`}>
                                                    {formatDate(record.deadline)}
                                                </td>
                                                <td className={`${cellClass} text-center text-slate-700`}>
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-[11px] text-slate-800">
                                                        {executor?.name || record.extendedBy || record.receivedBy || '--'}
                                                    </span>
                                                </td>
                                                <td className={`${cellClass} text-center`}>
                                                    <StatusBadge status={record.status} />
                                                </td>
                                                {/* ONLY 1 ACTION: Print receipt */}
                                                <td className={`${cellClass} text-center sticky right-0 bg-white shadow-l`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => onPrintReceipt?.(record)}
                                                        className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 bg-amber-50/50 cursor-pointer flex items-center justify-center mx-auto gap-1"
                                                        title="In lại biên nhận có ngày hẹn mới"
                                                    >
                                                        <Printer size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExtendedRecordsView;
