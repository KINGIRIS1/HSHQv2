import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, ArrowRight, RefreshCw, CheckCircle, AlertTriangle, FileText, Server, History } from 'lucide-react';
import { NotifyFunction } from '../../types';
import { runRoutingAudit, executeAtomicRoutingMigration, RoutingAuditReport, MigrationBatchResult } from '../../services/adminDataMigration';

interface Props {
  notify: NotifyFunction;
  onRefreshData?: () => void | Promise<void>;
}

const RoutingMigrationTab: React.FC<Props> = ({ notify, onRefreshData }) => {
  const [auditReport, setAuditReport] = useState<RoutingAuditReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [migrating, setMigrating] = useState<boolean>(false);
  const [migrationResult, setMigrationResult] = useState<MigrationBatchResult | null>(null);

  const handleRunAudit = async () => {
    setLoading(true);
    setMigrationResult(null);
    try {
      const report = await runRoutingAudit();
      setAuditReport(report);
      if (report.conflictCount === 0) {
        notify('Tất cả hồ sơ đều định tuyến HỢP LỆ. Không có hồ sơ sai bảng!', 'success');
      } else {
        notify(`Phát hiện ${report.conflictCount} hồ sơ sai bảng cần di chuyển.`, 'info');
      }
    } catch (err: any) {
      notify(`Lỗi khi chạy Audit định tuyến: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunAudit();
  }, []);

  const handleExecuteMigration = async () => {
    if (!auditReport || auditReport.conflictCount === 0) {
      notify('Không có hồ sơ sai bảng nào để di chuyển!', 'info');
      return;
    }

    if (!window.confirm(`XÁC NHẬN MIGRATION AN TOÀN:\n\nBạn có chắc chắn muốn di chuyển ${auditReport.conflictCount} hồ sơ về đúng bảng dữ liệu?\nQuy trình sẽ tự động thực hiện: BACKUP -> VALIDATE -> INSERT -> VERIFY -> DELETE SOURCE -> FINAL VERIFY.`)) {
      return;
    }

    setMigrating(true);
    try {
      const result = await executeAtomicRoutingMigration();
      setMigrationResult(result);

      if (result.failCount === 0) {
        notify(`Migration thành công 100%! Đã di chuyển ${result.successCount} hồ sơ về đúng bảng. Batch ID: ${result.batchId}`, 'success');
      } else {
        notify(`Migration hoàn tất: ${result.successCount} thành công, ${result.failCount} thất bại. Vui lòng kiểm tra log.`, 'info');
      }

      if (onRefreshData) {
        await onRefreshData();
      }

      // Re-run audit to confirm 0 conflicts
      await handleRunAudit();
    } catch (err: any) {
      notify(`Lỗi trong quá trình Migration: ${err.message}`, 'error');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Database className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold tracking-tight">Công cụ Quản trị Migration & Audit Định tuyến Dữ liệu</h2>
            </div>
            <p className="text-sm text-slate-300">
              Chuẩn hóa 100% bảng lưu trữ theo Quy ước Mã hồ sơ chính thức (LT-* $\rightarrow$ luutru_records, TK/TQ/MD/TH-* $\rightarrow$ land_records, H19.151.11.22-* $\rightarrow$ dangky_records).
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRunAudit}
              disabled={loading || migrating}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded-xl font-medium text-sm transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Chạy Read-Only Audit</span>
            </button>
            <button
              onClick={handleExecuteMigration}
              disabled={loading || migrating || !auditReport || auditReport.conflictCount === 0}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Thực hiện Migration An Toàn</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      {auditReport && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hồ sơ Hợp lệ (ROUTING_VALID)</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{auditReport.validCount.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hồ sơ Cần di chuyển (CONFLICT)</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{auditReport.conflictCount}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thiếu Mã Thủ Tục</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{auditReport.missingProcedureCodeCount}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chưa xác định (UNRESOLVED)</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{auditReport.unresolvedCount}</p>
            </div>
            <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
              <Server className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Migration Results Banner if executed */}
      {migrationResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-900 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold text-base text-emerald-800">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Kết quả Migration Batch: {migrationResult.batchId}</span>
            </div>
            <span className="text-xs font-mono text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
              {new Date(migrationResult.timestamp).toLocaleString('vi-VN')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm font-medium">
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-slate-700">
              Tổng số xử lý: <span className="font-bold text-slate-900">{migrationResult.totalProcessed}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-emerald-700">
              Thành công: <span className="font-bold text-emerald-800">{migrationResult.successCount}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-100 text-rose-700">
              Thất bại: <span className="font-bold text-rose-800">{migrationResult.failCount}</span>
            </div>
          </div>

          <div className="text-xs text-emerald-800 flex items-center space-x-1.5">
            <History className="w-4 h-4 text-emerald-600" />
            <span>Toàn bộ payload gốc đã được lưu tự động vào Backup Batch dưới key <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900">MIGRATION_BACKUP_{migrationResult.batchId}</code></span>
          </div>
        </div>
      )}

      {/* Conflicts Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Danh sách Hồ sơ Cần di chuyển (Read-Only Preview)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Hiển thị thông tin chi tiết các hồ sơ sai bảng theo Quy ước mã chính thức</p>
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
            {auditReport?.conflicts.length || 0} hồ sơ
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
            <p className="text-sm font-medium">Đang kiểm tra toàn bộ cơ sở dữ liệu...</p>
          </div>
        ) : auditReport?.conflicts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">Cơ sở dữ liệu hoàn toàn hợp lệ!</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">Tất cả các hồ sơ hiện tại đều đang nằm đúng bảng dữ liệu quy định. Không phát hiện xung đột định tuyến.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">STT</th>
                  <th className="px-4 py-3">Mã hồ sơ</th>
                  <th className="px-4 py-3">Bảng hiện tại (Actual)</th>
                  <th className="px-4 py-3">Bảng đúng (Expected)</th>
                  <th className="px-4 py-3">Mã thủ tục</th>
                  <th className="px-4 py-3">Loại hồ sơ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditReport?.conflicts.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.code}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-md font-mono text-[11px] font-medium">
                        {item.actualTable}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md font-mono text-[11px] font-bold">
                          {item.expectedTable}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {item.procedureCode || <span className="text-amber-600 italic">Thủ tục chưa điền</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{item.recordType || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                        {item.status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutingMigrationTab;
