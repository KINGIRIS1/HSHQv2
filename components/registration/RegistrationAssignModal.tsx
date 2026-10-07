import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  UserCheck,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Check,
} from 'lucide-react';
import { RecordFile, Employee } from '../../types';
import { removeVietnameseTones } from '../../utils/appHelpers';

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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [assignedDate, setAssignedDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setErrorMsg('');
      setSearchTerm('');
      setSelectedEmployee('');
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lọc danh sách nhân viên thuộc Tổ Đăng ký / Cấp giấy
  const dangkyEmployees = useMemo(() => {
    const term = removeVietnameseTones(searchTerm.trim().toLowerCase());
    const baseList = employees.filter(
      (e) => !e.department || e.department.toLowerCase().includes('đăng ký') || e.department.toLowerCase().includes('cấp giấy') || e.department.toLowerCase().includes('giấy')
    );
    const list = baseList.length > 0 ? baseList : employees;

    if (!term) return list;
    return list.filter((emp) => {
      const name = removeVietnameseTones((emp.name || '').toLowerCase());
      const pos = removeVietnameseTones((emp.position || '').toLowerCase());
      const dept = removeVietnameseTones((emp.department || '').toLowerCase());
      return name.includes(term) || pos.includes(term) || dept.includes(term);
    });
  }, [employees, searchTerm]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    if (!selectedEmployee) {
      setErrorMsg('Vui lòng chọn cán bộ để phân công.');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setErrorMsg('');
      const ids = selectedRecords.map((r) => r.id);
      await onConfirmAssign(ids, selectedEmployee, assignedDate);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi phân công.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
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

          {/* Chọn cán bộ với Thanh tìm kiếm và Thẻ nhân sự trực quan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <User size={15} className="text-blue-600" />
                <span>Cán bộ phụ trách thụ lý: <span className="text-red-500">*</span></span>
              </label>
              <span className="text-slate-400 font-medium">
                {dangkyEmployees.length} nhân sự
              </span>
            </div>

            {/* Ô tìm kiếm nhanh nhân sự */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhanh tên cán bộ, chức vụ, bộ phận..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* Danh sách thẻ nhân sự có nút tròn Radio */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {dangkyEmployees.length > 0 ? (
                dangkyEmployees.map((emp) => {
                  const isSelected = selectedEmployee === emp.name;
                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp.name)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/80 shadow-xs ring-1 ring-blue-400'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Nút radio tròn */}
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{emp.name}</span>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              {emp.department || 'Cấp giấy'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {emp.position || 'Nhân viên'}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                          <Check size={14} />
                          <span>Đã chọn</span>
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  Không tìm thấy nhân sự phù hợp với từ khóa "{searchTerm}".
                </div>
              )}
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
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedEmployee}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Đang giao</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Đồng ý</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
