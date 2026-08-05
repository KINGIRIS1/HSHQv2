import React, { useState, useMemo, useEffect } from 'react';
import { Employee, RecordFile, User as AppUser, RecordStatus, UserRole } from '../types';
import { X, Check, MapPin, User, Users, Search, Briefcase, Star, Clock, FileCheck, Sparkles, ArrowUpDown } from 'lucide-react';
import { removeVietnameseTones } from '../utils/appHelpers';
import { isCapGiayRecord, getRecordPlotCount, isTaxDefaultRecordType, getDefaultCapGiaySubStep } from '../constants';

interface DeptConfig {
    id: string;
    label: string;
    subtitle: string;
    matchKeys: string[];
}

const DEPARTMENTS_CONFIG: DeptConfig[] = [
    {
        id: 'Tổ Cấp giấy',
        label: 'Tổ Cấp giấy',
        subtitle: 'Đăng ký, biến động, cấp ...',
        matchKeys: ['tổ cấp giấy', 'tổ đăng ký cấp giấy', 'đăng ký cấp giấy', 'tổ đăng ký', 'cấp giấy']
    },
    {
        id: 'Tổ Lưu trữ',
        label: 'Tổ Lưu trữ',
        subtitle: 'Khai thác hồ sơ & dữ liệu l...',
        matchKeys: ['tổ thông tin lưu trữ', 'tổ lưu trữ', 'thông tin lưu trữ', 'lưu trữ']
    },
    {
        id: 'Tổ Đo đạc',
        label: 'Tổ Đo đạc',
        subtitle: 'Đo vẽ bản đồ, trích đo th...',
        matchKeys: ['tổ đo đạc', 'đo đạc']
    },
    {
        id: 'Tổ Hành chính',
        label: 'Tổ Hành chính',
        subtitle: 'Một cửa, tổng hợp, hành ...',
        matchKeys: ['tổ hành chính', 'một cửa', 'quản trị hệ thống', 'hành chính']
    },
    {
        id: 'Ban Giám đốc',
        label: 'Ban Giám đốc',
        subtitle: 'Ban Giám đốc & Phối hợp ...',
        matchKeys: ['ban giám đốc', 'giám đốc']
    }
];

interface EmployeeWorkload {
    activeCount: number;
    activePlotCount: number;
    totalCount: number;
    totalPlotCount: number;
}

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (employeeId: string, subStep?: string) => void;
  employees: Employee[];
  selectedRecords: RecordFile[];
  allRecords?: RecordFile[];
  filterDepartment?: string;
  currentView?: string;
  currentUser?: AppUser | null;
}

interface EmployeeItemProps {
    emp: Employee;
    isLastAssigned: boolean;
    isTargetWardMatch: boolean;
    isSelected: boolean;
    isLowestWorkload?: boolean;
    workload?: EmployeeWorkload;
    isCapGiayView?: boolean;
    onSelect: (id: string) => void;
}

