
import React, { useState, useMemo } from 'react';
import { Calculator, Copy, RotateCcw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { calculateEdgeError, calculateAreaError, ALLOWED_12X_SCALES, round } from '../../services/saiSoService';

const SaiSoTab: React.FC = () => {
  const [scale, setScale] = useState('1:500');
  const [dVal, setDVal] = useState('');
  const [sVal, setSVal] = useState('');
  const [isAgri, setIsAgri] = useState(false);
  const [copied, setCopied] = useState(false);

  const canApply12x = ALLOWED_12X_SCALES.has(scale);

  // Tính toán kết quả
  const result = useMemo(() => {
    const d = parseFloat(dVal);
    const s = parseFloat(sVal);
    
    // Reset checkbox nếu tỷ lệ không hỗ trợ
    if (!canApply12x && isAgri) {
        // Warning: Side effect in render is usually bad, but here we just need calculation logic
        // We handle UI state reset in handlers usually.
    }

    const edge = calculateEdgeError(scale, d, isAgri && canApply12x);
    const area = calculateAreaError(scale, s);

    return { edge, area };
  }, [scale, dVal, sVal, isAgri, canApply12x]);

  const handleCopy = () => {
    const d = parseFloat(dVal);
    const s = parseFloat(sVal);
    
    const txt = [
      `Tỷ lệ: ${scale}`,
      `D = ${isFinite(d) ? d : '—'} m`,
      `Sai số cạnh: ${result.edge.tolCm ? round(result.edge.tolCm, 2) + ' cm' : '—'}`,
      `S = ${isFinite(s) ? s : '—'} m²`,
      `Sai số diện tích: ${result.area.tolM2 ? round(result.area.tolM2, 3) + ' m²' : '—'}`,
    ].join('\n');

    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDemo = () => {
      setScale('1:1.000');
      setDVal('12.35');
      setSVal('256.7');
      setIsAgri(true);
  };

  const handleClear = () => {
      setDVal('');
      setSVal('');
      setIsAgri(false);
  };

  const formatNum = (n: number | null | undefined, d: number) => {
      if (n === null || n === undefined || !isFinite(n)) return '—';
      return n.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  };

  return (
    <div className="h-full p-4 overflow-y-auto bg-slate-50 flex flex-col items-center">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* INPUT CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6 border-b pb-2">
                <Calculator className="text-blue-600" /> Nhập liệu đo đạc
            </h3>

            <div className="space-y-5">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Tỷ lệ bản đồ</label>
                    <select 
                        className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 bg-slate-50"
                        value={scale}
                        onChange={(e) => { setScale(e.target.value); if(!ALLOWED_12X_SCALES.has(e.target.value)) setIsAgri(false); }}
                    >
                        <option value="1:200">1:200</option>
                        <option value="1:500">1:500</option>
                        <option value="1:1.000">1:1.000</option>
                        <option value="1:2.000">1:2.000</option>
                        <option value="1:5.000">1:5.000</option>
                        <option value="1:10.000">1:10.000</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Chiều dài cạnh D (m)</label>
                        <input 
                            type="number" 
                            className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
                            placeholder="VD: 12.35"
                            value={dVal}
                            onChange={(e) => setDVal(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Diện tích thửa S (m²)</label>
                        <input 
                            type="number" 
                            className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-green-700"
                            placeholder="VD: 256.7"
                            value={sVal}
                            onChange={(e) => setSVal(e.target.value)}
                        />
                    </div>
                </div>

                <div className={`p-3 rounded-xl border transition-all ${canApply12x ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'}`}>
                    <label className={`flex items-start gap-3 ${canApply12x ? 'cursor-pointer' : ''}`}>
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
                            checked={isAgri}
                            onChange={(e) => setIsAgri(e.target.checked)}
                            disabled={!canApply12x}
                        />
                        <div>
                            <span className={`block text-sm font-bold ${canApply12x ? 'text-blue-800' : 'text-gray-500'}`}>
                                Đất SXNN tập trung / đất chưa sử dụng
                            </span>
                            <span className="text-xs text-gray-500">
                                Áp dụng hệ số ×1.2 cho sai số cạnh (Chỉ tỷ lệ 1:1.000 và 1:2.000)
                            </span>
                        </div>
                    </label>
                </div>

                <div className="flex gap-2 pt-2">
                    <button onClick={handleDemo} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">Nhập mẫu</button>
                    <button onClick={handleClear} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-bold transition-colors flex items-center gap-1">
                        <RotateCcw size={14}/> Xóa
                    </button>
                    <button onClick={handleCopy} className="ml-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2">
                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                        {copied ? 'Đã Copy' : 'Copy KQ'}
                    </button>
                </div>
            </div>
        </div>

        {/* OUTPUT CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-full">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6 border-b pb-2">
                <Info className="text-purple-600" /> Kết quả tính toán
            </h3>

            <div className="space-y-4 flex-1">
                {/* Result Edge */}
                <div className={`p-4 rounded-xl border-l-4 shadow-sm ${result.edge.tolCm ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-300'}`}>
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sai số tương hỗ cạnh</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-200 font-medium text-gray-500">Cạnh</span>
                    </div>
                    <div className="text-3xl font-black text-gray-800 my-1">
                        {result.edge.tolCm ? formatNum(result.edge.tolCm, 2) : '—'} 
                        <span className="text-base font-medium text-gray-500 ml-1">cm</span>
                    </div>
                    {result.edge.tolCm && (
                        <div className="text-xs text-blue-700 font-medium">
                            ≈ {formatNum(result.edge.tolCm * 10, 1)} mm
                        </div>
                    )}
                </div>

                {/* Result Area */}
                <div className={`p-4 rounded-xl border-l-4 shadow-sm ${result.area.tolM2 ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-300'}`}>
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Giới hạn sai diện tích</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-200 font-medium text-gray-500">Diện tích</span>
                    </div>
                    <div className="text-3xl font-black text-gray-800 my-1">
                        {result.area.tolM2 ? formatNum(result.area.tolM2, 3) : '—'}
                        <span className="text-base font-medium text-gray-500 ml-1">m²</span>
                    </div>
                </div>

                {/* Debug Info */}
                <div className="mt-4">
                    <details className="group">
                        <summary className="cursor-pointer list-none text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 select-none">
                            <span className="group-open:rotate-90 transition-transform">▶</span> Chi tiết cách tính (Debug)
                        </summary>
                        <div className="mt-2 p-3 bg-slate-800 rounded-lg text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto shadow-inner">
                            <p>Tỷ lệ: {scale}</p>
                            <p>D = {dVal || '—'} m</p>
                            <p>S = {sVal || '—'} m²</p>
                            <div className="h-px bg-slate-700 my-2"></div>
                            <p className="text-blue-300">Cạnh: {result.edge.detail || '—'}</p>
                            <p className="text-green-300">Diện tích: {result.area.detail || '—'}</p>
                        </div>
                    </details>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 leading-snug">
                Nguồn số liệu: <b>Phụ lục số 03</b> (Sai số tương hỗ giữa 02 đỉnh thửa đất) và <b>Phụ lục số 04</b> (Giới hạn sai diện tích thửa đất) trong VBHN về quy định kỹ thuật đo đạc lập bản đồ địa chính số.
            </div>
        </div>
      </div>
    </div>
  );
};

export default SaiSoTab;
