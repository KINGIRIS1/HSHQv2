import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, RecordStatus } from '../types';
import { STATUS_LABELS, SURVEY_SELECTABLE_STATUSES, ARCHIVE_SELECTABLE_STATUSES, isArchiveRecordType, isArchiveRecord } from '../constants';
import { X, CheckCircle2, Layers, ArrowRight, UserCheck, Calendar, History, User, Building2, Clock, Info } from 'lucide-react';
import { getDepartmentForRecord, calculateEmployeeWorkload, getPureBatchNumber, groupEmployeesByDepartment } from '../utils/appHelpers';

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
    if (v.startsWith('archive_') || ['vao_so', 'sao_luc', 'cong_van'].includes(v)) {
      return 'Tổ Lưu trữ';
    }
    if (['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(v)) {
      return 'Tổ Đo đạc';
    }
    return '';
  };

  const deptFromView = getDepartmentFromView(currentView);

  // Determine Archive context vs Survey context accurately
  const allSelectedAreArchive = activeRecordsToUpdate.length > 0 && activeRecordsToUpdate.every(r => isArchiveRecord(r) || isArchiveRecordType(r.recordType));
  const isArchiveFromView = currentView?.startsWith('archive_') || ['vao_so', 'sao_luc', 'cong_van'].includes(currentView?.toLowerCase() || '') || deptFromView === 'Tổ Lưu trữ';
  const isArchiveContext = isArchiveFromView || (activeRecordsToUpdate.length > 0 ? allSelectedAreArchive : false);
  const isSurveyContext = !isArchiveContext && deptFromView !== 'Tổ Cấp giấy';

  const detectedDept = isArchiveContext 
    ? 'Tổ Lưu trữ' 
    : (deptFromView || (activeRecordsToUpdate.length > 0 ? getDepartmentForRecord(activeRecordsToUpdate[0]) : 'Tổ Đo đạc'));

  // Quy trình trạng thái hồ sơ (Quy trình làm việc)
  const selectableStatusList = isSurveyContext 
    ? SURVEY_SELECTABLE_STATUSES.filter(item => item.key !== RecordStatus.IN_PROGRESS)
    : ARCHIVE_SELECTABLE_STATUSES;

  // Định nghĩa các bước lịch sử đồng nhất với quy trình của từng tổ chuyên môn
  // 1. Tổ Đo đạc: 7 bước đầy đủ từ Tiếp nhận đến Trả kết quả
  const surveyHistorySteps = [
    { key: 'RECEIVED', label: 'Bước 1: Tiếp nhận hồ sơ', staffLabel: 'Cán bộ tiếp nhận', dateLabel: 'Ngày nhận hồ sơ' },
    { key: 'FIELD_WORK', label: 'Bước 2: Đo đạc thực địa (Ngoại nghiệp)', staffLabel: 'Cán bộ đo đạc thực địa', dateLabel: 'Ngày đo đạc / Giao việc' },
    { key: 'OFFICE_WORK', label: 'Bước 3: Biên tập bản đồ (Nội nghiệp)', staffLabel: 'Cán bộ biên tập bản đồ', dateLabel: 'Ngày biên tập bản đồ' },
    { key: 'CHECKING', label: 'Bước 4: Chờ kiểm tra nội nghiệp (Kiểm tra kỹ thuật)', staffLabel: 'Cán bộ kiểm tra kỹ thuật', dateLabel: 'Ngày kiểm tra' },
    { key: 'SIGNING', label: 'Bước 5: Chờ trình ký / Ký duyệt', staffLabel: 'Lãnh đạo ký duyệt', dateLabel: 'Ngày trình ký / Ký duyệt' },
    { key: 'COMPLETED', label: 'Bước 6: Đã hoàn thành / Bàn giao 1 cửa', staffLabel: 'Cán bộ bàn giao (Tùy chọn)', dateLabel: 'Ngày hoàn thành / Xuất bàn giao' },
    { key: 'RETURNED', label: 'Bước 7: Đã trả kết quả', staffLabel: 'Cán bộ trả kết quả', dateLabel: 'Ngày trả kết quả' }
  ];

  // 2. Tổ Lưu trữ: 5 bước quy trình lưu trữ, không có đo đạc thực địa hay biên tập bản đồ
  const archiveHistorySteps = [
    { key: 'RECEIVED', label: 'Bước 1: Tiếp nhận hồ sơ', staffLabel: 'Cán bộ tiếp nhận', dateLabel: 'Ngày nhận hồ sơ' },
    { key: 'IN_PROGRESS', label: 'Bước 2: Đang thực hiện / Xử lý lưu trữ', staffLabel: 'Cán bộ xử lý lưu trữ', dateLabel: 'Ngày giao / Xử lý' },
    { key: 'SIGNING', label: 'Bước 3: Chờ trình ký / Ký duyệt', staffLabel: 'Lãnh đạo ký duyệt', dateLabel: 'Ngày trình ký / Ký duyệt' },
    { key: 'COMPLETED', label: 'Bước 4: Đã hoàn thành / Bàn giao 1 cửa', staffLabel: 'Cán bộ bàn giao (Tùy chọn)', dateLabel: 'Ngày hoàn thành / Xuất bàn giao' },
    { key: 'RETURNED', label: 'Bước 5: Đã trả kết quả', staffLabel: 'Cán bộ trả kết quả', dateLabel: 'Ngày trả kết quả' }
  ];

  const historySteps = isSurveyContext ? surveyHistorySteps : archiveHistorySteps;

  // Lấy thông tin về vai trò cán bộ và mốc ngày tương ứng với từng trạng thái/bước được chọn
  const currentStageInfo = (() => {
    if (targetField === 'status') {
      switch (targetValue) {
        case RecordStatus.RECEIVED:
          return { title: 'Tiếp nhận hồ sơ', staffLabel: 'Cán bộ tiếp nhận', dateLabel: 'Ngày nhận hồ sơ', requiresStaff: true };
        case RecordStatus.FIELD_WORK:
          return { title: 'Đo đạc thực địa (Ngoại nghiệp)', staffLabel: 'Cán bộ đo đạc thực địa', dateLabel: 'Ngày đo đạc / Giao việc', requiresStaff: true };
        case RecordStatus.OFFICE_WORK:
          return { title: 'Biên tập bản đồ (Nội nghiệp)', staffLabel: 'Cán bộ biên tập bản đồ', dateLabel: 'Ngày giao biên tập', requiresStaff: true };
        case RecordStatus.IN_PROGRESS:
        case RecordStatus.ASSIGNED:
        case RecordStatus.COMPLETED_WORK:
          return { 
            title: isArchiveContext ? 'Xử lý hồ sơ lưu trữ' : 'Đang thực hiện / Giao việc', 
            staffLabel: isArchiveContext ? 'Cán bộ xử lý lưu trữ' : 'Cán bộ thụ lý / xử lý', 
            dateLabel: 'Ngày giao việc / Thực hiện', 
            requiresStaff: true 
          };
        case RecordStatus.PENDING_CHECK:
          return { title: 'Kiểm tra nội nghiệp', staffLabel: 'Cán bộ kiểm tra kỹ thuật', dateLabel: 'Ngày chuyển kiểm tra', requiresStaff: true };
        case RecordStatus.PENDING_SIGN:
        case RecordStatus.SIGNED:
          return { title: targetValue === RecordStatus.SIGNED ? 'Đã ký duyệt' : 'Chờ ký duyệt', staffLabel: 'Lãnh đạo ký duyệt', dateLabel: 'Ngày trình ký / Ký duyệt', requiresStaff: true };
        case RecordStatus.HANDOVER:
          return { title: 'Bàn giao 1 cửa', staffLabel: 'Cán bộ bàn giao (Tùy chọn)', dateLabel: 'Ngày xuất bàn giao', requiresStaff: true };
        case RecordStatus.RETURNED:
          return { title: 'Đã trả kết quả', staffLabel: 'Cán bộ trả kết quả', dateLabel: 'Ngày trả kết quả', requiresStaff: true };
        case RecordStatus.PENDING_SUPPLEMENT:
          return { title: 'Chờ bổ sung', staffLabel: '', dateLabel: 'Ngày yêu cầu bổ sung', requiresStaff: false };
        case RecordStatus.WITHDRAWN:
          return { title: 'CSD rút hồ sơ', staffLabel: '', dateLabel: 'Ngày rút hồ sơ', requiresStaff: false };
        case RecordStatus.REJECTED:
          return { title: 'Trả hồ sơ', staffLabel: '', dateLabel: 'Ngày trả hồ sơ', requiresStaff: false };
        default:
          return { title: '', staffLabel: '', dateLabel: 'Ngày thực hiện', requiresStaff: false };
      }
    }
    if (targetField === 'historyStatus') {
      const step = historySteps.find(s => s.key === targetValue);
      if (step) {
        return {
          title: step.label,
          staffLabel: step.staffLabel,
          dateLabel: step.dateLabel,
          requiresStaff: true
        };
      }
    }
    return { title: '', staffLabel: '', dateLabel: 'Ngày thực hiện', requiresStaff: false };
  })();

  const requiresEmployee = targetField === 'status' && currentStageInfo.requiresStaff;

  // Lọc danh sách nhân viên phù hợp theo ngữ cảnh từng bước và tổ chuyên môn
  const getFilteredEmployees = () => {
    const isStep = (keys: string[]) => {
      if (targetField === 'status') return keys.includes(targetValue);
      if (targetField === 'historyStatus') return keys.includes(targetValue);
      return false;
    };

    // 1. Lãnh đạo ký duyệt (Ban Giám đốc)
    if (isStep([RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, 'SIGNING'])) {
      const leaders = employees.filter(emp => {
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        return dept.includes('giám đốc') || pos.includes('giám đốc') || pos.includes('lãnh đạo');
      });
      return leaders.length > 0 ? leaders : employees;
    }

    // 2. Cán bộ kiểm tra nội nghiệp (Tổ trưởng / Tổ phó / Kiểm tra Đo đạc)
    if (isStep([RecordStatus.PENDING_CHECK, 'CHECKING'])) {
      const checkers = employees.filter(emp => {
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        const isSurveyDept = dept.includes('đo đạc') || dept.includes('kỹ thuật');
        const isLead = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng') || pos.includes('phó') || pos.includes('kiểm tra');
        return isSurveyDept && isLead;
      });
      if (checkers.length > 0) return checkers;
      const surveyStaff = employees.filter(emp => (emp.department || '').toLowerCase().includes('đo đạc'));
      return surveyStaff.length > 0 ? surveyStaff : employees;
    }

    // 3. Cán bộ Tiếp nhận hồ sơ (Tiếp nhận / Một cửa / Hành chính / Văn thư)
    if (isStep([RecordStatus.RECEIVED, 'RECEIVED'])) {
      const receptionStaff = employees.filter(emp => {
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        return dept.includes('hành chính') || dept.includes('một cửa') || pos.includes('tiếp nhận') || pos.includes('văn thư') || pos.includes('một cửa');
      });
      if (receptionStaff.length > 0) return receptionStaff;
      return employees;
    }

    // 4. Cán bộ Trả kết quả / Bàn giao 1 cửa
    if (isStep([RecordStatus.RETURNED, RecordStatus.HANDOVER, 'RETURNED', 'COMPLETED'])) {
      const returnStaff = employees.filter(emp => {
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        return dept.includes('hành chính') || dept.includes('một cửa') || pos.includes('một cửa') || pos.includes('trả kết quả') || pos.includes('văn thư');
      });
      if (returnStaff.length > 0) return returnStaff;
      return employees;
    }

    // 5. Cán bộ Ngoại nghiệp (Đo thực địa)
    if (isStep([RecordStatus.FIELD_WORK, 'FIELD_WORK', 'ASSIGNED'])) {
      const surveyStaff = employees.filter(emp => {
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        return dept.includes('đo đạc') && !dept.includes('giám đốc') && (pos.includes('ngoại nghiệp') || pos.includes('đo đạc') || !pos.includes('nội nghiệp'));
      });
      if (surveyStaff.length > 0) return surveyStaff;
      const allSurvey = employees.filter(emp => (emp.department || '').toLowerCase().includes('đo đạc'));
      return allSurvey.length > 0 ? allSurvey : employees;
    }

    // 6. Cán bộ Nội nghiệp (Biên tập bản đồ)
    if (isStep([RecordStatus.OFFICE_WORK, 'OFFICE_WORK'])) {
      const officeStaff = employees.filter(emp => {
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        return dept.includes('đo đạc') && !dept.includes('giám đốc') && (pos.includes('nội nghiệp') || pos.includes('biên tập') || !pos.includes('ngoại nghiệp'));
      });
      if (officeStaff.length > 0) return officeStaff;
      const allSurvey = employees.filter(emp => (emp.department || '').toLowerCase().includes('đo đạc'));
      return allSurvey.length > 0 ? allSurvey : employees;
    }

    // 7. Cán bộ Lưu trữ (Xử lý hồ sơ lưu trữ)
    if (isArchiveContext || isStep(['IN_PROGRESS'])) {
      const archiveStaff = employees.filter(emp => (emp.department || '').toLowerCase().includes('lưu trữ'));
      if (archiveStaff.length > 0) return archiveStaff;
      return employees;
    }

    // 8. Mặc định theo tổ đang làm việc
    const normDept = (detectedDept || '').toLowerCase().trim();
    const deptMatches = employees.filter(emp => (emp.department || '').toLowerCase().trim() === normDept);
    if (deptMatches.length > 0) return deptMatches;

    return employees;
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
    const confirmMessage = targetField === 'historyStatus'
      ? `Bạn có chắc chắn muốn cập nhật lịch sử tiến độ cho ${count} hồ sơ đang chọn không?`
      : `Bạn có chắc chắn muốn cập nhật ${count} hồ sơ đang chọn không?`;

    if (confirm(confirmMessage)) {
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                    <Layers size={18} className="text-orange-600" />
                    Thao tác xử lý All (Cập nhật hàng loạt)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                    Số lượng hồ sơ: <strong className="font-bold text-orange-600">{activeRecordsToUpdate.length}</strong> hồ sơ
                    {detectedDept && (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isArchiveContext ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        Tổ: {detectedDept}
                      </span>
                    )}
                </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 bg-white/50 p-1.5 rounded-full transition-colors">
                <X size={18}/>
            </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="space-y-4">
                
                {/* Bước 1 & 2: Lựa chọn trường và giá trị */}
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
                            <option value="assignedDate">Ngày đo đạc / Ngày giao việc</option>
                            <option value="officeAssignedDate">Ngày Biên tập bản đồ</option>
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
                                {selectableStatusList.map(item => (
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
                                <option value="">-- Chọn bước cập nhật lịch sử --</option>
                                {historySteps.map(step => (
                                    <option key={step.key} value={step.key}>{step.label}</option>
                                ))}
                            </select>
                        )}

                        {targetField === 'assignedTo' && (
                            <select 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                            >
                                <option value="">-- Chọn nhân sự --</option>
                                {Object.entries(groupEmployeesByDepartment(employees)).map(([dept, emps]) => (
                                    <optgroup key={dept} label={dept}>
                                        {emps.map(emp => (
                                            <option key={emp.id} value={emp.name}>
                                                {emp.name} ({emp.position || 'Cán bộ'})
                                            </option>
                                        ))}
                                    </optgroup>
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

                {/* Bước 3: Chọn nhân viên xử lý khi chọn Trạng thái hồ sơ (Quy trình) */}
                {targetField === 'status' && targetValue && requiresEmployee && (
                    <div className="space-y-2 bg-blue-50/60 p-3 rounded-lg border border-blue-200">
                        <label className="block text-xs font-bold text-blue-900 flex items-center justify-between">
                            <span>3. Phân công / Chọn cán bộ ({currentStageInfo.staffLabel || 'Cán bộ phụ trách'}):</span>
                            <span className="text-[11px] font-normal text-blue-700">Tùy chọn</span>
                        </label>
                        <select 
                            className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none bg-white font-medium text-gray-800"
                            value={statusEmployee}
                            onChange={(e) => setStatusEmployee(e.target.value)}
                        >
                            <option value="">-- Giữ nguyên / Không đổi cán bộ --</option>
                            {Object.entries(groupEmployeesByDepartment(filteredEmployees)).map(([dept, emps]) => (
                                <optgroup key={dept} label={dept}>
                                    {emps.map(emp => {
                                        const stats = calculateEmployeeWorkload(allRecords || [], emp);
                                        return (
                                            <option key={emp.id} value={emp.name}>
                                                {emp.name} ({emp.position || 'Cán bộ'}) - [Đang làm: {stats.inProgressPlots} | Xong: {stats.completedPlots}]
                                            </option>
                                        );
                                    })}
                                </optgroup>
                            ))}
                        </select>
                        <p className="text-[11px] text-blue-700 leading-normal flex items-center gap-1">
                            <Info size={13} className="shrink-0" />
                            Đã lọc danh sách cán bộ theo đúng chuyên môn và vai trò của bước này.
                        </p>
                    </div>
                )}

                {/* Bước 4: Chọn ngày thực hiện khi chọn Trạng thái hồ sơ (Quy trình) */}
                {targetField === 'status' && targetValue && (
                    <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
                            <span>{requiresEmployee ? "4." : "3."} Xác định {currentStageInfo.dateLabel || 'ngày thực hiện'}:</span>
                            <span className="text-[11px] font-normal text-gray-500">Tùy chọn</span>
                        </label>
                        <input 
                            type="date"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                        />
                        <p className="text-[11px] text-gray-500 leading-normal">
                            Bỏ trống nếu muốn tự động sử dụng mốc thời gian hiện tại.
                        </p>
                    </div>
                )}

                {/* Cấu hình Lịch sử bước quy trình (Cập nhật lịch sử) */}
                {targetField === 'historyStatus' && targetValue && (
                    <div className="space-y-3 bg-amber-50 p-3.5 rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                <History size={15} className="text-amber-700" />
                                Cấu hình thông tin lịch sử: <span className="underline">{currentStageInfo.title}</span>
                            </span>
                            <span className="text-[11px] text-amber-700 font-semibold px-2 py-0.5 bg-amber-100 rounded">
                                {isSurveyContext ? 'Tổ Đo đạc' : 'Tổ Lưu trữ'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    {currentStageInfo.staffLabel}:
                                </label>
                                <select 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium text-gray-800"
                                    value={statusEmployee}
                                    onChange={(e) => setStatusEmployee(e.target.value)}
                                >
                                    <option value="">-- Giữ nguyên / Không đổi cán bộ --</option>
                                    {Object.entries(groupEmployeesByDepartment(filteredEmployees)).map(([dept, emps]) => (
                                        <optgroup key={dept} label={dept}>
                                            {emps.map(emp => (
                                                <option key={emp.id} value={emp.name}>
                                                    {emp.name} ({emp.position || 'Cán bộ'})
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    {currentStageInfo.dateLabel}:
                                </label>
                                <input 
                                    type="date"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none font-medium bg-white"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="bg-amber-100/70 p-2 rounded text-[11px] text-amber-800 leading-normal flex items-start gap-1.5">
                            <Info size={13} className="shrink-0 mt-0.5 text-amber-600" />
                            <span>
                                <strong>Ghi chú:</strong> Thao tác này cập nhật mốc thời gian và cán bộ phụ trách vào lịch sử tiến độ mà không làm thay đổi trạng thái quy trình hiện tại của hồ sơ.
                            </span>
                        </div>
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
                className="px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
                {isProcessing ? 'Đang xử lý...' : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Cập nhật ngay ({activeRecordsToUpdate.length})</span>
                  </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default BulkUpdateModal;
