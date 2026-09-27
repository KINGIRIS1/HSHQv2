import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Contract } from '../../types';
import { fetchContracts, updateContractApi } from '../../services/api';
import { Sparkles, RefreshCw, Play, Pause, Square, Search, Calendar, ArrowRight, CheckCircle2, AlertTriangle, Terminal, Check } from 'lucide-react';
import { confirmAction, parseSafeDate } from '../../utils/appHelpers';

interface ContractDateErrorItem {
    id: string;
    code: string;
    customerName: string;
    contractType: string;
    createdDate: string;
    createdDateFormatted: string;
    signedDate?: string;
    signedDateFormatted?: string;
    liquidationDate?: string;
    liquidationDateFormatted?: string;
    fieldsToFix: {
        field: string;
        label: string;
        oldVal: string;
        newVal: string;
    }[];
    updatePayload: Partial<Contract>;
    status: 'pending' | 'processing' | 'success' | 'error';
    errorMessage?: string;
    selected: boolean;
}

interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'batch';
}

interface FixContractDatesToolProps {
    contracts?: Contract[];
    onContractsUpdated?: () => void;
}

export const formatDateDisplayVN = (dateStr?: string | null): string => {
    if (!dateStr) return '---';
    const s = String(dateStr).trim();
    if (!s) return '---';
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const d = parseSafeDate(s);
    if (!d) return s;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Hàm kiểm tra hoặc đảo ngày tháng nếu bị ngược (DD/MM <-> MM/DD)
 * Nếu truyền swap = true, sẽ đổi phần ngày và tháng cho nhau (nếu ngày <= 12 và tháng <= 12)
 */
const swapDayMonthString = (dateStr?: string | null): string | null => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        const [, y, m, d] = match;
        // Đảo m và d cho nhau
        return `${y}-${d}-${m}`;
    }
    const matchSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (matchSlash) {
        const [, d, m, y] = matchSlash;
        return `${y}-${m}-${d}`; // Chuyển về chuẩn YYYY-MM-DD sau khi đảo
    }
    return null;
};

const extractDateFromContractCode = (code?: string | null): string | null => {
    if (!code) return null;
    const clean = String(code).trim();
    const match = clean.match(/(\d{2})(\d{2})(\d{2})/);
    if (match) {
        const [, yy, mm, dd] = match;
        const year = 2000 + Number(yy);
        const month = Number(mm);
        const day = Number(dd);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= 2035) {
            const formattedMonth = String(month).padStart(2, '0');
            const formattedDay = String(day).padStart(2, '0');
            return `${year}-${formattedMonth}-${formattedDay}`;
        }
    }
    return null;
};

