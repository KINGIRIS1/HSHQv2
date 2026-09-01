import React, { useState, useEffect } from 'react';
import { X, History, User, Clock, ArrowRight, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { RecordFile, RecordStatus } from '../types';
import { STATUS_LABELS } from '../constants';

interface RecordHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees?: any[];
}

const RecordHistoryModal: React.FC<RecordHistoryModalProps> = ({ isOpen, onClose, record, employees = [] }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
    }
  }, [isOpen, record?.id]);

  if (!isOpen || !record) return null;

  const logs = [...(record.statusLogs || [])].sort((a, b) => {
    return new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime();
  });

  const totalPages = Math.ceil(logs.length / itemsPerPage) || 1;
  const paginatedLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const resolveName = (changedBy: string) => {
    if (!changedBy) return 'Hệ thống';
    const emp = employees.find(e => e.id === changedBy || e.name === changedBy);
    if (emp) return emp.name;
    return changedBy;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl animate-fade-in-up overflow-hidden flex flex-col max-h-[85vh]">
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 md:p-5 border-b bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                Lịch sử thay đổi hồ sơ
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Xem toàn bộ các bước cập nhật trạng thái của hồ sơ này
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            id="close-history-modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* INFO BADGE */}
        <div className="px-5 py-4 bg-blue-50/50 border-b border-blue-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="space-y-1">
            <div className="text-xs text-slate-500 font-medium">Thông tin hồ sơ</div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-blue-800 bg-blue-100/60 px-2.5 py-1 rounded text-sm">
                {record.code || 'CHƯA CÓ MÃ'}
              </span>
              <span className="text-sm font-bold text-slate-700">
                {record.customerName || 'N/A'}
              </span>
            </div>
          </div>
          {record.receivedDate && (
            <div className="text-right text-xs">
              <span className="text-slate-500 block">Ngày tiếp nhận:</span>
              <span className="font-black text-slate-700">
                {new Date(record.receivedDate).toLocaleDateString('vi-VN')}
              </span>
            </div>
          )}
        </div>

        {/* LOGS TABLE / TIMELINE CONTAINER */}
        <div className="flex-1 overflow-y-auto p-5">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <FileText size={48} className="stroke-1 text-slate-300 mb-3" />
              <p className="text-sm font-medium">Chưa có nhật ký thay đổi cho hồ sơ này.</p>
              <p className="text-xs text-slate-400 mt-1">Các thao tác chuyển bước sẽ tự động lưu vết tại đây.</p>
            </div>
          ) : (
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-100">
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px] text-slate-500 w-[180px]">
                      <span className="flex items-center gap-1.5"><Clock size={12} /> Thời gian</span>
                    </th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px] text-slate-500 w-[150px]">
                      <span className="flex items-center gap-1.5"><User size={12} /> Người thao tác</span>
                    </th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                      Chuyển trạng thái
                    </th>
                    <th className="p-3 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                      Ghi chú / Nội dung
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      {/* THỜI GIAN */}
                      <td className="p-3 whitespace-nowrap text-slate-500 font-mono">
                        {log.changedAt ? new Date(log.changedAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      {/* NGƯỜI THỰC HIỆN */}
                      <td className="p-3 font-semibold text-slate-700">
                        {resolveName(log.changedBy)}
                      </td>
                      {/* TRẠNG THÁI */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {log.previousStatus ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {STATUS_LABELS[log.previousStatus as RecordStatus] || log.previousStatus}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-100">
                              Mới tạo
                            </span>
                          )}
                          <ArrowRight size={10} className="text-slate-400 shrink-0" />
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {STATUS_LABELS[log.newStatus as RecordStatus] || log.newStatus}
                          </span>
                        </div>
                      </td>
                      {/* GHI CHÚ */}
                      <td className="p-3 text-slate-600 font-medium italic break-words max-w-xs">
                        {log.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* PAGINATION FOOTER */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100 select-none">
                  <span className="text-xs text-slate-500 font-medium">
                    Trang <strong className="font-bold text-slate-700">{currentPage}</strong> / {totalPages} (Tổng {logs.length} logs)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md border border-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded transition-colors border ${
                          currentPage === p
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md border border-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-xs text-sm cursor-pointer"
          >
            Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordHistoryModal;
