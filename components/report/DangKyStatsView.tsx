import React, { useState, useMemo } from 'react';
import { DangKyRecord, Employee, User, UserRole } from '../../types';
import { detectProcedureId } from '../../constants/procedures';
import { exportDangKyReportToExcel } from '../../utils/excelExport';
import { removeVietnameseTones, parseSafeDate } from '../../utils/appHelpers';
import { calculateRecordStepDeadlines, isDangKyStepOverdue, isDangKyStepApproaching } from '../../utils/stepDeadlineEngine';
import { 
  BookOpen, FileSpreadsheet, CheckCircle2, Clock, AlertTriangle, 
  UserCheck, MapPin, Search, Filter, Layers, DollarSign, Download, 
  Eye, ChevronLeft, ChevronRight, Activity, Printer, Receipt, 
  FileText, TrendingUp, BarChart2, CheckSquare, Sparkles, Building2
} from 'lucide-react';
import DangKyDetailModal from '../DangKyDetailModal';

interface DangKyStatsViewProps {
  records: DangKyRecord[];
  employees: Employee[];
  wards: string[];
  fromDate: string;
  toDate: string;
  currentUser?: User;
  onViewRecord?: (record: DangKyRecord) => void;
}

type SubTabType = 'overview' | 'procedures' | 'staff' | 'wards' | 'overdue' | 'details';

const formatDateVN = (d?: string | null) => {
  if (!d) return '---';
  const clean = d.includes('T') ? d.split('T')[0] : d;
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return d;
};

const formatCurrency = (val?: number | string | null) => {
  if (val === null || val === undefined || val === '') return '0 đ';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num <= 0) return '0 đ';
  return `${num.toLocaleString('vi-VN')} đ`;
};

