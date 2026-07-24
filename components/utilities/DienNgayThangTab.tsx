import React, { useState, useEffect } from 'react';
import { Calendar, Play, CheckCircle2, AlertTriangle, FileText, Info, CheckCircle, HelpCircle, Loader2, ArrowRight } from 'lucide-react';
import { RecordFile, NotifyFunction } from '../../types';
import { calculateDeadlineHelper } from '../../utils/appHelpers';
import { updateRecordsBatchById } from '../../services/api';

interface Props {
    records: RecordFile[];
    onSaveRecord?: (record: any) => Promise<any>;
    holidays?: any[];
    notify: NotifyFunction;
    onRefreshData?: () => void | Promise<void>;
}

interface ProposalItem {
    id: string;
    code: string;
    customerName: string;
    receiptNumber: string;
    recordType: string;
    currentReceivedDate: string | null;
    currentDeadline: string | null;
    proposedReceivedDate: string;
    proposedDeadline: string;
    explanation: string;
    selected: boolean;
}

export const DienNgayThangTab: React.FC<Props> = ({ records, onSaveRecord, holidays, notify, onRefreshData }) => {
    const [proposals, setProposals] = useState<ProposalItem[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Format ISO Date string (YYYY-MM-DD) into readable Vietnamese format (DD/MM/YYYY)
    const formatToVN = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '---';
        const cleanStr = dateStr.split('T')[0];
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    // Parse reception date from record code using yymmdd-xxxx format
    const extractDateFromCode = (recordCode: string | null | undefined): string | null => {
        if (!recordCode) return null;
        // Match 6 digits followed by a hyphen and sequence of digits (yymmdd-xxxx)
        const match = recordCode.match(/(\d{2})(\d{2})(\d{2})-\d+/);
        if (match) {
            const yy = match[1];
            const mm = match[2];
            const dd = match[3];
            
            const yearNum = parseInt(yy, 10);
            const monthNum = parseInt(mm, 10);
            const dayNum = parseInt(dd, 10);
            
            if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
                const fullYear = yearNum > 80 ? `19${yy}` : `20${yy}`;
                return `${fullYear}-${mm}-${dd}`;
            }
        }
        return null;
    };

    const handleScan = () => {
        setIsScanning(true);
        setAgreed(false);
        setProposals([]);
        setCurrentPage(1);
        
        setTimeout(() => {
            // Find records lacking receivedDate OR deadline
            const missing = records.filter(r => {
                const isMissingDate = !r.receivedDate || !r.deadline;
                if (!isMissingDate) return false;
                
                const extracted = extractDateFromCode(r.code);
                return extracted !== null;
            });

            const parsedProposals: ProposalItem[] = missing.map(r => {
                const proposedReceived = extractDateFromCode(r.code)!;
                const proposedDeadline = calculateDeadlineHelper(r.recordType || '', proposedReceived, holidays || []);
                
                // Get working days duration description
                let daysToAdd = 30;
                const lowerType = (r.recordType || '').toLowerCase();
                if (lowerType.includes('1.1') || lowerType.includes('cung cấp tài liệu đất đai') || lowerType.includes('cung cấp dữ liệu') ||
                    lowerType.includes('2.2') || lowerType.includes('quy hoạch') || 
                    lowerType.includes('2.6') || lowerType.includes('số thửa') || 
                    lowerType.includes('2.1') || lowerType.includes('trích lục')) {
                    daysToAdd = 10;
                } else if (lowerType.includes('trích đo chỉnh lý') || lowerType.includes('chỉnh lý bản đồ')) {
                    daysToAdd = 15;
                }

                const explanation = `Ngày nhận giải mã từ mã hồ sơ "${r.code}" -> ${formatToVN(proposedReceived)}. ` +
                    `Thời gian xử lý của thủ tục "${r.recordType || 'Chưa rõ'}" là ${daysToAdd} ngày làm việc. ` +
                    `Tính ra ngày hẹn trả kết quả là ${formatToVN(proposedDeadline)} (không tính Thứ 7, Chủ Nhật và ngày nghỉ lễ).`;

                return {
                    id: r.id,
                    code: r.code || '---',
                    customerName: r.customerName || 'Chưa rõ',
                    receiptNumber: r.receiptNumber || '---',
                    recordType: r.recordType || 'Chưa rõ',
                    currentReceivedDate: r.receivedDate || null,
                    currentDeadline: r.deadline || null,
                    proposedReceivedDate: proposedReceived,
                    proposedDeadline: proposedDeadline,
                    explanation,
                    selected: true
                };
            });

            setProposals(parsedProposals);
            setIsScanning(false);
            setHasScanned(true);

            if (parsedProposals.length === 0) {
                notify('Không tìm thấy hồ sơ nào thiếu ngày tháng có mã hồ sơ hợp lệ!', 'info');
            } else {
                notify(`Tìm thấy ${parsedProposals.length} hồ sơ đủ điều kiện cập nhật ngày tháng!`, 'success');
            }
        }, 600);
    };

    const toggleSelect = (id: string) => {
        setProposals(prev => prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
    };

    const toggleSelectAll = () => {
        const anyUnselected = proposals.some(p => !p.selected);
        setProposals(prev => prev.map(p => ({ ...p, selected: anyUnselected })));
    };

    const sanitizeDateString = (dateStr: string | null | undefined): string | null => {
        if (!dateStr) return null;
        return dateStr.split('T')[0].split(' ')[0];
    };

    const handleExecuteUpdates = async () => {
        const selectedProposals = proposals.filter(p => p.selected);
        if (selectedProposals.length === 0) {
            notify('Vui lòng chọn ít nhất một hồ sơ để tiến hành cập nhật!', 'error');
            return;
        }

        if (!agreed) {
            notify('Bạn phải tích chọn đồng ý với giãi trình trước khi thực hiện!', 'error');
            return;
        }

        setIsUpdating(true);
        setProgress({ current: 0, total: selectedProposals.length });

        // Chuẩn bị toàn bộ dữ liệu cập nhật
        const updates: any[] = [];
        selectedProposals.forEach(prop => {
            const originalRecord = records.find(r => r.id === prop.id);
            if (originalRecord) {
                const cleanReceived = sanitizeDateString(originalRecord.receivedDate || prop.proposedReceivedDate);
                const cleanDeadline = sanitizeDateString(originalRecord.deadline || prop.proposedDeadline);
                const cleanAssigned = sanitizeDateString(originalRecord.assignedDate || originalRecord.receivedDate || prop.proposedReceivedDate);

                updates.push({
                    id: originalRecord.id,
                    receivedDate: cleanReceived,
                    deadline: cleanDeadline,
                    assignedDate: cleanAssigned
                });
            }
        });

        let successCount = 0;
        const CHUNK_SIZE = 100; // Chia nhỏ thành các lô 100 dòng để tối ưu hóa và hiển thị tiến trình mượt mà

        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);
            try {
                // Sử dụng hàm upsert hàng loạt đã tối ưu của hệ thống
                const res = await updateRecordsBatchById(chunk);
                if (res && res.success) {
                    successCount += chunk.length;
                } else {
                    console.error(`Lỗi cập nhật lô hồ sơ tại vị trí ${i}`);
                }
            } catch (err) {
                console.error(`Lỗi thực thi cập nhật lô hồ sơ tại vị trí ${i}:`, err);
            }
            setProgress(prev => ({ ...prev, current: Math.min(i + chunk.length, updates.length) }));
        }

        setIsUpdating(false);
        setAgreed(false);
        setHasScanned(false);
        setProposals([]);
        
        if (successCount > 0) {
            notify(`Đã điền thành công ngày tiếp nhận & ngày hẹn cho ${successCount}/${selectedProposals.length} hồ sơ!`, 'success');
        } else {
            notify(`Không có hồ sơ nào được cập nhật thành công. Vui lòng kiểm tra lại cấu hình hoặc thử lại!`, 'error');
        }

        if (onRefreshData) {
            try {
                await onRefreshData();
            } catch (e) {
                console.error("Lỗi tự động tải lại dữ liệu:", e);
            }
        }
    };

    // Pagination calculations
    const totalPages = Math.ceil(proposals.length / ITEMS_PER_PAGE);
    const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
    const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
    const currentProposals = proposals.slice(indexOfFirstItem, indexOfLastItem);

    // Dynamic list of page numbers to render
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }
        return pages;
    };

    // Header checkbox states for the current page
    const isAllCurrentPageSelected = currentProposals.length > 0 && currentProposals.every(p => p.selected);
    const isSomeCurrentPageSelected = currentProposals.length > 0 && currentProposals.some(p => p.selected) && !isAllCurrentPageSelected;

    const handleToggleCurrentPage = () => {
        const shouldSelect = !isAllCurrentPageSelected;
        const currentPageIds = new Set(currentProposals.map(p => p.id));
        setProposals(prev => prev.map(p => {
            if (currentPageIds.has(p.id)) {
                return { ...p, selected: shouldSelect };
            }
            return p;
        }));
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f1f5f9] overflow-y-auto p-6" id="dien-ngay-thang-tab">
            {/* Header section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Calendar size={22} className="text-blue-600" />
                        Tự động Điền Ngày Tiếp Nhận & Hạn Trả
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                        Công cụ quét và phục hồi thông tin ngày tiếp nhận từ mã hồ sơ <span className="font-mono text-blue-600 font-bold">YYMMDD-xxxx</span>, đồng thời tự động tính toán hạn trả kết quả chính xác theo quy chuẩn từng loại thủ tục.
                    </p>
                </div>
                
                <button
                    onClick={handleScan}
                    disabled={isScanning || isUpdating}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
                >
                    {isScanning ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Đang quét dữ liệu...
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            Quét hồ sơ thiếu ngày tháng
                        </>
                    )}
                </button>
            </div>

            {isUpdating && (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-md mb-6 flex flex-col items-center justify-center animate-pulse">
                    <Loader2 className="animate-spin text-blue-600 mb-3" size={36} />
                    <h4 className="font-bold text-slate-700 text-sm mb-1">Hệ thống đang tiến hành cập nhật dữ liệu...</h4>
                    <p className="text-xs text-slate-400 mb-4">Vui lòng không tắt hoặc tải lại trang trong khi tác vụ đang chạy.</p>
                    <div className="w-full max-w-md bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                        <div 
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        ></div>
                    </div>
                    <span className="text-xs font-black text-blue-700 mt-2">{progress.current} / {progress.total} hồ sơ hoàn thành</span>
                </div>
            )}

            {hasScanned && proposals.length === 0 && !isScanning && !isUpdating && (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm py-16">
                    <CheckCircle className="mx-auto text-emerald-500 mb-3" size={48} />
                    <h4 className="font-bold text-slate-700 text-sm mb-1">Tuyệt vời! Cơ sở dữ liệu sạch đẹp</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                        Tất cả các hồ sơ có biên nhận hợp lệ đều đã được điền đầy đủ ngày tiếp nhận và ngày hẹn trả. Không phát hiện thêm hồ sơ bị khuyết thiếu ngày tháng.
                    </p>
                </div>
            )}

            {proposals.length > 0 && !isUpdating && (
                <div className="space-y-6 flex-1 flex flex-col min-h-0 animate-fade-in">
                    {/* Preview Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                            <span className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={16} className="text-slate-500" />
                                Danh sách đề xuất ({proposals.filter(p => p.selected).length} / {proposals.length} được chọn)
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={toggleSelectAll}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm active:scale-95"
                                >
                                    {proposals.some(p => !p.selected) ? 'Chọn tất cả các trang' : 'Bỏ chọn toàn bộ'}
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto max-h-[750px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <input 
                                                type="checkbox"
                                                ref={el => {
                                                    if (el) {
                                                        el.indeterminate = isSomeCurrentPageSelected;
                                                    }
                                                }}
                                                checked={isAllCurrentPageSelected}
                                                onChange={handleToggleCurrentPage}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                title="Chọn/Bỏ chọn tất cả trên trang này"
                                            />
                                        </th>
                                        <th className="p-4 w-32">Mã hồ sơ</th>
                                        <th className="p-4 w-56">Chủ sử dụng</th>
                                        <th className="p-4 w-48">Loại thủ tục</th>
                                        <th className="p-4 w-80">Đề xuất thay đổi</th>
                                        <th className="p-4">Giãi trình chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {currentProposals.map(prop => (
                                        <tr 
                                            key={prop.id} 
                                            className={`hover:bg-slate-50/80 transition-colors ${prop.selected ? 'bg-blue-50/10' : 'opacity-60'}`}
                                        >
                                            <td className="p-4 text-center">
                                                <input 
                                                    type="checkbox"
                                                    checked={prop.selected}
                                                    onChange={() => toggleSelect(prop.id)}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-4 font-bold text-slate-800 font-mono">{prop.code}</td>
                                            <td className="p-4 font-semibold text-slate-700">{prop.customerName}</td>
                                            <td className="p-4 text-slate-600 font-semibold">{prop.recordType}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[11px]">
                                                        <span className="text-slate-400 block line-through">Nhận: {formatToVN(prop.currentReceivedDate)}</span>
                                                        <span className="text-blue-700 font-bold block bg-blue-50 px-1.5 py-0.5 rounded mt-0.5">Nhận mới: {formatToVN(prop.proposedReceivedDate)}</span>
                                                    </div>
                                                    <ArrowRight size={14} className="text-slate-300 shrink-0" />
                                                    <div className="text-[11px]">
                                                        <span className="text-slate-400 block line-through">Hạn: {formatToVN(prop.currentDeadline)}</span>
                                                        <span className="text-emerald-700 font-bold block bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">Hạn mới: {formatToVN(prop.proposedDeadline)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-500 font-medium leading-relaxed italic">{prop.explanation}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        {totalPages > 1 && (
                            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
                                <div className="text-slate-500 font-medium">
                                    Hiển thị <span className="font-bold text-slate-700">{indexOfFirstItem + 1}</span> - <span className="font-bold text-slate-700">{Math.min(indexOfLastItem, proposals.length)}</span> trong tổng số <span className="font-bold text-slate-700">{proposals.length}</span> hồ sơ đề xuất
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                                    >
                                        Trước
                                    </button>
                                    
                                    {getPageNumbers().map((page, idx) => {
                                        if (page === '...') {
                                            return <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 font-bold">...</span>;
                                        }
                                        return (
                                            <button
                                                key={`page-${page}`}
                                                onClick={() => setCurrentPage(Number(page))}
                                                className={`w-8 h-8 rounded font-bold transition-all ${
                                                    currentPage === page
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Consent and Action Block */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-md p-6">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                            <label className="flex items-start gap-3 cursor-pointer select-none max-w-3xl">
                                <input 
                                    type="checkbox"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5 shrink-0"
                                />
                                <div className="space-y-1">
                                    <span className="text-sm font-bold text-slate-800 block">
                                        Đồng ý & Xác nhận cập nhật tự động điền ngày tiếp nhận và ngày hẹn trả kết quả
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium block leading-relaxed">
                                        Hệ thống sẽ thực hiện cập nhật ngày tiếp nhận (giải mã trực tiếp từ mã hồ sơ YYMMDD-xxxx) và tính ngày hẹn trả kết quả chính xác theo loại thủ tục tương ứng cho các hồ sơ được chọn. <span className="text-amber-600 font-semibold">Chỉ các hồ sơ trống ngày mới được bổ sung, các hồ sơ đã có thông tin sẽ hoàn toàn được giữ nguyên.</span>
                                    </span>
                                </div>
                            </label>

                            <button
                                onClick={handleExecuteUpdates}
                                disabled={!agreed || proposals.filter(p => p.selected).length === 0}
                                className={`font-bold px-8 py-3.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 text-sm ${
                                    agreed && proposals.filter(p => p.selected).length > 0
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100 hover:shadow-xl' 
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                                }`}
                            >
                                <CheckCircle2 size={18} />
                                Đồng ý & Thực hiện cập nhật
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DienNgayThangTab;

