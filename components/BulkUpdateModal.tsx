
import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus } from '../types';
import { STATUS_LABELS } from '../constants';
import { X, CheckCircle2, AlertTriangle, Layers, ArrowRight, FileText } from 'lucide-react';

interface BulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: RecordFile[];
  allRecords?: RecordFile[];
  employees: Employee[];
  wards: string[];
  onConfirm: (field: keyof RecordFile, value: any, customDate?: string, targetRecordIds?: string[]) => Promise<void>;
}

const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({ 
  isOpen, onClose, selectedRecords, allRecords = [], employees, wards, onConfirm 
}) => {
  const [targetField, setTargetField] = useState<string>('status');
  const [targetValue, setTargetValue] = useState<string>('');
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [pastedCodesText, setPastedCodesText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse pasted codes
  const parsedPastedCodes = useMemo(() => {
    if (!pastedCodesText.trim()) return [];
    return pastedCodesText
      .split(/[\n,;\t\s]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0);
  }, [pastedCodesText]);

  // Find matching records from allRecords if pasted codes exist
  const matchedPastedRecords = useMemo(() => {
    if (parsedPastedCodes.length === 0) return [];
    const lowerCodesSet = new Set(parsedPastedCodes.map(c => c.toLowerCase()));
    return allRecords.filter(r => r.code && lowerCodesSet.has(r.code.trim().toLowerCase()));
  }, [parsedPastedCodes, allRecords]);

  // Determine active target records
  const activeRecordsToUpdate = useMemo(() => {
    if (parsedPastedCodes.length > 0) {
      return matchedPastedRecords;
    }
    return selectedRecords;
  }, [parsedPastedCodes, matchedPastedRecords, selectedRecords]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!targetValue) {
        alert("Vui lòng chọn giá trị cần cập nhật.");
        return;
    }
    if (activeRecordsToUpdate.length === 0) {
        alert("Không tìm thấy hồ sơ nào cần cập nhật. Vui lòng chọn hồ sơ hoặc nhập danh sách mã hợp lệ.");
        return;
    }

    const count = activeRecordsToUpdate.length;
    if (confirm(`Bạn có chắc chắn muốn cập nhật ${count} hồ sơ đang chọn / khớp danh sách không?`)) {
        setIsProcessing(true);
        const isoDate = useCustomDate && customDate ? new Date(customDate + "T12:00:00").toISOString() : undefined;
        const targetIds = activeRecordsToUpdate.map(r => r.id);
        await onConfirm(targetField as keyof RecordFile, targetValue, isoDate, targetIds);
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
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                <AlertTriangle className="text-blue-600 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-blue-800">
                    Hành động này sẽ thay đổi dữ liệu của <strong>tất cả</strong> hồ sơ được chọn. Vui lòng kiểm tra kỹ trước khi thực hiện.
                </p>
            </div>

            {/* Input list of codes option */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/60 space-y-2">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText size={15} className="text-orange-600" />
                    Đưa danh sách mã hồ sơ vào (Tùy chọn - Nhập/Dán nhiều mã):
                </label>
                <textarea
                    rows={3}
                    placeholder="Dán hoặc nhập các mã hồ sơ (ví dụ: 2026.001, 2026.002, mỗi mã 1 dòng hoặc cách nhau bằng dấu phẩy)..."
                    className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                    value={pastedCodesText}
                    onChange={(e) => setPastedCodesText(e.target.value)}
                />
                {pastedCodesText.trim() !== '' && (
                    <div className="text-xs">
                        {parsedPastedCodes.length > 0 ? (
                            matchedPastedRecords.length > 0 ? (
                                <span className="text-emerald-700 font-bold">
                                    ✓ Đã tìm thấy {matchedPastedRecords.length} / {parsedPastedCodes.length} mã hồ sơ phù hợp trong hệ thống.
                                </span>
                            ) : (
                                <span className="text-red-600 font-bold">
                                    ✕ Đã nhập {parsedPastedCodes.length} mã nhưng không tìm thấy hồ sơ trùng khớp trong hệ thống.
                                </span>
                            )
                        ) : null}
                    </div>
                )}
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
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white font-medium"
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

                    {(targetField === 'deadline' || targetField === 'receivedDate' || targetField === 'resultReturnedDate') && (
                        <input 
                            type="date"
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