export const DangKyStatsView: React.FC<DangKyStatsViewProps> = ({
  records,
  employees,
  wards,
  fromDate,
  toDate,
  currentUser,
  onViewRecord
}) => {
  const [subTab, setSubTab] = useState<SubTabType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedProcedure, setSelectedProcedure] = useState<string>('all');
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [cardStatusFilter, setCardStatusFilter] = useState<string | null>(null);

  // Pagination for details tab
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Modal view record
  const [activeDetailRecord, setActiveDetailRecord] = useState<DangKyRecord | null>(null);

  // 1. FILTER RECORDS BY DATE AND GENERAL ATTRIBUTES
  const filteredRecords = useMemo(() => {
    const start = parseSafeDate(fromDate) || new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = parseSafeDate(toDate) || new Date(toDate);
    end.setHours(23, 59, 59, 999);

    return records.filter(r => {
      // Date filter
      if (r.receivedDate) {
        const rDate = parseSafeDate(r.receivedDate);
        if (rDate) {
          rDate.setHours(12, 0, 0, 0);
          if (rDate < start || rDate > end) return false;
        }
      }

      // Ward filter
      if (selectedWard !== 'all') {
        const rWard = removeVietnameseTones(r.ward || '');
        const sWard = removeVietnameseTones(selectedWard);
        if (!rWard.includes(sWard)) return false;
      }

      // Procedure filter
      if (selectedProcedure !== 'all') {
        if (r.recordType !== selectedProcedure) return false;
      }

      // Staff filter (checks appraisal, tax, print or assigned staff)
      if (selectedStaff !== 'all') {
        const matchesStaff = 
          r.appraisalStaff === selectedStaff ||
          r.assignedTo === selectedStaff ||
          r.taxFormStaff === selectedStaff ||
          r.taxKV7Staff === selectedStaff ||
          r.printStaff === selectedStaff;
        if (!matchesStaff) return false;
      }

      // Status dropdown filter
      if (selectedStatus !== 'all') {
        if (r.status !== selectedStatus) return false;
      }

      // Card quick filter
      if (cardStatusFilter) {
        if (cardStatusFilter === 'completed') {
          if (!['Đã giao 1 cửa', 'Đã trả kết quả', 'Hoàn thành'].includes(r.status)) return false;
        } else if (cardStatusFilter === 'in_progress') {
          if (['Đã giao 1 cửa', 'Đã trả kết quả', 'CSD rút HS', 'Trả hủy hồ sơ'].includes(r.status)) return false;
        } else if (cardStatusFilter === 'overdue') {
          if (!isDangKyStepOverdue(r)) return false;
        } else if (cardStatusFilter === 'warning') {
          if (!isDangKyStepApproaching(r)) return false;
        } else if (cardStatusFilter === 'tax') {
          if (!['Phiếu chuyển thuế', 'Chờ Thuế KV7', 'Chờ giấy nộp tiền', 'Thông báo thuế'].includes(r.status)) return false;
        } else if (cardStatusFilter === 'print') {
          if (!['Chờ In GCN', 'In GCN'].includes(r.status)) return false;
        } else if (cardStatusFilter === 'sign') {
          if (!['Chờ kiểm tra', 'Chờ ký duyệt', 'Trình ký'].includes(r.status)) return false;
        }
      }

      // Search keyword filter
      if (searchTerm.trim()) {
        const searchClean = removeVietnameseTones(searchTerm.toLowerCase());
        const codeClean = removeVietnameseTones((r.code || '').toLowerCase());
        const ownerNames = (r.owners || []).map(o => o.name).join(' ');
        const transfereeNames = (r.transferees || []).map(t => t.name).join(' ');
        const partyClean = removeVietnameseTones(`${ownerNames} ${transfereeNames} ${r.authorizedPersonName || ''}`.toLowerCase());
        const plotSheetClean = `${r.landPlot || ''} ${r.mapSheet || ''}`.toLowerCase();

        if (!codeClean.includes(searchClean) && !partyClean.includes(searchClean) && !plotSheetClean.includes(searchClean)) {
          return false;
        }
      }

      return true;
    });
  }, [records, fromDate, toDate, selectedWard, selectedProcedure, selectedStaff, selectedStatus, cardStatusFilter, searchTerm]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedWard, selectedProcedure, selectedStaff, selectedStatus, cardStatusFilter, searchTerm, fromDate, toDate]);

  // 2. OVERVIEW KPI CALCULATIONS
  const stats = useMemo(() => {
    let total = filteredRecords.length;
    let completedOnTime = 0;
    let completedOverdue = 0;
    let inProgress = 0;
    let overdueStep = 0;
    let warningStep = 0;
    let totalFee = 0;

    // Khâu breakdown
    let stageAppraisal = 0; // Thẩm định
    let stageTax = 0;       // Thuế
    let stagePrint = 0;     // In GCN
    let stageCheckSign = 0; // Trình KT / Ký
    let stageHandover = 0;  // Bàn giao 1 cửa
    let stageReturned = 0;  // Đã trả kết quả

    filteredRecords.forEach(r => {
      const fee = Number(r.feeAmount || r.price || 0);
      if (fee > 0) totalFee += fee;

      const isCompleted = ['Đã giao 1 cửa', 'Đã trả kết quả', 'Hoàn thành'].includes(r.status);
      const isWithdrawnOrCancelled = ['CSD rút HS', 'Trả hủy hồ sơ'].includes(r.status);

      if (isCompleted) {
        if (r.status === 'Đã trả kết quả') stageReturned++;
        else stageHandover++;

        const dl = r.deadline ? new Date(r.deadline).getTime() : 0;
        const compDateStr = r.completedDate || r.resultReturnedDate;
        const comp = compDateStr ? new Date(compDateStr).getTime() : 0;
        if (dl && comp && comp > dl) {
          completedOverdue++;
        } else {
          completedOnTime++;
        }
      } else if (!isWithdrawnOrCancelled) {
        inProgress++;
        if (isDangKyStepOverdue(r)) overdueStep++;
        if (isDangKyStepApproaching(r)) warningStep++;

        if (['Tiếp nhận mới', 'Thẩm định', 'Chờ bổ sung'].includes(r.status)) {
          stageAppraisal++;
        } else if (['Phiếu chuyển thuế', 'Chờ Thuế KV7', 'Chờ giấy nộp tiền', 'Thông báo thuế'].includes(r.status)) {
          stageTax++;
        } else if (['Chờ In GCN', 'In GCN'].includes(r.status)) {
          stagePrint++;
        } else if (['Chờ kiểm tra', 'Chờ ký duyệt', 'Trình ký'].includes(r.status)) {
          stageCheckSign++;
        } else if (r.status === 'Chờ bàn giao') {
          stageHandover++;
        }
      }
    });

    const totalCompleted = completedOnTime + completedOverdue;
    const onTimeRate = totalCompleted > 0 
      ? ((completedOnTime / totalCompleted) * 100).toFixed(1) 
      : (total > 0 ? (((total - overdueStep) / total) * 100).toFixed(1) : '100');

    return {
      total,
      completedOnTime,
      completedOverdue,
      totalCompleted,
      inProgress,
      overdueStep,
      warningStep,
      totalFee,
      onTimeRate,
      stageAppraisal,
      stageTax,
      stagePrint,
      stageCheckSign,
      stageHandover,
      stageReturned
    };
  }, [filteredRecords]);

  // 3. STATS BY PROCEDURE TYPE
  const procedureStats = useMemo(() => {
    const map = new Map<string, {
      procedureName: string;
      procId: string;
      total: number;
      inProgress: number;
      completedOnTime: number;
      completedOverdue: number;
      overdueStep: number;
      totalFee: number;
    }>();

    filteredRecords.forEach(r => {
      const type = r.recordType || 'Chưa phân loại';
      const procId = detectProcedureId(r.code, type) || '3.1.1';

      if (!map.has(type)) {
        map.set(type, {
          procedureName: type,
          procId,
          total: 0,
          inProgress: 0,
          completedOnTime: 0,
          completedOverdue: 0,
          overdueStep: 0,
          totalFee: 0
        });
      }

      const item = map.get(type)!;
      item.total++;
      const fee = Number(r.feeAmount || r.price || 0);
      if (fee > 0) item.totalFee += fee;

      const isCompleted = ['Đã giao 1 cửa', 'Đã trả kết quả', 'Hoàn thành'].includes(r.status);
      const isWithdrawn = ['CSD rút HS', 'Trả hủy hồ sơ'].includes(r.status);

      if (isCompleted) {
        const dl = r.deadline ? new Date(r.deadline).getTime() : 0;
        const compDateStr = r.completedDate || r.resultReturnedDate;
        const comp = compDateStr ? new Date(compDateStr).getTime() : 0;
        if (dl && comp && comp > dl) item.completedOverdue++;
        else item.completedOnTime++;
      } else if (!isWithdrawn) {
        item.inProgress++;
        if (isDangKyStepOverdue(r)) item.overdueStep++;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  // 4. STATS BY STAFF
  const staffStats = useMemo(() => {
    const map = new Map<string, {
      staffId: string;
      staffName: string;
      position: string;
      totalAssigned: number;
      appraisalCount: number;
      taxCount: number;
      printCount: number;
      completed: number;
      inProgress: number;
      overdue: number;
      feeCollected: number;
    }>();

    // Initialize with all registration employees
    employees.forEach(emp => {
      const dept = (emp.department || '').toLowerCase();
      if (dept.includes('đăng ký') || dept.includes('đkđđ') || dept.includes('cấp gcn') || dept.includes('thẩm định') || dept.includes('kỹ thuật')) {
        map.set(emp.id, {
          staffId: emp.id,
          staffName: emp.name,
          position: emp.position || 'Cán bộ Đăng ký',
          totalAssigned: 0,
          appraisalCount: 0,
          taxCount: 0,
          printCount: 0,
          completed: 0,
          inProgress: 0,
          overdue: 0,
          feeCollected: 0
        });
      }
    });

    filteredRecords.forEach(r => {
      const staffList = new Set<string>();
      if (r.appraisalStaff) staffList.add(r.appraisalStaff);
      if (r.assignedTo) staffList.add(r.assignedTo);
      if (r.taxFormStaff) staffList.add(r.taxFormStaff);
      if (r.taxKV7Staff) staffList.add(r.taxKV7Staff);
      if (r.printStaff) staffList.add(r.printStaff);

      staffList.forEach(sId => {
        if (!map.has(sId)) {
          const emp = employees.find(e => e.id === sId);
          map.set(sId, {
            staffId: sId,
            staffName: emp ? emp.name : sId,
            position: emp?.position || 'Cán bộ',
            totalAssigned: 0,
            appraisalCount: 0,
            taxCount: 0,
            printCount: 0,
            completed: 0,
            inProgress: 0,
            overdue: 0,
            feeCollected: 0
          });
        }

        const entry = map.get(sId)!;
        entry.totalAssigned++;

        if (r.appraisalStaff === sId || r.assignedTo === sId) entry.appraisalCount++;
        if (r.taxFormStaff === sId || r.taxKV7Staff === sId) entry.taxCount++;
        if (r.printStaff === sId) entry.printCount++;

        const isDone = ['Đã giao 1 cửa', 'Đã trả kết quả', 'Hoàn thành'].includes(r.status);
        if (isDone) entry.completed++;
        else {
          entry.inProgress++;
          if (isDangKyStepOverdue(r)) entry.overdue++;
        }

        const fee = Number(r.feeAmount || r.price || 0);
        if (fee > 0) entry.feeCollected += fee;
      });
    });

    return Array.from(map.values())
      .filter(s => s.totalAssigned > 0)
      .sort((a, b) => b.totalAssigned - a.totalAssigned);
  }, [filteredRecords, employees]);

  // 5. STATS BY WARD
  const wardStats = useMemo(() => {
    const map = new Map<string, {
      ward: string;
      total: number;
      inProgress: number;
      completed: number;
      overdue: number;
      totalFee: number;
    }>();

    filteredRecords.forEach(r => {
      const w = r.ward || 'Chưa xác định';
      if (!map.has(w)) {
        map.set(w, {
          ward: w,
          total: 0,
          inProgress: 0,
          completed: 0,
          overdue: 0,
          totalFee: 0
        });
      }

      const item = map.get(w)!;
      item.total++;
      const isDone = ['Đã giao 1 cửa', 'Đã trả kết quả', 'Hoàn thành'].includes(r.status);
      if (isDone) item.completed++;
      else {
        item.inProgress++;
        if (isDangKyStepOverdue(r)) item.overdue++;
      }

      const fee = Number(r.feeAmount || r.price || 0);
      if (fee > 0) item.totalFee += fee;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  // 6. OVERDUE RECORDS
  const overdueRecords = useMemo(() => {
    return filteredRecords.filter(r => isDangKyStepOverdue(r) || isDangKyStepApproaching(r));
  }, [filteredRecords]);

  // 7. PAGINATION FOR DETAILED RECORDS LIST
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  // Distinct list of procedure types for filter dropdown
  const procedureTypeList = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.recordType) set.add(r.recordType);
    });
    return Array.from(set).sort();
  }, [records]);

  // Handle Export Excel
  const handleExportExcel = () => {
    exportDangKyReportToExcel(
      filteredRecords,
      fromDate,
      toDate,
      selectedWard,
      employees,
      `BÁO CÁO THỐNG KÊ KẾT QUẢ ĐĂNG KÝ ĐẤT ĐAI & CẤP GCN`
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden text-slate-800">
      {/* TOP SUB-NAVIGATION TABS */}
      <div className="bg-white border-b border-slate-200 px-4 pt-2.5 pb-0 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSubTab('overview')}
            className={`px-3.5 py-2 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              subTab === 'overview'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp size={16} />
            <span>Tổng quan & Chỉ tiêu KPI</span>
          </button>

          <button
            onClick={() => setSubTab('procedures')}
            className={`px-3.5 py-2 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              subTab === 'procedures'
                ? 'border-blue-600 text-blue-600 bg-blue-50/60 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={16} />
            <span>Theo Loại thủ tục ({procedureStats.length})</span>
          </button>

          <button
            onClick={() => setSubTab('staff')}
            className={`px-3.5 py-2 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              subTab === 'staff'
                ? 'border-amber-600 text-amber-600 bg-amber-50/60 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck size={16} />
            <span>Cán bộ thụ lý ({staffStats.length})</span>
          </button>

          <button
            onClick={() => setSubTab('wards')}
            className={`px-3.5 py-2 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              subTab === 'wards'
                ? 'border-teal-600 text-teal-600 bg-teal-50/60 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 size={16} />
            <span>Địa bàn Xã/Phường ({wardStats.length})</span>
          </button>

          <button
            onClick={() => setSubTab('overdue')}
            className={`px-3.5 py-2 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              subTab === 'overdue'
                ? 'border-rose-600 text-rose-600 bg-rose-50/60 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle size={16} />
            <span>Hồ sơ trễ hạn & Cảnh báo ({overdueRecords.length})</span>
          </button>

          <button
            onClick={() => setSubTab('details')}
            className={`px-3.5 py-2 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
              subTab === 'details'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/60 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={16} />
            <span>Danh sách chi tiết ({filteredRecords.length})</span>
          </button>
        </div>

        {/* TOP ACTION: EXCEL EXPORT */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer mb-1.5 active:scale-95"
          title="Xuất Báo Cáo Đăng Ký Đất Đai Ra File Excel"
        >
          <FileSpreadsheet size={15} />
          <span>Xuất Báo Cáo Excel</span>
        </button>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="bg-slate-100/90 border-b border-slate-200 p-2.5 px-4 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* SEARCH BOX */}
          <div className="relative min-w-[200px] flex-1 max-w-[320px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm mã HS, tên chủ, thửa/tờ..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* PROCEDURE FILTER */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
            <Layers size={13} className="text-slate-500" />
            <select
              value={selectedProcedure}
              onChange={(e) => setSelectedProcedure(e.target.value)}
              className="text-xs bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer max-w-[160px]"
            >
              <option value="all">Tất cả thủ tục</option>
              {procedureTypeList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* WARD FILTER */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
            <MapPin size={13} className="text-slate-500" />
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="text-xs bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer max-w-[140px]"
            >
              <option value="all">Toàn bộ địa bàn</option>
              {wards.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* STAFF FILTER */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
            <UserCheck size={13} className="text-slate-500" />
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="text-xs bg-transparent border-none outline-none font-bold text-slate-700 cursor-pointer max-w-[140px]"
            >
              <option value="all">Tất cả cán bộ</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* QUICK RESET FILTER */}
        {(selectedProcedure !== 'all' || selectedWard !== 'all' || selectedStaff !== 'all' || selectedStatus !== 'all' || cardStatusFilter || searchTerm) && (
          <button
            onClick={() => {
              setSelectedProcedure('all');
              setSelectedWard('all');
              setSelectedStaff('all');
              setSelectedStatus('all');
              setCardStatusFilter(null);
              setSearchTerm('');
            }}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200 transition-colors"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TOP KPI METRIC CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* TOTAL RECEIVED */}
          <div
            onClick={() => setCardStatusFilter(cardStatusFilter === 'all' ? null : 'all')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs hover:shadow-md ${
              cardStatusFilter === 'all' ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Tổng tiếp nhận</span>
              <BookOpen size={16} className="text-indigo-600" />
            </div>
            <div className="text-xl md:text-2xl font-black text-slate-900">{stats.total}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Đăng ký ĐĐ</span>
              <span className="font-semibold text-indigo-600">100%</span>
            </div>
          </div>

          {/* COMPLETED */}
          <div
            onClick={() => setCardStatusFilter(cardStatusFilter === 'completed' ? null : 'completed')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs hover:shadow-md ${
              cardStatusFilter === 'completed' ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-tight">Đã giải quyết</span>
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <div className="text-xl md:text-2xl font-black text-emerald-700">{stats.totalCompleted}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Đúng hạn: <b>{stats.completedOnTime}</b></span>
              <span className="font-bold text-emerald-600">{stats.onTimeRate}%</span>
            </div>
          </div>

          {/* IN PROGRESS */}
          <div
            onClick={() => setCardStatusFilter(cardStatusFilter === 'in_progress' ? null : 'in_progress')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs hover:shadow-md ${
              cardStatusFilter === 'in_progress' ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-tight">Đang giải quyết</span>
              <Clock size={16} className="text-blue-600" />
            </div>
            <div className="text-xl md:text-2xl font-black text-blue-700">{stats.inProgress}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Trong quy trình</span>
              <span className="font-semibold text-blue-600">{stats.total > 0 ? ((stats.inProgress / stats.total) * 100).toFixed(0) : 0}%</span>
            </div>
          </div>

          {/* OVERDUE */}
          <div
            onClick={() => setCardStatusFilter(cardStatusFilter === 'overdue' ? null : 'overdue')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs hover:shadow-md ${
              cardStatusFilter === 'overdue' ? 'border-rose-600 ring-2 ring-rose-500/20' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-tight">Quá hạn khâu</span>
              <AlertTriangle size={16} className="text-rose-600" />
            </div>
            <div className="text-xl md:text-2xl font-black text-rose-700">{stats.overdueStep}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Cần xử lý gấp</span>
              {stats.overdueStep > 0 && <span className="font-bold text-rose-600 animate-pulse">Cảnh báo</span>}
            </div>
          </div>

          {/* WARNING */}
          <div
            onClick={() => setCardStatusFilter(cardStatusFilter === 'warning' ? null : 'warning')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer bg-white shadow-xs hover:shadow-md ${
              cardStatusFilter === 'warning' ? 'border-amber-600 ring-2 ring-amber-500/20' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-tight">Sắp đến hạn</span>
              <Clock size={16} className="text-amber-600" />
            </div>
            <div className="text-xl md:text-2xl font-black text-amber-700">{stats.warningStep}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>≤ 4 giờ làm việc</span>
              <span className="font-semibold text-amber-600">Theo dõi</span>
            </div>
          </div>

          {/* TOTAL REVENUE */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-tight">Lệ phí thu</span>
              <DollarSign size={16} className="text-purple-600" />
            </div>
            <div className="text-lg md:text-xl font-black text-purple-800 truncate" title={formatCurrency(stats.totalFee)}>
              {formatCurrency(stats.totalFee)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Theo biên lai/HĐ</span>
              <span className="font-bold text-purple-600">{filteredRecords.filter(r => (Number(r.feeAmount || r.price || 0) > 0)).length} HS</span>
            </div>
          </div>
        </div>

        {/* WORKFLOW PIPELINE PROGRESS METER */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Activity size={15} className="text-indigo-600" />
              Tiến độ giải quyết theo các khâu nghiệp vụ Đăng ký
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Đúng hạn toàn kỳ: <b className="text-emerald-700">{stats.onTimeRate}%</b>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* STAGE 1: THẨM ĐỊNH */}
            <div 
              onClick={() => setCardStatusFilter(cardStatusFilter === 'in_progress' ? null : 'in_progress')}
              className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/80 hover:bg-indigo-50/50 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-bold text-slate-600 uppercase">1. Thẩm định</div>
              <div className="text-lg font-extrabold text-indigo-700 mt-0.5">{stats.stageAppraisal}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tiếp nhận & Thẩm tra</div>
            </div>

            {/* STAGE 2: THUẾ */}
            <div 
              onClick={() => setCardStatusFilter(cardStatusFilter === 'tax' ? null : 'tax')}
              className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/80 hover:bg-blue-50/50 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-bold text-slate-600 uppercase">2. Cơ quan thuế</div>
              <div className="text-lg font-extrabold text-blue-700 mt-0.5">{stats.stageTax}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Phiếu chuyển & TBT</div>
            </div>

            {/* STAGE 3: IN GCN */}
            <div 
              onClick={() => setCardStatusFilter(cardStatusFilter === 'print' ? null : 'print')}
              className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/80 hover:bg-teal-50/50 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-bold text-slate-600 uppercase">3. In GCN</div>
              <div className="text-lg font-extrabold text-teal-700 mt-0.5">{stats.stagePrint}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">In phôi & Vào sổ</div>
            </div>

            {/* STAGE 4: TRÌNH KÝ */}
            <div 
              onClick={() => setCardStatusFilter(cardStatusFilter === 'sign' ? null : 'sign')}
              className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/80 hover:bg-purple-50/50 transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-bold text-slate-600 uppercase">4. Trình ký duyệt</div>
              <div className="text-lg font-extrabold text-purple-700 mt-0.5">{stats.stageCheckSign}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Kiểm tra & Lãnh đạo ký</div>
            </div>

            {/* STAGE 5: BÀN GIAO */}
            <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/80">
              <div className="text-[11px] font-bold text-slate-600 uppercase">5. Bàn giao 1 cửa</div>
              <div className="text-lg font-extrabold text-amber-700 mt-0.5">{stats.stageHandover}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Đã xuất trả 1 cửa</div>
            </div>

            {/* STAGE 6: ĐÃ TRẢ KẾT QUẢ */}
            <div className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/80">
              <div className="text-[11px] font-bold text-slate-600 uppercase">6. Trả người dân</div>
              <div className="text-lg font-extrabold text-emerald-700 mt-0.5">{stats.stageReturned}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Đã nhận kết quả GCN</div>
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW & PROCEDURE BREAKDOWN */}
        {(subTab === 'overview' || subTab === 'procedures') && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Bảng tổng hợp theo Loại thủ tục Đăng ký đất đai & Cấp GCN
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Tổng cộng: <b>{procedureStats.length}</b> loại thủ tục
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-tight">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Loại thủ tục</th>
                    <th className="py-2.5 px-3 text-center">Tiếp nhận</th>
                    <th className="py-2.5 px-3 text-center text-blue-700">Đang xử lý</th>
                    <th className="py-2.5 px-3 text-center text-emerald-700">Đúng hạn</th>
                    <th className="py-2.5 px-3 text-center text-amber-700">Trễ hạn</th>
                    <th className="py-2.5 px-3 text-center text-rose-700">Quá hạn</th>
                    <th className="py-2.5 px-3 text-right">Lệ phí thu (VNĐ)</th>
                    <th className="py-2.5 px-3 text-center">Tỷ lệ đúng hạn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {procedureStats.map((item, idx) => {
                    const doneTotal = item.completedOnTime + item.completedOverdue;
                    const onTimePct = doneTotal > 0 
                      ? ((item.completedOnTime / doneTotal) * 100).toFixed(1)
                      : (item.total > 0 ? (((item.total - item.overdueStep) / item.total) * 100).toFixed(1) : '100');

                    return (
                      <tr 
                        key={item.procedureName}
                        onClick={() => {
                          setSelectedProcedure(item.procedureName);
                          setSubTab('details');
                        }}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {item.procedureName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 bg-slate-50/50">
                          {item.total}
                        </td>
                        <td className="py-2.5 px-3 text-center text-blue-700 font-semibold">
                          {item.inProgress}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 font-semibold">
                          {item.completedOnTime}
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-700 font-semibold">
                          {item.completedOverdue}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {item.overdueStep > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              {item.overdueStep}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-purple-700 font-semibold">
                          {item.totalFee > 0 ? item.totalFee.toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            parseFloat(onTimePct) >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : parseFloat(onTimePct) >= 70
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {onTimePct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: STAFF PERFORMANCE */}
        {subTab === 'staff' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Thống kê khối lượng công việc & Hiệu suất Cán bộ thụ lý Đăng ký
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Tổng: <b>{staffStats.length}</b> cán bộ có hồ sơ thụ lý
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-tight">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Cán bộ thụ lý</th>
                    <th className="py-2.5 px-3">Chức vụ / Vị trí</th>
                    <th className="py-2.5 px-3 text-center">Tổng phụ trách</th>
                    <th className="py-2.5 px-3 text-center text-indigo-700">Thẩm định</th>
                    <th className="py-2.5 px-3 text-center text-blue-700">Thuế</th>
                    <th className="py-2.5 px-3 text-center text-teal-700">In GCN</th>
                    <th className="py-2.5 px-3 text-center text-emerald-700">Đã giải quyết</th>
                    <th className="py-2.5 px-3 text-center text-rose-700">Quá hạn</th>
                    <th className="py-2.5 px-3 text-center">Tỷ lệ đúng hạn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {staffStats.map((staff, idx) => {
                    const onTimePct = staff.totalAssigned > 0
                      ? (((staff.totalAssigned - staff.overdue) / staff.totalAssigned) * 100).toFixed(1)
                      : '100';

                    return (
                      <tr 
                        key={staff.staffId}
                        onClick={() => {
                          setSelectedStaff(staff.staffId);
                          setSubTab('details');
                        }}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center gap-1.5">
                          <UserCheck size={14} className="text-slate-400" />
                          <span>{staff.staffName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{staff.position}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 bg-slate-50/50">
                          {staff.totalAssigned}
                        </td>
                        <td className="py-2.5 px-3 text-center text-indigo-700 font-semibold">
                          {staff.appraisalCount > 0 ? staff.appraisalCount : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-blue-700 font-semibold">
                          {staff.taxCount > 0 ? staff.taxCount : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-teal-700 font-semibold">
                          {staff.printCount > 0 ? staff.printCount : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 font-semibold">
                          {staff.completed}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {staff.overdue > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              {staff.overdue}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            parseFloat(onTimePct) >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : parseFloat(onTimePct) >= 70
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {onTimePct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: WARD DISTRIBUTION */}
        {subTab === 'wards' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Thống kê Hồ sơ Đăng ký đất đai phân bổ theo Xã / Phường
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Tổng: <b>{wardStats.length}</b> đơn vị hành chính
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-tight">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Xã / Phường</th>
                    <th className="py-2.5 px-3 text-center">Tổng tiếp nhận</th>
                    <th className="py-2.5 px-3 text-center text-blue-700">Đang xử lý</th>
                    <th className="py-2.5 px-3 text-center text-emerald-700">Đã giải quyết</th>
                    <th className="py-2.5 px-3 text-center text-rose-700">Quá hạn</th>
                    <th className="py-2.5 px-3 text-right">Lệ phí thu (VNĐ)</th>
                    <th className="py-2.5 px-3 text-center">Tỷ lệ giải quyết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {wardStats.map((item, idx) => {
                    const donePct = item.total > 0 ? ((item.completed / item.total) * 100).toFixed(1) : '0';
                    return (
                      <tr 
                        key={item.ward}
                        onClick={() => {
                          setSelectedWard(item.ward);
                          setSubTab('details');
                        }}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center gap-1.5">
                          <MapPin size={14} className="text-teal-600" />
                          <span>{item.ward}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 bg-slate-50/50">
                          {item.total}
                        </td>
                        <td className="py-2.5 px-3 text-center text-blue-700 font-semibold">
                          {item.inProgress}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 font-semibold">
                          {item.completed}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {item.overdue > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              {item.overdue}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-purple-700 font-semibold">
                          {item.totalFee > 0 ? item.totalFee.toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[100px] mx-auto overflow-hidden">
                            <div 
                              className="bg-teal-600 h-2.5 rounded-full" 
                              style={{ width: `${Math.min(100, parseFloat(donePct))}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">{donePct}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: OVERDUE / WARNING RECORDS */}
        {subTab === 'overdue' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Danh sách Hồ sơ Đăng ký Quá hạn & Sắp đến hạn bước SLA
                </h3>
              </div>
              <span className="text-xs text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                {overdueRecords.length} hồ sơ cảnh báo
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-tight">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Mã hồ sơ</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Chủ sử dụng</th>
                    <th className="py-2.5 px-3">Xã/Phường</th>
                    <th className="py-2.5 px-3">Khâu hiện tại</th>
                    <th className="py-2.5 px-3 text-center">Ngày nhận</th>
                    <th className="py-2.5 px-3 text-center">Ngày hẹn</th>
                    <th className="py-2.5 px-3">Cán bộ phụ trách</th>
                    <th className="py-2.5 px-3 text-center">Cảnh báo SLA</th>
                    <th className="py-2.5 px-3 text-center w-16">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {overdueRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-slate-400">
                        Tuyệt vời! Không có hồ sơ Đăng ký nào bị trễ hạn hoặc cảnh báo SLA trong khoảng thời gian này.
                      </td>
                    </tr>
                  ) : (
                    overdueRecords.map((r, idx) => {
                      const isOverdue = isDangKyStepOverdue(r);
                      const isWarning = isDangKyStepApproaching(r);
                      const owners = (r.owners || []).map(o => o.name).filter(Boolean).join(', ');
                      const transferees = (r.transferees || []).map(t => t.name).filter(Boolean).join(', ');
                      const parties = transferees ? `${owners} -> ${transferees}` : owners;

                      return (
                        <tr 
                          key={r.id || r.code}
                          onClick={() => {
                            if (onViewRecord) onViewRecord(r);
                            else setActiveDetailRecord(r);
                          }}
                          className="hover:bg-rose-50/40 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{r.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{parties || r.authorizedPersonName || '---'}</td>
                          <td className="py-2.5 px-3 text-slate-600">{r.ward}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">{r.status}</td>
                          <td className="py-2.5 px-3 text-center text-slate-500">{formatDateVN(r.receivedDate)}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">{formatDateVN(r.deadline)}</td>
                          <td className="py-2.5 px-3 text-slate-700">{r.appraisalStaff || r.assignedTo || r.taxFormStaff || '---'}</td>
                          <td className="py-2.5 px-3 text-center">
                            {isOverdue ? (
                              <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[11px] border border-rose-300 animate-pulse">
                                Quá hạn khâu
                              </span>
                            ) : isWarning ? (
                              <span className="bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded text-[11px] border border-amber-300">
                                Sắp đến hạn
                              </span>
                            ) : (
                              <span className="text-slate-400">---</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onViewRecord) onViewRecord(r);
                                else setActiveDetailRecord(r);
                              }}
                              className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: DETAILED RECORDS TABLE */}
        {subTab === 'details' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Danh sách Chi tiết Hồ sơ Đăng ký Đất đai ({filteredRecords.length} hồ sơ)
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Hiển thị</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-slate-50 font-bold"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>dòng / trang</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-tight">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Mã hồ sơ</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Chủ sử dụng / Chuyển quyền</th>
                    <th className="py-2.5 px-3 text-center">Thửa / Tờ</th>
                    <th className="py-2.5 px-3">Xã / Phường</th>
                    <th className="py-2.5 px-3 min-w-[150px]">Loại thủ tục</th>
                    <th className="py-2.5 px-3 text-center">Ngày nhận</th>
                    <th className="py-2.5 px-3 text-center">Ngày hẹn</th>
                    <th className="py-2.5 px-3">Khâu hiện tại</th>
                    <th className="py-2.5 px-3">Cán bộ phụ trách</th>
                    <th className="py-2.5 px-3 text-right">Lệ phí (VNĐ)</th>
                    <th className="py-2.5 px-3 text-center w-14">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-8 text-slate-400">
                        Không tìm thấy hồ sơ Đăng ký nào phù hợp với điều kiện lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((r, idx) => {
                      const owners = (r.owners || []).map(o => o.name).filter(Boolean).join(', ');
                      const transferees = (r.transferees || []).map(t => t.name).filter(Boolean).join(', ');
                      const parties = transferees ? `${owners} -> ${transferees}` : owners;
                      const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                      const isOverdue = isDangKyStepOverdue(r);

                      return (
                        <tr 
                          key={r.id || r.code}
                          onClick={() => {
                            if (onViewRecord) onViewRecord(r);
                            else setActiveDetailRecord(r);
                          }}
                          className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                            isOverdue ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400">{globalIdx}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{r.code}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-[240px] truncate" title={parties}>
                            {parties || r.authorizedPersonName || '---'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {r.landPlot ? `${r.landPlot}/${r.mapSheet || '-'}` : '---'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{r.ward}</td>
                          <td className="py-2.5 px-3 text-slate-700">{r.recordType}</td>
                          <td className="py-2.5 px-3 text-center text-slate-500">{formatDateVN(r.receivedDate)}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">{formatDateVN(r.deadline)}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800">{r.status}</span>
                            {isOverdue && (
                              <span className="ml-1.5 inline-block text-[10px] text-rose-600 font-bold bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200">
                                Trễ hạn
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {r.appraisalStaff || r.assignedTo || r.taxFormStaff || '---'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-purple-700 font-semibold">
                            {Number(r.feeAmount || r.price || 0) > 0 ? Number(r.feeAmount || r.price || 0).toLocaleString('vi-VN') : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onViewRecord) onViewRecord(r);
                                else setActiveDetailRecord(r);
                              }}
                              className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                            >
                              <Eye size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50">
                <span>
                  Trang <b>{currentPage}</b> / <b>{totalPages}</b> (Tổng số <b>{filteredRecords.length}</b> hồ sơ)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 3 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL MODAL IF CLICKED ON RECORD */}
      {activeDetailRecord && (
        <DangKyDetailModal
          isOpen={!!activeDetailRecord}
          onClose={() => setActiveDetailRecord(null)}
          record={activeDetailRecord}
          employees={employees}
          currentUser={currentUser || null}
          onEdit={() => {}}
          onDelete={() => {}}
          onStatusAdvance={() => {}}
          onRefreshData={() => {}}
        />
      )}
    </div>
  );
};

export default DangKyStatsView;
