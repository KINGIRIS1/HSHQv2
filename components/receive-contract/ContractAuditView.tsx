import React, { useState, useMemo } from 'react';
import { Contract, RecordFile, User } from '../../types';
import { updateContractApi, deleteContractApi } from '../../services/api';
import { 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Copy, 
  Edit3, 
  FileText, 
  Filter, 
  RefreshCw, 
  Save, 
  Search, 
  ShieldAlert, 
  Trash2, 
  Wrench,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface ContractAuditViewProps {
  contracts: Contract[];
  records: RecordFile[];
  currentUser: User;
  onRefresh: () => Promise<void>;
}

export const ContractAuditView: React.FC<ContractAuditViewProps> = ({
  contracts,
  records,
  currentUser,
  onRefresh
}) => {
  const safeFormatISO = (dStr?: string) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const safeFormatLocale = (dStr?: string) => {
    if (!dStr) return '---';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return '---';
    try {
      return d.toLocaleDateString('vi-VN');
    } catch {
      return '---';
    }
  };

  const [activeTab, setActiveTab] = useState<'duplicates' | 'missing_dates' | 'quick_edit' | 'report'>('duplicates');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [autoFillDate, setAutoFillDate] = useState<string>(() => {
    try {
      return new Date().toISOString().split('T')[0];
    } catch {
      return '';
    }
  });
  
  const [selectedMissingDateIds, setSelectedMissingDateIds] = useState<string[]>([]);
  
  // PAGINATION STATES
  const [pageSize, setPageSize] = useState<number>(15);
  const [dupPage, setDupPage] = useState<number>(1);
  const [missingDatePage, setMissingDatePage] = useState<number>(1);
  const [quickEditPage, setQuickEditPage] = useState<number>(1);
  
  // Local state for batch editing
  const [editedContracts, setEditedContracts] = useState<{ [id: string]: Partial<Contract> }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [actionLogs, setActionLogs] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const addLog = (msg: string) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN');
    setActionLogs(prev => [`[${timeStr}] ${msg}`, ...prev]);
  };

  // 1. ANALYZE DUPLICATE CONTRACT CODES
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Contract[]>();
    contracts.forEach(c => {
      const codeClean = (c.code || '').trim().toLowerCase();
      if (!codeClean) return;
      if (!map.has(codeClean)) {
        map.set(codeClean, []);
      }
      map.get(codeClean)!.push(c);
    });

    const result: { code: string; items: Contract[] }[] = [];
    map.forEach((items, code) => {
      if (items.length > 1) {
        result.push({ code: items[0].code || code, items });
      }
    });

    return result.sort((a, b) => b.items.length - a.items.length);
  }, [contracts]);

  const totalDuplicateCount = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [duplicateGroups]);

  // 2. ANALYZE MISSING DATES
  const missingDateContracts = useMemo(() => {
    return contracts.filter(c => {
      if (!c.createdDate) return true;
      const d = new Date(c.createdDate);
      return isNaN(d.getTime());
    });
  }, [contracts]);

  // 3. FILTERED CONTRACTS FOR QUICK EDIT
  const filteredContractsForEdit = useMemo(() => {
    return contracts.filter(c => {
      if (selectedTypeFilter !== 'ALL' && c.contractType !== selectedTypeFilter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (c.code && c.code.toLowerCase().includes(term)) ||
        (c.customerName && c.customerName.toLowerCase().includes(term)) ||
        (c.customerAddress && c.customerAddress.toLowerCase().includes(term))
      );
    });
  }, [contracts, selectedTypeFilter, searchTerm]);

  // PAGINATED DATASETS
  const totalDupPages = Math.ceil(duplicateGroups.length / pageSize) || 1;
  const paginatedDuplicateGroups = useMemo(() => {
    const start = (dupPage - 1) * pageSize;
    return duplicateGroups.slice(start, start + pageSize);
  }, [duplicateGroups, dupPage, pageSize]);

  const totalMissingDatePages = Math.ceil(missingDateContracts.length / pageSize) || 1;
  const paginatedMissingDateContracts = useMemo(() => {
    const start = (missingDatePage - 1) * pageSize;
    return missingDateContracts.slice(start, start + pageSize);
  }, [missingDateContracts, missingDatePage, pageSize]);

  const totalQuickEditPages = Math.ceil(filteredContractsForEdit.length / pageSize) || 1;
  const paginatedContractsForEdit = useMemo(() => {
    const start = (quickEditPage - 1) * pageSize;
    return filteredContractsForEdit.slice(start, start + pageSize);
  }, [filteredContractsForEdit, quickEditPage, pageSize]);

  const renderPaginationBar = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (page: number) => void
  ) => {
    if (totalItems <= pageSize && totalPages <= 1) return null;
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl mt-3 text-xs text-slate-600 font-medium shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <span>Hiển thị <strong>{startItem}</strong> - <strong>{endItem}</strong> trong <strong>{totalItems}</strong> mục</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setDupPage(1);
              setMissingDatePage(1);
              setQuickEditPage(1);
            }}
            className="ml-2 px-2 py-1 border border-slate-200 rounded-lg text-xs bg-slate-50 font-semibold cursor-pointer focus:outline-none"
          >
            <option value={10}>10 / trang</option>
            <option value={15}>15 / trang</option>
            <option value={25}>25 / trang</option>
            <option value={50}>50 / trang</option>
            <option value={100}>100 / trang</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent font-semibold flex items-center gap-1 transition-all"
          >
            <ChevronLeft size={14} />
            <span>Trước</span>
          </button>

          <span className="px-3 py-1 bg-slate-100 rounded-lg font-bold text-slate-800">
            Trang {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent font-semibold flex items-center gap-1 transition-all"
          >
            <span>Sau</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  // HANDLE SINGLE CONTRACT FIELD CHANGE IN EDIT MODE
  const handleFieldChange = (id: string, field: keyof Contract, value: any) => {
    setEditedContracts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  // SAVE A SINGLE EDITED CONTRACT
  const handleSaveSingleContract = async (original: Contract) => {
    const updates = editedContracts[original.id];
    if (!updates || Object.keys(updates).length === 0) return;

    const updatedContract: Contract = {
      ...original,
      ...updates
    };

    setIsSaving(true);
    try {
      const success = await updateContractApi(updatedContract);
      if (success) {
        showToast(`Đã cập nhật hợp đồng ${updatedContract.code} thành công!`);
        addLog(`Đã cập nhật hợp đồng ID: ${updatedContract.id} (Số: ${updatedContract.code})`);
        
        // Remove from edited state
        setEditedContracts(prev => {
          const next = { ...prev };
          delete next[original.id];
          return next;
        });
        await onRefresh();
      } else {
        showToast(`Lỗi khi lưu hợp đồng ${updatedContract.code}`, 'error');
      }
    } catch (err: any) {
      showToast(`Lỗi: ${err.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // BATCH AUTO-FILL MISSING DATES
  const handleBatchFillDates = async () => {
    if (missingDateContracts.length === 0) {
      showToast('Không có hợp đồng nào bị thiếu ngày tháng!', 'info');
      return;
    }

    if (!await confirmAction(`Bạn có chắc chắn muốn điền ngày "${autoFillDate}" cho tất cả ${missingDateContracts.length} hợp đồng thiếu ngày?`)) {
      return;
    }

    setIsSaving(true);
    let count = 0;
    const targetISO = new Date(autoFillDate).toISOString();

    for (const c of missingDateContracts) {
      // Look up linked record if available to guess better date
      let guessedDate = targetISO;
      if (c.customerAddress) {
        const matchedRec = records.find(r => r.code && r.code.trim().toLowerCase() === c.customerAddress?.trim().toLowerCase());
        if (matchedRec && matchedRec.receivedDate) {
          guessedDate = matchedRec.receivedDate;
        }
      }

      const updated: Contract = {
        ...c,
        createdDate: guessedDate
      };

      try {
        const ok = await updateContractApi(updated);
        if (ok) count++;
      } catch (e) {
        console.error(e);
      }
    }

    setIsSaving(false);
    showToast(`Đã bổ sung ngày tháng thành công cho ${count}/${missingDateContracts.length} hợp đồng!`);
    addLog(`Đã tự động điền ngày tháng cho ${count} hợp đồng thiếu ngày.`);
    await onRefresh();
  };

  // BATCH FILL DATES FOR SELECTED CONTRACTS
  const handleBatchFillSelectedDates = async () => {
    if (selectedMissingDateIds.length === 0) {
      showToast('Vui lòng tích chọn ít nhất một hợp đồng!', 'info');
      return;
    }

    if (!autoFillDate) {
      showToast('Vui lòng chọn ngày để điền!', 'error');
      return;
    }

    const targets = missingDateContracts.filter(c => selectedMissingDateIds.includes(c.id));
    if (targets.length === 0) return;

    if (!await confirmAction(`Bạn có chắc chắn muốn điền ngày "${autoFillDate}" cho ${targets.length} hợp đồng đã chọn không?`)) {
      return;
    }

    setIsSaving(true);
    let count = 0;
    const targetISO = new Date(autoFillDate).toISOString();

    for (const c of targets) {
      const updated: Contract = {
        ...c,
        createdDate: targetISO
      };

      try {
        const ok = await updateContractApi(updated);
        if (ok) count++;
      } catch (e) {
        console.error(e);
      }
    }

    setIsSaving(false);
    setSelectedMissingDateIds([]);
    showToast(`Đã bổ sung ngày tháng thành công cho ${count}/${targets.length} hợp đồng đã chọn!`);
    addLog(`Đã điền ngày ${autoFillDate} cho ${count} hợp đồng được chọn.`);
    await onRefresh();
  };

  // AUTO RESOLVE DUPLICATE CODES
  const handleAutoFixDuplicatesGroup = async (groupCode: string, items: Contract[]) => {
    if (!await confirmAction(`Sẽ tự động đánh lại ký hiệu phụ (-01, -02...) cho ${items.length - 1} hợp đồng trùng số "${groupCode}"?`)) {
      return;
    }

    setIsSaving(true);
    let count = 0;
    // Keep first item as is, modify items from index 1 onwards
    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      const suffix = `-0${i}`;
      let newCode = item.code;
      if (item.code.includes('/')) {
        const parts = item.code.split('/');
        parts[0] = parts[0] + suffix;
        newCode = parts.join('/');
      } else {
        newCode = `${item.code}${suffix}`;
      }

      const updated: Contract = {
        ...item,
        code: newCode
      };

      try {
        const ok = await updateContractApi(updated);
        if (ok) count++;
      } catch (e) {
        console.error(e);
      }
    }

    setIsSaving(false);
    showToast(`Đã đánh lại số cho ${count} hợp đồng bị trùng mã!`);
    addLog(`Đã xử lý tự động phân tách số trùng cho nhóm ${groupCode}.`);
    await onRefresh();
  };

  // AUTO RESOLVE ALL DUPLICATES IN BULK
  const handleFixAllDuplicatesBulk = async () => {
    if (duplicateGroups.length === 0) {
      showToast('Không có mã hợp đồng nào bị trùng!', 'info');
      return;
    }

    if (!await confirmAction(`Bạn có chắc muốn tự động xử lý TẤT CẢ ${duplicateGroups.length} nhóm trùng mã hợp đồng (${totalDuplicateCount} bản ghi)?`)) {
      return;
    }

    setIsSaving(true);
    let totalFixed = 0;

    for (const group of duplicateGroups) {
      const items = group.items;
      for (let i = 1; i < items.length; i++) {
        const item = items[i];
        const suffix = `-0${i}`;
        let newCode = item.code;
        if (item.code.includes('/')) {
          const parts = item.code.split('/');
          parts[0] = parts[0] + suffix;
          newCode = parts.join('/');
        } else {
          newCode = `${item.code}${suffix}`;
        }

        const updated: Contract = {
          ...item,
          code: newCode
        };

        try {
          const ok = await updateContractApi(updated);
          if (ok) totalFixed++;
        } catch (e) {
          console.error(e);
        }
      }
    }

    setIsSaving(false);
    showToast(`Đã tự động xử lý và phân tách ${totalFixed} số hợp đồng trùng thành công!`);
    addLog(`Xử lý hàng loạt: Đã đánh lại mã cho ${totalFixed} hợp đồng bị trùng số.`);
    await onRefresh();
  };

  // DELETE A CONTRACT
  const handleDeleteContract = async (id: string, code: string) => {
    if (!await confirmAction(`Bạn có chắc chắn muốn XÓA hợp đồng số "${code}" không?`)) {
      return;
    }
    setIsSaving(true);
    try {
      const ok = await deleteContractApi(id);
      if (ok) {
        showToast(`Đã xóa hợp đồng ${code}!`);
        addLog(`Đã xóa hợp đồng ${code} (ID: ${id})`);
        await onRefresh();
      } else {
        showToast(`Lỗi khi xóa hợp đồng ${code}`, 'error');
      }
    } catch (e: any) {
      showToast(`Lỗi: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 rounded-xl gap-4 animate-fade-in">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 transition-all duration-300 ${
          toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          toastMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600" />}
          {toastMessage.type === 'error' && <AlertTriangle size={18} className="text-rose-600" />}
          {toastMessage.type === 'info' && <Info size={18} className="text-blue-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* HEADER DIAGNOSTIC STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số Hợp đồng</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{contracts.length}</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <FileText size={24} />
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-sm flex items-center justify-between transition-all ${
          duplicateGroups.length > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div>
            <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Hợp đồng trùng số</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-rose-700">{duplicateGroups.length}</span>
              <span className="text-xs text-rose-600 font-medium">({totalDuplicateCount} bản ghi)</span>
            </div>
          </div>
          <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
            <ShieldAlert size={24} />
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-sm flex items-center justify-between transition-all ${
          missingDateContracts.length > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200'
        }`}>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Thiếu ngày tháng</p>
            <p className="text-2xl font-black text-amber-700 mt-1">{missingDateContracts.length}</p>
          </div>
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
            <Calendar size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Tình trạng kiểm tra</p>
            <p className="text-sm font-bold text-slate-700 mt-1">
              {duplicateGroups.length === 0 && missingDateContracts.length === 0
                ? '✅ Tất cả hợp lệ'
                : `⚠️ Phát hiện ${duplicateGroups.length + (missingDateContracts.length > 0 ? 1 : 0)} vấn đề`}
            </p>
          </div>
          <button 
            onClick={onRefresh}
            disabled={isSaving}
            className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-all"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={20} className={isSaving ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* SEGMENTATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('duplicates')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'duplicates'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShieldAlert size={16} />
            <span>Xử lý Trùng số</span>
            {duplicateGroups.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-rose-200 text-rose-900 rounded-full font-black">
                {duplicateGroups.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('missing_dates')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'missing_dates'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calendar size={16} />
            <span>Bổ sung Ngày tháng</span>
            {missingDateContracts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-200 text-amber-900 rounded-full font-black">
                {missingDateContracts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('quick_edit')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'quick_edit'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Edit3 size={16} />
            <span>Sửa đổi Nhanh Trực tiếp</span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'report'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers size={16} />
            <span>Báo cáo & Nhật ký Lỗi</span>
          </button>
        </div>

        {/* BULK ACTION HEADERS */}
        {activeTab === 'duplicates' && duplicateGroups.length > 0 && (
          <button
            onClick={handleFixAllDuplicatesBulk}
            disabled={isSaving}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
          >
            <Wrench size={15} />
            <span>Tự động đánh lại số cho TẤT CẢ ({duplicateGroups.length} nhóm)</span>
          </button>
        )}

        {activeTab === 'missing_dates' && missingDateContracts.length > 0 && (
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 pl-2">Chọn ngày điền:</span>
            <input 
              type="date"
              value={autoFillDate}
              onChange={(e) => setAutoFillDate(e.target.value)}
              className="text-xs p-1.5 border border-slate-200 rounded-lg font-medium"
            />
            <button
              onClick={handleBatchFillSelectedDates}
              disabled={isSaving || selectedMissingDateIds.length === 0}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
              title="Điền ngày đã chọn cho các hợp đồng được tích chọn"
            >
              <CheckCircle2 size={14} />
              <span>Điền ngày cho HĐ đã chọn ({selectedMissingDateIds.length})</span>
            </button>
            <button
              onClick={handleBatchFillDates}
              disabled={isSaving}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
              title="Điền ngày tự động cho toàn bộ danh sách hợp đồng thiếu ngày"
            >
              <Sparkles size={14} />
              <span>Điền tất cả ({missingDateContracts.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: DUPLICATE CONTRACTS */}
      {activeTab === 'duplicates' && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 flex flex-col justify-between">
          {duplicateGroups.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <CheckCircle2 size={48} className="text-emerald-500 mb-3 animate-bounce" />
              <p className="text-base font-bold text-slate-800">Không có số hợp đồng nào bị trùng!</p>
              <p className="text-xs text-slate-500 mt-1">Hệ thống đang duy trì số hợp đồng duy nhất chính xác.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedDuplicateGroups.map((group, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden">
                  <div className="bg-rose-50/80 px-4 py-3 border-b border-rose-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-rose-600 text-white text-xs font-black rounded-lg">
                        Mã trùng: {group.code}
                      </span>
                      <span className="text-xs font-semibold text-rose-800">
                        Gồm {group.items.length} hợp đồng trùng mã
                      </span>
                    </div>
                    <button
                      onClick={() => handleAutoFixDuplicatesGroup(group.code, group.items)}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                    >
                      <Wrench size={14} />
                      <span>Tự động phân mã (-01, -02...)</span>
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.items.map((item, itemIdx) => {
                      const editedCode = editedContracts[item.id]?.code ?? item.code;
                      const hasChanged = editedContracts[item.id]?.code !== undefined && editedContracts[item.id]?.code !== item.code;

                      return (
                        <div key={item.id} className="p-3.5 hover:bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3 min-w-[240px] flex-1">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] ${
                              itemIdx === 0 ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {itemIdx + 1}
                            </span>
                            
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">{item.customerName || 'Chưa tên'}</span>
                                <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold">
                                  {item.contractType}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-3">
                                <span>Mã HS/Địa chỉ: <strong className="text-slate-700">{item.customerAddress || '---'}</strong></span>
                                <span>Ngày lập: <strong className="text-slate-700">{safeFormatLocale(item.createdDate)}</strong></span>
                                <span>Giá trị: <strong className="text-purple-700">{(item.totalAmount || 0).toLocaleString('vi-VN')} đ</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Fast Edit Input */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-semibold">Số HĐ:</span>
                            <input 
                              type="text"
                              value={editedCode}
                              onChange={(e) => handleFieldChange(item.id, 'code', e.target.value)}
                              className={`px-2.5 py-1 text-xs border rounded-lg font-bold w-44 transition-all ${
                                hasChanged ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-300 bg-white text-slate-800'
                              }`}
                            />

                            {hasChanged && (
                              <button
                                onClick={() => handleSaveSingleContract(item)}
                                disabled={isSaving}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1"
                                title="Lưu số mới"
                              >
                                <Save size={13} />
                                <span>Lưu</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteContract(item.id, item.code)}
                              disabled={isSaving}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Xóa hợp đồng rác"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {renderPaginationBar(dupPage, totalDupPages, duplicateGroups.length, setDupPage)}
        </div>
      )}

      {/* TAB CONTENT 2: MISSING DATES */}
      {activeTab === 'missing_dates' && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 flex flex-col justify-between">
          {missingDateContracts.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <CheckCircle2 size={48} className="text-emerald-500 mb-3 animate-bounce" />
              <p className="text-base font-bold text-slate-800">Tất cả hợp đồng đều đã có đầy đủ ngày tháng!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <input 
                    type="checkbox"
                    checked={paginatedMissingDateContracts.length > 0 && paginatedMissingDateContracts.every(c => selectedMissingDateIds.includes(c.id))}
                    onChange={(e) => {
                      const pageIds = paginatedMissingDateContracts.map(c => c.id);
                      if (e.target.checked) {
                        setSelectedMissingDateIds(prev => Array.from(new Set([...prev, ...pageIds])));
                      } else {
                        setSelectedMissingDateIds(prev => prev.filter(id => !pageIds.includes(id)));
                      }
                    }}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                    title="Chọn tất cả hợp đồng ở trang hiện tại"
                  />
                  <span className="text-xs font-bold text-amber-900">
                    Danh sách {missingDateContracts.length} Hợp đồng chưa có ngày lập
                    {selectedMissingDateIds.length > 0 && (
                      <span className="ml-2 text-purple-700 font-extrabold">(Đã chọn {selectedMissingDateIds.length})</span>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMissingDateIds.length === missingDateContracts.length) {
                        setSelectedMissingDateIds([]);
                      } else {
                        setSelectedMissingDateIds(missingDateContracts.map(c => c.id));
                      }
                    }}
                    className="text-xs text-purple-700 font-bold hover:underline"
                  >
                    {selectedMissingDateIds.length === missingDateContracts.length ? 'Bỏ chọn tất cả' : `Chọn toàn bộ (${missingDateContracts.length})`}
                  </button>
                  <span className="text-xs text-amber-700 hidden sm:inline">Tích chọn hợp đồng để điền đồng loạt</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {paginatedMissingDateContracts.map((c) => {
                  const rawDateVal = editedContracts[c.id]?.createdDate || '';
                  const displayDate = safeFormatISO(rawDateVal);
                  const isChecked = selectedMissingDateIds.includes(c.id);

                  return (
                    <div key={c.id} className={`p-3.5 hover:bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${isChecked ? 'bg-purple-50/60' : ''}`}>
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMissingDateIds(prev => [...prev, c.id]);
                            } else {
                              setSelectedMissingDateIds(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                        />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-purple-700 text-sm">{c.code || '---'}</span>
                            <span className="font-bold text-slate-800">{c.customerName || 'Chưa có tên'}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-semibold">{c.contractType}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            <span>Mã HS/Địa chỉ: <strong className="text-slate-700">{c.customerAddress || '---'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Bổ sung ngày:</span>
                        <input 
                          type="date"
                          value={displayDate}
                          onChange={(e) => handleFieldChange(c.id, 'createdDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg font-medium bg-white"
                        />
                        <button
                          onClick={() => handleSaveSingleContract(c)}
                          disabled={isSaving || !editedContracts[c.id]?.createdDate}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1"
                        >
                          <Save size={13} />
                          <span>Lưu ngày</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {renderPaginationBar(missingDatePage, totalMissingDatePages, missingDateContracts.length, setMissingDatePage)}
        </div>
      )}

      {/* TAB CONTENT 3: QUICK INLINE BATCH EDIT */}
      {activeTab === 'quick_edit' && (
        <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* TOOLBAR */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Tìm theo số HĐ, tên khách hàng, mã HS..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setQuickEditPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <select
                value={selectedTypeFilter}
                onChange={(e) => {
                  setSelectedTypeFilter(e.target.value);
                  setQuickEditPage(1);
                }}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl font-medium bg-white"
              >
                <option value="ALL">Tất cả loại HĐ</option>
                <option value="Đo đạc">Đo đạc</option>
                <option value="Cắm mốc">Cắm mốc</option>
                <option value="Trích lục">Trích lục</option>
                <option value="Tách thửa">Tách thửa</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-semibold">
              Tổng {filteredContractsForEdit.length} hợp đồng
            </span>
          </div>

          {/* EDIT TABLE */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-36">Số Hợp Đồng</th>
                  <th className="p-3 w-32">Ngày Lập</th>
                  <th className="p-3">Tên Khách Hàng</th>
                  <th className="p-3 w-40">Mã HS / Địa chỉ</th>
                  <th className="p-3 w-32">Loại HĐ</th>
                  <th className="p-3 w-32 text-right">Tổng Tiền</th>
                  <th className="p-3 w-24 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredContractsForEdit.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      Không tìm thấy hợp đồng nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  paginatedContractsForEdit.map((c) => {
                    const edits = editedContracts[c.id] || {};
                    const isEdited = Object.keys(edits).length > 0;

                    const codeVal = (edits.code !== undefined ? edits.code : c.code) || '';
                    const nameVal = (edits.customerName !== undefined ? edits.customerName : c.customerName) || '';
                    const addrVal = (edits.customerAddress !== undefined ? edits.customerAddress : c.customerAddress) || '';
                    const amountVal = edits.totalAmount !== undefined ? edits.totalAmount : c.totalAmount;
                    const dateVal = edits.createdDate !== undefined ? edits.createdDate : c.createdDate;
                    const dateFormatted = safeFormatISO(dateVal);

                    return (
                      <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${isEdited ? 'bg-purple-50/40' : ''}`}>
                        <td className="p-2">
                          <input 
                            type="text"
                            value={codeVal}
                            onChange={(e) => handleFieldChange(c.id, 'code', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-bold text-purple-700 focus:border-purple-500 focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="date"
                            value={dateFormatted}
                            onChange={(e) => handleFieldChange(c.id, 'createdDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
                            className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded font-medium focus:border-purple-500 focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text"
                            value={nameVal}
                            onChange={(e) => handleFieldChange(c.id, 'customerName', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-semibold text-slate-800 focus:border-purple-500 focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text"
                            value={addrVal}
                            onChange={(e) => handleFieldChange(c.id, 'customerAddress', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-medium text-slate-700 focus:border-purple-500 focus:bg-white"
                          />
                        </td>
                        <td className="p-2">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[11px] font-bold block text-center">
                            {c.contractType}
                          </span>
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            value={amountVal || 0}
                            onChange={(e) => handleFieldChange(c.id, 'totalAmount', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded text-right font-bold text-emerald-700 focus:border-purple-500 focus:bg-white"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isEdited && (
                              <button
                                onClick={() => handleSaveSingleContract(c)}
                                disabled={isSaving}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm"
                                title="Lưu thay đổi"
                              >
                                <Save size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteContract(c.id, c.code)}
                              disabled={isSaving}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Xóa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-2 border-t border-slate-200 bg-slate-50 shrink-0">
            {renderPaginationBar(quickEditPage, totalQuickEditPages, filteredContractsForEdit.length, setQuickEditPage)}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: REPORT & AUDIT LOG */}
      {activeTab === 'report' && (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Layers className="text-purple-600" size={18} />
              <span>Báo Cáo Phân Phối Trạng Thái Hợp Đồng</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                <span className="text-purple-600 font-semibold block mb-1">Loại HĐ Đo đạc</span>
                <span className="text-xl font-black text-purple-900">
                  {contracts.filter(c => c.contractType === 'Đo đạc').length}
                </span>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-blue-600 font-semibold block mb-1">Loại HĐ Cắm mốc</span>
                <span className="text-xl font-black text-blue-900">
                  {contracts.filter(c => c.contractType === 'Cắm mốc').length}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-emerald-600 font-semibold block mb-1">Loại HĐ Trích lục</span>
                <span className="text-xl font-black text-emerald-900">
                  {contracts.filter(c => c.contractType === 'Trích lục').length}
                </span>
              </div>

              <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                <span className="text-orange-600 font-semibold block mb-1">Đã thanh lý</span>
                <span className="text-xl font-black text-orange-900">
                  {contracts.filter(c => c.status === 'COMPLETED').length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Wrench className="text-indigo-600" size={18} />
              <span>Nhật Ký Thao Tác & Sửa Lỗi Hợp Đồng</span>
            </h3>

            {actionLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                Chưa có nhật ký sửa đổi trong phiên làm việc này.
              </p>
            ) : (
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-1.5 max-h-60 overflow-y-auto">
                {actionLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ArrowRight size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
