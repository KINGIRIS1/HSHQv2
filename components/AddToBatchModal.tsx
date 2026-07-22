
import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User, UserRole } from '../types';
import { X, Calendar, Plus, History, CheckCircle2, AlertTriangle, Map } from 'lucide-react';
import { fetchChinhLyRecords } from '../services/apiUtilities';
import { getWardLabel } from '../constants';

interface AddToBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batch: number, date: string, handoverWard?: string) => void;
  records: RecordFile[];
  selectedCount: number;
  targetRecords?: RecordFile[]; // Prop này quan trọng để kiểm tra warning
  wards?: string[];
  currentUser?: User | null;
}

const AddToBatchModal: React.FC<AddToBatchModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  records, 
  selectedCount,
  targetRecords = [], // Giá trị mặc định
  wards = [],
  currentUser
}) => {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');
  
  // State xác nhận danh sách chỉnh lý
  const [needsCorrectionConfirm, setNeedsCorrectionConfirm] = useState(false);
  
  const [selectedHandoverWard, setSelectedHandoverWard] = useState<string>('');

  // Reset modal state when opened
  useEffect(() => {
      if (isOpen) {
          setSelectedHandoverWard('');
          setNeedsCorrectionConfirm(false);
          setMode('new');
      }
  }, [isOpen]);

  // State danh sách cảnh báo thực tế (đã lọc qua logic kiểm tra bảng chỉnh lý)
  const [filteredWarningList, setFilteredWarningList] = useState<RecordFile[]>([]);

  // Ngày hiện tại cho đợt mới
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
      // Logic kiểm tra xem hồ sơ nào cần chỉnh lý NHƯNG chưa có trong danh sách đã chuyển ('sent')
      const checkWarnings = async () => {
          if (!isOpen || targetRecords.length === 0) {
              setFilteredWarningList([]);
              return;
          }

          // Lấy tất cả hồ sơ có cờ needsMapCorrection = true
          const potentialWarnings = targetRecords.filter(r => r.needsMapCorrection);
          
          if (potentialWarnings.length === 0) {
              setFilteredWarningList([]);
              return;
          }

          // Fetch danh sách chỉnh lý từ DB
          const chinhLyRecords = await fetchChinhLyRecords();
          
          // Lọc ra danh sách thực sự cần cảnh báo
          // Điều kiện: Có cờ 'needsMapCorrection' VÀ (không tìm thấy trong bảng chỉnh lý HOẶC tìm thấy nhưng status != 'sent')
          const realWarnings = potentialWarnings.filter(r => {
              // Tìm record tương ứng trong bảng chỉnh lý (dựa vào SO_HD == r.code)
              const correctionEntry = chinhLyRecords.find(c => c.data.SO_HD === r.code);
              
              // Nếu đã chuyển ('sent') thì KHÔNG cần cảnh báo -> return false
              if (correctionEntry && correctionEntry.data.STATUS === 'sent') {
                  return false;
              }
              // Ngược lại (chưa có hoặc đang 'pending') -> Cần cảnh báo -> return true
              return true;
          });

          setFilteredWarningList(realWarnings);
      };

      checkWarnings();
  }, [isOpen, targetRecords]);

  const nextBatchInfo = useMemo(() => {
      let maxBatch = 0;
      records.forEach(r => {
          if (r.exportBatch && r.exportDate && r.exportDate.startsWith(todayStr)) {
              if (r.exportBatch > maxBatch) maxBatch = r.exportBatch;
          }
      });
      return {
          batch: maxBatch + 1,
          date: new Date().toISOString() // Dùng ISO đầy đủ cho chính xác
      };
  }, [records, todayStr]);

  const historyBatches = useMemo(() => {
      const batches: Record<string, { date: string, batch: number, count: number, fullDate: string }> = {};
      
      records.forEach(r => {
          if ((r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED) && r.exportBatch && r.exportDate) {
              const datePart = r.exportDate.split('T')[0];
              const key = `${datePart}_${r.exportBatch}`;
              
              if (!batches[key]) {
                  batches[key] = { 
                      date: datePart, 
                      batch: r.exportBatch, 
                      count: 0,
                      fullDate: r.exportDate 
                  };
              }
              batches[key].count++;
          }
      });

      return Object.values(batches).sort((a, b) => {
          const dateDiff = b.date.localeCompare(a.date);
          if (dateDiff !== 0) return dateDiff;
          return b.batch - a.batch;
      });
  }, [records]);

  useEffect(() => {
      if (mode === 'existing' && historyBatches.length > 0 && !selectedExistingBatch) {
          const first = historyBatches[0];
          setSelectedExistingBatch(`${first.date}_${first.batch}`);
      }
  }, [mode, historyBatches]);

  if (!isOpen) return null;

  const handleConfirm = () => {
      // Logic chặn nếu có cảnh báo chưa xác nhận
      if (filteredWarningList.length > 0 && !needsCorrectionConfirm) {
          alert("Vui lòng xác nhận bạn đã lập danh sách chỉnh lý cho các hồ sơ được cảnh báo.");
          return;
      }

      if (!selectedHandoverWard) {
          alert("Vui lòng chọn xã nhận kết quả.");
          return;
      }

      const handoverWard = selectedHandoverWard;

      if (mode === 'new') {
          onConfirm(nextBatchInfo.batch, nextBatchInfo.date, handoverWard);
      } else {
          if (!selectedExistingBatch) {
              alert('Vui lòng chọn một đợt cũ.');
              return;
          }
          const [datePart, batchNumStr] = selectedExistingBatch.split('_');
          const batchNum = parseInt(batchNumStr);
          const found = historyBatches.find(h => h.date === datePart && h.batch === batchNum);
          
          if (found) {
              onConfirm(found.batch, found.fullDate, handoverWard);
          }
      }
      setNeedsCorrectionConfirm(false); // Reset
      setSelectedHandoverWard('');
      onClose();
  };

  const formatDate = (d: string) => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">Chốt Danh Sách Giao 1 Cửa</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 mb-2">
                Bạn đang thực hiện chốt <strong>{selectedCount > 0 ? selectedCount : 'toàn bộ'}</strong> hồ sơ sang trạng thái "Đã giao".
            </p>

            {/* CẢNH BÁO CHỈNH LÝ BẢN ĐỒ (CHỈ HIỆN KHI CÓ HỒ SƠ CHƯA CHUYỂN LIST) */}
            {filteredWarningList.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 animate-pulse">
                    <div className="flex items-center gap-2 text-orange-700 font-bold text-sm mb-2">
                        <AlertTriangle size={18} /> CẢNH BÁO: CÓ HỒ SƠ CẦN CHỈNH LÝ
                    </div>
                    <p className="text-xs text-orange-800 mb-2">
                        Có <strong>{filteredWarningList.length}</strong> hồ sơ cần chỉnh lý bản đồ nhưng chưa có trong danh sách "Đã chuyển":
                    </p>
                    <ul className="list-disc list-inside text-xs text-orange-800 font-mono mb-3 max-h-20 overflow-y-auto bg-orange-100/50 p-2 rounded">
                        {filteredWarningList.map(r => (
                            <li key={r.id} className="flex items-center gap-2">
                                <Map size={10} /> {r.code} - {r.customerName}
                            </li>
                        ))}
                    </ul>
                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-orange-200 hover:border-orange-400 transition-colors">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                            checked={needsCorrectionConfirm}
                            onChange={(e) => setNeedsCorrectionConfirm(e.target.checked)}
                        />
                        <span className="text-xs font-bold text-gray-700">Tôi xác nhận đã kiểm tra / lập danh sách.</span>
                    </label>
                </div>
            )}

            {/* Option 1: New Batch */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'new' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'new'} 
                    onChange={() => setMode('new')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                        <Plus size={16} className="text-blue-600" /> Tạo đợt mới (Hôm nay)
                    </div>
                    <div className="text-sm text-gray-600 mt-1 pl-6">
                        Đợt tiếp theo: <span className="font-bold text-blue-700">Đợt {nextBatchInfo.batch}</span>
                        <br/>
                        <span className="text-xs text-gray-500">Ngày: {formatDate(todayStr)}</span>
                    </div>
                </div>
            </label>

            {/* Option 2: Existing Batch */}
            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'existing' ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'existing'} 
                    onChange={() => setMode('existing')}
                    className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                        <History size={16} className="text-green-600" /> Thêm vào đợt cũ
                    </div>
                    
                    <div className="mt-2 pl-6">
                        <select 
                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={mode !== 'existing'}
                            value={selectedExistingBatch}
                            onChange={(e) => setSelectedExistingBatch(e.target.value)}
                        >
                            {historyBatches.length > 0 ? (
                                historyBatches.map(h => (
                                    <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                        Đợt {h.batch} - Ngày {formatDate(h.date)} (Đã có {h.count} HS)
                                    </option>
                                ))
                            ) : (
                                <option value="">Chưa có đợt nào</option>
                            )}
                        </select>
                    </div>
                </div>
            </label>

            {/* Xã nhận kết quả */}
            <div className="mt-4 border-t pt-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                    Xã nhận kết quả <span className="text-red-500">*</span>
                </label>
                <select 
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium bg-white"
                    value={selectedHandoverWard}
                    onChange={(e) => setSelectedHandoverWard(e.target.value)}
                >
                    <option value="">-- Chọn xã/phường nhận kết quả --</option>
                    {wards.map(w => (
                        <option key={w} value={w}>{getWardLabel(w)}</option>
                    ))}
                </select>
            </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                Hủy bỏ
            </button>
            <button 
                onClick={handleConfirm} 
                disabled={filteredWarningList.length > 0 && !needsCorrectionConfirm}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <CheckCircle2 size={16} /> Xác nhận chốt
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddToBatchModal;
