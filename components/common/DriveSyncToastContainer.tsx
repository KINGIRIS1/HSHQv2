import React, { useEffect, useState } from 'react';
import { subscribeDriveToast } from '../../services/attachmentStorage';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

export const DriveSyncToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeDriveToast((item) => {
      const id = `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newToast: ToastItem = { ...item, id };
      setToasts((prev) => [...prev.slice(-4), newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let bgClass = 'bg-white border-blue-200 text-blue-900 shadow-lg';
        let Icon = Info;
        let iconColor = 'text-blue-500';

        if (toast.type === 'success') {
          bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-lg';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-500';
        } else if (toast.type === 'error') {
          bgClass = 'bg-rose-50 border-rose-200 text-rose-900 shadow-lg';
          Icon = AlertCircle;
          iconColor = 'text-rose-500';
        } else if (toast.type === 'warning') {
          bgClass = 'bg-amber-50 border-amber-200 text-amber-900 shadow-lg';
          Icon = AlertTriangle;
          iconColor = 'text-amber-500';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-all animate-in slide-in-from-bottom-3 duration-200 ${bgClass}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <h5 className="font-semibold text-xs uppercase tracking-wide opacity-90">{toast.title}</h5>
              <p className="mt-0.5 text-xs leading-relaxed opacity-85 break-words whitespace-pre-line">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-gray-400 hover:text-gray-600 shrink-0 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
