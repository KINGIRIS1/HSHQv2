import React, { useState, useEffect } from 'react';
import { RecordFile, User, UserRole } from '../types';
import { updateRecordApi } from '../services/api';
import { CalendarClock, X, Loader2, Save } from 'lucide-react';

interface ExtendDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  currentUser?: User | null;
  onRefreshData?: () => void;
}

export const ExtendDeadlineModal: React.FC<ExtendDeadlineModalProps> = ({
  isOpen,
  onClose,
  record,
  currentUser,
  onRefreshData
}) => {
  const [extendDate, setExtendDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setExtendDate(record.deadline ? record.deadline.split('T')[0] : '');
      setExtendReason('');
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Chưa có';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Chưa có' : d.toLocaleDateString('vi-VN');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendDate) {
      alert('Vui lòng chọn ngày hẹn mới.');
      return;
    }
    if (!extendReason.trim()) {
      alert('Vui lòng nhập lý do gia hạn.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowStr = new Date().toLocaleString('vi-VN');
      const userLabel = currentUser
        ? `${currentUser.name} (${currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Quản trị'})`
        : 'Hệ thống';
      const extensionNote = `[Gia hạn ngày hẹn] Hạn cũ: ${formatDate(record.deadline)} -> Hạn mới: ${formatDate(extendDate)}. Lý do: ${extendReason.trim()} (Bởi: ${userLabel} lúc ${nowStr})`;

      const newPrivateNotes = record.privateNotes
        ? `${record.privateNotes}\n${extensionNote}`
        : extensionNote;

      const updatedRecord: RecordFile = {
        ...record,
        deadline: extendDate,
        privateNotes: newPrivateNotes
      };

      const result = await updateRecordApi(updatedRecord);
      if (result) {
        alert('Đã gia hạn ngày hẹn thành công!');
        if (onRefreshData) onRefreshData();
        onClose();
      } else {
        alert('Lỗi khi cập nhật ngày gia hạn.');
      }
    } catch (err) {
      console.error('Lỗi gia hạn:', err);
      alert('Có lỗi xảy ra khi thực hiện gia hạn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white">
          <div className="flex items-center gap-2">
            <CalendarClock size={20} />
            <h3 className="font-bold text-sm uppercase tracking-wide">Gia hạn hồ sơ</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-purple-50/60 p-3 rounded-lg border border-purple-100 text-xs text-purple-900 space-y-1">
            <p className="font-bold text-sm text-purple-950 font-mono">{record.code}</p>
            <p><strong>Chủ sử dụng:</strong> {record.customerName}</p>
            <p><strong>Hạn trả hiện tại:</strong> {formatDate(record.deadline)}</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Ngày hẹn trả mới <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={extendDate}
              onChange={(e) => setExtendDate(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Lý do gia hạn <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={extendReason}
              onChange={(e) => setExtendReason(e.target.value)}
              placeholder="Nhập chi tiết lý do gia hạn ngày hẹn trả..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Lưu gia hạn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