// Component hiển thị một dòng nhân viên trong danh sách tổ chuyên môn
const EmployeeItem: React.FC<EmployeeItemProps> = ({ 
    emp, isLastAssigned, isTargetWardMatch, isSelected, isLowestWorkload, workload, isCapGiayView, onSelect 
}) => (
    <div 
        onClick={() => onSelect(emp.id)}
        className={`relative flex flex-col justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 group h-full ${
            isTargetWardMatch 
                ? (isSelected 
                    ? 'bg-emerald-100/90 border-emerald-600 shadow-md ring-2 ring-emerald-300' 
                    : 'bg-emerald-50 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100/70 shadow-sm')
                : (isSelected 
                    ? 'bg-indigo-50/80 border-indigo-500 shadow-md ring-2 ring-indigo-200' 
                    : 'bg-white border-gray-200 hover:border-indigo-400 hover:shadow-lg')
        }`}
    >
        {/* Phần trên: Ảnh/Chữ viết tắt tên & Thông tin nhân viên */}
        <div>
            <div className="flex items-start gap-2.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                    isSelected 
                        ? 'bg-indigo-600 text-white' 
                        : isTargetWardMatch 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-gray-100 text-gray-700 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                }`}>
                    {emp.name.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`font-black text-sm truncate ${isSelected ? 'text-indigo-900' : isTargetWardMatch ? 'text-emerald-950 font-extrabold' : 'text-gray-800'}`}>
                            {emp.name}
                        </span>
                        {/* Dấu tích chọn nổi bật màu tím indigo khi nhân viên được chọn */}
                        {isSelected && (
                            <div className="bg-indigo-600 text-white p-1 rounded-full shadow-xs shrink-0 flex items-center justify-center">
                                <Check size={14} strokeWidth={3} />
                            </div>
                        )}
                    </div>
                    
                    {/* Chức vụ và Tổ thể hiện ví dụ: Chuyên viên - Tổ Đo đạc */}
                    <div className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <Briefcase size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">{emp.position || 'Nhân viên'} - <span className="text-indigo-700 font-bold">{emp.department || 'Tổ chuyên môn'}</span></span>
                    </div>
                </div>
            </div>

            {/* THÔNG TIN CÂN BẰNG TẢI (HIỂN THỊ CHI TIẾT SỐ HỒ SƠ VÀ SỐ THỬA ĐẤT) */}
            {workload && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/80 w-full space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600 flex items-center gap-1">
                            <Clock size={13} className="text-amber-500" />
                            Đang xử lý:
                        </span>
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-extrabold shadow-2xs">
                            {workload.activeCount} HS <span className="text-amber-700 font-bold">({workload.activePlotCount} thửa)</span>
                        </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-600 flex items-center gap-1">
                            <FileCheck size={13} className="text-teal-600" />
                            Tổng đã giao:
                        </span>
                        <span className="text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-extrabold shadow-2xs">
                            {workload.totalCount} HS <span className="text-teal-800 font-bold">({workload.totalPlotCount} thửa)</span>
                        </span>
                    </div>

                    {isLowestWorkload && (
                        <div className="mt-1 text-[11px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded text-center border border-emerald-300 flex items-center justify-center gap-1 shadow-2xs">
                            <Sparkles size={12} className="text-emerald-600" />
                            <span>Gợi ý: Tải ít nhất ({workload.activePlotCount} thửa)</span>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Dòng địa bàn phụ trách */}
        {emp.managedWards && emp.managedWards.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200/60 w-full">
                <span className="text-[10px] text-gray-500 font-bold block mb-1 uppercase tracking-tight">ĐỊA BÀN PHỤ TRÁCH:</span>
                <div className="grid grid-cols-4 gap-1 w-full">
                    {emp.managedWards.map((w, idx) => {
                        const displayName = w.replace(/^(Xã|Phường|Thị trấn|TT\.)\s+/i, '');
                        return (
                            <span 
                                key={idx} 
                                className="text-[10px] bg-white/90 text-slate-700 px-1 py-0.5 rounded border border-slate-200/80 text-center font-medium block shadow-2xs whitespace-nowrap overflow-hidden text-ellipsis" 
                                title={w}
                            >
                                {displayName}
                            </span>
                        );
                    })}
                </div>
            </div>
        )}
    </div>
);

const AssignModal: React.FC<AssignModalProps> = ({ 
    isOpen, onClose, onConfirm, employees, selectedRecords, allRecords, filterDepartment, currentView, currentUser 
}) => {
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByLowestWorkload, setSortByLowestWorkload] = useState(false);

  // Tự động xác định địa bàn mục tiêu từ các hồ sơ được chọn
  const targetWardName = useMemo(() => {
      if (!selectedRecords || selectedRecords.length === 0) return null;
      
      const firstWard = selectedRecords[0].ward;
      if (!firstWard) return null;

      const normFirst = removeVietnameseTones(firstWard);
      const isUniform = selectedRecords.every(r => 
          r.ward && removeVietnameseTones(r.ward) === normFirst
      );

      return isUniform ? firstWard : null;
  }, [selectedRecords]);

  // Lấy danh sách tất cả phòng ban/tổ chuyên môn khả dụng
  const departments = useMemo(() => {
      return DEPARTMENTS_CONFIG.map(c => c.id);
  }, []);

  // Xác định tổ chuyên môn mặc định cho hồ sơ dựa theo Tab/View hiện tại hoặc loại hồ sơ
  const getRecordDefaultDepartment = (records: RecordFile[], view?: string, filterDept?: string): string => {
      if (filterDept) {
          const normFilter = filterDept.toLowerCase();
          if (normFilter.includes('đo đạc') || normFilter.includes('đo dạc')) return 'Tổ Đo đạc';
          if (normFilter.includes('cấp giấy') || normFilter.includes('đăng ký')) return 'Tổ Cấp giấy';
          if (normFilter.includes('lưu trữ')) return 'Tổ Lưu trữ';
          if (normFilter.includes('hành chính') || normFilter.includes('một cửa')) return 'Tổ Hành chính';
      }

      if (view) {
          const normView = view.toLowerCase();
          if (normView.includes('archive') || normView.includes('saoluc') || normView.includes('congvan')) {
              return 'Tổ Lưu trữ';
          }
          if (normView.includes('other')) {
              return 'Tổ Cấp giấy';
          }
          if (normView.includes('all_records') || normView.includes('assign_tasks') || normView.includes('check_list') || normView.includes('handover_list') || normView.includes('completed')) {
              return 'Tổ Đo đạc';
          }
      }

      if (records && records.length > 0) {
          const record = records[0];
          const type = (record.recordType || '').toLowerCase();
          
          if (type.includes('1.1') || type.includes('1.2') || type.includes('công văn') || type.includes('lưu trữ')) {
              return 'Tổ Lưu trữ';
          }
          if (type.includes('2.1') || type.includes('trích lục')) {
              return 'Tổ Cấp giấy';
          }
          if (type.includes('2.2') || type.includes('2.3') || type.includes('2.4') || type.includes('2.5') || type.includes('2.6') || type.includes('số thửa') || type.includes('trích đo') || type.includes('đo đạc')) {
              return 'Tổ Đo đạc';
          }
      }

      return 'Tổ Cấp giấy';
  };

  // Hàm kiểm tra nhân viên có thuộc tổ chuyên môn được chọn hay không
  const isEmployeeInDept = (emp: Employee, deptId: string) => {
      const config = DEPARTMENTS_CONFIG.find(c => c.id === deptId);
      return config 
          ? config.matchKeys.some(key => emp.department?.toLowerCase().includes(key))
          : emp.department === deptId;
  };

  // Tính toán workload chi tiết (số HS + số thửa) cho từng nhân viên
  const workloadMap = useMemo(() => {
      const map: Record<string, EmployeeWorkload> = {};
      const recordsToScan = allRecords || selectedRecords || [];
      const isCapGiayDept = selectedDept.toLowerCase().includes('cấp giấy');

      employees.forEach(emp => {
          const isLeader = emp && (
              emp.position?.toLowerCase().includes('tổ') ||
              emp.position?.toLowerCase().includes('nhóm') ||
              emp.position?.toLowerCase().includes('trưởng') ||
              emp.position?.toLowerCase().includes('phó')
          );
          const empAssigned = recordsToScan.filter(r => 
              r.assignedTo === emp.id || r.assignedTo === emp.name || (isLeader && (r.checkedBy === emp.id || r.checkedBy === emp.name))
          );

          const filteredAssigned = empAssigned;

          const activeRecords = filteredAssigned.filter(r => {
              const statusStr = String(r.status || '');
              return (
                  r.status !== RecordStatus.RETURNED &&
                  r.status !== RecordStatus.WITHDRAWN &&
                  r.status !== RecordStatus.REJECTED &&
                  statusStr !== 'HOAN_THANH'
              );
          });

          const activeCount = activeRecords.length;
          const activePlotCount = activeRecords.reduce((acc, r) => acc + getRecordPlotCount(r), 0);
          const totalCount = filteredAssigned.length;
          const totalPlotCount = filteredAssigned.reduce((acc, r) => acc + getRecordPlotCount(r), 0);

          map[emp.id] = {
              activeCount,
              activePlotCount,
              totalCount,
              totalPlotCount
          };
      });

      return map;
  }, [employees, allRecords, selectedRecords, selectedDept]);

  const [selectedSubStep, setSelectedSubStep] = useState<string>('tham_dinh');

  // Mỗi khi mở modal, tự động đặt tổ chuyên môn mặc định & bước SLA Cấp Giấy
  useEffect(() => {
      if (isOpen) {
          const defaultDept = getRecordDefaultDepartment(selectedRecords, currentView, filterDepartment);
          setSelectedDept(defaultDept);
          setSearchTerm('');

          if (selectedRecords && selectedRecords.length > 0) {
              const firstRecord = selectedRecords[0];
              if (firstRecord.capGiaySubStep) {
                  setSelectedSubStep(firstRecord.capGiaySubStep);
              } else {
                  setSelectedSubStep(getDefaultCapGiaySubStep(firstRecord.recordType));
              }
          }
      }
  }, [isOpen, selectedRecords, currentView, filterDepartment]);

  // Xác định người được giao việc gần nhất
  const lastAssignedIdForCurrentDept = useMemo(() => {
      if (!selectedDept) return null;
      return localStorage.getItem(`last_assigned_${selectedDept}`);
  }, [selectedDept, isOpen]);

  useEffect(() => {
      if (isOpen && selectedDept) {
          if (lastAssignedIdForCurrentDept) {
              const isValid = employees.some(e => e.id === lastAssignedIdForCurrentDept && isEmployeeInDept(e, selectedDept));
              if (isValid) {
                  setSelectedEmpId(lastAssignedIdForCurrentDept);
                  return;
              }
          }
          setSelectedEmpId('');
      }
  }, [isOpen, selectedDept, employees, lastAssignedIdForCurrentDept]);

  // Lọc và tìm kiếm nhân viên thuộc tổ chuyên môn
  const filteredEmployees = useMemo(() => {
      let list = employees.filter(emp => {
          const deptMatch = isEmployeeInDept(emp, selectedDept);
          if (!deptMatch) return false;

          if (searchTerm) {
              const term = searchTerm.toLowerCase();
              return (
                  emp.name.toLowerCase().includes(term) ||
                  (emp.position || '').toLowerCase().includes(term) ||
                  (emp.managedWards || []).some(w => w.toLowerCase().includes(term))
              );
          }
          return true;
      });

      if (sortByLowestWorkload) {
          // Sắp xếp tăng dần theo số thửa đất đang xử lý
          list.sort((a, b) => {
              const wlA = workloadMap[a.id]?.activePlotCount || 0;
              const wlB = workloadMap[b.id]?.activePlotCount || 0;
              return wlA - wlB;
          });
      } else if (lastAssignedIdForCurrentDept) {
          list.sort((a, b) => {
              if (a.id === lastAssignedIdForCurrentDept) return -1;
              if (b.id === lastAssignedIdForCurrentDept) return 1;
              return 0;
          });
      }

      return list;
  }, [employees, selectedDept, searchTerm, lastAssignedIdForCurrentDept, sortByLowestWorkload, workloadMap]);

  // Lấy giá trị thửa đất đang xử lý thấp nhất trong danh sách nhân viên hiện tại
  const lowestActivePlotCountInDept = useMemo(() => {
      if (!filteredEmployees || filteredEmployees.length === 0) return null;
      let minVal = Infinity;
      filteredEmployees.forEach(emp => {
          const plots = workloadMap[emp.id]?.activePlotCount || 0;
          if (plots < minVal) minVal = plots;
      });
      return minVal === Infinity ? null : minVal;
  }, [filteredEmployees, workloadMap]);

  const isWardMatch = (emp: Employee) => {
      if (!targetWardName) return false;
      const targetNorm = removeVietnameseTones(targetWardName);
      return !!(emp.managedWards && emp.managedWards.some(w => removeVietnameseTones(w) === targetNorm));
  };

  const handleConfirmAssign = () => {
      if (selectedEmpId && selectedDept) {
          localStorage.setItem(`last_assigned_${selectedDept}`, selectedEmpId);
          onConfirm(selectedEmpId, isCapGiayView ? selectedSubStep : undefined);
      }
  };

  if (!isOpen) return null;

  const isCapGiayView = selectedDept.toLowerCase().includes('cấp giấy');

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100] p-2 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1700px] flex flex-col h-[88vh] animate-fade-in-up overflow-hidden border border-slate-100">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-teal-100 p-2.5 rounded-xl text-teal-700 shadow-sm border border-teal-200">
                    <Users size={22} className="stroke-[2.5]" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                        Phân công hồ sơ chuyên môn
                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-300">
                            Cân bằng theo số thửa
                        </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        {selectedRecords.length === 1 
                            ? `Giao hồ sơ: ${selectedRecords[0].code} - ${selectedRecords[0].customerName}` 
                            : `Đang giao ${selectedRecords.length} hồ sơ chuyên môn cùng lúc`
                        }
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setSortByLowestWorkload(!sortByLowestWorkload)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                        sortByLowestWorkload 
                            ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Sắp xếp người có khối lượng thửa đất ít nhất lên đầu"
                >
                    <ArrowUpDown size={14} />
                    <span>Xếp theo tải ít nhất</span>
                </button>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Tìm nhân viên trong tổ..." 
                        className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 w-64 bg-slate-50 transition-all placeholder-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* BƯỚC QUY TRÌNH GIAO VIỆC SLA (DÀNH RIÊNG TỔ CẤP GIẤY) */}
        {isCapGiayView && (
            <div className="px-6 py-3 bg-gradient-to-r from-teal-50/90 via-sky-50/80 to-indigo-50/90 border-b border-teal-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-teal-600 shrink-0" />
                    <div>
                        <span className="text-xs font-black text-teal-900 uppercase tracking-tight block">
                            Chọn bước quy trình Cấp Giấy (SLA định mức)
                        </span>
                        <span className="text-[11px] text-slate-600 font-semibold">
                            {selectedSubStep === 'tham_dinh' && 'Bước: Thẩm tra hồ sơ'}
                            {selectedSubStep === 'phieu_chuyen_thue' && 'Bước: Phiếu chuyển thuế'}
                            {selectedSubStep === 'cho_nop_thue' && 'Bước: Chờ giấy nộp tiền'}
                            {selectedSubStep === 'hoan_thien_trinh_duyet' && 'Bước: In & Hoàn thiện'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    <button
                        type="button"
                        onClick={() => setSelectedSubStep('tham_dinh')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 shrink-0 ${
                            selectedSubStep === 'tham_dinh'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                        title="Thẩm tra"
                    >
                        <span>Thẩm tra</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedSubStep('phieu_chuyen_thue')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 shrink-0 ${
                            selectedSubStep === 'phieu_chuyen_thue'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-200'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50 hover:border-purple-300'
                        }`}
                        title="Phiếu chuyển thuế"
                    >
                        <span>Phiếu chuyển thuế</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedSubStep('cho_nop_thue')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 shrink-0 ${
                            selectedSubStep === 'cho_nop_thue'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-200'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                        }`}
                        title="Chờ giấy nộp tiền"
                    >
                        <span>Chờ giấy nộp tiền</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedSubStep('hoan_thien_trinh_duyet')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 shrink-0 ${
                            selectedSubStep === 'hoan_thien_trinh_duyet'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                        }`}
                        title="In & Hoàn thiện"
                    >
                        <span>In & Hoàn thiện</span>
                    </button>
                </div>
            </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
             
             {/* LEFT SIDEBAR: TAB SELECTING BY DEPARTMENT ("TỔ CHUYÊN MÔN") */}
             <div className="w-80 bg-slate-50 border-r border-slate-100 flex flex-col shrink-0 overflow-y-auto">
                 <div className="p-4 border-b border-slate-100 bg-slate-50 sticky top-0 backdrop-blur-sm z-10">
                     <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase">DANH SÁCH TỔ CHUYÊN MÔN</span>
                     {targetWardName && (
                         <div className="text-[10px] text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-100 mt-2 font-black inline-flex items-center gap-1">
                             <MapPin size={10} /> Địa bàn: {targetWardName}
                         </div>
                     )}
                 </div>
                 
                 <div className="p-2 space-y-1.5">
                     {departments.map(dept => {
                         const count = employees.filter(e => isEmployeeInDept(e, dept)).length;
                         const isSelected = selectedDept === dept;
                         const isDefault = getRecordDefaultDepartment(selectedRecords, currentView) === dept;
                         
                         return (
                             <button
                                  key={dept}
                                  onClick={() => { setSelectedDept(dept); setSearchTerm(''); }}
                                  className={`group w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 ${
                                      isSelected 
                                          ? 'bg-teal-700 text-white shadow-lg shadow-teal-100 translate-x-1' 
                                          : 'bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 hover:shadow-sm text-slate-700'
                                  }`}
                              >
                                  {(() => {
                                      const config = DEPARTMENTS_CONFIG.find(c => c.id === dept);
                                      const label = config ? config.label : dept;
                                      const subtitle = config ? config.subtitle : '';
                                      
                                      const currentEmp = employees.find(e => e.id === currentUser?.employeeId);
                                      const isUserDept = config && currentEmp?.department && 
                                          config.matchKeys.some(key => currentEmp.department?.toLowerCase().includes(key));

                                      return (
                                          <div className="flex items-center gap-3 w-full min-w-0">
                                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                  isSelected ? 'bg-teal-800' : 'bg-slate-100 group-hover:bg-teal-50'
                                              }`}>
                                                  <Briefcase size={16} className={isSelected ? 'text-white' : 'text-slate-500'} />
                                              </div>
                                              <div className="flex-1 min-w-0 flex flex-col">
                                                  <div className="flex items-center gap-1">
                                                      <span className={`font-bold text-sm tracking-tight truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                                          {label}
                                                      </span>
                                                      {isUserDept && (
                                                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ml-1 ${
                                                              isSelected ? 'bg-teal-600 text-white' : 'bg-purple-100 text-purple-700 font-bold'
                                                          }`}>
                                                              CỦA BẠN
                                                          </span>
                                                      )}
                                                  </div>
                                                  {subtitle && (
                                                      <span className={`text-[10px] truncate mt-0.5 font-medium ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                                                          {subtitle}
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })()}
                                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                      {isDefault && (
                                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                              isSelected ? 'bg-teal-800 text-white' : 'bg-orange-100 text-orange-700 border border-orange-200'
                                          }`}>
                                              Gợi ý
                                          </span>
                                      )}
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                          isSelected ? 'bg-teal-900 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'
                                      }`}>
                                          {count}
                                      </span>
                                  </div>
                              </button>
                         );
                     })}
                 </div>
             </div>

             {/* RIGHT WORKSPACE: EMPLOYEES GRID OF THE SELECTED DEPARTMENT */}
             <div className="flex-1 flex flex-col bg-white overflow-hidden">
                 <div className="p-4 border-b border-slate-100 bg-white z-10 shrink-0 flex items-center justify-between">
                     <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                           <Users size={16} className="text-slate-500" />
                           {selectedDept} ({filteredEmployees.length} thành viên)
                        </h4>
                        <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                            Thống kê khối lượng dựa trên Số hồ sơ & Số thửa đất được giao xử lý
                        </p>
                     </div>
                 </div>

                 <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-slate-50/50">
                     {filteredEmployees.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredEmployees.map(emp => {
                                const wl = workloadMap[emp.id];
                                const isLowest = lowestActivePlotCountInDept !== null && wl && wl.activePlotCount === lowestActivePlotCountInDept;
                                return (
                                    <EmployeeItem 
                                        key={emp.id} 
                                        emp={emp}
                                        isLastAssigned={lastAssignedIdForCurrentDept === emp.id}
                                        isTargetWardMatch={isWardMatch(emp)}
                                        isSelected={selectedEmpId === emp.id}
                                        workload={wl}
                                        isLowestWorkload={isLowest}
                                        isCapGiayView={isCapGiayView}
                                        onSelect={setSelectedEmpId}
                                    />
                                );
                            })}
                         </div>
                     ) : (
                         <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl m-2 bg-white p-8">
                            <Users size={40} className="mb-3 opacity-30 text-teal-600" />
                            <p className="text-sm font-bold text-slate-600">Không tìm thấy thành viên nào</p>
                            <p className="text-xs text-slate-400 mt-1">Không tìm thấy thành viên của tổ chuyên môn khớp với từ khóa tìm kiếm.</p>
                         </div>
                     )}
                 </div>
             </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t bg-white flex justify-between items-center shrink-0">
            <div className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                <span className="text-teal-600 font-black">💡</span> 
                <span>
                    Khối lượng được tính theo số thửa đất giúp cân bằng công việc chính xác giữa các cán bộ.
                </span>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose} 
                    className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-bold transition-all border border-transparent hover:border-slate-200"
                >
                    Hủy bỏ
                </button>
                <button 
                    onClick={handleConfirmAssign}
                    disabled={!selectedEmpId}
                    className="px-6 py-2.5 bg-teal-700 text-white rounded-xl hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-black tracking-wider shadow-lg shadow-teal-100 transition-all active:scale-95 flex items-center gap-2"
                >
                    <Check size={18} className="stroke-[2.5]" /> Xác nhận giao việc
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AssignModal;
