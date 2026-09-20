import React, { useState, useRef, useEffect } from 'react';
import { X, FileSignature, Loader2 } from 'lucide-react';

interface BulkSignConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (() => Promise<void>) | (() => void);
    count: number;
}

const BulkSignConfirmModal: React.FC<BulkSignConfirmModalProps> = ({ isOpen, onClose, onConfirm, count }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (isSubmittingRef.current || isSubmitting) return;
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        try {
            await onConfirm();
            onClose();
        } catch (err) {
            console.error("Lỗi ký duyệt đợt:", err);
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-[9999] p-4 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-up border border-slate-100">
                {/* Purple header color band */}
                <div className="bg-purple-600 px-5 py-4 flex justify-between items-center text-white shadow-sm">
                    <h2 className="text-lg font-bold flex items-center gap-2 tracking-wide">
                        <FileSignature size={20} className="shrink-0" />
                        Ký duyệt
                    </h2>
                    <button 
                        onClick={onClose} 
                        disabled={isSubmitting}
                        className="text-purple-100 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                        aria-label="Đóng"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-7">
                    <p className="text-slate-700 text-[15px] font-medium leading-relaxed">
                        Bạn đang ký duyệt <span className="font-extrabold text-purple-600 text-lg mx-1">{count}</span> hồ sơ.
                    </p>
                </div>

                {/* Footer with 2 Action Buttons */}
                <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                    <button 
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 active:scale-[0.98] transition-all text-slate-700 font-bold text-sm rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button 
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-md shadow-purple-500/10 hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Đang duyệt</span>
                            </>
                        ) : (
                            <span>Đồng ý</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkSignConfirmModal;
