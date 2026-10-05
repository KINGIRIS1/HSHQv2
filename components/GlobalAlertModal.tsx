import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

let globalAlertCallback: null | ((message: string, title?: string) => void) = null;

export const triggerGlobalAlert = (message: string, title: string = 'Thông báo') => {
    if (globalAlertCallback) {
        globalAlertCallback(message, title);
    } else {
        try {
            window.alert(message);
        } catch {
            console.warn('Alert:', message);
        }
    }
};

const GlobalAlertModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('');

    useEffect(() => {
        globalAlertCallback = (msg: string, t?: string) => {
            setMessage(msg);
            setTitle(t || 'Thông báo');
            setIsOpen(true);
        };
        // Override global alert
        window.alert = (msg: any) => {
            if (globalAlertCallback) {
                globalAlertCallback(String(msg));
            } else {
                console.warn('Alert:', msg);
            }
        };
    }, []);

    if (!isOpen) return null;

    const handleClose = () => {
        setIsOpen(false);
    };

    const isError = title.toUpperCase().includes('LỖI') || title.toUpperCase().includes('CẢNH BÁO') || title.toUpperCase().includes('ERROR') || title.toUpperCase().includes('WARNING');

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up border border-slate-200">
                <div className={`px-5 py-4 border-b flex justify-between items-center ${isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-slate-200 text-blue-800'}`}>
                    <div className="flex items-center gap-2.5 font-black text-base">
                        <AlertCircle size={22} className={isError ? 'text-red-600 animate-pulse' : 'text-blue-600'} />
                        <span>{title}</span>
                    </div>
                    <button onClick={handleClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-line max-h-[60vh] overflow-y-auto">
                    {message}
                </div>
                <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex justify-end gap-2">
                    <button 
                        onClick={handleClose} 
                        className={`px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-md cursor-pointer transition-all active:scale-95 ${isError ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                    >
                        Đã hiểu & Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalAlertModal;
