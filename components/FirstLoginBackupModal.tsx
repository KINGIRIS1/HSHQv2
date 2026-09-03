import React, { useState } from 'react';
import { ShieldCheck, Download, X, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { EXCEL_BACKUP_FILENAME } from '../services/excelBackupService';

interface FirstLoginBackupModalProps {
    isOpen: boolean;
    recordCount: number;
    onConfirmBackup: () => Promise<void> | void;
    onClose: () => void;
}

export const FirstLoginBackupModal: React.FC<FirstLoginBackupModalProps> = ({
    isOpen,
    recordCount,
    onConfirmBackup,
    onClose
}) => {
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    if (!isOpen) return null;

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            await onConfirmBackup();
            setIsCompleted(true);
            setTimeout(() => {
                onClose();
            }, 1200);
        } catch (error) {
            console.error("Lỗi khi thực hiện sao lưu:", error);
            setIsBackingUp(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-xl text-white shadow-inner">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold leading-tight">
                                Khởi tạo sao lưu dữ liệu dự phòng
                            </h3>
                            <p className="text-xs text-emerald-100 mt-0.5 font-medium">
                                Thông báo khởi tạo cho Quản trị viên
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isBackingUp}
                        className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors disabled:opacity-50"
                        title="Đóng thông báo"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-3 bg-emerald-50/80 border border-emerald-100 rounded-xl p-3.5">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-900 leading-relaxed">
                            Toàn bộ <span className="font-bold text-emerald-700">{recordCount.toLocaleString('vi-VN')}</span> hồ sơ lưu trữ đã được đồng bộ sẵn sàng vào hệ thống.
                        </div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                        <p>
                            Đây là <strong>lần đầu tiên đăng nhập</strong> bằng tài khoản Quản trị viên. Bạn có muốn tạo và tải ngay một bản sao lưu dữ liệu hoàn chỉnh dạng tệp Excel (<strong>{EXCEL_BACKUP_FILENAME}</strong>) về máy tính để lưu trữ an toàn không?
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-500 space-y-1">
                            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                                💡 Quy tắc hoạt động:
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                                <li>Bảng nhắc nhở này <strong>chỉ xuất hiện duy nhất 1 lần</strong> vào lần đầu đăng nhập.</li>
                                <li>Nếu bấm <strong>Đóng [X]</strong> hoặc <strong>Để sau</strong>, ứng dụng tiếp tục hoạt động bình thường và không hiển thị lại thông báo này.</li>
                                <li>Bạn có thể chủ động tải bản sao lưu bất kỳ lúc nào tại mục <strong>Cài đặt Hệ thống</strong>.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isBackingUp}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-all disabled:opacity-50"
                    >
                        Để sau / Bỏ qua
                    </button>
                    <button
                        type="button"
                        onClick={handleBackup}
                        disabled={isBackingUp || isCompleted}
                        className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-60"
                    >
                        {isCompleted ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-white animate-scale-up" />
                                <span>Đã hoàn tất sao lưu!</span>
                            </>
                        ) : isBackingUp ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Đang xuất file Excel...</span>
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                <span>Tiến hành Sao lưu & Tải về</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FirstLoginBackupModal;
