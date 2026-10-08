import React, { useState, useRef } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Database,
  Play,
  FileJson,
  RefreshCw,
  Download,
  Copy,
  ShieldCheck,
  SkipForward,
  PlusCircle,
  Loader2,
} from 'lucide-react';
import { RecordFile, User, NotifyFunction } from '../../types';
import { STATUS_LABELS } from '../../constants';
import {
  BackupSynchronizer,
  BackupSyncAnalysis,
  BackupSyncResult,
  TargetRecordTable,
} from '../../services/backupSynchronizer';

interface BackupSyncTabProps {
  records?: RecordFile[];
  currentUser: User;
  notify: NotifyFunction;
  onRefreshData?: () => void | Promise<void>;
}

const TABLE_LABELS: Record<TargetRecordTable, { name: string; badgeClass: string }> = {
  luutru_records: {
    name: 'Lưu trữ (luutru_records)',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  land_records: {
    name: 'Đo đạc (land_records)',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  dangky_records: {
    name: 'Đăng ký (dangky_records)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
};

export const BackupSyncTab: React.FC<BackupSyncTabProps> = ({
  records = [],
  notify,
  onRefreshData,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawBackupJson, setRawBackupJson] = useState<any | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [alsoSkipMatchingCode, setAlsoSkipMatchingCode] = useState<boolean>(false);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<BackupSyncAnalysis | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; message: string }>({
    processed: 0,
    total: 0,
    message: '',
  });
  const [syncResult, setSyncResult] = useState<BackupSyncResult | null>(null);

  const runAnalysis = async (jsonContent: any, fileName: string, skipCode: boolean) => {
    setIsAnalyzing(true);
    setSyncResult(null);
    try {
      const res = await BackupSynchronizer.analyzeBackup(jsonContent, records, {
        fileName,
        alsoSkipMatchingCode: skipCode,
      });
      setAnalysis(res);
      notify(
        `Đã phân tích file "${fileName}": Phát hiện ${res.missingCount} hồ sơ chưa tồn tại cần thêm mới (${res.existingCount} hồ sơ đã có sẽ được bỏ qua).`,
        'info'
      );
    } catch (err: any) {
      console.error('[BackupSyncTab] Lỗi phân tích file backup:', err);
      notify(`Lỗi đọc file backup: ${err?.message || 'Định dạng JSON không hợp lệ'}`, 'error');
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setRawBackupJson(parsed);
      await runAnalysis(parsed, file.name, alsoSkipMatchingCode);
    } catch (err: any) {
      console.error('[BackupSyncTab] Lỗi parse JSON:', err);
      notify(`Không thể đọc tệp JSON: ${err?.message || 'Tệp không đúng chuẩn JSON'}`, 'error');
      setRawBackupJson(null);
      setAnalysis(null);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleToggleSkipCode = async (checked: boolean) => {
    setAlsoSkipMatchingCode(checked);
    if (rawBackupJson && selectedFileName) {
      await runAnalysis(rawBackupJson, selectedFileName, checked);
    }
  };

  const handleReAnalyze = async () => {
    if (!rawBackupJson) return;
    await runAnalysis(rawBackupJson, selectedFileName, alsoSkipMatchingCode);
  };

  const handleExecuteSync = async () => {
    if (!analysis || analysis.missingCount === 0) {
      notify('Không có hồ sơ mới nào cần chèn vào hệ thống.', 'info');
      return;
    }

    setIsSyncing(true);
    setProgress({ processed: 0, total: analysis.missingCount, message: 'Đang khởi tạo đồng bộ gia tăng...' });

    try {
      const result = await BackupSynchronizer.synchronizeIncremental(analysis, records, {
        alsoSkipMatchingCode,
        chunkSize: 50,
        onProgress: (processed, total, message) => {
          setProgress({ processed, total, message });
        },
      });

      setSyncResult(result);
      if (onRefreshData) {
        await onRefreshData();
      }

      // Cập nhật lại bảng phân tích sau khi đã chèn
      if (rawBackupJson) {
        const updatedAnalysis = await BackupSynchronizer.analyzeBackup(rawBackupJson, records, {
          fileName: selectedFileName,
          alsoSkipMatchingCode,
        });
        setAnalysis(updatedAnalysis);
      }

      notify(
        `Đồng bộ hoàn tất! Đã thêm mới ${result.insertedCount} hồ sơ và giữ nguyên ${result.skippedCount} hồ sơ hiện có.`,
        result.failedCount === 0 ? 'success' : 'error'
      );
    } catch (err: any) {
      console.error('[BackupSyncTab] Lỗi đồng bộ backup:', err);
      notify(`Lỗi khi đồng bộ: ${err?.message || 'Không xác định'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyLogs = () => {
    const activeLogs = syncResult?.logs || analysis?.logs || [];
    if (activeLogs.length === 0) return;
    navigator.clipboard.writeText(activeLogs.join('\n'));
    notify('Đã sao chép nhật ký (Log) vào bộ nhớ tạm!', 'success');
  };

  const handleDownloadLogs = () => {
    const activeLogs = syncResult?.logs || analysis?.logs || [];
    if (activeLogs.length === 0) return;
    const content = activeLogs.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `log_dong_bo_backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeLogs = syncResult?.logs || analysis?.logs || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-5 bg-[#f1f5f9]">
      {/* Banner Giải thích Quy tắc Bảo toàn Dữ liệu */}
      <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                BackupSynchronizer — Đồng bộ Gia tăng từ File Backup JSON
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Công cụ đối chiếu <strong>ID</strong> từng hồ sơ trong file Backup với cơ sở dữ liệu hiện tại (trên cả 3 bảng{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">luutru_records</code>,{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">land_records</code>,{' '}
                <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">dangky_records</code>):
              </p>
              <div className="flex flex-wrap gap-3 mt-2.5 text-xs font-medium text-slate-700">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  1. Chỉ chèn hồ sơ có ID chưa tồn tại
                </span>
                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-md">
                  <SkipForward size={14} className="text-blue-600" />
                  2. Bỏ qua 100% hồ sơ đã có (Không ghi đè dữ liệu mới)
                </span>
                <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-md">
                  <Database size={14} className="text-purple-600" />
                  3. Định tuyến chính xác bảng nghiệp vụ & xuất Log chi tiết
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing || isSyncing}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <Upload size={17} />
              Chọn File Backup (.json)
            </button>
            {rawBackupJson && (
              <button
                onClick={handleReAnalyze}
                disabled={isAnalyzing || isSyncing}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg border border-slate-300 transition-all flex items-center gap-1.5"
                title="Đối chiếu lại với dữ liệu hiện tại"
              >
                <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                Quét lại
              </button>
            )}
          </div>
        </div>

        {/* Tùy chọn nâng cao */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alsoSkipMatchingCode}
              onChange={e => handleToggleSkipCode(e.target.checked)}
              disabled={isAnalyzing || isSyncing}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              Kiểm tra bỏ qua cả hồ sơ trùng <strong>Mã hồ sơ (code)</strong> ngoài việc đối chiếu theo <strong>ID</strong>
            </span>
          </label>

          {selectedFileName && (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
              <FileJson size={14} className="text-indigo-600" />
              <span>
                Tệp đang chọn: <strong className="text-slate-800">{selectedFileName}</strong>
              </span>
              {analysis?.backupTime && (
                <span className="text-slate-400">
                  | Thời điểm sao lưu: {new Date(analysis.backupTime).toLocaleString('vi-VN')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trạng thái đang phân tích */}
      {isAnalyzing && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center shadow-sm">
          <Loader2 size={32} className="animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-semibold text-slate-700">
            Đang đối chiếu ID hồ sơ trong file Backup với CSDL hiện tại...
          </p>
        </div>
      )}

      {/* Bảng Thống kê & Xem trước Kết quả Phân tích */}
      {analysis && !isAnalyzing && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase">Tổng hồ sơ trong Backup</div>
              <div className="text-2xl font-extrabold text-slate-800 mt-1">
                {analysis.totalInBackup.toLocaleString('vi-VN')}
              </div>
              <div className="text-xs text-slate-500 mt-1">Đã chuẩn hóa & khử trùng lặp</div>
            </div>

            <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-blue-600 uppercase flex items-center gap-1">
                <SkipForward size={14} /> Đã tồn tại (Bỏ qua)
              </div>
              <div className="text-2xl font-extrabold text-blue-700 mt-1">
                {analysis.existingCount.toLocaleString('vi-VN')}
              </div>
              <div className="text-xs text-slate-500 mt-1">Giữ nguyên 100% dữ liệu hiện có</div>
            </div>

            <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
              <div className="text-xs font-semibold text-emerald-600 uppercase flex items-center gap-1">
                <PlusCircle size={14} /> Chưa tồn tại (Sẽ thêm mới)
              </div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                {analysis.missingCount.toLocaleString('vi-VN')}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Lưu trữ: <strong>{analysis.missingByTable.luutru_records}</strong> | Đo đạc:{' '}
                <strong>{analysis.missingByTable.land_records}</strong> | Đăng ký:{' '}
                <strong>{analysis.missingByTable.dangky_records}</strong>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm flex flex-col justify-between">
              <div className="text-xs font-semibold text-indigo-600 uppercase">Thao tác Thực thi</div>
              <button
                onClick={handleExecuteSync}
                disabled={isSyncing || analysis.missingCount === 0}
                className="mt-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang chèn hồ sơ...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Chèn {analysis.missingCount} hồ sơ chưa có
                  </>
                )}
              </button>
              <div className="text-[11px] text-slate-500 mt-1 text-center">
                Chế độ: <code className="font-semibold">ON CONFLICT (id) DO NOTHING</code>
              </div>
            </div>
          </div>

          {/* Thanh tiến trình khi đang đồng bộ */}
          {isSyncing && (
            <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-sm">
              <div className="flex justify-between text-xs font-bold text-indigo-700 mb-1.5">
                <span>{progress.message}</span>
                <span>
                  {progress.processed}/{progress.total} (
                  {progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-200"
                  style={{
                    width: `${progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Thông báo kết quả sau khi chạy xong */}
          {syncResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={22} />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">
                    Kết quả Đồng bộ Gia tăng: Đã thêm mới {syncResult.insertedCount} hồ sơ!
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    • Lưu trữ (<code className="font-mono">luutru_records</code>):{' '}
                    <strong>{syncResult.insertedByTable.luutru_records}</strong> hồ sơ | Đo đạc (
                    <code className="font-mono">land_records</code>):{' '}
                    <strong>{syncResult.insertedByTable.land_records}</strong> hồ sơ | Đăng ký (
                    <code className="font-mono">dangky_records</code>):{' '}
                    <strong>{syncResult.insertedByTable.dangky_records}</strong> hồ sơ
                    <br />• Đã bỏ qua an toàn: <strong>{syncResult.skippedCount}</strong> hồ sơ đã tồn tại trên hệ thống.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Danh sách hồ sơ chưa tồn tại sẽ được chèn & Nhật ký Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bảng danh sách hồ sơ cần thêm mới */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden max-h-[460px]">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Danh sách hồ sơ chưa tồn tại ({analysis.missingCandidates.length})
                </h3>
                {analysis.unroutableCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    <AlertTriangle size={12} /> {analysis.unroutableCount} không rõ bảng
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {analysis.missingCandidates.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Tất cả hồ sơ trong file Backup đều đã có mặt trên hệ thống hiện tại.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3 border-b">#</th>
                        <th className="py-2 px-3 border-b">Mã HS</th>
                        <th className="py-2 px-3 border-b">Chủ sử dụng</th>
                        <th className="py-2 px-3 border-b">Trạng thái</th>
                        <th className="py-2 px-3 border-b">Bảng đích</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analysis.missingCandidates.slice(0, 300).map((item, idx) => {
                        const r = item.record;
                        const tblInfo = TABLE_LABELS[item.targetTable];
                        return (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              <div>{r.code || '(Không mã)'}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]" title={r.id}>
                                ID: {r.id}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              <div className="font-medium">{r.customerName}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[160px]">{r.recordType}</div>
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {(STATUS_LABELS as any)[r.status] || r.status}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${tblInfo.badgeClass}`}
                              >
                                {tblInfo.name}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Khung Nhật ký (Log) kết quả */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden max-h-[460px]">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Nhật ký đối chiếu & kết quả đồng bộ (Log)
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLogs}
                    disabled={activeLogs.length === 0}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded flex items-center gap-1"
                  >
                    <Copy size={12} /> Sao chép
                  </button>
                  <button
                    onClick={handleDownloadLogs}
                    disabled={activeLogs.length === 0}
                    className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded flex items-center gap-1"
                  >
                    <Download size={12} /> Tải file Log
                  </button>
                </div>
              </div>

              <div className="flex-1 p-3 bg-slate-900 text-slate-100 font-mono text-xs overflow-auto whitespace-pre-wrap leading-relaxed">
                {activeLogs.length === 0
                  ? 'Chưa có nhật ký hoạt động.'
                  : activeLogs.join('\n')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BackupSyncTab;
