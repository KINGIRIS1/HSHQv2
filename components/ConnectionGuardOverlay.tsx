import React, { useState, useEffect } from 'react';
import { WifiOff, RotateCw, ShieldCheck, AlertCircle, ServerCrash } from 'lucide-react';
import { connectionManager, ConnectionState } from '../services/connectionService';

interface ConnectionGuardOverlayProps {
    onRestored?: () => void;
}

const ConnectionGuardOverlay: React.FC<ConnectionGuardOverlayProps> = ({ onRestored }) => {
    const [state, setState] = useState<ConnectionState>(connectionManager.getState());
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = connectionManager.subscribe((newState) => {
            setState(newState);
            if (!newState.isOnline) {
                setWasOffline(true);
            } else if (wasOffline && newState.isOnline) {
                if (onRestored) {
                    onRestored();
                }
                setWasOffline(false);
            }
        });
        return () => unsubscribe();
    }, [wasOffline, onRestored]);

    // Nếu đang online thì không render gì cả (hoàn toàn mở khóa tương tác)
    if (state.isOnline) {
        return null;
    }

    return (
        <div 
            id="connection-guard-overlay"
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md transition-all duration-300 select-none cursor-not-allowed"
            style={{ pointerEvents: 'all' }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="connection-guard-title"
            aria-describedby="connection-guard-desc"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className="relative w-full max-w-lg mx-4 bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-200/80 p-8 text-center animate-in fade-in zoom-in-95 duration-200 cursor-default">
                {/* Glow & Status Ring */}
                <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping duration-1000"></div>
                    <div className="absolute inset-2 rounded-full bg-amber-500/20 animate-pulse"></div>
                    <div className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                        <WifiOff size={40} className="stroke-[2.2]" />
                    </div>
                </div>

                {/* Primary Notice */}
                <h3 
                    id="connection-guard-title" 
                    className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug mb-3"
                >
                    Mất kết nối Internet hoặc kết nối máy chủ. Vui lòng đợi...
                </h3>

                <p 
                    id="connection-guard-desc" 
                    className="text-sm text-slate-600 font-medium leading-relaxed mb-6 px-2"
                >
                    Hệ thống đã tự động kích hoạt lớp bảo vệ dữ liệu. Toàn bộ thao tác tạm thời bị chặn để tránh mất mát hoặc ghi đè dữ liệu dở dang.
                </p>

                {/* Reconnect Progress & Countdown Box */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 mb-6 text-left space-y-3 shadow-inner">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span className="flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                            </span>
                            {state.isChecking ? 'Đang kiểm tra kết nối lại...' : 'Tiến trình tự động kết nối lại:'}
                        </span>
                        <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            {state.isChecking ? 'Đang ping...' : `Sau ${state.reconnectCountdown}s`}
                        </span>
                    </div>

                    {/* Progress Bar (5s loop) */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-amber-500 to-blue-600 h-2 rounded-full transition-all duration-1000 ease-linear"
                            style={{ 
                                width: state.isChecking ? '100%' : `${((5 - state.reconnectCountdown) / 5) * 100}%` 
                            }}
                        ></div>
                    </div>

                    {state.failureReason && (
                        <div className="text-[11px] text-rose-600 flex items-start gap-1.5 pt-1">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{state.failureReason}</span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                        id="btn-force-reconnect"
                        type="button"
                        disabled={state.isChecking}
                        onClick={() => connectionManager.ping()}
                        className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-bold shadow-md shadow-blue-600/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <RotateCw size={16} className={state.isChecking ? 'animate-spin' : ''} />
                        {state.isChecking ? 'Đang kết nối lại...' : 'Thử kết nối lại ngay'}
                    </button>
                </div>

                {/* Session Protected Badge */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50/60 rounded-xl py-2 px-3">
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>Phiên làm việc & biểu mẫu của bạn được giữ an toàn tuyệt đối.</span>
                </div>
            </div>
        </div>
    );
};

export default ConnectionGuardOverlay;
