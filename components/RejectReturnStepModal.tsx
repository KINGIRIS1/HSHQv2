import React, { useState } from 'react';
import { X, Undo2, AlertCircle, Calendar, UserCheck, MessageSquare } from 'lucide-react';
import { RecordFile, User, Employee } from '../types';

interface RejectReturnStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  currentUser: User | null;
  employees: Employee[];
  users?: User[];
  onConfirm: (reason: string, returnDateStr: string) => Promise<void>;
}

export const RejectReturnStepModal: React.FC<RejectReturnStepModalProps> = ({
  isOpen,
  onClose,
  records,
  currentUser,
  employees,
  users = [],
  onConfirm
}) => {
  const [reason, setReason] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || records.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập rõ lý do trả hồ sơ / yêu cầu sửa đổi!');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim(), returnDate);
      setReason('');
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Có lỗi xảy ra khi trả hồ sơ. Vui lòng thử lại.');
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-rose-100 animate-fade-in-up">
        {/* Header */}
        <div className="bg-rose-600 px-5 py-4 text-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Undo2 size={22} />
            <span>Trả Hồ Sơ Về Bước Trước (Yêu Cầu Sửa)</span>
          </div>
          <button onClick={onClose} className="text-rose-100 hover:text-white p-1 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* List of target records summary */}
          <div className="bg-rose-50/70 border border-rose-100 p-3.5 rounded-xl">
            <p className="text-xs font-bold text-rose-900 mb-1.5 flex items-center justify-between">
              <span>Đang chọn {records.length} hồ sơ để trả:</span>
              <span className="bg-rose-200 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-mono">
                {records.length} hồ sơ
              </span>
            </p>
            <div className="max-h-28 overflow-y-auto space-y-1 text-xs pr-1">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white p-2 rounded border border-rose-100 font-medium">
                  <span className="font-bold text-slate-800 font-mono">{r.code}</span>
                  <span className="text-slate-600 truncate max-w-[180px]">{r.customerName}</span>
                  <span className="text-rose-700 font-semibold text-[11px] bg-rose-50 px-1.5 py-0.5 rounded">
                    NV: {getEmployeeName(r.assignedTo)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Input 1: Lý do trả */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
              <MessageSquare size={16} className="text-rose-600" />
              <span>Lý do trả / Yêu cầu sửa đổi</span>
              <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none font-medium text-slate-800 placeholder:text-gray-400"
              placeholder="Nhập chi tiết lý do chưa đạt, sai sót hoặc nội dung cần người thực hiện chỉnh sửa bổ sung..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Input 2: Ngày trả hồ sơ */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-600" />
              <span>Ngày trả hồ sơ</span>
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none font-semibold text-slate-700 bg-gray-50"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>

          {/* Notice info */}
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 leading-relaxed flex items-start gap-2">
            <UserCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              Hồ sơ bị trả sẽ tự động chuyển về bước <strong>Đang thực hiện</strong> (Hồ sơ cá nhân) của cán bộ xử lý (<strong>{records.map(r => getEmployeeName(r.assignedTo)).filter((v,i,a)=>a.indexOf(v)===i).join(', ')}</strong>). 
              Nhật ký và lý do trả sẽ được lưu trữ tự động để phục vụ truy vết.
            </div>
          </div>

          {/* Submit Actions */}
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
              disabled={isSubmitting || !reason.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
            >
              <Undo2 size={16} />
              {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Trả Hồ Sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectReturnStepModal;
