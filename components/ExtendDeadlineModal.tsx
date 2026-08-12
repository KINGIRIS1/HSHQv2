import React, { useState } from 'react';
import { X, CalendarClock, AlertCircle, Calendar, MessageSquare, Clock } from 'lucide-react';
import { RecordFile, User, Employee } from '../types';

interface ExtendDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  currentUser: User | null;
  employees: Employee[];
  users?: User[];
  onConfirm: (newDeadline: string, reason: string, executionDateStr: string) => Promise<void>;
}

export const ExtendDeadlineModal: React.FC<ExtendDeadlineModalProps> = ({
  isOpen,
  onClose,
  records,
  currentUser,
  employees,
  users = [],
  onConfirm
}) => {
  const [newDeadline, setNewDeadline] = useState(() => {
    if (records.length > 0 && records[0].deadline) {
      return records[0].deadline.split('T')[0];
    }
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('');
  const [executionDate, setExecutionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || records.length === 0) return null;

  const formatDateVN = (dStr?: string | null) => {
    if (!dStr) return 'Chưa có';
    try {
      const d = new Date(dStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dStr;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeadline) {
      setErrorMsg('Vui lòng chọn ngày hẹn trả mới!');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập lý do gia hạn!');
      return;
    }
    if (!isAgreed) {
      setErrorMsg('Vui lòng tích chọn đồng ý trước khi thực hiện!');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onConfirm(newDeadline, reason.trim(), executionDate);
      setReason('');
      setIsAgreed(false);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Có lỗi xảy ra khi thực hiện gia hạn. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-amber-100 animate-fade-in-up">
        {/* Header */}
        <div className="bg-amber-600 px-5 py-3.5 text-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2.5 font-bold text-lg">
            <CalendarClock size={22} className="shrink-0" />
            <span>Thao Tác Gia Hạn Hẹn Trả</span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-amber-100 hover:text-white p-1 rounded-lg hover:bg-amber-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Target Records */}
          <div className="bg-amber-50/60 border border-amber-100 p-3.5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-900">
                Hồ sơ thực hiện gia hạn ({records.length}):
              </span>
              <span className="bg-amber-200/80 text-amber-900 text-[11px] px-2 py-0.5 rounded-full font-bold">
                {records.length} hồ sơ
              </span>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1.5 text-xs pr-1">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-amber-100/80 font-medium shadow-xs">
                  <span className="font-bold text-slate-800 font-mono tracking-tight">{r.code}</span>
                  <span className="text-slate-700 font-semibold truncate max-w-[160px] uppercase">{r.customerName}</span>
                  <span className="text-amber-800 font-bold text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Hạn cũ: {formatDateVN(r.deadline)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: New Deadline Date */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <Clock size={15} className="text-amber-600" />
              <span>Ngày hẹn trả mới (Hạn giao mới)</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-bold text-amber-900 bg-amber-50/40"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
            />
          </div>

          {/* Section 3: Extension Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <MessageSquare size={15} className="text-amber-600" />
              <span>Lý do gia hạn hẹn trả</span>
              <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium text-slate-800 placeholder:text-slate-400 resize-none"
              placeholder="Nhập chi tiết lý do gia hạn ngày hẹn..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Section 4: Execution Date */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <Calendar size={15} className="text-indigo-600" />
              <span>Ngày thực hiện gia hạn</span>
            </label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-semibold text-slate-700 bg-slate-50"
              value={executionDate}
              onChange={(e) => setExecutionDate(e.target.value)}
            />
          </div>

          {/* Section 5: Agreement Checkbox */}
          <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-xl flex items-start gap-2.5">
            <input
              type="checkbox"
              id="agree-extend-checkbox"
              checked={isAgreed}
              onChange={(e) => setIsAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="agree-extend-checkbox" className="text-xs font-semibold text-amber-950 cursor-pointer select-none leading-relaxed">
              Tôi đã xác nhận nội dung trên và <span className="font-bold underline text-amber-700">ĐỒNG Ý</span> thực hiện gia hạn hẹn trả cho hồ sơ này.
            </label>
          </div>

          {/* Section 6: Footer Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors active:scale-95"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newDeadline || !reason.trim() || !isAgreed}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
            >
              <CalendarClock size={16} />
              {isSubmitting ? 'Đang xử lý...' : 'Đồng Ý & Thực Hiện'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExtendDeadlineModal;
