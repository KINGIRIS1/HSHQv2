import { Buffer } from 'buffer';
import React, { ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// --- 1. SETUP POLYFILLS & MOCKS (CHẠY TRƯỚC KHI APP LOAD) ---

// Polyfill Buffer (Quan trọng cho các thư viện xử lý file)
if (typeof window !== 'undefined') {
  if (!(window as any).Buffer) {
    (window as any).Buffer = Buffer;
  }
  if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
  }

  // Mock Electron API cho trình duyệt Web
  // LƯU Ý: Chỉ expose những API an toàn trên Web. Các tính năng native (file system, capture, folder pickers, auto-update,...) cần kiểm tra tồn tại trước khi dùng.
  if (!(window as any).electronAPI) {
    console.warn("⚠️ Đang chạy trên trình duyệt Web. Các tính năng Native (Electron) sẽ bị giả lập.");

    (window as any).electronAPI = {
      // Đánh dấu rõ đây là môi trường Web
      isElectron: false,

      // Các API an toàn để dùng trên trình duyệt
      openExternal: async (url: string) => { window.open(url, '_blank'); },
      showNotification: async (title: string, body: string) => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const BrowserNotification = (window as any).Notification;
          if (BrowserNotification.permission === 'granted') {
            new BrowserNotification(title, { body });
            return true;
          } else if (BrowserNotification.permission !== 'denied') {
            const permission = await BrowserNotification.requestPermission();
            if (permission === 'granted') {
              new BrowserNotification(title, { body });
              return true;
            }
          }
        } else {
          console.log(`[Notification Muted] ${title}: ${body}`);
        }
        return false;
      },

      // Dialog xác nhận (đơn giản)
      showConfirmDialog: async (message: string, title?: string) => {
        return window.confirm(message);
      },

      // Tất cả các API native khác được đặt thành undefined để các kiểm tra `if (window.electronAPI && window.electronAPI.foo)` vẫn hoạt động
      captureScreenshot: undefined,
      saveAndOpenFile: undefined,
      openFilePath: undefined,
      selectFolder: undefined,
      checkForUpdate: async () => ({ status: 'web-mode', message: 'Bạn đang dùng bản Web' }),
      downloadUpdate: undefined,
      quitAndInstall: undefined,
      onUpdateStatus: undefined,
      removeUpdateListener: undefined,
      onNavigateToView: undefined,
      removeNavigationListener: undefined
    };
  }
}

// --- 2. ERROR BOUNDARY COMPONENT ---
// Bắt lỗi render để tránh màn hình trắng

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
  errorInfo: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("React Critical Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-8 text-center font-sans">
          <div className="bg-white p-8 rounded-xl shadow-xl max-w-2xl w-full border border-red-100">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Đã xảy ra lỗi hệ thống</h2>
            <p className="text-gray-600 mb-6">Ứng dụng gặp sự cố không thể hiển thị. Vui lòng tải lại trang hoặc liên hệ kỹ thuật.</p>
            
            <div className="bg-gray-100 p-4 rounded-lg text-left overflow-auto max-h-60 mb-6 border border-gray-200">
              <p className="font-mono text-red-700 text-sm font-bold mb-2">{this.state.error?.toString()}</p>
              <pre className="font-mono text-xs text-gray-500 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-md"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- 3. DYNAMIC IMPORT & RENDER APP ---
// Dùng import() để đảm bảo App chỉ được tải SAU KHI các polyfill bên trên đã chạy xong
const mountApp = async () => {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error("Không tìm thấy phần tử root");

    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );

    // Ẩn loader khi render thành công
    const loader = document.getElementById('initial-loader');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }, 500);
    }

  } catch (err) {
    console.error("Failed to mount application:", err);
    document.body.innerHTML = `<div style="color:red; padding:40px; text-align:center; font-family:sans-serif;">
      <h1>Critical Error</h1>
      <p>Không thể khởi động ứng dụng.</p>
      <pre>${err}</pre>
    </div>`;
  }
};

// Khởi chạy
mountApp();