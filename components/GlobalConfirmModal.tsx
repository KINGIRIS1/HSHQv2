import React, { useState, useEffect } from 'react';
import { setGlobalConfirmCallback } from '../utils/appHelpers';
import { Trash2, AlertTriangle, CheckCircle2, PenTool, HelpCircle, Layers, Send, RefreshCw, X } from 'lucide-react';

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

        // Tự động ghi đè hàm window.confirm của trình duyệt sang Global Confirm Modal bất đồng bộ
        // Khi mã nguồn cũ gọi window.confirm(...), sẽ kích hoạt modal chuyên nghiệp này
        const originalConfirm = window.confirm;
        (window as any).__originalConfirm = originalConfirm;
    }, []);

    const handleClose = (result: boolean) => {
        setIsOpen(false);
        if (resolveFn) {
            resolveFn(result);
            setResolveFn(null);
        }
    };

    // Lắng nghe phím Enter (Đồng ý) và Escape (Hủy)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleClose(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, resolveFn]);

    if (!isOpen) return null;

    const fullText = (title + ' ' + message).toLowerCase();
    const isDelete = /xóa|hủy|loại bỏ|delete|remove/i.test(fullText);
    const isSign = /ký|duyệt|trình ký|phê duyệt|sign|approve/i.test(fullText);
    const isBulk = /tất cả|hàng loạt|all|toàn bộ|chuyển bước/i.test(fullText);
    const isHandover = /bàn giao|trả kết quả|giao 1 cửa|xuất/i.test(fullText);

    let Icon = HelpCircle;
    let iconTheme = 'bg-blue-50 text-blue-600 ring-blue-50/80';
    let btnTheme = 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20';
    let confirmText = 'Đồng ý';

    if (isDelete) {
        Icon = Trash2;
        iconTheme = 'bg-red-50 text-red-600 ring-red-50/80';
        btnTheme = 'bg-red-600 hover:bg-red-700 shadow-red-500/20';
        confirmText = 'Đồng ý';
    } else if (isSign) {
        Icon = PenTool;
        iconTheme = 'bg-emerald-50 text-emerald-600 ring-emerald-50/80';
        btnTheme = 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20';
        confirmText = 'Đồng ý';
    } else if (isHandover) {
        Icon = Send;
        iconTheme = 'bg-teal-50 text-teal-600 ring-teal-50/80';
        btnTheme = 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20';
        confirmText = 'Đồng ý';
    } else if (isBulk) {
        Icon = Layers;
        iconTheme = 'bg-orange-50 text-orange-600 ring-orange-50/80';
        btnTheme = 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20';
        confirmText = 'Đồng ý';
    }

    return (
        <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleClose(false);
                }
            }}
        >
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-scale-up">
                {/* Nút tắt dấu X ở góc trên bên phải */}
                <button
                    type="button"
                    onClick={() => handleClose(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer z-10"
                    title="Tắt hộp thoại (Esc)"
                    aria-label="Tắt hộp thoại"
                >
                    <X size={20} />
                </button>

                {/* Body Content */}
                <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                    {/* Visual Status Indicator */}
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ring-8 transition-all duration-300 ${iconTheme}`}>
                        <Icon size={28} />
                    </div>
                    
                    {/* Modal Title */}
                    <h3 className="text-xl font-bold text-slate-900 mb-2.5">
                        {title || 'Xác nhận thao tác'}
                    </h3>
                    
                    {/* Modal Message */}
                    <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed max-w-md font-medium">
                        {message}
                    </p>

                    <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5 justify-center">
                        Nhấn <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600 font-semibold">Enter</kbd> để đồng ý hoặc <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-600 font-semibold">Esc</kbd> để hủy.
                    </p>
                </div>
                
                {/* Modal Footer Actions */}
                <div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 border-t border-slate-100">
                    <button 
                        type="button"
                        onClick={() => handleClose(false)}
                        className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-100 active:scale-[0.98] transition-all text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        type="button"
                        onClick={() => handleClose(true)}
                        className={`flex-1 py-3 text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all cursor-pointer ${btnTheme}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalConfirmModal;

