import React, { useState } from 'react';
import { X, CalendarClock, AlertCircle, Clock, Calendar } from 'lucide-react';
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
  const [executionDate, setExecutionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || records.length === 0) return null;

  const target = records[0];

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

  const handleQuickAddDays = (days: number) => {
    const baseDate = target.deadline ? new Date(target.deadline) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    setNewDeadline(baseDate.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeadline) {
      setErrorMsg('Vui lòng chọn ngày hẹn trả mới!');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onConfirm(newDeadline, '', executionDate);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Có lỗi xảy ra khi thực hiện gia hạn. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-amber-100 animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-3.5 text-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2.5 font-bold text-base md:text-lg">
            <CalendarClock size={22} className="shrink-0 text-amber-200" />
            <span>Gia Hạn Hẹn Trả Kết Quả</span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-amber-100 hover:text-white p-1 rounded-lg hover:bg-amber-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Target Record Info Card */}
          <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 font-mono tracking-tight text-sm">
                {target.code}
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-300">
                Hạn cũ: {formatDateVN(target.deadline)}
              </span>
            </div>
            <div className="text-xs text-slate-700 font-semibold uppercase">
              {target.customerName}
            </div>
            {target.address && (
              <div className="text-[11px] text-slate-500 truncate">
                {target.address}
              </div>
            )}
          </div>

          {/* New Deadline Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock size={15} className="text-amber-600" />
                <span>Ngày hẹn trả mới (Hạn giao mới)</span>
                <span className="text-red-500">*</span>
              </label>
            </div>

            <input
              type="date"
              required
              className="w-full border-2 border-amber-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-600 outline-none font-bold text-amber-900 bg-amber-50/30 shadow-xs"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
            />

            {/* Quick Add Days Pills */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Tăng nhanh:</span>
              {[3, 5, 7, 10, 15].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => handleQuickAddDays(days)}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-100/80 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors border border-amber-300/80 active:scale-95"
                >
                  +{days} ngày
                </button>
              ))}
            </div>
          </div>

          {/* Execution Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={15} className="text-slate-500" />
              <span>Ngày thực hiện gia hạn</span>
            </label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50"
              value={executionDate}
              onChange={(e) => setExecutionDate(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs md:text-sm transition-colors active:scale-95 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newDeadline}
              className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs md:text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <CalendarClock size={16} />
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận gia hạn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExtendDeadlineModal;
