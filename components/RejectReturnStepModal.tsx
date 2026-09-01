import React, { useState } from 'react';
import AutoResizeTextarea from './AutoResizeTextarea';
import { X, Undo2, AlertCircle, Calendar, MessageSquare, PauseCircle, Ban, RefreshCw, CheckSquare } from 'lucide-react';
import { RecordFile, User, Employee } from '../types';

export type ReturnOptionType = 'pause_supplement' | 'cancel_reject' | 'return_handler' | 'withdraw_citizen';

interface RejectReturnStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  currentUser: User | null;
  employees: Employee[];
  users?: User[];
  onConfirm: (optionType: ReturnOptionType, reason: string, returnDateStr: string) => Promise<void>;
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
  const [returnOption, setReturnOption] = useState<ReturnOptionType>('pause_supplement');
  const [reason, setReason] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || records.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập lý do giải trình trả hồ sơ!');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onConfirm(returnOption, reason.trim(), returnDate);
      setReason('');
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Có lỗi xảy ra khi thực hiện thao tác. Vui lòng thử lại.');
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
        <div className="bg-rose-600 px-5 py-3.5 text-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2.5 font-bold text-lg">
            <Undo2 size={22} className="shrink-0" />
            <span>Trả hồ sơ</span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-rose-700 transition-colors"
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
          <div className="bg-rose-50/60 border border-rose-100 p-3.5 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-900">
                Hồ sơ thực hiện thao tác ({records.length}):
              </span>
              <span className="bg-rose-200/80 text-rose-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                {records.length} hồ sơ
              </span>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-1.5 text-xs pr-1">
              {records.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-rose-100/80 font-medium shadow-xs">
                  <span className="font-bold text-slate-800 font-mono tracking-tight">{r.code}</span>
                  <span className="text-slate-700 font-semibold truncate max-w-[160px] uppercase">{r.customerName}</span>
                  <span className="text-rose-700 font-bold text-[11px] bg-rose-50 px-2 py-0.5 rounded">
                    Thụ lý: {getEmployeeName(r.assignedTo)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Select Return Option */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Chọn phương án trả hồ sơ:
            </label>
            <div className="space-y-2">
              {/* Option 1 */}
              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  returnOption === 'pause_supplement' 
                    ? 'border-2 border-amber-500 bg-amber-50/60 text-amber-950 font-bold shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <input 
                  type="radio" 
                  name="returnOption" 
                  value="pause_supplement"
                  checked={returnOption === 'pause_supplement'}
                  onChange={() => setReturnOption('pause_supplement')}
                  className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                />
                <PauseCircle size={18} className="text-amber-600 shrink-0" />
                <span className="text-xs sm:text-sm">
                  <strong>1. Trả chờ bổ sung</strong>
                </span>
              </label>

              {/* Option 2 */}
              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  returnOption === 'cancel_reject' 
                    ? 'border-2 border-rose-500 bg-rose-50/60 text-rose-950 font-bold shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <input 
                  type="radio" 
                  name="returnOption" 
                  value="cancel_reject"
                  checked={returnOption === 'cancel_reject'}
                  onChange={() => setReturnOption('cancel_reject')}
                  className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                />
                <Ban size={18} className="text-rose-600 shrink-0" />
                <span className="text-xs sm:text-sm">
                  <strong>2. Trả hủy hồ sơ</strong>
                </span>
              </label>

              {/* Option 3 */}
              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  returnOption === 'return_handler' 
                    ? 'border-2 border-blue-500 bg-blue-50/60 text-blue-950 font-bold shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <input 
                  type="radio" 
                  name="returnOption" 
                  value="return_handler"
                  checked={returnOption === 'return_handler'}
                  onChange={() => setReturnOption('return_handler')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <RefreshCw size={18} className="text-blue-600 shrink-0" />
                <span className="text-xs sm:text-sm">
                  <strong>3. Trả về cán bộ thụ lý</strong>
                </span>
              </label>

              {/* Option 4 */}
              <label 
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  returnOption === 'withdraw_citizen' 
                    ? 'border-2 border-teal-500 bg-teal-50/60 text-teal-950 font-bold shadow-xs' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                }`}
              >
                <input 
                  type="radio" 
                  name="returnOption" 
                  value="withdraw_citizen"
                  checked={returnOption === 'withdraw_citizen'}
                  onChange={() => setReturnOption('withdraw_citizen')}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <CheckSquare size={18} className="text-teal-600 shrink-0" />
                <span className="text-xs sm:text-sm">
                  <strong>4. Trả CSD rút hs</strong>
                </span>
              </label>
            </div>
          </div>

          {/* Section 3: Reason Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
              <MessageSquare size={15} className="text-rose-600" />
              <span>Ghi chú lý do trả hồ sơ</span>
              <span className="text-red-500">*</span>
            </label>
            <AutoResizeTextarea
              required
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none font-medium text-slate-800 placeholder:text-slate-400"
              placeholder="Nhập chi tiết ghi chú lý do..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Section 6: Footer buttons */}
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
              disabled={isSubmitting || !reason.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
            >
              <Undo2 size={16} />
              {isSubmitting ? 'Đang xử lý...' : 'Đồng ý'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectReturnStepModal;
