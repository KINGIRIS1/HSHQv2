import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { networkMonitor } from '../services/networkMonitor';

interface NetworkOfflineModalProps {
  onOnlineRestored?: () => void;
}

export const NetworkOfflineModal: React.FC<NetworkOfflineModalProps> = ({ onOnlineRestored }) => {
  const [isOffline, setIsOffline] = useState<boolean>(() => !networkMonitor.isOnline);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [showRestoredNotice, setShowRestoredNotice] = useState<boolean>(false);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isOfflineRef = useRef<boolean>(isOffline);
  isOfflineRef.current = isOffline;

  const handleOnline = useCallback(() => {
    const wasOffline = isOfflineRef.current;
    setIsOffline(false);
    isOfflineRef.current = false;
    
    if (wasOffline) {
      setShowRestoredNotice(true);
      if (onOnlineRestored) {
        onOnlineRestored();
      }
      setTimeout(() => {
        setShowRestoredNotice(false);
      }, 4000);
    }
  }, [onOnlineRestored]);

  const handleOffline = useCallback(() => {
    setIsOffline(true);
    isOfflineRef.current = true;
    setShowRestoredNotice(false);
    setCountdown(5);
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    const connected = await networkMonitor.checkBackendNow();
    setIsChecking(false);
    if (connected) {
      handleOnline();
    } else {
      setIsOffline(true);
      setCountdown(5);
    }
  };

  // Subscribe to Network Monitor and run lightweight adaptive heartbeat (3-4s)
  useEffect(() => {
    // 1. Subscribe to central NetworkMonitor events
    const unsubscribe = networkMonitor.subscribe((online) => {
      if (online) {
        handleOnline();
      } else {
        handleOffline();
      }
    });

    // 2. Initial probe to verify backend on mount
    networkMonitor.checkBackendNow();

    // 3. Adaptive Heartbeat (every 4 seconds) to Backend /api/health with single-flight check
    const heartbeatInterval = setInterval(() => {
      networkMonitor.checkBackendNow();
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(heartbeatInterval);
    };
  }, [handleOnline, handleOffline]);

  // Countdown auto-retry when offline
  useEffect(() => {
    if (!isOffline) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      return;
    }

    countdownTimerRef.current = setInterval(async () => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger automatic re-check
          networkMonitor.checkBackendNow().then((connected) => {
            if (connected) {
              handleOnline();
            }
          });
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isOffline, handleOnline]);

  return (
    <>
      {/* RESTORED NOTICE TOAST */}
      {showRestoredNotice && (
        <div 
          id="network-restored-banner"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
        >
          <CheckCircle2 size={20} className="text-emerald-100 shrink-0" />
          <div>
            <div className="font-bold text-sm">Đã kết nối mạng trở lại!</div>
            <div className="text-xs text-emerald-100 font-medium">Phiên làm việc và dữ liệu mới nhất đã được đồng bộ tự động.</div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN BLOCKING OVERLAY WHEN OFFLINE */}
      {isOffline && (
        <div 
          id="network-offline-blocking-modal"
          className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none cursor-not-allowed"
          style={{ pointerEvents: 'all' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center relative overflow-hidden animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top red alert banner accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse" />

            {/* Glowing Icon */}
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-center text-red-600 shadow-inner relative">
              <WifiOff size={40} className="animate-bounce" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow">
                <ShieldAlert size={14} />
              </div>
            </div>

            {/* Title & Description */}
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 tracking-tight">
              Mất kết nối mạng Internet!
            </h2>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed font-medium">
              Hệ thống đã tạm dừng và <strong className="text-red-600">khóa mọi thao tác</strong> để đảm bảo an toàn tuyệt đối, tránh sai lệch dữ liệu hồ sơ.
            </p>

            {/* Status box with Countdown */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-6 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  Trạng thái:
                </span>
                <span className="text-red-600 font-bold">Chưa thể kết nối Server</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Tự động kết nối lại sau:</span>
                <span className="text-blue-600 font-black font-mono text-sm">{countdown}s</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className="bg-blue-600 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Reassurance Notice */}
            <div className="flex items-start gap-2.5 text-left bg-blue-50/70 p-3.5 rounded-xl border border-blue-100 mb-6">
              <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-normal font-medium">
                <strong>An tâm:</strong> Tài khoản và phiên làm việc hiện tại của bạn được bảo lưu nguyên vẹn, <span className="underline decoration-blue-400 font-semibold">không cần đăng nhập lại</span> khi mạng được khôi phục.
              </p>
            </div>

            {/* Manual Retry Button */}
            <button
              id="btn-retry-connection-now"
              onClick={handleManualRetry}
              disabled={isChecking}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-[0.98]"
            >
              <RefreshCw size={17} className={isChecking ? 'animate-spin' : ''} />
              {isChecking ? 'Đang kiểm tra kết nối...' : 'Thử kết nối lại ngay'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NetworkOfflineModal;
