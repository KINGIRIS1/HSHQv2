import React, { useState } from 'react';
import { X, FileCheck, AlertCircle, MessageSquare } from 'lucide-react';
import { RecordFile, User, Employee } from '../types';

interface SupplementModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  currentUser: User | null;
  employees: Employee[];
  users?: User[];
  onConfirm: (note: string) => Promise<void>;
}

export const SupplementModal: React.FC<SupplementModalProps> = ({
  isOpen,
  onClose,
  records,
  employees,
  users = [],
  onConfirm
}) => {
  const [note, setNote] = useState('Đã nhận bổ sung đầy đủ từ người dân');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || records.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setErrorMsg('Vui lòng nhập ghi chú tiếp nhận bổ sung!');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onConfirm(note.trim());
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Có lỗi xảy ra khi thực hiện bổ sung. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEmployeeName = (empId?: string | null) => {
    if (!empId) return 'Chưa phân công';
    const emp = employees.find(e => e.id === empId);
    if (emp) return emp.name;
    const usr = users.find(u => u.username === empId || u.employeeId === empId);
    return usr ? usr.name : empId;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-amber-100 animate-fade-in-up">
        {/* Header */}
        <div className="bg-amber-600 px-5 py-4 text-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg">
            <FileCheck size={22} />
            <span>Thao Tác Tiếp Nhận Bổ Sung Hồ Sơ</span>
          </div>
          <button onClick={onClose} className="text-amber-100 hover:text-white p-1 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* List of target records summary */}
          <div className="bg-amber-50/70 border border-amber-200/60 p-3 rounded-xl">
            <p className="text-xs font-bold text-amber-900 mb-1 flex items-center justify-between">
              <span>Hồ sơ thực hiện bổ sung ({records.length}):</span>
              <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                {records.length} hồ sơ
              </span>
            </p>
            <div className="max-h-28 overflow-y-auto space-y-1 text-xs pr-1">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white p-2 rounded border border-amber-200/60 font-medium">
                  <span className="font-bold text-slate-800 font-mono">{r.code}</span>
                  <span className="text-slate-600 truncate max-w-[150px]">{r.customerName}</span>
                  <span className="text-amber-800 font-semibold text-[11px] bg-amber-50 px-1.5 py-0.5 rounded">
                    Thụ lý: {getEmployeeName(r.assignedTo || r.lastAssignedTo)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Input Note */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
              <MessageSquare size={16} className="text-amber-600" />
              <span>Ghi chú tiếp nhận bổ sung</span>
              <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium text-slate-800 placeholder:text-gray-400"
              placeholder="Nhập chi tiết ghi chú bổ sung..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <p className="text-xs text-slate-500 italic bg-gray-50 p-2.5 rounded-xl border border-gray-200">
            * Sau khi hoàn thành bổ sung, trạng thái hồ sơ sẽ được tự động chuyển từ <strong>Chờ bổ sung</strong> quay lại quy trình <strong>Đang thực hiện</strong> cho cán bộ thụ lý chuyên môn.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !note.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
            >
              <FileCheck size={16} />
              {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Bổ Sung & Tiếp Tục'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplementModal;
