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
    private readonly MAX_CONSECUTIVE_FAILURES_BEFORE_OFFLINE = 3; // Chỉ chuyển Offline khi thất bại 3 lần liên tiếp
    private listeners: Set<ConnectionListener> = new Set();
    private heartbeatTimer: any = null;
    private countdownTimer: any = null;
    private checkInProgress: Promise<boolean> | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleBrowserOnline);
            window.addEventListener('offline', this.handleBrowserOffline);
            
            // Khởi động nhịp tim định kỳ (45s khi bình thường để giảm tải)
            this.startHeartbeat(45000);

            // Kiểm tra kết nối ban đầu sau khi app nạp xong
            setTimeout(() => {
                this.ping();
            }, 2500);
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
        // Tránh gián đoạn: Nếu trình duyệt vẫn online thì không ép Offline ngay, chỉ ghi nhận để ping ngầm
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

    public async ping(): Promise<boolean> {
        if (this.checkInProgress) {
            return this.checkInProgress;
        }

        this.isChecking = true;
        this.notify();

        this.checkInProgress = (async () => {
            let success = false;
            try {
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    throw new Error("Trình duyệt đang ở chế độ Offline");
                }

                // Thực hiện ping nhẹ tới Supabase với timeout 12 giây
                const timeoutPromise = new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error("Timeout phản hồi kết nối máy chủ")), 12000)
                );

                const pingPromise = (async () => {
                    if (isConfigured && supabase) {
                        const { error } = await supabase.from('system_settings').select('key').limit(1);
                        // Chỉ coi là lỗi mất mạng nếu thực sự lỗi mạng kết nối, không tính lỗi bảng chưa tồn tại hoặc phân quyền
                        if (error && error.code !== 'PGRST116' && error.code !== '42P01' && error.code !== '42501' && (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch'))) {
                            throw error;
                        }
                        return true;
                    } else {
                        // Thử fetch nhẹ favicon hoặc origin
                        try {
                            const r = await fetch(window.location.origin + '/icon.png?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
                            return r.ok || r.status < 500;
                        } catch {
                            return true; // Fallback an toàn
                        }
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
                    this.startHeartbeat(45000);
                    if (!prevOnline) {
                        console.log("✅ Kết nối Internet & Máy chủ đã ổn định!");
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('app_connection_restored'));
                        }
                    }
                } else {
                    this.consecutiveFailures += 1;
                    // Chỉ chuyển sang offline khi thất bại liên tiếp đủ ngưỡng
                    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES_BEFORE_OFFLINE) {
                        this.isOnline = false;
                        this.failureReason = "Không thể kết nối đến máy chủ sau 3 lần thử. Vui lòng kiểm tra đường truyền.";
                        this.startReconnectLoop();
                    } else {
                        // Nếu chỉ rớt 1-2 lần, giữ nguyên isOnline để không gián đoạn người dùng và thử lại sau 3s
                        setTimeout(() => this.ping(), 3000);
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