const FixContractDatesTool: React.FC<FixContractDatesToolProps> = ({ contracts: propContracts = [], onContractsUpdated }) => {
    const [contracts, setContracts] = useState<Contract[]>(propContracts);
    const [scannedItems, setScannedItems] = useState<ContractDateErrorItem[]>([]);
    const [hasScanned, setHasScanned] = useState(false);
    const [isScanningCloud, setIsScanningCloud] = useState(false);

    // Operation mode: 'smart_code' (mã YYMMDD), 'swap' (đảo ngày/tháng), 'normalize' (chuẩn hóa định dạng)
    const [fixMode, setFixMode] = useState<'smart_code' | 'swap' | 'normalize'>('smart_code');
    const [batchSize, setBatchSize] = useState<number>(30);

    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const pauseRef = useRef(false);
    const cancelRef = useRef(false);

    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [successCount, setSuccessCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'success' | 'error'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [autoScrollLogs, setAutoScrollLogs] = useState(true);
    const logContainerRef = useRef<HTMLDivElement>(null);

    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const now = new Date();
        const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
        setLogs(prev => [...prev.slice(-300), { id: Math.random().toString(36).substring(2), timestamp, message, type }]);
    };

    useEffect(() => {
        if (autoScrollLogs && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScrollLogs]);

    useEffect(() => {
        let timer: any = null;
        if (isProcessing && !isPaused && startTime) {
            timer = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [isProcessing, isPaused, startTime]);

    const performScan = (targetContracts: Contract[]) => {
        const results: ContractDateErrorItem[] = [];

        targetContracts.forEach(c => {
            if (!c || !c.id) return;
            const created = c.createdDate || '';
            const signed = (c as any).signedDate || '';
            const liquidation = (c as any).liquidationDate || '';

            const fieldsToFix: { field: string; label: string; oldVal: string; newVal: string }[] = [];
            const updatePayload: Partial<Contract> = {
                id: c.id,
                code: c.code,
            };

            // Kiểm tra theo chế độ quét
            if (fixMode === 'smart_code') {
                const codeDate = extractDateFromContractCode(c.code);
                if (codeDate) {
                    const currentCreatedDateOnly = created ? created.split('T')[0] : '';
                    if (currentCreatedDateOnly !== codeDate) {
                        fieldsToFix.push({
                            field: 'createdDate',
                            label: 'Ngày lập theo Mã HĐ (YYMMDD)',
                            oldVal: created || 'Trống',
                            newVal: codeDate
                        });
                        updatePayload.createdDate = codeDate;
                    }
                }
            } else if (fixMode === 'swap') {
                if (created) {
                    const parts = created.split('T')[0].split('-');
                    if (parts.length === 3) {
                        const [y, m, d] = parts;
                        if (Number(m) <= 12 && Number(d) <= 12 && m !== d) {
                            const swapped = `${y}-${d}-${m}`;
                            fieldsToFix.push({
                                field: 'createdDate',
                                label: 'Ngày lập hợp đồng',
                                oldVal: created,
                                newVal: swapped
                            });
                            updatePayload.createdDate = swapped;
                        }
                    }
                }

                if (signed) {
                    const parts = signed.split('T')[0].split('-');
                    if (parts.length === 3) {
                        const [y, m, d] = parts;
                        if (Number(m) <= 12 && Number(d) <= 12 && m !== d) {
                            const swapped = `${y}-${d}-${m}`;
                            fieldsToFix.push({
                                field: 'signedDate',
                                label: 'Ngày ký hợp đồng',
                                oldVal: signed,
                                newVal: swapped
                            });
                            (updatePayload as any).signedDate = swapped;
                        }
                    }
                }

                if (liquidation) {
                    const parts = liquidation.split('T')[0].split('-');
                    if (parts.length === 3) {
                        const [y, m, d] = parts;
                        if (Number(m) <= 12 && Number(d) <= 12 && m !== d) {
                            const swapped = `${y}-${d}-${m}`;
                            fieldsToFix.push({
                                field: 'liquidationDate',
                                label: 'Ngày thanh lý hợp đồng',
                                oldVal: liquidation,
                                newVal: swapped
                            });
                            (updatePayload as any).liquidationDate = swapped;
                        }
                    }
                }
            }

            // Nếu user chọn chế độ quét tất cả hợp đồng để liệt kê kiểm tra
            if (fixMode === 'normalize' || fieldsToFix.length > 0) {
                results.push({
                    id: c.id,
                    code: c.code || '---',
                    customerName: c.customerName || 'Chưa tên',
                    contractType: c.contractType || '---',
                    createdDate: created,
                    createdDateFormatted: formatDateDisplayVN(created),
                    signedDate: signed,
                    signedDateFormatted: formatDateDisplayVN(signed),
                    liquidationDate: liquidation,
                    liquidationDateFormatted: formatDateDisplayVN(liquidation),
                    fieldsToFix: fieldsToFix.length > 0 ? fieldsToFix : [
                        { field: 'createdDate', label: 'Ngày lập (Chuẩn hóa)', oldVal: created, newVal: created }
                    ],
                    updatePayload: fieldsToFix.length > 0 ? updatePayload : { id: c.id, code: c.code },
                    status: 'pending',
                    selected: fieldsToFix.length > 0
                });
            }
        });

        setScannedItems(results);
        setHasScanned(true);
        setCurrentPage(1);
        addLog(`🔎 [Quét hợp đồng] Tìm thấy ${results.length} hợp đồng cần kiểm tra/đảo ngày.`, results.length > 0 ? 'warning' : 'success');
    };

    const handleQuickScan = () => {
        addLog(`Đang quét kiểm tra trong kho dữ liệu hợp đồng (${contracts.length} bản ghi)...`, 'info');
        performScan(contracts);
    };

    const handleCloudScan = async () => {
        try {
            setIsScanningCloud(true);
            addLog(`Đang nạp trực tiếp danh sách hợp đồng từ Cloud Supabase...`, 'info');
            const fresh = await fetchContracts(true);
            setContracts(fresh);
            addLog(`Đã tải ${fresh.length} hợp đồng từ Cloud. Đang phân tích...`, 'info');
            performScan(fresh);
        } catch (err: any) {
            addLog(`❌ Lỗi tải hợp đồng từ Cloud: ${err?.message || err}`, 'error');
        } finally {
            setIsScanningCloud(false);
        }
    };

    useEffect(() => {
        if (!hasScanned && propContracts.length > 0) {
            setContracts(propContracts);
            performScan(propContracts);
        }
    }, [propContracts]);

    const stats = useMemo(() => {
        const total = scannedItems.length;
        const selectedCount = scannedItems.filter(i => i.selected).length;
        const success = scannedItems.filter(i => i.status === 'success').length;
        const error = scannedItems.filter(i => i.status === 'error').length;
        return { total, selectedCount, success, error };
    }, [scannedItems]);

    const filteredItems = useMemo(() => {
        return scannedItems.filter(item => {
            if (filterStatus !== 'all' && item.status !== filterStatus) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                return item.code.toLowerCase().includes(q) || item.customerName.toLowerCase().includes(q);
            }
            return true;
        });
    }, [scannedItems, filterStatus, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredItems.slice(start, start + pageSize);
    }, [filteredItems, currentPage, pageSize]);

    const handleStartBatchRepair = async () => {
        const itemsToFix = scannedItems.filter(i => i.selected && i.status !== 'success');
        if (itemsToFix.length === 0) {
            alert('Vui lòng chọn ít nhất một hợp đồng cần sửa ngày tháng.');
            return;
        }

        if (!(await confirmAction(`Xác nhận cập nhật lại ngày tháng cho ${itemsToFix.length} hợp đồng lên Database?`, 'Xác nhận sửa ngày hợp đồng'))) return;

        setIsProcessing(true);
        setIsPaused(false);
        pauseRef.current = false;
        cancelRef.current = false;

        const effStart = Date.now();
        setStartTime(effStart);
        setElapsedTime(0);

        const chunks: ContractDateErrorItem[][] = [];
        for (let i = 0; i < itemsToFix.length; i += batchSize) {
            chunks.push(itemsToFix.slice(i, i + batchSize));
        }

        setTotalChunks(chunks.length);
        setCurrentChunkIndex(0);
        setProcessedCount(0);
        setSuccessCount(0);
        setErrorCount(0);

        addLog(`🚀 [BẮT ĐẦU] Tiến hành cập nhật ${itemsToFix.length} hợp đồng (${chunks.length} mảng)...`, 'info');

        let totalSuccess = 0;
        let totalFailed = 0;
        let runningProcessed = 0;

        for (let c = 0; c < chunks.length; c++) {
            if (cancelRef.current) break;
            while (pauseRef.current) {
                await new Promise(r => setTimeout(r, 200));
                if (cancelRef.current) break;
            }
            if (cancelRef.current) break;

            const chunk = chunks[c];
            setCurrentChunkIndex(c + 1);

            const chunkIds = new Set(chunk.map(i => i.id));
            setScannedItems(prev => prev.map(item => chunkIds.has(item.id) ? { ...item, status: 'processing' } : item));

            try {
                for (const item of chunk) {
                    const originalContract = contracts.find(x => x.id === item.id) || {};
                    const merged = { ...originalContract, ...item.updatePayload };
                    const success = await updateContractApi(merged as Contract);
                    if (success) {
                        totalSuccess++;
                        setSuccessCount(totalSuccess);
                        setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'success' } : it));
                        addLog(`  ✅ [${item.code}] Đã cập nhật ngày thành công.`, 'success');
                    } else {
                        totalFailed++;
                        setErrorCount(totalFailed);
                        setScannedItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', errorMessage: 'Lỗi cập nhật API' } : it));
                        addLog(`  ❌ [${item.code}] Lỗi cập nhật.`, 'error');
                    }
                }
            } catch (err: any) {
                totalFailed += chunk.length;
                setErrorCount(totalFailed);
                addLog(`❌ Lỗi mảng ${c + 1}: ${err?.message || err}`, 'error');
            }

            runningProcessed += chunk.length;
            setProcessedCount(runningProcessed);
            await new Promise(r => setTimeout(r, 100));
        }

        setIsProcessing(false);
        setIsPaused(false);
        addLog(`🏁 [HOÀN TẤT] Đã xử lý thành công ${totalSuccess} hợp đồng.`, totalFailed === 0 ? 'success' : 'warning');
        if (onContractsUpdated) onContractsUpdated();
    };

    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-start gap-3.5">
                    <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 shrink-0 shadow-2xs">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                                Công cụ Quét & Sửa lỗi Đảo ngày tháng Hợp đồng
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                                Triệt để & Chuẩn hóa
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed max-w-3xl">
                            Khắc phục triệt để tình trạng các hợp đồng bị ngược ngày/tháng (DD/MM lệch thành MM/DD) và lưu trữ đồng bộ chính xác vào Database và Cloud Supabase.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={handleQuickScan}
                        disabled={isProcessing || isScanningCloud}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shadow-2xs"
                    >
                        <RefreshCw size={14} className={isScanningCloud ? 'animate-spin' : ''} />
                        Quét kiểm tra hợp đồng
                    </button>
                    <button
                        type="button"
                        onClick={handleCloudScan}
                        disabled={isProcessing || isScanningCloud}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50 shadow-2xs"
                    >
                        <RefreshCw size={14} className={isScanningCloud ? 'animate-spin' : ''} />
                        {isScanningCloud ? 'Đang nạp Cloud...' : 'Quét trực tiếp Cloud'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng hợp đồng quét</span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-slate-800">{stats.total}</span>
                        <span className="text-xs font-semibold text-slate-400">hợp đồng</span>
                    </div>
                </div>
                <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Đã chọn sửa</span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-indigo-900">{stats.selectedCount}</span>
                        <span className="text-xs font-semibold text-indigo-600">hợp đồng</span>
                    </div>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Đã sửa thành công</span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-emerald-800">{stats.success}</span>
                        <span className="text-xs font-semibold text-emerald-600">hợp đồng</span>
                    </div>
                </div>
                <div className="bg-red-50/60 border border-red-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Lỗi phát sinh</span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-red-800">{stats.error}</span>
                        <span className="text-xs font-semibold text-red-600">hợp đồng</span>
                    </div>
                </div>
            </div>

            {/* Mode Selector */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <span className="text-xs font-bold text-indigo-900 block">Chế độ quét & sửa ngày tháng:</span>
                    <p className="text-[11px] text-indigo-700">Chọn phương thức phân tích để quét lỗi ngày tháng trên hợp đồng.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setFixMode('smart_code')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${fixMode === 'smart_code' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}`}
                    >
                        🧠 Sửa thông minh theo Mã HĐ (YYMMDD)
                    </button>
                    <button
                        type="button"
                        onClick={() => setFixMode('swap')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${fixMode === 'swap' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}`}
                    >
                        🔀 Đảo Ngày/Tháng (DD/MM ↔ MM/DD)
                    </button>
                    <button
                        type="button"
                        onClick={() => setFixMode('normalize')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${fixMode === 'normalize' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}`}
                    >
                        📋 Liệt kê tất cả
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-slate-600">Kích thước mảng:</span>
                    <select
                        value={batchSize}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                        disabled={isProcessing}
                        className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    >
                        <option value={20}>20 HĐ / mảng</option>
                        <option value={30}>30 HĐ / mảng (Khuyên dùng)</option>
                        <option value={50}>50 HĐ / mảng</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleStartBatchRepair}
                        disabled={stats.selectedCount === 0 || isProcessing}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-200 disabled:opacity-40 flex items-center gap-2 active:scale-95"
                    >
                        <Play size={15} fill="currentColor" />
                        Thực thi sửa ngày HĐ ({stats.selectedCount})
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Danh sách hợp đồng xem trước</span>
                    <div className="relative w-64">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm mã HĐ, tên khách hàng..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full bg-white text-slate-800 text-xs rounded-xl pl-8 pr-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-black tracking-wider">
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={scannedItems.length > 0 && scannedItems.every(i => i.selected)}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setScannedItems(prev => prev.map(i => ({ ...i, selected: checked })));
                                        }}
                                        disabled={isProcessing}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    />
                                </th>
                                <th className="p-3 w-12 text-center">STT</th>
                                <th className="p-3 w-28">Mã HĐ</th>
                                <th className="p-3">Khách hàng</th>
                                <th className="p-3 w-32">Loại HĐ</th>
                                <th className="p-3 w-36 text-center">Ngày lập hiện tại</th>
                                <th className="p-3 w-28 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                        Chưa có dữ liệu hợp đồng quét hoặc không tìm thấy kết quả phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map((item, index) => {
                                    const stt = (currentPage - 1) * pageSize + index + 1;
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={() => {
                                                        setScannedItems(prev => prev.map(i => i.id === item.id ? { ...i, selected: !i.selected } : i));
                                                    }}
                                                    disabled={isProcessing}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                                />
                                            </td>
                                            <td className="p-3 text-center font-mono text-slate-500">{stt}</td>
                                            <td className="p-3 font-mono font-bold text-indigo-700">{item.code}</td>
                                            <td className="p-3 font-bold text-slate-800">{item.customerName}</td>
                                            <td className="p-3 text-slate-600">{item.contractType}</td>
                                            <td className="p-3 text-center font-mono">{item.createdDateFormatted}</td>
                                            <td className="p-3 text-center">
                                                {item.status === 'success' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">Đã sửa</span>}
                                                {item.status === 'processing' && <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">Đang xử lý</span>}
                                                {item.status === 'error' && <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold text-[10px]" title={item.errorMessage}>Lỗi</span>}
                                                {item.status === 'pending' && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">Chờ sửa</span>}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <div>Hiển thị {paginatedItems.length} / {filteredItems.length} hợp đồng</div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
                        >
                            Trang trước
                        </button>
                        <span className="px-2 font-mono font-bold">{currentPage} / {totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40"
                        >
                            Trang sau
                        </button>
                    </div>
                </div>
            </div>

            {/* Live Logs */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 text-slate-200 font-mono text-[11px]">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Terminal size={14} className="text-indigo-400" />
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-300">Nhật ký xử lý ngày hợp đồng</span>
                    </div>
                    <button type="button" onClick={() => setLogs([])} className="text-[10px] text-slate-400 hover:text-red-400 font-sans">Xóa log</button>
                </div>
                <div ref={logContainerRef} className="p-3 max-h-40 overflow-y-auto space-y-1 select-text">
                    {logs.length === 0 ? (
                        <div className="text-slate-600 italic py-2">Chưa có nhật ký hoạt động. Nhấn "Quét kiểm tra hợp đồng" để bắt đầu...</div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                                <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                                <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-red-400 font-bold' : 'text-slate-300'}>{log.message}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FixContractDatesTool;
