import React, { useState, useMemo } from 'react';
import { Search, X, CheckSquare, Square, FileSpreadsheet, Lock, Calendar, Layers, CalendarDays, CalendarRange, Clock, MapPin } from 'lucide-react';
import { RecordFile, User, RecordStatus } from '../../types';
import { getShortRecordType, getWardLabel } from '../../constants';
import { removeVietnameseTones, toTitleCase } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface ReturnedResultListViewProps {
    records: RecordFile[];
    currentUser: User;
    wards?: string[];
    onUpdateBulk?: (field: keyof RecordFile, value: any, customDate?: string, targetRecordIds?: string[]) => Promise<void>;
    onViewRecord?: (record: RecordFile) => void;
}

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

export const ReturnedResultListView: React.FC<ReturnedResultListViewProps> = ({
    records = [],
    currentUser,
    wards = [],
    onUpdateBulk,
    onViewRecord
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [datePreset, setDatePreset] = useState<'all' | 'week' | 'month' | 'today'>('all');
    const [selectedWard, setSelectedWard] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Calculate next batch default name based on highest existing archiveBatchName
    const defaultNextBatchName = useMemo(() => {
        let maxBatchNum = 0;
        records.forEach(r => {
            if (r.archiveBatchName) {
                const match = r.archiveBatchName.match(/\d+/);
                if (match) {
                    const num = parseInt(match[0], 10);
                    if (num > maxBatchNum) maxBatchNum = num;
                }
            }
        });
        return `Đợt ${maxBatchNum + 1}`;
    }, [records]);

    // Modal state for Export DS Lưu
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [batchName, setBatchName] = useState(defaultNextBatchName);
    const [exportDate, setExportDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Update batchName state if defaultNextBatchName changes and batchName is empty
    React.useEffect(() => {
        if (!batchName) setBatchName(defaultNextBatchName);
    }, [defaultNextBatchName]);

    // Filter only returned records (records with resultReturnedDate or status RETURNED)
    const returnedRecords = useMemo(() => {
        return records.filter(r => Boolean(r.resultReturnedDate || r.status === RecordStatus.RETURNED));
    }, [records]);

    // Filter by search keyword, ward, and date
    const filteredRecords = useMemo(() => {
        return returnedRecords.filter(r => {
            // Search term
            if (searchTerm.trim()) {
                const term = removeVietnameseTones(searchTerm.toLowerCase().trim());
                const code = removeVietnameseTones(r.code || '').toLowerCase();
                const name = removeVietnameseTones(r.customerName || '').toLowerCase();
                const receiver = removeVietnameseTones(r.receiverName || '').toLowerCase();
                const phone = (r.phoneNumber || '').toLowerCase();
                const plot = (r.landPlot || '').toLowerCase();
                const sheet = (r.mapSheet || '').toLowerCase();
                const ward = removeVietnameseTones(r.ward || '').toLowerCase();
                const type = removeVietnameseTones(r.recordType || '').toLowerCase();
                const batch = removeVietnameseTones(r.archiveBatchName || String(r.archiveHandoverBatch || '')).toLowerCase();

                const matchesSearch = code.includes(term) ||
                    name.includes(term) ||
                    receiver.includes(term) ||
                    phone.includes(term) ||
                    plot === term ||
                    sheet === term ||
                    ward.includes(term) ||
                    type.includes(term) ||
                    batch.includes(term);

                if (!matchesSearch) return false;
            }

            // Ward filter
            if (selectedWard !== 'all' && r.ward !== selectedWard) {
                return false;
            }

            // Date filter (based on resultReturnedDate or archiveBatchDate)
            const recDateStr = r.resultReturnedDate || r.archiveBatchDate || r.updatedAt;
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
    }, [returnedRecords, searchTerm, selectedWard, datePreset, fromDate, toDate]);

    const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRecords.slice(start, start + pageSize);
    }, [filteredRecords, currentPage, pageSize]);

    // Select All / Deselect All
    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0) {
            setSelectedIds(new Set());
        } else {
            const next = new Set<string>();
            paginatedRecords.forEach(r => next.add(r.id));
            setSelectedIds(next);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    // Thao tác "Chốt DS lưu" (Lock batch for selected items)
    const handleLockBatch = async () => {
        if (selectedIds.size === 0) return;
        const currentBatch = batchName || defaultNextBatchName;
        if (!window.confirm(`Bạn có chắc chắn muốn Chốt danh sách lưu [${currentBatch}] cho ${selectedIds.size} hồ sơ đã chọn?`)) return;

        const targetArray = Array.from(selectedIds);
        if (onUpdateBulk) {
            await onUpdateBulk('archiveBatchName', currentBatch, exportDate, targetArray);
        }
        alert(`Đã chốt danh sách lưu [${currentBatch}] thành công cho ${selectedIds.size} hồ sơ!`);
        setSelectedIds(new Set());
    };

    // Thao tác "Xuất DS lưu"
    const handleConfirmExportArchive = async () => {
        const targetList = selectedIds.size > 0
            ? filteredRecords.filter(r => selectedIds.has(r.id))
            : filteredRecords;

        if (targetList.length === 0) {
            alert('Không có hồ sơ nào để xuất danh sách lưu!');
            return;
        }

        const activeBatch = batchName || defaultNextBatchName;

        // 1. Export Excel
        const dataToExport = targetList.map((r, idx) => ({
            'STT': idx + 1,
            'MÃ HỒ SƠ': r.code,
            'CHỦ SỬ DỤNG': r.customerName || '',
            'LOẠI HỒ SƠ': getShortRecordType(r.recordType),
            'TỜ': r.mapSheet || '',
            'THỬA': r.landPlot || '',
            'XÃ PHƯỜNG': getWardLabel(r.ward),
            'NGÀY TRẢ DÂN': formatDate(r.resultReturnedDate),
            'NGƯỜI NHẬN KQ': r.receiverName || r.customerName || '',
            'ĐỢT LƯU': r.archiveBatchName || activeBatch,
            'NGÀY LƯU': formatDate(r.archiveBatchDate || exportDate)
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'DanhSachTraKetQua');
        XLSX.writeFile(wb, `DS_Tra_Ket_Qua_Luu_Kho_${activeBatch}_${exportDate}.xlsx`);

        // 2. Update records with batch details
        if (onUpdateBulk && selectedIds.size > 0) {
            await onUpdateBulk('archiveBatchName', activeBatch, exportDate, Array.from(selectedIds));
        }

        setIsExportModalOpen(false);
    };

    const cellClass = "p-3 align-middle text-slate-700 border-b border-slate-100 transition-colors";

    return (
        <div className="flex flex-col h-full bg-slate-50/50 rounded-xl overflow-hidden animate-fade-in">
            {/* Horizontal Filter Bar & Controls matching image */}
            <div className="p-3 bg-white border-b border-slate-200 shrink-0 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {/* Search Input */}
                    <div className="relative min-w-[220px] flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Tìm kiếm mã, chủ sử dụng, người nhận, tờ, thửa..."
                            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium text-slate-800"
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

                    {/* Quick Date Preset Pills matching image */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
                        <button
                            type="button"
                            onClick={() => { setDatePreset('all'); setFromDate(''); setToDate(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${datePreset === 'all' && !fromDate && !toDate ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <Calendar size={13} /> Tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDatePreset('week'); setFromDate(''); setToDate(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${datePreset === 'week' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <CalendarRange size={13} /> Tuần này
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDatePreset('month'); setFromDate(''); setToDate(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${datePreset === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <CalendarDays size={13} /> Tháng này
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDatePreset('today'); setFromDate(''); setToDate(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${datePreset === 'today' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            <Clock size={13} /> Hôm nay
                        </button>
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
                            onChange={(e) => { setFromDate(e.target.value); setDatePreset('all'); setCurrentPage(1); }}
                            className="bg-transparent font-medium text-slate-800 outline-none w-28 cursor-pointer"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => { setToDate(e.target.value); setDatePreset('all'); setCurrentPage(1); }}
                            className="bg-transparent font-medium text-slate-800 outline-none w-28 cursor-pointer"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                        {/* "Chốt DS lưu" button ONLY appears when checkboxes are checked */}
                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                onClick={handleLockBatch}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer animate-fade-in"
                                title="Chốt danh sách lưu các hồ sơ đã chọn"
                            >
                                <Lock size={14} />
                                <span>Chốt DS lưu ({selectedIds.size})</span>
                            </button>
                        )}

                        {/* "Xuất DS lưu" button */}
                        <button
                            type="button"
                            onClick={() => setIsExportModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                            title="Xuất danh sách lưu về kho lưu trữ"
                        >
                            <FileSpreadsheet size={14} />
                            <span>Xuất DS lưu</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-3 sm:p-4 min-h-0">
                {filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full mb-3">
                            <Layers size={32} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700 mb-1">Chưa có hồ sơ trả kết quả phù hợp</h3>
                        <p className="text-xs text-slate-500 max-w-sm">
                            Danh sách hiển thị các hồ sơ đã trả kết quả thành công cho người dân để thực hiện công tác chốt đợt và lưu trữ.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[11px] sticky top-0 z-10">
                                        <th className="p-3 w-10 text-center select-none">
                                            <button type="button" onClick={toggleSelectAll} className="cursor-pointer">
                                                {selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0 ? (
                                                    <CheckSquare size={16} className="text-emerald-600" />
                                                ) : (
                                                    <Square size={16} className="text-slate-400" />
                                                )}
                                            </button>
                                        </th>
                                        <th className="p-3 w-[120px] text-center">MÃ HỒ SƠ</th>
                                        <th className="p-3 w-56 text-center">CHỦ SỬ DỤNG</th>
                                        <th className="p-3 w-40 text-center">LOẠI HỒ SƠ</th>
                                        <th className="p-3 w-16 text-center">TỜ</th>
                                        <th className="p-3 w-16 text-center">THỬA</th>
                                        <th className="p-3 w-32 text-center">XÃ PHƯỜNG</th>
                                        <th className="p-3 w-28 text-center">NGÀY TRẢ DÂN</th>
                                        <th className="p-3 w-44 text-center">NGƯỜI NHẬN KQ</th>
                                        <th className="p-3 w-36 text-center">ĐỢT LƯU</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {paginatedRecords.map((record) => {
                                        const isSelected = selectedIds.has(record.id);

                                        return (
                                            <tr key={record.id} className={`transition-colors ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                                                <td className={`${cellClass} text-center select-none`}>
                                                    <button type="button" onClick={() => toggleSelect(record.id)} className="cursor-pointer">
                                                        {isSelected ? (
                                                            <CheckSquare size={16} className="text-emerald-600" />
                                                        ) : (
                                                            <Square size={16} className="text-slate-300" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className={`${cellClass} text-center font-bold font-mono text-blue-700 cursor-pointer`} onClick={() => onViewRecord?.(record)}>
                                                    {record.code}
                                                </td>
                                                <td className={`${cellClass} text-center font-bold text-slate-800`}>
                                                    {toTitleCase(record.customerName)}
                                                </td>
                                                <td className={`${cellClass} text-center text-slate-700`}>
                                                    {getShortRecordType(record.recordType)}
                                                </td>
                                                <td className={`${cellClass} text-center font-mono font-bold text-slate-700`}>
                                                    {record.mapSheet || '-'}
                                                </td>
                                                <td className={`${cellClass} text-center font-mono font-bold text-slate-700`}>
                                                    {record.landPlot || '-'}
                                                </td>
                                                <td className={`${cellClass} text-center text-slate-700`}>
                                                    {getWardLabel(record.ward) || '-'}
                                                </td>
                                                <td className={`${cellClass} text-center font-bold font-mono text-emerald-700`}>
                                                    {formatDate(record.resultReturnedDate)}
                                                </td>
                                                <td className={`${cellClass} text-center text-slate-800 font-semibold`}>
                                                    {record.receiverName || record.customerName || '--'}
                                                </td>
                                                {/* Cột Đợt lưu hiển thị dạng badge kèm ngày giống tab chuyên môn */}
                                                <td className={`${cellClass} text-center`}>
                                                    {record.archiveBatchName ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="bg-emerald-50 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-md border border-emerald-300 text-[11px] inline-flex items-center gap-1 shadow-2xs">
                                                                <Layers size={12} className="text-emerald-600" />
                                                                {record.archiveBatchName}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                {formatDate(record.archiveBatchDate || exportDate)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px]">Chưa chốt đợt</span>
                                                    )}
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

            {/* Modal Xuất DS lưu */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[80] p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-fade-in-up border border-slate-100">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <FileSpreadsheet className="text-emerald-600" size={20} />
                                <span>Xuất danh sách lưu về kho lưu trữ</span>
                            </h3>
                            <button type="button" onClick={() => setIsExportModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Tên đợt lưu hồ sơ (Đợt Lưu):</label>
                                <input
                                    type="text"
                                    value={batchName}
                                    onChange={(e) => setBatchName(e.target.value)}
                                    placeholder="Ví dụ: Đợt 1, Đợt 2 - Tháng 8..."
                                    className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Ngày xuất danh sách lưu kho:</label>
                                <input
                                    type="date"
                                    value={exportDate}
                                    onChange={(e) => setExportDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-medium">
                                Tổng số hồ sơ xuất lưu: <strong>{selectedIds.size > 0 ? selectedIds.size : filteredRecords.length}</strong> hồ sơ.
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmExportArchive}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5"
                            >
                                <FileSpreadsheet size={15} />
                                <span>Lưu và xuất Excel</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReturnedResultListView;
