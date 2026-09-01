import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, RecordStatus } from '../types';
import { STATUS_LABELS, SELECTABLE_STATUSES } from '../constants';
import { X, CheckCircle2, Layers, ArrowRight, UserCheck, Calendar } from 'lucide-react';
import { getDepartmentForRecord, calculateEmployeeWorkload, getPureBatchNumber } from '../utils/appHelpers';

interface BulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: RecordFile[];
  allRecords?: RecordFile[];
  employees: Employee[];
  wards: string[];
  onConfirm: (field: keyof RecordFile, value: any, customDate?: string, targetRecordIds?: string[], extraData?: { assignedTo?: string; customDate?: string }) => Promise<void>;
  currentView?: string;
}

const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({ 
  isOpen, onClose, selectedRecords, allRecords, employees, wards, onConfirm, currentView 
}) => {
  const [targetField, setTargetField] = useState<string>('status');
  const [targetValue, setTargetValue] = useState<string>('');
  const [customDate, setCustomDate] = useState<string>('');
  const [statusEmployee, setStatusEmployee] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset values when targetField or targetValue changes
  useEffect(() => {
    setStatusEmployee('');
  }, [targetField, targetValue]);

  if (!isOpen) return null;

  const activeRecordsToUpdate = selectedRecords;

  // Detect department of the active tab from currentView or selected records
  const getDepartmentFromView = (view?: string) => {
    if (!view) return '';
    const v = view.toLowerCase();
    if (v.startsWith('other_')) {
      return 'Tổ Cấp giấy';
    }
    if (v.startsWith('archive_')) {
      return 'Tổ Lưu trữ';
    }
    if (['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(v)) {
      return 'Tổ Đo đạc';
    }
    return '';
  };

  const deptFromView = getDepartmentFromView(currentView);
  const detectedDept = deptFromView || (activeRecordsToUpdate.length > 0 
    ? getDepartmentForRecord(activeRecordsToUpdate[0]) 
    : 'Tổ Đo đạc');

  // Classify selected target statuses
  const isPendingSign = 
    (targetField === 'status' && (targetValue === RecordStatus.PENDING_SIGN || targetValue === RecordStatus.SIGNED)) ||
    (targetField === 'historyStatus' && targetValue === 'SIGNING');

  const isPendingCheck = 
    (targetField === 'status' && (targetValue === RecordStatus.PENDING_CHECK || targetValue === RecordStatus.CHECKED)) ||
    (targetField === 'historyStatus' && targetValue === 'CHECKING');

  const isInProgress = 
    (targetField === 'status' && (targetValue === RecordStatus.IN_PROGRESS || targetValue === RecordStatus.ASSIGNED || targetValue === RecordStatus.COMPLETED_WORK)) ||
    (targetField === 'historyStatus' && (targetValue === 'ASSIGNED' || targetValue === 'COMPLETED' || targetValue === 'RETURNED'));

  const requiresEmployee = targetField === 'status' && (isPendingSign || isPendingCheck || isInProgress);

  // Helper to filter employees dynamically based on selected status and tab department
  const getFilteredEmployees = () => {
    const normDept = (detectedDept || '').toLowerCase().trim();
    
    const isArchive = normDept.includes('lưu trữ');
    const isMeasurement = normDept.includes('đo đạc') || normDept.includes('kỹ thuật');
    const isRegistration = normDept.includes('đăng ký') || normDept.includes('cấp giấy');
    const isAdministrative = normDept.includes('hành chính') || normDept.includes('một cửa');

    const matchDept = (emp: Employee) => {
      const empDept = (emp.department || '').toLowerCase().trim();
      if (isArchive) return empDept.includes('lưu trữ');
      if (isMeasurement) return empDept.includes('đo đạc') || empDept.includes('kỹ thuật');
      if (isRegistration) return empDept.includes('đăng ký') || empDept.includes('cấp giấy');
      if (isAdministrative) return empDept.includes('hành chính') || empDept.includes('một cửa');
      return empDept === normDept;
    };

    let result: Employee[] = [];

    if (isPendingSign) {
      // Chỉ chọn ban giám đốc / lãnh đạo
      result = employees.filter(emp => 
        (emp.department || '').toLowerCase().includes('giám đốc') || 
        (emp.position || '').toLowerCase().includes('giám đốc') ||
        (emp.position || '').toLowerCase().includes('lãnh đạo')
      );
    } else if (isPendingCheck) {
      // Chỉ chọn Tổ trưởng / Tổ phó của tổ chuyên môn
      result = employees.filter(emp => {
        const pos = (emp.position || '').toLowerCase();
        const isLead = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng') || pos.includes('phó') || pos.includes('lãnh đạo');
        return isLead && matchDept(emp);
      });
    } else if (isInProgress) {
      // Chỉ nhân viên theo tổ đang xử lý (không gồm BGĐ)
      result = employees.filter(emp => 
        matchDept(emp) && 
        !(emp.department || '').toLowerCase().includes('giám đốc')
      );
    } else {
      result = employees.filter(matchDept);
    }

    if (result.length === 0) {
      result = employees.filter(matchDept);
    }
    if (result.length === 0) {
      result = employees;
    }

    return result;
  };

  const filteredEmployees = getFilteredEmployees();

  const handleConfirm = async () => {
    if (!targetValue) {
        alert("Vui lòng chọn giá trị mới cần cập nhật.");
        return;
    }
    if (activeRecordsToUpdate.length === 0) {
        alert("Không tìm thấy hồ sơ nào cần cập nhật.");
        return;
    }

    const count = activeRecordsToUpdate.length;
    if (confirm(`Bạn có chắc chắn muốn cập nhật ${count} hồ sơ đang chọn không?`)) {
        setIsProcessing(true);
        let isoDate: string | undefined = undefined;
        if (customDate) {
            const d = new Date(customDate.includes('T') ? customDate : customDate + "T12:00:00");
            if (!isNaN(d.getTime())) {
                isoDate = d.toISOString();
            }
        }
        const targetIds = activeRecordsToUpdate.map(r => r.id);
        
        // Pass assignedTo and customDate cleanly within extraData when targetField is status or historyStatus
        const extraData = (targetField === 'status' || targetField === 'historyStatus') ? { 
            assignedTo: statusEmployee || undefined, 
            customDate: isoDate 
        } : undefined;

        const finalVal = targetField === 'exportBatch' ? getPureBatchNumber(targetValue) : targetValue;
        await onConfirm(targetField as keyof RecordFile, finalVal, isoDate, targetIds, extraData);
        setIsProcessing(false);
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-gray-800 text-base">
                    Xử lý All
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                    Số lượng hồ sơ sẽ cập nhật: <strong className="font-bold text-orange-600">{activeRecordsToUpdate.length}</strong> hồ sơ
                    {detectedDept && <span className="ml-2 px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-bold">Tổ: {detectedDept}</span>}
                </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 bg-white/50 p-1 rounded-full">
                <X size={18}/>
            </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-4">
                
                {/* Grid for Steps 1 and 2 to save space */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Bước 1 */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">1. Chọn thông tin cần thay đổi</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none font-medium bg-white"
                            value={targetField}
                            onChange={(e) => { 
                                setTargetField(e.target.value); 
                                setTargetValue(''); 
                                setCustomDate('');
                                setStatusEmployee('');
                            }}
                        >
                            <option value="status">Trạng thái hồ sơ (Quy trình)</option>
                            <option value="historyStatus">Trạng thái hồ sơ (Cập nhật lịch sử)</option>
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

                    {/* Bước 2 */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">2. Chọn giá trị mới</label>
                        
                        {targetField === 'status' && (
                            <select 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            >
                                <option value="">-- Chọn trạng thái mới --</option>
                                {SELECTABLE_STATUSES.map(item => (
                                    <option key={item.key} value={item.key}>{item.label}</option>
                                ))}
                            </select>
                        )}

                        {targetField === 'historyStatus' && (
                            <select 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            >
                                <option value="">-- Chọn bước quy trình --</option>
                                <option value="ASSIGNED">Bước 1: Phân công / Giao việc</option>
                                <option value="CHECKING">Bước 2: Chờ kiểm tra kỹ thuật</option>
                                <option value="SIGNING">Bước 3: Chờ trình ký / Ký duyệt</option>
                                <option value="COMPLETED">Bước 4: Đã hoàn thành / Bàn giao 1 cửa</option>
                                <option value="RETURNED">Bước 5: Đã trả kết quả</option>
                            </select>
                        )}

                        {targetField === 'assignedTo' && (
                            <select 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            >
                                <option value="">-- Chọn nhân sự --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.name}>
                                        {emp.name} ({emp.position || 'Cán bộ'})
                                    </option>
                                ))}
                            </select>
                        )}

                        {targetField === 'ward' && (
                            <select 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium"
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
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none font-medium bg-white"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            />
                        )}

                        {targetField === 'exportBatch' && (
                            <input 
                                type="text"
                                placeholder="Nhập số đợt xuất (vd: 1, 2, 3...)"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none font-medium"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            />
                        )}

                        {targetField === 'receiptNumber' && (
                            <input 
                                type="text"
                                placeholder="Nhập số BL/HĐ mới..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none font-medium"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            />
                        )}

                        {targetField === 'returnedPrice' && (
                            <input 
                                type="number"
                                placeholder="Nhập số tiền..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none font-medium"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            />
                        )}
                    </div>
                </div>

                {/* Bước 3: Chọn nhân viên xử lý (Chỉ hiển thị cho trạng thái Phù Hợp) */}
                {requiresEmployee && (
                    <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="block text-xs font-bold text-gray-800">
                            3. Chọn nhân viên xử lý / phụ trách
                        </label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium text-gray-800"
                            value={statusEmployee}
                            onChange={(e) => setStatusEmployee(e.target.value)}
                        >
                            <option value="">-- Giữ nguyên / Không đổi --</option>
                            {filteredEmployees.map(emp => {
                                const stats = calculateEmployeeWorkload(allRecords || [], emp);
                                return (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} - {emp.position || 'Chuyên viên'} (Đang xử lý: {stats.inProgressPlots} thửa | Đã hoàn thành: {stats.completedPlots} thửa)
                                    </option>
                                );
                            })}
                        </select>
                        <p className="text-[11px] text-gray-500 leading-normal">
                            Danh sách nhân sự đã được tự động tối ưu hóa cho phù hợp với trạng thái và tổ chuyên môn đang mở.
                        </p>
                    </div>
                )}

                {/* Bước 4: Chọn ngày thực hiện */}
                {targetField === 'status' && (
                    <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="block text-xs font-bold text-gray-800">
                            {requiresEmployee ? "4." : "3."} Xác định ngày thực hiện / giao việc (Tùy chọn)
                        </label>
                        <input 
                            type="date"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                        />
                        <p className="text-[11px] text-gray-500 leading-normal">
                            Bỏ trống nếu muốn sử dụng mốc thời gian hiện tại.
                        </p>
                    </div>
                )}

                {/* Cấu hình Lịch sử bước quy trình */}
                {targetField === 'historyStatus' && targetValue && (
                    <div className="space-y-3 bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <label className="block text-xs font-bold text-amber-900">
                            Cấu hình thông tin lịch sử cho bước đã chọn:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {targetValue !== 'COMPLETED' && targetValue !== 'RETURNED' && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Cán bộ thực hiện bước này:</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium text-gray-800"
                                        value={statusEmployee}
                                        onChange={(e) => setStatusEmployee(e.target.value)}
                                    >
                                        <option value="">-- Chọn cán bộ --</option>
                                        {filteredEmployees.map(emp => (
                                            <option key={emp.id} value={emp.name}>{emp.name} ({emp.position || 'Cán bộ'})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className={targetValue === 'COMPLETED' || targetValue === 'RETURNED' ? 'col-span-2' : ''}>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Ngày thực hiện bước này:</label>
                                <input 
                                    type="date"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none font-medium bg-white"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <p className="text-[11px] text-amber-700 leading-normal">
                            Ghi chú: Thao tác này chỉ lưu vết {targetValue !== 'COMPLETED' && targetValue !== 'RETURNED' ? 'tên cán bộ và ' : ''}ngày thực hiện vào lịch sử của bước được chọn.
                        </p>
                    </div>
                )}

            </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2.5">
            <button onClick={onClose} disabled={isProcessing} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors">
                Hủy bỏ
            </button>
            <button 
                onClick={handleConfirm} 
                disabled={isProcessing || !targetValue || activeRecordsToUpdate.length === 0}
                className="px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? 'Đang xử lý...' : `Cập nhật ngay (${activeRecordsToUpdate.length})`}
            </button>
        </div>
      </div>
    </div>
  );
};

export default BulkUpdateModal;
