import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User } from '../types';
import { getWardLabel } from '../constants';
import { formatDateDDMMYYYY, formatBatchName, extractDateFromBatch } from '../utils/appHelpers';
import { fetchChinhLyRecords } from '../services/apiUtilities';

interface AddToBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batch: string, date: string, handoverWard?: string) => void;
  records: RecordFile[];
  selectedCount: number;
  targetRecords?: RecordFile[];
  wards?: string[];
  currentUser?: User | null;
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
  const [selectedHandoverWard, setSelectedHandoverWard] = useState<string>('');
  
  // State xác nhận danh sách chỉnh lý
  const [needsCorrectionConfirm, setNeedsCorrectionConfirm] = useState(false);

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

  // Tính số đợt tiếp theo trong ngày hôm nay
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

  // Danh sách đợt đã có
  const historyBatches = useMemo(() => {
      const batches: Record<string, { label: string, date: string, count: number, fullDate: string }> = {};
      
      records.forEach(r => {
          if ((r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED || r.exportBatch) && r.exportBatch) {
              let datePart = r.exportDate ? r.exportDate.split('T')[0] : extractDateFromBatch(r.exportBatch);
              if (!datePart) {
                  datePart = (r.completedDate || r.receivedDate || new Date().toISOString()).split('T')[0];
              }
              const label = formatBatchName(r.exportBatch, '', datePart);
              
              if (!batches[label]) {
                  batches[label] = { 
                      label,
                      date: datePart, 
                      count: 0,
                      fullDate: r.exportDate || new Date(datePart).toISOString() 
                  };
              }
              batches[label].count++;
          }
      });

      // Sắp xếp giảm dần theo ngày chuyển, sau đó giảm dần theo số thứ tự đợt
      return Object.values(batches).sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          
          const getBatchNum = (batchVal: string) => {
              const match = batchVal.match(/Đợt\s*(\d+)/i) || batchVal.match(/^(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
          };
          return getBatchNum(b.label) - getBatchNum(a.label);
      });
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

  const todayFmt = formatDateDDMMYYYY(todayStr);

  const handleConfirm = () => {
      const handoverWard = selectedHandoverWard || 'SAME_AS_WARD';

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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-base">Chốt DS Giao 1 Cửa</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-bold text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            
            <p className="text-sm text-gray-600 leading-relaxed">
                Bạn đang thực hiện chốt <strong className="text-sm font-bold text-gray-800">{selectedCount > 0 ? selectedCount : 'toàn bộ'}</strong> hồ sơ sang trạng thái "Đã giao".
            </p>

            {/* Option 1: Tạo đợt mới (Hôm nay) */}
            <div 
                onClick={() => setMode('new')}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    mode === 'new' 
                    ? 'bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500/20' 
                    : 'bg-white border-gray-200 hover:border-blue-300'
                }`}
            >
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'new'} 
                    onChange={() => setMode('new')}
                    className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 space-y-1">
                    <div className="font-bold text-gray-800 text-sm">
                        + Tạo đợt mới (Hôm nay)
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                        <div>Đợt tiếp theo: <span className="font-bold text-blue-600">Đợt {nextBatchInfo.batchNum}</span></div>
                        <div>Ngày: {todayFmt}</div>
                    </div>
                </div>
            </div>

            {/* Option 2: Thêm vào đợt cũ */}
            <div 
                onClick={() => setMode('existing')}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    mode === 'existing' 
                    ? 'bg-green-50/50 border-green-500 shadow-sm ring-1 ring-green-500/20' 
                    : 'bg-white border-gray-200 hover:border-green-300'
                }`}
            >
                <input 
                    type="radio" 
                    name="batchMode" 
                    checked={mode === 'existing'} 
                    onChange={() => setMode('existing')}
                    className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <div className="flex-1 space-y-2">
                    <div className="font-bold text-gray-800 text-sm">
                        ↺ Thêm vào đợt cũ
                    </div>
                    
                    <select 
                        className="w-full border border-gray-350 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white text-gray-700"
                        disabled={mode !== 'existing'}
                        value={selectedExistingBatch}
                        onChange={(e) => setSelectedExistingBatch(e.target.value)}
                        onClick={(e) => e.stopPropagation()} // Prevent radio selection toggle on select click
                    >
                        {historyBatches.length > 0 ? (
                            historyBatches.map(h => (
                                <option key={h.label} value={h.label}>
                                    {h.label} - Ngày {formatDateDDMMYYYY(h.date)} (Đã có {h.count} HS)
                                </option>
                            ))
                        ) : (
                            <option value="">Chưa có đợt nào trong hệ thống</option>
                        )}
                    </select>
                </div>
            </div>

            {/* Giao khác địa bàn */}
            <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-gray-800">
                    Giao khác địa bàn (Xã/phường nhận kết quả)
                </label>
                <select 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none font-medium bg-white text-gray-800"
                    value={selectedHandoverWard}
                    onChange={(e) => setSelectedHandoverWard(e.target.value)}
                >
                    <option value="">-- Mặc định (Theo địa bàn từng hồ sơ) --</option>
                    {wards.map(w => (
                        <option key={w} value={w}>{getWardLabel(w)}</option>
                    ))}
                </select>
            </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2.5">
            <button 
                onClick={onClose} 
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors"
            >
                Hủy bỏ
            </button>
            <button 
                onClick={handleConfirm} 
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Xác nhận chốt
            </button>
        </div>

      </div>
    </div>
  );
};

export default AddToBatchModal;
