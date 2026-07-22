import React, { useState, useEffect } from 'react';
import { getPreviewHDKTCode, consumeNextHDKTCode, getHDKTHistory, updateHDKTSequence } from '../services/api';
import { X, Hash, Calendar, Copy, User, Check, ListFilter, AlertCircle, RefreshCw, Pencil } from 'lucide-react';
import { User as UserType } from '../types';

interface GetContractNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
}

const GetContractNumberModal: React.FC<GetContractNumberModalProps> = ({ isOpen, onClose, currentUser }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [previewNumber, setPreviewNumber] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [allocatedNumber, setAllocatedNumber] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Custom Sequence States
  const [isEditingSeq, setIsEditingSeq] = useState<boolean>(false);
  const [newSeqValue, setNewSeqValue] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadData();
      setNote('');
      setAllocatedNumber(null);
      setIsEditingSeq(false);
    }
  }, [isOpen, selectedYear]);

  const loadData = async () => {
    try {
      const preview = await getPreviewHDKTCode(selectedYear);
      setPreviewNumber(preview);
      const hist = await getHDKTHistory(selectedYear);
      setHistory(hist);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  const handleAllocate = async () => {
    setLoading(true);
    setAllocatedNumber(null);
    try {
      const userName = currentUser.name || currentUser.username || "Nhân viên";
      const code = await consumeNextHDKTCode(selectedYear, userName, note);
      setAllocatedNumber(code);
      setNote('');
      await loadData(); // Reload preview and history
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSeq = async () => {
    const seqNum = parseInt(newSeqValue, 10);
    if (isNaN(seqNum) || seqNum < 1) {
      alert("Số thứ tự phải là số nguyên dương lớn hơn hoặc bằng 1!");
      return;
    }
    setLoading(true);
    try {
      await updateHDKTSequence(selectedYear, seqNum);
      setIsEditingSeq(false);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-fade-in-up">
        
        {/* HEADER */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-purple-50/50 to-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
              <Hash size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Cấp Số Hợp Đồng Tự Động</h3>
              <p className="text-xs text-slate-500">Số HĐKT tăng dần, bắt đầu lại vào năm mới</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* YEAR SELECTOR */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Chọn năm cấp số:</span>
            </div>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white border border-slate-200 text-slate-800 font-bold px-4 py-1.5 rounded-lg text-sm shadow-xs focus:ring-2 focus:ring-purple-200 outline-hidden"
            >
              {Array.from({ length: 6 }, (_, i) => currentYear - 3 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* GENERATOR CARD */}
          <div className="bg-purple-50/40 border border-purple-100 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <span className="text-xs font-bold text-purple-500 uppercase tracking-wider block mb-1">Số hợp đồng tiếp theo</span>
                {isEditingSeq ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-semibold text-slate-500">Số tiếp theo:</span>
                    <input 
                      type="number" 
                      value={newSeqValue}
                      onChange={(e) => setNewSeqValue(e.target.value)}
                      className="w-24 bg-white border border-purple-200 rounded-lg px-2 py-1 text-sm font-bold font-mono focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-hidden text-slate-800"
                      min="1"
                    />
                    <button 
                      onClick={handleSaveSeq}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      Lưu
                    </button>
                    <button 
                      onClick={() => setIsEditingSeq(false)}
                      className="px-2 py-1 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium transition-all"
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-purple-800 font-mono tracking-tight">{previewNumber || '...'}</span>
                    <button 
                      onClick={() => {
                        const match = previewNumber.match(/^(\d+)\/HĐKT/);
                        setNewSeqValue(match ? parseInt(match[1], 10).toString() : '1');
                        setIsEditingSeq(true);
                      }}
                      className="p-1 hover:bg-purple-100 text-purple-600 rounded-md transition-colors"
                      title="Chỉnh sửa số tiếp theo"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={loadData} 
                className="p-1.5 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors" 
                title="Làm mới"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-500 uppercase">Ghi chú (Tên khách hàng / Nội dung hợp đồng)</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Nguyễn Văn A - Đo đạc tách thửa"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-hidden transition-all text-slate-800"
              />
            </div>

            <button 
              onClick={handleAllocate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-3 px-4 rounded-xl shadow-md shadow-purple-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang cấp số...
                </>
              ) : (
                <>
                  <Hash size={18} /> Cấp Số Hợp Đồng Mới
                </>
              )}
            </button>
          </div>

          {/* ALLOCATED SUCCESS RESULT */}
          {allocatedNumber && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col items-center text-center space-y-3 animate-bounce-once">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Cấp Số Thành Công!</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-emerald-800 font-mono">{allocatedNumber}</span>
                <button 
                  onClick={() => copyToClipboard(allocatedNumber, 'allocated')}
                  className="p-2 bg-white hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors"
                  title="Sao chép"
                >
                  {copiedId === 'allocated' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-xs text-emerald-600">Đã lưu trữ số này vào danh sách lịch sử cấp số</p>
            </div>
          )}

          {/* HISTORY LIST */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <ListFilter size={16} className="text-slate-500" />
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lịch Sử Cấp Số Năm {selectedYear}</h4>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto bg-slate-50/50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-4">Số Hợp Đồng</th>
                    <th className="py-2.5 px-4">Người Cấp</th>
                    <th className="py-2.5 px-4">Ghi Chú / Khách Hàng</th>
                    <th className="py-2.5 px-4 text-center">Sao Chép</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100 bg-white">
                  {history.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-bold text-purple-700">{item.code}</td>
                      <td className="py-2.5 px-4 text-slate-600 flex items-center gap-1.5">
                        <User size={12} className="text-slate-400" />
                        {item.by}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-medium max-w-[200px] truncate" title={item.note}>
                        {item.note || <span className="text-slate-300 italic">Không có ghi chú</span>}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button 
                          onClick={() => copyToClipboard(item.code, `hist-${idx}`)}
                          className={`p-1.5 hover:bg-slate-100 rounded-lg transition-colors mx-auto block ${copiedId === `hist-${idx}` ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500'}`}
                        >
                          {copiedId === `hist-${idx}` ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                        Chưa có lịch sử cấp số nào trong năm {selectedYear}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 rounded-b-2xl">
          <button 
            onClick={onClose} 
            className="px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 hover:text-slate-800 text-sm transition-all shadow-xs"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};

export default GetContractNumberModal;
