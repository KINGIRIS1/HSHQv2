import React, { useState, useEffect } from 'react';
import { RecordFile, User } from '../types';
import { CalendarClock, X, Loader2, Save, AlertCircle } from 'lucide-react';

interface ExtendDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: RecordFile | null;
  records?: RecordFile[];
  currentUser?: User | null;
  onConfirm?: (extendDate: string, reason: string) => Promise<void>;
  onRefreshData?: () => void;
}

export const ExtendDeadlineModal: React.FC<ExtendDeadlineModalProps> = ({
  isOpen,
  onClose,
  record,
  records = [],
  currentUser,
  onConfirm
}) => {
  const [extendDate, setExtendDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const targetRecords = records.length > 0 ? records : (record ? [record] : []);

  useEffect(() => {
    if (isOpen && targetRecords.length > 0) {
      const firstRec = targetRecords[0];
      setExtendDate(firstRec.deadline ? firstRec.deadline.split('T')[0] : new Date().toISOString().split('T')[0]);
      setExtendReason('');
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen || targetRecords.length === 0) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Chưa có';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Chưa có' : d.toLocaleDateString('vi-VN');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendDate) {
      setErrorMsg('Vui lòng chọn ngày hẹn trả mới.');
      return;
    }
    if (!extendReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do gia hạn.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);
    try {
      if (onConfirm) {
        await onConfirm(extendDate, extendReason.trim());
      }
      onClose();
    } catch (err) {
      console.error('Lỗi gia hạn:', err);
      setErrorMsg('Có lỗi xảy ra khi thực hiện gia hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-purple-700 px-5 py-4 text-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg">
            <CalendarClock size={22} />
            <span>Thao Tác Gia Hạn Ngày Hẹn Hồ Sơ</span>
          </div>
          <button onClick={onClose} className="text-purple-100 hover:text-white p-1 rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* List of target records summary */}
          <div className="bg-purple-50/70 border border-purple-100 p-3 rounded-xl">
            <p className="text-xs font-bold text-purple-900 mb-1 flex items-center justify-between">
              <span>Hồ sơ thực hiện gia hạn ({targetRecords.length}):</span>
              <span className="bg-purple-200 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                {targetRecords.length} hồ sơ
              </span>
            </p>
            <div className="max-h-28 overflow-y-auto space-y-1 text-xs font-medium text-slate-700 divide-y divide-purple-100/60 pr-1">
              {targetRecords.map((r) => (
                <div key={r.id} className="pt-1 first:pt-0 flex items-center justify-between">
                  <span className="font-mono font-bold text-purple-950">{r.code}</span>
                  <span className="truncate max-w-[180px] text-slate-600">{r.customerName}</span>
                  <span className="text-[11px] text-purple-800 font-semibold bg-purple-100/80 px-1.5 py-0.5 rounded">
                    Hạn cũ: {formatDate(r.deadline)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              Ngày hẹn trả mới <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={extendDate}
              onChange={(e) => setExtendDate(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1.5">
              Lý do gia hạn <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={extendReason}
              onChange={(e) => setExtendReason(e.target.value)}
              placeholder="Nhập chi tiết lý do gia hạn ngày hẹn trả..."
              className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none font-medium text-slate-800"
            />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Lưu gia hạn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExtendDeadlineModal;

