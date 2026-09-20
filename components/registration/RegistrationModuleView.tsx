import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Filter,
  ChevronUp,
  ChevronDown,
  MapPin,
  Users,
} from 'lucide-react';
import { RecordFile, Employee, User, RecordStatus } from '../../types';
import { useRegistrationFilter } from '../../hooks/useRegistrationFilter';
import { RegistrationRecordRow } from './RegistrationRecordRow';
import { RegistrationDetailModal } from './RegistrationDetailModal';
import { RegistrationAssignModal } from './RegistrationAssignModal';
import {
  fetchDangkyRecords,
  updateDangkyRecord,
  deleteDangkyRecord,
  deleteBulkDangkyRecords,
  assignDangkyRecordsBatch,
} from '../../services/apiRegistration';
import { syncDangKyToVaoSo } from '../../services/apiArchive';

interface RegistrationModuleViewProps {
  currentUser?: User | null;
  employees: Employee[];
}

export const RegistrationModuleView: React.FC<RegistrationModuleViewProps> = ({
  currentUser,
  employees,
}) => {
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [viewingRecord, setViewingRecord] = useState<RecordFile | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isAssignOpen, setIsAssignOpen] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const filterHook = useRegistrationFilter({ records });

  const [showFilterPopover, setShowFilterPopover] = useState<boolean>(false);
  const filterPopoverRef = React.useRef<HTMLDivElement>(null);

  const activeFilterCount = [
    filterHook.selectedWard !== 'all',
    filterHook.selectedStatus !== 'all',
    filterHook.selectedAssignedTo !== 'all',
  ].filter(Boolean).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setShowFilterPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tải dữ liệu từ bảng dangky_records
  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await fetchDangkyRecords();
      setRecords(data);
    } catch (err) {
      console.error('Lỗi khi tải hồ sơ Đăng ký:', err);
      setFeedbackMsg({ type: 'error', text: 'Không thể tải dữ liệu hồ sơ Đăng ký.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Quản lý chọn checkbox
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filterHook.paginatedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filterHook.paginatedRecords.map((r) => r.id)));
    }
  };

  // Mở modal chi tiết
  const handleViewDetail = (record: RecordFile) => {
    setViewingRecord(record);
    setIsDetailOpen(true);
  };

  // Lưu cập nhật hồ sơ
  const handleSaveRecord = async (updated: RecordFile) => {
    const saved = await updateDangkyRecord(updated);
    setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));

    // Tự động đồng bộ sang module Vào sổ GCN nếu hồ sơ đã ký, duyệt, chuyển bàn giao hoặc có số vào sổ
    if (
      saved.status === RecordStatus.SIGNED ||
      saved.status === RecordStatus.PENDING_HANDOVER ||
      saved.status === RecordStatus.HANDOVER ||
      Boolean(saved.approvalDate) ||
      Boolean(saved.entryNumber)
    ) {
      syncDangKyToVaoSo([saved]).catch((err) => {
        console.warn('[VaoSo AutoSync Error in RegistrationModuleView]:', err);
      });
    }

    showFeedback('success', `Đã cập nhật thành công hồ sơ ${saved.code}`);
  };

  // Xóa 1 hồ sơ
  const handleDeleteRecord = async (record: RecordFile) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa hồ sơ ${record.code}?`)) return;
    try {
      await deleteDangkyRecord(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
      showFeedback('success', `Đã xóa hồ sơ ${record.code}`);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Không thể xóa hồ sơ.');
    }
  };

  // Xóa nhiều hồ sơ
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${ids.length} hồ sơ đã chọn?`)) return;

    try {
      await deleteBulkDangkyRecords(ids);
      setRecords((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelectedIds(new Set());
      showFeedback('success', `Đã xóa ${ids.length} hồ sơ thành công.`);
    } catch (err: any) {
      showFeedback('error', err?.message || 'Không thể xóa các hồ sơ đã chọn.');
    }
  };

  // Phân công hàng loạt
  const handleConfirmAssign = async (
    recordIds: string[],
    assignedTo: string,
    assignedDate: string
  ) => {
    await assignDangkyRecordsBatch(recordIds, assignedTo, assignedDate);
    setRecords((prev) =>
      prev.map((r) =>
        recordIds.includes(r.id)
          ? { ...r, assignedTo, assignedDate, status: RecordStatus.IN_PROGRESS }
          : r
      )
    );
    setSelectedIds(new Set());
    showFeedback('success', `Đã phân công ${recordIds.length} hồ sơ cho cán bộ ${assignedTo}`);
  };

  // Lắng nghe phím Esc để thoát các modal / popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDetailOpen) {
          setIsDetailOpen(false);
        } else if (isAssignOpen) {
          setIsAssignOpen(false);
        } else if (filterHook.searchTerm) {
          filterHook.setSearchTerm('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailOpen, isAssignOpen, filterHook]);

  // Danh sách hồ sơ đang được chọn
  const selectedRecordsList = records.filter((r) => selectedIds.has(r.id));

  // Thống kê nhanh theo sub-tabs quy trình Cấp giấy
  const stats = {
    all: records.length,
    unassigned: records.filter((r) => !r.assignedTo || r.status === RecordStatus.RECEIVED).length,
    appraisal: records.filter((r) => r.status === RecordStatus.APPRAISAL).length,
    tax: records.filter(
      (r) =>
        r.status === RecordStatus.TAX_TRANSFER ||
        r.status === RecordStatus.PENDING_TAX_KV7 ||
        r.status === RecordStatus.PENDING_TAX_PAYMENT
    ).length,
    print_cert: records.filter((r) => r.status === RecordStatus.PENDING_PRINT_CERT).length,
    pending_check: records.filter((r) => r.status === RecordStatus.PENDING_CHECK).length,
    pending_sign: records.filter((r) => r.status === RecordStatus.PENDING_SIGN).length,
    signed: records.filter(
      (r) => r.status === RecordStatus.SIGNED || r.status === RecordStatus.PENDING_HANDOVER
    ).length,
    supplement: records.filter((r) => r.status === RecordStatus.PENDING_SUPPLEMENT).length,
    handed_over: records.filter((r) => r.isHandedOver || r.status === RecordStatus.HANDOVER).length,
    returned: records.filter((r) => r.status === RecordStatus.RETURNED).length,
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-100 min-h-screen">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Quản lý Hồ sơ Cấp giấy
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              Nhóm 3.x
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu độc lập từ bảng <code className="font-bold text-blue-700">dangky_records</code>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {/* Thông báo Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`mx-6 mt-4 p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="p-1 hover:bg-black/5 rounded cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sub-Tabs Nghiệp vụ */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'all', label: 'Tất cả hồ sơ', count: stats.all },
          { id: 'unassigned', label: 'Chờ phân công', count: stats.unassigned },
          { id: 'appraisal', label: 'Thẩm định', count: stats.appraisal },
          { id: 'tax', label: 'Chuyển thuế / KV7 / GNT', count: stats.tax },
          { id: 'print_cert', label: 'Chờ in GCN', count: stats.print_cert },
          { id: 'pending_check', label: 'Chờ kiểm tra', count: stats.pending_check },
          { id: 'pending_sign', label: 'Chờ ký duyệt', count: stats.pending_sign },
          { id: 'signed', label: 'Đã ký / Chờ giao', count: stats.signed },
          { id: 'supplement', label: 'Chờ bổ sung', count: stats.supplement },
          { id: 'handed_over', label: 'Đã giao 1 cửa', count: stats.handed_over },
          { id: 'returned', label: 'Đã trả kết quả', count: stats.returned },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => filterHook.setActiveSubTab(tab.id)}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              filterHook.activeSubTab === tab.id
                ? 'border-blue-600 text-blue-700 bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                filterHook.activeSubTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Thanh Tìm kiếm & Bộ lọc Popover (Nằm cạnh nhau) */}
      <div className="p-4 px-6 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px] max-w-xl">
          {/* Ô Tìm kiếm */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterHook.searchTerm}
              onChange={(e) => filterHook.setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm mã hồ sơ, tên chủ, số tờ, số thửa, SĐT..."
              className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {filterHook.searchTerm && (
              <button
                type="button"
                onClick={() => filterHook.setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Nút Lọc Popover đặt ngay cạnh ô tìm kiếm */}
          <div className="relative inline-block shrink-0" ref={filterPopoverRef}>
            <button
              type="button"
              onClick={() => setShowFilterPopover(!showFilterPopover)}
              className={`flex items-center justify-center p-2 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer relative ${
                activeFilterCount > 0
                  ? 'border-blue-300 text-blue-700 bg-blue-50'
                  : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
              }`}
              title="Bộ lọc hồ sơ cấp giấy"
              aria-label="Bộ lọc hồ sơ cấp giấy"
            >
              <Filter size={18} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full font-extrabold flex items-center justify-center shadow-xs">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Thẻ Popover thả xuống */}
            {showFilterPopover && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 text-slate-800 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2 font-bold text-blue-700 text-sm">
                    <Filter size={16} />
                    <span>Bộ lọc hồ sơ cấp giấy</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilterPopover(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 text-xs">
                  {/* 1. Xã / Phường */}
                  <div>
                    <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                      <MapPin size={14} className="text-slate-400" />
                      <span>Xã / Phường:</span>
                    </label>
                    <select
                      value={filterHook.selectedWard}
                      onChange={(e) => filterHook.setSelectedWard(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl p-2 font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="all">-- Tất cả Xã / Phường --</option>
                      {filterHook.availableWards.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Cán bộ thụ lý */}
                  <div>
                    <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                      <Users size={14} className="text-slate-400" />
                      <span>Cán bộ thụ lý:</span>
                    </label>
                    <select
                      value={filterHook.selectedAssignedTo}
                      onChange={(e) => filterHook.setSelectedAssignedTo(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl p-2 font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="all">-- Tất cả Cán bộ --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Trạng thái */}
                  <div>
                    <label className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                      <FileText size={14} className="text-slate-400" />
                      <span>Trạng thái hồ sơ:</span>
                    </label>
                    <select
                      value={filterHook.selectedStatus}
                      onChange={(e) => filterHook.setSelectedStatus(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl p-2 font-medium bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="all">-- Tất cả Trạng thái --</option>
                      <option value={RecordStatus.RECEIVED}>Tiếp nhận / Chờ phân công</option>
                      <option value={RecordStatus.IN_PROGRESS}>Đang thực hiện</option>
                      <option value={RecordStatus.PENDING_CHECK}>Chờ kiểm tra</option>
                      <option value={RecordStatus.PENDING_SIGN}>Chờ ký duyệt</option>
                      <option value={RecordStatus.SIGNED}>Đã ký duyệt / Chờ bàn giao</option>
                      <option value={RecordStatus.HANDOVER}>Đã giao 1 cửa</option>
                      <option value={RecordStatus.RETURNED}>Đã trả kết quả</option>
                    </select>
                  </div>

                  {/* Nút Reset */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => filterHook.resetFilters()}
                      className="w-full py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <X size={14} /> Đặt lại tất cả bộ lọc
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Báo số lượng kết quả */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            Tìm thấy <strong className="text-blue-700 font-extrabold">{filterHook.filteredRecords.length}</strong> / {records.length} hồ sơ
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={filterHook.resetFilters}
              className="text-xs text-red-600 hover:text-red-800 font-bold hover:underline cursor-pointer"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Thanh tác vụ hàng loạt khi có chọn */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 px-4 flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900">
              Đang chọn <strong>{selectedIds.size}</strong> hồ sơ
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAssignOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <UserCheck size={13} />
                <span>Phân công</span>
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Xóa chọn</span>
              </button>
            </div>
          </div>
        )}

        {/* Bảng dữ liệu hồ sơ Đăng ký */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[350px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 shadow-2xs">
                <tr className="border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-10 bg-slate-100">
                    <input
                      type="checkbox"
                      checked={
                        filterHook.paginatedRecords.length > 0 &&
                        selectedIds.size === filterHook.paginatedRecords.length
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-2 text-center w-12 bg-slate-100">STT</th>
                  <th className="py-3 px-3 bg-slate-100">Mã hồ sơ</th>
                  <th className="py-3 px-3 bg-slate-100">Chủ sử dụng</th>
                  <th className="py-3 px-3 bg-slate-100">Xã / Phường</th>
                  <th className="py-3 px-3 text-center bg-slate-100">Thửa / Tờ</th>
                  <th className="py-3 px-3 bg-slate-100">Nội dung</th>
                  <th className="py-3 px-3 bg-slate-100">Cán bộ thụ lý</th>
                  <th className="py-3 px-3 bg-slate-100">Ngày nhận / Hạn</th>
                  <th className="py-3 px-3 text-center bg-slate-100">Trạng thái</th>
                  <th className="py-3 px-3 text-right w-24 bg-slate-100">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                      <span>Đang tải danh sách hồ sơ Đăng ký...</span>
                    </td>
                  </tr>
                ) : filterHook.paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <FileText size={28} className="mx-auto mb-2 text-slate-300" />
                      <span>Không tìm thấy hồ sơ Đăng ký nào phù hợp.</span>
                    </td>
                  </tr>
                ) : (
                  filterHook.paginatedRecords.map((record, index) => (
                    <RegistrationRecordRow
                      key={record.id}
                      record={record}
                      index={(filterHook.currentPage - 1) * filterHook.itemsPerPage + index}
                      isSelected={selectedIds.has(record.id)}
                      onToggleSelect={handleToggleSelect}
                      onViewDetail={handleViewDetail}
                      onEdit={handleViewDetail}
                      onDelete={handleDeleteRecord}
                      onAssign={() => {
                        setSelectedIds(new Set([record.id]));
                        setIsAssignOpen(true);
                      }}
                      employees={employees}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang tiêu chuẩn như module đo đạc */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Hiển thị từ{' '}
                <span className="font-bold text-slate-900">
                  {filterHook.filteredRecords.length > 0
                    ? (filterHook.currentPage - 1) * filterHook.itemsPerPage + 1
                    : 0}
                </span>{' '}
                đến{' '}
                <span className="font-bold text-slate-900">
                  {Math.min(
                    filterHook.currentPage * filterHook.itemsPerPage,
                    filterHook.filteredRecords.length
                  )}
                </span>{' '}
                trên tổng số{' '}
                <span className="font-bold text-blue-600">
                  {filterHook.filteredRecords.length}
                </span>{' '}
                hồ sơ
              </span>

              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-slate-500 font-medium">Số dòng/trang:</span>
                <select
                  value={filterHook.itemsPerPage}
                  onChange={(e) => {
                    filterHook.setItemsPerPage(Number(e.target.value));
                    filterHook.setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 shadow-2xs"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => filterHook.setCurrentPage(Math.max(filterHook.currentPage - 1, 1))}
                disabled={filterHook.currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Trang trước</span>
              </button>

              <span className="px-3 py-1.5 font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs">
                Trang {filterHook.currentPage} / {filterHook.totalPages}
              </span>

              <button
                type="button"
                onClick={() => filterHook.setCurrentPage(Math.min(filterHook.currentPage + 1, filterHook.totalPages))}
                disabled={filterHook.currentPage >= filterHook.totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>Trang sau</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RegistrationDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        record={viewingRecord}
        onSave={handleSaveRecord}
        employees={employees}
        currentUser={currentUser}
      />

      <RegistrationAssignModal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        selectedRecords={selectedRecordsList}
        employees={employees}
        onConfirmAssign={handleConfirmAssign}
      />
    </div>
  );
};
