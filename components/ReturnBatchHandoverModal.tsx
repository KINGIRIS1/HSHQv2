import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User } from '../types';
import { X, Calendar, Plus, History, CheckCircle2, Building, Send, FileSpreadsheet } from 'lucide-react';

interface ReturnBatchHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batch: number, date: string, deptName: string) => void;
  records: RecordFile[];
  selectedCount: number;
  targetRecords?: RecordFile[];
  currentUser?: User | null;
}

export const ReturnBatchHandoverModal: React.FC<ReturnBatchHandoverModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  records,
  selectedCount,
  targetRecords = [],
  currentUser,
}) => {
  const [batchNumber, setBatchNumber] = useState<number>(1);
  const [batchDate, setBatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deptName, setDeptName] = useState<string>('Tổ Đo đạc & Kỹ thuật');
  const [customDept, setCustomDept] = useState<string>('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-calculate next batch number for returned records today
  useEffect(() => {
    if (isOpen) {
      let maxBatch = 0;
      records.forEach((r) => {
        if (r.returnBatch && r.returnBatchDate && r.returnBatchDate.startsWith(todayStr)) {
          if (r.returnBatch > maxBatch) maxBatch = r.returnBatch;
        }
      });
      setBatchNumber(maxBatch + 1);
      setBatchDate(todayStr);
    }
  }, [isOpen, records, todayStr]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const finalDept = deptName === 'Khác' ? customDept.trim() || 'Phòng Chuyên môn' : deptName;
    onConfirm(batchNumber, batchDate, finalDept);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Send className="text-emerald-600" size={22} />
              Chốt DS Lưu
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bàn giao danh sách hồ sơ <strong>Đã trả kết quả</strong> về cho Phòng / Tổ chuyên môn quản lý
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form controls */}
        <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
          <div>
            <label className="block text-slate-700 mb-1">1. Đợt bàn giao</label>
            <input
              type="number"
              min={1}
              value={batchNumber}
              onChange={(e) => setBatchNumber(parseInt(e.target.value) || 1)}
              className="w-full border border-emerald-300 rounded-lg px-3 py-2 bg-white font-bold text-emerald-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1">2. Ngày bàn giao</label>
            <input
              type="date"
              value={batchDate}
              onChange={(e) => setBatchDate(e.target.value)}
              className="w-full border border-emerald-300 rounded-lg px-3 py-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1">3. Phòng / Bộ phận nhận</label>
            <select
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className="w-full border border-emerald-300 rounded-lg px-3 py-2 bg-white text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="Tổ Đo đạc & Kỹ thuật">Tổ Đo đạc & Kỹ thuật</option>
              <option value="Tổ Thông tin Lưu trữ">Tổ Thông tin Lưu trữ</option>
              <option value="Tổ Cấp giấy">Tổ Cấp giấy</option>
              <option value="Phòng Chuyên môn">Phòng Chuyên môn</option>
              <option value="Khác">Phòng / Bộ phận khác...</option>
            </select>
          </div>

          {deptName === 'Khác' && (
            <div className="md:col-span-3">
              <label className="block text-slate-700 mb-1">Nhập tên phòng / bộ phận tiếp nhận</label>
              <input
                type="text"
                placeholder="Nhập tên phòng hoặc tổ chuyên môn..."
                value={customDept}
                onChange={(e) => setCustomDept(e.target.value)}
                className="w-full border border-emerald-300 rounded-lg px-3 py-2 bg-white font-medium text-slate-800"
              />
            </div>
          )}
        </div>

        {/* Preview Selected Records List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Danh sách hồ sơ được chọn chốt bàn giao ({targetRecords.length} hồ sơ):</span>
            <span className="text-emerald-700 font-bold">Đợt {batchNumber} - Ngày {batchDate}</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 font-bold text-slate-700 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Mã HS</th>
                  <th className="p-2.5">Chủ Sử Dụng</th>
                  <th className="p-2.5">Người Nhận KQ</th>
                  <th className="p-2.5">Số Chứng Từ</th>
                  <th className="p-2.5 text-right">Số Tiền (đ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {targetRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                      Chưa chọn hồ sơ nào.
                    </td>
                  </tr>
                ) : (
                  targetRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-emerald-50/50">
                      <td className="p-2.5 font-bold text-emerald-800">{r.code}</td>
                      <td className="p-2.5 text-slate-900">{r.customerName}</td>
                      <td className="p-2.5">{r.receiverName || '---'}</td>
                      <td className="p-2.5 font-mono">{r.receiptNumber || '---'}</td>
                      <td className="p-2.5 text-right font-semibold text-slate-900">
                        {r.returnedPrice !== undefined && r.returnedPrice !== null
                          ? r.returnedPrice.toLocaleString('vi-VN')
                          : '0'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleConfirm}
            disabled={targetRecords.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            Chốt Bàn Giao ({targetRecords.length} hồ sơ)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnBatchHandoverModal;
