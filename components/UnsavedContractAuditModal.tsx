import React, { useState, useEffect } from 'react';
import { getHDKTHistory } from '../services/apiSystem';
import { createContractApi, createContractBatchApi } from '../services/apiContracts';
import { Contract, User } from '../types';
import { X, AlertTriangle, CheckCircle2, RefreshCw, Hash, Calendar, User as UserIcon, PlusCircle, Layers } from 'lucide-react';

interface UnsavedContractAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  contracts: Contract[];
  currentUser: User;
  onRefreshContracts: () => void;
  onSelectCodeToCreate: (code: string, note?: string, date?: string) => void;
}

export const UnsavedContractAuditModal: React.FC<UnsavedContractAuditModalProps> = ({
  isOpen,
  onClose,
  contracts,
  currentUser,
  onRefreshContracts,
  onSelectCodeToCreate,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAuditData();
      setSyncMessage(null);
    }
  }, [isOpen, selectedYear, contracts]);

  const loadAuditData = async () => {
    setLoading(true);
    try {
      const hist = await getHDKTHistory(selectedYear);
      setHistoryItems(hist || []);
    } catch (e) {
      console.error("Lỗi khi tải lịch sử cấp số:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Lọc các số hợp đồng đã cấp nhưng chưa có trong bảng contracts
  const missingNumbers = historyItems.filter(item => {
    if (!item.code) return false;
    const norm = item.code.trim().toLowerCase();
    return !contracts.some(c => c.code && c.code.trim().toLowerCase() === norm);
  });

  const handleSyncSingle = async (item: any) => {
    try {
      const newContract: Contract = {
        id: Math.random().toString(36).substr(2, 9),
        code: item.code,
        customerName: item.note || 'Khách hàng chưa cập nhật (Đã lấy số)',
        phoneNumber: '',
        address: '',
        ward: '',
        landPlot: '',
        mapSheet: '',
        area: 0,
        contractType: 'Đo đạc',
        serviceType: 'Trích đo chỉnh lý bản đồ địa chính',
        areaType: 'Đất nông thôn',
        plotCount: 1,
        markerCount: 1,
        quantity: 1,
        unitPrice: 0,
        vatRate: 8,
        vatAmount: 0,
        totalAmount: 0,
        deposit: 0,
        content: `Khôi phục tự động từ số đã cấp ngày ${item.date ? new Date(item.date).toLocaleDateString('vi-VN') : ''} bởi ${item.by || ''}`,
        createdDate: item.date || new Date().toISOString(),
        status: 'PENDING'
      };

      await createContractApi(newContract);
      onRefreshContracts();
      setSyncMessage(`Đã đồng bộ thành công số hợp đồng ${item.code} vào danh sách!`);
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi đồng bộ hợp đồng.");
    }
  };

  const handleSyncAll = async () => {
    if (missingNumbers.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn tự động tạo ${missingNumbers.length} hợp đồng nháp cho toàn bộ các số bị khuyết vào cơ sở dữ liệu?`)) {
      return;
    }

    setSyncing(true);
    try {
      const batchList: Contract[] = missingNumbers.map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        code: item.code,
        customerName: item.note || 'Khách hàng chưa cập nhật (Đã lấy số)',
        phoneNumber: '',
        address: '',
        ward: '',
        landPlot: '',
        mapSheet: '',
        area: 0,
        contractType: 'Đo đạc',
        serviceType: 'Trích đo chỉnh lý bản đồ địa chính',
        areaType: 'Đất nông thôn',
        plotCount: 1,
        markerCount: 1,
        quantity: 1,
        unitPrice: 0,
        vatRate: 8,
        vatAmount: 0,
        totalAmount: 0,
        deposit: 0,
        content: `Khôi phục tự động từ lịch sử cấp số`,
        createdDate: item.date || new Date().toISOString(),
        status: 'PENDING'
      }));

      const res = await createContractBatchApi(batchList);
      onRefreshContracts();
      setSyncMessage(`Đã đồng bộ tức thì ${res.count}/${missingNumbers.length} hợp đồng bị khuyết vào Supabase Database!`);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi đồng bộ hàng loạt.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-fade-in-up">
        
        {/* HEADER */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
              <AlertTriangle size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Kiểm Tra Hợp Đồng Đã Cấp Số Nhưng Chưa Lưu</h3>
              <p className="text-xs text-slate-500">
                Đối soát giữa Lịch sử cấp số và Danh sách Hợp đồng trên Cơ sở dữ liệu
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* STATS & YEAR BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Năm kiểm tra:</span>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-white border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-sm focus:ring-2 focus:ring-amber-300 outline-hidden"
              >
                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button 
                onClick={loadAuditData}
                disabled={loading}
                className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors ml-1"
                title="Làm mới đối soát"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg">
                Đã cấp: <span className="font-bold text-sm">{historyItems.length}</span> số
              </div>
              <div className={`px-3 py-1.5 border rounded-lg ${missingNumbers.length > 0 ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}>
                Chưa lưu vào DB: <span className="font-bold text-sm">{missingNumbers.length}</span> số
              </div>
            </div>
          </div>

          {syncMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              {syncMessage}
            </div>
          )}

          {/* MAIN ACTIONS */}
          {missingNumbers.length > 0 && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
              <div>
                <h4 className="text-sm font-bold text-amber-900">Phát hiện {missingNumbers.length} số hợp đồng chưa có bản ghi trong Danh sách</h4>
                <p className="text-xs text-amber-700 mt-0.5">Bạn có thể chọn điền thông tin từng số hoặc tự động khôi phục toàn bộ vào cơ sở dữ liệu.</p>
              </div>
              <button 
                onClick={handleSyncAll}
                disabled={syncing}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Đang đồng bộ...
                  </>
                ) : (
                  <>
                    <Layers size={14} /> Đồng bộ TẤT CẢ vào Database
                  </>
                )}
              </button>
            </div>
          )}

          {/* MISSING LIST TABLE */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Danh Sách Số Hợp Đồng Chưa Lưu ({missingNumbers.length})
              </span>
            </div>

            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <th className="py-2.5 px-4">Số Hợp Đồng</th>
                    <th className="py-2.5 px-4">Ngày Cấp</th>
                    <th className="py-2.5 px-4">Cán Bộ Lấy Số</th>
                    <th className="py-2.5 px-4">Ghi Chú Ban Đầu</th>
                    <th className="py-2.5 px-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {missingNumbers.map((item, idx) => (
                    <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-purple-700 flex items-center gap-1.5">
                        <Hash size={14} className="text-purple-400" />
                        {item.code}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {item.date ? new Date(item.date).toLocaleDateString('vi-VN') : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        <div className="flex items-center gap-1">
                          <UserIcon size={12} className="text-slate-400" />
                          {item.by || 'Không xác định'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={item.note}>
                        {item.note || <span className="text-slate-300 italic">Chưa ghi chú</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              onSelectCodeToCreate(item.code, item.note, item.date);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold rounded-lg text-[11px] transition-colors flex items-center gap-1"
                            title="Mở Form điền thông tin"
                          >
                            <PlusCircle size={13} /> Lập HĐ
                          </button>
                          <button
                            onClick={() => handleSyncSingle(item)}
                            className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-lg text-[11px] transition-colors"
                            title="Đồng bộ nhanh bản ghi này vào CSDL"
                          >
                            Lưu nhanh
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {missingNumbers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 size={36} className="text-emerald-500" />
                          <p className="font-semibold text-slate-600">Tuyệt vời! Toàn bộ số hợp đồng đã lấy trong năm {selectedYear} đều đã được lưu đầy đủ vào Cơ sở dữ liệu.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button 
            onClick={onClose} 
            className="px-5 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 text-sm transition-all shadow-xs"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
