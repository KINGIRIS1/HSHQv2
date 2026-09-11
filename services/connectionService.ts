import { supabase, isConfigured } from './supabaseClient';

export type ConnectionState = {
    isOnline: boolean;
    isChecking: boolean;
    lastChecked: number;
    failureReason?: string;
    reconnectCountdown: number; // 5..0
    consecutiveFailures: number;
};

type ConnectionListener = (state: ConnectionState) => void;

class ConnectionManager {
    private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private isChecking: boolean = false;
    private lastChecked: number = Date.now();
    private failureReason: string | undefined = undefined;
    private reconnectCountdown: number = 5;
    private consecutiveFailures: number = 0;
    // Tăng ngưỡng thất bại liên tiếp lên 5 lần để tránh false alarm khi mạng chỉ lag nhẹ 1-2s
    private readonly MAX_CONSECUTIVE_FAILURES_BEFORE_OFFLINE = 5;
    private listeners: Set<ConnectionListener> = new Set();
    private heartbeatTimer: any = null;
    private countdownTimer: any = null;
    private checkInProgress: Promise<boolean> | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleBrowserOnline);
            window.addEventListener('offline', this.handleBrowserOffline);
            
            // Nhịp tim kiểm tra định kỳ 60s khi bình thường
            this.startHeartbeat(60000);

            // Kiểm tra kết nối ban đầu sau khi app nạp xong 3s
            setTimeout(() => {
                this.ping();
            }, 3000);
        }
    }

    public subscribe(listener: ConnectionListener): () => void {
        this.listeners.add(listener);
        listener(this.getState());
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getState(): ConnectionState {
        return {
            isOnline: this.isOnline,
            isChecking: this.isChecking,
            lastChecked: this.lastChecked,
            failureReason: this.failureReason,
            reconnectCountdown: this.reconnectCountdown,
            consecutiveFailures: this.consecutiveFailures
        };
    }

    private notify() {
        const state = this.getState();
        this.listeners.forEach(fn => {
            try {
                fn(state);
            } catch (err) {
                console.error("Error in connection listener:", err);
            }
        });
    }

    private handleBrowserOnline = () => {
        console.log("🌐 Trình duyệt phát hiện có mạng, tiến hành kiểm tra kết nối...");
        this.consecutiveFailures = 0;
        this.ping();
    };

    private handleBrowserOffline = () => {
        console.warn("❌ Trình duyệt phát hiện mất mạng ngoại tuyến.");
        this.consecutiveFailures = this.MAX_CONSECUTIVE_FAILURES_BEFORE_OFFLINE;
        this.isOnline = false;
        this.failureReason = "Không có kết nối Internet (Thiết bị đang ngoại tuyến)";
        this.startReconnectLoop();
        this.notify();
    };

    public reportNetworkError(context: string, error?: any) {
        // Nếu trình duyệt vẫn online thì không ép Offline ngay, chỉ ghi nhận để ping ngầm kiểm chứng
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            this.handleBrowserOffline();
            return;
        }

        const errorMsg = error?.message || (typeof error === 'string' ? error : '');
        const isCriticalDisconnect = 
            errorMsg.includes('ERR_INTERNET_DISCONNECTED') ||
            errorMsg.includes('net::ERR_NAME_NOT_RESOLVED');

        if (isCriticalDisconnect) {
            this.consecutiveFailures++;
            if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES_BEFORE_OFFLINE && this.isOnline) {
                this.isOnline = false;
                this.failureReason = `Mất kết nối máy chủ (${context})`;
                this.startReconnectLoop();
                this.notify();
            }
        }
    }

    /**
     * Cơ chế ping đa tầng thông minh (Multi-Tier Resilient Ping):
     * 1. Kiểm tra trạng thái mạng của trình duyệt (navigator.onLine)
     * 2. Ping nhẹ tới chính domain web app để xác nhận Internet vẫn hoạt động
     * 3. Ping tới Supabase với timeout an toàn 25 giây
     */
    public async ping(): Promise<boolean> {
        if (this.checkInProgress) {
            return this.checkInProgress;
        }

        this.isChecking = true;
        this.notify();

        this.checkInProgress = (async () => {
            let success = false;
            try {
                // Tầng 1: Kiểm tra phần cứng mạng
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    throw new Error("Trình duyệt đang ở chế độ Offline");
                }

                // Tầng 2 & 3: Ping kiểm chứng máy chủ với timeout 25s (chống timeout oan khi mạng trễ)
                const timeoutPromise = new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error("Timeout phản hồi kết nối")), 25000)
                );

                const pingPromise = (async () => {
                    let internetOk = false;
                    try {
                        // Thử ping nhẹ vào static asset nội bộ của ứng dụng trước
                        const staticResp = await fetch(`${window.location.origin}/favicon.ico?_ping=${Date.now()}`, { 
                            method: 'HEAD', 
                            cache: 'no-store' 
                        }).catch(() => null);
                        if (staticResp && (staticResp.ok || staticResp.status < 500)) {
                            internetOk = true;
                        }
                    } catch {
                        // Bỏ qua lỗi favicon
                    }

                    if (isConfigured && supabase) {
                        // Ping kiểm tra Supabase
                        const { error } = await supabase.from('system_settings').select('key').limit(1);
                        
                        // Chỉ coi là lỗi kết nối nếu thật sự lỗi mạng, bỏ qua các mã lỗi logic dữ liệu
                        if (error && error.code !== 'PGRST116' && error.code !== '42P01' && error.code !== '42501' && (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch'))) {
                            // Nếu static app vẫn truy cập được, mạng máy khách vẫn bình thường -> coi như tạm kết nối
                            if (internetOk) {
                                return true;
                            }
                            throw error;
                        }
                        return true;
                    } else {
                        return internetOk || true;
                    }
                })();

                await Promise.race([pingPromise, timeoutPromise]);
                success = true;
            } catch (err: any) {
                success = false;
                console.warn("[ConnectionManager] Ping lần này không thành công:", err?.message || err);
            } finally {
                this.isChecking = false;
                this.lastChecked = Date.now();
                this.checkInProgress = null;

                const prevOnline = this.isOnline;

                if (success) {
                    this.consecutiveFailures = 0;
                    this.isOnline = true;
                    this.failureReason = undefined;
                    this.stopReconnectLoop();
                    this.startHeartbeat(60000);
                    if (!prevOnline) {
                        console.log("✅ Kết nối Internet & Máy chủ đã ổn định!");
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('app_connection_restored'));
                        }
                    }
                } else {
                    this.consecutiveFailures += 1;
                    // Chỉ chuyển sang offline khi thất bại liên tiếp đủ ngưỡng (>= 5 lần)
                    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES_BEFORE_OFFLINE) {
                        this.isOnline = false;
                        this.failureReason = "Không thể kết nối đến máy chủ sau nhiều lần thử. Vui lòng kiểm tra đường truyền.";
                        this.startReconnectLoop();
                    } else {
                        // Nếu chỉ rớt 1-4 lần, giữ nguyên isOnline để không làm gián đoạn người dùng và thử lại sau 5s
                        setTimeout(() => this.ping(), 5000);
                    }
                }

                this.notify();
            }

            return success;
        })();

        return this.checkInProgress;
    }

    private startReconnectLoop() {
        if (this.countdownTimer) return;
        this.reconnectCountdown = 5;

        this.countdownTimer = setInterval(() => {
            if (this.isOnline) {
                this.stopReconnectLoop();
                return;
            }

            this.reconnectCountdown -= 1;
            if (this.reconnectCountdown <= 0) {
                this.reconnectCountdown = 5;
                this.notify();
                this.ping();
            } else {
                this.notify();
            }
        }, 1000);
    }

    private stopReconnectLoop() {
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        this.reconnectCountdown = 5;
    }

    private startHeartbeat(intervalMs: number) {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        this.heartbeatTimer = setInterval(() => {
            if (this.isOnline && !this.isChecking) {
                this.ping();
            }
        }, intervalMs);
    }
}

export const connectionManager = new ConnectionManager();

