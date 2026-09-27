import React, { useState, useMemo } from 'react';
import { Contract, RecordFile } from '../../types';
import { updateContractApi } from '../../services/api';
import { Calendar, AlertTriangle, CheckCircle, RefreshCw, X, ArrowRight, CheckSquare, Square, Search, Filter } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface FixContractDatesModalProps {
    isOpen: boolean;
    onClose: () => void;
    contracts: Contract[];
    records: RecordFile[];
    onUpdateSuccess: () => void;
}

interface InvertedCandidate {
    contract: Contract;
    matchedRecord?: RecordFile;
    currentDateStr: string;
    suggestedDateStr: string;
    currentDisplay: string;
    suggestedDisplay: string;
    reason: string;
    confidence: 'HIGH' | 'MEDIUM' | 'ALL_SWAPPABLE';
}

export const FixContractDatesModal: React.FC<FixContractDatesModalProps> = ({
    isOpen,
    onClose,
    contracts,
    records,
    onUpdateSuccess
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isFixing, setIsFixing] = useState(false);
    const [filterMode, setFilterMode] = useState<'LIKELY_INVERTED' | 'ALL_SWAPPABLE'>('LIKELY_INVERTED');
    const [searchTerm, setSearchTerm] = useState('');
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

    // Phân tích và phát hiện các hợp đồng bị đảo Ngày / Tháng
    const candidates: InvertedCandidate[] = useMemo(() => {
        const result: InvertedCandidate[] = [];

        for (const c of contracts) {
            if (!c.createdDate) continue;
            
            // Lấy chuỗi YYYY-MM-DD
            const raw = c.createdDate.includes('T') ? c.createdDate.split('T')[0] : c.createdDate;
            const parts = raw.split('-');
            if (parts.length !== 3) continue;

            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);

            if (isNaN(year) || isNaN(month) || isNaN(day)) continue;

            // Nếu ngày > 12 thì không thể là tháng -> không bị đảo dạng MM/DD
            // Đảo hợp lệ khi cả month <= 12 và day <= 12 và month !== day
            if (month <= 12 && day <= 12 && month !== day) {
                // Đảo lại: Year-Day-Month (VD 2026-04-09 -> 2026-09-04)
                const swappedStr = `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
                
                const currentDisplay = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                const suggestedDisplay = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;

                // Tìm hồ sơ liên kết
                const matchedRec = records.find(r => 
                    (c.customerAddress && (r.code === c.customerAddress || r.customerAddress?.includes(c.customerAddress))) ||
                    (c.code && ((r as any).contractNumber === c.code || r.data?.contractNumber === c.code)) ||
                    (r.customerName && c.customerName && r.customerName.trim().toLowerCase() === c.customerName.trim().toLowerCase() && r.ward === c.ward)
                );

                let reason = '';
                let confidence: 'HIGH' | 'MEDIUM' | 'ALL_SWAPPABLE' = 'ALL_SWAPPABLE';

                if (matchedRec && matchedRec.receivedDate) {
                    const recDateRaw = matchedRec.receivedDate.includes('T') ? matchedRec.receivedDate.split('T')[0] : matchedRec.receivedDate;
                    const recParts = recDateRaw.split('-');
                    if (recParts.length === 3) {
                        const recYear = parseInt(recParts[0], 10);
                        const recMonth = parseInt(recParts[1], 10);
                        const recDay = parseInt(recParts[2], 10);

                        // So sánh ngày
                        const currContractTime = new Date(year, month - 1, day).getTime();
                        const swappedContractTime = new Date(year, day - 1, month).getTime();
                        const recordTime = new Date(recYear, recMonth - 1, recDay).getTime();

                        // Nếu ngày hiện tại trước ngày tiếp nhận hồ sơ, nhưng ngày sau khi đảo lại đúng bằng hoặc sau ngày tiếp nhận
                        if (currContractTime < recordTime && swappedContractTime >= recordTime) {
                            reason = `Ngày HĐ (${currentDisplay}) đi trước ngày nhận HS (${String(recDay).padStart(2, '0')}/${String(recMonth).padStart(2, '0')}/${recYear})`;
                            confidence = 'HIGH';
                        } else if (recMonth === day && recDay === month) {
                            reason = `Khớp ngày tiếp nhận hồ sơ (${String(recDay).padStart(2, '0')}/${String(recMonth).padStart(2, '0')}/${recYear}) sau khi đảo`;
                            confidence = 'HIGH';
                        }
                    }
                }

                // Nếu tháng hiện tại trong CSDL là tháng đầu năm nhưng số HĐ cao hoặc năm 2026 đang ở tháng 9
                if (confidence !== 'HIGH') {
                    if (month < day && day >= 6 && day <= 12) {
                        reason = `Nghi vấn đảo Tháng ${month} thành Ngày ${day}`;
                        confidence = 'MEDIUM';
                    } else {
                        reason = `Có thể đảo Tháng ${month} ↔ Ngày ${day}`;
                        confidence = 'ALL_SWAPPABLE';
                    }
                }

                result.push({
                    contract: c,
                    matchedRecord: matchedRec,
                    currentDateStr: raw,
                    suggestedDateStr: swappedStr,
                    currentDisplay,
                    suggestedDisplay,
                    reason,
                    confidence
                });
            }
        }

        return result;
    }, [contracts, records]);

    // Lọc theo chế độ và từ khóa
    const filteredCandidates = useMemo(() => {
        let list = candidates;
        if (filterMode === 'LIKELY_INVERTED') {
            list = list.filter(c => c.confidence === 'HIGH' || c.confidence === 'MEDIUM');
        }
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(c => 
                (c.contract.code || '').toLowerCase().includes(lower) ||
                (c.contract.customerName || '').toLowerCase().includes(lower) ||
                (c.matchedRecord?.code || '').toLowerCase().includes(lower) ||
                c.currentDisplay.includes(lower) ||
                c.suggestedDisplay.includes(lower)
            );
        }
        return list;
    }, [candidates, filterMode, searchTerm]);

    // Khởi tạo chọn mặc định các mục có độ tin cậy cao
    React.useEffect(() => {
        if (isOpen) {
            const highConfIds = new Set<string>();
            candidates.forEach(c => {
                if (c.confidence === 'HIGH') {
                    highConfIds.add(c.contract.id);
                }
            });
            setSelectedIds(highConfIds);
        }
    }, [isOpen, candidates]);

    if (!isOpen) return null;

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAllFiltered = () => {
        if (selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0) {
            setSelectedIds(new Set());
        } else {
            const all = new Set(filteredCandidates.map(c => c.contract.id));
            setSelectedIds(all);
        }
    };

    const handleApplyFixes = async () => {
        if (selectedIds.size === 0) {
            alert('Vui lòng chọn ít nhất một hợp đồng cần sửa ngày!');
            return;
        }

        const confirm = await confirmAction(
            `Bạn có chắc chắn muốn cập nhật lại ngày lập cho ${selectedIds.size} hợp đồng đã chọn không?\n\nNgày lập sẽ được đảo chuẩn định dạng Ngày/Tháng/Năm chính xác.`,
            'Xác nhận sửa ngày hợp đồng'
        );
        if (!confirm) return;

        setIsFixing(true);
        const toFix = candidates.filter(c => selectedIds.has(c.contract.id));
        setProgress({ current: 0, total: toFix.length });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < toFix.length; i++) {
            const item = toFix[i];
            try {
                const updatedContract: Contract = {
                    ...item.contract,
                    createdDate: item.suggestedDateStr
                };
                await updateContractApi(updatedContract);
                successCount++;
            } catch (err) {
                console.error(`Lỗi khi sửa hợp đồng ${item.contract.code}:`, err);
                failCount++;
            }
            setProgress({ current: i + 1, total: toFix.length });
        }

        setIsFixing(false);
        setProgress(null);

        alert(`Hoàn tất!\n- Sửa thành công: ${successCount} hợp đồng\n${failCount > 0 ? `- Lỗi: ${failCount} hợp đồng` : ''}`);
        onUpdateSuccess();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-slate-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 px-5 py-4 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                            <Calendar className="text-yellow-300" size={22} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold">Công cụ Quét & Chuẩn hóa Ngày Lập Hợp Đồng</h2>
                            <p className="text-xs text-purple-200">
                                Phát hiện và tự động sửa lỗi đảo Ngày / Tháng (MM/DD/YYYY ↔ DD/MM/YYYY)
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={isFixing}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filter & Toolbar */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setFilterMode('LIKELY_INVERTED')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                filterMode === 'LIKELY_INVERTED'
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            Nghi vấn bị ngược ({candidates.filter(c => c.confidence === 'HIGH' || c.confidence === 'MEDIUM').length})
                        </button>
                        <button
                            onClick={() => setFilterMode('ALL_SWAPPABLE')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                filterMode === 'ALL_SWAPPABLE'
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            Tất cả hợp đồng có thể đảo ({candidates.length})
                        </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Tìm số HĐ, khách hàng..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>
                </div>

                {/* Table list */}
                <div className="flex-1 overflow-auto p-4">
                    {filteredCandidates.length === 0 ? (
                        <div className="py-16 text-center text-slate-500">
                            <CheckCircle className="mx-auto mb-2 text-emerald-500" size={40} />
                            <p className="text-sm font-semibold">Tuyệt vời! Không phát hiện hợp đồng nào bị ngược định dạng ngày tháng.</p>
                            <p className="text-xs text-slate-400 mt-1">Toàn bộ ngày lập hợp đồng đang ở định dạng chuẩn xác.</p>
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3 w-10 text-center">
                                            <button 
                                                onClick={handleSelectAllFiltered}
                                                className="text-slate-600 hover:text-purple-600"
                                            >
                                                {selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0 ? (
                                                    <CheckSquare size={16} className="text-purple-600" />
                                                ) : (
                                                    <Square size={16} />
                                                )}
                                            </button>
                                        </th>
                                        <th className="p-3 w-28">Số HĐ</th>
                                        <th className="p-3">Khách hàng / Mã HS</th>
                                        <th className="p-3 w-32 text-center text-rose-700 bg-rose-50/50">Ngày hiện tại</th>
                                        <th className="p-3 w-6 text-center"></th>
                                        <th className="p-3 w-32 text-center text-emerald-700 bg-emerald-50/50">Ngày đề xuất sửa</th>
                                        <th className="p-3">Lý do phát hiện</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCandidates.map((item) => {
                                        const isSelected = selectedIds.has(item.contract.id);
                                        return (
                                            <tr 
                                                key={item.contract.id}
                                                onClick={() => handleToggleSelect(item.contract.id)}
                                                className={`cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-purple-50/70 hover:bg-purple-100/50' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => handleToggleSelect(item.contract.id)}>
                                                        {isSelected ? (
                                                            <CheckSquare size={16} className="text-purple-600" />
                                                        ) : (
                                                            <Square size={16} className="text-slate-300 hover:text-slate-500" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="p-3 font-bold text-purple-700">
                                                    {item.contract.code}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-semibold text-slate-800">{item.contract.customerName}</div>
                                                    {item.matchedRecord && (
                                                        <div className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                                                            <span>HS: {item.matchedRecord.code}</span>
                                                            {item.matchedRecord.receivedDate && (
                                                                <span className="text-slate-400 font-normal">
                                                                    (Nhận: {item.matchedRecord.receivedDate.split('T')[0]})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-rose-600 bg-rose-50/30">
                                                    {item.currentDisplay}
                                                </td>
                                                <td className="p-3 text-center text-slate-400">
                                                    <ArrowRight size={14} className="inline" />
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                                    {item.suggestedDisplay}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                                                        item.confidence === 'HIGH' 
                                                            ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200' 
                                                            : item.confidence === 'MEDIUM'
                                                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                                : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {item.confidence === 'HIGH' && <AlertTriangle size={11} className="text-rose-600 shrink-0" />}
                                                        {item.reason}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-slate-600">
                        Đã chọn <strong className="text-purple-700">{selectedIds.size}</strong> / {filteredCandidates.length} hợp đồng
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isFixing}
                            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleApplyFixes}
                            disabled={isFixing || selectedIds.size === 0}
                            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                        >
                            {isFixing ? (
                                <>
                                    <RefreshCw size={15} className="animate-spin" />
                                    <span>Đang cập nhật ({progress?.current}/{progress?.total})...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={15} />
                                    <span>Sửa {selectedIds.size} Hợp Đồng Đã Chọn</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
