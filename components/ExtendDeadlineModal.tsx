import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { RecordFile, User, Employee } from '../types';
import { getShortRecordType } from '../constants';

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
  const [newDeadline, setNewDeadline] = useState('');
  const [executionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const target = records && records.length > 0 ? records[0] : null;

  useEffect(() => {
    if (target && target.deadline) {
      setNewDeadline(target.deadline.split('T')[0]);
    } else {
      setNewDeadline(new Date().toISOString().split('T')[0]);
    }
  }, [target]);

  if (!isOpen || !target) return null;

  const formatDateVN = (dStr?: string | null) => {
    if (!dStr) return 'Chưa có';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 p-6 space-y-5 animate-fade-in-up">
        {/* Header matching image */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-full bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
            <Clock size={22} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-snug">Gia hạn thời gian nhận kết quả</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Đặt thêm ngày hẹn mới trả kết quả cho người dân</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Info card matching image */}
        <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Mã hồ sơ:</span>
            <span className="font-bold text-slate-900 font-mono text-sm">{target.code}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Khách hàng:</span>
            <span className="font-bold text-slate-900 uppercase">{target.customerName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Loại hồ sơ:</span>
            <span className="font-semibold text-slate-800 text-right">{getShortRecordType(target.recordType) || target.recordType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Hẹn trả gốc:</span>
            <span className="font-bold text-blue-600 text-sm">{formatDateVN(target.originalDeadline || target.deadline)}</span>
          </div>
        </div>

        {/* New deadline date picker */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              NGÀY GIA HẠN MỚI
            </label>
            <div className="relative">
              <input
                type="date"
                required
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-medium text-slate-800 bg-white shadow-xs"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
              />
            </div>
          </div>

          {/* Action buttons matching image */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 border border-slate-200 rounded-2xl text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer text-center"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newDeadline}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer text-center disabled:opacity-50"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu và in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExtendDeadlineModal;
