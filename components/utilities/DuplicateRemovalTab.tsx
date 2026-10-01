import React, { useState, useMemo } from 'react';
import { RecordFile, User, NotifyFunction } from '../../types';
import { deleteRecordsBatchApi } from '../../services/apiRecords';
import { confirmAction } from '../../utils/appHelpers';
import { Copy, Trash2, Search, CheckSquare, Square, RefreshCw, AlertTriangle, ShieldCheck, Database, Layers, CheckCircle2 } from 'lucide-react';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTable, setFilterTable] = useState<'ALL' | 'land_records' | 'dangky_records' | 'luutru_records'>('ALL');
    const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // Phát hiện và gom nhóm các hồ sơ bị trùng đồng thời 4 trường: Mã, Tên chủ, Số tờ, Số thửa
    const duplicateGroups: DuplicateGroup[] = useMemo(() => {
        const groupsMap = new Map<string, RecordFile[]>();

        for (const r of records) {
            // Lọc theo bảng nếu chọn
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
                // Sắp xếp bản ghi: ưu tiên bản ghi có nhiều thông tin hơn hoặc được tạo sớm hơn giữ lại
                const sorted = [...groupRecords].sort((a, b) => {
                    const timeA = new Date((a as any).createdAt || (a as any).created_at || a.receivedDate || 0).getTime();
                    const timeB = new Date((b as any).createdAt || (b as any).created_at || b.receivedDate || 0).getTime();
                    return timeA - timeB; // Bản ghi tạo trước lên đầu làm bản ghi gốc giữ lại
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

    // Lọc theo từ khóa tìm kiếm
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

    // Khởi tạo mặc định chọn tất cả các bản ghi trùng lặp (bản ghi phụ) để xóa
    React.useEffect(() => {
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

    // Đếm tổng số bản ghi trùng lặp cần xóa
    const totalDuplicatesCount = useMemo(() => {
        return duplicateGroups.reduce((acc, g) => acc + (g.records.length - 1), 0);
    }, [duplicateGroups]);

    const handleToggleSelectAll = () => {
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

    const handleToggleRecord = (id: string) => {
        setSelectedDeleteIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleExecuteDeleteBatch = async () => {
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
            {/* Header Toolbar */}
            <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                        <Copy size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <span>Công cụ Lọc & Loại Bỏ Hồ Sơ Trùng Lặp</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-black">
                                {filteredGroups.length} nhóm trùng ({totalDuplicatesCount} bản ghi thừa)
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Quét và loại bỏ chính xác các hồ sơ bị lặp đồng thời 4 trường: <strong>Mã HS + Tên chủ + Số tờ + Số thửa</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Bảng filter */}
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

                    {/* Search box */}
                    <div className="relative w-56">
                        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm mã, chủ sử dụng..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                        />
                    </div>

                    {/* Action delete button */}
                    <button
                        onClick={handleExecuteDeleteBatch}
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
                                <span>Xóa {selectedDeleteIds.size} Hồ Sơ Trùng Đã Chọn</span>
                            </>
                        )}
                    </button>
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
                                    onClick={handleToggleSelectAll}
                                    className="flex items-center gap-1.5 text-purple-700 hover:text-purple-900"
                                >
                                    {selectedDeleteIds.size > 0 ? (
                                        <CheckSquare size={16} className="text-purple-600" />
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
                                        <span className="font-bold text-purple-800">Mã: {group.code}</span>
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
                                                            onClick={() => handleToggleRecord(rec.id)}
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
    );
};
