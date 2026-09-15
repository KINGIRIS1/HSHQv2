import React, { useState, useEffect } from 'react';
import { setGlobalConfirmCallback } from '../utils/appHelpers';
import { Trash2, AlertTriangle, CheckCircle2, PenTool, HelpCircle, X } from 'lucide-react';

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

    const handleClose = (result: boolean) => {
        setIsOpen(false);
        if (resolveFn) {
            resolveFn(result);
            setResolveFn(null);
        }
    };

    // Lắng nghe phím Escape để đóng hộp thoại mà không thực hiện thao tác (trả về false)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, resolveFn]);

    if (!isOpen) return null;

    const isDelete = /xóa|hủy|loại bỏ/i.test(title + ' ' + message);
    const isSign = /ký|duyệt|trình/i.test(title + ' ' + message);

    let Icon = HelpCircle;
    if (isDelete) {
        Icon = Trash2;
    } else if (isSign) {
        Icon = PenTool;
    }

    return (
        <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => {
                // Bấm ra ngoài nền đen để đóng hộp thoại mà KHÔNG thực hiện (trả về false)
                if (e.target === e.currentTarget) {
                    handleClose(false);
                }
            }}
        >
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-scale-up">
                {/* Nút tắt dấu X ở góc trên bên phải - nếu tắt bằng dấu X thì không xóa */}
                <button
                    type="button"
                    onClick={() => handleClose(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer z-10"
                    title="Tắt hộp thoại (Không thực hiện)"
                    aria-label="Tắt hộp thoại"
                >
                    <X size={20} />
                </button>

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
                    <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed max-w-md font-medium">
                        {message}
                    </p>

                    {isDelete && (
                        <p className="text-xs text-slate-400 mt-2">
                            Nếu bạn tắt dấu <strong>X</strong> hoặc chọn <strong>Hủy</strong>, hành động sẽ được hủy bỏ an toàn.
                        </p>
                    )}
                </div>
                
                {/* Modal Footer Actions */}
                <div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 border-t border-slate-100">
                    <button 
                        type="button"
                        onClick={() => handleClose(false)}
                        className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-100 active:scale-[0.98] transition-all text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                    >
                        Hủy
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
                        {isDelete ? 'Đồng ý xóa' : 'Xác nhận'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalConfirmModal;
