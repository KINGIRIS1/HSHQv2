import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User } from '../types';
import { getWardLabel } from '../constants';
import { formatDateDDMMYYYY, formatBatchName } from '../utils/appHelpers';
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
  const [isPhiDiaGioiSelected, setIsPhiDiaGioiSelected] = useState<boolean>(false);
  const [selectedHandoverWard, setSelectedHandoverWard] = useState<string>('');
  
  // State xác nhận danh sách chỉnh lý
  const [needsCorrectionConfirm, setNeedsCorrectionConfirm] = useState(false);

  // Ngày hiện tại cho đợt mới (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
      if (isOpen) {
          setSelectedHandoverWard('');
          setIsPhiDiaGioiSelected(false);
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

  const todayFmt = formatDateDDMMYYYY(todayStr);

  const handleConfirm = () => {
      if (filteredWarningList.length > 0 && !needsCorrectionConfirm) {
          alert("Vui lòng xác nhận bạn đã kiểm tra / lập danh sách chỉnh lý cho các hồ sơ cảnh báo.");
          return;
      }

      if (isPhiDiaGioiSelected && !selectedHandoverWard) {
          alert("Vui lòng chọn xã/phường nhận kết quả.");
          return;
      }

      const handoverWard = isPhiDiaGioiSelected ? selectedHandoverWard : 'SAME_AS_WARD';

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

            {/* Cảnh báo chỉnh lý bản đồ nếu có */}
            {filteredWarningList.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="text-orange-700 font-bold text-xs mb-1.5 uppercase">
                        Cảnh báo: Có hồ sơ cần chỉnh lý bản đồ
                    </div>
                    <ul className="list-disc list-inside text-[11px] text-orange-800 font-mono mb-2 max-h-16 overflow-y-auto bg-orange-100/40 p-1.5 rounded">
                        {filteredWarningList.map(r => (
                            <li key={r.id}>{r.code} - {r.customerName}</li>
                        ))}
                    </ul>
                    <label className="flex items-center gap-1.5 cursor-pointer bg-white p-1.5 rounded border border-orange-200 hover:border-orange-300 transition-colors">
                        <input 
                            type="checkbox" 
                            className="w-3.5 h-3.5 text-orange-600 rounded"
                            checked={needsCorrectionConfirm}
                            onChange={(e) => setNeedsCorrectionConfirm(e.target.checked)}
                        />
                        <span className="text-[11px] font-bold text-gray-700">Tôi xác nhận đã kiểm tra / lập danh sách.</span>
                    </label>
                </div>
            )}

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

            {/* Checkbox: Giao phi địa giới (Giao khác địa bàn) */}
            <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        checked={isPhiDiaGioiSelected}
                        onChange={(e) => setIsPhiDiaGioiSelected(e.target.checked)}
                    />
                    <span className="text-sm font-bold text-gray-700">
                        Giao phi địa giới (Giao khác địa bàn)
                    </span>
                </label>
            </div>

            {/* Xã nhận kết quả (Chỉ hiển thị khi chọn Giao phi địa giới) */}
            {isPhiDiaGioiSelected && (
                <div className="space-y-1.5 bg-gray-50 p-3 rounded-lg border border-gray-200 animate-fade-in">
                    <label className="block text-xs font-bold text-gray-800">
                        Xã nhận kết quả <span className="text-red-500">*</span>
                    </label>
                    <select 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none font-medium bg-white text-gray-800"
                        value={selectedHandoverWard}
                        onChange={(e) => setSelectedHandoverWard(e.target.value)}
                    >
                        <option value="">-- Chọn xã/phường nhận kết quả --</option>
                        {wards.map(w => (
                            <option key={w} value={w}>{getWardLabel(w)}</option>
                        ))}
                    </select>
                </div>
            )}

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
                disabled={filteredWarningList.length > 0 && !needsCorrectionConfirm}
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
