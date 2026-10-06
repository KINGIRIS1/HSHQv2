import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RecordFile, User, NotifyFunction } from '../../types';
import { 
    deleteRecordsBatchApi, 
    scanEmptyRecordsInDatabaseDirect, 
    deleteEmptyRecordsDirectly, 
    EmptyRecordScanResult, 
    isEmptyOrInvalidRecord 
} from '../../services/apiRecords';
import { confirmAction } from '../../utils/appHelpers';
import { 
    Copy, Trash2, Search, CheckSquare, Square, RefreshCw, 
    AlertTriangle, ShieldCheck, Database, Layers, CheckCircle2,
    FileX2, Filter, AlertOctagon, Info, ChevronDown, ChevronRight, Eye
} from 'lucide-react';

interface DuplicateRemovalTabProps {
    records: RecordFile[];
    currentUser?: User;
    notify: NotifyFunction;
    onDeleteBatchRecords?: (ids: string[]) => Promise<boolean>;
    onRefreshData?: () => void | Promise<void>;
}

interface DuplicateGroup {
    groupKey: string;
    code: string;
    customerName: string;
    mapSheet: string;
    landPlot: string;
    records: RecordFile[];
    keepRecordId: string;
}

const normStr = (s?: string | number | null): string => {
    if (s === null || s === undefined) return '';
    return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
};

