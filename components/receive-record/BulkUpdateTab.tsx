import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { STATUS_LABELS } from '../../constants';
import { Search, Filter, Layers, ArrowRight, CheckCircle2, AlertTriangle, FileSpreadsheet, Upload, RefreshCw, Check, X, Edit3, Trash2, Save, ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react';
import { confirmAction, formatDateKey } from '../../utils/appHelpers';

interface BulkUpdateTabProps {
  records: RecordFile[];
  employees: Employee[];
  wards: string[];
  onSave: (record: RecordFile) => Promise<RecordFile | null>;
  onBulkUpdate?: (field: keyof RecordFile, value: any, customDate?: string, targetRecordIds?: string[]) => Promise<void>;
  currentUser?: any;
}

export const BulkUpdateTab: React.FC<BulkUpdateTabProps> = ({
  records,
  employees,
  wards,
  onSave,
  onBulkUpdate,
  currentUser,
}) => {
  // Mode selection: Manual selection update vs Excel match update
  const [updateMode, setUpdateMode] = useState<'manual' | 'excel'>('excel');

  // Manual update states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [wardFilter, setWardFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Target update form states
  const [targetField, setTargetField] = useState<string>('status');
  const [targetValue, setTargetValue] = useState<string>('');
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Quick edit modal / inline edit state
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);

  // Excel update states
  const [excelPreview, setExcelPreview] = useState<{ record: RecordFile; updates: Record<string, any>; errors?: string[] }[]>([]);
  const [editingExcelIdx, setEditingExcelIdx] = useState<number | null>(null);
  const [editingExcelUpdates, setEditingExcelUpdates] = useState<Record<string, any>>({});
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered records for manual mode
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (wardFilter && r.ward !== wardFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const code = (r.code || '').toLowerCase();
        const name = (r.customerName || '').toLowerCase();
        const plot = (r.landPlot || '').toLowerCase();
        const map = (r.mapSheet || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !plot.includes(q) && !map.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [records, wardFilter, statusFilter, searchQuery]);

  // Reset page to 1 when filter conditions change
  useEffect(() => {
    setCurrentPage(1);
  }, [wardFilter, statusFilter, searchQuery]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRecords.length / pageSize)), [filteredRecords.length, pageSize]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Select all / deselect all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = new Set(selectedIds);
    if (e.target.checked) {
      paginatedRecords.forEach((r) => next.add(r.id));
    } else {
      paginatedRecords.forEach((r) => next.delete(r.id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Save quick single record edit
  const handleSaveSingleRecord = async () => {
    if (!editingRecord) return;
    setIsProcessing(true);
    try {
      await onSave(editingRecord);
      alert(`Đã cập nhật thông tin hồ sơ ${editingRecord.code} thành công!`);
      setEditingRecord(null);
    } catch (err) {
      console.error('Lỗi khi lưu hồ sơ:', err);
      alert('Đã xảy ra lỗi khi lưu thông tin.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Perform Manual Bulk Update
  const handleConfirmManualUpdate = async () => {
    if (selectedIds.size === 0) {
      alert('Vui lòng chọn ít nhất 1 hồ sơ cần cập nhật.');
      return;
    }
    if (!targetValue) {
      alert('Vui lòng chọn giá trị mới cần cập nhật.');
      return;
    }

    if (
      await confirmAction(
        `Bạn có chắc chắn muốn cập nhật thông tin cho ${selectedIds.size} hồ sơ đã chọn?`
      )
    ) {
      setIsProcessing(true);
      try {
        const isoDate = useCustomDate && customDate ? new Date(customDate).toISOString() : undefined;
        const targetIdsArray = Array.from(selectedIds);

        if (onBulkUpdate) {
          await onBulkUpdate(targetField as keyof RecordFile, targetValue, isoDate, targetIdsArray);
        } else {
          // Fallback: update records one by one
          for (const id of targetIdsArray) {
            const rec = records.find((r) => r.id === id);
            if (rec) {
              const updatedRec: RecordFile = {
                ...rec,
                [targetField]: targetValue,
              };
              await onSave(updatedRec);
            }
          }
        }
        alert(`Đã cập nhật thành công ${selectedIds.size} hồ sơ!`);
        setSelectedIds(new Set());
      } catch (err) {
        console.error('Error during bulk update:', err);
        alert('Có lỗi xảy ra trong quá trình cập nhật.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Handle Excel File Parsing for Update
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target?.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (rawData.length < 2) {
          alert('File Excel không có dữ liệu hợp lệ.');
          return;
        }

        // Find header row
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rawData.length, 15); i++) {
          const row = rawData[i] || [];
          if (row.some((cell) => String(cell).toLowerCase().includes('mã') || String(cell).toLowerCase().includes('code'))) {
            headerRowIdx = i;
            break;
          }
        }

        const headers = (rawData[headerRowIdx] as string[]).map((h) => String(h || '').toUpperCase().trim());
        const codeColIdx = headers.findIndex((h) => h.includes('MÃ') || h.includes('CODE') || h.includes('SỐ HS'));

        if (codeColIdx === -1) {
          alert('Không tìm thấy cột Mã hồ sơ (MÃ, CODE, SỐ HS) trong file Excel.');
          return;
        }

        const previewList: { record: RecordFile; updates: Record<string, any>; errors?: string[] }[] = [];

        for (let i = headerRowIdx + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const rowCode = String(row[codeColIdx] || '').trim();
          if (!rowCode) continue;

          const matchedRecord = records.find(
            (r) => (r.code || '').trim().toLowerCase() === rowCode.toLowerCase()
          );

          if (!matchedRecord) continue;

          const updates: Record<string, any> = {};

          // Check columns for updates
          headers.forEach((h, colIdx) => {
            const cellVal = row[colIdx];
            if (cellVal === undefined || cellVal === null || String(cellVal).trim() === '') return;

            const valStr = String(cellVal).trim();

            if (h.includes('TÊN') || h.includes('CHỦ SỬ DỤNG') || h.includes('KHACH HANG')) {
              updates.customerName = valStr;
            } else if (h.includes('SĐT') || h.includes('ĐIỆN THOẠI') || h.includes('PHONE')) {
              updates.phoneNumber = valStr;
            } else if (h.includes('THỬA') || h.includes('SO_THUA')) {
              updates.landPlot = valStr;
            } else if (h.includes('TỜ') || h.includes('SO_TO')) {
              updates.mapSheet = valStr;
            } else if (h.includes('DIỆN TÍCH') || h.includes('AREA')) {
              updates.area = valStr;
            } else if (h.includes('XÃ') || h.includes('PHƯỜNG') || h.includes('WARD')) {
              updates.ward = valStr;
            } else if (h.includes('TRẠNG THÁI') || h.includes('STATUS')) {
              updates.status = valStr;
            } else if (h.includes('GHI CHÚ') || h.includes('NOTE')) {
              updates.privateNotes = valStr;
            }
          });

          if (Object.keys(updates).length > 0) {
            previewList.push({
              record: matchedRecord,
              updates,
            });
          }
        }

        setExcelPreview(previewList);
        if (previewList.length === 0) {
          alert('Không tìm thấy hồ sơ trùng khớp với mã trong file Excel.');
        }
      } catch (err) {
        console.error('Error reading Excel file:', err);
        alert('Lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApplyExcelUpdates = async () => {
    if (excelPreview.length === 0) return;
    if (await confirmAction(`Bạn có chắc muốn cập nhật ${excelPreview.length} hồ sơ từ file Excel?`)) {
      setIsProcessing(true);
      try {
        for (const item of excelPreview) {
          const updated: RecordFile = {
            ...item.record,
            ...item.updates,
          };
          await onSave(updated);
        }
        alert(`Đã cập nhật thành công ${excelPreview.length} hồ sơ!`);
        setExcelPreview([]);
        setFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('Error applying Excel updates:', err);
        alert('Có lỗi xảy ra khi cập nhật dữ liệu.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleRemoveExcelItem = (idx: number) => {
    setExcelPreview((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveExcelUpdates = (idx: number) => {
    setExcelPreview((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, updates: { ...editingExcelUpdates } } : item))
    );
    setEditingExcelIdx(null);
  };

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'MÃ HỒ SƠ': 'HS2026-0001',
        'TÊN KHÁCH HÀNG': 'Nguyễn Văn A',
        'XÃ PHƯỜNG': 'Tân Khải',
        'TRẠNG THÁI': 'Đang xử lý',
        'CÁN BỘ THỤ LÝ': employees[0]?.name || 'Nguyễn Văn B',
        'HẠN GIẢI QUYẾT': '2026-08-15',
        'NGÀY TRẢ KẾT QUẢ': '2026-08-14',
        'GHI CHÚ': 'Cập nhật bổ sung giấy tờ'
      },
      {
        'MÃ HỒ SƠ': 'HS2026-0002',
        'TÊN KHÁCH HÀNG': 'Trần Thị C',
        'XÃ PHƯỜNG': 'Minh Hưng',
        'TRẠNG THÁI': 'Đã hoàn thành',
        'CÁN BỘ THỤ LÝ': employees[1]?.name || 'Lê Văn D',
        'HẠN GIẢI QUYẾT': '2026-08-20',
        'NGÀY TRẢ KẾT QUẢ': '2026-08-18',
        'GHI CHÚ': 'Đã giao kết quả cho công dân'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CapNhatHoSoMau');
    XLSX.writeFile(workbook, 'Mau_Cap_Nhat_Ho_So_Hang_Loat.xlsx');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 bg-blue-600 text-white shadow-sm">
            <FileSpreadsheet size={16} /> Cập nhật qua File Excel
          </div>
        </div>
      </div>

      {/* Mode 1: Manual Selection & Bulk Update */}
      {updateMode === 'manual' && (
        <div className="space-y-6">
          {/* Controls Panel */}
          <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 p-5 rounded-xl border border-blue-100 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
              <RefreshCw size={18} className="text-blue-600" /> Thiết lập thông tin cập nhật hàng loạt
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Chọn thông tin cần thay đổi
                </label>
                <select
                  value={targetField}
                  onChange={(e) => {
                    setTargetField(e.target.value);
                    setTargetValue('');
                    setUseCustomDate(false);
                    setCustomDate('');
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="status">Trạng thái hồ sơ (Quy trình)</option>
                  <option value="assignedTo">Người xử lý (Giao việc)</option>
                  <option value="deadline">Ngày hẹn trả (Gia hạn)</option>
                  <option value="receivedDate">Ngày nhận hồ sơ</option>
                  <option value="ward">Xã / Phường (Địa bàn)</option>
                  <option value="privateNotes">Ghi chú nội bộ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. Giá trị mới
                </label>
                {targetField === 'status' && (
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Chọn trạng thái mới --</option>
                    {Object.entries(STATUS_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}

                {targetField === 'assignedTo' && (
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Chọn cán bộ xử lý --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.department})
                      </option>
                    ))}
                  </select>
                )}

                {targetField === 'ward' && (
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Chọn Xã / Phường --</option>
                    {wards.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                )}

                {(targetField === 'deadline' || targetField === 'receivedDate') && (
                  <input
                    type="date"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                )}

                {targetField === 'privateNotes' && (
                  <input
                    type="text"
                    placeholder="Nhập nội dung ghi chú mới..."
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                )}
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleConfirmManualUpdate}
                  disabled={isProcessing || selectedIds.size === 0 || !targetValue}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 size={18} />
                  {isProcessing ? 'Đang cập nhật...' : `Áp dụng cho ${selectedIds.size} hồ sơ`}
                </button>
              </div>
            </div>

            {(targetField === 'status' || targetField === 'assignedTo') && (
              <div className="pt-2 border-t border-blue-200/60 flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomDate}
                    onChange={(e) => setUseCustomDate(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Chọn mốc thời gian thực hiện riêng (Tùy chọn)
                </label>
                {useCustomDate && (
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold"
                  />
                )}
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm mã hồ sơ, tên khách hàng, số thửa, tờ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="">Tất cả Xã/Phường</option>
                {wards.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">
                Tìm thấy <strong className="text-slate-800">{filteredRecords.length}</strong> hồ sơ
              </span>
              {selectedIds.size > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-bold">
                  Đã chọn {selectedIds.size}
                </span>
              )}
            </div>
          </div>

          {/* Table List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={
                          filteredRecords.length > 0 &&
                          filteredRecords.every((r) => selectedIds.has(r.id))
                        }
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title="Chọn tất cả kết quả tìm kiếm"
                      />
                    </th>
                    <th className="p-3">Mã Hồ Sơ</th>
                    <th className="p-3">Chủ Sử Dụng</th>
                    <th className="p-3">Thửa / Tờ</th>
                    <th className="p-3">Địa Bàn</th>
                    <th className="p-3">Trạng Thái</th>
                    <th className="p-3">Cán Bộ Xử Lý</th>
                    <th className="p-3">Ngày Hẹn Trả</th>
                    <th className="p-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                        Không tìm thấy hồ sơ phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((r) => {
                      const isSelected = selectedIds.has(r.id);
                      const assignedEmp = employees.find((e) => e.id === r.assignedTo);
                      return (
                        <tr
                          key={r.id}
                          onClick={() => handleToggleSelect(r.id)}
                          className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 font-semibold' : ''
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(r.id)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="p-3 font-bold text-blue-700">{r.code}</td>
                          <td className="p-3 text-slate-900 font-semibold">{r.customerName}</td>
                          <td className="p-3">
                            {r.landPlot || '---'} / {r.mapSheet || '---'}
                          </td>
                          <td className="p-3 font-medium">{r.ward || '---'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {STATUS_LABELS[r.status] || r.status}
                            </span>
                          </td>
                          <td className="p-3">{assignedEmp ? assignedEmp.name : 'Chưa giao'}</td>
                          <td className="p-3 font-mono">{r.deadline ? r.deadline.split('T')[0] : '---'}</td>
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setEditingRecord({ ...r })}
                              className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-all flex items-center gap-1 mx-auto"
                              title="Sửa trực tiếp hồ sơ này"
                            >
                              <Edit3 size={13} /> Sửa
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            {filteredRecords.length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Hiển thị</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-slate-300 rounded px-2 py-1 bg-white font-semibold text-slate-700"
                  >
                    <option value={15}>15 dòng</option>
                    <option value={20}>20 dòng</option>
                    <option value={50}>50 dòng</option>
                    <option value={100}>100 dòng</option>
                  </select>
                  <span>
                    từ <strong>{(currentPage - 1) * pageSize + 1}</strong> đến{' '}
                    <strong>{Math.min(currentPage * pageSize, filteredRecords.length)}</strong> trên tổng số{' '}
                    <strong className="text-blue-700">{filteredRecords.length}</strong> hồ sơ
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-bold flex items-center gap-1 transition-all"
                  >
                    <ChevronLeft size={14} /> Trước
                  </button>

                  <div className="flex items-center gap-1 px-2 font-bold text-slate-700">
                    <span>Trang {currentPage} / {totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-bold flex items-center gap-1 transition-all"
                  >
                    Sau <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Excel File Matching & Bulk Update */}
      {updateMode === 'excel' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Upload size={18} className="text-blue-600" /> Tải File Excel Cập Nhật Hồ Sơ
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Hệ thống sẽ tự động tìm hồ sơ khớp theo <strong>Mã hồ sơ (MÃ / CODE / SỐ HS)</strong> và cập nhật các cột có trong Excel.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadTemplate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
                title="Tải file mẫu Excel có cấu trúc các cột chuẩn"
              >
                <FileSpreadsheet size={16} /> Tải File Excel Mẫu
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls"
                onChange={handleExcelFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <Upload size={16} /> Chọn File Excel
              </button>
            </div>
          </div>

          {fileName && (
            <div className="text-xs font-bold text-slate-700 bg-blue-50 px-3 py-2 rounded border border-blue-200">
              File đã chọn: <span className="text-blue-800">{fileName}</span>
            </div>
          )}

          {/* Excel Preview Results */}
          {excelPreview.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">
                  Danh sách hồ sơ khớp mã cần cập nhật ({excelPreview.length})
                </span>
                <button
                  onClick={handleApplyExcelUpdates}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-xs shadow-sm flex items-center gap-2 transition-all"
                >
                  <Check size={16} />
                  {isProcessing ? 'Đang lưu...' : 'Tiến hành Cập nhật Tất cả'}
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Mã HS</th>
                      <th className="p-3">Tên Khách Hàng</th>
                      <th className="p-3">Cập Nhật Tìm Thấy</th>
                      <th className="p-3 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {excelPreview.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-blue-700">{item.record.code}</td>
                        <td className="p-3 text-slate-800">{item.record.customerName}</td>
                        <td className="p-3">
                          {editingExcelIdx === idx ? (
                            <div className="space-y-2 bg-amber-50 p-2.5 rounded border border-amber-200">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {Object.entries(editingExcelUpdates).map(([k, val]) => (
                                  <div key={k}>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase">{k}</label>
                                    <input
                                      type="text"
                                      value={String(val)}
                                      onChange={(e) =>
                                        setEditingExcelUpdates({
                                          ...editingExcelUpdates,
                                          [k]: e.target.value,
                                        })
                                      }
                                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  onClick={() => setEditingExcelIdx(null)}
                                  className="px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200 rounded"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => handleSaveExcelUpdates(idx)}
                                  className="px-2.5 py-0.5 text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 rounded"
                                >
                                  Lưu thay đổi
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(item.updates).map(([k, val]) => (
                                <span key={k} className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                                  <strong>{k}:</strong> {String(val)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingExcelIdx(idx);
                                setEditingExcelUpdates({ ...item.updates });
                              }}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                              title="Sửa giá trị cập nhật"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleRemoveExcelItem(idx)}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                              title="Bỏ khỏi danh sách cập nhật"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUICK EDIT SINGLE RECORD MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Edit3 className="text-blue-600" size={20} /> Sửa trực tiếp hồ sơ: <span className="text-blue-700 font-mono">{editingRecord.code}</span>
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 mb-1">Mã hồ sơ</label>
                <input
                  type="text"
                  value={editingRecord.code || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, code: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold text-blue-700"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Chủ sử dụng</label>
                <input
                  type="text"
                  value={editingRecord.customerName || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, customerName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  value={editingRecord.phoneNumber || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, phoneNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Địa bàn (Xã / Phường)</label>
                <select
                  value={editingRecord.ward || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, ward: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">-- Chọn xã phường --</option>
                  {wards.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Số thửa</label>
                <input
                  type="text"
                  value={editingRecord.landPlot || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, landPlot: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Số tờ</label>
                <input
                  type="text"
                  value={editingRecord.mapSheet || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, mapSheet: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Trạng thái hồ sơ</label>
                <select
                  value={editingRecord.status || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, status: e.target.value as RecordStatus })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-bold"
                >
                  {Object.entries(STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Cán bộ xử lý</label>
                <select
                  value={editingRecord.assignedTo || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, assignedTo: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">-- Chưa giao --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Ngày hẹn trả</label>
                <input
                  type="date"
                  value={editingRecord.deadline ? editingRecord.deadline.split('T')[0] : ''}
                  onChange={(e) =>
                    setEditingRecord({
                      ...editingRecord,
                      deadline: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 mb-1">Ghi chú nội bộ</label>
                <textarea
                  rows={2}
                  value={editingRecord.privateNotes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, privateNotes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveSingleRecord}
                disabled={isProcessing}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Save size={16} />
                {isProcessing ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkUpdateTab;
