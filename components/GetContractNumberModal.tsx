import React, { useState, useEffect } from 'react';
import { X, Hash, FileSignature, CheckCircle, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { User } from '../types';
import { 
    getPreviewContractCode, 
    consumeNextContractCode, 
    getPreviewHDKTCode, 
    consumeNextHDKTCode 
} from '../services/api';

interface GetContractNumberModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    onSelectCode: (code: string) => void;
}

export const GetContractNumberModal: React.FC<GetContractNumberModalProps> = ({
    isOpen,
    onClose,
    currentUser,
    onSelectCode
}) => {
    const [contractType, setContractType] = useState<'HDKT' | 'HD'>('HDKT');
    const [previewCode, setPreviewCode] = useState<string>('');
    const [customCode, setCustomCode] = useState<string>('');
    const [useCustomCode, setUseCustomCode] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isConsuming, setIsConsuming] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchPreview = async () => {
            setIsLoading(true);
            const currentYear = new Date().getFullYear();
            try {
                if (contractType === 'HDKT') {
                    const code = await getPreviewHDKTCode(currentYear);
                    if (isMounted) setPreviewCode(code);
                } else {
                    const code = await getPreviewContractCode(currentYear);
                    if (isMounted) setPreviewCode(code);
                }
            } catch (err) {
                console.error("Lỗi khi lấy số hợp đồng xem trước:", err);
                if (isMounted) {
                    setPreviewCode(contractType === 'HDKT' ? `01/HĐKT-${currentYear}` : `01/HĐ-${currentYear}`);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchPreview();

        return () => {
            isMounted = false;
        };
    }, [isOpen, contractType]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (useCustomCode) {
            if (!customCode.trim()) return;
            onSelectCode(customCode.trim());
            return;
        }

        setIsConsuming(true);
        const currentYear = new Date().getFullYear();
        const userName = currentUser?.username || currentUser?.name || 'admin';
        try {
            let finalCode = '';
            if (contractType === 'HDKT') {
                finalCode = await consumeNextHDKTCode(currentYear, userName, 'Cấp số hợp đồng đo đạc');
            } else {
                finalCode = await consumeNextContractCode(userName, 'Cấp số hợp đồng tách thửa', currentYear);
            }
            onSelectCode(finalCode || previewCode);
        } catch (err) {
            console.error("Lỗi khi cấp số hợp đồng chính thức:", err);
            onSelectCode(previewCode);
        } finally {
            setIsConsuming(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <Hash size={20} className="text-yellow-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base leading-tight">Cấp Số Hợp Đồng Mới</h3>
                            <p className="text-xs text-blue-100">Chọn loại hình để nhận số thứ tự tiếp theo</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Chọn loại hợp đồng */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                            Loại hợp đồng
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => { setContractType('HDKT'); setUseCustomCode(false); }}
                                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                                    contractType === 'HDKT' && !useCustomCode
                                        ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <span className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                                    <FileSignature size={14} className="text-blue-600" /> Đo đạc kinh tế
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                    Số dạng: .../HĐKT-2025
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => { setContractType('HD'); setUseCustomCode(false); }}
                                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                                    contractType === 'HD' && !useCustomCode
                                        ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/20'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <span className="font-bold text-xs text-indigo-900 flex items-center gap-1.5">
                                    <FileSignature size={14} className="text-indigo-600" /> Tách thửa / Trích đo
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                    Số dạng: .../HĐ-2025
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Số đề xuất tự động */}
                    {!useCustomCode && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col items-center justify-center text-center">
                            <span className="text-xs text-slate-500 font-medium mb-1">Số dự kiến tiếp theo</span>
                            {isLoading ? (
                                <div className="flex items-center gap-2 text-slate-400 py-2">
                                    <Loader2 size={18} className="animate-spin text-blue-600" />
                                    <span className="text-sm">Đang tải số mới nhất...</span>
                                </div>
                            ) : (
                                <div className="text-2xl font-black text-blue-800 font-mono tracking-wider py-1">
                                    {previewCode || 'Đang xác định...'}
                                </div>
                            )}
                            <span className="text-[11px] text-slate-400 mt-1">
                                Số sẽ chính thức được cấp khi bạn bấm xác nhận
                            </span>
                        </div>
                    )}

                    {/* Tuỳ chọn nhập số thủ công */}
                    <div className="pt-2 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox"
                                checked={useCustomCode}
                                onChange={(e) => setUseCustomCode(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-slate-700">Tự nhập số hợp đồng tùy chỉnh</span>
                        </label>

                        {useCustomCode && (
                            <div className="mt-2.5">
                                <input 
                                    type="text"
                                    value={customCode}
                                    onChange={(e) => setCustomCode(e.target.value)}
                                    placeholder="Ví dụ: 15/HĐKT-2025"
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    autoFocus
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isConsuming}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isConsuming || (useCustomCode && !customCode.trim())}
                        className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isConsuming ? (
                            <>
                                <Loader2 size={14} className="animate-spin" /> Đang cấp số...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={14} /> Xác nhận lấy số
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GetContractNumberModal;
