
import React, { useState, useMemo } from 'react';
import { WorkSchedule } from '../../types';
import { Search, Edit, Trash2, CalendarDays, FileSpreadsheet, Filter } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { confirmAction } from '../../utils/appHelpers';
import FlexibleDateInput from '../FlexibleDateInput';

interface ScheduleListProps {
    schedules: WorkSchedule[];
    onEdit: (s: WorkSchedule) => void;
    onDelete: (id: string) => void;
}

const ScheduleList: React.FC<ScheduleListProps> = ({ schedules, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'week' | 'month' | 'range'>('month');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterPopoverRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeFilterCount = filterType !== 'all' ? 1 : 0;

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Init current month range
    React.useEffect(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setDateRange({ 
            from: start.toISOString().split('T')[0], 
            to: end.toISOString().split('T')[0] 
        });
    }, []);

    const handleFilterPreset = (type: 'week' | 'month') => {
        setFilterType(type);
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (type === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2
            start = new Date(now.getFullYear(), now.getMonth(), diff);
            end = new Date(now.getFullYear(), now.getMonth(), diff + 6);
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }
        setDateRange({ 
            from: start.toISOString().split('T')[0], 
            to: end.toISOString().split('T')[0] 
        });
    };

    const filteredList = useMemo(() => {
        return schedules.filter(s => {
            // Search Text
            const lowerSearch = searchTerm.toLowerCase();
            const matchText = 
                s.content.toLowerCase().includes(lowerSearch) ||
                s.executors.toLowerCase().includes(lowerSearch) ||
                (s.partner || '').toLowerCase().includes(lowerSearch);
            
            if (!matchText) return false;

            // Filter Date
            if (filterType !== 'all') {
                if (!dateRange.from || !dateRange.to) return true;
                const sDate = s.date;
                return sDate >= dateRange.from && sDate <= dateRange.to;
            }

            return true;
        });
    }, [schedules, searchTerm, filterType, dateRange]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const formatDateDDMMYYYY = (isoStr: string) => {
        if (!isoStr) return '';
        const parts = isoStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return isoStr;
    };

    const handleExport = () => {
        if (filteredList.length === 0) {
            alert("Không có dữ liệu để xuất.");
            return;
        }

        const dataRows = filteredList.map((s, idx) => [
            idx + 1,
            formatDate(s.date),
            s.content,
            s.partner,
            s.executors,
            '' // Ghi chú
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        // Header styles
        const headerStyle = { font: { bold: true, name: "Times New Roman" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, fill: { fgColor: { rgb: "E0E0E0" } } };
        const cellStyle = { font: { name: "Times New Roman" }, alignment: { vertical: "center", wrapText: true }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
        const centerStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: "center" } };

        // Title info
        const titleRange = filterType === 'all' ? "TOÀN BỘ" : `TỪ NGÀY ${formatDate(dateRange.from)} ĐẾN NGÀY ${formatDate(dateRange.to)}`;

        XLSX.utils.sheet_add_aoa(ws, [
            ["LỊCH CÔNG TÁC"],
            [titleRange],
            [""],
            ["STT", "Ngày", "Nội dung công việc", "Cơ quan phối hợp", "Người thực hiện", "Ghi chú"]
        ], { origin: "A1" });

        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A5" });

        // Merges
        if(!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: {r:0, c:0}, e: {r:0, c:5} });
        ws['!merges'].push({ s: {r:1, c:0}, e: {r:1, c:5} });

        // Column widths
        ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 25 }, { wch: 15 }];

        // Apply styles
        ws['A1'].s = { font: { sz: 16, bold: true, name: "Times New Roman" }, alignment: { horizontal: "center" } };
        ws['A2'].s = { font: { sz: 12, italic: true, name: "Times New Roman" }, alignment: { horizontal: "center" } };

        // Header row
        for(let c=0; c<=5; c++) {
            const ref = XLSX.utils.encode_cell({r: 3, c: c});
            if(!ws[ref]) ws[ref] = {v: "", t:'s'};
            ws[ref].s = headerStyle;
        }

        // Data rows
        for(let r=4; r < 4 + dataRows.length; r++) {
            for(let c=0; c<=5; c++) {
                const ref = XLSX.utils.encode_cell({r: r, c: c});
                if(!ws[ref]) ws[ref] = {v: "", t:'s'};
                if(c === 0 || c === 1) ws[ref].s = centerStyle;
                else ws[ref].s = cellStyle;
            }
        }

        XLSX.utils.book_append_sheet(wb, ws, "LichCongTac");
        XLSX.writeFile(wb, `Lich_Cong_Tac_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleDelete = async (id: string) => {
        if(await confirmAction("Bạn có chắc chắn muốn xóa lịch này?")) {
            onDelete(id);
        }
    };

    // Reset pagination when filter changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, dateRange.from, dateRange.to]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);
    const paginatedList = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredList.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredList, currentPage, itemsPerPage]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                {/* Left side: Title */}
                <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm shrink-0">
                    <CalendarDays size={18} className="text-blue-600"/> Lịch công tác ({filteredList.length})
                </h3>
                
                {/* Right side: Search -> Filter Popover (in middle) -> Export Excel */}
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                    {/* 1. Search Bar */}
                    <div className="relative w-64 sm:w-72 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Tìm nội dung, người thực hiện..." 
                            className="w-full pl-9 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white shadow-2xs"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* 2. Filter Dropdown Popover */}
                    <div className="relative" ref={filterPopoverRef}>
                        <button
                            type="button"
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`relative p-2 rounded-lg text-sm transition-all shadow-xs border cursor-pointer flex items-center justify-center ${
                                activeFilterCount > 0
                                    ? "border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100"
                                    : "border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
                            }`}
                            title="Bộ lọc thời gian lịch công tác"
                        >
                            <Filter size={16} className={activeFilterCount > 0 ? "text-blue-600" : "text-gray-600"} />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full font-bold flex items-center justify-center shadow-xs">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {isFilterOpen && (
                            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-fade-in text-gray-800">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                                    <div className="flex items-center gap-1.5 font-bold text-gray-800 text-xs sm:text-sm">
                                        <CalendarDays size={15} className="text-blue-600" />
                                        <span>Lọc theo thời gian</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFilterType('all')}
                                        className="text-[11px] text-red-500 hover:underline font-bold cursor-pointer"
                                    >
                                        Tất cả
                                    </button>
                                </div>

                                {/* Quick Presets */}
                                <div className="grid grid-cols-3 gap-1 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => handleFilterPreset('week')}
                                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors text-center cursor-pointer ${
                                            filterType === 'week' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                                        }`}
                                    >
                                        Tuần này
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterPreset('month')}
                                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors text-center cursor-pointer ${
                                            filterType === 'month' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                                        }`}
                                    >
                                        Tháng này
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterType('all')}
                                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors text-center cursor-pointer ${
                                            filterType === 'all' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                                        }`}
                                    >
                                        Tất cả
                                    </button>
                                </div>

                                {/* Custom Date Range Inputs */}
                                <div className="space-y-2 mb-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Từ ngày</label>
                                        <FlexibleDateInput
                                            value={dateRange.from}
                                            onChange={(isoStr) => { setDateRange(prev => ({ ...prev, from: isoStr })); setFilterType('range'); }}
                                            placeholder="dd/mm/yyyy"
                                            size="sm"
                                            className="w-full"
                                            inputClassName="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Đến ngày</label>
                                        <FlexibleDateInput
                                            value={dateRange.to}
                                            onChange={(isoStr) => { setDateRange(prev => ({ ...prev, to: isoStr })); setFilterType('range'); }}
                                            placeholder="dd/mm/yyyy"
                                            size="sm"
                                            className="w-full"
                                            inputClassName="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsFilterOpen(false)}
                                        className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
                                    >
                                        Áp dụng
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. Export Excel Button */}
                    <button 
                        onClick={handleExport} 
                        className="relative flex items-center justify-center bg-white text-emerald-700 border border-emerald-300 p-2 rounded-lg hover:bg-emerald-50 shadow-xs shrink-0 transition-all active:scale-95 cursor-pointer"
                        title={`Xuất lịch công tác ra file Excel (${filteredList.length} lịch)`}
                        aria-label="Xuất file Excel"
                    >
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                        {filteredList.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#802a0a] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs border border-white leading-none">
                                {filteredList.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-28">Ngày</th>
                            <th className="p-3">Nội dung công việc</th>
                            <th className="p-3 w-40">Cơ quan PH</th>
                            <th className="p-3 w-48">Người thực hiện</th>
                            <th className="p-3 w-20 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-100">
                        {paginatedList.length > 0 ? paginatedList.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="p-3 text-center text-gray-400">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                <td className="p-3 font-medium text-blue-600">{formatDate(item.date)}</td>
                                <td className="p-3 text-gray-800 font-medium">{item.content}</td>
                                <td className="p-3 text-gray-600">{item.partner || '-'}</td>
                                <td className="p-3 text-gray-600 text-xs font-medium">{item.executors}</td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => onEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="Sửa"><Edit size={14}/></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded" title="Xóa"><Trash2 size={14}/></button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Không có lịch công tác nào.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {filteredList.length > 0 && (
                <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center shrink-0 rounded-b-xl">
                    <span className="text-xs text-gray-500">
                        Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredList.length)}</strong> trên tổng <strong>{filteredList.length}</strong>
                    </span>
                    <div className="flex items-center gap-1">
                        <div className="flex items-center mr-4 gap-2">
                            <span className="text-xs text-gray-500">Số lượng:</span>
                            <select 
                                value={itemsPerPage} 
                                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} 
                                className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                            disabled={currentPage === 1} 
                            className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                        >
                            Trước
                        </button>
                        <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                            disabled={currentPage === totalPages} 
                            className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                        >
                            Sau
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleList;
