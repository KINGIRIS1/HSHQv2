import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, User, RecordStatus } from '../types';
import { X, AlertTriangle, CheckCircle, FileSpreadsheet, RefreshCw, Wrench, ChevronDown, ChevronUp, Search, Info, Check, Filter, Edit3, Save } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

export interface RecordError {
  code: string;
  category: 'info' | 'date' | 'check' | 'assign' | 'map';
  categoryLabel: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  canAutoFix: boolean;
  autoFixKey?: 'checkedBy' | 'checkDate' | 'completedWorkDate' | 'deadline';
}

export interface DiagnosticItem {
  record: RecordFile;
  errors: RecordError[];
}

interface BatchErrorDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  employees: Employee[];
  users: User[];
  currentUser: User | null;
  onBatchUpdateRecords: (updates: Partial<RecordFile>[]) => Promise<void>;
  onRefreshData?: () => void;
}

export const BatchErrorDiagnosticModal: React.FC<BatchErrorDiagnosticModalProps> = ({
  isOpen,
  onClose,
  records,
  employees,
  users,
  currentUser,
  onBatchUpdateRecords,
  onRefreshData,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<RecordFile>>({});
  const [isFixing, setIsFixing] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedRecordIds, setExpandedRecordIds] = useState<Set<string>>(new Set());

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Function to run diagnostic on records
  const diagnosticResults = useMemo<DiagnosticItem[]>(() => {
    const results: DiagnosticItem[] = [];

    records.forEach((r) => {
      const errors: RecordError[] = [];

      // MẢNG 1: Thông tin cơ bản & Mã hồ sơ
      if (!r.code || !r.code.trim() || r.code === 'N/A') {
        errors.push({
          code: 'ERR_NO_CODE',
          category: 'info',
          categoryLabel: 'Mã & Thông tin',
          severity: 'high',
          message: 'Thiếu mã hồ sơ hoặc mã không hợp lệ.',
          suggestion: 'Cập nhật lại mã hồ sơ chuẩn theo định dạng hệ thống.',
          canAutoFix: false,
        });
      }

      if (!r.customerName || !r.customerName.trim()) {
        errors.push({
          code: 'ERR_NO_CUSTOMER',
          category: 'info',
          categoryLabel: 'Mã & Thông tin',
          severity: 'high',
          message: 'Thiếu tên chủ sử dụng / người đăng ký.',
          suggestion: 'Bổ sung tên chủ sử dụng đất / khách hàng.',
          canAutoFix: false,
        });
      }

      if (!r.ward || !r.ward.trim()) {
        errors.push({
          code: 'ERR_NO_WARD',
          category: 'info',
          categoryLabel: 'Mã & Thông tin',
          severity: 'medium',
          message: 'Thiếu thông tin Phường/Xã.',
          suggestion: 'Chọn đúng địa bàn Phường/Xã từ danh mục.',
          canAutoFix: false,
        });
      }

      // MẢNG 2: Ngày tháng & Tiến độ
      if (!r.receivedDate) {
        errors.push({
          code: 'ERR_NO_RECEIVED_DATE',
          category: 'date',
          categoryLabel: 'Ngày tháng & Tiến độ',
          severity: 'high',
          message: 'Thiếu ngày tiếp nhận hồ sơ.',
          suggestion: 'Bổ sung ngày tiếp nhận ban đầu.',
          canAutoFix: false,
        });
      }

      if (r.receivedDate && r.deadline) {
        const rTime = new Date(r.receivedDate).getTime();
        const dTime = new Date(r.deadline).getTime();
        if (dTime < rTime) {
          errors.push({
            code: 'ERR_INVALID_DEADLINE',
            category: 'date',
            categoryLabel: 'Ngày tháng & Tiến độ',
            severity: 'high',
            message: 'Ngày hẹn trả kết quả sớm hơn Ngày tiếp nhận.',
            suggestion: 'Tự động tính lại ngày hẹn trả (+5 ngày làm việc sau ngày nhận).',
            canAutoFix: true,
            autoFixKey: 'deadline',
          });
        }
      }

      // MẢNG 3: Kiểm tra & Trình ký
      if (
        (r.status === RecordStatus.CHECKED ||
          r.status === RecordStatus.PENDING_SIGN ||
          r.status === RecordStatus.SIGNED) &&
        (!r.checkedBy || !r.checkedBy.trim())
      ) {
        errors.push({
          code: 'ERR_MISSING_CHECKER',
          category: 'check',
          categoryLabel: 'Kiểm tra & Trình ký',
          severity: 'high',
          message: 'Đã kiểm tra/trình ký nhưng thiếu Tên người kiểm tra.',
          suggestion: 'Tự động gán Tên cán bộ kiểm tra hiện tại vào hồ sơ.',
          canAutoFix: true,
          autoFixKey: 'checkedBy',
        });
      }

      if (
        (r.status === RecordStatus.CHECKED ||
          r.status === RecordStatus.PENDING_SIGN) &&
        !r.pendingCheckDate &&
        !r.checkedDate
      ) {
        errors.push({
          code: 'ERR_MISSING_CHECK_DATE',
          category: 'check',
          categoryLabel: 'Kiểm tra & Trình ký',
          severity: 'medium',
          message: 'Hồ sơ đã qua bước kiểm tra nhưng thiếu Ngày gửi/hoàn thành KT.',
          suggestion: 'Tự động bổ sung Ngày kiểm tra bằng ngày làm xong hoặc ngày hiện tại.',
          canAutoFix: true,
          autoFixKey: 'checkDate',
        });
      }

      if (
        (r.status === RecordStatus.COMPLETED_WORK ||
          r.status === RecordStatus.PENDING_CHECK) &&
        !r.completedWorkDate
      ) {
        errors.push({
          code: 'ERR_MISSING_COMPLETED_WORK_DATE',
          category: 'check',
          categoryLabel: 'Kiểm tra & Trình ký',
          severity: 'medium',
          message: 'Hồ sơ đã báo làm xong/chờ KT nhưng chưa có Ngày thực hiện xong.',
          suggestion: 'Tự động điền Ngày thực hiện xong bằng ngày tiếp nhận/hiện tại.',
          canAutoFix: true,
          autoFixKey: 'completedWorkDate',
        });
      }

      if (
        r.status === RecordStatus.REJECTED &&
        (!r.notes || !r.notes.trim())
      ) {
        errors.push({
          code: 'ERR_REJECTED_NO_NOTES',
          category: 'check',
          categoryLabel: 'Kiểm tra & Trình ký',
          severity: 'high',
          message: 'Hồ sơ ở trạng thái Trả về nhưng chưa có nội dung ghi chú lý do.',
          suggestion: 'Nhập chi tiết lý do/nội dung yêu cầu chỉnh sửa lại.',
          canAutoFix: false,
        });
      }

      // MẢNG 4: Phân công & Nhân sự
      if (
        (r.status === RecordStatus.ASSIGNED ||
          r.status === RecordStatus.IN_PROGRESS ||
          r.status === RecordStatus.COMPLETED_WORK) &&
        (!r.assignedTo || !r.assignedTo.trim())
      ) {
        errors.push({
          code: 'ERR_UNASSIGNED',
          category: 'assign',
          categoryLabel: 'Phân công & Nhân sự',
          severity: 'high',
          message: 'Hồ sơ đang xử lý nhưng chưa phân công Nhân viên phụ trách.',
          suggestion: 'Chọn nhân viên từ danh sách để phân công xử lý.',
          canAutoFix: false,
        });
      }

      if (
        r.assignedTo &&
        employees.length > 0 &&
        !employees.some((e) => e.name === r.assignedTo || e.id === r.assignedTo)
      ) {
        errors.push({
          code: 'ERR_UNKNOWN_EMPLOYEE',
          category: 'assign',
          categoryLabel: 'Phân công & Nhân sự',
          severity: 'low',
          message: `Nhân viên "${r.assignedTo}" không thuộc danh sách nhân sự active.`,
          suggestion: 'Kiểm tra lại danh sách cán bộ hoặc gán lại nhân viên.',
          canAutoFix: false,
        });
      }

      // MẢNG 5: Thửa đất & Bản đồ
      if (
        r.recordType &&
        (r.recordType.includes('Trích đo') ||
          r.recordType.includes('Đo đạc') ||
          r.recordType.includes('Chỉnh lý')) &&
        (!r.landPlot || !r.mapSheet)
      ) {
        errors.push({
          code: 'ERR_MISSING_PLOT_MAP',
          category: 'map',
          categoryLabel: 'Thửa đất & Bản đồ',
          severity: 'low',
          message: 'Hồ sơ đo đạc/trích đo nhưng chưa nhập Số thửa hoặc Số tờ bản đồ.',
          suggestion: 'Cập nhật bổ sung số thửa và số tờ bản đồ địa chính.',
          canAutoFix: false,
        });
      }

      if (errors.length > 0) {
        results.push({ record: r, errors });
      }
    });

    return results;
  }, [records, employees]);

  // Statistics
  const categoryCounts = useMemo(() => {
    const counts = {
      all: diagnosticResults.length,
      info: 0,
      date: 0,
      check: 0,
      assign: 0,
      map: 0,
      autoFixable: 0,
    };

    diagnosticResults.forEach((item) => {
      let hasFixable = false;
      item.errors.forEach((err) => {
        if (counts[err.category] !== undefined) {
          counts[err.category]++;
        }
        if (err.canAutoFix) hasFixable = true;
      });
      if (hasFixable) counts.autoFixable++;
    });

    return counts;
  }, [diagnosticResults]);

  // Filtered items
  const filteredDiagnosticItems = useMemo(() => {
    return diagnosticResults.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const matchesCategory = item.errors.some(
          (e) => e.category === selectedCategory,
        );
        if (!matchesCategory) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const code = (item.record.code || '').toLowerCase();
        const name = (item.record.customerName || '').toLowerCase();
        const ward = (item.record.ward || '').toLowerCase();
        const errorMsgs = item.errors.map((e) => e.message.toLowerCase()).join(' ');

        if (
          !code.includes(term) &&
          !name.includes(term) &&
          !ward.includes(term) &&
          !errorMsgs.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [diagnosticResults, selectedCategory, searchTerm]);

  // Reset page to 1 when category or search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm]);

  // Pagination calculations
  const totalItems = filteredDiagnosticItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedDiagnosticItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDiagnosticItems.slice(start, start + pageSize);
  }, [filteredDiagnosticItems, currentPage, pageSize]);

  if (!isOpen) return null;

  // Toggle record row expand
  const toggleRecordExpand = (id: string) => {
    setExpandedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Start inline edit for a record
  const handleStartEdit = (record: RecordFile) => {
    setEditingRecordId(record.id);
    setEditFormData({
      code: record.code,
      customerName: record.customerName,
      ward: record.ward,
      assignedTo: record.assignedTo,
      checkedBy: record.checkedBy,
      completedWorkDate: record.completedWorkDate ? record.completedWorkDate.split('T')[0] : '',
      pendingCheckDate: record.pendingCheckDate ? record.pendingCheckDate.split('T')[0] : '',
      notes: record.notes || '',
      landPlot: record.landPlot || '',
      mapSheet: record.mapSheet || '',
    });
  };

  // Save inline edit
  const handleSaveInlineEdit = async (recordId: string) => {
    setIsFixing(true);
    try {
      const updates: Partial<RecordFile>[] = [
        {
          id: recordId,
          ...editFormData,
          ...(editFormData.completedWorkDate
            ? { completedWorkDate: new Date(editFormData.completedWorkDate).toISOString() }
            : {}),
          ...(editFormData.pendingCheckDate
            ? { pendingCheckDate: new Date(editFormData.pendingCheckDate).toISOString() }
            : {}),
        },
      ];

      await onBatchUpdateRecords(updates);
      setEditingRecordId(null);
      setSuccessMessage('Đã cập nhật sửa lỗi thành công!');
      setTimeout(() => setSuccessMessage(null), 3000);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Lỗi khi sửa hồ sơ:', err);
    } finally {
      setIsFixing(false);
    }
  };

  // Perform Auto Fix for all auto-fixable errors
  const handleAutoFixAll = async () => {
    const autoFixUpdatesMap = new Map<string, Partial<RecordFile>>();
    const nowIso = new Date().toISOString();
    const currentUserName = currentUser?.name || 'Tổ trưởng KT';

    diagnosticResults.forEach((item) => {
      item.errors.forEach((err) => {
        if (!err.canAutoFix || !err.autoFixKey) return;

        const existing = autoFixUpdatesMap.get(item.record.id) || { id: item.record.id };

        if (err.autoFixKey === 'checkedBy' && (!item.record.checkedBy || !item.record.checkedBy.trim())) {
          existing.checkedBy = currentUserName;
        }

        if (err.autoFixKey === 'checkDate' && !item.record.pendingCheckDate && !item.record.checkedDate) {
          existing.pendingCheckDate = item.record.completedWorkDate || item.record.receivedDate || nowIso;
          existing.checkedDate = nowIso;
        }

        if (err.autoFixKey === 'completedWorkDate' && !item.record.completedWorkDate) {
          existing.completedWorkDate = item.record.receivedDate || nowIso;
        }

        if (err.autoFixKey === 'deadline' && item.record.receivedDate) {
          const recTime = new Date(item.record.receivedDate).getTime();
          const fixDeadline = new Date(recTime + 5 * 24 * 60 * 60 * 1000).toISOString();
          existing.deadline = fixDeadline;
        }

        autoFixUpdatesMap.set(item.record.id, existing);
      });
    });

    const updates = Array.from(autoFixUpdatesMap.values());
    if (updates.length === 0) {
      alert('Không có lỗi nào có thể sửa tự động!');
      return;
    }

    if (!window.confirm(`Xác nhận tự động sửa lỗi cho ${updates.length} hồ sơ?`)) {
      return;
    }

    setIsFixing(true);
    try {
      await onBatchUpdateRecords(updates);
      setSuccessMessage(`Đã tự động xử lý và khắc phục lỗi cho ${updates.length} hồ sơ!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Lỗi khi sửa tự động:', err);
      alert('Thao tác sửa tự động gặp sự cố!');
    } finally {
      setIsFixing(false);
    }
  };

  // Export Error Report to Excel
  const handleExportErrorReportExcel = () => {
    if (diagnosticResults.length === 0) {
      alert('Không có lỗi nào để xuất báo cáo!');
      return;
    }

    const headers = [
      'STT',
      'Mã Hồ Sơ',
      'Tên Khách Hàng / Chủ Đất',
      'Xã / Phường',
      'Trạng Thái Hiện Tại',
      'Mảng Lỗi',
      'Mức Độ',
      'Chi Tiết Lỗi Phát Hiện',
      'Hướng Sửa Lỗi Đề Xuất',
      'Có Thể Sửa Tự Động'
    ];

    const dataRows: any[][] = [];
    let stt = 1;

    diagnosticResults.forEach(item => {
      item.errors.forEach(err => {
        dataRows.push([
          stt++,
          item.record.code || 'N/A',
          item.record.customerName || 'N/A',
          item.record.ward || 'N/A',
          item.record.status || 'N/A',
          err.categoryLabel,
          err.severity === 'high' ? 'Cao (Cần xử lý gấp)' : err.severity === 'medium' ? 'Trung bình' : 'Thấp',
          err.message,
          err.suggestion,
          err.canAutoFix ? 'Có' : 'Cần sửa thủ công'
        ]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
      ['Độc lập - Tự do - Hạnh phúc'],
      [''],
      ['BÁO CÁO CHẨN ĐOÁN VÀ PHÁT HIỆN LỖI HỒ SƠ'],
      [`Ngày kiểm tra: ${new Date().toLocaleDateString('vi-VN')} | Tổng số lỗi phát hiện: ${dataRows.length}`],
      [''],
      headers,
      ...dataRows
    ]);

    const totalCols = headers.length - 1;
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } }
    ];

    if (worksheet['A1']) worksheet['A1'].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    if (worksheet['A2']) worksheet['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if (worksheet['A4']) worksheet['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
    if (worksheet['A5']) worksheet['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };

    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const headerStyle = {
      font: { name: "Times New Roman", sz: 11, bold: true },
      fill: { fgColor: { rgb: "E0E0E0" } },
      border: borderStyle,
      alignment: { horizontal: "center", vertical: "center", wrapText: true }
    };
    const cellStyle = {
      font: { name: "Times New Roman", sz: 11 },
      border: borderStyle,
      alignment: { vertical: "center", wrapText: true }
    };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

    const headerRowIdx = 6;
    const dataStartIdx = 7;

    for (let c = 0; c <= totalCols; c++) {
      const headerRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
      if (!worksheet[headerRef]) worksheet[headerRef] = { v: "", t: "s" };
      worksheet[headerRef].s = headerStyle;

      for (let r = dataStartIdx; r < dataStartIdx + dataRows.length; r++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[cellRef]) worksheet[cellRef] = { v: "", t: "s" };

        // Center STT(0), Mã HS(1), Ward(3), Status(4), Severity(6), AutoFix(9)
        if ([0, 1, 3, 4, 6, 9].includes(c)) worksheet[cellRef].s = centerStyle;
        else worksheet[cellRef].s = cellStyle;
      }
    }

    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 26 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 45 },
      { wch: 45 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo Cáo Lỗi Hồ Sơ');

    const fileName = `Bao_Cao_Loi_Ho_So_Kiem_Tra_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-white text-slate-900 px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-2xs shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                Công Cụ Kiểm Tra & Khắc Phục Lỗi Hồ Sơ
                <span className="bg-red-50 text-red-600 text-xs px-2.5 py-0.5 rounded-full border border-red-200 font-bold">
                  {categoryCounts.all} hồ sơ có vấn đề
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Phân mảng chi tiết các loại lỗi, đề xuất hướng xử lý và hỗ trợ sửa nhanh / tự động hàng loạt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notification banner */}
        {successMessage && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-sm font-bold flex items-center justify-between shrink-0 animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="hover:opacity-80">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Category Navigation Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Tất cả lỗi</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {categoryCounts.all}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategory('info')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategory === 'info'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Mã & Thông tin</span>
              {categoryCounts.info > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">
                  {categoryCounts.info}
                </span>
              )}
            </button>

            <button
              onClick={() => setSelectedCategory('date')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategory === 'date'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Ngày tháng & Tiến độ</span>
              {categoryCounts.date > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                  {categoryCounts.date}
                </span>
              )}
            </button>

            <button
              onClick={() => setSelectedCategory('check')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategory === 'check'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Kiểm tra & Trình ký</span>
              {categoryCounts.check > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-bold">
                  {categoryCounts.check}
                </span>
              )}
            </button>

            <button
              onClick={() => setSelectedCategory('assign')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategory === 'assign'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Phân công Nhân sự</span>
              {categoryCounts.assign > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                  {categoryCounts.assign}
                </span>
              )}
            </button>

            <button
              onClick={() => setSelectedCategory('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategory === 'map'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Thửa đất & Bản đồ</span>
              {categoryCounts.map > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
                  {categoryCounts.map}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã, chủ sử dụng, xã..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <Info size={15} className="text-blue-600 shrink-0" />
            <span>
              Hiển thị <strong>{filteredDiagnosticItems.length}</strong> / {diagnosticResults.length} hồ sơ có phát hiện vấn đề
            </span>
          </div>

          <div className="flex items-center gap-2">
            {categoryCounts.autoFixable > 0 && (
              <button
                onClick={handleAutoFixAll}
                disabled={isFixing}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-50"
                title="Tự động sửa các lỗi liên quan đến ngày tháng, tên người kiểm tra thiếu"
              >
                <Wrench size={15} className={isFixing ? 'animate-spin' : ''} />
                <span>Sửa tự động ({categoryCounts.autoFixable} hồ sơ)</span>
              </button>
            )}

            <button
              onClick={handleExportErrorReportExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all"
              title="Xuất file Excel nghiên cứu khắc phục"
            >
              <FileSpreadsheet size={15} />
              <span>Xuất Báo Cáo Excel</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Results Content List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
          {filteredDiagnosticItems.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto my-8">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                Không phát hiện lỗi thuộc danh mục này!
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tất cả hồ sơ kiểm tra đã đáp ứng các điều kiện tiêu chuẩn hoặc thông tin nhập đúng quy định.
              </p>
            </div>
          ) : (
            paginatedDiagnosticItems.map((item, idx) => {
              const isExpanded = expandedRecordIds.has(item.record.id);
              const isEditing = editingRecordId === item.record.id;
              const hasHighSeverity = item.errors.some((e) => e.severity === 'high');

              return (
                <div
                  key={item.record.id}
                  className={`bg-white rounded-xl border transition-all shadow-sm overflow-hidden ${
                    hasHighSeverity ? 'border-red-200 hover:border-red-300' : 'border-amber-200 hover:border-amber-300'
                  }`}
                >
                  {/* Record Header Line */}
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-8 h-6 rounded-md bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                            {item.record.code || 'CHƯA CÓ MÃ'}
                          </span>
                          <span className="font-bold text-slate-800 text-sm truncate">
                            {item.record.customerName || 'Chưa có tên khách hàng'}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            • {item.record.ward || 'Chưa phân xã'}
                          </span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {item.record.status}
                          </span>
                        </div>

                        {/* Error preview badges */}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {item.errors.map((err, eIdx) => (
                            <span
                              key={eIdx}
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                err.severity === 'high'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : err.severity === 'medium'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              {err.categoryLabel}: {err.message}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartEdit(item.record)}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-200"
                      >
                        <Edit3 size={14} /> Sửa nhanh
                      </button>

                      <button
                        onClick={() => toggleRecordExpand(item.record.id)}
                        className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <span>{isExpanded ? 'Thu gọn' : 'Chi tiết lỗi'}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Inline Quick Edit Panel */}
                  {isEditing && (
                    <div className="bg-blue-50/70 p-4 border-t border-blue-200 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Edit3 size={14} className="text-blue-600" /> Chỉnh Sửa Nhanh Thông Tin Hồ Sơ
                        </h5>
                        <button
                          onClick={() => setEditingRecordId(null)}
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          Hủy
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Mã hồ sơ:</label>
                          <input
                            type="text"
                            value={editFormData.code || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 font-mono text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Tên khách hàng:</label>
                          <input
                            type="text"
                            value={editFormData.customerName || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Phường/Xã:</label>
                          <input
                            type="text"
                            value={editFormData.ward || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, ward: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Cán bộ kiểm tra:</label>
                          <input
                            type="text"
                            value={editFormData.checkedBy || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, checkedBy: e.target.value })}
                            placeholder="Nhập tên người kiểm tra"
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Nhân viên phụ trách:</label>
                          <select
                            value={editFormData.assignedTo || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, assignedTo: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-slate-800"
                          >
                            <option value="">-- Chọn nhân viên --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name} ({emp.department})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Ngày làm xong:</label>
                          <input
                            type="date"
                            value={editFormData.completedWorkDate || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, completedWorkDate: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Số thửa đất:</label>
                          <input
                            type="text"
                            value={editFormData.landPlot || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, landPlot: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Số tờ bản đồ:</label>
                          <input
                            type="text"
                            value={editFormData.mapSheet || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, mapSheet: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingRecordId(null)}
                          className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-md hover:bg-slate-50"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() => handleSaveInlineEdit(item.record.id)}
                          disabled={isFixing}
                          className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <Save size={14} /> Lưu chỉnh sửa
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Detailed Error Breakdown */}
                  {(isExpanded || item.errors.length === 1) && (
                    <div className="bg-slate-50 p-4 border-t border-slate-200 text-xs divide-y divide-slate-200">
                      {item.errors.map((err, eIdx) => (
                        <div key={eIdx} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] bg-slate-200/80 px-2 py-0.5 rounded">
                                {err.categoryLabel}
                              </span>
                              <span className="font-bold text-red-600">{err.message}</span>
                            </div>

                            <div className="text-slate-600 flex items-center gap-1.5 font-medium pl-1">
                              <span className="font-bold text-blue-700">👉 Hướng sửa lỗi:</span>
                              <span>{err.suggestion}</span>
                            </div>
                          </div>

                          {err.canAutoFix && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                              <Check size={13} /> Sửa được tự động
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Bar */}
        {totalItems > 0 && (
          <div className="bg-slate-100 px-6 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-700 shrink-0">
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={10}>10 hồ sơ/trang</option>
                <option value={20}>20 hồ sơ/trang</option>
                <option value={50}>50 hồ sơ/trang</option>
                <option value={100}>100 hồ sơ/trang</option>
              </select>
              <span className="text-slate-500 font-medium">
                (Tổng số <strong className="text-slate-800">{totalItems}</strong> hồ sơ lỗi)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold shadow-sm transition-all active:scale-95"
              >
                « Đầu
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold shadow-sm transition-all active:scale-95"
              >
                ‹ Trước
              </button>
              <span className="px-3 py-1 bg-white border border-slate-300 rounded font-bold text-blue-700 shadow-sm">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold shadow-sm transition-all active:scale-95"
              >
                Sau ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold shadow-sm transition-all active:scale-95"
              >
                Cuối »
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="bg-white px-6 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            * Mọi dữ liệu sửa đổi sẽ được cập nhật trực tiếp vào hệ thống khi bạn thực hiện sửa nhanh hoặc sửa tự động.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors shadow-sm active:scale-95"
          >
            Đóng cửa sổ
          </button>
        </div>

      </div>
    </div>
  );
};

export default BatchErrorDiagnosticModal;
