import React, { useState } from 'react';
import { X, Undo2, AlertCircle, Calendar, MessageSquare, PauseCircle, Ban, ArrowLeftRight } from 'lucide-react';
import { RecordFile, User, Employee } from '../types';

interface RejectReturnStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  currentUser: User | null;
  employees: Employee[];
  users?: User[];
  onConfirm: (reason: string, returnDateStr: string, returnOption: 'REJECT' | 'PAUSE' | 'PREVIOUS_STEP') => Promise<void>;
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
  const [returnOption, setReturnOption] = useState<'REJECT' | 'PAUSE' | 'PREVIOUS_STEP'>('PREVIOUS_STEP');
  const [reason, setReason] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || records.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập rõ lý do trả về / yêu cầu sửa!');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim(), returnDate, returnOption);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-rose-100 animate-fade-in-up">
        {/* Header */}
        <div className="bg-rose-600 px-5 py-4 text-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Undo2 size={22} />
            <span>Thao Tác Trả Về / Sửa Hồ Sơ</span>
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
          <div className="bg-rose-50/70 border border-rose-100 p-3 rounded-xl">
            <p className="text-xs font-bold text-rose-900 mb-1 flex items-center justify-between">
              <span>Hồ sơ thực hiện trả về sửa ({records.length}):</span>
              <span className="bg-rose-200 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                {records.length} hồ sơ
              </span>
            </p>
            <div className="max-h-24 overflow-y-auto space-y-1 text-xs pr-1">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white p-2 rounded border border-rose-100 font-medium">
                  <span className="font-bold text-slate-800 font-mono">{r.code}</span>
                  <span className="text-slate-600 truncate max-w-[160px]">{r.customerName}</span>
                  <span className="text-rose-700 font-semibold text-[11px] bg-rose-50 px-1.5 py-0.5 rounded">
                    Thụ lý: {getEmployeeName(r.assignedTo || r.lastAssignedTo)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* THÔNG TIN MỤC 3: TRẢ VỀ CÁN BỘ THỤ LÝ ĐỂ SỬA CHỮA */}
          <div className="bg-blue-50/80 border-2 border-blue-400 p-3.5 rounded-xl text-blue-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-blue-900 border-b border-blue-200 pb-1.5">
              <ArrowLeftRight size={18} className="text-blue-600 shrink-0" />
              <span>Mục 3: Trả về cán bộ thụ lý (Yêu cầu sửa chữa / hoàn thiện)</span>
            </div>
            <p className="text-xs text-blue-900/90 leading-relaxed font-medium">
              Chuyển hồ sơ về trạng thái <strong>Đang thực hiện</strong> cho cán bộ chuyên môn thụ lý chỉnh sửa.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="bg-white p-2 rounded-lg border border-blue-200 text-blue-900 font-medium">
                <span className="font-bold text-emerald-700 block mb-0.5">📝 LƯU LỊCH SỬ NỘI BỘ:</span>
                • Ngày trình kiểm tra cũ (nếu có)<br/>
                • Ngày trình ký cũ (nếu có)<br/>
                • Lý do trả hồ sơ
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-200 text-blue-900 font-medium">
                <span className="font-bold text-rose-700 block mb-0.5">✕ RESET NGÀY THÁNG:</span>
                • Xóa ngày trình / đã kiểm tra / ký<br/>
                • Chuyển về trạng thái Đang thực hiện
              </div>
            </div>
          </div>

          {/* Input: Lý do trả */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
              <MessageSquare size={16} className="text-rose-600" />
              <span>Lý do thực hiện (Lưu vào Ghi chú nội bộ)</span>
              <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2.5}
              required
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none font-medium text-slate-800 placeholder:text-gray-400"
              placeholder="Nhập chi tiết nội dung yêu cầu cán bộ thụ lý sửa chữa hoàn thiện hồ sơ..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Input: Ngày trả */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
              <Calendar size={16} className="text-indigo-600" />
              <span>Ngày thực hiện</span>
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-xl px-3.5 py-1.5 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-semibold text-slate-700 bg-gray-50"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
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
              {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Thực Hiện'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectReturnStepModal;
