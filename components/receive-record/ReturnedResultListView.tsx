import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, CheckSquare, Square, FileSpreadsheet, Lock, Layers, MapPin, Calendar, Printer, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from 'lucide-react';
import { RecordFile, User, RecordStatus } from '../../types';
import { getShortRecordType, getWardLabel } from '../../constants';
import { removeVietnameseTones, toTitleCase, formatDateDDMMYYYY } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface ReturnedResultListViewProps {
    records: RecordFile[];
    currentUser: User;
    wards?: string[];
    onUpdateBulk?: (field: keyof RecordFile, value: any, customDate?: string, targetRecordIds?: string[]) => Promise<void>;
    onViewRecord?: (record: RecordFile) => void;
    onPreviewExcel?: (workbook: XLSX.WorkBook, fileName: string) => void;
}

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear())}`;
};

export const ReturnedResultListView: React.FC<ReturnedResultListViewProps> = ({
    records = [],
    currentUser,
    wards = [],
    onUpdateBulk,
    onViewRecord,
    onPreviewExcel
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedWard, setSelectedWard] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Ngày hiện tại
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const todayFmt = useMemo(() => formatDateDDMMYYYY(todayStr), [todayStr]);

    // Filter ALL returned records from all departments
    const returnedRecords = useMemo(() => {
        return records.filter(r => Boolean(
            r.resultReturnedDate || 
            r.status === RecordStatus.RETURNED || 
            (r.status as string) === 'RETURNED' ||
            (r.status as string) === 'Đã trả kết quả' ||
            Boolean(r.receiverName) ||
            Boolean(r.archiveBatchName) ||
            Boolean(r.archiveExportDate)
        ));
    }, [records]);

    // Distinct existing archive batches for history dropdowns
    const historyBatches = useMemo(() => {
        const batchesMap: Record<string, { label: string; date: string; count: number }> = {};
        returnedRecords.forEach(r => {
            if (r.archiveBatchName) {
                const label = r.archiveBatchName;
                const dateStr = r.archiveBatchDate ? r.archiveBatchDate.split('T')[0] : (r.exportDate ? r.exportDate.split('T')[0] : todayStr);
                
                if (!batchesMap[label]) {
                    batchesMap[label] = {
                        label,
                        date: dateStr,
                        count: 0
                    };
                }
                batchesMap[label].count++;
            }
        });

        // Sắp xếp giảm dần theo số thứ tự đợt
        return Object.values(batchesMap).sort((a, b) => {
            const getNum = (str: string) => {
                const match = str.match(/Đợt\s*(\d+)/i) || str.match(/\d+/);
                return match ? parseInt(match[0], 10) : 0;
            };
            return getNum(b.label) - getNum(a.label);
        });
    }, [returnedRecords, todayStr]);

    // Calculate default next batch info
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

    // --- State for Modal "Chốt DS Lưu" ---
    const [isLockModalOpen, setIsLockModalOpen] = useState(false);
    const [lockMode, setLockMode] = useState<'new' | 'existing'>('new');
    const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');

    // --- State for Modal "Xuất DS Lưu" ---
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [selectedExportBatch, setSelectedExportBatch] = useState<string>('all');

    // --- State for Preview & Print Modal ---
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

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

    // Filter by search keyword, ward, and date range
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

            // Date range filter
            const recDateStr = r.resultReturnedDate || r.archiveBatchDate || r.updatedAt;
            if (!recDateStr) return true;

            const rDate = new Date(recDateStr);
            if (isNaN(rDate.getTime())) return true;

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
    }, [returnedRecords, searchTerm, selectedWard, fromDate, toDate]);

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

    // Confirm "Chốt DS Lưu"
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
        if (onUpdateBulk) {
            await onUpdateBulk('archiveBatchName', finalBatchName, todayStr, targetArray);
        }

        alert(`Đã chốt danh sách lưu [${finalBatchName}] thành công cho ${selectedIds.size} hồ sơ!`);
        setSelectedIds(new Set());
        setIsLockModalOpen(false);
    };

    // Calculate Export Filtered Records
    const exportTargetRecords = useMemo(() => {
        let list = returnedRecords;

        if (selectedExportBatch !== 'all') {
            list = list.filter(r => r.archiveBatchName === selectedExportBatch);
        }

        return list;
    }, [returnedRecords, selectedExportBatch]);

    // Generate Excel Workbook matching image.png 100%
    const generateWorkbook = (): { wb: XLSX.WorkBook, fileName: string } | null => {
        if (exportTargetRecords.length === 0) {
            alert('Không có hồ sơ nào thỏa mãn điều kiện xuất!');
            return null;
        }

        let batchNameStr = selectedExportBatch === 'all' ? 'TẤT CẢ CÁC ĐỢT LƯU' : selectedExportBatch.toUpperCase();
        if (selectedExportBatch !== 'all' && !/^ĐỢT/i.test(batchNameStr)) {
            batchNameStr = `ĐỢT ${batchNameStr}`;
        }

        const firstBatchRecord = exportTargetRecords.find(r => r.archiveBatchDate || r.exportDate || r.completedDate);
        const batchRawDate = firstBatchRecord?.archiveBatchDate || firstBatchRecord?.exportDate || firstBatchRecord?.completedDate || todayStr;
        const batchDateStr = formatDate(batchRawDate);

        let subTitle = "";
        if (selectedExportBatch === 'all') {
            subTitle = `${batchNameStr}  -  TỔNG SỐ HỒ SƠ: ${exportTargetRecords.length}`;
        } else {
            subTitle = `${batchNameStr} - NGÀY ${batchDateStr} - TỔNG SỐ HỒ SƠ: ${exportTargetRecords.length}`;
        }

        const title = "DANH SÁCH BÀN GIAO HỒ SƠ LƯU TRỮ 1 CỬA";

        const tableHeader = [
            "STT", 
            "Mã Hồ Sơ", 
            "Chủ Sử Dụng", 
            "Địa Chỉ (Xã)", 
            "Thửa", 
            "Tờ", 
            "Loại Hồ Sơ", 
            "Hẹn Trả", 
            "Ghi chú"
        ];

        const dataRows = exportTargetRecords.map((r, idx) => [
            idx + 1,
            r.code || '',
            r.customerName || '',
            getWardLabel(r.ward) || '',
            r.landPlot || '',
            r.mapSheet || '',
            r.recordType || getShortRecordType(r.recordType) || '',
            formatDate(r.deadline) || '',
            r.notes || r.explanationPlan || ''
        ]);

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

        // Add Data Rows
        const dataOriginRow = headerRows.length + 1;
        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: `A${dataOriginRow}` });

        // Add Signature Footer Rows
        const lastDataRow = (dataOriginRow - 1) + dataRows.length;
        const footerStartRow = lastDataRow + 2;

        const totalCols = tableHeader.length;
        const footerRow1 = new Array(totalCols).fill("");
        footerRow1[1] = "BÊN GIAO HỒ SƠ";
        footerRow1[6] = "BÊN NHẬN HỒ SƠ";

        const footerRow2 = new Array(totalCols).fill("");
        footerRow2[1] = "(Ký và ghi rõ họ tên)";
        footerRow2[6] = "(Ký và ghi rõ họ tên)";

        XLSX.utils.sheet_add_aoa(ws, [footerRow1, footerRow2], { origin: `A${footerStartRow}` });

        // Column Widths
        ws['!cols'] = [
            { wch: 6 },  // STT
            { wch: 18 }, // Mã HS
            { wch: 25 }, // Chủ SD
            { wch: 18 }, // Địa Chỉ (Xã)
            { wch: 8 },  // Thửa
            { wch: 8 },  // Tờ
            { wch: 30 }, // Loại HS
            { wch: 14 }, // Hẹn Trả
            { wch: 25 }  // Ghi chú
        ];

        const cleanBatch = selectedExportBatch === 'all' ? 'Tat_Ca_Dot' : removeVietnameseTones(batchNameStr.replace(/\s+/g, '_'));
        const dateFormattedForFile = batchDateStr.replace(/\//g, '_');
        const safeToday = todayStr.replace(/-/g, '');
        const fileName = `Giao_1_Cua_Luu_Tru_${cleanBatch}_Ngay_${dateFormattedForFile}_${safeToday}`;

        XLSX.utils.book_append_sheet(wb, ws, 'DanhSachLuuKho');

        return { wb, fileName };
    };

    // Excel Download Handler
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
        setIsExportModalOpen(false);
        if (onPreviewExcel) {
            onPreviewExcel(wb, fileName);
        } else {
            setIsPreviewModalOpen(true);
        }
    };

    const cellClass = "p-3 align-middle text-slate-700 border-b border-slate-100 transition-colors";

    return (
        <div className="flex flex-col h-full bg-slate-50/50 rounded-xl overflow-hidden animate-fade-in">
            {/* Horizontal Filter Bar & Controls */}
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

                    {/* Date Range Selector */}
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

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
                        {/* "Chốt DS lưu" button ONLY appears when checkboxes are checked */}
                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                onClick={() => setIsLockModalOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer animate-fade-in"
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
                            <Printer size={14} />
                            <span>Xuất DS lưu</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Table Container with Sticky Header */}
            <div className="flex-1 overflow-auto p-3 sm:p-4 min-h-0">
                {filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full mb-3">
                            <Layers size={32} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700 mb-1">Chưa có hồ sơ trả kết quả phù hợp</h3>
                        <p className="text-xs text-slate-500 max-w-sm">
                            Danh sách hiển thị toàn bộ các hồ sơ đã trả kết quả thành công để thực hiện công tác chốt đợt và lưu trữ.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
                        <div className="overflow-auto max-h-[calc(100vh-220px)] min-h-[350px]">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[11px] sticky top-0 z-10 shadow-xs select-none">
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
                                        <th className="p-3 w-40 text-center">NGƯỜI NHẬN KQ</th>
                                        <th className="p-3 w-48 text-center">GHI CHÚ</th>
                                        <th className="p-3 w-32 text-center">ĐỢT LƯU</th>
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
                                                <td className={`${cellClass} text-center font-bold font-mono text-blue-700 hover:text-blue-900 cursor-pointer`} onClick={() => onViewRecord?.(record)}>
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
                                                <td className={`${cellClass} text-left text-slate-700 text-xs px-3`}>
                                                    {record.notes || (record.receiverName ? `Trả hồ sơ: Đã trả kết quả cho ${record.receiverName}` : 'Trả hồ sơ: Đã trả kết quả')}
                                                </td>
                                                {/* Cột Đợt lưu */}
                                                <td className={`${cellClass} text-center`}>
                                                    {record.archiveBatchName ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="bg-emerald-50 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-md border border-emerald-300 text-[11px] inline-flex items-center gap-1 shadow-2xs">
                                                                <Layers size={12} className="text-emerald-600" />
                                                                {record.archiveBatchName}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                                {formatDate(record.archiveBatchDate)}
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

            {/* Pagination Controls */}
            {filteredRecords.length > 0 && (
                <div className="p-3 bg-white border-t border-slate-200 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 text-slate-500 font-medium">
                        <span>
                            Hiển thị <strong>{((currentPage - 1) * pageSize) + 1}</strong> - <strong>{Math.min(currentPage * pageSize, filteredRecords.length)}</strong> trên tổng số <strong>{filteredRecords.length}</strong> hồ sơ
                        </span>
                        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                            <span>Hiển thị</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="border border-slate-300 rounded-md px-2 py-1 bg-white outline-none font-bold text-slate-700 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span>dòng / trang</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="p-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer text-slate-700 font-medium"
                            title="Trang đầu"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer text-slate-700 font-medium"
                            title="Trang trước"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="px-2 font-bold text-slate-700">
                            Trang {currentPage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer text-slate-700 font-medium"
                            title="Trang sau"
                        >
                            <ChevronRight size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-1.5 border border-slate-300 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer text-slate-700 font-medium"
                            title="Trang cuối"
                        >
                            <ChevronsRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Chốt DS Lưu (Chuẩn 100% theo ảnh image.png) */}
            {isLockModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[80] p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up border border-slate-100 flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <h3 className="font-bold text-slate-900 text-base">Chốt DS Lưu</h3>
                            <button
                                type="button"
                                onClick={() => setIsLockModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4 text-xs">
                            <p className="text-slate-600 leading-relaxed text-xs">
                                Bạn đang thực hiện chốt <strong className="font-bold text-slate-900">{selectedIds.size}</strong> hồ sơ sang trạng thái "Đã lưu".
                            </p>

                            {/* Option 1: Tạo đợt mới (Hôm nay) */}
                            <div
                                onClick={() => setLockMode('new')}
                                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                                    lockMode === 'new'
                                        ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-500/20'
                                        : 'bg-white border-slate-200 hover:border-blue-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="lockBatchMode"
                                    checked={lockMode === 'new'}
                                    onChange={() => setLockMode('new')}
                                    className="mt-0.5 w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <div className="flex-1 space-y-1">
                                    <div className="font-bold text-slate-900 text-sm">
                                        + Tạo đợt mới (Hôm nay)
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-0.5">
                                        <div>Đợt tiếp theo: <span className="font-bold text-blue-600">{nextBatchInfo.label}</span></div>
                                        <div>Ngày: {todayFmt}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Option 2: Thêm vào đợt cũ */}
                            <div
                                onClick={() => setLockMode('existing')}
                                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                                    lockMode === 'existing'
                                        ? 'bg-green-50/50 border-green-500 shadow-xs ring-1 ring-green-500/20'
                                        : 'bg-white border-slate-200 hover:border-green-300'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="lockBatchMode"
                                    checked={lockMode === 'existing'}
                                    onChange={() => setLockMode('existing')}
                                    className="mt-0.5 w-4 h-4 text-green-600 focus:ring-green-500 cursor-pointer"
                                />
                                <div className="flex-1 space-y-2">
                                    <div className="font-bold text-slate-900 text-sm">
                                        ↻ Thêm vào đợt cũ
                                    </div>
                                    <select
                                        disabled={lockMode !== 'existing'}
                                        value={selectedExistingBatch}
                                        onChange={(e) => setSelectedExistingBatch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-green-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 bg-white text-slate-800"
                                    >
                                        {historyBatches.length > 0 ? (
                                            historyBatches.map(b => (
                                                <option key={b.label} value={b.label}>
                                                    {b.label} - Ngày {formatDateDDMMYYYY(b.date)} (Đã có {b.count} HS)
                                                </option>
                                            ))
                                        ) : (
                                            <option value="">Chưa có đợt nào trong hệ thống</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setIsLockModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmLockBatch}
                                className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-xs shadow-xs transition-all cursor-pointer"
                            >
                                Xác nhận chốt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xuất DS Lưu (Chuẩn 100% theo ảnh image.png) */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[80] p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up border border-slate-100 flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                <Printer size={20} className="text-blue-600" />
                                <span>Xuất DS Lưu</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4 text-xs">
                            {/* Section 1 */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-slate-800">
                                    Chọn đợt / ngày xuất
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedExportBatch}
                                        onChange={(e) => setSelectedExportBatch(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl pl-3 pr-9 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
                                    >
                                        <option value="all">Tất cả các đợt lưu ({returnedRecords.length} HS)</option>
                                        {historyBatches.map(b => (
                                            <option key={b.label} value={b.label}>
                                                {b.label} - Ngày {formatDateDDMMYYYY(b.date)} ({b.count} HS)
                                            </option>
                                        ))}
                                    </select>
                                    <Layers size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Notice box */}
                            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-blue-900 text-xs font-medium flex items-center gap-2.5">
                                <Calendar size={18} className="text-blue-600 shrink-0" />
                                <span>Hệ thống sẽ tạo file Excel chuẩn A4 Ngang (Landscape) để in ấn.</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handlePrintPreview}
                                className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Eye size={15} />
                                <span>Xem trước & In</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadExcel}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <Download size={15} />
                                <span>Tải Excel</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Xem trước & In danh sách lưu */}
            {isPreviewModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[90] p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col border border-slate-100">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <Printer className="text-blue-600" size={20} />
                                <h3 className="font-bold text-slate-800 text-base">Xem trước danh sách lưu kho ({exportTargetRecords.length} hồ sơ)</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPreviewModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-6 bg-slate-100">
                            <div className="bg-white p-8 rounded-xl shadow-md max-w-3xl mx-auto space-y-6 text-xs font-serif text-slate-900">
                                <div className="text-center space-y-1">
                                    <div className="font-bold uppercase text-sm">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                    <div className="font-bold text-xs">Độc lập - Tự do - Hạnh phúc</div>
                                    <div className="w-32 border-b border-slate-400 mx-auto pt-1"></div>
                                </div>

                                <div className="text-center pt-2 space-y-1">
                                    <h2 className="text-base font-bold uppercase text-slate-900">DANH SÁCH BÀN GIAO HỒ SƠ LƯU TRỮ 1 CỬA</h2>
                                    <p className="text-xs font-bold text-slate-700">
                                        {selectedExportBatch === 'all' ? 'TẤT CẢ CÁC ĐỢT LƯU' : (selectedExportBatch.toUpperCase().startsWith('ĐỢT') ? selectedExportBatch.toUpperCase() : `ĐỢT ${selectedExportBatch.toUpperCase()}`)}
                                        {selectedExportBatch !== 'all' && ` - NGÀY ${formatDate(exportTargetRecords.find(r => r.archiveBatchDate || r.exportDate || r.completedDate)?.archiveBatchDate || todayStr)}`} - TỔNG SỐ HỒ SƠ: {exportTargetRecords.length}
                                    </p>
                                    <p className="text-xs italic text-slate-600">Kèm theo đầy đủ hồ sơ gốc</p>
                                </div>

                                <table className="w-full border-collapse border border-slate-300 text-[11px] font-sans">
                                    <thead>
                                        <tr className="bg-slate-100 font-bold text-slate-800 text-center">
                                            <th className="border border-slate-300 p-2 w-10">STT</th>
                                            <th className="border border-slate-300 p-2">Mã Hồ Sơ</th>
                                            <th className="border border-slate-300 p-2">Chủ Sử Dụng</th>
                                            <th className="border border-slate-300 p-2">Địa Chỉ (Xã)</th>
                                            <th className="border border-slate-300 p-2 w-12">Thửa</th>
                                            <th className="border border-slate-300 p-2 w-12">Tờ</th>
                                            <th className="border border-slate-300 p-2">Loại Hồ Sơ</th>
                                            <th className="border border-slate-300 p-2">Hẹn Trả</th>
                                            <th className="border border-slate-300 p-2">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {exportTargetRecords.map((r, idx) => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="border border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                                                <td className="border border-slate-300 p-2 text-center font-mono font-bold text-blue-700">{r.code}</td>
                                                <td className="border border-slate-300 p-2 font-bold">{r.customerName}</td>
                                                <td className="border border-slate-300 p-2 text-center">{getWardLabel(r.ward)}</td>
                                                <td className="border border-slate-300 p-2 text-center font-mono">{r.landPlot || '-'}</td>
                                                <td className="border border-slate-300 p-2 text-center font-mono">{r.mapSheet || '-'}</td>
                                                <td className="border border-slate-300 p-2 text-center">{r.recordType || getShortRecordType(r.recordType)}</td>
                                                <td className="border border-slate-300 p-2 text-center">{formatDate(r.deadline)}</td>
                                                <td className="border border-slate-300 p-2 text-center">{r.notes || r.explanationPlan || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="flex justify-between pt-6 text-center font-sans text-xs">
                                    <div className="space-y-1">
                                        <p className="font-bold uppercase">BÊN GIAO HỒ SƠ</p>
                                        <p className="italic text-slate-400 pt-12">(Ký và ghi rõ họ tên)</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-bold uppercase">BÊN NHẬN HỒ SƠ</p>
                                        <p className="italic text-slate-400 pt-12">(Ký và ghi rõ họ tên)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsPreviewModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <Printer size={15} />
                                <span>In ngay</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadExcel}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <Download size={15} />
                                <span>Tải Excel</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReturnedResultListView;
