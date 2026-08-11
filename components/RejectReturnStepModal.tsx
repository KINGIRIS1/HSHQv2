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
  const [returnOption, setReturnOption] = useState<'REJECT' | 'PAUSE' | 'PREVIOUS_STEP'>('PAUSE');
  const [reason, setReason] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || records.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập rõ lý do trả hồ sơ / bổ sung / sửa chữa!');
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
            <span>Thao Tác Trả Hồ Sơ</span>
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
              <span>Hồ sơ thực hiện thao tác ({records.length}):</span>
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

          {/* CHỌN PHƯƠNG ÁN TRẢ HỒ SƠ */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">
              Chọn phương án trả hồ sơ:
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Trả dừng quy trình chờ bổ sung */}
              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  returnOption === 'PAUSE' 
                    ? 'border-amber-500 bg-amber-50/80 shadow-sm' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="returnOption" 
                  value="PAUSE"
                  checked={returnOption === 'PAUSE'}
                  onChange={() => setReturnOption('PAUSE')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1 flex items-center gap-1.5 font-bold text-sm text-amber-900">
                  <PauseCircle size={16} className="text-amber-600 shrink-0" />
                  <span>1. Trả dừng quy trình (Chờ người dân bổ sung)</span>
                </div>
              </label>

              {/* Option 2: Trả hủy hồ sơ */}
              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  returnOption === 'REJECT' 
                    ? 'border-rose-500 bg-rose-50/80 shadow-sm' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="returnOption" 
                  value="REJECT"
                  checked={returnOption === 'REJECT'}
                  onChange={() => setReturnOption('REJECT')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div className="flex-1 flex items-center gap-1.5 font-bold text-sm text-rose-900">
                  <Ban size={16} className="text-rose-600 shrink-0" />
                  <span>2. Trả hủy hồ sơ (Tạm dừng / Từ chối hoàn trả 1 cửa)</span>
                </div>
              </label>

              {/* Option 3: Trả về cán bộ thụ lý sửa */}
              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  returnOption === 'PREVIOUS_STEP' 
                    ? 'border-blue-500 bg-blue-50/80 shadow-sm' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="returnOption" 
                  value="PREVIOUS_STEP"
                  checked={returnOption === 'PREVIOUS_STEP'}
                  onChange={() => setReturnOption('PREVIOUS_STEP')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 flex items-center gap-1.5 font-bold text-sm text-blue-900">
                  <ArrowLeftRight size={16} className="text-blue-600 shrink-0" />
                  <span>3. Trả về cán bộ thụ lý (Yêu cầu sửa chữa / hoàn thiện)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Input: Lý do trả */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-2">
              <MessageSquare size={16} className="text-rose-600" />
              <span>Ghi chú lý do trả hồ sơ</span>
              <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2.5}
              required
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none font-medium text-slate-800 placeholder:text-gray-400"
              placeholder="Nhập chi tiết ghi chú lý do..."
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

          {/* Đồng ý giải trình */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
            <input 
              type="checkbox" 
              id="agreeCheck" 
              checked={agreed} 
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500 cursor-pointer"
            />
            <label htmlFor="agreeCheck" className="text-xs font-bold text-amber-900 cursor-pointer leading-relaxed">
              Tôi đã giải trình đầy đủ lý do trên và <span className="text-rose-700 underline font-extrabold">ĐỒNG Ý</span> thực hiện thao tác này.
            </label>
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
              disabled={isSubmitting || !reason.trim() || !agreed}
              className="flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
            >
              <Undo2 size={16} />
              {isSubmitting ? 'Đang xử lý...' : 'Đồng Ý & Thực Hiện'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectReturnStepModal;
