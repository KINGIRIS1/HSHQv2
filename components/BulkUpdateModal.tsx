
import React, { useState } from 'react';
import { RecordFile, Employee, RecordStatus } from '../types';
import { STATUS_LABELS, SELECTABLE_STATUSES } from '../constants';
import { X, CheckCircle2, Layers, ArrowRight } from 'lucide-react';

interface BulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: RecordFile[];
  allRecords?: RecordFile[];
  employees: Employee[];
  wards: string[];
  onConfirm: (field: keyof RecordFile, value: any, customDate?: string, targetRecordIds?: string[], extraData?: { assignedTo?: string; customDate?: string }) => Promise<void>;
}

const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({ 
  isOpen, onClose, selectedRecords, employees, wards, onConfirm 
}) => {
  const [targetField, setTargetField] = useState<string>('status');
  const [targetValue, setTargetValue] = useState<string>('');
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [statusEmployee, setStatusEmployee] = useState<string>('');
  const [statusDate, setStatusDate] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine active target records
  const activeRecordsToUpdate = selectedRecords;

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!targetValue) {
        alert("Vui lòng chọn giá trị cần cập nhật.");
        return;
    }
    if (activeRecordsToUpdate.length === 0) {
        alert("Không tìm thấy hồ sơ nào cần cập nhật.");
        return;
    }

    const count = activeRecordsToUpdate.length;
    if (confirm(`Bạn có chắc chắn muốn cập nhật ${count} hồ sơ đang chọn không?`)) {
        setIsProcessing(true);
        const isoDate = useCustomDate && customDate ? new Date(customDate + "T12:00:00").toISOString() : undefined;
        const targetIds = activeRecordsToUpdate.map(r => r.id);
        const extraData = targetField === 'status' ? { 
            assignedTo: statusEmployee || undefined, 
            customDate: statusDate ? new Date(statusDate + "T12:00:00").toISOString() : undefined 
        } : undefined;
        await onConfirm(targetField as keyof RecordFile, targetValue, isoDate, targetIds, extraData);
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
                <p className="text-xs text-orange-700 mt-1">
                    Số lượng hồ sơ sẽ cập nhật: <strong className="text-sm font-black text-orange-900">{activeRecordsToUpdate.length}</strong> hồ sơ
                </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 bg-white/50 p-1 rounded-full"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
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
                        <option value="assignedDate">Ngày giao việc</option>
                        <option value="exportDate">Ngày xuất (Bàn giao)</option>
                        <option value="exportBatch">Đợt xuất (Bàn giao)</option>
                        <option value="deadline">Ngày hẹn trả (Gia hạn)</option>
                        <option value="receivedDate">Ngày nhận hồ sơ</option>
                        <option value="resultReturnedDate">Ngày trả kết quả</option>
                        <option value="receiptNumber">Số BL/HĐ</option>
                        <option value="returnedPrice">Số tiền (VNĐ)</option>
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
                        <div className="space-y-3">
                            <select 
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            >
                                <option value="">-- Chọn trạng thái mới --</option>
                                {SELECTABLE_STATUSES.map(item => (
                                    <option key={item.key} value={item.key}>{item.label}</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        {targetValue === RecordStatus.RECEIVED
                                            ? "Cán bộ tiếp nhận"
                                            : targetValue === RecordStatus.IN_PROGRESS || targetValue === RecordStatus.ASSIGNED
                                            ? "Cán bộ thực hiện / Người đo đạc"
                                            : targetValue === RecordStatus.PENDING_CHECK
                                            ? "Cán bộ kiểm tra / Người kiểm tra"
                                            : targetValue === RecordStatus.PENDING_SIGN
                                            ? "Người được trình ký"
                                            : "Người xử lý / Phụ trách"}
                                    </label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                        value={statusEmployee}
                                        onChange={(e) => setStatusEmployee(e.target.value)}
                                    >
                                        <option value="">-- Giữ nguyên / Không đổi --</option>
                                        {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        {targetValue === RecordStatus.RECEIVED
                                            ? "Ngày tiếp nhận"
                                            : targetValue === RecordStatus.IN_PROGRESS || targetValue === RecordStatus.ASSIGNED
                                            ? "Ngày giao thực hiện"
                                            : targetValue === RecordStatus.COMPLETED_WORK
                                            ? "Ngày hoàn thành thực hiện"
                                            : targetValue === RecordStatus.PENDING_CHECK
                                            ? "Ngày trình kiểm tra"
                                            : targetValue === RecordStatus.PENDING_SIGN
                                            ? "Ngày trình ký"
                                            : targetValue === RecordStatus.HANDOVER
                                            ? "Ngày xuất giao"
                                            : targetValue === RecordStatus.RETURNED
                                            ? "Ngày trả kết quả"
                                            : "Ngày áp dụng"}
                                    </label>
                                    <input 
                                        type="date"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                        value={statusDate}
                                        onChange={(e) => setStatusDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
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

                    {(targetField === 'deadline' || targetField === 'receivedDate' || targetField === 'resultReturnedDate' || targetField === 'assignedDate' || targetField === 'exportDate') && (
                        <input 
                            type="date"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                        />
                    )}

                    {targetField === 'exportBatch' && (
                        <input 
                            type="text"
                            placeholder="Nhập tên/số đợt mới (vd: Đợt 1, Đợt 2...)"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                        />
                    )}

                    {targetField === 'receiptNumber' && (
                        <input 
                            type="text"
                            placeholder="Nhập số BL/HĐ mới..."
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value)}
                        />
                    )}

                    {targetField === 'returnedPrice' && (
                        <input 
                            type="number"
                            placeholder="Nhập số tiền..."
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
                disabled={isProcessing || !targetValue || (useCustomDate && !customDate) || activeRecordsToUpdate.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? 'Đang xử lý...' : <><CheckCircle2 size={18} /> Cập nhật ngay ({activeRecordsToUpdate.length})</>}
            </button>
        </div>
      </div>
    </div>
  );
};

export default BulkUpdateModal;
