import { supabase, isConfigured } from './supabaseClient';

export type ConnectionState = {
    isOnline: boolean;
    isChecking: boolean;
    lastChecked: number;
    failureReason?: string;
    reconnectCountdown: number; // 5..0
};

type ConnectionListener = (state: ConnectionState) => void;

class ConnectionManager {
    private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private isChecking: boolean = false;
    private lastChecked: number = Date.now();
    private failureReason: string | undefined = undefined;
    private reconnectCountdown: number = 5;
    private listeners: Set<ConnectionListener> = new Set();
    private heartbeatTimer: any = null;
    private countdownTimer: any = null;
    private checkInProgress: Promise<boolean> | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleBrowserOnline);
            window.addEventListener('offline', this.handleBrowserOffline);
            
            // Khởi động nhịp tim định kỳ (30s khi bình thường)
            this.startHeartbeat(30000);

            // Kiểm tra kết nối ban đầu
            setTimeout(() => {
                this.ping();
            }, 1000);
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
            reconnectCountdown: this.reconnectCountdown
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
        console.log("🌐 Trình duyệt phát hiện có mạng lại, đang kiểm tra kết nối tới máy chủ...");
        this.ping();
    };

    private handleBrowserOffline = () => {
        console.warn("❌ Trình duyệt phát hiện mất mạng (Offline event).");
        this.isOnline = false;
        this.failureReason = "Không có kết nối Internet (Thiết bị đang ngoại tuyến)";
        this.startReconnectLoop();
        this.notify();
    };

    public reportNetworkError(context: string, error?: any) {
        // Chỉ kích hoạt nếu lỗi thực sự là do Network / Fetch / Offline / Timeout
        const errorMsg = error?.message || (typeof error === 'string' ? error : '');
        const isNetworkErr = 
            !navigator.onLine ||
            errorMsg.includes('Failed to fetch') ||
            errorMsg.includes('NetworkError') ||
            errorMsg.includes('Network request failed') ||
            errorMsg.includes('Load failed') ||
            errorMsg.includes('ERR_INTERNET_DISCONNECTED') ||
            errorMsg.includes('ERR_CONNECTION_REFUSED') ||
            errorMsg.includes('Timeout') ||
            error?.status === 0;

        if (isNetworkErr) {
            console.warn(`[ConnectionManager] Phát hiện lỗi kết nối từ API (${context}):`, errorMsg);
            if (this.isOnline) {
                this.isOnline = false;
                this.failureReason = `Không thể gửi dữ liệu tới máy chủ (${context})`;
                this.startReconnectLoop();
                this.notify();
                // Kích hoạt ping để thử lại ngay
                this.ping();
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

                // Thực hiện ping nhẹ tới Supabase với timeout 5 giây
                const timeoutPromise = new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error("Timeout kết nối máy chủ (5s)")), 5000)
                );

                const pingPromise = (async () => {
                    if (isConfigured && supabase) {
                        // Thử truy vấn nhẹ 1 bản ghi bất kỳ từ system_settings hoặc head count
                        const { error } = await supabase.from('system_settings').select('key').limit(1);
                        if (error && error.code !== 'PGRST116' && error.code !== '42P01' && (error.message?.includes('fetch') || error.message?.includes('network'))) {
                            throw error;
                        }
                        return true;
                    } else {
                        // Thử fetch nhẹ favicon hoặc origin
                        const r = await fetch(window.location.origin + '/icon.png?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
                        return r.ok;
                    }
                })();

                await Promise.race([pingPromise, timeoutPromise]);
                success = true;
            } catch (err: any) {
                success = false;
                this.failureReason = err?.message || "Không thể phản hồi từ máy chủ Supabase";
                console.warn("[ConnectionManager] Ping thất bại:", err?.message || err);
            } finally {
                this.isChecking = false;
                this.lastChecked = Date.now();
                this.checkInProgress = null;

                const prevOnline = this.isOnline;
                this.isOnline = success;

                if (success) {
                    this.failureReason = undefined;
                    this.stopReconnectLoop();
                    this.startHeartbeat(30000);
                    if (!prevOnline) {
                        console.log("✅ Kết nối Internet & Máy chủ đã được khôi phục thành công!");
                        // Bắn event để các thành phần khác có thể bắt
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('app_connection_restored'));
                        }
                    }
                } else {
                    this.startReconnectLoop();
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
