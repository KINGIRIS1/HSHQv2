import React, { useState, useMemo } from 'react';
import { X, Search, Layers, UserCheck, CheckCircle2 } from 'lucide-react';
import { RecordFile, Employee } from '../../types';
import { removeVietnameseTones } from '../../utils/appHelpers';

interface HandoverOfficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  employees: Employee[];
  onConfirm: (drafterId: string, handoverDate: string) => Promise<void> | void;
}

const HandoverOfficeModal: React.FC<HandoverOfficeModalProps> = ({
  isOpen,
  onClose,
  records,
  employees,
  onConfirm,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDrafterId, setSelectedDrafterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lọc chỉ nhân sự thuộc Tổ Đo đạc
  const candidateEmployees = useMemo(() => {
    const term = removeVietnameseTones(searchTerm.trim().toLowerCase());
    
    // Chỉ lấy nhân viên thuộc Tổ Đo đạc
    const surveyEmployees = employees.filter((emp) => {
      const dept = (emp.department || '').toLowerCase();
      return dept.includes('đo đạc') || dept.includes('do dac');
    }).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    // Nếu không có ai trong Tổ Đo đạc (dự phòng), fallback về danh sách nhân viên
    const baseList = surveyEmployees.length > 0 ? surveyEmployees : employees;

    if (!term) return baseList;

    return baseList.filter((emp) => {
      const nameMatch = removeVietnameseTones(emp.name.toLowerCase()).includes(term);
      const posMatch = removeVietnameseTones((emp.position || '').toLowerCase()).includes(term);
      const deptMatch = removeVietnameseTones((emp.department || '').toLowerCase()).includes(term);
      return nameMatch || posMatch || deptMatch;
    });
  }, [employees, searchTerm]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedDrafterId) {
      alert('Vui lòng chọn Chuyên viên Biên tập bản đồ.');
      return;
    }
    setIsSubmitting(true);
    try {
      // Tự động lấy ngày hiện tại trực tiếp giống như Trình ký / Trình kiểm tra
      const todayStr = new Date().toISOString().split('T')[0];
      await onConfirm(selectedDrafterId, todayStr);
      onClose();
    } catch (err) {
      console.error('Error during handover:', err);
      alert('Đã xảy ra lỗi khi chuyển biên tập bản đồ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-sky-600 to-blue-700 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Layers size={22} className="text-sky-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Biên Tập Bản Đồ
              </h3>
              <p className="text-xs text-sky-100 mt-0.5">
                Hoàn thành đo thực địa & giao chuyên viên biên tập
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Chọn chuyên viên biên tập bản đồ (Tổ đo đạc) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UserCheck size={14} className="text-sky-600" />
                <span>Chọn Chuyên viên Biên tập bản đồ (Tổ Đo đạc):</span>
              </span>
              <span className="text-[11px] font-normal text-gray-500">
                {candidateEmployees.length} nhân sự
              </span>
            </label>

            {/* Ô tìm kiếm nhanh */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Tìm tên nhân sự Tổ Đo đạc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Danh sách nhân viên Tổ Đo đạc */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border border-gray-100 rounded-xl p-1 bg-gray-50/50">
              {candidateEmployees.map((emp) => {
                const isSelected = selectedDrafterId === emp.id;

                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedDrafterId(emp.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-500 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-sky-300 hover:bg-sky-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-sky-600 bg-sky-600' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-gray-800">{emp.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-semibold">
                            Đo đạc
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {emp.position || 'Chuyên viên'} • {emp.department || 'Tổ Đo đạc'}
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 size={16} className="text-sky-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedDrafterId}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận giao'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HandoverOfficeModal;
