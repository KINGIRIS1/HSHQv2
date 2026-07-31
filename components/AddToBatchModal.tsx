import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User } from '../types';
import { X, Plus, History, CheckCircle2, AlertTriangle, Map } from 'lucide-react';
import { fetchChinhLyRecords } from '../services/apiUtilities';
import { getWardLabel } from '../constants';
import { formatDateDDMMYYYY, formatBatchName } from '../utils/appHelpers';

interface AddToBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batch: string, date: string, handoverWard?: string) => void;
  records: RecordFile[];
  selectedCount: number;
  targetRecords?: RecordFile[]; // Prop này quan trọng để kiểm tra warning
  wards?: string[];
  currentUser?: User | null;
  defaultDepartment?: string;
}

const AddToBatchModal: React.FC<AddToBatchModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  records, 
  selectedCount,
  targetRecords = [],
  wards = [],
}) => {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');
  
  // State xác nhận danh sách chỉnh lý
  const [needsCorrectionConfirm, setNeedsCorrectionConfirm] = useState(false);
  
  const [selectedHandoverWard, setSelectedHandoverWard] = useState<string>('');

  // Ngày hiện tại cho đợt mới (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
      if (isOpen) {
          setSelectedHandoverWard('');
          setNeedsCorrectionConfirm(false);
          setMode('new');
      }
  }, [isOpen]);

  // State danh sách cảnh báo thực tế
  const [filteredWarningList, setFilteredWarningList] = useState<RecordFile[]>([]);

  const targetIdsKey = useMemo(() => {
    if (!isOpen || !targetRecords) return '';
    return targetRecords.map(r => `${r.id}_${r.needsMapCorrection ? 1 : 0}`).join(',');
  }, [isOpen, targetRecords]);

  useEffect(() => {
      const checkWarnings = async () => {
          if (!isOpen || !targetRecords || targetRecords.length === 0) {
              setFilteredWarningList([]);
              return;
          }

          const potentialWarnings = targetRecords.filter(r => r.needsMapCorrection);
          if (potentialWarnings.length === 0) {
              setFilteredWarningList([]);
              return;
          }

          const chinhLyRecords = await fetchChinhLyRecords();
          const realWarnings = potentialWarnings.filter(r => {
              const correctionEntry = chinhLyRecords.find(c => c.data.SO_HD === r.code);
              if (correctionEntry && correctionEntry.data.STATUS === 'sent') {
                  return false;
              }
              return true;
          });

          setFilteredWarningList(realWarnings);
      };

      checkWarnings();
  }, [isOpen, targetIdsKey]);

  // Tính số đợt tiếp theo trong ngày hôm nay (không phân biệt Tổ)
  const nextBatchInfo = useMemo(() => {
      let maxBatch = 0;
      records.forEach(r => {
          if (!r.exportDate || !r.exportDate.startsWith(todayStr)) return;

          if (r.exportBatch) {
              const batchStr = String(r.exportBatch);
              const match = batchStr.match(/Đợt\s*(\d+)/i) || batchStr.match(/^(\d+)$/);
              if (match && match[1]) {
                  const num = parseInt(match[1], 10);
                  if (num > maxBatch) maxBatch = num;
              }
          }
      });

      const nextNum = maxBatch + 1;
      const todayFmt = formatDateDDMMYYYY(todayStr);
      const fullBatchName = `Đợt ${nextNum} - Ngày ${todayFmt}`;

      return {
          batchNum: nextNum,
          batchName: fullBatchName,
          date: new Date().toISOString()
      };
  }, [records, todayStr]);

  // Danh sách đợt đã có (Toàn bộ các đợt trong hệ thống)
  const historyBatches = useMemo(() => {
      const batches: Record<string, { label: string, date: string, count: number, fullDate: string }> = {};
      
      records.forEach(r => {
          if ((r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED || r.exportBatch) && r.exportBatch && r.exportDate) {
              const datePart = r.exportDate.split('T')[0];
              const label = formatBatchName(r.exportBatch, '', datePart);
              
              if (!batches[label]) {
                  batches[label] = { 
                      label,
                      date: datePart, 
                      count: 0,
                      fullDate: r.exportDate 
                  };
              }
              batches[label].count++;
          }
      });

      return Object.values(batches).sort((a, b) => b.label.localeCompare(a.label));
  }, [records]);

  useEffect(() => {
      if (mode === 'existing') {
          if (historyBatches.length > 0) {
              const exists = historyBatches.some(h => h.label === selectedExistingBatch);
              if (!exists) {
                  setSelectedExistingBatch(historyBatches[0].label);
              }
          } else {
              setSelectedExistingBatch('');
          }
      }
  }, [mode, historyBatches, selectedExistingBatch]);

  if (!isOpen) return null;

  const handleConfirm = () => {
      if (filteredWarningList.length > 0 && !needsCorrectionConfirm) {
          alert("Vui lòng xác nhận bạn đã lập danh sách chỉnh lý cho các hồ sơ được cảnh báo.");
          return;
      }

      if (!selectedHandoverWard) {
          alert("Vui lòng chọn xã/phường nhận kết quả.");
          return;
      }

      const handoverWard = selectedHandoverWard;

      if (mode === 'new') {
          onConfirm(nextBatchInfo.batchName, nextBatchInfo.date, handoverWard);
      } else {
          if (!selectedExistingBatch) {
              alert('Vui lòng chọn một đợt cũ.');
              return;
          }
          const found = historyBatches.find(h => h.label === selectedExistingBatch);
          if (found) {
              onConfirm(found.label, found.fullDate, handoverWard);
          } else {
              onConfirm(selectedExistingBatch, new Date().toISOString(), handoverWard);
          }
      }
      setNeedsCorrectionConfirm(false);
      setSelectedHandoverWard('');
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl animate-fade-in-up flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">Chốt Danh Sách Giao 1 Cửa</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <p className="text-sm text-gray-600 mb-1">
                Bạn đang thực hiện chốt <strong>{selectedCount > 0 ? selectedCount : 'toàn bộ'}</strong> hồ sơ sang trạng thái "Đã giao 1 cửa".
            </p>

            {/* CẢNH BÁO CHỈNH LÝ BẢN ĐỒ */}
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
            <label className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${mode === 'new' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'new'} 
                    onChange={() => setMode('new')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                        <Plus size={16} className="text-blue-600" /> Tạo đợt mới trong ngày
                    </div>
                    <div className="mt-1.5 bg-white p-2.5 rounded border border-blue-200">
                        <div className="text-xs text-gray-500 mb-1">Tên đợt giao tự động:</div>
                        <div className="font-mono font-bold text-sm text-blue-800 break-all">
                            {nextBatchInfo.batchName}
                        </div>
                    </div>
                </div>
            </label>

            {/* Option 2: Existing Batch */}
            <label className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${mode === 'existing' ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'existing'} 
                    onChange={() => setMode('existing')}
                    className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-gray-800">
                        <History size={16} className="text-green-600" /> Thêm vào đợt cũ đã tạo
                    </div>
                    
                    <div className="mt-2">
                        <select 
                            className="w-full border border-gray-300 rounded px-2.5 py-2 text-xs font-semibold focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white"
                            disabled={mode !== 'existing'}
                            value={selectedExistingBatch}
                            onChange={(e) => setSelectedExistingBatch(e.target.value)}
                        >
                            {historyBatches.length > 0 ? (
                                historyBatches.map(h => (
                                    <option key={h.label} value={h.label}>
                                        {h.label} ({h.count} hồ sơ)
                                    </option>
                                ))
                            ) : (
                                <option value="">Chưa có đợt nào trong hệ thống</option>
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
                <CheckCircle2 size={16} /> Xác nhận chốt đợt
            </button>
        </div>
      </div>
    </div>
  );
};

export default AddToBatchModal;
