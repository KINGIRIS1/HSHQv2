import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    AlertTriangle, CheckCircle2, RefreshCw, Play, Pause, Square, 
    Layers, Clock, ArrowRight, ShieldAlert, Check, Search, 
    Filter, FileText, ChevronLeft, ChevronRight, Download, Sparkles, Terminal, Info
} from 'lucide-react';
import { RecordFile, RecordStatus } from '../types';
import { getShortRecordType } from '../constants';
import { isFieldWorkProcedure, isOfficeOnlySurveyProcedure, parseSafeDate } from '../utils/appHelpers';
import { keepOnlyDate } from '../services/apiCore';
import { updateRecordsBatchById, fetchRecords } from '../services/apiRecords';

export interface DateErrorItem {
    id: string;
    code: string;
    customerName: string;
    recordType: string;
    shortType: string;
    group: 'group_1' | 'group_2';
    groupLabel: string;
    receivedDate: string;
    receivedDateFormatted: string;
    fieldsToFix: {
        field: string;
        label: string;
        oldVal: string;
        newVal: string;
    }[];
    updatePayload: Partial<RecordFile>;
    status: 'pending' | 'processing' | 'success' | 'error';
    errorMessage?: string;
    selected: boolean;
}

export interface LogEntry {
    id: string;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'batch';
}

interface FixAssignedDatesToolProps {
    records?: RecordFile[];
    onRecordsUpdated?: () => void;
}

/**
 * Kiểm tra xem một chuỗi ngày có phải là ngày lỗi 09/09/2026 hay không
 * Nhận diện linh hoạt: 2026-09-09, 09/09/2026, 9/9/2026, 2026-09-09T...
 */
export const isErrorDate20260909 = (val?: string | null): boolean => {
    if (!val) return false;
    const s = String(val).trim();
    if (!s) return false;
    if (s.startsWith('2026-09-09')) return true;
    if (/^0?9\/0?9\/2026/.test(s)) return true;
    if (/^0?9\-0?9\-2026/.test(s)) return true;
    const d = parseSafeDate(s);
    return !!(d && d.getFullYear() === 2026 && d.getMonth() === 8 && d.getDate() === 9);
};

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

