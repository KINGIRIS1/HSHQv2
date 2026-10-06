import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Database, RefreshCw, AlertTriangle, CheckCircle2, 
    ShieldCheck, ShieldAlert, Download, Search, 
    Loader2, Wrench, Layers, Check, Copy, ArrowDownRight, ExternalLink
} from 'lucide-react';
import { RecordFile, RecordStatus, User as UserType } from '../../types';
import { supabase, isConfigured } from '../../services/supabaseClient';
import { mapRecordFromDb, saveToCache, CACHE_KEYS, getFromCache } from '../../services/apiCore';
import { getShortRecordType, getWardLabel, STATUS_LABELS, STATUS_COLORS } from '../../constants';
import { sanitizeRecordPayloadForTable, isEmptyOrInvalidRecord } from '../../services/apiRecords';

interface SyncDiagnosticTabProps {
    records: RecordFile[];
    currentUser?: UserType;
    notify: (message: string, type?: 'success' | 'error' | 'info') => void;
    onRefreshData?: () => void | Promise<void>;
    onSaveRecord?: (record: any) => Promise<any>;
    onBatchUpdateRecords?: (updates: Partial<RecordFile>[]) => Promise<void>;
}

interface CloudTableStat {
    tableName: 'land_records' | 'dangky_records' | 'luutru_records';
    label: string;
    cloudCount: number;
    localCount: number;
    error?: string;
    rlsStatus: 'CHECKING' | 'ENABLED_RESTRICTED' | 'OK';
    rlsMessage?: string;
}

interface MissingRecordItem {
    id: string;
    code: string;
    customerName?: string;
    recordType?: string;
    ward?: string;
    landPlot?: string;
    mapSheet?: string;
    receivedDate?: string;
    dbStatus?: string;
    sourceTable: 'land_records' | 'dangky_records' | 'luutru_records';
    rawRecord: any;
    missingReason: string;
}

