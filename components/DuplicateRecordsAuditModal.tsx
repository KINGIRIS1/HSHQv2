import React, { useState, useMemo } from 'react';
import { RecordFile, Contract } from '../types';
import { X, Trash2, AlertTriangle, RefreshCw, CheckCircle, Database } from 'lucide-react';
import { deleteContractApi } from '../services/apiContracts';

interface DuplicateRecordsAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  contracts: Contract[];
  onDeleteRecord?: (id: string) => Promise<boolean>;
  onDeleteBatch?: (ids: string[]) => Promise<boolean>;
  onRefresh?: () => Promise<void>;
}

const DuplicateRecordsAuditModal: React.FC<DuplicateRecordsAuditModalProps> = ({
  isOpen,
  onClose,
  records = [],
  contracts = [],
  onDeleteRecord,
  onDeleteBatch,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'records' | 'contracts'>('records');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const duplicateRecordGroups = useMemo(() => {
    const groups: { [key: string]: RecordFile[] } = {};
    records.forEach(r => {
      if (r.code && r.code.trim()) {
        const code = r.code.trim().toUpperCase();
        if (!groups[code]) groups[code] = [];
        groups[code].push(r);
      }
    });
    return Object.entries(groups)
      .filter(([_, list]) => list.length > 1)
      .map(([code, list]) => ({ code, items: list }));
  }, [records]);

  const duplicateContractGroups = useMemo(() => {
    const groups: { [key: string]: Contract[] } = {};
    contracts.forEach(c => {
      if (c.code && c.code.trim()) {
        const code = c.code.trim().toUpperCase();
        if (!groups[code]) groups[code] = [];
        groups[code].push(c);
      }
    });
    return Object.entries(groups)
      .filter(([_, list]) => list.length > 1)
      .map(([code, list]) => ({ code, items: list }));
  }, [contracts]);

  if (!isOpen) return null;

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleDeleteRecordItem = async (id: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản sao hồ sơ có ID: ${id} (Mã: ${code}) không?`)) return;
    setLoading(true);
    try {
      let success = false;
      if (onDeleteRecord) {
        success = await onDeleteRecord(id);
      }
      if (success) {
        showStatus('success', `Đã xóa thành công hồ sơ trùng lặp có ID: ${id}`);
        if (onRefresh) await onRefresh();
      } else {
        showStatus('error', 'Không thể xóa hồ sơ trùng lặp.');
      }
    } catch (err: any) {
      console.error(err);
      showStatus('error', err.message || 'Lỗi khi xóa hồ sơ trùng lặp.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContractItem = async (id: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản sao hợp đồng mã: ${code} không?`)) return;
    setLoading(true);
    try {
      const success = await deleteContractApi(id);
      if (success) {
        showStatus('success', `Đã xóa thành công hợp đồng trùng lặp mã: ${code}`);
        if (onRefresh) await onRefresh();
      } else {
        showStatus('error', 'Không thể xóa hợp đồng.');
      }
    } catch (err: any) {
      console.error(err);
      showStatus('error', err.message || 'Lỗi khi xóa hợp đồng trùng lặp.');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanAllRecordDuplicates = async () => {
    if (duplicateRecordGroups.length === 0) return;
    if (!window.confirm(`Hệ thống sẽ giữ lại bản ghi có ID lớn nhất/nhỏ nhất và XÓA TOÀN BỘ các bản sao trùng lặp còn lại cho tất cả ${duplicateRecordGroups.length} nhóm. Bạn có chắc chắn muốn thực hiện dọn dẹp hàng loạt?`)) return;
    
    setLoading(true);
    let deletedCount = 0;
    try {
      const idsToDelete: string[] = [];
      duplicateRecordGroups.forEach(group => {
        // Sắp xếp theo thứ tự thời gian tạo hoặc giữ lại phần tử đầu tiên, xóa các phần tử sau
        const sorted = [...group.items];
        // Giữ lại phần tử thứ nhất, đưa các phần tử khác vào danh sách xóa
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].id) {
            idsToDelete.push(sorted[i].id!);
          }
        }
      });

      if (idsToDelete.length === 0) {
        showStatus('error', 'Không tìm thấy ID hợp lệ để xóa.');
        setLoading(false);
        return;
      }

      let success = false;
      if (onDeleteBatch) {
        success = await onDeleteBatch(idsToDelete);
      }
      if (success) {
        showStatus('success', `Đã dọn dẹp thành công ${idsToDelete.length} hồ sơ trùng lặp.`);
        if (onRefresh) await onRefresh();
      } else {
        showStatus('error', 'Dọn dẹp hàng loạt thất bại.');
      }
    } catch (err: any) {
      console.error(err);
      showStatus('error', err.message || 'Lỗi khi dọn dẹp hàng loạt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl flex flex-col max-h-[90vh] border border-slate-100 animate-scale-up">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Database size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Kiểm Tra Trùng Lặp Hệ Thống</h3>
              <p className="text-xs text-slate-500 font-medium">Phát hiện và xử lý hồ sơ/hợp đồng bị tạo trùng mã</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs & Toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hồ Sơ Trùng ({duplicateRecordGroups.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contracts')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'contracts'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hợp Đồng Trùng ({duplicateContractGroups.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'records' && duplicateRecordGroups.length > 0 && (
              <button
                type="button"
                onClick={handleCleanAllRecordDuplicates}
                disabled={loading}
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Trash2 size={14} /> Dọn dẹp hàng loạt
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-white rounded-lg transition-all cursor-pointer"
                title="Tải lại danh sách"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className={`mx-4 mt-3 p-3 rounded-lg border flex items-center gap-2.5 text-xs font-semibold animate-fade-in ${
            statusMsg.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-4 overflow-y-auto flex-1 min-h-[300px]">
          {activeTab === 'records' ? (
            duplicateRecordGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-green-50 text-green-600 rounded-full mb-3.5">
                  <CheckCircle size={32} />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Hệ Thống Sạch Sẽ</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">Không phát hiện bất kỳ mã hồ sơ tiếp nhận nào bị trùng lặp dữ liệu.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-2.5 text-xs font-medium">
                  <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={16} />
                  <div>
                    <span className="font-bold">Cảnh báo dữ liệu:</span> Phát hiện {duplicateRecordGroups.length} nhóm mã hồ sơ có nhiều hơn 1 bản ghi lưu trữ. Bạn có thể xóa bản sao dư thừa để tránh lỗi sai sót thông tin.
                  </div>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-2xs">
                  {duplicateRecordGroups.map(group => (
                    <div key={group.code} className="p-3.5 hover:bg-slate-50/50 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono text-xs font-bold rounded-md">
                          Mã: {group.code}
                        </span>
                        <span className="text-xs font-bold text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-sm">
                          {group.items.length} bản sao
                        </span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[10%]">ID</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[25%]">Khách hàng / Chủ sử dụng</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[20%]">Ngày nhận</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[15%]">Xã/Phường</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[20%]">Người tiếp nhận</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[10%] text-center">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.items.map((item, idx) => (
                              <tr key={item.id} className={idx === 0 ? "bg-indigo-50/20" : ""}>
                                <td className="px-2 py-1.5 text-slate-600 font-mono text-[10px]">{item.id}</td>
                                <td className="px-2 py-1.5 font-bold text-slate-800">{item.customerName || 'N/A'}</td>
                                <td className="px-2 py-1.5 text-slate-600">{item.receivedDate ? item.receivedDate.split('T')[0] : 'N/A'}</td>
                                <td className="px-2 py-1.5 text-slate-600">{item.ward || 'N/A'}</td>
                                <td className="px-2 py-1.5 text-slate-600 font-medium">{item.receivedBy || 'N/A'}</td>
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRecordItem(item.id!, item.code!)}
                                    disabled={loading}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                    title="Xóa bản sao này"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            duplicateContractGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-green-50 text-green-600 rounded-full mb-3.5">
                  <CheckCircle size={32} />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">Hợp Đồng Sạch Sẽ</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">Không phát hiện bất kỳ mã hợp đồng đo đạc nào bị tạo trùng lặp.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-2.5 text-xs font-medium">
                  <AlertTriangle className="shrink-0 text-amber-600 mt-0.5" size={16} />
                  <div>
                    <span className="font-bold">Cảnh báo dữ liệu:</span> Phát hiện {duplicateContractGroups.length} nhóm mã hợp đồng bị tạo trùng lặp trong hệ thống.
                  </div>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-2xs">
                  {duplicateContractGroups.map(group => (
                    <div key={group.code} className="p-3.5 hover:bg-slate-50/50 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono text-xs font-bold rounded-md">
                          Mã: {group.code}
                        </span>
                        <span className="text-xs font-bold text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-sm">
                          {group.items.length} bản sao
                        </span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[10%]">ID</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[25%]">Khách hàng</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[20%]">Ngày lập</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[15%]">Xã/Phường</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[20%]">Tổng số tiền</th>
                              <th className="px-2 py-1.5 font-bold text-slate-500 w-[10%] text-center">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.items.map((item, idx) => (
                              <tr key={item.id} className={idx === 0 ? "bg-indigo-50/20" : ""}>
                                <td className="px-2 py-1.5 text-slate-600 font-mono text-[10px]">{item.id}</td>
                                <td className="px-2 py-1.5 font-bold text-slate-800">{item.customerName || 'N/A'}</td>
                                <td className="px-2 py-1.5 text-slate-600">{item.createdDate ? item.createdDate.split('T')[0] : 'N/A'}</td>
                                <td className="px-2 py-1.5 text-slate-600">{item.ward || 'N/A'}</td>
                                <td className="px-2 py-1.5 font-bold text-slate-700">{item.totalAmount ? item.totalAmount.toLocaleString('vi-VN') + ' đ' : '0 đ'}</td>
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteContractItem(item.id!, item.code!)}
                                    disabled={loading}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                    title="Xóa bản sao hợp đồng này"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl bg-white hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateRecordsAuditModal;
