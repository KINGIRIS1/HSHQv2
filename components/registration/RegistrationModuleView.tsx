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

  // Danh sách hồ sơ đang được chọn
  const selectedRecordsList = records.filter((r) => selectedIds.has(r.id));

  // Thống kê nhanh theo sub-tabs
  const stats = {
    all: records.length,
    unassigned: records.filter((r) => !r.assignedTo || r.status === RecordStatus.RECEIVED).length,
    processing: records.filter((r) => r.status === RecordStatus.IN_PROGRESS || r.status === RecordStatus.ASSIGNED).length,
    pending_check: records.filter((r) => r.status === RecordStatus.PENDING_CHECK).length,
    pending_sign: records.filter((r) => r.status === RecordStatus.PENDING_SIGN).length,
    signed: records.filter((r) => r.status === RecordStatus.SIGNED).length,
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
          { id: 'processing', label: 'Đang xử lý', count: stats.processing },
          { id: 'pending_check', label: 'Chờ kiểm tra', count: stats.pending_check },
          { id: 'pending_sign', label: 'Chờ ký duyệt', count: stats.pending_sign },
          { id: 'signed', label: 'Đã ký duyệt', count: stats.signed },
          { id: 'handed_over', label: 'Đã bàn giao', count: stats.handed_over },
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

      {/* Bộ lọc Tìm kiếm & Phân loại */}
      <div className="p-6 space-y-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={filterHook.searchTerm}
                onChange={(e) => filterHook.setSearchTerm(e.target.value)}
                placeholder="Tìm mã hồ sơ, chủ sử dụng, số thửa, tờ bản đồ, SĐT..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              {filterHook.searchTerm && (
                <button
                  type="button"
                  onClick={() => filterHook.setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Xã / Phường */}
            <div>
              <select
                value={filterHook.selectedWard}
                onChange={(e) => filterHook.setSelectedWard(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
              >
                <option value="all">-- Tất cả Xã / Phường --</option>
                {filterHook.availableWards.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Trạng thái */}
            <div>
              <select
                value={filterHook.selectedStatus}
                onChange={(e) => filterHook.setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
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
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Tìm thấy <strong className="text-blue-700">{filterHook.filteredRecords.length}</strong> / {records.length} hồ sơ
            </span>
            <button
              type="button"
              onClick={filterHook.resetFilters}
              className="text-slate-500 hover:text-blue-700 font-semibold cursor-pointer"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-10">
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
                  <th className="py-3 px-2 text-center w-12">STT</th>
                  <th className="py-3 px-3">Mã hồ sơ</th>
                  <th className="py-3 px-3">Chủ sử dụng</th>
                  <th className="py-3 px-3">Xã / Phường</th>
                  <th className="py-3 px-3 text-center">Thửa / Tờ</th>
                  <th className="py-3 px-3">Nội dung</th>
                  <th className="py-3 px-3">Cán bộ thụ lý</th>
                  <th className="py-3 px-3">Ngày nhận / Hạn</th>
                  <th className="py-3 px-3 text-center">Trạng thái</th>
                  <th className="py-3 px-3 text-right w-24">Thao tác</th>
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

          {/* Phân trang */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <span>
              Trang <strong>{filterHook.currentPage}</strong> / {filterHook.totalPages} (Tổng cộng{' '}
              {filterHook.filteredRecords.length} hồ sơ)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={filterHook.currentPage <= 1}
                onClick={() => filterHook.setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={filterHook.currentPage >= filterHook.totalPages}
                onClick={() => filterHook.setCurrentPage((p) => Math.min(filterHook.totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
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
