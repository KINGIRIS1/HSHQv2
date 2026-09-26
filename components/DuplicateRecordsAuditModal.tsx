import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, Contract } from '../types';
import { 
    AlertTriangle, Trash2, CheckCircle2, ShieldAlert, RefreshCw, 
    X, CheckSquare, Square, Layers, Search, Filter, HelpCircle
} from 'lucide-react';
import { confirmAction, removeVietnameseTones } from '../utils/appHelpers';
import { deleteRecordApi, deleteRecordsBatchApi } from '../services/apiRecords';
import { deleteContractApi } from '../services/apiContracts';

interface DuplicateRecordsAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: RecordFile[];
    contracts?: Contract[];
    onDeleteRecord?: (id: string) => Promise<boolean>;
    onDeleteBatch?: (ids: string[]) => Promise<boolean>;
    onRefresh?: () => Promise<void> | void;
}

export interface DuplicateItem {
    id: string;
    code: string;
    customerName: string;
    landPlot?: string;
    mapSheet?: string;
    ward?: string;
    receivedDate?: string;
    createdDate?: string;
    status?: string;
    type: 'record' | 'contract';
    raw: any;
    isOriginal: boolean;
}

export interface DuplicateGroup {
    groupId: string;
    groupType: 'CODE_NAME' | 'REC_CODE_NAME' | 'PLOT_SHEET_NAME';
    title: string;
    items: DuplicateItem[];
}

