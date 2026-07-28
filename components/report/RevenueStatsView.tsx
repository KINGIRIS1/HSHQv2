import React, { useState, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { getShortRecordType } from '../../constants';
import { FileSpreadsheet, Receipt, HandCoins, Users, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface RevenueStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate?: string;
    toDate?: string;
}

const RevenueStatsView: React.FC<RevenueStatsViewProps> = ({ records, employees, fromDate, toDate }) => {
    // Card filter selection: 'all' | 'bien_lai' | 'hoa_don'
    const [activeCardFilter, setActiveCardFilter] = useState<'all' | 'bien_lai' | 'hoa_don'>('all');
    
    // Additional filters
    const [selectedReceiver, setSelectedReceiver] = useState<string>('all');
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

    // Calculate revenue records filtered by resultReturnedDate (Ngày trả kết quả)
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
            .map(r => {
                const contractP = (r as any).contractPrice;
                const price = Number(r.price) || Number(contractP) || 0;
                let returned = 0;
                if (r.returnedPrice !== undefined && r.returnedPrice !== null && String(r.returnedPrice).trim() !== '' && !isNaN(Number(r.returnedPrice))) {
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
            // Only include records with revenue or receipt/invoice recorded or returned status
            .filter(r => r.calcReturned > 0 || (r.receiptNumber && r.receiptNumber.trim() !== '') || r.status === RecordStatus.RETURNED)
            // Filter strictly by resultReturnedDate or completedDate or receivedDate
            .filter(r => {
                if (!dateStart || !dateEnd) return true;
                const targetDateStr = r.resultReturnedDate || r.completedDate || r.exportDate || r.receivedDate;
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

    // KPI Summary for 3 Top Cards
    const cardMetrics = useMemo(() => {
        let totalSum = 0;
        let totalCount = 0;

        let bienLaiSum = 0;
        let bienLaiCount = 0;

        let hoaDonSum = 0;
        let hoaDonCount = 0;

        revenueRecords.forEach(r => {
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
    }, [revenueRecords]);

    // Get list of unique assigned wards for dropdown filter
    const wardOptions = useMemo(() => {
        const set = new Set<string>();
        revenueRecords.forEach(r => {
            if (r.assignedWard) set.add(r.assignedWard);
        });
        return Array.from(set);
    }, [revenueRecords]);

    // Filtered records for table
    const filteredRecords = useMemo(() => {
        return revenueRecords.filter(r => {
            // Card filter
            if (activeCardFilter === 'bien_lai' && r.computedReceiptType !== 'Biên Lai') return false;
            if (activeCardFilter === 'hoa_don' && r.computedReceiptType !== 'Hóa Đơn') return false;

            // Ward filter
            if (selectedReceiver !== 'all') {
                if (r.assignedWard !== selectedReceiver) return false;
            }

            // Search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchCode = r.code?.toLowerCase().includes(term);
                const matchName = r.customerName?.toLowerCase().includes(term);
                const matchReceipt = r.receiptNumber?.toLowerCase().includes(term);
                const matchWard = r.assignedWard?.toLowerCase().includes(term);
                if (!matchCode && !matchName && !matchReceipt && !matchWard) return false;
            }

            return true;
        });
    }, [revenueRecords, activeCardFilter, selectedReceiver, searchTerm]);

    // Total collected for filtered set
    const filteredTotalAmount = useMemo(() => {
        return filteredRecords.reduce((acc, r) => acc + r.calcReturned, 0);
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
        <div className="flex flex-col h-full bg-[#f8fafc] p-4 md:p-6 gap-6 overflow-y-auto animate-fade-in-up">
            
            {/* 1. TOP 3 KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                {/* CARD 1: TỔNG NGUỒN THU */}
                <div 
                    onClick={() => handleCardFilterChange('all')}
                    className={`cursor-pointer rounded-2xl p-4 flex items-center justify-between transition-all active:scale-[0.99] border-2 bg-white ${
                        activeCardFilter === 'all' 
                            ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                            : 'border-slate-200/80 hover:border-emerald-300 shadow-sm'
                    }`}
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100">
                            <HandCoins size={22} />
                        </div>
                        <div>
                            <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
                                {cardMetrics.totalSum.toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-xs font-bold tracking-wider text-teal-600 uppercase">
                                TỔNG NGUỒN THU
                            </div>
                        </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                        {cardMetrics.totalCount} hồ sơ
                    </span>
                </div>

                {/* CARD 2: THU QUA BIÊN LAI */}
                <div 
                    onClick={() => handleCardFilterChange('bien_lai')}
                    className={`cursor-pointer rounded-2xl p-4 flex items-center justify-between transition-all active:scale-[0.99] border-2 bg-white ${
                        activeCardFilter === 'bien_lai' 
                            ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' 
                            : 'border-slate-200/80 hover:border-blue-300 shadow-sm'
                    }`}
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            <Receipt size={22} />
                        </div>
                        <div>
                            <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
                                {cardMetrics.bienLaiSum.toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-xs font-bold tracking-wider text-blue-600 uppercase">
                                THU QUA BIÊN LAI
                            </div>
                        </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                        {cardMetrics.bienLaiCount} hồ sơ
                    </span>
                </div>

                {/* CARD 3: THU QUA HÓA ĐƠN */}
                <div 
                    onClick={() => handleCardFilterChange('hoa_don')}
                    className={`cursor-pointer rounded-2xl p-4 flex items-center justify-between transition-all active:scale-[0.99] border-2 bg-white ${
                        activeCardFilter === 'hoa_don' 
                            ? 'border-orange-500 shadow-md ring-2 ring-orange-500/20' 
                            : 'border-slate-200/80 hover:border-orange-300 shadow-sm'
                    }`}
                >
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
                            <Receipt size={22} className="rotate-90" />
                        </div>
                        <div>
                            <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
                                {cardMetrics.hoaDonSum.toLocaleString('vi-VN')} đ
                            </div>
                            <div className="text-xs font-bold tracking-wider text-orange-600 uppercase">
                                THU QUA HÓA ĐƠN
                            </div>
                        </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                        {cardMetrics.hoaDonCount} hồ sơ
                    </span>
                </div>
            </div>

            {/* 2. MAIN DETAIL REVENUE TABLE CARD */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col flex-1">
                
                {/* Header Section */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-700">
                                <HandCoins size={18} />
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm md:text-base uppercase tracking-wide">
                                DANH SÁCH CHI TIẾT NGUỒN THU ({filteredRecords.length} HỒ SƠ)
                            </h3>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                            Tổng thu thực tế: <span className="font-bold text-emerald-600">{filteredTotalAmount.toLocaleString('vi-VN')} đ</span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search Input */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Tìm kiếm hồ sơ..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-emerald-500 bg-slate-50/50 w-40 sm:w-52 font-medium"
                            />
                        </div>

                        {/* Ward Dropdown */}
                        <div className="relative flex items-center">
                            <Users size={14} className="absolute left-3 text-slate-500 z-10 pointer-events-none" />
                            <select
                                value={selectedReceiver}
                                onChange={(e) => { setSelectedReceiver(e.target.value); setCurrentPage(1); }}
                                className="pl-8 pr-8 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl outline-none bg-slate-50 hover:bg-slate-100 cursor-pointer appearance-none"
                            >
                                <option value="all">Xã phân công (Tất cả)</option>
                                {wardOptions.map(ward => (
                                    <option key={ward} value={ward}>{ward}</option>
                                ))}
                            </select>
                        </div>

                        {/* Export Excel Button */}
                        <button
                            onClick={handleExportExcel}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                        >
                            <FileSpreadsheet size={15} /> Xuất Excel ({filteredRecords.length})
                        </button>
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
                                                    const dStr = r.resultReturnedDate || r.completedDate || r.exportDate || r.receivedDate;
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
                                    const dStr = r.resultReturnedDate || r.completedDate || r.exportDate || r.receivedDate;
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
