import React, { useState, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { getShortRecordType } from '../../constants';
import { removeVietnameseTones, isProcedure2_3 } from '../../utils/appHelpers';
import { FileSpreadsheet, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface RevenueStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    wards?: string[];
    selectedWard?: string;
    fromDate?: string;
    toDate?: string;
    onFilteredRecordsChange?: (records: RecordFile[]) => void;
}

const RevenueStatsView: React.FC<RevenueStatsViewProps> = ({ 
    records, 
    employees, 
    wards,
    selectedWard = 'all',
    fromDate, 
    toDate,
    onFilteredRecordsChange
}) => {
    // Card filter selection: 'all' | 'bien_lai' | 'hoa_don'
    const [activeCardFilter, setActiveCardFilter] = useState<'all' | 'bien_lai' | 'hoa_don'>('all');
    
    // Additional filters
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [mobileVisibleCount, setMobileVisibleCount] = useState<number>(20);
    const pageSize = 15;

    // Helper to identify record receipt type
    const getRecordReceiptType = (r: RecordFile): 'Biên Lai' | 'Hóa Đơn' => {
        if (r.receiptType === 'Biên Lai') return 'Biên Lai';
        if (r.receiptType === 'Hóa Đơn') return 'Hóa Đơn';
        if (r.receiptNumber && r.receiptNumber.toLowerCase().includes('bl')) return 'Biên Lai';
        return 'Hóa Đơn';
    };

    // Calculate revenue records filtered strictly by resultReturnedDate / exportDate
    const revenueRecords = useMemo(() => {
        let dateStart: Date | null = null;
        let dateEnd: Date | null = null;
        if (fromDate) {
            dateStart = new Date(fromDate);
            dateStart.setHours(0, 0, 0, 0);
        }
        if (toDate) {
            dateEnd = new Date(toDate);
            dateEnd.setHours(23, 59, 59, 999);
        }

        return records
            .filter(r => {
                if (r.status === RecordStatus.RETURNED) return true;
                if (r.status === RecordStatus.HANDOVER) {
                    const hasReturnDate = !!(r.resultReturnedDate || r.exportDate || r.completedDate);
                    const hasReceipt = !!(r.receiptNumber && r.receiptNumber.trim() !== '');
                    const hasReturnedPrice = r.returnedPrice !== undefined && r.returnedPrice !== null && String(r.returnedPrice).trim() !== '' && Number(r.returnedPrice) > 0;
                    return hasReturnDate || hasReceipt || hasReturnedPrice;
                }
                return false;
            })
            .map(r => {
                const contractP = (r as any).contractPrice;
                const price = Number(r.price) || Number(contractP) || 0;
                let returned = 0;
                if (isProcedure2_3(r.recordType)) {
                    returned = 0;
                } else if (r.returnedPrice !== undefined && r.returnedPrice !== null && String(r.returnedPrice).trim() !== '' && !isNaN(Number(r.returnedPrice))) {
                    returned = Number(r.returnedPrice);
                } else if (r.recordType === 'Cung cấp tài liệu đất đai') {
                    returned = 310000;
                } else if (contractP !== undefined && contractP !== null && !isNaN(Number(contractP)) && Number(contractP) > 0) {
                    returned = Number(contractP);
                } else if (r.price !== undefined && r.price !== null && !isNaN(Number(r.price)) && Number(r.price) > 0) {
                    returned = Number(r.price);
                } else if (r.status === RecordStatus.RETURNED || r.status === RecordStatus.HANDOVER) {
                    returned = price;
                }
                
                const receiptType = getRecordReceiptType(r);

                // Determine assigned ward for resolving the record
                let assignedWard = r.ward || r.handoverWard || '';
                if (!assignedWard) {
                    const assignedEmpId = r.assignedTo || r.receivedBy;
                    if (assignedEmpId) {
                        const emp = employees.find(e => e.id === assignedEmpId || e.name === assignedEmpId);
                        if (emp?.managedWards && emp.managedWards.length > 0) {
                            assignedWard = emp.managedWards[0];
                        }
                    }
                }
                if (!assignedWard && r.receiverName) {
                    const emp = employees.find(e => e.name === r.receiverName);
                    if (emp?.managedWards && emp.managedWards.length > 0) {
                        assignedWard = emp.managedWards[0];
                    }
                }
                if (!assignedWard) {
                    assignedWard = 'Chưa phân công';
                }

                return {
                    ...r,
                    calcPrice: price,
                    calcReturned: returned,
                    computedReceiptType: receiptType,
                    assignedWard
                };
            })
            // Only include records with revenue or receipt/invoice recorded
            .filter(r => r.calcReturned > 0 || (r.receiptNumber && r.receiptNumber.trim() !== ''))
            // Filter strictly by resultReturnedDate or exportDate or completedDate
            .filter(r => {
                if (!dateStart || !dateEnd) return true;
                const targetDateStr = r.resultReturnedDate || r.exportDate || r.completedDate;
                if (!targetDateStr) return false;
                let d: Date | null = null;
                if (targetDateStr.includes('/')) {
                    const parts = targetDateStr.split('/');
                    if (parts.length === 3) {
                        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
                    }
                } else {
                    d = new Date(targetDateStr);
                }
                if (!d || isNaN(d.getTime())) return false;
                d.setHours(12, 0, 0, 0);
                return d >= dateStart && d <= dateEnd;
            });
    }, [records, employees, fromDate, toDate]);

    // Ward-filtered revenue records using top filter bar selection
    const wardFilteredRevenueRecords = useMemo(() => {
        if (!selectedWard || selectedWard === 'all') return revenueRecords;
        const sWard = removeVietnameseTones(selectedWard);
        return revenueRecords.filter(r => {
            const w1 = removeVietnameseTones(r.assignedWard || '');
            const w2 = removeVietnameseTones(r.ward || '');
            const w3 = removeVietnameseTones(r.handoverWard || '');
            return w1.includes(sWard) || w2.includes(sWard) || w3.includes(sWard);
        });
    }, [revenueRecords, selectedWard]);

    // KPI Summary for 3 Top Controls
    const cardMetrics = useMemo(() => {
        let totalSum = 0;
        let totalCount = 0;
        let bienLaiSum = 0;
        let bienLaiCount = 0;
        let hoaDonSum = 0;
        let hoaDonCount = 0;

        wardFilteredRevenueRecords.forEach(r => {
            totalSum += r.calcReturned;
            totalCount++;

            if (r.computedReceiptType === 'Biên Lai') {
                bienLaiSum += r.calcReturned;
                bienLaiCount++;
            } else {
                hoaDonSum += r.calcReturned;
                hoaDonCount++;
            }
        });

        return {
            totalSum,
            totalCount,
            bienLaiSum,
            bienLaiCount,
            hoaDonSum,
            hoaDonCount
        };
    }, [wardFilteredRevenueRecords]);

    // Filtered records for table & search
    const filteredRecords = useMemo(() => {
        return wardFilteredRevenueRecords.filter(r => {
            // Card filter
            if (activeCardFilter === 'bien_lai' && r.computedReceiptType !== 'Biên Lai') return false;
            if (activeCardFilter === 'hoa_don' && r.computedReceiptType !== 'Hóa Đơn') return false;

            // Search term
            if (searchTerm.trim()) {
                const term = removeVietnameseTones(searchTerm.toLowerCase());
                const matchCode = removeVietnameseTones(r.code || '').toLowerCase().includes(term);
                const matchName = removeVietnameseTones(r.customerName || '').toLowerCase().includes(term);
                const matchReceipt = removeVietnameseTones(r.receiptNumber || '').toLowerCase().includes(term);
                const matchWard = removeVietnameseTones(r.assignedWard || '').toLowerCase().includes(term);
                if (!matchCode && !matchName && !matchReceipt && !matchWard) return false;
            }

            return true;
        });
    }, [wardFilteredRevenueRecords, activeCardFilter, searchTerm]);

    // Total & sub-totals collected for filtered set
    const filteredStats = useMemo(() => {
        let totalAmount = 0;
        let totalCount = filteredRecords.length;
        let bienLaiAmount = 0;
        let bienLaiCount = 0;
        let hoaDonAmount = 0;
        let hoaDonCount = 0;

        filteredRecords.forEach(r => {
            totalAmount += r.calcReturned;
            if (r.computedReceiptType === 'Hóa Đơn') {
                hoaDonAmount += r.calcReturned;
                hoaDonCount++;
            } else {
                bienLaiAmount += r.calcReturned;
                bienLaiCount++;
            }
        });

        return {
            totalAmount,
            totalCount,
            bienLaiAmount,
            bienLaiCount,
            hoaDonAmount,
            hoaDonCount
        };
    }, [filteredRecords]);

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRecords.slice(start, start + pageSize);
    }, [filteredRecords, currentPage, pageSize]);

    // Reset page when filters change
    const handleCardFilterChange = (type: 'all' | 'bien_lai' | 'hoa_don') => {
        setActiveCardFilter(type);
        setCurrentPage(1);
        setMobileVisibleCount(20);
    };

    // Excel export
    const handleExportExcel = () => {
        const rows = filteredRecords.map((r, index) => ({
            STT: index + 1,
            'Mã hồ sơ': r.code || '',
            'Thông tin chủ sử dụng': r.customerName || '',
            'Loại hồ sơ': getShortRecordType(r.recordType) || '',
            'Ngày thu tiền': r.resultReturnedDate ? new Date(r.resultReturnedDate).toLocaleDateString('vi-VN') : '—',
            'Loại chứng từ': r.computedReceiptType,
            'Số BL/HĐ': r.receiptNumber || '—',
            'Số tiền thu (Đ)': r.calcReturned,
            'Xã phân công giải quyết': r.assignedWard
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCaoDoanhThu");

        const fileName = `Bao_Cao_Doanh_Thu_${fromDate || 'TatCa'}_${toDate || 'HienTai'}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="flex flex-col h-full bg-white p-4 md:p-6 animate-fade-in-up overflow-y-auto">
            
            {/* MAIN DETAIL REVENUE TABLE CARD */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm flex flex-col flex-1 min-h-[450px]">
                
                {/* Embedded filters toolbar matching DailyStatsView */}
                <div className="px-6 py-3.5 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
                    
                    {/* Segmented Pills for Revenue Category */}
                    <div className="flex-1 min-w-[320px]">
                        <div className="inline-flex items-center bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-semibold w-full sm:w-auto h-[38px]">
                            <button
                                type="button"
                                onClick={() => handleCardFilterChange('all')}
                                className={`px-3 py-1 rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer h-full ${
                                    activeCardFilter === 'all'
                                        ? 'bg-white text-teal-700 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>Tất cả:</span>
                                <span className="font-bold text-teal-600 font-mono">{cardMetrics.totalSum.toLocaleString('vi-VN')} đ</span>
                                <span className="text-[10px] text-slate-500 font-normal">({cardMetrics.totalCount})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleCardFilterChange('bien_lai')}
                                className={`px-3 py-1 rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer h-full ${
                                    activeCardFilter === 'bien_lai'
                                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>Biên lai:</span>
                                <span className="font-bold text-blue-600 font-mono">{cardMetrics.bienLaiSum.toLocaleString('vi-VN')} đ</span>
                                <span className="text-[10px] text-slate-500 font-normal">({cardMetrics.bienLaiCount})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleCardFilterChange('hoa_don')}
                                className={`px-3 py-1 rounded-lg transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer h-full ${
                                    activeCardFilter === 'hoa_don'
                                        ? 'bg-white text-orange-700 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>Hóa đơn:</span>
                                <span className="font-bold text-orange-600 font-mono">{cardMetrics.hoaDonSum.toLocaleString('vi-VN')} đ</span>
                                <span className="text-[10px] text-slate-500 font-normal">({cardMetrics.hoaDonCount})</span>
                            </button>
                        </div>
                    </div>

                    {/* Search Input & Export Button */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Tìm hồ sơ, BL..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500 bg-white h-[38px] font-medium"
                            />
                        </div>

                        {/* Single shared Excel button is on top toolbar */}
                    </div>
                </div>

                {/* Desktop Table Section with sticky header */}
                <div className="hidden md:block overflow-auto flex-1 min-h-[300px] max-h-[600px] relative">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100/95 backdrop-blur-sm text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
                            <tr>
                                <th className="p-3.5 w-12 text-center">STT</th>
                                <th className="p-3.5 w-32">MÃ HỒ SƠ</th>
                                <th className="p-3.5 min-w-[180px]">THÔNG TIN CHỦ SỬ DỤNG</th>
                                <th className="p-3.5 w-36">LOẠI HỒ SƠ</th>
                                <th className="p-3.5 w-32 text-center">NGÀY THU TIỀN</th>
                                <th className="p-3.5 w-32 text-center">LOẠI CHỨNG TỪ</th>
                                <th className="p-3.5 w-32 text-center">SỐ BIÊN LAI/HĐ</th>
                                <th className="p-3.5 w-36 text-right">SỐ TIỀN THU</th>
                                <th className="p-3.5 w-44">XÃ PHÂN CÔNG GIẢI QUYẾT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedRecords.length > 0 ? (
                                paginatedRecords.map((r, idx) => {
                                    const itemNumber = (currentPage - 1) * pageSize + idx + 1;
                                    const isHoaDon = r.computedReceiptType === 'Hóa Đơn';

                                    return (
                                        <tr key={r.id || idx} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-3.5 text-center text-slate-400 font-medium">{itemNumber}</td>
                                            <td className="p-3.5 font-bold text-teal-600 hover:underline cursor-pointer">
                                                {r.code}
                                            </td>
                                            <td className="p-3.5 font-bold text-slate-800">
                                                {r.customerName || '---'}
                                            </td>
                                            <td className="p-3.5 text-slate-600 font-medium">
                                                {getShortRecordType(r.recordType)}
                                            </td>
                                            <td className="p-3.5 text-center text-slate-500 font-medium">
                                                {(() => {
                                                    const dStr = r.resultReturnedDate || r.exportDate || r.completedDate;
                                                    if (!dStr) return '-';
                                                    if (dStr.includes('/')) return dStr;
                                                    const cleanStr = dStr.split('T')[0];
                                                    const parts = cleanStr.split('-');
                                                    if (parts.length === 3) {
                                                        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                                                    }
                                                    return dStr;
                                                })()}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                {isHoaDon ? (
                                                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-orange-50 text-orange-600 border border-orange-200/60 inline-block tracking-wider">
                                                        HÓA ĐƠN
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-blue-50 text-blue-600 border border-blue-200/60 inline-block tracking-wider">
                                                        BIÊN LAI
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                                                {r.receiptNumber || '---'}
                                            </td>
                                            <td className="p-3.5 text-right font-mono font-bold text-emerald-600 text-sm">
                                                {r.calcReturned.toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="p-3.5 text-slate-700 font-medium">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                                    {r.assignedWard}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-400 italic">
                                        Không tìm thấy dữ liệu nguồn thu phù hợp.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View for RevenueStatsView (20 items + Xem thêm) */}
                <div className="block md:hidden flex-1 overflow-y-auto space-y-2.5 p-2">
                    {filteredRecords.length > 0 ? (
                        <>
                            {filteredRecords.slice(0, mobileVisibleCount).map((r, idx) => {
                                const itemNumber = idx + 1;
                                const isHoaDon = r.computedReceiptType === 'Hóa Đơn';
                                const dateStr = (() => {
                                    const dStr = r.resultReturnedDate || r.exportDate || r.completedDate;
                                    if (!dStr) return '-';
                                    if (dStr.includes('/')) return dStr;
                                    const cleanStr = dStr.split('T')[0];
                                    const parts = cleanStr.split('-');
                                    if (parts.length === 3) {
                                        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                                    }
                                    return dStr;
                                })();

                                return (
                                    <div key={r.id || idx} className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">#{itemNumber}</span>
                                                    <h3 className="font-bold text-slate-800 text-sm truncate">{r.customerName || '---'}</h3>
                                                </div>
                                                <div className="text-xs text-teal-600 font-bold font-mono mt-0.5">{r.code}</div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${isHoaDon ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                {isHoaDon ? 'HÓA ĐƠN' : 'BIÊN LAI'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                                            <div>
                                                <span className="text-slate-400">Số chứng từ:</span> <span className="font-mono font-bold text-slate-800">{r.receiptNumber || '---'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Ngày thu:</span> <span className="font-medium text-slate-800">{dateStr}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Số tiền:</span> <span className="font-mono font-bold text-emerald-600">{r.calcReturned.toLocaleString('vi-VN')} đ</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Địa bàn:</span> <span className="font-medium text-slate-800">{r.assignedWard}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredRecords.length > mobileVisibleCount && (
                                <div className="pt-3 pb-6 flex flex-col items-center gap-2">
                                    <button 
                                        onClick={() => setMobileVisibleCount(prev => prev + 20)}
                                        className="w-full max-w-sm py-2.5 bg-white border border-teal-200 text-teal-600 hover:bg-teal-50 rounded-xl font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        Xem thêm {filteredRecords.length - mobileVisibleCount} hồ sơ
                                    </button>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        Đang hiển thị {Math.min(mobileVisibleCount, filteredRecords.length)} / {filteredRecords.length} hồ sơ
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="p-8 text-center text-slate-400 text-sm">Không tìm thấy dữ liệu nguồn thu phù hợp.</div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="p-3.5 px-5 border-t border-slate-100 bg-slate-50/50 hidden md:flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <div>
                        Hiển thị từ <span className="font-bold text-slate-700">{filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> đến <span className="font-bold text-slate-700">{Math.min(currentPage * pageSize, filteredRecords.length)}</span> trên tổng <span className="font-bold text-slate-700">{filteredRecords.length}</span> hồ sơ đã lọc
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="font-semibold text-slate-700 px-2">
                            Trang {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage >= totalPages}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default RevenueStatsView;
