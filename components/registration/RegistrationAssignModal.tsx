import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  UserCheck,
  Calendar,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { RecordFile, Employee } from '../../types';
import { removeVietnameseTones } from '../../utils/appHelpers';

interface RegistrationAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: RecordFile[];
  employees: Employee[];
  onConfirmAssign: (
    recordIds: string[],
    assignedTo: string,
    assignedDate: string,
    assignStep: 'appraisal' | 'tax_transfer'
  ) => Promise<void>;
}

export const RegistrationAssignModal: React.FC<RegistrationAssignModalProps> = ({
  isOpen,
  onClose,
  selectedRecords,
  employees,
  onConfirmAssign,
}) => {
  const [assignStep, setAssignStep] = useState<'appraisal' | 'tax_transfer'>('appraisal');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [assignedDate, setAssignedDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Lấy xã/phường chung của danh sách hồ sơ được chọn (nếu đồng nhất)
  const targetWardName = useMemo(() => {
    if (!selectedRecords || selectedRecords.length === 0) return null;
    const firstWard = selectedRecords[0].ward;
    if (!firstWard) return null;
    const isUniform = selectedRecords.every((r) => r.ward === firstWard);
    return isUniform ? firstWard : null;
  }, [selectedRecords]);

  // Lọc danh sách nhân viên thuộc Tổ Đăng ký / Cấp giấy
  const dangkyEmployees = useMemo(() => {
    return employees.filter(
      (e) => !e.department || e.department.toLowerCase().includes('đăng ký') || e.department.toLowerCase().includes('cấp giấy')
    );
  }, [employees]);

  // Sắp xếp cán bộ: Cán bộ khớp đúng địa bàn Xã/Phường được ưu tiên xếp lên ĐẦU TIÊN
  const displayEmployees = useMemo(() => {
    const list = dangkyEmployees.length > 0 ? [...dangkyEmployees] : [...employees];
    if (targetWardName) {
      const targetNorm = removeVietnameseTones(targetWardName);
      list.sort((a, b) => {
        const aMatch = !!(a.managedWards && a.managedWards.some((w) => removeVietnameseTones(w) === targetNorm));
        const bMatch = !!(b.managedWards && b.managedWards.some((w) => removeVietnameseTones(w) === targetNorm));
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return a.name.localeCompare(b.name, 'vi');
      });
    }
    return list;
  }, [dangkyEmployees, employees, targetWardName]);

  // Tự động gợi ý chọn cán bộ phù hợp khi mở modal
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setErrorMsg('');
      setAssignStep('appraisal');

      if (targetWardName) {
        const targetNorm = removeVietnameseTones(targetWardName);
        const matchEmp = displayEmployees.find(
          (e) => e.managedWards && e.managedWards.some((w) => removeVietnameseTones(w) === targetNorm)
        );
        if (matchEmp) {
          setSelectedEmployee(matchEmp.name);
          return;
        }
      }
      if (displayEmployees.length > 0) {
        setSelectedEmployee(displayEmployees[0].name);
      }
    }
  }, [isOpen, targetWardName, displayEmployees]);

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
      await onConfirmAssign(ids, selectedEmployee, assignedDate, assignStep);
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
              <h3 className="font-bold text-base">Phân công giao việc Cấp giấy</h3>
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

          {/* Chọn bước giao việc */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Chọn bước giao việc / phân công <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setAssignStep('appraisal')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  assignStep === 'appraisal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <FileText size={14} />
                <span>1. Thẩm định hồ sơ</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignStep('tax_transfer')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  assignStep === 'tax_transfer'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Users size={14} />
                <span>2. Phiếu chuyển thuế</span>
              </button>
            </div>
          </div>

          {/* Danh sách hồ sơ thu gọn */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-28 overflow-y-auto space-y-1">
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

          {/* Thông báo gợi ý theo địa bàn nếu có */}
          {targetWardName && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-emerald-600 shrink-0" />
                <span>
                  Đã tự động gợi ý cán bộ thuộc địa bàn <strong>{targetWardName}</strong>
                </span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Gợi ý thông minh
              </span>
            </div>
          )}

          {/* Chọn cán bộ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {assignStep === 'appraisal' ? 'Cán bộ phụ trách Thẩm định' : 'Cán bộ lập Phiếu chuyển thuế'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                required
              >
                <option value="">-- Chọn cán bộ tiếp nhận giao việc --</option>
                {displayEmployees.map((emp) => {
                  const isMatch =
                    targetWardName &&
                    emp.managedWards &&
                    emp.managedWards.some((w) => removeVietnameseTones(w) === removeVietnameseTones(targetWardName));
                  return (
                    <option key={emp.id} value={emp.name}>
                      {isMatch ? '⭐ ' : ''}{emp.name} {emp.department ? `(${emp.department})` : ''} {isMatch ? `— [Khớp địa bàn: ${targetWardName}]` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Ngày giao việc */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {assignStep === 'appraisal' ? 'Ngày phân công Thẩm định' : 'Ngày phân công Chuyển thuế'}
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
