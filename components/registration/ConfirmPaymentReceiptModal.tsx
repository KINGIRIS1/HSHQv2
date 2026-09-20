import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  CreditCard,
  Calendar,
  FileCheck,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  UserCheck,
  Clock,
} from 'lucide-react';
import { RecordFile } from '../../types';

interface ConfirmPaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: RecordFile[];
  onConfirmPayment: (
    records: RecordFile[],
    receiptData: { receiptDate: string; receiptNumber: string; note: string }
  ) => Promise<void>;
}

export const ConfirmPaymentReceiptModal: React.FC<ConfirmPaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  selectedRecords,
  onConfirmPayment,
}) => {
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setErrorMsg('');
      if (selectedRecords.length === 1) {
        setReceiptNumber(selectedRecords[0].receiptNumber || '');
        setReceiptDate(
          selectedRecords[0].taxPaymentDate ||
          selectedRecords[0].paymentReceiptDate ||
          new Date().toISOString().substring(0, 10)
        );
        setNote('');
      } else {
        setReceiptNumber('');
        setReceiptDate(new Date().toISOString().substring(0, 10));
        setNote('');
      }
    }
  }, [isOpen, selectedRecords]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const preAssignedCount = selectedRecords.filter(
    (r) => r.printStaffId || (r as any).print_staff_id
  ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    if (!receiptDate) {
      setErrorMsg('Vui lòng chọn ngày nộp tiền / biên lai.');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setErrorMsg('');
      await onConfirmPayment(selectedRecords, {
        receiptDate,
        receiptNumber: receiptNumber.trim(),
        note: note.trim(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi xác nhận Giấy nộp tiền.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Xác nhận đã có Giấy nộp tiền (GNT)</h3>
              <p className="text-xs text-emerald-100">
                Bộ phận Một cửa xác nhận chứng từ nghĩa vụ tài chính
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dynamic Info Callout based on pre-assignment status */}
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>Quy trình chuyển tiếp tự động:</span>
            </div>
            {preAssignedCount > 0 ? (
              <p>
                Có <strong>{preAssignedCount}/{selectedRecords.length}</strong> hồ sơ đã được giao trước cán bộ In GCN. Sau khi xác nhận, hệ thống sẽ <strong>tự động chuyển thẳng vào Tab In GCN</strong> và tính hạn xử lý In GCN từ ngày nộp tiền.
              </p>
            ) : (
              <p>
                Hồ sơ chưa được giao trước cán bộ In GCN. Sau khi xác nhận GNT, hồ sơ sẽ chuyển sang trạng thái <strong>Chờ giao cán bộ In GCN</strong> để Lãnh đạo phân công.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Danh sách hồ sơ ({selectedRecords.length})
            </label>
            <div className="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
              {selectedRecords.map((rec) => {
                const printStaff = rec.printStaffId || (rec as any).print_staff_id;
                return (
                  <div key={rec.id} className="text-xs text-slate-700 flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                    <span className="font-semibold text-emerald-800 flex items-center gap-1">
                      <FileText size={13} className="text-emerald-600" />
                      {rec.code}
                    </span>
                    <span className="text-slate-500 truncate max-w-[150px]">{rec.customerName}</span>
                    {printStaff ? (
                      <span className="text-[11px] bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                        <UserCheck size={12} /> {printStaff}
                      </span>
                    ) : (
                      <span className="text-[11px] bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-md">
                        Chưa giao in
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ngày nộp tiền / Biên lai <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
                />
                <Calendar
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Số biên lai / Số GNT
              </label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="VD: BL-2024-00129"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ghi chú chứng từ (Tùy chọn)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Đã nộp đủ tiền thuế môn bài, trước bạ tại Kho bạc Nhà nước..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all outline-none resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang ghi nhận...</span>
                </>
              ) : (
                <>
                  <FileCheck size={16} />
                  <span>Xác nhận Đã có GNT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