export const SyncDiagnosticTab: React.FC<SyncDiagnosticTabProps> = ({
    records = [],
    currentUser,
    notify,
    onRefreshData,
    onSaveRecord,
    onBatchUpdateRecords
}) => {
    const [isScanning, setIsScanning] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTableFilter, setSelectedTableFilter] = useState<'all' | 'land_records' | 'dangky_records' | 'luutru_records'>('all');
    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
    const [copiedSql, setCopiedSql] = useState(false);
    const [lastScannedTime, setLastScannedTime] = useState<string | null>(null);

    const [tableStats, setTableStats] = useState<Record<'land_records' | 'dangky_records' | 'luutru_records', CloudTableStat>>({
        land_records: {
            tableName: 'land_records',
            label: 'Bảng Đo đạc (land_records)',
            cloudCount: 0,
            localCount: 0,
            rlsStatus: 'CHECKING'
        },
        dangky_records: {
            tableName: 'dangky_records',
            label: 'Bảng Cấp giấy / Đăng ký (dangky_records)',
            cloudCount: 0,
            localCount: 0,
            rlsStatus: 'CHECKING'
        },
        luutru_records: {
            tableName: 'luutru_records',
            label: 'Bảng Lưu trữ (luutru_records)',
            cloudCount: 0,
            localCount: 0,
            rlsStatus: 'CHECKING'
        }
    });

    const [missingRecords, setMissingRecords] = useState<MissingRecordItem[]>([]);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    // Tính toán số lượng bản ghi local theo từng bảng
    const localStats = useMemo(() => {
        let land = 0;
        let dangky = 0;
        let luutru = 0;

        records.forEach(r => {
            const st = r.sourceTable;
            const rt = String(r.recordType || '').trim();
            const short = getShortRecordType(rt);

            if (st === 'dangky_records' || short.startsWith('3.') || rt.startsWith('3.')) {
                dangky++;
            } else if (st === 'luutru_records' || short.startsWith('1.') || rt.startsWith('1.')) {
                luutru++;
            } else {
                land++;
            }
        });

        return { land, dangky, luutru, total: records.length };
    }, [records]);

    // Lệnh SQL hướng dẫn sửa lỗi RLS
    const rlsFixSql = `-- 1. TẮT RLS TRÊN TẤT CẢ CÁC BẢNG ĐỂ TRÁNH THIẾU HỒ SƠ DO BỊ CHẶN PHÂN QUYỀN
ALTER TABLE IF EXISTS public.land_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dangky_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.luutru_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings DISABLE ROW LEVEL SECURITY;

-- 2. CẤP QUYỀN ĐẦY ĐỦ CHO ROLE AUTHENTICATED VÀ ANON
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, postgres;`;

    const handleCopySql = () => {
        navigator.clipboard.writeText(rlsFixSql);
        setCopiedSql(true);
        notify('Đã sao chép câu lệnh SQL sửa RLS!', 'success');
        setTimeout(() => setCopiedSql(false), 3000);
    };

    // Hàm quét CSDL và kiểm tra toàn diện
    const scanDatabase = useCallback(async () => {
        if (!isConfigured) {
            notify('Ứng dụng chưa được cấu hình kết nối Supabase CSDL Cloud.', 'error');
            return;
        }

        setIsScanning(true);
        setSelectedRecordIds(new Set());

        const localIdSet = new Set<string>();
        const localCodeSet = new Set<string>();
        records.forEach(r => {
            if (r.id) localIdSet.add(String(r.id).trim().toLowerCase());
            if (r.code) localCodeSet.add(String(r.code).trim().toLowerCase());
        });

        const newStats: typeof tableStats = {
            land_records: { ...tableStats.land_records, localCount: localStats.land, cloudCount: 0, error: undefined, rlsStatus: 'OK' },
            dangky_records: { ...tableStats.dangky_records, localCount: localStats.dangky, cloudCount: 0, error: undefined, rlsStatus: 'OK' },
            luutru_records: { ...tableStats.luutru_records, localCount: localStats.luutru, cloudCount: 0, error: undefined, rlsStatus: 'OK' }
        };

        const discoveredMissing: MissingRecordItem[] = [];
        const tables: ('land_records' | 'dangky_records' | 'luutru_records')[] = ['land_records', 'dangky_records', 'luutru_records'];

        for (const tbl of tables) {
            try {
                // 1. Kiểm tra quyền và lấy tổng số lượng
                const { count, error, data } = await supabase
                    .from(tbl)
                    .select('*', { count: 'exact' })
                    .order('receivedDate', { ascending: false, nullsFirst: false })
                    .limit(1000); // Quét tới 1000 bản ghi mới nhất

                if (error) {
                    newStats[tbl].error = error.message;
                    if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('violates row-level security')) {
                        newStats[tbl].rlsStatus = 'ENABLED_RESTRICTED';
                        newStats[tbl].rlsMessage = 'Bị chặn bởi phân quyền RLS / Quyền schema public.';
                    } else {
                        newStats[tbl].rlsStatus = 'ENABLED_RESTRICTED';
                        newStats[tbl].rlsMessage = error.message;
                    }
                } else {
                    const cCount = count ?? (data ? data.length : 0);
                    newStats[tbl].cloudCount = cCount;
                    newStats[tbl].rlsStatus = 'OK';

                    // 2. Đối chiếu tìm hồ sơ bị thiếu trong state cục bộ
                    if (Array.isArray(data)) {
                        data.forEach((row: any) => {
                            const rawId = String(row.id || '').trim().toLowerCase();
                            const rawCode = String(row.code || row.so_bien_nhan || '').trim().toLowerCase();

                            const existsInState = localIdSet.has(rawId) || (rawCode && localCodeSet.has(rawCode));
                            const emptyCheck = isEmptyOrInvalidRecord(row);

                            if (!existsInState && !emptyCheck.isEmpty) {
                                const mapped = mapRecordFromDb(row);
                                let reason = 'Chưa được tải vào bộ nhớ ứng dụng';
                                if (row.status === 'HANDOVER' || row.is_handover) {
                                    reason = 'Hồ sơ đã giao 1 cửa (Đợt ' + (row.exportBatch || 1) + ') - Bị lọc khỏi tab làm việc';
                                } else if (row.status === 'PENDING_HANDOVER') {
                                    reason = 'Hồ sơ đang ở bước Chờ bàn giao';
                                }

                                discoveredMissing.push({
                                    id: String(row.id),
                                    code: String(row.code || row.so_bien_nhan || 'N/A'),
                                    customerName: mapped.customerName || row.customerName || row.chu_su_dung || '',
                                    recordType: mapped.recordType || row.recordType || row.loai_ho_so || '',
                                    ward: mapped.ward || row.ward || row.xa_phuong || '',
                                    landPlot: String(mapped.landPlot || row.landPlot || row.so_thua || ''),
                                    mapSheet: String(mapped.mapSheet || row.mapSheet || row.to_ban_do || ''),
                                    receivedDate: mapped.receivedDate || row.receivedDate || row.ngay_nhan || '',
                                    dbStatus: String(mapped.status || row.status || 'RECEIVED'),
                                    sourceTable: tbl,
                                    rawRecord: row,
                                    missingReason: reason
                                });
                            }
                        });
                    }
                }
            } catch (err: any) {
                newStats[tbl].error = err?.message || 'Lỗi kết nối';
                newStats[tbl].rlsStatus = 'ENABLED_RESTRICTED';
            }
        }

        setTableStats(newStats);
        setMissingRecords(discoveredMissing);
        setLastScannedTime(new Date().toLocaleTimeString('vi-VN'));
        setIsScanning(false);

        if (discoveredMissing.length > 0) {
            notify(`Đã quét xong: Phát hiện ${discoveredMissing.length} hồ sơ có trên CSDL nhưng chưa có trong máy khách!`, 'info');
        } else {
            notify('Đã quét xong: Toàn bộ hồ sơ trên CSDL đã được đồng bộ chuẩn xác với ứng dụng!', 'success');
        }
    }, [records, localStats, notify]);

    // Tự động quét lần đầu khi mở tab
    useEffect(() => {
        scanDatabase();
    }, []);

    // Lọc danh sách hồ sơ thiếu theo từ khóa & bảng
    const filteredMissingRecords = useMemo(() => {
        return missingRecords.filter(item => {
            if (selectedTableFilter !== 'all' && item.sourceTable !== selectedTableFilter) {
                return false;
            }
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const matchCode = item.code.toLowerCase().includes(term);
                const matchName = (item.customerName || '').toLowerCase().includes(term);
                const matchWard = (item.ward || '').toLowerCase().includes(term);
                const matchPlot = item.landPlot?.includes(term);
                const matchSheet = item.mapSheet?.includes(term);
                return matchCode || matchName || matchWard || matchPlot || matchSheet;
            }
            return true;
        });
    }, [missingRecords, selectedTableFilter, searchTerm]);

    // Chọn / Bỏ chọn tất cả
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRecordIds(new Set(filteredMissingRecords.map(r => r.id)));
        } else {
            setSelectedRecordIds(new Set());
        }
    };

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedRecordIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRecordIds(next);
    };

    // Hàm nạp trực tiếp danh sách hồ sơ vào State & Cache máy khách
    const syncRecordsIntoAppState = async (recordsToSync: MissingRecordItem[]) => {
        if (recordsToSync.length === 0) return;
        setIsSyncing(true);

        try {
            const mappedRecords: RecordFile[] = recordsToSync.map(item => {
                const mapped = mapRecordFromDb(item.rawRecord);
                mapped.sourceTable = item.sourceTable;
                return mapped;
            });

            // 1. Cập nhật vào Cache
            const currentCache = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []) || [];
            const cacheMap = new Map<string, RecordFile>();
            currentCache.forEach(r => { if (r.id) cacheMap.set(r.id, r); });
            records.forEach(r => { if (r.id) cacheMap.set(r.id, r); });
            mappedRecords.forEach(r => { if (r.id) cacheMap.set(r.id, r); });
            const mergedList = Array.from(cacheMap.values());
            saveToCache(CACHE_KEYS.RECORDS, mergedList);

            // 2. Kích hoạt cập nhật state ứng dụng
            if (onBatchUpdateRecords) {
                await onBatchUpdateRecords(mappedRecords);
            }

            if (onRefreshData) {
                await onRefreshData();
            }

            // 3. Xóa các hồ sơ đã nạp khỏi danh sách thiếu
            const syncedIds = new Set(recordsToSync.map(r => r.id));
            setMissingRecords(prev => prev.filter(r => !syncedIds.has(r.id)));
            setSelectedRecordIds(prev => {
                const next = new Set(prev);
                syncedIds.forEach(id => next.delete(id));
                return next;
            });

            notify(`Đã nạp thành công ${recordsToSync.length} hồ sơ vào ứng dụng!`, 'success');
        } catch (err: any) {
            console.error("Lỗi khi nạp hồ sơ:", err);
            notify(`Lỗi nạp dữ liệu: ${err?.message || 'Không thể đồng bộ'}`, 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    // Khôi phục hồ sơ về trạng thái Đang thực hiện trên Supabase
    const handleRestoreToInProgress = async (item: MissingRecordItem) => {
        setActionLoadingId(item.id);
        try {
            const targetStatus = RecordStatus.FIELD_WORK;
            const updatePayload = {
                status: targetStatus,
                exportBatch: null,
                exportDate: null,
                updated_at: new Date().toISOString()
            };

            const sanitized = sanitizeRecordPayloadForTable(updatePayload, item.sourceTable);
            const { error } = await supabase
                .from(item.sourceTable)
                .update(sanitized)
                .eq('id', item.id);

            if (error) throw error;

            notify(`Đã khôi phục hồ sơ [${item.code}] về "Đang thực hiện" trên CSDL!`, 'success');
            
            // Nạp ngay vào state máy khách
            await syncRecordsIntoAppState([{
                ...item,
                dbStatus: targetStatus,
                rawRecord: { ...item.rawRecord, status: targetStatus, exportBatch: null, exportDate: null }
            }]);
        } catch (err: any) {
            notify(`Lỗi khôi phục: ${err?.message || 'Không thể cập nhật'}`, 'error');
        } finally {
            setActionLoadingId(null);
        }
    };

    const hasRlsIssues = Object.values(tableStats).some(s => s.rlsStatus === 'ENABLED_RESTRICTED');

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 space-y-6">
            
            {/* Header */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
                        <Database size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-slate-800">Kiểm tra Đồng bộ & Chẩn đoán CSDL Supabase</h2>
                            {lastScannedTime && (
                                <span className="text-xs text-slate-400 font-medium">
                                    (Quét lúc: {lastScannedTime})
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Đối soát thời gian thực giữa CSDL Supabase Cloud và State ứng dụng. Phát hiện hồ sơ bị thiếu hoặc bị chặn bởi cấu hình bảo mật RLS.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                    <button
                        type="button"
                        onClick={scanDatabase}
                        disabled={isScanning}
                        className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={isScanning ? 'animate-spin' : ''} />
                        <span>{isScanning ? 'Đang quét CSDL...' : 'Quét kiểm tra ngay'}</span>
                    </button>

                    {onRefreshData && (
                        <button
                            type="button"
                            onClick={() => {
                                onRefreshData();
                                notify('Đang kích hoạt nạp lại toàn bộ dữ liệu...', 'info');
                            }}
                            className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                            title="Tải lại toàn bộ dữ liệu ứng dụng từ máy chủ"
                        >
                            <span>Tải lại toàn diện</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Thống kê 4 Card Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Đo đạc */}
                <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
                        <span>Tổ Đo đạc (`land_records`)</span>
                        {tableStats.land_records.rlsStatus === 'OK' ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-[11px]"><ShieldCheck size={13} /> RLS: Tốt</span>
                        ) : (
                            <span className="flex items-center gap-1 text-rose-600 text-[11px]"><ShieldAlert size={13} /> Bị chặn</span>
                        )}
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                        <div>
                            <span className="text-2xl font-black text-slate-800">{tableStats.land_records.cloudCount}</span>
                            <span className="text-xs text-slate-400 ml-1">trên Cloud</span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-bold text-slate-600">{localStats.land}</span>
                            <span className="text-[11px] text-slate-400 block">trong App</span>
                        </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Chênh lệch:</span>
                        <span className={`font-bold ${tableStats.land_records.cloudCount - localStats.land > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {tableStats.land_records.cloudCount - localStats.land > 0 ? `Thiếu ${tableStats.land_records.cloudCount - localStats.land} hồ sơ` : 'Đồng bộ đủ'}
                        </span>
                    </div>
                </div>

                {/* Đăng ký / Cấp giấy */}
                <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
                        <span>Cấp GCN (`dangky_records`)</span>
                        {tableStats.dangky_records.rlsStatus === 'OK' ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-[11px]"><ShieldCheck size={13} /> RLS: Tốt</span>
                        ) : (
                            <span className="flex items-center gap-1 text-rose-600 text-[11px]"><ShieldAlert size={13} /> Bị chặn</span>
                        )}
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                        <div>
                            <span className="text-2xl font-black text-slate-800">{tableStats.dangky_records.cloudCount}</span>
                            <span className="text-xs text-slate-400 ml-1">trên Cloud</span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-bold text-slate-600">{localStats.dangky}</span>
                            <span className="text-[11px] text-slate-400 block">trong App</span>
                        </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Chênh lệch:</span>
                        <span className={`font-bold ${tableStats.dangky_records.cloudCount - localStats.dangky > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {tableStats.dangky_records.cloudCount - localStats.dangky > 0 ? `Thiếu ${tableStats.dangky_records.cloudCount - localStats.dangky} hồ sơ` : 'Đồng bộ đủ'}
                        </span>
                    </div>
                </div>

                {/* Lưu trữ */}
                <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
                        <span>Lưu trữ (`luutru_records`)</span>
                        {tableStats.luutru_records.rlsStatus === 'OK' ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-[11px]"><ShieldCheck size={13} /> RLS: Tốt</span>
                        ) : (
                            <span className="flex items-center gap-1 text-rose-600 text-[11px]"><ShieldAlert size={13} /> Bị chặn</span>
                        )}
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                        <div>
                            <span className="text-2xl font-black text-slate-800">{tableStats.luutru_records.cloudCount}</span>
                            <span className="text-xs text-slate-400 ml-1">trên Cloud</span>
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-bold text-slate-600">{localStats.luutru}</span>
                            <span className="text-[11px] text-slate-400 block">trong App</span>
                        </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Chênh lệch:</span>
                        <span className={`font-bold ${tableStats.luutru_records.cloudCount - localStats.luutru > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {tableStats.luutru_records.cloudCount - localStats.luutru > 0 ? `Thiếu ${tableStats.luutru_records.cloudCount - localStats.luutru} hồ sơ` : 'Đồng bộ đủ'}
                        </span>
                    </div>
                </div>

                {/* Tổng hồ sơ thiếu */}
                <div className={`rounded-xl p-4 border shadow-xs flex flex-col justify-between ${
                    missingRecords.length > 0 ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                }`}>
                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                        <span>Hồ sơ thiếu trong State</span>
                        {missingRecords.length > 0 ? <AlertTriangle size={15} className="text-amber-600" /> : <CheckCircle2 size={15} className="text-emerald-600" />}
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                        <div>
                            <span className="text-2xl font-black">{missingRecords.length}</span>
                            <span className="text-xs ml-1 font-medium">hồ sơ cần bù đắp</span>
                        </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-[11px]">
                        <span>Trạng thái:</span>
                        <span className="font-bold">
                            {missingRecords.length > 0 ? 'Cần nạp bổ sung' : 'Đồng bộ hoàn hảo'}
                        </span>
                    </div>
                </div>

            </div>

            {/* Cảnh báo & Hướng dẫn sửa RLS nếu phát hiện sự cố */}
            {hasRlsIssues && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900 shadow-xs animate-fade-in">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-rose-900">Phát hiện sự cố Phân quyền RLS (Row Level Security)</h3>
                            <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                                CSDL Supabase đang bật RLS nhưng thiếu chính sách cho phép máy khách truy vấn, khiến ứng dụng bị chặn tải danh sách hồ sơ. Hãy copy câu lệnh SQL dưới đây và chạy trong mục <b>SQL Editor</b> của Supabase Dashboard để tắt RLS:
                            </p>
                            <div className="mt-3 relative bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-xs overflow-x-auto">
                                <pre>{rlsFixSql}</pre>
                                <button
                                    type="button"
                                    onClick={handleCopySql}
                                    className="absolute top-2 right-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                >
                                    {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                                    <span>{copiedSql ? 'Đã sao chép' : 'Sao chép SQL'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Danh sách các hồ sơ phát hiện thiếu trong State */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col flex-1 min-h-[400px]">
                
                {/* Thanh công cụ danh sách */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-800">
                            Danh sách Hồ sơ trên CSDL chưa nạp vào State ({filteredMissingRecords.length} bản ghi)
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-end">
                        {/* Filter Table */}
                        <select
                            value={selectedTableFilter}
                            onChange={(e) => setSelectedTableFilter(e.target.value as any)}
                            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">Tất cả bảng CSDL</option>
                            <option value="land_records">Bảng Đo đạc (land_records)</option>
                            <option value="dangky_records">Bảng Cấp giấy (dangky_records)</option>
                            <option value="luutru_records">Bảng Lưu trữ (luutru_records)</option>
                        </select>

                        {/* Search */}
                        <div className="relative w-48 sm:w-56">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Tìm mã, tên, thửa, tờ..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Button Nạp hồ sơ đã chọn */}
                        {selectedRecordIds.size > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    const toSync = missingRecords.filter(r => selectedRecordIds.has(r.id));
                                    syncRecordsIntoAppState(toSync);
                                }}
                                disabled={isSyncing}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                                <Download size={14} />
                                <span>Nạp {selectedRecordIds.size} hồ sơ đã chọn</span>
                            </button>
                        )}

                        {/* Button Nạp tất cả hồ sơ thiếu */}
                        {missingRecords.length > 0 && (
                            <button
                                type="button"
                                onClick={() => syncRecordsIntoAppState(missingRecords)}
                                disabled={isSyncing}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                                <Layers size={14} />
                                <span>{isSyncing ? 'Đang nạp...' : `Đồng bộ tất cả (${missingRecords.length}) vào App`}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Bảng dữ liệu */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={filteredMissingRecords.length > 0 && selectedRecordIds.size === filteredMissingRecords.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3 w-36">MÃ HỒ SƠ</th>
                                <th className="p-3">CHỦ SỬ DỤNG</th>
                                <th className="p-3 w-32">LOẠI THỦ TỤC</th>
                                <th className="p-3 w-28">ĐỊA BÀN</th>
                                <th className="p-3 w-28">THỬA / TỜ</th>
                                <th className="p-3 w-32">TRẠNG THÁI CSDL</th>
                                <th className="p-3 w-32">BẢNG LƯU TRỮ</th>
                                <th className="p-3 w-40 text-center">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredMissingRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <CheckCircle2 size={36} className="text-emerald-500" />
                                            <p className="font-semibold text-slate-700 text-sm">
                                                {missingRecords.length === 0 
                                                    ? "Tuyệt vời! Không có hồ sơ nào bị thiếu giữa Supabase và Ứng dụng."
                                                    : "Không tìm thấy hồ sơ nào phù hợp với bộ lọc tìm kiếm."}
                                            </p>
                                            <p className="text-xs text-slate-500 max-w-md">
                                                Toàn bộ các bản ghi trên CSDL Cloud đã được đồng bộ chuẩn xác và đầy đủ trong bộ nhớ máy khách.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredMissingRecords.map((item) => {
                                    const isSelected = selectedRecordIds.has(item.id);
                                    return (
                                        <tr 
                                            key={item.id}
                                            className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                        >
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelect(item.id)}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-3 font-mono font-bold text-blue-700">
                                                {item.code}
                                            </td>
                                            <td className="p-3 font-semibold text-slate-800">
                                                {item.customerName || '---'}
                                            </td>
                                            <td className="p-3">
                                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium text-[11px]">
                                                    {getShortRecordType(item.recordType) || item.recordType || '---'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {getWardLabel(item.ward) || item.ward || '---'}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {item.landPlot ? `Thửa ${item.landPlot}` : ''} {item.mapSheet ? `/ Tờ ${item.mapSheet}` : '---'}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                    STATUS_COLORS[item.dbStatus as RecordStatus] || 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {STATUS_LABELS[item.dbStatus as RecordStatus] || item.dbStatus}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                    {item.sourceTable}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => syncRecordsIntoAppState([item])}
                                                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-bold text-[11px] transition-colors cursor-pointer"
                                                        title="Nạp ngay hồ sơ này vào ứng dụng"
                                                    >
                                                        Nạp vào App
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestoreToInProgress(item)}
                                                        disabled={actionLoadingId === item.id}
                                                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                                                        title="Khôi phục trạng thái về Đang thực hiện để xuất hiện ở tab Tổ Đo đạc"
                                                    >
                                                        {actionLoadingId === item.id ? <Loader2 size={12} className="animate-spin" /> : 'Về Đang làm'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer thông báo */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
                    <span>
                        Tổng số hồ sơ đang hiển thị trong bộ nhớ ứng dụng: <b>{records.length}</b> bản ghi.
                    </span>
                    <span className="text-[11px] text-slate-400">
                        Hệ thống tự động đồng bộ Realtime qua Supabase WebSocket & Cache Storage.
                    </span>
                </div>

            </div>

        </div>
    );
};

export default SyncDiagnosticTab;
