import React, { useState, useMemo } from 'react';
import { 
    Search, 
    X,
    Eye, 
    CalendarClock, 
    CheckCircle2, 
    Pencil, 
    Clock, 
    AlertCircle, 
    Phone, 
    ChevronLeft, 
    ChevronRight, 
    Bell,
    FileSpreadsheet,
    FileCheck,
    FilePlus2
} from 'lucide-react';
import { RecordFile, Employee, User, RecordStatus, UserRole } from '../../types';
import { getShortRecordType, getWardLabel } from '../../constants';
import { removeVietnameseTones, toTitleCase, getBatchDisplayParts, isRecordOverdue, isRecordApproaching } from '../../utils/appHelpers';
import StatusBadge from '../StatusBadge';
import * as XLSX from 'xlsx-js-style';

interface RecordLookupViewProps {
    records: RecordFile[];
    employees: Employee[];
    wards: string[];
    currentUser: User;
    onViewRecord: (record: RecordFile) => void;
    onEditRecord?: (record: RecordFile) => void;
    onReturnRecord?: (record: RecordFile) => void;
    onExtendDeadline?: (record: RecordFile) => void;
    onSupplementRecord?: (record: RecordFile) => void;
}

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

export const RecordLookupView: React.FC<RecordLookupViewProps> = ({
    records = [],
    employees = [],
    wards = [],
    currentUser,
    onViewRecord,
    onEditRecord,
    onReturnRecord,
    onExtendDeadline,
    onSupplementRecord
}) => {
    // Search Term State
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination State: Mặc định 10 dòng/trang theo yêu cầu
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Determine display status (tương tự như tab chuyên môn)
    const getDisplayStatus = (r: RecordFile) => {
        if (r.status) return r.status;
        if (r.resultReturnedDate) return RecordStatus.RETURNED;
        if ((r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.REJECTED) {
            return RecordStatus.HANDOVER;
        }
        return RecordStatus.RECEIVED;
    };

    // Filter records by search keyword
    const filteredRecords = useMemo(() => {
        if (!searchTerm.trim()) return records;

        const term = removeVietnameseTones(searchTerm.toLowerCase().trim());
        return records.filter(r => {
            const code = removeVietnameseTones(r.code || '').toLowerCase();
            const name = removeVietnameseTones(r.customerName || '').toLowerCase();
            const phone = (r.phoneNumber || '').toLowerCase();
            const plot = (r.landPlot || '').toLowerCase();
            const sheet = (r.mapSheet || '').toLowerCase();
            const ward = removeVietnameseTones(r.ward || '').toLowerCase();
            const address = removeVietnameseTones(r.address || r.customerAddress || '').toLowerCase();
            const type = removeVietnameseTones(r.recordType || '').toLowerCase();
            const receipt = removeVietnameseTones(r.receiptNumber || '').toLowerCase();
            const batch = removeVietnameseTones(String(r.exportBatch || '')).toLowerCase();

            const assignedEmp = employees.find(e => e.id === r.assignedTo);
            const empName = assignedEmp ? removeVietnameseTones(assignedEmp.name || '').toLowerCase() : '';

            return (
                code.includes(term) ||
                name.includes(term) ||
                phone.includes(term) ||
                plot === term ||
                sheet === term ||
                `thua ${plot}`.includes(term) ||
                `to ${sheet}`.includes(term) ||
                ward.includes(term) ||
                address.includes(term) ||
                type.includes(term) ||
                receipt.includes(term) ||
                batch.includes(term) ||
                empName.includes(term)
            );
        });
    }, [records, searchTerm, employees]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRecords.slice(start, start + pageSize);
    }, [filteredRecords, currentPage, pageSize]);

    // Export to Excel helper
    const handleExportExcel = () => {
        if (filteredRecords.length === 0) return;

        const headers = [
            'STT',
            'MÃ HỒ SƠ',
            'THÔNG TIN CHỦ SỬ DỤNG',
            'SỐ ĐIỆN THOẠI',
            'LOẠI HỒ SƠ',
            'NGÀY NHẬN',
            'HẠN TRẢ',
            'XÃ PHƯỜNG',
            'TỜ',
            'THỬA',
            'GIAO NHÂN VIÊN',
            'HOÀN THÀNH / ĐỢT',
            'TRẠNG THÁI'
        ];

        const dataRows = filteredRecords.map((r, idx) => {
            const emp = employees.find(e => e.id === r.assignedTo);
            const displayStatus = getDisplayStatus(r);
            return [
                idx + 1,
                r.code || '',
                r.customerName || '',
                r.phoneNumber || '',
                getShortRecordType(r.recordType) || '',
                formatDate(r.receivedDate),
                formatDate(r.deadline),
                getWardLabel(r.ward),
                r.mapSheet || '',
                r.landPlot || '',
                emp?.name || '',
                r.exportBatch || formatDate(r.completedDate) || '',
                displayStatus
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([
            ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
            ['Độc lập - Tự do - Hạnh phúc'],
            [''],
            ['KẾT QUẢ TRA CỨU HỒ SƠ'],
            [`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} | Tổng số hồ sơ: ${filteredRecords.length}`],
            [''],
            headers,
            ...dataRows
        ]);

        const totalCols = headers.length - 1;
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
            { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } }
        ];

        if(ws['A1']) ws['A1'].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
        if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
        if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
        if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };

        const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        const headerStyle = {
            font: { name: "Times New Roman", sz: 11, bold: true },
            fill: { fgColor: { rgb: "E0E0E0" } },
            border: borderStyle,
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
        };
        const cellStyle = {
            font: { name: "Times New Roman", sz: 11 },
            border: borderStyle,
            alignment: { vertical: "center", wrapText: true }
        };
        const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

        const headerRowIdx = 6;
        const dataStartIdx = 7;

        for (let c = 0; c <= totalCols; c++) {
            const headerRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
            if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
            ws[headerRef].s = headerStyle;

            for (let r = dataStartIdx; r < dataStartIdx + dataRows.length; r++) {
                const cellRef = XLSX.utils.encode_cell({ r, c });
                if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };

                // Căn giữa: STT(0), Mã HS(1), SĐT(3), Ngày nhận(5), Hạn trả(6), Tờ(8), Thửa(9), Đợt/HT(11), Trạng thái(12)
                if ([0, 1, 3, 5, 6, 8, 9, 11, 12].includes(c)) ws[cellRef].s = centerStyle;
                else ws[cellRef].s = cellStyle;
            }
        }

        ws['!cols'] = [
            { wch: 5 },  // STT
            { wch: 16 }, // Mã HS
            { wch: 25 }, // Chủ SD
            { wch: 14 }, // SĐT
            { wch: 16 }, // Loại HS
            { wch: 12 }, // Ngày nhận
            { wch: 12 }, // Hạn trả
            { wch: 16 }, // Xã phường
            { wch: 7 },  // Tờ
            { wch: 7 },  // Thửa
            { wch: 20 }, // NV
            { wch: 15 }, // Đợt/HT
            { wch: 18 }  // Trạng thái
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'TraCuuHoSo');
        XLSX.writeFile(wb, `Tra_Cuu_Ho_So_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const cellClass = "p-3 md:p-3.5 align-middle text-slate-700 border-b border-slate-100/80 transition-colors duration-200";

    return (
        <div className="flex flex-col h-full bg-slate-50/50 rounded-xl overflow-hidden animate-fade-in">
            {/* 1. Single Clean Search Input Bar */}
            <div className="p-3.5 bg-white border-b border-slate-200 shrink-0">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Nhập Mã hồ sơ, Tên chủ sử dụng, CCCD, SĐT, Số tờ, Số thửa, Địa chỉ để tra cứu nhanh..."
                            className="w-full pl-10 pr-24 py-2 text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium text-slate-800"
                            autoFocus
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                                title="Xóa từ khóa"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <span className="text-xs font-semibold text-slate-500 whitespace-nowrap bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                            Tìm thấy <strong className="text-blue-600 font-bold">{filteredRecords.length}</strong> hồ sơ
                        </span>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={filteredRecords.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-300 hover:border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-40 cursor-pointer whitespace-nowrap"
                            title="Xuất kết quả tìm kiếm ra Excel"
                        >
                            <FileSpreadsheet size={15} className="text-emerald-600" />
                            <span>Xuất Excel</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Main Records Table (Cấu hình chuẩn đồng bộ với tab chuyên môn) */}
            <div className="flex-1 overflow-auto p-3 sm:p-4 min-h-0">
                {filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-3">
                            <Search size={32} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700 mb-1">Không tìm thấy hồ sơ phù hợp</h3>
                        <p className="text-xs text-slate-500 max-w-sm">
                            Vui lòng kiểm tra lại từ khóa tìm kiếm (Mã hồ sơ, Tên chủ sử dụng, SĐT, Số tờ, Số thửa,...).
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full">
                        <div className="overflow-auto max-h-[calc(100vh-220px)] min-h-[350px]">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[11px] select-none sticky top-0 z-10 shadow-xs">
                                        <th className="p-3 w-12 text-center">STT</th>
                                        <th className="p-3 w-[110px] text-center">MÃ HỒ SƠ</th>
                                        <th className="p-3 w-64 text-center">THÔNG TIN CHỦ SỬ DỤNG</th>
                                        <th className="p-3 w-[115px] text-center">LOẠI HỒ SƠ</th>
                                        <th className="p-3 w-48 text-center">THỜI HẠN XỬ LÝ</th>
                                        <th className="p-3 w-32 text-center">XÃ PHƯỜNG</th>
                                        <th className="p-3 w-16 text-center">TỜ</th>
                                        <th className="p-3 w-16 text-center">THỬA</th>
                                        <th className="p-3 w-48 text-center">GIAO NHÂN VIÊN</th>
                                        <th className="p-3 w-32 text-center">HOÀN THÀNH ĐỢT</th>
                                        <th className="p-3 w-32 text-center">TRẠNG THÁI</th>
                                        <th className="p-3 w-28 text-center sticky top-0 right-0 bg-slate-50 z-30 border-b border-l border-slate-200 shadow-xs">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {paginatedRecords.map((record, index) => {
                                        const globalIndex = (currentPage - 1) * pageSize + index + 1;
                                        const assignedEmp = employees.find(e => e.id === record.assignedTo);
                                        const overdue = isRecordOverdue(record);
                                        const approaching = isRecordApproaching(record);
                                        const displayStatus = getDisplayStatus(record);
                                        const isReturned = displayStatus === RecordStatus.RETURNED;
                                        const hasActiveReminder = record.reminderDate && 
                                                                  record.status !== RecordStatus.HANDOVER && 
                                                                  record.status !== RecordStatus.WITHDRAWN;
                                        const batchParts = record.exportBatch ? getBatchDisplayParts(record.exportBatch, record.exportDate || record.completedDate) : null;
                                        const isHandedOver = Boolean(record.exportBatch || record.exportDate || record.status === RecordStatus.HANDOVER || record.status === RecordStatus.RETURNED);
                                        const isPhiDiaGioi = Boolean(record.handoverWard && record.handoverWard !== record.ward);

                                        return (
                                            <tr 
                                                key={record.id}
                                                className={`transition-all duration-200 group border-l-4 ${
                                                    overdue 
                                                        ? 'bg-red-50/50 border-l-red-500 hover:bg-red-50' 
                                                        : approaching 
                                                        ? 'bg-orange-50/50 border-l-orange-500 hover:bg-orange-50' 
                                                        : 'border-l-transparent hover:bg-slate-50/80'
                                                }`}
                                                onDoubleClick={() => onViewRecord(record)}
                                            >
                                                {/* STT */}
                                                <td className={`${cellClass} text-center text-slate-500 font-mono`}>
                                                    {globalIndex}
                                                </td>

                                                {/* 1. MÃ HỒ SƠ */}
                                                <td className={`${cellClass} font-medium text-blue-600 cursor-pointer`} onClick={() => onViewRecord(record)}>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="break-words font-bold leading-normal text-sm font-mono text-blue-700 hover:text-blue-900" title={record.code}>
                                                            {record.code}
                                                        </span>
                                                        {hasActiveReminder && (
                                                            <div className="flex items-center gap-1 text-[10px] text-pink-600 font-bold bg-pink-100 px-1.5 py-0.5 rounded">
                                                                <Bell size={10} className="fill-pink-600" /> Nhắc hẹn
                                                            </div>
                                                        )}
                                                        {overdue && (
                                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded border border-red-200 font-bold text-center w-full">
                                                                Quá hạn
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 2. THÔNG TIN CHỦ SỬ DỤNG */}
                                                <td className={cellClass}>
                                                    <div className="flex flex-col gap-1 items-center text-center">
                                                        <div className="break-words leading-normal text-sm font-semibold text-gray-900" title={record.customerName}>
                                                            {toTitleCase(record.customerName)}
                                                        </div>
                                                        {record.phoneNumber && (
                                                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                                                <Phone size={12} className="shrink-0" />
                                                                <span className="font-mono">{record.phoneNumber}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 3. LOẠI HỒ SƠ */}
                                                <td className={`${cellClass} text-center text-gray-700`}>
                                                    <div className="break-words leading-normal text-sm" title={record.recordType || ''}> 
                                                        {getShortRecordType(record.recordType)}
                                                    </div>
                                                </td>

                                                {/* 4. THỜI HẠN XỬ LÝ */}
                                                <td className={cellClass}>
                                                    <div className="flex flex-col w-full bg-white/50 rounded border border-gray-100 overflow-hidden shadow-xs">
                                                        <div className="flex items-center justify-between px-2 py-1 bg-gray-50/80 border-b border-gray-100" title="Ngày tiếp nhận">
                                                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tight mr-2">Nhận</span>
                                                            <span className="text-xs font-semibold text-slate-600 font-mono whitespace-nowrap">{formatDate(record.receivedDate)}</span>
                                                        </div>
                                                        
                                                        <div className={`flex items-center justify-between px-2 py-1 ${overdue ? 'bg-red-50' : approaching ? 'bg-orange-50' : 'bg-white'}`} title="Hẹn trả kết quả">
                                                            <span className={`text-[10px] font-extrabold uppercase tracking-tight mr-2 ${overdue ? 'text-red-500' : approaching ? 'text-orange-500' : 'text-blue-500'}`}>Trả</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className={`text-xs font-bold font-mono whitespace-nowrap ${overdue ? 'text-red-600' : approaching ? 'text-orange-600' : 'text-blue-700'}`}>
                                                                    {formatDate(record.deadline)}
                                                                </span>
                                                                {overdue && <AlertCircle size={12} className="text-red-500 animate-pulse shrink-0" />}
                                                                {approaching && <Clock size={12} className="text-orange-500 shrink-0" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 5. XÃ PHƯỜNG */}
                                                <td className={`${cellClass} text-center text-gray-700`}>
                                                    <div className="break-words leading-normal text-sm" title={getWardLabel(record.ward)}> 
                                                        {getWardLabel(record.ward) || '--'}
                                                        {isHandedOver && isPhiDiaGioi && (
                                                            <div className="text-[11px] text-purple-600 mt-0.5 font-semibold" title="Nơi giao trả kết quả một cửa (Phi địa giới)">
                                                                (Giao: {getWardLabel(record.handoverWard)})
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 6. TỜ */}
                                                <td className={`${cellClass} text-center font-mono text-sm font-bold text-slate-700`}>
                                                    {record.mapSheet || '-'}
                                                </td>

                                                {/* 7. THỬA */}
                                                <td className={`${cellClass} text-center font-mono text-sm font-bold text-slate-700`}>
                                                    {record.landPlot || '-'}
                                                </td>

                                                {/* 8. GIAO NHÂN VIÊN */}
                                                <td className={`${cellClass} text-center`}>
                                                    {assignedEmp ? (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            {record.assignedDate && (
                                                                <span className="text-[11px] text-gray-500">{formatDate(record.assignedDate)}</span>
                                                            )}
                                                            <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded break-words max-w-full leading-tight" title={assignedEmp.name}>
                                                                {assignedEmp.name}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        record.assignedDate ? (
                                                            <span className="text-xs text-gray-600">{formatDate(record.assignedDate)}</span>
                                                        ) : '--'
                                                    )}
                                                </td>

                                                {/* 9. HOÀN THÀNH ĐỢT */}
                                                <td className={`${cellClass} text-center text-gray-600`}>
                                                    {record.exportBatch && batchParts ? (
                                                        <span className={`inline-flex flex-col items-center justify-center px-2 py-0.5 rounded border leading-tight ${
                                                            record.status === RecordStatus.WITHDRAWN ? 'bg-slate-100 text-slate-700 border-slate-300' : record.status === RecordStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                                                        }`}>
                                                            <span className="text-[11px] font-extrabold whitespace-nowrap">{batchParts.batchName}</span>
                                                            {batchParts.dateName && (
                                                                <span className="text-[10px] font-medium opacity-90 whitespace-nowrap">{batchParts.dateName}</span>
                                                            )}
                                                        </span>
                                                    ) : record.status === RecordStatus.WITHDRAWN ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[11px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded mb-0.5">Rút HS</span>
                                                            <span className="text-xs font-bold text-slate-600">{formatDate(record.completedDate)}</span>
                                                        </div>
                                                    ) : record.status === RecordStatus.REJECTED ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[11px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded mb-0.5">Trả hồ sơ</span>
                                                            <span className="text-xs font-bold text-red-700">{formatDate(record.completedDate)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-bold text-green-700">{formatDate(record.completedDate) || '--'}</span>
                                                    )}
                                                </td>

                                                {/* 10. TRẠNG THÁI */}
                                                <td className={`${cellClass} text-center`}>
                                                    <div className="pt-1 flex flex-col items-center">
                                                        <StatusBadge status={displayStatus} />
                                                    </div>
                                                </td>

                                                {/* 11. THAO TÁC (2 hàng icon đồng nhất với tab chuyên môn, không có nút xóa) */}
                                                <td className={`${cellClass} sticky right-0 shadow-l text-center bg-white group-hover:bg-blue-50/60 z-10`}>
                                                    <div className="flex flex-col items-center justify-center gap-1 py-0.5">
                                                        {/* Hàng 1: Xem chi tiết & Trả kết quả / Bổ sung hồ sơ */}
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); onViewRecord(record); }} 
                                                                className="p-1 text-slate-600 hover:text-green-700 hover:bg-green-100/80 rounded transition-colors border border-slate-200/80 bg-white cursor-pointer" 
                                                                title="Xem chi tiết"
                                                            >
                                                                <Eye size={15} />
                                                            </button>

                                                            {/* Nút Bổ sung hồ sơ khi trạng thái là Chờ bổ sung (PENDING_SUPPLEMENT) */}
                                                            {displayStatus === RecordStatus.PENDING_SUPPLEMENT && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => { 
                                                                        e.stopPropagation(); 
                                                                        if (onSupplementRecord) {
                                                                            onSupplementRecord(record);
                                                                        } else if (onEditRecord) {
                                                                            onEditRecord(record);
                                                                        } else {
                                                                            onViewRecord(record);
                                                                        }
                                                                    }} 
                                                                    className="p-1 text-orange-700 hover:bg-orange-100 rounded transition-colors border border-orange-200 bg-orange-50 cursor-pointer" 
                                                                    title="Tiếp nhận bổ sung hồ sơ"
                                                                >
                                                                    <FilePlus2 size={15} />
                                                                </button>
                                                            )}

                                                            {onReturnRecord && displayStatus === RecordStatus.HANDOVER && !record.resultReturnedDate && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); onReturnRecord(record); }} 
                                                                    className="p-1 text-emerald-700 hover:bg-emerald-100 rounded transition-colors border border-emerald-200 bg-emerald-50 cursor-pointer" 
                                                                    title="Trả kết quả"
                                                                >
                                                                    <FileCheck size={15} />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Hàng 2: Sửa hồ sơ & Gia hạn hẹn trả */}
                                                        <div className="flex items-center justify-center gap-1">
                                                            {onEditRecord && currentUser?.role !== UserRole.ONEDOOR && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); onEditRecord(record); }} 
                                                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors border border-blue-200 bg-blue-50/50 cursor-pointer" 
                                                                    title="Sửa"
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>
                                                            )}

                                                            {onExtendDeadline && !record.resultReturnedDate && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); onExtendDeadline(record); }} 
                                                                    className="p-1 text-amber-700 hover:bg-amber-100 bg-amber-50 rounded transition-colors border border-amber-200 cursor-pointer" 
                                                                    title="Gia hạn"
                                                                >
                                                                    <CalendarClock size={15} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar đồng nhất tab chuyên môn */}
                        <div className="border-t border-gray-200 p-3 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 text-xs text-gray-600">
                            <div className="flex items-center gap-4">
                                <span>
                                    Tổng số: <strong>{filteredRecords.length}</strong> bản ghi
                                </span>
                                <div className="flex items-center gap-2">
                                    <span>Hiển thị</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="border border-gray-300 rounded px-2 py-1 bg-white outline-none font-medium text-slate-700"
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <span>dòng / trang</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors cursor-pointer"
                                    title="Trang trước"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="font-medium text-slate-700">
                                    Trang {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors cursor-pointer"
                                    title="Trang kế tiếp"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecordLookupView;
