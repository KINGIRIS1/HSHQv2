import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, Contract } from '../../types';
import { getNormalizedWard, getShortRecordType, RECORD_TYPES } from '../../constants';
import { 
    Search, Eye, FileSpreadsheet, Pencil, Printer, Trash2, 
    FileSignature, FileEdit, RefreshCw, Filter, ChevronDown, ChevronUp, 
    X, RotateCcw, Calendar, UserCheck, Layers, Building2
} from 'lucide-react';
import { fetchContracts } from '../../services/api';

interface DailyListProps {
  records: RecordFile[];
  wards: string[];
  currentUser: any;
  employees?: any[];
  users?: any[];
  rolePermissions?: any;
  departmentPermissions?: any;
  onPreviewExcel: (wb: XLSX.WorkBook, name: string) => void;
  onEdit: (record: RecordFile) => void;
  onDelete: (record: RecordFile) => void;
  onPrint: (record: RecordFile) => void;
  onCreateContract?: (record: RecordFile) => void;
  onHandOverRecords?: (recordIds: string[]) => Promise<void>;
  onSyncPending?: () => Promise<any>;
}

const DailyList: React.FC<DailyListProps> = ({ 
  records, 
  wards, 
  currentUser, 
  employees, 
  users,
  rolePermissions,
  departmentPermissions,
  onPreviewExcel, 
  onEdit, 
  onDelete, 
  onPrint, 
  onCreateContract, 
  onHandOverRecords, 
  onSyncPending 
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // 1. Filter States with default values
  const [filterFromDate, setFilterFromDate] = useState<string>(todayStr);
  const [filterToDate, setFilterToDate] = useState<string>(todayStr);
  const [selectedReceiver, setSelectedReceiver] = useState<string>(currentUser?.employeeId || currentUser?.id || currentUser?.username || 'ME');
  const [selectedRecordType, setSelectedRecordType] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Sync currentUser to selectedReceiver if currentUser loads later
  useEffect(() => {
      if (currentUser && selectedReceiver === 'ME') {
          const myKey = currentUser.employeeId || currentUser.id || currentUser.username;
          if (myKey) {
              setSelectedReceiver(myKey);
          }
      }
  }, [currentUser]);

  // Load contracts for checking already contracted records
  const loadContractsData = async () => {
      try {
          const data = await fetchContracts();
          setContracts(data || []);
      } catch (err) {
          console.error("Lỗi khi tải danh sách hợp đồng:", err);
      }
  };

  useEffect(() => {
      loadContractsData();
  }, []);

  // Handle click outside to close popover
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
              setIsFilterPopoverOpen(false);
          }
      };
      if (isFilterPopoverOpen) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [isFilterPopoverOpen]);

  // Filter list of OneDoor employees
  const oneDoorEmployees = useMemo(() => {
      if (!employees || employees.length === 0) return [];
      return employees.filter(emp => {
          const dept = (emp.department || '').toLowerCase();
          const pos = (emp.position || '').toLowerCase();
          const isDeptOneDoor = dept.includes('hành chính') || dept.includes('một cửa') || dept.includes('tiếp nhận');
          const isPosOneDoor = pos.includes('tiếp nhận') || pos.includes('một cửa') || pos.includes('văn thư');
          
          const linkedUser = (users || []).find(u => u.employeeId === emp.id || u.username === emp.id || u.name === emp.name);
          const isUserOneDoor = linkedUser?.role === 'ONEDOOR';
          
          return isDeptOneDoor || isPosOneDoor || isUserOneDoor;
      });
  }, [employees, users]);

  // Quick Date Select
  const handleQuickDate = (mode: 'today' | 'week' | 'month') => {
      const today = new Date().toISOString().split('T')[0];
      if (mode === 'today') {
          setFilterFromDate(today);
          setFilterToDate(today);
      } else if (mode === 'week') {
          const now = new Date();
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(now.setDate(diff)).toISOString().split('T')[0];
          setFilterFromDate(monday);
          setFilterToDate(today);
      } else if (mode === 'month') {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          setFilterFromDate(firstDay);
          setFilterToDate(today);
      }
  };

  // Reset to default
  const handleResetFilter = () => {
      setFilterFromDate(todayStr);
      setFilterToDate(todayStr);
      setSelectedReceiver(currentUser?.employeeId || currentUser?.id || currentUser?.username || 'ME');
      setSelectedRecordType('ALL');
      setSelectedDept('ALL');
  };

  // Active filter count calculation
  const activeFilterCount = useMemo(() => {
      let count = 0;
      if (filterFromDate !== todayStr || filterToDate !== todayStr) count++;
      const myKey = currentUser?.employeeId || currentUser?.id || currentUser?.username || 'ME';
      if (selectedReceiver !== myKey && selectedReceiver !== 'ME') count++;
      if (selectedRecordType !== 'ALL') count++;
      if (selectedDept !== 'ALL') count++;
      return count;
  }, [filterFromDate, filterToDate, selectedReceiver, selectedRecordType, selectedDept, todayStr, currentUser]);

  // Main Filtered Records
  const filteredDailyRecords = useMemo(() => {
      if (!records) return [];
      const searchLower = searchTerm.toLowerCase();
      
      const list = records.filter(r => {
          // Bỏ qua hồ sơ đã bàn giao
          if (r.isHandedOver) {
              return false;
          }

          // 1. Lọc theo khoảng thời gian tiếp nhận
          const recordDate = r.receivedDate ? r.receivedDate.split('T')[0] : '';
          if (filterFromDate && recordDate < filterFromDate) return false;
          if (filterToDate && recordDate > filterToDate) return false;

          // 2. Lọc theo nhân viên tiếp nhận
          if (selectedReceiver !== 'ALL') {
              const recUser = (r.receivedBy || '').toLowerCase();
              const myEmpId = (currentUser?.employeeId || '').toLowerCase();
              const myId = (currentUser?.id || '').toLowerCase();
              const myUser = (currentUser?.username || '').toLowerCase();
              const myName = (currentUser?.name || '').toLowerCase();

              if (selectedReceiver === 'ME' || (myEmpId && selectedReceiver.toLowerCase() === myEmpId) || (myId && selectedReceiver.toLowerCase() === myId) || (myUser && selectedReceiver.toLowerCase() === myUser)) {
                  const matchesMe = (myEmpId && recUser === myEmpId) || 
                                    (myId && recUser === myId) || 
                                    (myUser && recUser === myUser) ||
                                    (myName && recUser === myName);
                  if (!matchesMe) return false;
              } else {
                  const selEmp = (employees || []).find(e => e.id === selectedReceiver || e.name === selectedReceiver);
                  const targetId = (selectedReceiver || '').toLowerCase();
                  const targetName = (selEmp?.name || '').toLowerCase();
                  const matchesEmp = (targetId && recUser === targetId) || (targetName && recUser === targetName);
                  if (!matchesEmp) return false;
              }
          }

          // 3. Lọc theo loại hồ sơ
          if (selectedRecordType !== 'ALL') {
              const rType = (r.recordType || '').toLowerCase();
              const targetType = selectedRecordType.toLowerCase();
              const shortR = getShortRecordType(r.recordType).toLowerCase();
              const shortTarget = getShortRecordType(selectedRecordType).toLowerCase();
              if (!rType.includes(targetType) && shortR !== shortTarget) {
                  return false;
              }
          }

          // 4. Lọc theo tổ chuyên môn
          if (selectedDept !== 'ALL' && selectedDept !== 'Tất cả') {
              const codeClean = (r.code || '').trim().toLowerCase();
              const typeLower = (r.recordType || '').toLowerCase();
              const deptLower = ((r as any).department || r.returnHandoverDept || '').toLowerCase();

              const is2x = codeClean.startsWith('2.') || /^2[.\d]/.test(codeClean) || typeLower.startsWith('2.') || typeLower.includes('2.');
              const is1x = codeClean.startsWith('1.') || /^1[.\d]/.test(codeClean) || typeLower.startsWith('1.') || typeLower.includes('1.') || typeLower.includes('sao lục');

              if (selectedDept === 'Tổ Đo đạc') {
                  const isDoDac = is2x || 
                                  deptLower.includes('đo đạc') || 
                                  deptLower.includes('đo dạc') || 
                                  typeLower.includes('trích đo') || 
                                  typeLower.includes('trích lục') || 
                                  typeLower.includes('đo đạc') || 
                                  typeLower.includes('cắm mốc') || 
                                  typeLower.includes('tách') || 
                                  typeLower.includes('hợp') || 
                                  typeLower.includes('số thửa') || 
                                  typeLower.includes('cập nhật') || 
                                  typeLower.includes('cập nhập');
                  if (!isDoDac) return false;
              } else if (selectedDept === 'Tổ Lưu trữ' || selectedDept === 'Tổ Thông tin lưu trữ') {
                  const isLuuTru = is1x || 
                                   deptLower.includes('lưu trữ') || 
                                   typeLower.includes('cung cấp') || 
                                   typeLower.includes('lưu trữ') ||
                                   typeLower.includes('sao lục');
                  if (!isLuuTru) return false;
              }
          }

          // 5. Tìm kiếm từ khóa
          if (searchTerm) {
              const nameMatch = r.customerName?.toLowerCase().includes(searchLower);
              const codeMatch = r.code?.toLowerCase().includes(searchLower);
              const wardMatch = r.ward?.toLowerCase().includes(searchLower);
              const plotMatch = r.landPlot?.toString().toLowerCase().includes(searchLower);
              if (!nameMatch && !codeMatch && !wardMatch && !plotMatch) return false;
          }

          return true;
      });

      // Sắp xếp: Tăng dần theo số thứ tự mã
      return list.sort((a, b) => {
          const codeA = (a.code || '').toUpperCase();
          const codeB = (b.code || '').toUpperCase();
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [records, filterFromDate, filterToDate, selectedReceiver, selectedRecordType, selectedDept, searchTerm, currentUser, employees]);

  // Check contract existence for a given record
  const getContractForRecord = (record: RecordFile) => {
      if (!contracts || contracts.length === 0 || !record) return undefined;
      const rCode = (record.code || '').trim().toLowerCase();
      const rName = (record.customerName || '').trim().toLowerCase();
      const rPlot = (record.landPlot || '').trim().toLowerCase();
      const rMap = (record.mapSheet || '').trim().toLowerCase();
      const clean = (str: string) => str.replace(/[^a-z0-9]/gi, '').toLowerCase();

      return contracts.find(c => {
          if (!c) return false;
          const cAddr = (c.customerAddress || '').trim().toLowerCase();
          const cCode = (c.code || '').trim().toLowerCase();
          const cName = (c.customerName || '').trim().toLowerCase();
          const cPlot = (c.landPlot || '').trim().toLowerCase();
          const cMap = (c.mapSheet || '').trim().toLowerCase();

          if (rCode && (cAddr === rCode || cCode === rCode)) return true;
          if (rCode && cCode && clean(rCode).length >= 3 && clean(rCode) === clean(cCode)) return true;
          if (rCode && cAddr && clean(rCode).length >= 3 && clean(rCode) === clean(cAddr)) return true;
          if (rName && cName && rName === cName) {
              if (rPlot && cPlot && rPlot === cPlot) return true;
              if (rMap && cMap && rMap === cMap) return true;
          }
          return false;
      });
  };

  const pendingCount = useMemo(() => {
      return (records || []).filter(r => r._isOfflineSaved).length;
  }, [records]);

  const handleManualSync = async () => {
      if (!onSyncPending || isSyncing) return;
      setIsSyncing(true);
      try {
          await onSyncPending();
          await loadContractsData();
      } finally {
          setIsSyncing(false);
      }
  };

  const createDailyListWorkbook = () => {
      if (filteredDailyRecords.length === 0) return null;
      
      let mainTitle = "DANH SÁCH TIẾP NHẬN HỒ SƠ";
      let wardTitle = "DANH SÁCH TỔNG HỢP";
      if (selectedDept === 'Tổ Đo đạc') {
          mainTitle = "DANH SÁCH BÀN GIAO HỒ SƠ";
          wardTitle = "TỔ ĐO ĐẠC BẢN ĐỒ";
      } else if (selectedDept === 'Tổ Lưu trữ' || selectedDept === 'Tổ Thông tin lưu trữ') {
          mainTitle = "DANH SÁCH BÀN GIAO HỒ SƠ";
          wardTitle = "TỔ LƯU TRỮ";
      }
      
      const dateStr = filterFromDate === filterToDate 
          ? `NGÀY ${filterFromDate.split('-')[2]} THÁNG ${filterFromDate.split('-')[1]} NĂM ${filterFromDate.split('-')[0]}`
          : `TỪ NGÀY ${filterFromDate} ĐẾN NGÀY ${filterToDate}`;
      
      const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Xã / Phường", "Tờ", "Thửa", "Loại Hồ Sơ", "Ngày Nhận", "Hẹn Trả", "Ghi Chú"];
      
      const formatDateStr = (d: any) => d ? new Date(d).toLocaleDateString('vi-VN') : '';

      const dataRows = filteredDailyRecords.map((r, i) => [
          i + 1, 
          r.code, 
          r.customerName, 
          getNormalizedWard(r.ward), 
          r.mapSheet || '', 
          r.landPlot || '', 
          getShortRecordType(r.recordType), 
          formatDateStr(r.receivedDate),
          formatDateStr(r.deadline),
          r.content || ''
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Styles
      const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      const center = { alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const headerStyle = { font: { name: "Times New Roman", sz: 11, bold: true }, border, fill: { fgColor: { rgb: "E0E0E0" } }, ...center };
      const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { vertical: "center", wrapText: true } };
      const centerCellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { horizontal: "center", vertical: "center", wrapText: true } };

      // Header content
      XLSX.utils.sheet_add_aoa(ws, [
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], ["Độc lập - Tự do - Hạnh phúc"], [""],
          [mainTitle], [wardTitle], [dateStr], tableHeader
      ], { origin: "A1" });
      
      // Data content
      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

      // Footer
      const lastDataRowIndex = 7 + dataRows.length;
      const footerRowIndex = lastDataRowIndex + 2;

      XLSX.utils.sheet_add_aoa(ws, [
          ["BÊN GIAO HỒ SƠ", "", "", "", "", "", "BÊN NHẬN HỒ SƠ", "", "", ""],
          ["(Ký và ghi rõ họ tên)", "", "", "", "", "", "(Ký và ghi rõ họ tên)", "", "", ""]
      ], { origin: { r: footerRowIndex, c: 0 } });

      // Merges
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push(
          { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, 
          { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, 
          { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } }, 
          { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } }, 
          { s: { r: 5, c: 0 }, e: { r: 5, c: 9 } },
          { s: { r: footerRowIndex, c: 0 }, e: { r: footerRowIndex, c: 3 } },
          { s: { r: footerRowIndex + 1, c: 0 }, e: { r: footerRowIndex + 1, c: 3 } },
          { s: { r: footerRowIndex, c: 6 }, e: { r: footerRowIndex, c: 9 } },
          { s: { r: footerRowIndex + 1, c: 6 }, e: { r: footerRowIndex + 1, c: 9 } }
      );

      // Column Widths
      ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 16 }, { wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 13 }, { wch: 13 }, { wch: 24 }];

      // Styles Loop
      for(let c=0; c<=9; c++) { 
          const ref = XLSX.utils.encode_cell({r: 6, c: c}); 
          if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
          ws[ref].s = headerStyle; 
      }
      for(let r=7; r < lastDataRowIndex; r++) { 
          for(let c=0; c<=9; c++) { 
              const ref = XLSX.utils.encode_cell({r: r, c: c}); 
              if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
              if (c === 0 || c === 4 || c === 5 || c === 7 || c === 8) ws[ref].s = centerCellStyle;
              else ws[ref].s = cellStyle;
          } 
      }

      // Footer Styles
      const sigTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
      const sigNoteStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } };

      const leftTitle = XLSX.utils.encode_cell({r: footerRowIndex, c: 0});
      const leftNote = XLSX.utils.encode_cell({r: footerRowIndex + 1, c: 0});
      const rightTitle = XLSX.utils.encode_cell({r: footerRowIndex, c: 6});
      const rightNote = XLSX.utils.encode_cell({r: footerRowIndex + 1, c: 6});

      if(!ws[leftTitle]) ws[leftTitle] = {v: "BÊN GIAO HỒ SƠ", t:'s'}; ws[leftTitle].s = sigTitleStyle;
      if(!ws[leftNote]) ws[leftNote] = {v: "(Ký và ghi rõ họ tên)", t:'s'}; ws[leftNote].s = sigNoteStyle;
      if(!ws[rightTitle]) ws[rightTitle] = {v: "BÊN NHẬN HỒ SƠ", t:'s'}; ws[rightTitle].s = sigTitleStyle;
      if(!ws[rightNote]) ws[rightNote] = {v: "(Ký và ghi rõ họ tên)", t:'s'}; ws[rightNote].s = sigNoteStyle;

      XLSX.utils.book_append_sheet(wb, ws, "Danh Sach");
      return wb;
  };

  const handleExport = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ."); return; }
      const suffix = selectedDept === 'ALL' || selectedDept === 'Tất cả' ? 'Tiep_Nhan' : selectedDept === 'Tổ Đo đạc' ? 'Ban_Giao_Do_Dac' : 'Ban_Giao_Luu_Tru';
      const dateFileSuffix = filterFromDate === filterToDate ? filterFromDate.replace(/-/g, '') : `${filterFromDate.replace(/-/g, '')}_${filterToDate.replace(/-/g, '')}`;
      XLSX.writeFile(wb, `DS_${suffix}_${dateFileSuffix}.xlsx`);
      
      if (onHandOverRecords) {
          const ids = filteredDailyRecords.map(r => r.id);
          setTimeout(() => {
              onHandOverRecords(ids);
          }, 1000);
      }
  };

  const handlePreview = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ."); return; }
      const suffix = selectedDept === 'ALL' || selectedDept === 'Tất cả' ? 'Tiep_Nhan' : selectedDept === 'Tổ Đo đạc' ? 'Ban_Giao_Do_Dac' : 'Ban_Giao_Luu_Tru';
      const dateFileSuffix = filterFromDate === filterToDate ? filterFromDate.replace(/-/g, '') : `${filterFromDate.replace(/-/g, '')}_${filterToDate.replace(/-/g, '')}`;
      onPreviewExcel(wb, `DS_${suffix}_${dateFileSuffix}`);
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
        {/* Toolbar Header */}
        <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            {/* Left side: Tab Title / Summary */}
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm md:text-base font-bold text-gray-800">Danh sách tiếp nhận</span>
                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                    {filteredDailyRecords.length} hồ sơ
                </span>
            </div>

            {/* Right side: Search + Filter + Offline Sync + Excel Actions */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-1 max-w-xl">
                {/* Search Box */}
                <div className="relative flex-1 sm:w-64"> 
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /> 
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    /> 
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Popup Filter Button (Only Filter Icon + Active Badge) */}
                    <div className="relative inline-block text-left shrink-0" ref={filterPopoverRef}>
                        <button
                            type="button"
                            onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
                            className={`relative p-2 rounded-lg text-sm transition-all shadow-xs border cursor-pointer flex items-center justify-center ${
                                activeFilterCount > 0
                                    ? "border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100"
                                    : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                            }`}
                            title="Bộ lọc danh sách tiếp nhận"
                        >
                            <Filter size={16} className={activeFilterCount > 0 ? "text-blue-600" : "text-gray-600"} />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full font-bold flex items-center justify-center shadow-xs">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Filter Popover Dropdown Panel */}
                        {isFilterPopoverOpen && (
                            <div className="absolute right-0 mt-2 w-[340px] sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-fade-in text-gray-800">
                                {/* Popover Header */}
                                <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
                                    <div className="flex items-center gap-2 font-bold text-blue-700 text-sm md:text-base">
                                        <Filter size={18} />
                                        <span>Bộ lọc danh sách tiếp nhận</span>
                                    </div>
                                    <button
                                        onClick={() => setIsFilterPopoverOpen(false)}
                                        className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                                    {/* 1. Date Range Filter */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                                                <Calendar size={14} className="text-blue-600" />
                                                <span>Thời gian tiếp nhận:</span>
                                            </label>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickDate('today')}
                                                    className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded text-gray-600 transition-colors cursor-pointer"
                                                >
                                                    Hôm nay
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickDate('week')}
                                                    className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded text-gray-600 transition-colors cursor-pointer"
                                                >
                                                    Tuần này
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleQuickDate('month')}
                                                    className="px-2 py-0.5 text-[11px] font-medium bg-gray-100 hover:bg-blue-50 hover:text-blue-600 rounded text-gray-600 transition-colors cursor-pointer"
                                                >
                                                    Tháng này
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Từ ngày</span>
                                                <input
                                                    type="date"
                                                    value={filterFromDate}
                                                    onChange={(e) => setFilterFromDate(e.target.value)}
                                                    className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <span className="text-[11px] text-gray-500 font-medium block mb-0.5">Đến ngày</span>
                                                <input
                                                    type="date"
                                                    value={filterToDate}
                                                    onChange={(e) => setFilterToDate(e.target.value)}
                                                    className="w-full text-xs border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. OneDoor Receiver Filter */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1.5">
                                            <UserCheck size={14} className="text-blue-600" />
                                            <span>Nhân viên tiếp nhận (Một cửa):</span>
                                        </label>
                                        <select
                                            value={selectedReceiver}
                                            onChange={(e) => setSelectedReceiver(e.target.value)}
                                            className="w-full text-xs md:text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                        >
                                            {currentUser && (
                                                <option value={currentUser.employeeId || currentUser.id || currentUser.username || 'ME'}>
                                                    Chỉ mình tôi ({currentUser.name || currentUser.username})
                                                </option>
                                            )}
                                            <option value="ALL">Tất cả nhân viên Một cửa</option>
                                            {oneDoorEmployees.map(emp => (
                                                <option key={emp.id} value={emp.id}>
                                                    {emp.name} ({emp.position || 'Nhân viên'} - {emp.department || 'Một cửa'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 3. Record Type (Procedure) Filter */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1.5">
                                            <Layers size={14} className="text-blue-600" />
                                            <span>Loại hồ sơ (Thủ tục):</span>
                                        </label>
                                        <select
                                            value={selectedRecordType}
                                            onChange={(e) => setSelectedRecordType(e.target.value)}
                                            className="w-full text-xs md:text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                        >
                                            <option value="ALL">Tất cả loại hồ sơ</option>
                                            {RECORD_TYPES.map((type, idx) => (
                                                <option key={idx} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* 4. Professional Department Filter */}
                                    <div>
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-1.5">
                                            <Building2 size={14} className="text-blue-600" />
                                            <span>Tổ chuyên môn xử lý:</span>
                                        </label>
                                        <select
                                            value={selectedDept}
                                            onChange={(e) => setSelectedDept(e.target.value)}
                                            className="w-full text-xs md:text-sm border border-gray-200 rounded-lg p-2 font-medium bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                        >
                                            <option value="ALL">Tất cả tổ chuyên môn</option>
                                            <option value="Tổ Đo đạc">Tổ Đo đạc</option>
                                            <option value="Tổ Lưu trữ">Tổ Lưu trữ</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Popover Footer Actions */}
                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={handleResetFilter}
                                        className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors p-1.5 rounded hover:bg-gray-100 cursor-pointer"
                                    >
                                        <RotateCcw size={13} />
                                        <span>Đặt lại mặc định</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsFilterPopoverOpen(false)}
                                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                                    >
                                        Áp dụng ({filteredDailyRecords.length} hồ sơ)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Offline Sync Button if any */}
                    {pendingCount > 0 && onSyncPending && (
                        <button
                            type="button"
                            onClick={handleManualSync}
                            disabled={isSyncing}
                            className="flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Có hồ sơ đã lưu an toàn trên máy nhưng chưa đẩy lên Cloud"
                        >
                            <RefreshCw size={14} className={isSyncing ? "animate-spin text-amber-600" : "text-amber-600"} />
                            <span className="hidden sm:inline">{isSyncing ? "Đang đẩy Cloud..." : `Đồng bộ Cloud (${pendingCount})`}</span>
                        </button>
                    )}

                    {/* Excel Actions */}
                    <button 
                        onClick={handlePreview} 
                        className="p-2 bg-white text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Xem trước bảng Excel"
                    > 
                        <Eye size={16} className="text-blue-600" />
                    </button>
                    <button 
                        onClick={handleExport} 
                        className="p-2 bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
                        title="Xuất file Excel và Bàn giao"
                    > 
                        <FileSpreadsheet size={16} className="text-emerald-600" />
                    </button>
                </div>
            </div>
        </div>

        {/* Records Table */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1200px]">
                    <thead className="bg-gray-50 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm z-10">
                        <tr> 
                            <th className="p-3 w-10 text-center">STT</th> 
                            <th className="p-3 w-[140px]">Mã Hồ Sơ</th> 
                            <th className="p-3 w-[200px]">Chủ Sử Dụng</th> 
                            <th className="p-3 w-[150px]">Xã / Phường (Đất)</th> 
                            <th className="p-3 w-[65px] text-center">Tờ</th>
                            <th className="p-3 w-[65px] text-center">Thửa</th>
                            <th className="p-3 w-[140px]">Loại Hồ Sơ</th> 
                            <th className="p-3 text-center w-[110px]">Ngày Nhận</th>
                            <th className="p-3 text-center w-[110px]">Hẹn Trả</th> 
                            <th className="p-3 w-[180px]">Ghi Chú</th>
                            <th className="p-3 w-[130px] text-center bg-gray-100/50 sticky right-0 shadow-l">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                        {filteredDailyRecords.length > 0 ? (
                            filteredDailyRecords.map((r, index) => {
                                const existingContract = getContractForRecord(r);
                                const is2xRecord = r.recordType && (getShortRecordType(r.recordType).startsWith('2.2') || getShortRecordType(r.recordType).startsWith('2.4') || (r.code || '').startsWith('2.'));

                                return (
                                    <tr key={r.id} className="hover:bg-blue-50/50 group">
                                        <td className="p-3 text-center text-gray-400 align-middle">{index + 1}</td> 
                                        <td className="p-3 font-mono font-bold text-blue-600 truncate align-middle" title={r.code}>
                                            <div className="flex items-center gap-1.5">
                                                <span>{r.code}</span>
                                                {r._isOfflineSaved && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0" title="Đã lưu an toàn trên máy, chờ đồng bộ Cloud">
                                                        Máy
                                                    </span>
                                                )}
                                            </div>
                                        </td> 
                                        <td className="p-3 font-medium text-gray-800 truncate align-middle" title={r.customerName}>{r.customerName}</td> 
                                        <td className="p-3 text-gray-700 truncate align-middle font-medium" title={getNormalizedWard(r.ward)}>
                                            {getNormalizedWard(r.ward)}
                                        </td>
                                        <td className="p-3 text-center font-mono align-middle">{r.mapSheet || '-'}</td>
                                        <td className="p-3 text-center font-mono align-middle">{r.landPlot || '-'}</td>
                                        <td className="p-3 text-gray-600 truncate align-middle" title={r.recordType || ''}>{getShortRecordType(r.recordType)}</td> 
                                        <td className="p-3 text-center text-gray-700 font-mono align-middle">{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '-'}</td>
                                        <td className="p-3 text-center text-blue-700 font-mono font-bold align-middle">{r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '-'}</td> 
                                        <td className="p-3 text-gray-500 italic truncate align-middle" title={r.content || ''}>{r.content}</td>
                                        <td className="p-2 align-middle text-center sticky right-0 bg-white group-hover:bg-blue-50/50 shadow-l">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => onEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors cursor-pointer" title="Sửa hồ sơ">
                                                    <Pencil size={15} />
                                                </button>
                                                
                                                {/* If contract already exists: show Edit Contract button, else show Create Contract button */}
                                                {is2xRecord && onCreateContract && (
                                                    existingContract ? (
                                                        <button 
                                                            onClick={() => onCreateContract(r)} 
                                                            className="p-1.5 text-teal-600 hover:bg-teal-100 rounded transition-colors cursor-pointer" 
                                                            title={`Sửa hợp đồng đã lập (Số: ${existingContract.code || 'Đã tạo'})`}
                                                        >
                                                            <FileEdit size={15} />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => onCreateContract(r)} 
                                                            className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-colors cursor-pointer" 
                                                            title="Lập hợp đồng"
                                                        >
                                                            <FileSignature size={15} />
                                                        </button>
                                                    )
                                                )}

                                                <button onClick={() => onPrint(r)} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition-colors cursor-pointer" title="In biên nhận">
                                                    <Printer size={15} />
                                                </button>
                                                <button onClick={() => onDelete(r)} className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors cursor-pointer" title="Xóa hồ sơ">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : ( 
                            <tr>
                                <td colSpan={11} className="p-12 text-center text-gray-400 italic">
                                    Không có hồ sơ tiếp nhận nào phù hợp với bộ lọc đang chọn.
                                </td>
                            </tr> 
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default DailyList;
