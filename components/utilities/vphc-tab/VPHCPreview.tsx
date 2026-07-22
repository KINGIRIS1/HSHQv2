
import React from 'react';
import { ExternalLink, RefreshCw, FileOutput, Map as MapIcon, CheckCircle, AlertCircle, FileText, Gavel, Settings } from 'lucide-react';

interface VPHCPreviewProps {
    templateType: 'mau01' | 'mau02';
    setTemplateType: (t: 'mau01' | 'mau02') => void;
    exportedFilePath: string | null;
    handleOpenFile: () => void;
    handleExport: () => void;
    loading: boolean;
    renderPreviewHTML: () => string;
    onConfig: () => void; // Prop mới để mở modal cấu hình
}

const VPHCPreview: React.FC<VPHCPreviewProps> = ({ 
    templateType, setTemplateType,
    exportedFilePath, handleOpenFile, handleExport, 
    loading, renderPreviewHTML, onConfig
}) => {
    return (
        <div className="hidden lg:flex flex-col flex-1 bg-slate-200 border-l border-slate-300 relative min-w-0 h-full">
            
            {/* TOP BAR: TEMPLATE SWITCHER TABS & ACTIONS */}
            <div className="bg-white border-b border-slate-200 p-2 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setTemplateType('mau01')}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${templateType === 'mau01' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                    >
                        <Gavel size={14} /> Mẫu 01 (VPHC)
                    </button>
                    <button 
                        onClick={() => setTemplateType('mau02')}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${templateType === 'mau02' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                    >
                        <FileText size={14} /> Mẫu 02 (Làm việc)
                    </button>
                </div>

                <div className="flex gap-2 items-center">
                    {/* Nút Cấu hình đã được chuyển vào đây */}
                    <button 
                        onClick={onConfig}
                        className="p-1.5 text-gray-500 hover:text-purple-600 bg-white border border-gray-200 rounded-lg hover:bg-purple-50 transition-colors shadow-sm"
                        title="Cấu hình mẫu in (Upload file Word)"
                    >
                        <Settings size={16} />
                    </button>

                    <div className="w-px h-6 bg-gray-300 mx-1"></div>

                    {exportedFilePath && (
                        <button 
                            onClick={handleOpenFile}
                            className="flex items-center gap-1.5 bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all shadow-sm animate-pulse"
                            title="Mở file vừa xuất"
                        >
                            <ExternalLink size={14} /> Mở File
                        </button>
                    )}
                    <button 
                        onClick={handleExport} 
                        disabled={loading} 
                        className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition-all shadow-sm disabled:opacity-50"
                        title="Xuất ra file Word"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={14}/> : <FileOutput size={14}/>}
                        Xuất Word
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
