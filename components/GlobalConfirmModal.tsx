import React, { useState, useEffect } from 'react';
import { setGlobalConfirmCallback } from '../utils/appHelpers';
import { Trash2, AlertTriangle, CheckCircle2, PenTool, HelpCircle } from 'lucide-react';

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

    const isDelete = /xóa|hủy|loại bỏ/i.test(title + ' ' + message);
    const isSign = /ký|duyệt|trình/i.test(title + ' ' + message);

    let Icon = HelpCircle;
    if (isDelete) {
        Icon = Trash2;
    } else if (isSign) {
        Icon = PenTool;
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-scale-up">
                {/* Body Content */}
                <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                    {/* Visual Status Indicator */}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ring-8 transition-all duration-300 ${
                        isDelete 
                            ? 'bg-red-50 text-red-600 ring-red-50/80' 
                            : isSign 
                                ? 'bg-emerald-50 text-emerald-600 ring-emerald-50/80' 
                                : 'bg-blue-50 text-blue-600 ring-blue-50/80'
                    }`}>
                        <Icon size={28} />
                    </div>
                    
                    {/* Modal Title */}
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                        {title || 'Xác nhận hành động'}
                    </h3>
                    
                    {/* Modal Message */}
                    <p className="text-sm text-slate-500 whitespace-pre-line leading-relaxed max-w-md">
                        {message}
                    </p>
                </div>
                
                {/* Modal Footer Actions */}
                <div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 border-t border-slate-100">
                    <button 
                        type="button"
                        onClick={() => handleClose(false)}
                        className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-100 active:scale-[0.98] transition-all text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                    >
                        Quay lại
                    </button>
                    <button 
                        type="button"
                        onClick={() => handleClose(true)}
                        className={`flex-1 py-3 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer ${
                            isDelete 
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/10' 
                                : isSign 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10' 
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'
                        }`}
                    >
                        {isDelete ? 'Xác nhận xóa' : isSign ? 'Đồng ý ký duyệt' : 'Xác nhận'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalConfirmModal;