const normCode = (s?: string | number | null): string => {
    if (s === null || s === undefined) return '';
    return String(s).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const DuplicateRemovalTab: React.FC<DuplicateRemovalTabProps> = ({
    records = [],
    notify,
    onDeleteBatchRecords,
    onRefreshData
}) => {
    // Mode: 'DUPLICATE' (Lọc trùng lặp) hoặc 'EMPTY_RECORDS' (Hồ sơ không có thông tin)
    const [subMode, setSubMode] = useState<'DUPLICATE' | 'EMPTY_RECORDS'>('EMPTY_RECORDS');

    // --- STATE CHO PHẦN LỌC TRÙNG ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTable, setFilterTable] = useState<'ALL' | 'land_records' | 'dangky_records' | 'luutru_records'>('ALL');
    const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // --- STATE CHO PHẦN HỒ SƠ KHÔNG CÓ THÔNG TIN (HỒ SƠ RỖNG) ---
    const [isScanningEmpty, setIsScanningEmpty] = useState(false);
    const [emptyScanResults, setEmptyScanResults] = useState<EmptyRecordScanResult[]>([]);
    const [selectedEmptyIds, setSelectedEmptyIds] = useState<Set<string>>(new Set());
    const [emptyTableFilter, setEmptyTableFilter] = useState<'ALL' | 'land_records' | 'dangky_records' | 'luutru_records' | 'LOCAL'>('ALL');
    const [emptySearchTerm, setEmptySearchTerm] = useState('');
    const [isDeletingEmpty, setIsDeletingEmpty] = useState(false);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
    const [emptyStats, setEmptyStats] = useState({
        totalEmpty: 0,
        landCount: 0,
        dangkyCount: 0,
        luutruCount: 0,
        localCount: 0
    });

    const isScanningRef = React.useRef(false);
    const recordsRef = React.useRef(records);
    recordsRef.current = records;
    const notifyRef = React.useRef(notify);
    notifyRef.current = notify;

    // 1. Quét hồ sơ không có thông tin từ CSDL và Local State
    const handleScanEmptyRecords = useCallback(async (isManualTrigger = false) => {
        if (isScanningRef.current) return;
        isScanningRef.current = true;
        setIsScanningEmpty(true);
        try {
            const scan = await scanEmptyRecordsInDatabaseDirect(recordsRef.current);
            setEmptyScanResults(scan.results);
            setEmptyStats(scan.stats);
            // Mặc định chọn tất cả hồ sơ rác tìm được để người dùng dễ thao tác dọn dẹp
            setSelectedEmptyIds(new Set(scan.results.map(r => `${r.table}:${r.id}`)));
            if (isManualTrigger) {
                if (scan.results.length === 0) {
                    notifyRef.current("Không phát hiện hồ sơ rỗng/không có thông tin nào trong CSDL!", "success");
                } else {
                    notifyRef.current(`Đã quét xong: Phát hiện ${scan.results.length} hồ sơ không có thông tin cần xử lý.`, "info");
                }
            }
        } catch (err: any) {
            console.error("Scan empty records error:", err);
            if (isManualTrigger) {
                notifyRef.current(`Lỗi khi quét hồ sơ không có thông tin: ${err?.message || 'Lỗi không xác định'}`, "error");
            }
        } finally {
            setIsScanningEmpty(false);
            isScanningRef.current = false;
        }
    }, []);

    // Tự động quét hồ sơ không có thông tin đúng 1 lần khi mount
    useEffect(() => {
        handleScanEmptyRecords(false);
    }, [handleScanEmptyRecords]);

    // Lọc hồ sơ không có thông tin theo bộ lọc & từ khóa
    const filteredEmptyResults = useMemo(() => {
        return emptyScanResults.filter(r => {
            if (emptyTableFilter !== 'ALL' && r.table !== emptyTableFilter) return false;
            if (emptySearchTerm.trim()) {
                const term = emptySearchTerm.toLowerCase();
                const matchId = r.id.toLowerCase().includes(term);
                const matchCode = r.code.toLowerCase().includes(term);
                const matchName = r.customerName.toLowerCase().includes(term);
                const matchReason = r.reason.toLowerCase().includes(term);
                if (!matchId && !matchCode && !matchName && !matchReason) return false;
            }
            return true;
        });
    }, [emptyScanResults, emptyTableFilter, emptySearchTerm]);

    // Toggle chọn/bỏ chọn một hồ sơ rỗng
    const handleToggleEmptyRecord = (table: string, id: string) => {
        const key = `${table}:${id}`;
        setSelectedEmptyIds(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Toggle chọn tất cả hồ sơ rỗng
    const handleToggleAllEmpty = () => {
        const allKeys = filteredEmptyResults.map(r => `${r.table}:${r.id}`);
        const allSelected = allKeys.length > 0 && allKeys.every(k => selectedEmptyIds.has(k));
        if (allSelected) {
            setSelectedEmptyIds(new Set());
        } else {
            setSelectedEmptyIds(new Set(allKeys));
        }
    };

    // Thực thi XÓA hồ sơ không có thông tin khỏi CSDL
    const handleExecuteDeleteEmptyRecords = async () => {
        const itemsToDelete = emptyScanResults.filter(r => selectedEmptyIds.has(`${r.table}:${r.id}`));
        if (itemsToDelete.length === 0) {
            notify("Vui lòng chọn ít nhất một hồ sơ không có thông tin để xóa!", "info");
            return;
        }

        const idsToDelete = itemsToDelete.map(r => r.id);

        const confirm = await confirmAction(
            `CẢNH BÁO XÓA HỒ SƠ KHÔNG CÓ THÔNG TIN:\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN ${itemsToDelete.length} hồ sơ rỗng / không có thông tin khỏi CSDL Supabase và bộ nhớ không?\n\nThao tác này sẽ loại bỏ hoàn toàn các bản ghi rác và làm sạch CSDL.`,
            'Xác nhận loại bỏ hồ sơ rác'
        );
        if (!confirm) return;

        setIsDeletingEmpty(true);
        try {
            // 1. Xóa trong CSDL Supabase và Cache đệm
            const { successCount } = await deleteEmptyRecordsDirectly(
                itemsToDelete.map(r => ({ id: r.id, table: r.table }))
            );

            // 2. Xóa khỏi State cục bộ của React App nếu có
            if (onDeleteBatchRecords) {
                try {
                    await onDeleteBatchRecords(idsToDelete);
                } catch (batchErr) {
                    console.warn("[DELETE_EMPTY] Local state batch delete warning:", batchErr);
                }
            }

            // 3. Cập nhật danh sách UI ngay lập tức
            setEmptyScanResults(prev => prev.filter(r => !idsToDelete.includes(r.id)));
            setSelectedEmptyIds(new Set());

            notify(`Đã xóa thành công ${idsToDelete.length} hồ sơ không có thông tin khỏi hệ thống!`, 'success');

            if (onRefreshData) {
                await onRefreshData();
            }

            // 4. Quét lại để đồng bộ số liệu thống kê
            await handleScanEmptyRecords(false);
        } catch (err: any) {
            console.error("Delete empty records error:", err);
            notify(`Lỗi khi xóa hồ sơ không có thông tin: ${err?.message || 'Lỗi Supabase'}`, 'error');
        } finally {
            setIsDeletingEmpty(false);
        }
    };

    // --- PHẦN LỌC TRÙNG LẶP ---
    // Phát hiện và gom nhóm các hồ sơ bị trùng đồng thời 4 trường: Mã, Tên chủ, Số tờ, Số thửa
    const duplicateGroups: DuplicateGroup[] = useMemo(() => {
        const groupsMap = new Map<string, RecordFile[]>();

        for (const r of records) {
            if (filterTable !== 'ALL') {
                if (r.sourceTable && r.sourceTable !== filterTable) continue;
            }

            const cCode = normCode(r.code);
            const cName = normStr(r.customerName);
            const cMap = normStr(r.mapSheet);
            const cPlot = normStr(r.landPlot);

            // Bắt buộc phải có thông tin ít nhất mã và tên
            if (!cCode || !cName) continue;

            const groupKey = `${cCode}__${cName}__${cMap}__${cPlot}`;
            
            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, []);
            }
            groupsMap.get(groupKey)!.push(r);
        }

        const result: DuplicateGroup[] = [];

        groupsMap.forEach((groupRecords, key) => {
            if (groupRecords.length > 1) {
                const sorted = [...groupRecords].sort((a, b) => {
                    const timeA = new Date((a as any).createdAt || (a as any).created_at || a.receivedDate || 0).getTime();
                    const timeB = new Date((b as any).createdAt || (b as any).created_at || b.receivedDate || 0).getTime();
                    return timeA - timeB;
                });

                const first = sorted[0];

                result.push({
                    groupKey: key,
                    code: first.code || '--',
                    customerName: first.customerName || '--',
                    mapSheet: String(first.mapSheet || '--'),
                    landPlot: String(first.landPlot || '--'),
                    records: sorted,
                    keepRecordId: first.id
                });
            }
        });

        return result;
    }, [records, filterTable]);

    const filteredGroups = useMemo(() => {
        if (!searchTerm.trim()) return duplicateGroups;
        const lower = searchTerm.toLowerCase();
        return duplicateGroups.filter(g => 
            g.code.toLowerCase().includes(lower) ||
            g.customerName.toLowerCase().includes(lower) ||
            g.mapSheet.includes(lower) ||
            g.landPlot.includes(lower)
        );
    }, [duplicateGroups, searchTerm]);

    useEffect(() => {
        const defaultDeleteSet = new Set<string>();
        duplicateGroups.forEach(g => {
            g.records.forEach(r => {
                if (r.id !== g.keepRecordId) {
                    defaultDeleteSet.add(r.id);
                }
            });
        });
        setSelectedDeleteIds(defaultDeleteSet);
    }, [duplicateGroups]);

    const totalDuplicatesCount = useMemo(() => {
        return duplicateGroups.reduce((acc, g) => acc + (g.records.length - 1), 0);
    }, [duplicateGroups]);

    const handleToggleSelectAllDuplicates = () => {
        const allDuplicateIds = new Set<string>();
        filteredGroups.forEach(g => {
            g.records.forEach(r => {
                if (r.id !== g.keepRecordId) {
                    allDuplicateIds.add(r.id);
                }
            });
        });

        if (selectedDeleteIds.size >= allDuplicateIds.size && allDuplicateIds.size > 0) {
            setSelectedDeleteIds(new Set());
        } else {
            setSelectedDeleteIds(allDuplicateIds);
        }
    };

    const handleToggleDuplicateRecord = (id: string) => {
        setSelectedDeleteIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleExecuteDeleteDuplicates = async () => {
        if (selectedDeleteIds.size === 0) {
            notify("Vui lòng chọn ít nhất một hồ sơ trùng lặp để xóa!", "info");
            return;
        }

        const confirm = await confirmAction(
            `CẢNH BÁO XÓA DỮ LIỆU TRÙNG LẶP:\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN ${selectedDeleteIds.size} hồ sơ trùng lặp đã chọn khỏi cơ sở dữ liệu không?\n\nChỉ các bản ghi phụ bị trùng mới bị xóa, bản ghi gốc giữ lại vẫn sẽ được bảo lưu an toàn.`,
            'Xác nhận xóa hồ sơ trùng lặp'
        );
        if (!confirm) return;

        setIsDeleting(true);
        const idsToDelete = Array.from(selectedDeleteIds);

        try {
            let success = false;
            if (onDeleteBatchRecords) {
                success = await onDeleteBatchRecords(idsToDelete);
            } else {
                success = await deleteRecordsBatchApi(idsToDelete);
            }

            if (success) {
                notify(`Đã xóa thành công ${idsToDelete.length} hồ sơ trùng lặp khỏi hệ thống!`, 'success');
                if (onRefreshData) {
                    await onRefreshData();
                }
            } else {
                notify("Không thể xóa hoàn toàn một số bản ghi. Vui lòng thử lại.", "error");
            }
        } catch (err: any) {
            console.error("Execute duplicate delete error:", err);
            notify(`Lỗi khi xóa hồ sơ trùng: ${err?.message || 'Lỗi Supabase'}`, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-hidden">
            {/* Main Tabs Switcher Header */}
            <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSubMode('EMPTY_RECORDS')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                            subMode === 'EMPTY_RECORDS'
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <FileX2 size={16} />
                        <span>Loại Bỏ Hồ Sơ Không Có Thông Tin (Hồ sơ rỗng)</span>
                        {emptyScanResults.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                subMode === 'EMPTY_RECORDS' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                                {emptyScanResults.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setSubMode('DUPLICATE')}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                            subMode === 'DUPLICATE'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <Copy size={16} />
                        <span>Lọc & Loại Bỏ Hồ Sơ Trùng Lặp</span>
                        {totalDuplicatesCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                subMode === 'DUPLICATE' ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                                {totalDuplicatesCount}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {subMode === 'EMPTY_RECORDS' ? (
                        <>
                            <button
                                onClick={() => handleScanEmptyRecords(true)}
                                disabled={isScanningEmpty}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-300 cursor-pointer"
                                title="Quét lại toàn bộ CSDL Supabase và bộ nhớ ứng dụng"
                            >
                                <RefreshCw size={14} className={isScanningEmpty ? 'animate-spin text-blue-600' : ''} />
                                <span>{isScanningEmpty ? 'Đang quét CSDL...' : 'Quét lại CSDL'}</span>
                            </button>

                            <button
                                onClick={handleExecuteDeleteEmptyRecords}
                                disabled={isDeletingEmpty || selectedEmptyIds.size === 0}
                                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isDeletingEmpty ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        <span>Đang xóa khỏi CSDL...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={15} />
                                        <span>Xóa {selectedEmptyIds.size} Hồ Sơ Không Có Thông Tin</span>
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleExecuteDeleteDuplicates}
                            disabled={isDeleting || selectedDeleteIds.size === 0}
                            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {isDeleting ? (
                                <>
                                    <RefreshCw size={15} className="animate-spin" />
                                    <span>Đang xóa...</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 size={15} />
                                    <span>Xóa {selectedDeleteIds.size} Hồ Sơ Trùng</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* SUB-VIEW 1: HỒ SƠ KHÔNG CÓ THÔNG TIN (HỒ SƠ RỖNG / RÁC TRONG CSDL) */}
            {subMode === 'EMPTY_RECORDS' && (
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                    {/* Stat Badges and Filters */}
                    <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Bộ lọc bảng:</span>
                            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold border border-slate-200">
                                <button
                                    onClick={() => setEmptyTableFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${emptyTableFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Tất cả ({emptyStats.totalEmpty})
                                </button>
                                <button
                                    onClick={() => setEmptyTableFilter('land_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${emptyTableFilter === 'land_records' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Đo đạc ({emptyStats.landCount})
                                </button>
                                <button
                                    onClick={() => setEmptyTableFilter('dangky_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${emptyTableFilter === 'dangky_records' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Cấp giấy ({emptyStats.dangkyCount})
                                </button>
                                <button
                                    onClick={() => setEmptyTableFilter('luutru_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${emptyTableFilter === 'luutru_records' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Lưu trữ ({emptyStats.luutruCount})
                                </button>
                            </div>
                        </div>

                        {/* Search in empty records */}
                        <div className="relative w-64">
                            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo ID, mã, lý do..."
                                value={emptySearchTerm}
                                onChange={e => setEmptySearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                            />
                        </div>
                    </div>

                    {/* Content List */}
                    <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                        {isScanningEmpty ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-500">
                                <RefreshCw className="text-blue-600 animate-spin mb-3" size={40} />
                                <h3 className="text-sm font-bold text-slate-700">Đang quét toàn bộ CSDL Supabase & Bộ nhớ...</h3>
                                <p className="text-xs text-slate-400 mt-1">Hệ thống đang kiểm tra cả 3 bảng `land_records`, `dangky_records`, `luutru_records` để phát hiện các bản ghi rỗng.</p>
                            </div>
                        ) : filteredEmptyResults.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-500">
                                <ShieldCheck className="text-emerald-500 mb-3" size={48} />
                                <h3 className="text-base font-bold text-slate-700">Tuyệt vời! Không có hồ sơ rỗng / không có thông tin nào.</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-md">
                                    Cơ sở dữ liệu Supabase và bộ nhớ cục bộ của bạn hoàn toàn chuẩn hóa, không có bản ghi rác.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Header action bar */}
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                    <button 
                                        onClick={handleToggleAllEmpty}
                                        className="flex items-center gap-1.5 text-rose-700 hover:text-rose-900"
                                    >
                                        {filteredEmptyResults.length > 0 && filteredEmptyResults.every(r => selectedEmptyIds.has(`${r.table}:${r.id}`)) ? (
                                            <CheckSquare size={16} className="text-rose-600" />
                                        ) : (
                                            <Square size={16} className="text-slate-400" />
                                        )}
                                        <span>Chọn / Bỏ chọn tất cả {filteredEmptyResults.length} hồ sơ rỗng hiển thị</span>
                                    </button>
                                    <div className="text-slate-600">
                                        Đã chọn <strong className="text-rose-600">{selectedEmptyIds.size}</strong> / {emptyScanResults.length} hồ sơ để xóa
                                    </div>
                                </div>

                                {/* Records items */}
                                {filteredEmptyResults.map((item, idx) => {
                                    const key = `${item.table}:${item.id}`;
                                    const isSelected = selectedEmptyIds.has(key);
                                    const isExpanded = expandedRecordId === key;

                                    return (
                                        <div 
                                            key={key}
                                            className={`border rounded-xl transition-all shadow-2xs overflow-hidden ${
                                                isSelected ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="p-3 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => handleToggleEmptyRecord(item.table, item.id)}
                                                        className="text-rose-600 hover:text-rose-800 shrink-0"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare size={18} className="text-rose-600" />
                                                        ) : (
                                                            <Square size={18} className="text-slate-300 hover:text-slate-500" />
                                                        )}
                                                    </button>

                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="font-mono font-bold text-xs text-slate-800">
                                                                ID: {item.id}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                item.table === 'land_records' ? 'bg-blue-100 text-blue-800' :
                                                                item.table === 'dangky_records' ? 'bg-emerald-100 text-emerald-800' :
                                                                item.table === 'luutru_records' ? 'bg-purple-100 text-purple-800' :
                                                                'bg-slate-100 text-slate-800'
                                                            }`}>
                                                                {item.table}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1">
                                                                <AlertOctagon size={11} /> {item.reason}
                                                            </span>
                                                        </div>

                                                        <div className="text-[11px] text-slate-500 flex items-center gap-4 mt-1">
                                                            <span>Mã HS: <strong className="text-slate-700">{item.code}</strong></span>
                                                            <span>Chủ SD: <strong className="text-slate-700">{item.customerName}</strong></span>
                                                            {item.createdAt && (
                                                                <span>Thời gian: {String(item.createdAt).split('T')[0]}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setExpandedRecordId(isExpanded ? null : key)}
                                                        className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-all"
                                                        title="Xem dữ liệu thô chi tiết của bản ghi"
                                                    >
                                                        <Eye size={13} />
                                                        <span>{isExpanded ? 'Đóng' : 'Chi tiết'}</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Collapsible raw data inspector */}
                                            {isExpanded && (
                                                <div className="border-t border-slate-200 bg-slate-900 text-slate-200 p-3 text-[11px] font-mono overflow-x-auto">
                                                    <div className="text-slate-400 font-bold mb-1 flex items-center justify-between">
                                                        <span>Dữ liệu thô Supabase ({item.table}):</span>
                                                        <span className="text-[10px] text-rose-400">Lý do rác: {item.reason}</span>
                                                    </div>
                                                    <pre className="whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                        {JSON.stringify(item.rawRecord, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SUB-VIEW 2: LỌC TRÙNG HỒ SƠ */}
            {subMode === 'DUPLICATE' && (
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                    {/* Header Toolbar */}
                    <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Phân hệ:</span>
                            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold border border-slate-200">
                                <button
                                    onClick={() => setFilterTable('ALL')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${filterTable === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Tất cả phân hệ
                                </button>
                                <button
                                    onClick={() => setFilterTable('land_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${filterTable === 'land_records' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Đo đạc
                                </button>
                                <button
                                    onClick={() => setFilterTable('dangky_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${filterTable === 'dangky_records' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Cấp giấy
                                </button>
                                <button
                                    onClick={() => setFilterTable('luutru_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${filterTable === 'luutru_records' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Lưu trữ
                                </button>
                            </div>
                        </div>

                        {/* Search box */}
                        <div className="relative w-64">
                            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm mã, chủ sử dụng..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* List duplicate groups */}
                    <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                        {filteredGroups.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-500">
                                <ShieldCheck className="text-emerald-500 mb-3" size={48} />
                                <h3 className="text-base font-bold text-slate-700">Tuyệt vời! Không phát hiện hồ sơ trùng lặp nào.</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-md">
                                    Cơ sở dữ liệu của bạn hoàn toàn sạch sẽ, không có bất kỳ cặp hồ sơ nào bị trùng đồng thời cả Mã, Chủ sử dụng, Tờ và Thửa.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={handleToggleSelectAllDuplicates}
                                            className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900"
                                        >
                                            {selectedDeleteIds.size > 0 ? (
                                                <CheckSquare size={16} className="text-indigo-600" />
                                            ) : (
                                                <Square size={16} className="text-slate-400" />
                                            )}
                                            <span>Chọn / Bỏ chọn tất cả các bản ghi trùng lặp</span>
                                        </button>
                                    </div>
                                    <div>
                                        Đã chọn <strong className="text-rose-600">{selectedDeleteIds.size}</strong> hồ sơ để xóa
                                    </div>
                                </div>

                                {filteredGroups.map((group, groupIdx) => (
                                    <div key={group.groupKey} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                                        <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">
                                                    {groupIdx + 1}
                                                </span>
                                                <span className="font-bold text-indigo-800">Mã: {group.code}</span>
                                                <span className="text-slate-300">|</span>
                                                <span className="text-slate-800 font-bold">Chủ: {group.customerName}</span>
                                                <span className="text-slate-300">|</span>
                                                <span className="text-slate-600 font-mono">Tờ {group.mapSheet} / Thửa {group.landPlot}</span>
                                            </div>
                                            <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                                                {group.records.length} bản ghi bị trùng
                                            </span>
                                        </div>

                                        <div className="divide-y divide-slate-100 text-xs">
                                            {group.records.map((rec) => {
                                                const isKeep = rec.id === group.keepRecordId;
                                                const isSelectedForDelete = selectedDeleteIds.has(rec.id);

                                                return (
                                                    <div 
                                                        key={rec.id}
                                                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                                                            isKeep 
                                                                ? 'bg-emerald-50/40 hover:bg-emerald-50/70' 
                                                                : isSelectedForDelete 
                                                                    ? 'bg-rose-50/40 hover:bg-rose-50/70' 
                                                                    : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {!isKeep ? (
                                                                <button 
                                                                    onClick={() => handleToggleDuplicateRecord(rec.id)}
                                                                    className="text-rose-600 hover:text-rose-800"
                                                                    title="Tick chọn để xóa bản ghi trùng này"
                                                                >
                                                                    {isSelectedForDelete ? (
                                                                        <CheckSquare size={18} className="text-rose-600" />
                                                                    ) : (
                                                                        <Square size={18} className="text-slate-300 hover:text-slate-500" />
                                                                    )}
                                                                </button>
                                                            ) : (
                                                                <span title="Bản ghi gốc được giữ lại">
                                                                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                                                </span>
                                                            )}

                                                            <div>
                                                                <div className="flex items-center gap-2 font-bold">
                                                                    <span className="text-slate-800">{rec.code}</span>
                                                                    {isKeep ? (
                                                                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                                                                            BẢN GHI GIỮ LẠI (GỐC)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-200">
                                                                            BẢN GHI TRÙNG THỪA
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[11px] text-slate-500 font-normal">
                                                                        ({rec.sourceTable || 'land_records'})
                                                                    </span>
                                                                </div>
                                                                <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-3">
                                                                    <span>Chủ: <strong>{rec.customerName}</strong></span>
                                                                    <span>Xã/Phường: <strong>{rec.ward || '--'}</strong></span>
                                                                    <span>Tờ/Thửa: <strong>{rec.mapSheet}/{rec.landPlot}</strong></span>
                                                                    {rec.receivedDate && <span>Nhận: {rec.receivedDate.split('T')[0]}</span>}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0 font-mono text-[11px]">
                                                            <div className="text-slate-600 font-medium">Trạng thái: {rec.status || 'Chưa cập nhật'}</div>
                                                            <div className="text-slate-400 text-[10px]">ID: {rec.id.substring(0, 8)}...</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
