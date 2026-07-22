
import React, { useState, useMemo } from 'react';
import { WorkSchedule } from '../../types';
import { Search, Edit, Trash2, CalendarDays, FileSpreadsheet, Filter } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { confirmAction } from '../../utils/appHelpers';

interface ScheduleListProps {
    schedules: WorkSchedule[];
    onEdit: (s: WorkSchedule) => void;
    onDelete: (id: string) => void;
}

const ScheduleList: React.FC<ScheduleListProps> = ({ schedules, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'week' | 'month' | 'range'>('month');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

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
            start = new Date(now.setDate(diff));
            end = new Date(now.setDate(diff + 6));
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
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
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
    }, [searchTerm, filterType, dateRange]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredList.length / itemsPerPage);
    const paginatedList = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredList.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredList, currentPage, itemsPerPage]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <CalendarDays size={18} className="text-blue-600"/> Danh sách lịch ({filteredList.length})
                    </h3>
                    
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
                        <button onClick={() => handleFilterPreset('week')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'week' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>Tuần này</button>
                        <button onClick={() => handleFilterPreset('month')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'month' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>Tháng này</button>
                        <button onClick={() => setFilterType('all')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'all' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>Tất cả</button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Tìm nội dung, người thực hiện..." 
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {filterType !== 'all' && (
                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-sm">
                            <input type="date" className="text-sm border-none outline-none text-gray-600 font-medium w-32" value={dateRange.from} onChange={e => { setDateRange({...dateRange, from: e.target.value}); setFilterType('range'); }} />
                            <span className="text-gray-400">➜</span>
                            <input type="date" className="text-sm border-none outline-none text-gray-600 font-medium w-32" value={dateRange.to} onChange={e => { setDateRange({...dateRange, to: e.target.value}); setFilterType('range'); }} />
                        </div>
                    )}

                    <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm ml-auto">
                        <FileSpreadsheet size={16} /> Xuất Excel
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
