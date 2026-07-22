
import React from 'react';
import { AlertCircle, Map as MapIcon, CheckCircle } from 'lucide-react';

interface BienBanPreviewProps {
    generateContent: (isForWord: boolean) => string;
    isAreaMismatch: boolean;
    isAreaMismatchBDDC?: boolean;
}

const BienBanPreview: React.FC<BienBanPreviewProps> = ({ generateContent, isAreaMismatch, isAreaMismatchBDDC }) => {
    return (
        <div className="flex-1 bg-slate-300 overflow-y-auto overflow-x-auto p-10 flex flex-col items-center custom-scrollbar shadow-inner relative min-w-0 min-h-0 h-full">
            {/* CẢNH BÁO LỆCH DIỆN TÍCH GCN */}
            {isAreaMismatch && (
                <div className="bg-red-600 text-white font-bold text-center p-2 mb-2 rounded-lg shadow-xl animate-pulse text-sm sticky top-0 z-50 flex items-center gap-2 uppercase tracking-wide border-2 border-white/20 backdrop-blur-md">
                    <AlertCircle size={20} />
                    (TỔNG TĂNG GIẢM GCN CHƯA KHỚP)
                </div>
            )}

            {/* CẢNH BÁO LỆCH DIỆN TÍCH BĐĐC */}
            {isAreaMismatchBDDC && (
                <div className="bg-orange-600 text-white font-bold text-center p-2 mb-4 rounded-lg shadow-xl animate-pulse text-sm sticky top-12 z-50 flex items-center gap-2 uppercase tracking-wide border-2 border-white/20 backdrop-blur-md">
                    <AlertCircle size={20} />
                    (TỔNG TĂNG GIẢM BĐĐC CHƯA KHỚP)
                </div>
            )}

            <div className="bg-white w-[210mm] min-h-[297mm] h-auto shadow-[0_0_80px_rgba(0,0,0,0.25)] p-[20mm_15mm_20mm_25mm] transition-all animate-fade-in-up relative ring-1 ring-slate-400 mb-24 flex flex-col shrink-0">
                <div className="absolute top-0 left-0 w-[25mm] h-full bg-slate-50/40 pointer-events-none border-r border-slate-100 flex items-center justify-center z-0">
                    <div className="rotate-90 text-[10px] font-black text-slate-300 uppercase tracking-[1.5em] whitespace-nowrap">LỀ TRÁI ĐÓNG GHIM 25MM</div>
                </div>
                <div className="relative z-10 w-full h-auto overflow-visible select-none pointer-events-none" dangerouslySetInnerHTML={{ __html: generateContent(false) }} />
            </div>
            
            <div className="fixed bottom-8 bg-white/95 backdrop-blur px-10 py-4 rounded-full border border-slate-400 shadow-2xl flex items-center gap-8 text-[11px] font-black text-slate-700 uppercase tracking-widest z-30 pointer-events-auto border-b-4 border-b-blue-600">
                <div className="flex items-center gap-2.5"><MapIcon size={18} className="text-blue-500" /> Tự động dàn trang</div>
                <div className="w-px h-5 bg-slate-300"></div>
                <div className="flex items-center gap-2.5"><CheckCircle size={18} className="text-emerald-500" /> Lề chuẩn A4</div>
                <div className="w-px h-5 bg-slate-300"></div>
                <div className="flex items-center gap-2.5 text-blue-600 animate-pulse"><AlertCircle size={18} /> Chế độ xem trước</div>
            </div>
        </div>
    );
};

export default BienBanPreview;
