
import React from 'react';
import { ExternalLink, RefreshCw, FileOutput, Map as MapIcon, CheckCircle, AlertCircle, FileText, Settings } from 'lucide-react';

interface VPHCPreviewProps {
    exportedFilePath: string | null;
    handleOpenFile: () => void;
    handleSaveAndPrint: () => void;
    handleExportWord: () => void;
    loading: boolean;
    renderPreviewHTML: () => string;
    onConfig: () => void;
}

const VPHCPreview: React.FC<VPHCPreviewProps> = ({ 
    exportedFilePath, handleOpenFile, handleSaveAndPrint, handleExportWord,
    loading, renderPreviewHTML, onConfig
}) => {
    return (
        <div className="hidden lg:flex flex-col flex-1 bg-slate-200 border-l border-slate-300 relative min-w-0 h-full">
            
            {/* TOP BAR: TEMPLATE TITLE & ACTIONS */}
            <div className="bg-white border-b border-slate-200 p-2 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold">
                    <FileText size={14} className="text-blue-600" /> Biên bản ghi nhận sự việc (NĐ 123/2024/NĐ-CP)
                </div>

                <div className="flex gap-2 items-center">
                    <button 
                        onClick={onConfig}
                        className="p-1.5 text-gray-500 hover:text-purple-600 bg-white border border-gray-200 rounded-lg hover:bg-purple-50 transition-colors shadow-sm"
                        title="Cấu hình mẫu in (Upload file Word)"
                    >
                        <Settings size={16} />
                    </button>
                    <button 
                        onClick={handleExportWord}
                        className="flex items-center gap-1.5 bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all shadow-sm cursor-pointer"
                        title="Tải bản Word"
                    >
                        <FileOutput size={14} /> Tải Word
                    </button>
                </div>
            </div>

            {/* PREVIEW CONTENT AREA */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-8 flex flex-col items-center custom-scrollbar min-h-0">
                <div className="bg-white w-[210mm] min-h-[297mm] h-auto shadow-2xl p-[20mm_15mm_20mm_25mm] transition-all animate-fade-in-up relative ring-1 ring-slate-300 mb-10 flex flex-col shrink-0">
                    {/* Ruler Guide */}
                    <div className="absolute top-0 left-0 w-[25mm] h-full bg-slate-50/30 pointer-events-none border-r border-dashed border-slate-200 flex items-center justify-center z-0">
                        <div className="rotate-90 text-[9px] font-bold text-slate-300 uppercase tracking-[1em] whitespace-nowrap select-none">LỀ TRÁI ĐÓNG GHIM</div>
                    </div>
                    
                    {/* Content */}
                    <div className="relative z-10 w-full h-auto overflow-visible select-none pointer-events-none origin-top" dangerouslySetInnerHTML={{ __html: renderPreviewHTML() }} />
                </div>
            </div>

            {/* BOTTOM STATUS */}
            <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[10px] text-slate-500 font-medium shrink-0">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><MapIcon size={12} /> Khổ giấy: A4</span>
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} /> Tự động căn lề</span>
                </div>
                <div className="flex items-center gap-1 text-orange-500 animate-pulse">
                    <AlertCircle size={12} /> Chế độ xem trước (Nội dung có thể khác biệt nhỏ khi xuất Word)
                </div>
            </div>
        </div>
    );
};

export default VPHCPreview;
