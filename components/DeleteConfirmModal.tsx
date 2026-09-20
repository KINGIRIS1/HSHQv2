
import React, { useEffect, useState, useRef } from 'react';
import { X, AlertTriangle, Trash2, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (() => Promise<void>) | (() => void);
  title?: string;
  message?: string;
  record?: {
    code?: string;
    customerName?: string;
    receivedDate?: string | null;
    deadline?: string | null;
  } | null;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Xác nhận xóa hồ sơ", 
  message,
  record
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen]);

  // Lắng nghe phím Escape để đóng hộp thoại mà không thực hiện xóa
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Lỗi xóa hồ sơ:", err);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const formatDateDDMMYYYY = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const codeNumber = record?.code || '';
  const confirmQuestion = message || (codeNumber 
    ? `Bạn có đồng ý xóa mã hồ sơ số ${codeNumber} không?`
    : 'Bạn có đồng ý xóa hồ sơ này không?');

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in"
      onClick={(e) => {
        // Bấm ra ngoài nền đen để thoát hộp thoại -> KHÔNG xóa
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-scale-up">
        {/* Header với tiêu đề và nút đóng [X] */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2.5">
            <span className="p-1.5 bg-red-100 text-red-600 rounded-lg shrink-0">
              <AlertTriangle size={18} />
            </span>
            {title}
          </h3>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Tắt hộp thoại (Không xóa)"
            aria-label="Tắt hộp thoại"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Nội dung câu hỏi và thông tin hồ sơ */}
        <div className="p-6">
          <p className="text-slate-700 text-sm font-medium leading-relaxed">
            {codeNumber ? (
              <span>
                Bạn có đồng ý xóa mã hồ sơ số <strong className="text-red-600 text-base font-bold underline decoration-red-300 underline-offset-2">{codeNumber}</strong> không?
              </span>
            ) : (
              <span>{confirmQuestion}</span>
            )}
          </p>

          <p className="text-slate-500 text-xs mt-1.5">
            Lưu ý: Hành động này không thể hoàn tác sau khi đã đồng ý xóa. Nếu bạn tắt dấu <strong className="text-slate-700">X</strong> hoặc chọn <strong className="text-slate-700">Hủy bỏ</strong>, hồ sơ sẽ được giữ nguyên.
          </p>

          {record && (
            <div className="mt-4 p-3.5 bg-red-50/60 rounded-xl border border-red-100 text-xs text-red-900 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Mã hồ sơ:</span>
                <span className="font-bold text-red-700 text-sm">{record.code || '---'}</span>
              </div>
              {record.customerName && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Chủ hồ sơ:</span>
                  <span className="font-semibold text-slate-800 max-w-[220px] truncate" title={record.customerName}>{record.customerName}</span>
                </div>
              )}
              {(record.receivedDate || record.deadline) && (
                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1.5 border-t border-red-200/50">
                  <span>Ngày nhận: <strong>{formatDateDDMMYYYY(record.receivedDate)}</strong></span>
                  <span>Hẹn trả: <strong>{formatDateDDMMYYYY(record.deadline)}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nút hành động */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button 
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-red-500/20 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang xóa</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Đồng ý</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
