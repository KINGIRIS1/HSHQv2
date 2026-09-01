import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User } from '../types';
import { getWardLabel, GROUPS } from '../constants';
import { formatDateDDMMYYYY, formatBatchName, parseSafeDate, formatDateKey, getPureBatchNumber } from '../utils/appHelpers';
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

  const availableWards = useMemo(() => {
    const list = wards && wards.length > 0 ? wards : GROUPS;
    return Array.from(new Set(list));
  }, [wards]);

  // State danh sách cảnh báo thực tế
  const [filteredWarningList, setFilteredWarningList] = useState<RecordFile[]>([]);

  const targetIdsKey = useMemo(() => {
    if (!isOpen || !targetRecords) return '';
    return targetRecords.map(r => `${r.id}_${r.needsMapCorrection ? 1 : 0}`).join(',');
  }, [isOpen, targetRecords]);

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

  // Danh sách đợt đã có (Sắp xếp theo ngày và đợt từ lớn đến nhỏ - mới nhất xếp đầu)
  const historyBatches = useMemo(() => {
      const batches: Record<string, { label: string, date: string, count: number, fullDate: string, timestamp: number }> = {};
      
      records.forEach(r => {
          if (r.exportBatch && String(r.exportBatch).trim() !== '' && String(r.exportBatch) !== 'NOT_BATCHED') {
              const rawDate = r.exportDate || r.completedDate || r.receivedDate;
              const datePart = rawDate ? String(rawDate).split('T')[0] : '';
              const label = formatBatchName(r.exportBatch, '', datePart);
              
              if (!batches[label]) {
                  // Trích xuất ngày chuẩn từ nhãn label hoặc rawDate
                  let parsedDate: Date | null = null;
                  
                  // 1. Lấy ngày dạng DD/MM/YYYY từ nhãn (ví dụ: "Đợt 1 - Ngày 28/08/2026")
                  const dmyMatch = label.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                  if (dmyMatch) {
                      const day = parseInt(dmyMatch[1], 10);
                      const month = parseInt(dmyMatch[2], 10) - 1;
                      const year = parseInt(dmyMatch[3], 10);
                      parsedDate = new Date(year, month, day);
                  }
                  
                  // 2. Lấy ngày dạng YYYY-MM-DD từ nhãn
                  if (!parsedDate || isNaN(parsedDate.getTime())) {
                      const ymdMatch = label.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
                      if (ymdMatch) {
                          const year = parseInt(ymdMatch[1], 10);
                          const month = parseInt(ymdMatch[2], 10) - 1;
                          const day = parseInt(ymdMatch[3], 10);
                          parsedDate = new Date(year, month, day);
                      }
                  }

                  // 3. Nếu label không chứa thông tin ngày, lấy từ rawDate
                  if ((!parsedDate || isNaN(parsedDate.getTime())) && rawDate) {
                      parsedDate = parseSafeDate(rawDate);
                  }

                  const timestamp = (parsedDate && !isNaN(parsedDate.getTime())) ? parsedDate.getTime() : 0;
                  const dateIsoStr = (parsedDate && !isNaN(parsedDate.getTime())) ? formatDateKey(parsedDate) : (datePart || '');

                  batches[label] = { 
                      label,
                      date: dateIsoStr, 
                      count: 0,
                      fullDate: rawDate || new Date().toISOString(),
                      timestamp
                  };
              }
              batches[label].count++;
          }
      });

      const nowEnd = new Date();
      nowEnd.setHours(23, 59, 59, 999);
      const nowTimestamp = nowEnd.getTime();

      const getBatchNum = (batchStr: string) => {
          const match = String(batchStr).match(/Đợt\s*0*(\d+)/i) || String(batchStr).match(/^(\d+)$/);
          return match && match[1] ? parseInt(match[1], 10) : 0;
      };

      return Object.values(batches).sort((a, b) => {
          const aIsFuture = a.timestamp > nowTimestamp;
          const bIsFuture = b.timestamp > nowTimestamp;

          // 1. Ưu tiên các đợt từ hôm nay trở về trước (không vượt quá ngày hiện tại) lên trên các đợt tương lai
          if (aIsFuture !== bIsFuture) {
              return aIsFuture ? 1 : -1;
          }

          // 2. So sánh ngày giảm dần (ngày mới nhất trước dựa trên timestamp Unix)
          if (a.timestamp !== b.timestamp) {
              return b.timestamp - a.timestamp;
          }
          // 3. Nếu cùng ngày, so sánh số đợt giảm dần (từ lớn đến nhỏ)
          const numA = getBatchNum(a.label);
          const numB = getBatchNum(b.label);
          if (numA !== numB) {
              return numB - numA;
          }
          return b.label.localeCompare(a.label, undefined, { numeric: true });
      });
  }, [records]);

  const selectExistingMode = () => {
      setMode('existing');
      if (historyBatches.length > 0) {
          setSelectedExistingBatch(historyBatches[0].label);
      }
  };

  useEffect(() => {
      if (isOpen) {
          setSelectedHandoverWard('');
          setNeedsCorrectionConfirm(false);
          setMode('new');
          if (historyBatches.length > 0) {
              setSelectedExistingBatch(historyBatches[0].label);
          } else {
              setSelectedExistingBatch('');
          }
      }
  }, [isOpen, historyBatches]);

  useEffect(() => {
      if (mode === 'existing' && historyBatches.length > 0) {
          if (!selectedExistingBatch || !historyBatches.some(h => h.label === selectedExistingBatch)) {
              setSelectedExistingBatch(historyBatches[0].label);
          }
      }
  }, [mode, historyBatches, selectedExistingBatch]);

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

  if (!isOpen) return null;

  const todayFmt = formatDateDDMMYYYY(todayStr);

  const handleConfirm = () => {
      if (!selectedHandoverWard || !selectedHandoverWard.trim()) {
          alert('Vui lòng chọn Xã/phường nhận kết quả.');
          return;
      }
      const handoverWard = selectedHandoverWard;

      if (mode === 'new') {
          onConfirm(String(nextBatchInfo.batchNum), nextBatchInfo.date, handoverWard);
      } else {
          if (!selectedExistingBatch) {
              alert('Vui lòng chọn một đợt cũ.');
              return;
          }
          const found = historyBatches.find(h => h.label === selectedExistingBatch);
          const pureNum = getPureBatchNumber(selectedExistingBatch);
          if (found) {
              onConfirm(pureNum || found.label, found.fullDate, handoverWard);
          } else {
              onConfirm(pureNum || selectedExistingBatch, new Date().toISOString(), handoverWard);
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
                onClick={selectExistingMode}
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
                    onChange={selectExistingMode}
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
                                    {h.label} (Đã có {h.count} HS)
                                </option>
                            ))
                        ) : (
                            <option value="">Chưa có đợt nào trong hệ thống</option>
                        )}
                    </select>
                </div>
            </div>

            {/* Xã/phường nhận kết quả */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                        <span>Xã/phường nhận kết quả</span>
                        <span className="text-red-500 font-bold">*</span>
                    </span>
                    {selectedHandoverWard ? (
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            Đã chọn: {getWardLabel(selectedHandoverWard)}
                        </span>
                    ) : (
                        <span className="text-[11px] font-normal text-amber-600 italic">
                            Chưa chọn xã/phường
                        </span>
                    )}
                </label>

                {/* Select chọn Xã/Phường (sử dụng tên rút gọn) */}
                <select 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none font-medium bg-white text-gray-800"
                    value={selectedHandoverWard}
                    onChange={(e) => setSelectedHandoverWard(e.target.value)}
                >
                    <option value="">-- Chọn Xã/phường nhận kết quả --</option>
                    {availableWards.map(w => (
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
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
                Xác nhận chốt & In
            </button>
        </div>

      </div>
    </div>
  );
};

export default AddToBatchModal;

