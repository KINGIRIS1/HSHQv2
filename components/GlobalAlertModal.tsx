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

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-blue-700 font-bold">
                        <AlertCircle size={18} className="text-blue-500" />
                        {title}
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 text-gray-600 text-sm whitespace-pre-line">
                    {message}
                </div>
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <button 
                        onClick={handleClose} 
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalAlertModal;
