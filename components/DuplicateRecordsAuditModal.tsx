import React, { useState, useMemo } from 'react';
import { RecordFile, Contract } from '../types';
import { X, AlertTriangle, Trash2, CheckCircle, RefreshCw, Search, CheckSquare, Square, Eye, ShieldAlert, Loader2, Filter, Layers } from 'lucide-react';
import { removeVietnameseTones, confirmAction } from '../utils/appHelpers';

interface DuplicateRecordsAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  contracts?: Contract[];
  onDeleteRecord?: (id: string) => Promise<boolean>;
  onDeleteBatch?: (ids: string[]) => Promise<boolean>;
  onRefresh?: () => Promise<void> | void;
}

interface DuplicateGroup {
  id: string;
  type: 'code' | 'plot_sheet' | 'customer_info';
  title: string;
  description: string;
  records: RecordFile[];
}

const normalize = (str: string | null | undefined): string => {
  if (!str) return '';
  return removeVietnameseTones(str).trim().toLowerCase();
};

const DuplicateRecordsAuditModal: React.FC<DuplicateRecordsAuditModalProps> = ({
  isOpen,
  onClose,
  records,
  contracts = [],
  onDeleteRecord,
  onDeleteBatch,
  onRefresh
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'records' | 'contracts'>('records');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Group duplicate records
  const duplicateRecordGroups = useMemo<DuplicateGroup[]>(() => {
    if (!records || records.length === 0) return [];

    const groups: DuplicateGroup[] = [];

    // 1. Duplicate by exact Code
    const codeMap = new Map<string, RecordFile[]>();
    records.forEach(r => {
      const code = normalize(r.code);
      if (code) {
        if (!codeMap.has(code)) codeMap.set(code, []);
        codeMap.get(code)!.push(r);
      }
    });

    codeMap.forEach((list, code) => {
      if (list.length > 1) {
        groups.push({
          id: `code_${code}`,
          type: 'code',
          title: `Trùng mã hồ sơ: ${list[0].code}`,
          description: `Phát hiện ${list.length} hồ sơ có cùng mã số "${list[0].code}"`,
          records: list
        });
      }
    });

    // 2. Duplicate by Plot + Sheet + Ward
    const plotSheetMap = new Map<string, RecordFile[]>();
    records.forEach(r => {
      const plot = normalize(r.landPlot);
      const sheet = normalize(r.mapSheet);
      const ward = normalize(r.ward);
      if (plot && sheet && ward) {
        const key = `${ward}__${sheet}__${plot}`;
        if (!plotSheetMap.has(key)) plotSheetMap.set(key, []);
        plotSheetMap.get(key)!.push(r);
      }
    });

    plotSheetMap.forEach((list, key) => {
      // Only consider if not already caught entirely in the same code group and has same or similar customer
      if (list.length > 1) {
        const uniqueCodes = new Set(list.map(r => r.code));
        if (uniqueCodes.size > 1) {
          const first = list[0];
          groups.push({
            id: `plot_${key}`,
            type: 'plot_sheet',
            title: `Trùng vị trí: Thửa ${first.landPlot}, Tờ ${first.mapSheet} (${first.ward || ''})`,
            description: `Có ${list.length} hồ sơ cùng vị trí thửa đất (${first.ward || ''})`,
            records: list
          });
        }
      }
    });

    return groups;
  }, [records]);

  // Duplicate contracts
  const duplicateContractGroups = useMemo(() => {
    if (!contracts || contracts.length === 0) return [];
    const codeMap = new Map<string, Contract[]>();
    contracts.forEach(c => {
      const code = normalize(c.code);
      if (code) {
        if (!codeMap.has(code)) codeMap.set(code, []);
        codeMap.get(code)!.push(c);
      }
    });

    const list: { code: string; contracts: Contract[] }[] = [];
    codeMap.forEach((items, code) => {
      if (items.length > 1) {
        list.push({ code: items[0].code, contracts: items });
      }
    });
    return list;
  }, [contracts]);

  // Filter groups
  const filteredRecordGroups = useMemo(() => {
    if (!searchTerm.trim()) return duplicateRecordGroups;
    const term = normalize(searchTerm);
    return duplicateRecordGroups.filter(g =>
      normalize(g.title).includes(term) ||
      normalize(g.description).includes(term) ||
      g.records.some(r =>
        normalize(r.code).includes(term) ||
        normalize(r.customerName).includes(term) ||
        normalize(r.ward).includes(term)
      )
    );
  }, [duplicateRecordGroups, searchTerm]);

  // Auto-select duplicate candidates (keeps the most complete / most recent one in each group)
  const handleAutoSelectDuplicates = () => {
    const newSelected = new Set<string>();
    duplicateRecordGroups.forEach(group => {
      // Sort: keep record with highest data fullness or most recent updated/received date
      const sorted = [...group.records].sort((a, b) => {
        const dateA = a.updatedAt || a.receivedDate || '';
        const dateB = b.updatedAt || b.receivedDate || '';
        return dateB.localeCompare(dateA);
      });
      // Keep sorted[0], select sorted[1..n] for removal
      for (let i = 1; i < sorted.length; i++) {
        newSelected.add(sorted[i].id);
      }
    });
    setSelectedIds(newSelected);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllInGroup = (group: DuplicateGroup) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = group.records.every(r => next.has(r.id));
      if (allSelected) {
        group.records.forEach(r => next.delete(r.id));
      } else {
        group.records.forEach(r => next.add(r.id));
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmed = await confirmAction(
      `Bạn có chắc chắn muốn xóa ${count} hồ sơ trùng lặp đã chọn? Thao tác này không thể hoàn tác!`,
      'Xác nhận xóa hồ sơ trùng'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setSuccessMsg(null);
    try {
      const idsToDelete = Array.from(selectedIds);
      if (onDeleteBatch) {
        await onDeleteBatch(idsToDelete);
      } else if (onDeleteRecord) {
        for (const id of idsToDelete) {
          await onDeleteRecord(id);
        }
      }
      setSelectedIds(new Set());
      setSuccessMsg(`Đã xóa thành công ${count} hồ sơ trùng lặp!`);
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Lỗi xóa hồ sơ trùng lặp:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-3 md:p-6 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-200">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Kiểm Tra & Xử Lý Hồ Sơ Trùng Lặp
                {duplicateRecordGroups.length > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">
                    {duplicateRecordGroups.length} nhóm trùng
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-600">
                Tự động quét và phát hiện các hồ sơ có cùng mã số, vị trí thửa đất hoặc thông tin tiếp nhận
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm mã hồ sơ, tên khách hàng, xã..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoSelectDuplicates}
              className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg border border-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Tự động giữ lại 1 bản ghi mới nhất và chọn các bản sao cũ hơn để xóa"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Tự động chọn bản sao</span>
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Xóa {selectedIds.size} hồ sơ đã chọn</span>
              </button>
            )}

            {onRefresh && (
              <button
                onClick={() => onRefresh()}
                className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                title="Tải lại dữ liệu"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Notification message */}
        {successMsg && (
          <div className="mx-6 mt-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2 animate-fade-in shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredRecordGroups.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-800">Không tìm thấy hồ sơ trùng lặp nào</h3>
              <p className="text-xs text-gray-500 max-w-md mt-1">
                Toàn bộ cơ sở dữ liệu hồ sơ hiện tại đều chuẩn xác, không bị trùng mã hồ sơ hoặc số thửa tờ bản đồ.
              </p>
            </div>
          ) : (
            filteredRecordGroups.map((group, groupIdx) => {
              const allInGroupSelected = group.records.every(r => selectedIds.has(r.id));
              return (
                <div
                  key={group.id || groupIdx}
                  className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden transition-all hover:border-amber-300"
                >
                  <div className="px-4 py-3 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => handleSelectAllInGroup(group)}
                        className="text-gray-500 hover:text-gray-800 cursor-pointer"
                      >
                        {allInGroupSelected ? (
                          <CheckSquare className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                          {group.title}
                          <span className="text-[10px] px-2 py-0.5 font-medium rounded-full bg-amber-100 text-amber-800">
                            {group.records.length} bản ghi
                          </span>
                        </h4>
                        <p className="text-[11px] text-gray-500">{group.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {group.records.map((rec, rIdx) => {
                      const isSelected = selectedIds.has(rec.id);
                      return (
                        <div
                          key={rec.id || rIdx}
                          className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs transition-colors ${
                            isSelected ? 'bg-amber-50/60' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(rec.id)}
                              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                              <div>
                                <span className="font-bold text-gray-900 block truncate">{rec.code}</span>
                                <span className="text-[11px] text-gray-500 block truncate">{rec.customerName}</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-gray-700 block">
                                  Thửa: <span className="font-semibold">{rec.landPlot || '—'}</span> / Tờ:{' '}
                                  <span className="font-semibold">{rec.mapSheet || '—'}</span>
                                </span>
                                <span className="text-[11px] text-gray-500 block truncate">{rec.ward || '—'}</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-gray-700 block">
                                  Tiếp nhận:{' '}
                                  <span className="font-medium">
                                    {rec.receivedDate ? rec.receivedDate.split('T')[0] : '—'}
                                  </span>
                                </span>
                                <span className="text-[11px] text-gray-500 block">
                                  Trạng thái: <span className="font-medium">{rec.status}</span>
                                </span>
                              </div>
                              <div className="text-right flex items-center justify-end gap-1.5">
                                {onDeleteRecord && (
                                  <button
                                    onClick={async () => {
                                      const ok = await confirmAction(
                                        `Bạn có chắc chắn muốn xóa hồ sơ ${rec.code} này?`,
                                        'Xác nhận'
                                      );
                                      if (ok) {
                                        await onDeleteRecord(rec.id);
                                        if (onRefresh) await onRefresh();
                                      }
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                    title="Xóa bản ghi này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">
            Tổng số hồ sơ trong hệ thống: <span className="font-bold text-gray-800">{records.length}</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateRecordsAuditModal;
