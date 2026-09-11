import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface NetworkPingIndicatorProps {
  className?: string;
  isCompact?: boolean;
}

export const NetworkPingIndicator: React.FC<NetworkPingIndicatorProps> = ({
  className = '',
  isCompact = false,
}) => {
  const [latency, setLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  const measurePing = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setLatency(null);
      setLastChecked(new Date());
      return;
    }

    setIsPinging(true);
    const startTime = performance.now();

    try {
      // Gọi endpoint /api/ping với timestamp chống cache
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`/api/ping?_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        setLatency(duration);
        setIsOnline(true);
      } else {
        // Dự phòng: nếu api bị lỗi trạng thái, vẫn đo được roundtrip
        const endTime = performance.now();
        setLatency(Math.round(endTime - startTime));
        setIsOnline(true);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setLatency(6000); // Quá thời gian chờ (Timeout)
        setIsOnline(true);
      } else if (!navigator.onLine) {
        setIsOnline(false);
        setLatency(null);
      } else {
        // Fallback kiểm tra static asset nếu API server đang khởi động lại
        try {
          const fallbackStart = performance.now();
          await fetch(`/favicon.ico?_t=${Date.now()}`, { method: 'HEAD' });
          const fallbackEnd = performance.now();
          setLatency(Math.round(fallbackEnd - fallbackStart));
          setIsOnline(true);
        } catch {
          setLatency(null);
          setIsOnline(false);
        }
      }
    } finally {
      setIsPinging(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    // Đo ngay khi mount
    measurePing();

    // Chu kỳ đo định kỳ mỗi 12 giây
    timerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        measurePing();
      }
    }, 12000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        measurePing();
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      measurePing();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLatency(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [measurePing]);

  // Xác định trạng thái mạng
  let statusColor = 'bg-slate-400';
  let statusText = 'Đang kiểm tra...';
  let badgeBorder = 'border-white/20';
  let badgeBg = 'bg-white/10 hover:bg-white/15';

  if (!isOnline) {
    statusColor = 'bg-rose-500';
    statusText = 'Mất kết nối mạng';
    badgeBorder = 'border-rose-400/40';
    badgeBg = 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200';
  } else if (latency === null) {
    statusColor = 'bg-slate-400';
    statusText = 'Đang đo kết nối...';
  } else if (latency < 100) {
    statusColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
    statusText = 'Rất tốt (< 100ms)';
    badgeBorder = 'border-emerald-400/30';
    badgeBg = 'bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300';
  } else if (latency < 300) {
    statusColor = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]';
    statusText = 'Trung bình (100-300ms)';
    badgeBorder = 'border-amber-400/30';
    badgeBg = 'bg-amber-950/30 hover:bg-amber-900/40 text-amber-300';
  } else {
    statusColor = 'bg-rose-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]';
    statusText = 'Chậm (> 300ms)';
    badgeBorder = 'border-rose-400/30';
    badgeBg = 'bg-rose-950/30 hover:bg-rose-900/40 text-rose-300';
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        id="network-ping-indicator-btn"
        onClick={() => measurePing()}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title="Nhấp để kiểm tra lại tốc độ mạng"
        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${badgeBorder} ${badgeBg} backdrop-blur-xs transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-400/50 cursor-pointer select-none text-xs font-semibold`}
      >
        {/* Đèn báo tín hiệu */}
        <span className="relative flex h-2 w-2 items-center justify-center">
          {isOnline && latency !== null && latency < 300 && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                latency < 100 ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColor}`} />
        </span>

        {/* Biểu tượng mạng */}
        {!isOnline ? (
          <WifiOff size={13} className="text-rose-400" />
        ) : isPinging ? (
          <RefreshCw size={12} className="animate-spin text-blue-300" />
        ) : (
          <Activity size={13} className="opacity-80" />
        )}

        {/* Số ms ping */}
        <span className="tabular-nums font-mono text-[11px] tracking-tight">
          {!isOnline ? 'Offline' : latency !== null ? `${latency} ms` : '...'}
        </span>
      </button>

      {/* Tooltip hiển thị thông số chi tiết */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 z-50 w-56 p-2.5 bg-slate-900/95 text-white text-xs rounded-xl shadow-2xl border border-slate-700/60 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5 mb-1.5">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Wifi size={13} className="text-blue-400" /> Tốc độ phản hồi (Ping)
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {lastChecked ? lastChecked.toLocaleTimeString('vi-VN') : ''}
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Độ trễ máy chủ:</span>
              <span className="font-mono font-bold text-white">
                {!isOnline ? 'Mất kết nối' : latency !== null ? `${latency} ms` : 'Đang đo...'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Đánh giá:</span>
              <span className="font-medium text-slate-200">{statusText}</span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-blue-300 flex items-center gap-1">
            <RefreshCw size={10} className="text-blue-400" /> Nhấp vào để đo lại ngay
          </div>
        </div>
      )}
    </div>
  );
};
