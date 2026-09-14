import React, { useState } from 'react';
import {
  X,
  UserCheck,
  Calendar,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { RecordFile, Employee } from '../../types';

interface RegistrationAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: RecordFile[];
  employees: Employee[];
  onConfirmAssign: (recordIds: string[], assignedTo: string, assignedDate: string) => Promise<void>;
}

export const RegistrationAssignModal: React.FC<RegistrationAssignModalProps> = ({
  isOpen,
  onClose,
  selectedRecords,
  employees,
  onConfirmAssign,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [assignedDate, setAssignedDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Lọc danh sách nhân viên thuộc Tổ Đăng ký / Cấp giấy hoặc tất cả
  const dangkyEmployees = employees.filter(
    (e) => !e.department || e.department.toLowerCase().includes('đăng ký') || e.department.toLowerCase().includes('cấp giấy')
  );
  const displayEmployees = dangkyEmployees.length > 0 ? dangkyEmployees : employees;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      setErrorMsg('Vui lòng chọn cán bộ để phân công.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const ids = selectedRecords.map((r) => r.id);
      await onConfirmAssign(ids, selectedEmployee, assignedDate);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi phân công.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <UserCheck size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Phân công cán bộ thụ lý</h3>
              <p className="text-xs text-blue-100">
                Đang chọn {selectedRecords.length} hồ sơ Đăng ký
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Danh sách hồ sơ thu gọn */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Danh sách hồ sơ được phân công:
            </span>
            {selectedRecords.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs py-0.5 border-b border-slate-100 last:border-0">
                <span className="font-bold text-blue-700">{r.code}</span>
                <span className="text-slate-700 truncate max-w-[200px]">{r.customerName}</span>
                <span className="text-slate-500 text-[11px]">{r.ward}</span>
              </div>
            ))}
          </div>

          {/* Chọn cán bộ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Cán bộ phụ trách thụ lý <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                required
              >
                <option value="">-- Chọn cán bộ tiếp nhận hồ sơ --</option>
                {displayEmployees.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} {emp.department ? `(${emp.department})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ngày giao việc */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Ngày phân công / Giao việc
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{isSubmitting ? 'Đang phân công...' : 'Xác nhận phân công'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
