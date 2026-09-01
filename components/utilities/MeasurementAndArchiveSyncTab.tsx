import React, { useState, useMemo } from 'react';
import { ShieldAlert, CheckCircle2, Wrench, Download, Upload, RefreshCw, AlertTriangle, Database, Users, Calendar, FileText, Check } from 'lucide-react';
import { RecordFile, Employee, NotifyFunction, RecordStatus } from '../../types';

interface MeasurementAndArchiveSyncTabProps {
    records: RecordFile[];
    employees: Employee[];
    onSaveRecord: (record: RecordFile) => Promise<any>;
    onRefreshData?: () => void | Promise<void>;
    notify: NotifyFunction;
}

export const MeasurementAndArchiveSyncTab: React.FC<MeasurementAndArchiveSyncTabProps> = ({
    records = [],
    employees = [],
    onSaveRecord,
    onRefreshData,
    notify
}) => {
    const [subTab, setSubTab] = useState<'measurement' | 'archive'>('measurement');

    // --- MEASUREMENT FIX STATE ---
    const [inspectorId, setInspectorId] = useState<string>('');
    const [checkDate, setCheckDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [selectedMissingIds, setSelectedMissingIds] = useState<Set<string>>(new Set());
    const [lastResultSummary, setLastResultSummary] = useState<{ updatedCount: number; timestamp: string } | null>(null);

    // Filter measurement records (dept contains 'đo đạc' or 'kỹ thuật' or has measurement data)
    const measurementRecords = useMemo(() => {
        return records.filter(r => {
            const dept = ((r as any).department || '').toLowerCase();
            return dept.includes('đo đạc') || dept.includes('kỹ thuật') || dept.measurementNumber || r.needsMapCorrection;
        });
    }, [records]);

    // Missing check date or check by
    const missingCheckRecords = useMemo(() => {
        return measurementRecords.filter(r => !r.checkedDate || !r.checkedBy);
    }, [measurementRecords]);

    // Select all / toggle
    const handleToggleSelectAll = () => {
        if (selectedMissingIds.size === missingCheckRecords.length) {
            setSelectedMissingIds(new Set());
        } else {
            setSelectedMissingIds(new Set(missingCheckRecords.map(r => r.id)));
        }
    };

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedMissingIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedMissingIds(next);
    };

    // Backup before run
    const handleDownloadBackup = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `backup_records_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        notify('Đã tải xuống file sao lưu dữ liệu (Backup) an toàn!', 'success');
    };

    // Execute batch fix for measurement
    const handleExecuteMeasurementFix = async () => {
        if (!inspectorId) {
            notify('Vui lòng chọn Người kiểm tra (Cán bộ phụ trách)!', 'error');
            return;
        }
        if (!checkDate) {
            notify('Vui lòng chọn Ngày kiểm tra!', 'error');
            return;
        }

        const targets = missingCheckRecords.filter(r => selectedMissingIds.size === 0 || selectedMissingIds.has(r.id));
        if (targets.length === 0) {
            notify('Không có hồ sơ nào cần vá lỗi được chọn.', 'info');
            return;
        }

        if (!window.confirm(`Xác nhận bổ sung thông tin kiểm tra cho ${targets.length} hồ sơ đo đạc?`)) {
            return;
        }

        setIsProcessing(true);
        try {
            const isoDate = new Date(checkDate + "T12:00:00").toISOString();
            let count = 0;
            for (const r of targets) {
                const updated: RecordFile = {
                    ...r,
                    checkedBy: r.checkedBy || inspectorId,
                    checkedDate: r.checkedDate || isoDate,
                    status: r.status === RecordStatus.RECEIVED || r.status === RecordStatus.ASSIGNED || r.status === RecordStatus.IN_PROGRESS || r.status === RecordStatus.COMPLETED_WORK || r.status === RecordStatus.PENDING_CHECK ? RecordStatus.CHECKED : r.status,
                    statusLogs: [
                        ...(r.statusLogs || []),
                        {
                            id: Math.random().toString(36).substr(2, 9),
                            recordId: r.id,
                            previousStatus: r.status,
                            newStatus: RecordStatus.CHECKED,
                            changedBy: inspectorId,
                            changedAt: new Date().toISOString(),
                            note: `Vá lỗi đồng loạt: Bổ sung ngày kiểm tra (${checkDate}) và người kiểm tra.`
                        }
                    ]
                };
                await onSaveRecord(updated);
                count++;
            }

            if (onRefreshData) await onRefreshData();
            setLastResultSummary({ updatedCount: count, timestamp: new Date().toLocaleTimeString() });
            setSelectedMissingIds(new Set());
            notify(`Đã cập nhật thành công ${count} hồ sơ đo đạc thiếu ngày kiểm tra!`, 'success');
        } catch (e) {
            console.error(e);
            notify('Có lỗi xảy ra khi cập nhật đồng loạt.', 'error');
        } finally {
            setIsProcessing(false);
        }
    };


    // --- ARCHIVE SYNC STATE ---
    const [importedArchiveData, setImportedArchiveData] = useState<RecordFile[]>([]);
    const [isSyncingArchive, setIsSyncingArchive] = useState<boolean>(false);
    const [archiveSyncSummary, setArchiveSyncSummary] = useState<string>('');

    const handleFileUploadArchive = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const parsed = JSON.parse(content);
                const list = Array.isArray(parsed) ? parsed : (parsed.records || parsed.data || []);
                setImportedArchiveData(list);
                notify(`Đã đọc thành công ${list.length} hồ sơ lưu trữ từ tệp dữ liệu!`, 'success');
            } catch (err) {
                console.error(err);
                notify('Định dạng tệp JSON không hợp lệ.', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleExecuteArchiveSync = async () => {
        if (importedArchiveData.length === 0) {
            notify('Không có dữ liệu hồ sơ lưu trữ để đồng bộ.', 'error');
            return;
        }

        if (!window.confirm(`Xác nhận đồng bộ ${importedArchiveData.length} hồ sơ vào hệ thống Lưu trữ?`)) {
            return;
        }

        setIsSyncingArchive(true);
        try {
            let countNew = 0;
            let countUpdated = 0;
            for (const item of importedArchiveData) {
                const existing = records.find(r => r.code === item.code);
                const payload: RecordFile = {
                    ...item,
                    group: 'Lưu trữ',
                    id: existing ? existing.id : (item.id || 'arch_' + Math.random().toString(36).substr(2, 9))
                };
                await onSaveRecord(payload);
                if (existing) countUpdated++;
                else countNew++;
            }

            if (onRefreshData) await onRefreshData();
            setArchiveSyncSummary(`Đồng bộ thành công: ${countNew} hồ sơ mới, ${countUpdated} hồ sơ cập nhật.`);
            notify('Đồng bộ dữ liệu lưu trữ thành công!', 'success');
        } catch (e) {
            console.error(e);
            notify('Lỗi trong quá trình đồng bộ dữ liệu lưu trữ.', 'error');
        } finally {
            setIsSyncingArchive(false);
        }
    };


    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto p-4 md:p-6 space-y-6">
            {/* Top SubNav */}
            <div className="flex bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm max-w-xl">
                <button
                    onClick={() => setSubTab('measurement')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${subTab === 'measurement' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <Wrench size={16} /> Vá lỗi Đo đạc (Thiếu ngày kiểm tra)
                </button>
                <button
                    onClick={() => setSubTab('archive')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${subTab === 'archive' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    <Database size={16} /> Đồng bộ Hồ sơ Lưu trữ
                </button>
            </div>

            {/* TAB 1: MEASUREMENT FIX */}
            {subTab === 'measurement' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Diagnostic Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl">
                                {measurementRecords.length}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-500">Tổng số hồ sơ Đo đạc</h4>
                                <p className="text-xs text-slate-400 mt-0.5">Đang quản lý trong hệ thống</p>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xl">
                                {missingCheckRecords.length}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-rose-600">Hồ sơ lỗi phân mảnh</h4>
                                <p className="text-xs text-slate-400 mt-0.5">Thiếu ngày/người kiểm tra</p>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl">
                                {measurementRecords.length - missingCheckRecords.length}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-emerald-600">Hồ sơ chuẩn dữ liệu</h4>
                                <p className="text-xs text-slate-400 mt-0.5">Đã có đủ thông tin kiểm tra</p>
                            </div>
                        </div>
                    </div>

                    {/* Analysis & Recommendation Box */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-bold text-sm uppercase tracking-wide">Phân tích đánh giá & Đề xuất phương án an toàn dữ liệu</h4>
                                <p className="text-xs mt-1 text-amber-800 leading-relaxed">
                                    <strong>Nguyên nhân lỗi phân mảnh:</strong> Một số hồ sơ đo đạc được chuyển bước qua các mốc ký duyệt hoặc trả kết quả nhưng hệ thống cũ chưa tự động gán mốc <code>checkedDate</code> hoặc <code>checkedBy</code>.
                                    <br /><strong>Đề xuất giải pháp:</strong> Sử dụng công cụ bên dưới để chọn Cán bộ kiểm tra và Ngày kiểm tra tiêu chuẩn, hệ thống sẽ tự động vá các trường thiếu, đồng thời tự động cập nhật trạng thái hợp lệ mà không làm gián đoạn hay mất mát dữ liệu đang sử dụng. Luôn khuyến nghị <strong>tải file Backup JSON</strong> trước khi thực hiện.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action & Configuration Toolbar */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-4 flex-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Cán bộ Kiểm tra (Người kiểm tra)</label>
                                <select 
                                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
                                    value={inspectorId}
                                    onChange={(e) => setInspectorId(e.target.value)}
                                >
                                    <option value="">-- Chọn cán bộ kiểm tra --</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Ngày Kiểm tra chuẩn</label>
                                <input 
                                    type="date"
                                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={checkDate}
                                    onChange={(e) => setCheckDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleDownloadBackup}
                                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm flex items-center gap-2 transition-all shadow-sm"
                            >
                                <Download size={16} /> Tải Backup JSON
                            </button>
                            <button
                                onClick={handleExecuteMeasurementFix}
                                disabled={isProcessing || missingCheckRecords.length === 0}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                            >
                                {isProcessing ? <RefreshCw className="animate-spin" size={16} /> : <Wrench size={16} />}
                                Vá lỗi đồng loạt ({selectedMissingIds.size > 0 ? selectedMissingIds.size : missingCheckRecords.length} hồ sơ)
                            </button>
                        </div>
                    </div>

                    {/* Result Summary Notification */}
                    {lastResultSummary && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="text-emerald-600" size={20} />
                                <span className="text-sm font-bold">Đã vá lỗi thành công {lastResultSummary.updatedCount} hồ sơ lúc {lastResultSummary.timestamp}. Không còn lỗi phân mảnh trong các hồ sơ đã chọn!</span>
                            </div>
                            <button onClick={() => setLastResultSummary(null)} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">Đóng</button>
                        </div>
                    )}

                    {/* Compact List of Missing Records */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="text-rose-600" size={18} />
                                <h3 className="font-bold text-slate-800 text-sm">Danh sách hồ sơ Đo đạc thiếu thông tin kiểm tra ({missingCheckRecords.length})</h3>
                            </div>
                            <button 
                                onClick={handleToggleSelectAll}
                                className="text-xs font-bold text-blue-600 hover:underline"
                            >
                                {selectedMissingIds.size === missingCheckRecords.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </button>
                        </div>

                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 w-10 text-center">#</th>
                                        <th className="p-3">Mã HS</th>
                                        <th className="p-3">Chủ sử dụng</th>
                                        <th className="p-3">Xã/Phường</th>
                                        <th className="p-3">Trạng thái</th>
                                        <th className="p-3 text-center">Thiếu Ngày KT</th>
                                        <th className="p-3 text-center">Thiếu Người KT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {missingCheckRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                                                Tuyệt vời! Không có hồ sơ đo đạc nào bị thiếu thông tin kiểm tra.
                                            </td>
                                        </tr>
                                    ) : (
                                        missingCheckRecords.map((r, idx) => {
                                            const isChecked = selectedMissingIds.has(r.id);
                                            return (
                                                <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${isChecked ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="p-3 text-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleToggleSelect(r.id)}
                                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="p-3 font-bold text-blue-600">{r.code}</td>
                                                    <td className="p-3 font-medium text-slate-800">{r.customerName}</td>
                                                    <td className="p-3 text-slate-600">{r.ward}</td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {!r.checkedDate ? <span className="text-rose-600 font-bold">Thiếu ngày</span> : <span className="text-emerald-600"><Check size={14} className="inline"/></span>}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {!r.checkedBy ? <span className="text-rose-600 font-bold">Thiếu người</span> : <span className="text-emerald-600"><Check size={14} className="inline"/></span>}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ARCHIVE DATA SYNC */}
            {subTab === 'archive' && (
                <div className="space-y-6 animate-fade-in max-w-3xl mx-auto w-full">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                                <Database size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-base">Cập nhật & Đồng bộ Hồ sơ Lưu trữ từ Data dữ liệu lưu</h3>
                                <p className="text-xs text-slate-500">Tải lên tệp JSON chứa dữ liệu lưu trữ để cập nhật hàng loạt vào hệ thống</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center bg-slate-50 hover:bg-slate-100/50 transition-colors">
                                <Upload className="mx-auto text-slate-400 mb-3" size={36} />
                                <h4 className="font-bold text-slate-700 text-sm mb-1">Chọn hoặc kéo thả tệp JSON dữ liệu lưu trữ</h4>
                                <p className="text-xs text-slate-400 mb-4">Hỗ trợ cấu trúc mảng hồ sơ lưu trữ chuẩn</p>
                                <input 
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileUploadArchive}
                                    className="block mx-auto text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                                />
                            </div>

                            {importedArchiveData.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between text-blue-900">
                                    <div className="flex items-center gap-2">
                                        <FileText size={20} className="text-blue-600" />
                                        <span className="text-sm font-bold">Đã sẵn sàng đồng bộ {importedArchiveData.length} hồ sơ lưu trữ vào hệ thống.</span>
                                    </div>
                                    <button
                                        onClick={handleExecuteArchiveSync}
                                        disabled={isSyncingArchive}
                                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSyncingArchive ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                        Xác nhận đồng bộ ngay
                                    </button>
                                </div>
                            )}

                            {archiveSyncSummary && (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-bold">
                                    {archiveSyncSummary}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
