
import React, { useState } from 'react';
import { RecordFile, Employee, RecordStatus } from '../types';
import { STATUS_LABELS } from '../constants';
import { X, CheckCircle2, AlertTriangle, Layers, ArrowRight } from 'lucide-react';

interface BulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: RecordFile[];
  employees: Employee[];
  wards: string[];
  onConfirm: (field: keyof RecordFile, value: any, customDate?: string) => Promise<void>;
}

const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({ 
  isOpen, onClose, selectedRecords, employees, wards, onConfirm 
}) => {
  const [targetField, setTargetField] = useState<string>('status');
  const [targetValue, setTargetValue] = useState<string>('');
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!targetValue) {
        alert("Vui lòng chọn giá trị cần cập nhật.");
        return;
    }
    if (confirm(`Bạn có chắc chắn muốn cập nhật ${selectedRecords.length} hồ sơ đang chọn không?`)) {
        setIsProcessing(true);
        const isoDate = useCustomDate && customDate ? new Date(customDate).toISOString() : undefined;
        await onConfirm(targetField as keyof RecordFile, targetValue, isoDate);
        setIsProcessing(false);
        onClose();
    }
  };

  const showDatePicker = targetField === 'status' || targetField === 'assignedTo';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="p-5 border-b bg-gradient-to-r from-orange-50 to-orange-100 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-orange-800 text-lg flex items-center gap-2">
                    <Layers size={20} /> ADMIN: Xử lý hàng loạt
                </h3>
                <p className="text-xs text-orange-700 mt-1">Đang chọn: <strong>{selectedRecords.length}</strong> hồ sơ</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 bg-white/50 p-1 rounded-full"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                <AlertTriangle className="text-blue-600 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-blue-800">
                    Hành động này sẽ thay đổi dữ liệu của <strong>tất cả</strong> hồ sơ được chọn. Vui lòng kiểm tra kỹ trước khi thực hiện.
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">1. Chọn thông tin cần thay đổi</label>
                    <select 
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none font-medium"
                        value={targetField}
                        onChange={(e) => { 
                            setTargetField(e.target.value); 
                            setTargetValue(''); 
                            setUseCustomDate(false);
                            setCustomDate('');
                        }}
                    >
                        <option value="status">Trạng thái hồ sơ (Quy trình)</option>
                        <option value="assignedTo">Người xử lý (Giao việc)</option>
                        <option value="deadline">Ngày hẹn trả (Gia hạn)</option>
                        <option value="receivedDate">Ngày nhận hồ sơ</option>
                        <option value="ward">Xã / Phường (Địa bàn)</option>
                    </select>
                </div>

                <div className="flex justify-center text-gray-400">
                    <ArrowRight size={24} className="rotate-90" />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">2. Chọn giá trị mới</label>
                    
                    {/* Render input based on targetField */}
                    {targetField === 'status' && (
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                        >
                            <option value="">-- Chọn trạng thái mới --</option>
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    )}

                    {targetField === 'assignedTo' && (
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                        >
                            <option value="">-- Chọn nhân viên --</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                            ))}
                        </select>
                    )}

                    {targetField === 'ward' && (
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                        >
                            <option value="">-- Chọn Xã / Phường --</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    )}

                    {(targetField === 'deadline' || targetField === 'receivedDate') && (
                        <input 
                            type="date"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                        />
                    )}
                </div>

                {showDatePicker && (
                    <div className="pt-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="rounded text-orange-600 focus:ring-orange-500"
                                checked={useCustomDate}
                                onChange={(e) => setUseCustomDate(e.target.checked)}
                            />
                            Xác định ngày thực hiện / ngày giao việc (Tùy chọn)
                        </label>
                        
                        {useCustomDate && (
                            <input 
                                type="date"
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                            />
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            Nếu không chọn, hệ thống sẽ mặc định dùng mốc thời gian hiện tại.
                        </p>
                    </div>
                )}

            </div>
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} disabled={isProcessing} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors">
                Hủy bỏ
            </button>
            <button 
                onClick={handleConfirm} 
                disabled={isProcessing || !targetValue || (useCustomDate && !customDate)}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? 'Đang xử lý...' : <><CheckCircle2 size={18} /> Cập nhật ngay</>}
            </button>
        </div>
      </div>
    </div>
  );
};

export default BulkUpdateModal;
