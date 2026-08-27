/**
 * Central Network Event Bus & Monitor Core
 * Emits network state changes and coordinates offline modal locking immediately.
 */

type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkMonitor {
    private static instance: NetworkMonitor;
    private listeners: Set<NetworkStatusListener> = new Set();
    private _isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private isCheckingBackend: boolean = false;

    private constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('offline', () => {
                this.notifyStatus(false);
            });
            window.addEventListener('online', () => {
                this.checkBackendNow();
            });
        }
    }

    public static getInstance(): NetworkMonitor {
        if (!NetworkMonitor.instance) {
            NetworkMonitor.instance = new NetworkMonitor();
        }
        return NetworkMonitor.instance;
    }

    public get isOnline(): boolean {
        return this._isOnline;
    }

    public subscribe(listener: NetworkStatusListener): () => void {
        this.listeners.add(listener);
        listener(this._isOnline);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Immediately broadcast connection lost (0.05s response)
     */
    public triggerConnectionLost(): void {
        if (this._isOnline) {
            console.warn('⚠️ [NetworkMonitor] Immediate connection lost triggered by API failure or network event.');
            this.notifyStatus(false);
        }
    }

    /**
     * Broadcast connection restored
     */
    public triggerConnectionRestored(): void {
        if (!this._isOnline) {
            console.info('✅ [NetworkMonitor] Connection restored.');
            this.notifyStatus(true);
        }
    }

    /**
     * Probe internal backend /api/health with single-flight lock
     */
    public async checkBackendNow(): Promise<boolean> {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            this.notifyStatus(false);
            return false;
        }

        if (this.isCheckingBackend) {
            return this._isOnline;
        }

        this.isCheckingBackend = true;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`/api/health?t=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal,
            }).catch(() => null);

            clearTimeout(timeoutId);

            if (response && (response.ok || response.status < 500)) {
                this.triggerConnectionRestored();
                return true;
            }

            // Fallback root ping
            const fallbackController = new AbortController();
            const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 2000);
            const fallback = await fetch(`/?t=${Date.now()}`, {
                method: 'HEAD',
                cache: 'no-store',
                signal: fallbackController.signal,
            }).catch(() => null);

            clearTimeout(fallbackTimeoutId);

            if (fallback && (fallback.ok || fallback.status < 500)) {
                this.triggerConnectionRestored();
                return true;
            }

            this.triggerConnectionLost();
            return false;
        } catch {
            this.triggerConnectionLost();
            return false;
        } finally {
            this.isCheckingBackend = false;
        }
    }

    private notifyStatus(online: boolean): void {
        const changed = this._isOnline !== online;
        this._isOnline = online;
        if (changed) {
            this.listeners.forEach((fn) => {
                try {
                    fn(online);
                } catch (e) {
                    console.error('Error in network listener:', e);
                }
            });
        }
    }
}

export const networkMonitor = NetworkMonitor.getInstance();

/**
 * Utility helper to check if an error is a network connection failure
 */
export const isNetworkError = (error: any): boolean => {
    if (!error) return false;
    const msg = typeof error === 'string' 
        ? error 
        : (error.message || error.error_description || error.details || JSON.stringify(error) || '');
    
    const lower = String(msg).toLowerCase();
    return (
        lower.includes('failed to fetch') ||
        lower.includes('networkerror') ||
        lower.includes('network error') ||
        lower.includes('err_network') ||
        lower.includes('err_internet_disconnected') ||
        lower.includes('connection refused') ||
        lower.includes('timed out') ||
        lower.includes('timeout') ||
        lower.includes('load failed') ||
        lower.includes('aborted')
    );
};
