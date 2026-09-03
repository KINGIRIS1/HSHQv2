import React, { useState } from 'react';
import { RecordFile, Employee, User } from '../types';
import { X, Clock, Calendar } from 'lucide-react';

interface ExtendDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  currentUser: User;
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
  onConfirm,
}) => {
  const record = records[0] || null;
  const [newDeadline, setNewDeadline] = useState<string>(() => {
    if (record && record.deadline) {
      return record.deadline.split('T')[0];
    }
    return '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !record) return null;

  const formatDateVN = (dStr?: string | null) => {
    if (!dStr) return '--';
    const cleanStr = String(dStr).trim();
    const dateOnly = cleanStr.includes('T') ? cleanStr.split('T')[0] : cleanStr.split(' ')[0];
    const parts = dateOnly.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanStr)) return cleanStr;
    return cleanStr;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeadline) {
      setErrorMsg('Vui lòng chọn ngày gia hạn mới!');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      await onConfirm(newDeadline, 'Gia hạn thời gian nhận kết quả', todayStr);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Có lỗi xảy ra khi thực hiện gia hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4 select-none">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[480px] p-6 flex flex-col gap-6 animate-in zoom-in-95 duration-150">
        
        {/* Header matched perfectly to image */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#fef3c7] text-[#d97706] flex items-center justify-center shrink-0">
            <Clock size={24} className="stroke-[2.5]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#1e293b] text-lg leading-snug">
              Gia hạn thời gian nhận kết quả
            </h3>
            <p className="text-xs text-[#64748b] font-medium mt-0.5">
              Đặt thêm ngày hẹn mới trả kết quả cho người dân
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-colors self-start"
          >
            <X size={18} />
          </button>
        </div>

        {/* Record Details Container matched perfectly to image */}
        <div className="bg-[#f8fafc] border border-[#f1f5f9] rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-[#64748b]">Mã hồ sơ:</span>
            <span className="text-[#1e293b] font-mono tracking-tight">{record.code}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-[#64748b]">Khách hàng:</span>
            <span className="text-[#1e293b] uppercase truncate max-w-[280px]">{record.customerName || '--'}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-[#64748b]">Loại hồ sơ:</span>
            <span className="text-[#1e293b] truncate max-w-[280px]">{record.recordType || '--'}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-[#64748b]">Hẹn trả gốc:</span>
            <span className="text-[#2563eb] font-bold">{formatDateVN(record.deadline)}</span>
          </div>
        </div>

        {/* Input New Date */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMsg && (
            <div className="text-xs text-red-500 font-bold bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[11px] font-extrabold text-[#64748b] tracking-wider uppercase">
              NGÀY GIA HẠN MỚI
            </label>
            <div className="relative">
              <input
                type="date"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-semibold text-slate-700 bg-white"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
              />
            </div>
          </div>

          {/* Footer Action Buttons matched perfectly to image */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-1/2 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-[#334155] rounded-xl font-bold text-sm transition-all active:scale-95 cursor-pointer text-center shadow-xs"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newDeadline}
              className="w-1/2 py-3 bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer text-center"
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
