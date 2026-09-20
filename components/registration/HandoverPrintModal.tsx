import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Printer,
  User,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import { RecordFile, Employee } from '../../types';

interface HandoverPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: RecordFile[];
  employees: Employee[];
  onConfirmHandoverPrint: (recordIds: string[], assignedTo: string) => Promise<void>;
}

export const HandoverPrintModal: React.FC<HandoverPrintModalProps> = ({
  isOpen,
  onClose,
  selectedRecords,
  employees,
  onConfirmHandoverPrint,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setErrorMsg('');
      setSelectedEmployee('');
    }
  }, [isOpen]);

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

  const displayEmployees = employees.filter(
    (e) => !e.department || 
      e.department.toLowerCase().includes('in gcn') || 
      e.department.toLowerCase().includes('đăng ký') || 
      e.department.toLowerCase().includes('cấp giấy')
  );
  const employeesToShow = displayEmployees.length > 0 ? displayEmployees : employees;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    if (!selectedEmployee) {
      setErrorMsg('Vui lòng chọn cán bộ In GCN.');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setErrorMsg('');
      const ids = selectedRecords.map((r) => r.id);
      await onConfirmHandoverPrint(ids, selectedEmployee);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi giao In GCN.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-cyan-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Printer size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Giao In Giấy chứng nhận (GCN)</h3>
              <p className="text-xs text-blue-100">
                Phân công cán bộ thực hiện in và hoàn thiện phôi GCN
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

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Danh sách hồ sơ ({selectedRecords.length})
            </label>
            <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
              {selectedRecords.map((rec) => (
                <div key={rec.id} className="text-xs text-slate-700 flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                  <span className="font-semibold text-blue-700 flex items-center gap-1">
                    <FileText size={13} className="text-blue-500" />
                    {rec.code}
                  </span>
                  <span className="text-slate-500 truncate max-w-[200px]">{rec.customerName}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Chọn Cán bộ In GCN <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              >
                <option value="">-- Chọn cán bộ In GCN --</option>
                {employeesToShow.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} - {emp.department || 'Tổ Cấp giấy'}
                  </option>
                ))}
              </select>
              <User
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Printer size={16} />
                  <span>Xác nhận Giao In GCN</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
