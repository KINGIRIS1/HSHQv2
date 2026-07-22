
import React from 'react';
import { Download, Clock, Loader2, ShieldAlert, CloudLightning } from 'lucide-react';

interface UpdateRequiredModalProps {
  visible: boolean;
  version: string;
  downloadStatus: 'idle' | 'downloading' | 'ready' | 'error';
  progress: number;
  downloadSpeed?: number; // New prop: Bytes per second
  onUpdateNow: () => void;
  onUpdateLater: () => void;
}

const UpdateRequiredModal: React.FC<UpdateRequiredModalProps> = ({
  visible,
  version,
  downloadStatus,
  progress,
  downloadSpeed = 0,
  onUpdateNow,
  onUpdateLater
}) => {
  if (!visible) return null;

  // Helper format tốc độ
  const formatSpeed = (bytes: number) => {
      if (bytes === 0) return '';
      const mb = bytes / 1024 / 1024;
      if (mb >= 1) return `${mb.toFixed(2)} MB/s`;
      const kb = bytes / 1024;
      return `${kb.toFixed(0)} KB/s`;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
            <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white/20 p-4 rounded-full mb-3 shadow-lg backdrop-blur-md">
                    <CloudLightning className="text-white w-12 h-12 animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wide">Cập nhật phần mềm</h2>
                <p className="text-blue-100 text-sm font-medium mt-1">Phiên bản mới {version} đã sẵn sàng</p>
            </div>
        </div>

        <div className="p-8">
            {downloadStatus === 'idle' || downloadStatus === 'error' ? (
                <div className="space-y-6">
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-start gap-3">
                        <ShieldAlert className="text-orange-600 shrink-0 mt-0.5" size={20} />
                        <div className="text-sm text-orange-800">
                            <p className="font-bold mb-1">Yêu cầu cập nhật bắt buộc</p>
                            <p>Để đảm bảo tính ổn định và bảo mật dữ liệu, bạn cần cập nhật lên phiên bản mới nhất để tiếp tục sử dụng phần mềm.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button 
                            onClick={onUpdateNow}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Download size={24} />
                            Cập nhật & Cài đặt ngay
                        </button>
                        
                        <button 
                            onClick={onUpdateLater}
                            className="w-full bg-white border-2 border-slate-200 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2 transition-all"
                        >
                            <Clock size={18} />
                            Tự động cập nhật sau 10 phút
                        </button>
                    </div>
                    
                    <p className="text-xs text-center text-slate-400">
                        * Nếu chọn "10 phút", hệ thống sẽ tự động tải và cài đặt khi hết giờ.
                    </p>
                </div>
            ) : (
                <div className="text-center space-y-6 py-4">
                    <div className="relative w-32 h-32 mx-auto">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                            <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={377} strokeDashoffset={377 - (377 * progress) / 100} className="text-blue-600 transition-all duration-300 ease-out" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-black text-slate-700">{Math.round(progress)}%</span>
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">
                            {downloadStatus === 'downloading' ? 'Đang tải bản cập nhật...' : 'Đang cài đặt...'}
                        </h3>
                        {downloadStatus === 'downloading' && downloadSpeed > 0 && (
                            <p className="text-sm font-mono text-blue-600 font-bold animate-pulse">
                                Tốc độ: {formatSpeed(downloadSpeed)}
                            </p>
                        )}
                        <p className="text-sm text-slate-500 mt-2">
                            Vui lòng không tắt phần mềm. Ứng dụng sẽ tự khởi động lại khi hoàn tất.
                        </p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default UpdateRequiredModal;