const FixAssignedDatesTool: React.FC<FixAssignedDatesToolProps> = ({ records = [], onRecordsUpdated }) => {
    // Danh sách hồ sơ lỗi sau khi quét
    const [scannedItems, setScannedItems] = useState<DateErrorItem[]>([]);
    const [hasScanned, setHasScanned] = useState(false);
    const [isScanningCloud, setIsScanningCloud] = useState(false);

    // Cấu hình phân mảng (Chunking)
    const [batchSize, setBatchSize] = useState<number>(30); // 30, 40, 50

    // Trạng thái thực thi tự động (Automated Execution)
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const pauseRef = useRef(false);
    const cancelRef = useRef(false);

    // Tiến độ thời gian thực (Progress Metrics)
    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
    const [totalChunks, setTotalChunks] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [successCount, setSuccessCount] = useState(0);
    const [errorCount, setErrorCount] = useState(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    // Bộ lọc & Phân trang trong Bảng xem trước
    const [filterGroup, setFilterGroup] = useState<'all' | 'group_1' | 'group_2'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'success' | 'error'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Nhật ký hoạt động (Live Logs)
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [autoScrollLogs, setAutoScrollLogs] = useState(true);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Helper ghi log
    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const now = new Date();
        const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
        setLogs(prev => [...prev.slice(-300), { id: Math.random().toString(36).substring(2), timestamp, message, type }]);
    };

    // Cuộn tự động log
    useEffect(() => {
        if (autoScrollLogs && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScrollLogs]);

    // Timer đo thời gian thực hiện
    useEffect(() => {
        let timer: any = null;
        if (isProcessing && !isPaused && startTime) {
            timer = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isProcessing, isPaused, startTime]);

    // Quét phát hiện hồ sơ lỗi từ tập dữ liệu records
    const performScan = (targetRecords: RecordFile[]) => {
        const results: DateErrorItem[] = [];

        targetRecords.forEach(r => {
            if (!r || !r.id) return;
            const recType = r.recordType || r.content || '';
            const shortType = getShortRecordType(recType);

            // Nhóm 1: 2.1 và 2.3 (Trích lục & Duyệt đơn)
            const isGroup1 = isOfficeOnlySurveyProcedure(recType) || shortType.startsWith('2.1') || shortType.startsWith('2.3');
            // Nhóm 2: 2.2, 2.4, 2.5 (Trích đo, Cắm mốc, Tách-Hợp)
            const isGroup2 = isFieldWorkProcedure(recType) || shortType.startsWith('2.2') || shortType.startsWith('2.4') || shortType.startsWith('2.5');

            if (!isGroup1 && !isGroup2) return;

            // Ngày tiếp nhận gốc cần chuẩn hóa về
            const rawReceived = r.receivedDate;
            if (!rawReceived) return; // Không có ngày tiếp nhận thì bỏ qua
            const cleanReceivedDate = keepOnlyDate(rawReceived) || (typeof rawReceived === 'string' ? rawReceived.split('T')[0] : '');
            if (!cleanReceivedDate) return;

            const fieldsToFix: { field: string; label: string; oldVal: string; newVal: string }[] = [];
            const updatePayload: Partial<RecordFile> = {
                id: r.id,
                code: r.code,
                recordType: r.recordType
            };

            if (isGroup1) {
                // Nhóm 2.1 & 2.3: Sửa ngày biên tập (officeAssignedDate) và assignedDate nếu bị gán 09/09/2026
                if (isErrorDate20260909(r.officeAssignedDate)) {
                    fieldsToFix.push({
                        field: 'officeAssignedDate',
                        label: 'Ngày biên tập bản đồ',
                        oldVal: String(r.officeAssignedDate),
                        newVal: cleanReceivedDate
                    });
                    updatePayload.officeAssignedDate = cleanReceivedDate;
                }
                if (isErrorDate20260909(r.assignedDate)) {
                    fieldsToFix.push({
                        field: 'assignedDate',
                        label: 'Ngày giao việc (Nội nghiệp)',
                        oldVal: String(r.assignedDate),
                        newVal: cleanReceivedDate
                    });
                    updatePayload.assignedDate = cleanReceivedDate;
                }
            } else if (isGroup2) {
                // Nhóm 2.2, 2.4, 2.5: Sửa ngày giao Đo đạc thực địa (fieldAssignedDate / surveyAssignedDate) và assignedDate
                if (isErrorDate20260909(r.fieldAssignedDate)) {
                    fieldsToFix.push({
                        field: 'fieldAssignedDate',
                        label: 'Ngày giao thực địa',
                        oldVal: String(r.fieldAssignedDate),
                        newVal: cleanReceivedDate
                    });
                    updatePayload.fieldAssignedDate = cleanReceivedDate;
                }
                if (isErrorDate20260909(r.surveyAssignedDate)) {
                    fieldsToFix.push({
                        field: 'surveyAssignedDate',
                        label: 'Ngày giao đo đạc',
                        oldVal: String(r.surveyAssignedDate),
                        newVal: cleanReceivedDate
                    });
                    updatePayload.surveyAssignedDate = cleanReceivedDate;
                }
                if (isErrorDate20260909(r.assignedDate)) {
                    fieldsToFix.push({
                        field: 'assignedDate',
                        label: 'Ngày giao việc (Ngoại nghiệp)',
                        oldVal: String(r.assignedDate),
                        newVal: cleanReceivedDate
                    });
                    updatePayload.assignedDate = cleanReceivedDate;
                }
            }

            if (fieldsToFix.length > 0) {
                results.push({
                    id: r.id,
                    code: r.code || 'Chưa có mã',
                    customerName: r.customerName || 'Chưa có tên',
                    recordType: recType,
                    shortType,
                    group: isGroup1 ? 'group_1' : 'group_2',
                    groupLabel: isGroup1 ? 'Nhóm 2.1 & 2.3 (Biên tập bản đồ)' : 'Nhóm 2.2, 2.4, 2.5 (Đo đạc thực địa)',
                    receivedDate: cleanReceivedDate,
                    receivedDateFormatted: formatDateDisplayVN(cleanReceivedDate),
                    fieldsToFix,
                    updatePayload,
                    status: 'pending',
                    selected: true
                });
            }
        });

        setScannedItems(results);
        setHasScanned(true);
        setCurrentPage(1);

        const countG1 = results.filter(i => i.group === 'group_1').length;
        const countG2 = results.filter(i => i.group === 'group_2').length;

        addLog(`🔎 [Quét hoàn tất] Tìm thấy tổng cộng ${results.length} hồ sơ lỗi ngày 09/09/2026 (Nhóm 2.1 & 2.3: ${countG1} HS; Nhóm 2.2, 2.4, 2.5: ${countG2} HS)`, results.length > 0 ? 'warning' : 'success');
    };

    // Quét nhanh từ bộ nhớ hiện tại
    const handleQuickScan = () => {
        addLog(`Đang quét kiểm tra trong kho dữ liệu (${records.length} hồ sơ)...`, 'info');
        performScan(records);
    };

    // Tải mới từ Cloud Supabase và quét
    const handleCloudScan = async () => {
        try {
            setIsScanningCloud(true);
            addLog(`Đang nạp trực tiếp toàn bộ hồ sơ mới nhất từ Cloud Supabase...`, 'info');
            const freshRecords = await fetchRecords();
            addLog(`Đã tải thành công ${freshRecords.length} hồ sơ từ Cloud. Đang phân tích...`, 'info');
            performScan(freshRecords);
        } catch (error: any) {
            addLog(`❌ Lỗi kết nối Cloud khi tải hồ sơ: ${error?.message || error}`, 'error');
        } finally {
            setIsScanningCloud(false);
        }
    };

    // Tự động quét lần đầu nếu đã có dữ liệu
    useEffect(() => {
        if (!hasScanned && records.length > 0) {
            performScan(records);
        }
    }, [records, hasScanned]);

    // Thống kê nhanh
    const stats = useMemo(() => {
        const total = scannedItems.length;
        const group1Count = scannedItems.filter(i => i.group === 'group_1').length;
        const group2Count = scannedItems.filter(i => i.group === 'group_2').length;
        const selectedCount = scannedItems.filter(i => i.selected).length;
        const success = scannedItems.filter(i => i.status === 'success').length;
        const error = scannedItems.filter(i => i.status === 'error').length;
        const pending = scannedItems.filter(i => i.status === 'pending').length;
        return { total, group1Count, group2Count, selectedCount, success, error, pending };
    }, [scannedItems]);

    // Chọn tất cả / Bỏ chọn tất cả
    const handleToggleSelectAll = (checked: boolean) => {
        setScannedItems(prev => prev.map(item => ({ ...item, selected: checked })));
    };

    // Chọn / Bỏ chọn từng hồ sơ
    const handleToggleSelectOne = (id: string) => {
        setScannedItems(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
    };

    // Lọc danh sách xem trước
    const filteredItems = useMemo(() => {
        return scannedItems.filter(item => {
            if (filterGroup === 'group_1' && item.group !== 'group_1') return false;
            if (filterGroup === 'group_2' && item.group !== 'group_2') return false;

            if (filterStatus !== 'all' && item.status !== filterStatus) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const codeMatch = item.code.toLowerCase().includes(q);
                const nameMatch = item.customerName.toLowerCase().includes(q);
                const typeMatch = item.recordType.toLowerCase().includes(q);
                if (!codeMatch && !nameMatch && !typeMatch) return false;
            }

            return true;
        });
    }, [scannedItems, filterGroup, filterStatus, searchQuery]);

    // Phân trang
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredItems.slice(start, start + pageSize);
    }, [filteredItems, currentPage, pageSize]);

    // Bắt đầu quy trình Sửa lỗi tự động theo mảng (Chunking / Batching)
    const handleStartBatchRepair = async () => {
        const itemsToFix = scannedItems.filter(i => i.selected && i.status !== 'success');
        if (itemsToFix.length === 0) {
            alert('Vui lòng chọn ít nhất một hồ sơ hợp lệ cần sửa.');
            return;
        }

        const confirmMsg = `Bạn có chắc chắn muốn tiến hành sửa lỗi ngày cho ${itemsToFix.length} hồ sơ?\n` +
            `- Quy trình sẽ được tự động chia thành các mảng nhỏ (${batchSize} HS/mảng).\n` +
            `- Ngày biên tập bản đồ (2.1, 2.3) và ngày giao thực địa (2.2, 2.4, 2.5) sẽ được chỉnh về cùng Ngày tiếp nhận.\n` +
            `- Cập nhật trực tiếp lên Cloud Supabase và đồng bộ IndexedDB tự động.`;

        if (!window.confirm(confirmMsg)) return;

        setIsProcessing(true);
        setIsPaused(false);
        pauseRef.current = false;
        cancelRef.current = false;

        const effectiveStartTime = Date.now();
        setStartTime(effectiveStartTime);
        setElapsedTime(0);

        // Chia mảng (Chunking)
        const chunks: DateErrorItem[][] = [];
        for (let i = 0; i < itemsToFix.length; i += batchSize) {
            chunks.push(itemsToFix.slice(i, i + batchSize));
        }

        setTotalChunks(chunks.length);
        setCurrentChunkIndex(0);
        setProcessedCount(0);
        setSuccessCount(0);
        setErrorCount(0);

        addLog(`🚀 [BẮT ĐẦU] Bắt đầu sửa lỗi tự động: ${itemsToFix.length} hồ sơ, chia thành ${chunks.length} mảng (${batchSize} HS/mảng).`, 'info');

        let totalSuccess = 0;
        let totalFailed = 0;
        let runningProcessed = 0;

        for (let c = 0; c < chunks.length; c++) {
            if (cancelRef.current) {
                addLog(`⏹️ Người dùng đã dừng quá trình sửa tự động.`, 'warning');
                break;
            }

            // Xử lý tạm dừng (Pause)
            while (pauseRef.current) {
                await new Promise(r => setTimeout(r, 200));
                if (cancelRef.current) break;
            }
            if (cancelRef.current) break;

            const chunk = chunks[c];
            setCurrentChunkIndex(c + 1);

            const chunkIds = new Set(chunk.map(i => i.id));
            setScannedItems(prev => prev.map(item => chunkIds.has(item.id) ? { ...item, status: 'processing' } : item));

            addLog(`⚡ [Mảng ${c + 1}/${chunks.length}] Đang cập nhật ${chunk.length} hồ sơ lên Cloud Supabase...`, 'batch');

            try {
                // Tạo mảng payload cập nhật
                const updatePayloads = chunk.map(i => i.updatePayload);
                const res = await updateRecordsBatchById(updatePayloads);

                if (res.success) {
                    totalSuccess += chunk.length;
                    setSuccessCount(totalSuccess);

                    // Cập nhật trạng thái item thành công
                    setScannedItems(prev => prev.map(item => chunkIds.has(item.id) ? { ...item, status: 'success' } : item));

                    chunk.forEach(item => {
                        const fieldsSummary = item.fieldsToFix.map(f => `${f.label}: 09/09/2026 ➔ ${formatDateDisplayVN(f.newVal)}`).join(', ');
                        addLog(`  ✅ [${item.code}] (${item.shortType}): ${fieldsSummary}`, 'success');
                    });

                    addLog(`🎉 [Mảng ${c + 1}/${chunks.length}] Hoàn thành mảng: ${chunk.length}/${chunk.length} hồ sơ thành công.`, 'success');
                } else {
                    totalFailed += chunk.length;
                    setErrorCount(totalFailed);

                    setScannedItems(prev => prev.map(item => chunkIds.has(item.id) ? { ...item, status: 'error', errorMessage: 'Lỗi cập nhật bảng' } : item));
                    addLog(`❌ [Mảng ${c + 1}/${chunks.length}] Lỗi khi cập nhật mảng hồ sơ!`, 'error');
                }
            } catch (err: any) {
                totalFailed += chunk.length;
                setErrorCount(totalFailed);

                setScannedItems(prev => prev.map(item => chunkIds.has(item.id) ? { ...item, status: 'error', errorMessage: err?.message || 'Lỗi ngoại lệ' } : item));
                addLog(`❌ [Mảng ${c + 1}/${chunks.length}] Lỗi nghiêm trọng: ${err?.message || err}`, 'error');
            }

            runningProcessed += chunk.length;
            setProcessedCount(runningProcessed);

            // Tạm dừng 150ms để giảm tải kết nối và tạo độ mượt cho giao diện
            await new Promise(r => setTimeout(r, 150));
        }

        setIsProcessing(false);
        setIsPaused(false);

        const durationSeconds = Math.round((Date.now() - effectiveStartTime) / 1000);
        addLog(`🏁 [HOÀN TẤT] Tổng kết: Đã sửa thành công ${totalSuccess} hồ sơ, lỗi ${totalFailed} hồ sơ trong ${durationSeconds} giây.`, totalFailed === 0 ? 'success' : 'warning');

        // Đồng bộ dữ liệu tức thì cho toàn ứng dụng
        try {
            window.dispatchEvent(new CustomEvent('records-updated', { detail: { action: 'fix_dates', count: totalSuccess } }));
            window.dispatchEvent(new CustomEvent('records_updated_batch', { detail: { action: 'fix_dates' } }));
            if (onRecordsUpdated) {
                onRecordsUpdated();
            }
        } catch (e) {}
    };

    // Tạm dừng / Tiếp tục
    const handleTogglePause = () => {
        if (!isProcessing) return;
        const next = !isPaused;
        setIsPaused(next);
        pauseRef.current = next;
        if (next) {
            addLog(`⏸️ Đã tạm dừng quá trình xử lý mảng. Nhấn "Tiếp tục" để chạy tiếp.`, 'warning');
        } else {
            addLog(`▶️ Tiếp tục xử lý mảng...`, 'info');
        }
    };

    // Hủy bỏ tiến trình
    const handleStopProcessing = () => {
        if (!isProcessing) return;
        if (window.confirm('Bạn có chắc chắn muốn dừng quá trình sửa hồ sơ? Các mảng đã hoàn thành trước đó vẫn được lưu an toàn.')) {
            cancelRef.current = true;
            setIsProcessing(false);
            setIsPaused(false);
        }
    };

    // Format thời gian hiển thị
    const formatTimeSeconds = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const progressPercentage = stats.selectedCount > 0 
        ? Math.min(100, Math.round((processedCount / stats.selectedCount) * 100))
        : 0;

    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-start gap-3.5">
                    <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl border border-purple-100 shrink-0 shadow-2xs">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                                Công cụ Quét & Sửa lỗi Ngày giao chuyên môn (09/09/2026)
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                                Tự động & Phân mảng
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed max-w-3xl">
                            Chuẩn hóa ngày giao <strong>Đo đạc thực địa</strong> (thủ tục 2.2, 2.4, 2.5) và ngày <strong>Biên tập bản đồ</strong> (thủ tục 2.1, 2.3) đang bị sai lệch 09/09/2026 về cùng ngày với <strong>Ngày tiếp nhận hồ sơ</strong>.
                        </p>
                    </div>
                </div>

                {/* Scan Action Buttons */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={handleQuickScan}
                        disabled={isProcessing || isScanningCloud}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 shadow-2xs"
                        title="Quét kiểm tra nhanh trong bộ nhớ ứng dụng"
                    >
                        <RefreshCw size={14} className={isScanningCloud ? 'animate-spin' : ''} />
                        Quét kiểm tra hồ sơ lỗi
                    </button>

                    <button
                        type="button"
                        onClick={handleCloudScan}
                        disabled={isProcessing || isScanningCloud}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 shadow-2xs"
                        title="Tải mới từ Cloud Supabase và quét kiểm tra"
                    >
                        <RefreshCw size={14} className={isScanningCloud ? 'animate-spin' : ''} />
                        {isScanningCloud ? 'Đang nạp Cloud...' : 'Quét trực tiếp Cloud'}
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng hồ sơ dính lỗi</span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-slate-800 tracking-tight">{stats.total}</span>
                        <span className="text-xs font-semibold text-slate-400">hồ sơ</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">
                        Đã chọn: {stats.selectedCount}/{stats.total}
                    </span>
                </div>

                <div className="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Nhóm 2.1 & 2.3</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-200/60 text-purple-800 rounded font-bold">Biên tập</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-purple-900 tracking-tight">{stats.group1Count}</span>
                        <span className="text-xs font-semibold text-purple-600">hồ sơ</span>
                    </div>
                    <span className="text-[10px] text-purple-600/90 font-medium mt-1">Trích lục & Duyệt đơn</span>
                </div>

                <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Nhóm 2.2, 2.4, 2.5</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-200/60 text-blue-800 rounded font-bold">Thực địa</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-blue-900 tracking-tight">{stats.group2Count}</span>
                        <span className="text-xs font-semibold text-blue-600">hồ sơ</span>
                    </div>
                    <span className="text-[10px] text-blue-600/90 font-medium mt-1">Trích đo, Cắm mốc, Tách-Hợp</span>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Trạng thái xử lý</span>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-black text-emerald-800 tracking-tight">{stats.success}</span>
                        <span className="text-xs font-semibold text-emerald-600">đã sửa</span>
                    </div>
                    <span className="text-[10px] text-emerald-600/90 font-medium mt-1">
                        {stats.error > 0 ? `Lỗi: ${stats.error} hồ sơ` : 'An toàn & Nhất quán'}
                    </span>
                </div>
            </div>

            {/* Batch Control Toolbar */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">Kích thước mảng:</span>
                        <select
                            value={batchSize}
                            onChange={(e) => setBatchSize(Number(e.target.value))}
                            disabled={isProcessing}
                            className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                        >
                            <option value={20}>20 hồ sơ / mảng</option>
                            <option value={30}>30 hồ sơ / mảng (Khuyên dùng)</option>
                            <option value={40}>40 hồ sơ / mảng</option>
                            <option value={50}>50 hồ sơ / mảng</option>
                        </select>
                    </div>

                    <div className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                        Ước tính: <span className="font-bold text-slate-700">{Math.ceil(stats.selectedCount / batchSize)}</span> mảng
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {!isProcessing ? (
                        <button
                            type="button"
                            onClick={handleStartBatchRepair}
                            disabled={stats.selectedCount === 0}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-purple-200 disabled:opacity-40 flex items-center gap-2 active:scale-95"
                        >
                            <Play size={15} fill="currentColor" />
                            Bắt đầu sửa tự động theo mảng ({stats.selectedCount} HS)
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleTogglePause}
                                className={`px-4 py-2 font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-2xs active:scale-95 ${
                                    isPaused 
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                                        : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                }`}
                            >
                                {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                                {isPaused ? 'Tiếp tục' : 'Tạm dừng'}
                            </button>

                            <button
                                type="button"
                                onClick={handleStopProcessing}
                                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl border border-red-300 transition-all flex items-center gap-2 active:scale-95"
                            >
                                <Square size={14} fill="currentColor" />
                                Dừng lại
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Real-time Progress Bar & Metrics */}
            {(isProcessing || processedCount > 0) && (
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-purple-400 font-bold text-sm">
                                {progressPercentage}%
                            </span>
                            <span className="font-semibold text-slate-300">
                                {isProcessing 
                                    ? (isPaused ? 'Đang tạm dừng...' : `Đang xử lý mảng ${currentChunkIndex}/${totalChunks}`) 
                                    : 'Hoàn thành chu trình'}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 text-slate-300 text-[11px] font-mono">
                            <div>Đã xử lý: <strong className="text-white">{processedCount}/{stats.selectedCount}</strong></div>
                            <div>Thành công: <strong className="text-emerald-400">{successCount}</strong></div>
                            {errorCount > 0 && <div>Lỗi: <strong className="text-red-400">{errorCount}</strong></div>}
                            <div>Thời gian: <strong className="text-amber-300">{formatTimeSeconds(elapsedTime)}</strong></div>
                        </div>
                    </div>

                    {/* Progress Track */}
                    <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-700">
                        <div
                            className="bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Live Logs Box */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 text-slate-200 font-mono text-[11px] shadow-inner">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Terminal size={14} className="text-purple-400" />
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-300">Nhật ký hoạt động thời gian thực (Live Logs)</span>
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[10px]">
                            {logs.length} dòng
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] text-slate-400 hover:text-slate-200">
                            <input
                                type="checkbox"
                                checked={autoScrollLogs}
                                onChange={(e) => setAutoScrollLogs(e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-purple-500 focus:ring-0 border-slate-700 bg-slate-800"
                            />
                            Tự cuộn
                        </label>
                        <button
                            type="button"
                            onClick={() => setLogs([])}
                            className="text-[10px] text-slate-400 hover:text-red-400 font-sans transition-colors"
                        >
                            Xóa log
                        </button>
                    </div>
                </div>

                <div 
                    ref={logContainerRef}
                    className="p-3 max-h-48 overflow-y-auto space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
                >
                    {logs.length === 0 ? (
                        <div className="text-slate-600 italic py-2">Chưa có nhật ký hoạt động. Nhấn "Quét kiểm tra hồ sơ lỗi" hoặc bắt đầu sửa lỗi...</div>
                    ) : (
                        logs.map(log => {
                            let colorClass = 'text-slate-300';
                            if (log.type === 'success') colorClass = 'text-emerald-400';
                            else if (log.type === 'error') colorClass = 'text-red-400 font-bold';
                            else if (log.type === 'warning') colorClass = 'text-amber-400';
                            else if (log.type === 'batch') colorClass = 'text-indigo-300 font-bold';

                            return (
                                <div key={log.id} className="flex items-start gap-2 leading-relaxed hover:bg-slate-900/60 px-1 rounded">
                                    <span className="text-slate-600 select-none shrink-0">[{log.timestamp}]</span>
                                    <span className={`break-all ${colorClass}`}>{log.message}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Preview Table & Filter Section */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs space-y-0">
                {/* Table Header Controls */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Bộ lọc xem trước:</span>
                        <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 text-xs">
                            <button
                                type="button"
                                onClick={() => { setFilterGroup('all'); setCurrentPage(1); }}
                                className={`px-3 py-1 rounded-lg font-bold transition-all ${filterGroup === 'all' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Tất cả ({stats.total})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setFilterGroup('group_1'); setCurrentPage(1); }}
                                className={`px-3 py-1 rounded-lg font-bold transition-all ${filterGroup === 'group_1' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                2.1 & 2.3 ({stats.group1Count})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setFilterGroup('group_2'); setCurrentPage(1); }}
                                className={`px-3 py-1 rounded-lg font-bold transition-all ${filterGroup === 'group_2' ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                2.2, 2.4, 2.5 ({stats.group2Count})
                            </button>
                        </div>
                    </div>

                    {/* Search & Status filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-48 sm:w-60">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm mã HS, tên người nộp..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="w-full bg-white text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-8 pr-7 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value as any); setCurrentPage(1); }}
                            className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="pending">Chờ sửa</option>
                            <option value="success">Đã sửa</option>
                            <option value="error">Gặp lỗi</option>
                        </select>
                    </div>
                </div>

                {/* Table Data */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-black tracking-wider">
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={scannedItems.length > 0 && scannedItems.every(i => i.selected)}
                                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                                        disabled={isProcessing}
                                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                                    />
                                </th>
                                <th className="p-3 w-12 text-center">STT</th>
                                <th className="p-3 w-32">Mã hồ sơ</th>
                                <th className="p-3">Người nộp hồ sơ</th>
                                <th className="p-3 w-40">Loại thủ tục</th>
                                <th className="p-3 w-28 text-center">Ngày tiếp nhận</th>
                                <th className="p-3">Trường sửa: 09/09/2026 ➔ Ngày tiếp nhận</th>
                                <th className="p-3 w-28 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                        {scannedItems.length === 0 
                                            ? 'Không phát hiện hồ sơ nào bị lỗi ngày 09/09/2026 trong hệ thống.' 
                                            : 'Không tìm thấy hồ sơ nào khớp với bộ lọc hiện tại.'}
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map((item, index) => {
                                    const stt = (currentPage - 1) * pageSize + index + 1;
                                    return (
                                        <tr 
                                            key={item.id} 
                                            className={`hover:bg-slate-50/80 transition-colors ${item.selected ? 'bg-purple-50/20' : ''}`}
                                        >
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={() => handleToggleSelectOne(item.id)}
                                                    disabled={isProcessing}
                                                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                                                />
                                            </td>
                                            <td className="p-3 text-center text-slate-400 font-mono font-bold">
                                                {stt}
                                            </td>
                                            <td className="p-3">
                                                <span className="font-mono font-black text-slate-800 text-xs">
                                                    {item.code}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-800">{item.customerName}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                                        item.group === 'group_1' 
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                        {item.shortType || item.groupLabel}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 truncate max-w-[150px]" title={item.recordType}>
                                                        {item.recordType}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono font-bold text-[11px] border border-slate-200">
                                                    {item.receivedDateFormatted}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="space-y-1.5">
                                                    {item.fieldsToFix.map((f, fIdx) => (
                                                        <div key={fIdx} className="flex items-center gap-2 flex-wrap text-[11px]">
                                                            <span className="font-bold text-slate-600">{f.label}:</span>
                                                            <span className="px-1.5 py-0.5 bg-red-50 text-red-700 line-through rounded font-mono text-[10px] border border-red-200">
                                                                09/09/2026
                                                            </span>
                                                            <ArrowRight size={12} className="text-slate-400" />
                                                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 font-black rounded font-mono text-[10px] border border-emerald-200">
                                                                {item.receivedDateFormatted}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                {item.status === 'pending' && (
                                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200">
                                                        Chờ xử lý
                                                    </span>
                                                )}
                                                {item.status === 'processing' && (
                                                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200 animate-pulse">
                                                        Đang lưu...
                                                    </span>
                                                )}
                                                {item.status === 'success' && (
                                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black border border-emerald-300 flex items-center justify-center gap-1">
                                                        <Check size={11} strokeWidth={3} /> Đã sửa
                                                    </span>
                                                )}
                                                {item.status === 'error' && (
                                                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded-lg text-[10px] font-black border border-red-300" title={item.errorMessage}>
                                                        Lỗi lưu
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredItems.length > 0 && (
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <span>Hiển thị</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                                className="bg-white border border-slate-200 text-xs font-bold rounded-lg px-2 py-1"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                            <span>/ {filteredItems.length} hồ sơ</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="px-3 py-1 font-bold text-slate-700">
                                Trang {currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FixAssignedDatesTool;
