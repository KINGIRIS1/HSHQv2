import React, { useState, useEffect } from 'react';
import { setGlobalConfirmCallback } from '../utils/appHelpers';
import { AlertCircle, X } from 'lucide-react';

const GlobalConfirmModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('');
    const [resolveFn, setResolveFn] = useState<((val: boolean) => void) | null>(null);

    useEffect(() => {
        setGlobalConfirmCallback((msg: string, t: string) => {
            setMessage(msg);
            setTitle(t);
            setIsOpen(true);
            return new Promise<boolean>((resolve) => {
                setResolveFn(() => resolve);
            });
        });
    }, []);

    if (!isOpen) return null;

    const handleClose = (result: boolean) => {
        setIsOpen(false);
        if (resolveFn) {
            resolveFn(result);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-gray-700 font-bold">
                        <AlertCircle size={18} className="text-orange-500" />
                        {title}
                    </div>
                    <button onClick={() => handleClose(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 text-gray-600 text-sm whitespace-pre-line">
                    {message}
                </div>
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                    <button 
                        onClick={() => handleClose(false)} 
                        className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={() => handleClose(true)} 
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm"
                    >
                        Đồng ý
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalConfirmModal;
