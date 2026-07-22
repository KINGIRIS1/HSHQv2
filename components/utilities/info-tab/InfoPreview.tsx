
import React from 'react';
import { ExternalLink, RefreshCw, FileOutput, Map as MapIcon, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

interface InfoPreviewProps {
    exportedFilePath: string | null;
    handleOpenFile: () => void;
    handleExport: () => void;
    loading: boolean;
    renderPreviewHTML: () => string;
}

const InfoPreview: React.FC<InfoPreviewProps> = ({ exportedFilePath, handleOpenFile, handleExport, loading, renderPreviewHTML }) => {
    return (
        <div className="hidden lg:flex flex-col flex-1 bg-slate-300 relative min-w-0 h-full border-l border-slate-200">
            
            {/* TOOLBAR (Đồng bộ với các tab khác) */}
            <div className="bg-white border-b border-gray-200 p-2 flex justify-end gap-2 shrink-0 z-20 shadow-sm">
                {exportedFilePath && (
                    <button 
                        onClick={handleOpenFile}
                        className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200 flex items-center gap-1 animate-bounce transition-colors"
                        title="Mở file vừa xuất"
                    >
                        <ExternalLink size={14} /> Mở File
                    </button>
                )}
                <button 
                    onClick={handleExport} 
                    disabled={loading} 
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50 transition-colors shadow-sm" 
                    title="Xuất phiếu ra file Word"
                >
                    {loading ? <Loader2 className="animate-spin" size={14}/> : <Download size={14}/>} Xuất Word
                </button>
            </div>

            {/* PREVIEW AREA */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-10 flex flex-col items-center custom-scrollbar shadow-inner">
                <div className="bg-white w-[210mm] min-h-[297mm] h-auto shadow-[0_0_80px_rgba(0,0,0,0.25)] p-[20mm_15mm_20mm_25mm] transition-all animate-fade-in-up relative ring-1 ring-slate-400 mb-24 flex flex-col shrink-0">
                    <div className="absolute top-0 left-0 w-[25mm] h-full bg-slate-50/40 pointer-events-none border-r border-slate-100 flex items-center justify-center z-0">
                        <div className="rotate-90 text-[10px] font-black text-slate-300 uppercase tracking-[1.5em] whitespace-nowrap">LỀ TRÁI ĐÓNG GHIM 25MM</div>
                    </div>
                    <div className="relative z-10 w-full h-auto overflow-visible select-none pointer-events-none" dangerouslySetInnerHTML={{ __html: renderPreviewHTML() }} />
                </div>
            </div>

            {/* STATUS BAR (Giữ nguyên vị trí nhưng cập nhật style) */}
            <div className="absolute bottom-6 right-1/2 translate-x-1/2 bg-white/95 backdrop-blur px-6 py-3 rounded-full border border-slate-400 shadow-2xl flex items-center gap-6 text-[10px] font-black text-slate-700 uppercase tracking-widest z-30 pointer-events-auto border-b-4 border-b-blue-600 whitespace-nowrap">
                <div className="flex items-center gap-2"><MapIcon size={16} className="text-blue-500" /> Tự động dàn trang</div>
                <div className="w-px h-4 bg-slate-300"></div>
                <div className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-500" /> Lề chuẩn A4</div>
                <div className="w-px h-4 bg-slate-300"></div>
                <div className="flex items-center gap-2 text-blue-600 animate-pulse"><AlertCircle size={16} /> Chế độ xem trước</div>
            </div>
        </div>
    );
};

export default InfoPreview;