export const DuplicateRecordsAuditModal: React.FC<DuplicateRecordsAuditModalProps> = ({
    isOpen,
    onClose,
    records,
    contracts = [],
    onDeleteRecord,
    onDeleteBatch,
    onRefresh
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'records' | 'contracts'>('records');

    // 1. Quét và nhóm hồ sơ trùng lặp (Records)
    const recordDuplicateGroups = useMemo(() => {
        const groups: DuplicateGroup[] = [];
        const map = new Map<string, DuplicateItem[]>();

        (records || []).forEach(r => {
            const rawCode = String(r.code || '').trim();
            const rawName = String(r.customerName || '').trim();
            const normCode = removeVietnameseTones(rawCode);
            const normName = removeVietnameseTones(rawName);
            const normPlot = removeVietnameseTones(String(r.landPlot || ''));
            const normSheet = removeVietnameseTones(String(r.mapSheet || ''));

            // Key 1: Cùng Mã hồ sơ + Tên khách hàng
            if (normCode && normName) {
                const k1 = `CODE:${normCode}___NAME:${normName}`;
                if (!map.has(k1)) map.set(k1, []);
                map.get(k1)!.push({
                    id: r.id,
                    code: r.code,
                    customerName: r.customerName,
                    landPlot: r.landPlot || undefined,
                    mapSheet: r.mapSheet || undefined,
                    ward: r.ward || undefined,
                    receivedDate: r.receivedDate || undefined,
                    status: r.status || undefined,
                    type: 'record',
                    raw: r,
                    isOriginal: false
                });
            } else if (normName && normPlot && normSheet && normPlot !== '' && normSheet !== '') {
                // Key 2: Cùng Tên khách hàng + Thửa + Tờ
                const k2 = `NAME:${normName}___PLOT:${normPlot}___SHEET:${normSheet}`;
                if (!map.has(k2)) map.set(k2, []);
                map.get(k2)!.push({
                    id: r.id,
                    code: r.code,
                    customerName: r.customerName,
                    landPlot: r.landPlot || undefined,
                    mapSheet: r.mapSheet || undefined,
                    ward: r.ward || undefined,
                    receivedDate: r.receivedDate || undefined,
                    status: r.status || undefined,
                    type: 'record',
                    raw: r,
                    isOriginal: false
                });
            }
        });

        // Chỉ giữ các nhóm có từ 2 bản ghi trở lên
        let gIdx = 0;
        for (const [key, rawItems] of map.entries()) {
            // Deduplicate items by ID inside group
            const itemMap = new Map<string, DuplicateItem>();
            rawItems.forEach(i => itemMap.set(i.id, i));
            const uniqueItems = Array.from(itemMap.values());

            if (uniqueItems.length > 1) {
                gIdx++;
                // Sắp xếp: Bản ghi tạo sớm nhất hoặc ngày tiếp nhận cũ nhất là bản gốc
                uniqueItems.sort((a, b) => {
                    const dateA = new Date(a.receivedDate || a.raw.created_at || a.raw.createdAt || 0).getTime();
                    const dateB = new Date(b.receivedDate || b.raw.created_at || b.raw.createdAt || 0).getTime();
                    return dateA - dateB;
                });

                // Đánh dấu bản đầu tiên là bản gốc, các bản sau là bản trùng
                uniqueItems.forEach((item, idx) => {
                    item.isOriginal = idx === 0;
                });

                const first = uniqueItems[0];
                let title = `Mã: ${first.code} — Khách hàng: ${first.customerName}`;
                if (first.landPlot && first.mapSheet) {
                    title += ` (Thửa ${first.landPlot}, Tờ ${first.mapSheet})`;
                }

                groups.push({
                    groupId: `g-record-${gIdx}`,
                    groupType: key.startsWith('CODE:') ? 'CODE_NAME' : 'PLOT_SHEET_NAME',
                    title,
                    items: uniqueItems
                });
            }
        }

        return groups;
    }, [records]);

    // 2. Quét và nhóm hợp đồng trùng lặp (Contracts)
    const contractDuplicateGroups = useMemo(() => {
        const groups: DuplicateGroup[] = [];
        const map = new Map<string, DuplicateItem[]>();

        (contracts || []).forEach(c => {
            const rawCode = String(c.code || '').trim();
            const rawName = String(c.customerName || (c as any).customer_name || '').trim();
            const normCode = removeVietnameseTones(rawCode);
            const normName = removeVietnameseTones(rawName);
            const normPlot = removeVietnameseTones(String(c.landPlot || ''));
            const normSheet = removeVietnameseTones(String(c.mapSheet || ''));
            const rawRec = String((c as any).customerAddress || '').trim();
            const normRec = removeVietnameseTones(rawRec);

            let k = '';
            if (normRec && normRec.length >= 3 && normName) {
                k = `REC:${normRec}___NAME:${normName}`;
            } else if (normCode && normName) {
                k = `CODE:${normCode}___NAME:${normName}`;
            } else if (normName && normPlot && normSheet) {
                k = `NAME:${normName}___PLOT:${normPlot}___SHEET:${normSheet}`;
            }

            if (k) {
                if (!map.has(k)) map.set(k, []);
                map.get(k)!.push({
                    id: c.id,
                    code: c.code,
                    customerName: c.customerName || (c as any).customer_name,
                    landPlot: c.landPlot || undefined,
                    mapSheet: c.mapSheet || undefined,
                    ward: c.ward || undefined,
                    createdDate: c.createdDate || undefined,
                    status: c.status || undefined,
                    type: 'contract',
                    raw: c,
                    isOriginal: false
                });
            }
        });

        let gIdx = 0;
        for (const [key, rawItems] of map.entries()) {
            const itemMap = new Map<string, DuplicateItem>();
            rawItems.forEach(i => itemMap.set(i.id, i));
            const uniqueItems = Array.from(itemMap.values());

            if (uniqueItems.length > 1) {
                gIdx++;
                uniqueItems.sort((a, b) => {
                    const dateA = new Date(a.createdDate || a.raw.created_date || 0).getTime();
                    const dateB = new Date(b.createdDate || b.raw.created_date || 0).getTime();
                    return dateA - dateB;
                });

                uniqueItems.forEach((item, idx) => {
                    item.isOriginal = idx === 0;
                });

                const first = uniqueItems[0];
                let title = `Hợp đồng: ${first.code} — Khách hàng: ${first.customerName}`;
                if (first.landPlot && first.mapSheet) {
                    title += ` (Thửa ${first.landPlot}, Tờ ${first.mapSheet})`;
                }

                groups.push({
                    groupId: `g-contract-${gIdx}`,
                    groupType: key.startsWith('REC:') ? 'REC_CODE_NAME' : key.startsWith('CODE:') ? 'CODE_NAME' : 'PLOT_SHEET_NAME',
                    title,
                    items: uniqueItems
                });
            }
        }

        return groups;
    }, [contracts]);

    // Lựa chọn nhóm đang xem
    const currentGroups = activeTab === 'records' ? recordDuplicateGroups : contractDuplicateGroups;

    // Filtered Groups by search
    const filteredGroups = useMemo(() => {
        if (!searchTerm.trim()) return currentGroups;
        const normSearch = removeVietnameseTones(searchTerm.trim());
        return currentGroups.filter(g => 
            removeVietnameseTones(g.title).includes(normSearch) ||
            g.items.some(i => 
                removeVietnameseTones(i.code).includes(normSearch) || 
                removeVietnameseTones(i.customerName).includes(normSearch)
            )
        );
    }, [currentGroups, searchTerm]);

    // Mặc định tự động chọn tất cả bản ghi trùng lặp (không chọn bản gốc) khi mở modal hoặc đổi tab
    useEffect(() => {
        if (isOpen) {
            const defaultSelected = new Set<string>();
            currentGroups.forEach(g => {
                g.items.forEach(item => {
                    if (!item.isOriginal) {
                        defaultSelected.add(item.id);
                    }
                });
            });
            setSelectedIds(defaultSelected);
        }
    }, [isOpen, currentGroups, activeTab]);

    // Tổng số bản ghi trùng thừa
    const totalDuplicateCount = useMemo(() => {
        return currentGroups.reduce((sum, g) => sum + (g.items.length - 1), 0);
    }, [currentGroups]);

    // Chọn / Bỏ chọn từng item
    const toggleItem = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    // Chọn tất cả bản trùng (chừa bản gốc)
    const handleSelectAllDuplicates = () => {
        const next = new Set<string>();
        currentGroups.forEach(g => {
            g.items.forEach(item => {
                if (!item.isOriginal) {
                    next.add(item.id);
                }
            });
        });
        setSelectedIds(next);
    };

    // Bỏ chọn tất cả
    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    // Xóa an toàn 1 bản ghi riêng lẻ
    const handleDeleteSingle = async (item: DuplicateItem) => {
        const confirmed = await confirmAction(
            `Bạn có chắc chắn muốn xóa vĩnh viễn bản ghi "${item.code} - ${item.customerName}" khỏi cơ sở dữ liệu không?`,
            'Xác nhận xóa bản ghi'
        );
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            if (item.type === 'record') {
                if (onDeleteRecord) {
                    await onDeleteRecord(item.id);
                } else {
                    await deleteRecordApi(item.id, item.raw);
                }
            } else {
                await deleteContractApi(item.id);
            }

            if (onRefresh) await onRefresh();
            // Xóa khỏi selection
            const next = new Set(selectedIds);
            next.delete(item.id);
            setSelectedIds(next);
        } catch (err) {
            console.error('Lỗi khi xóa bản ghi:', err);
            alert('Lỗi khi xóa bản ghi: ' + (err as any)?.message);
        } finally {
            setIsDeleting(false);
        }
    };

    // Xóa an toàn hàng loạt các bản ghi đã chọn
    const handleExecuteDeleteSelected = async () => {
        if (selectedIds.size === 0) {
            alert('Vui lòng chọn ít nhất 01 bản ghi để xóa.');
            return;
        }

        const count = selectedIds.size;
        const targetTypeLabel = activeTab === 'records' ? 'hồ sơ' : 'hợp đồng';

        const confirmed = await confirmAction(
            `CẢNH BÁO XÓA DỮ LIỆU TRÙNG LẶP:\n\nBạn đã chọn xóa vĩnh viễn ${count} ${targetTypeLabel} trùng lặp khỏi cơ sở dữ liệu.\n\nHệ thống sẽ giữ lại 01 bản gốc hợp lệ cho mỗi nhóm và cập nhật lại toàn bộ giao diện ngay lập tức.\n\nBạn có chắc chắn muốn thực hiện không?`,
            `Xác nhận xóa ${count} ${targetTypeLabel} trùng lặp`
        );
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const idsList = Array.from(selectedIds);
            
            if (activeTab === 'records') {
                if (onDeleteBatch) {
                    await onDeleteBatch(idsList);
                } else {
                    await deleteRecordsBatchApi(idsList);
                }
            } else {
                // Xóa hợp đồng
                for (const cid of idsList) {
                    await deleteContractApi(cid);
                }
            }

            if (onRefresh) {
                await onRefresh();
            }

            setSelectedIds(new Set());
            alert(`Đã xóa vĩnh viễn thành công ${count} ${targetTypeLabel} trùng lặp khỏi cơ sở dữ liệu.`);
        } catch (err) {
            console.error('Lỗi khi xóa trùng lặp:', err);
            alert('Đã xảy ra lỗi khi xóa: ' + (err as any)?.message);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-linear-to-r from-purple-700 via-indigo-700 to-blue-700 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md ring-1 ring-white/20">
                            <ShieldAlert className="text-amber-300" size={24} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                                Công cụ Quét & Xóa Hồ Sơ Trùng Lặp
                                <span className="bg-amber-400 text-slate-900 text-xs px-2.5 py-0.5 rounded-full font-extrabold shadow-xs">
                                    {totalDuplicateCount} bản trùng
                                </span>
                            </h2>
                            <p className="text-xs text-blue-100 mt-0.5">
                                Tự động so khớp Mã hồ sơ, Mã HĐ, Tên khách hàng & Thửa/Tờ để lọc bỏ bản sao dư thừa an toàn
                            </p>
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-colors cursor-pointer"
                        title="Đóng cửa sổ (Esc)"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Sub-Header Tabs & Quick Actions */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        {/* Tab Switcher */}
                        <div className="flex bg-slate-200 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setActiveTab('records')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    activeTab === 'records'
                                        ? 'bg-white text-purple-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>Hồ sơ Tiếp nhận</span>
                                <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded-full text-[11px] font-black">
                                    {recordDuplicateGroups.length}
                                </span>
                            </button>

                            {contracts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('contracts')}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'contracts'
                                            ? 'bg-white text-blue-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <span>Hợp đồng dịch vụ</span>
                                    <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[11px] font-black">
                                        {contractDuplicateGroups.length}
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* Search Input */}
                        <div className="relative w-48 sm:w-64">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Tìm theo mã hoặc tên..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                            />
                        </div>
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSelectAllDuplicates}
                            className="px-3 py-1.5 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                            <CheckSquare size={14} className="text-purple-600" />
                            <span>Chọn tất cả bản trùng</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleDeselectAll}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Square size={14} className="text-slate-500" />
                            <span>Bỏ chọn</span>
                        </button>
                    </div>
                </div>

                {/* Body Content / Duplicate Groups List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-100/70">
                    {filteredGroups.length === 0 ? (
                        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3 ring-8 ring-emerald-50/50">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">
                                Không phát hiện hồ sơ trùng lặp!
                            </h3>
                            <p className="text-xs text-slate-500 max-w-md">
                                Cơ sở dữ liệu hiện tại rất sạch sẽ. Tất cả các bản ghi đều có mã số và thông tin khách hàng độc lập, không có bản sao dư thừa.
                            </p>
                        </div>
                    ) : (
                        filteredGroups.map((group, gIdx) => (
                            <div 
                                key={group.groupId} 
                                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                            >
                                {/* Group Header */}
                                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-800">
                                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs">
                                            {gIdx + 1}
                                        </span>
                                        <span className="truncate">{group.title}</span>
                                        <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold ml-1">
                                            {group.items.length} bản ghi
                                        </span>
                                    </div>

                                    <span className="text-[11px] font-semibold text-slate-500">
                                        {group.groupType === 'CODE_NAME' ? 'Trùng Mã + Tên' : 'Trùng Tên + Thửa/Tờ'}
                                    </span>
                                </div>

                                {/* Items Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="p-3 w-10 text-center">Chọn</th>
                                                <th className="p-3 w-28 text-center">Vai trò</th>
                                                <th className="p-3">Mã số</th>
                                                <th className="p-3">Khách hàng</th>
                                                <th className="p-3">Thửa / Tờ / Xã</th>
                                                <th className="p-3">Ngày lập / Ngày nhận</th>
                                                <th className="p-3 text-right">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {group.items.map(item => {
                                                const isSelected = selectedIds.has(item.id);
                                                return (
                                                    <tr 
                                                        key={item.id} 
                                                        className={`transition-colors ${
                                                            item.isOriginal 
                                                                ? 'bg-emerald-50/40 hover:bg-emerald-50/70' 
                                                                : isSelected 
                                                                    ? 'bg-red-50/60 hover:bg-red-50' 
                                                                    : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <td className="p-3 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleItem(item.id)}
                                                                className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {item.isOriginal ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-extrabold text-[11px]">
                                                                    <CheckCircle2 size={11} className="text-emerald-700" />
                                                                    Bản gốc giữ lại
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-bold text-[11px]">
                                                                    Bản trùng thừa
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 font-bold text-slate-800">
                                                            {item.code}
                                                        </td>
                                                        <td className="p-3 font-medium text-slate-900">
                                                            {item.customerName}
                                                        </td>
                                                        <td className="p-3 text-slate-600">
                                                            {item.landPlot || item.mapSheet ? `Thửa: ${item.landPlot || '-'} / Tờ: ${item.mapSheet || '-'}` : '—'}
                                                            {item.ward && ` (${item.ward})`}
                                                        </td>
                                                        <td className="p-3 text-slate-500">
                                                            {item.receivedDate || item.createdDate || '—'}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSingle(item)}
                                                                disabled={isDeleting}
                                                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                                                                title="Xóa vĩnh viễn bản ghi này"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Action Bar */}
                <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-lg">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="font-bold text-slate-800">Đã chọn:</span>
                        <span className="bg-red-100 text-red-700 font-extrabold px-2 py-0.5 rounded-md text-xs border border-red-200">
                            {selectedIds.size} bản ghi cần xóa
                        </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleExecuteDeleteSelected}
                            disabled={selectedIds.size === 0 || isDeleting}
                            className="flex-1 sm:flex-none px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isDeleting ? (
                                <>
                                    <RefreshCw size={15} className="animate-spin" />
                                    <span>Đang xóa...</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 size={15} />
                                    <span>Xóa vĩnh viễn {selectedIds.size} bản ghi đã chọn</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DuplicateRecordsAuditModal;
