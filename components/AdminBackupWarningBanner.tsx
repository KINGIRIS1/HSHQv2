import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { AlertTriangle, Settings, X, FolderOpen } from 'lucide-react';
import { getExcelBackupDirectory } from '../services/excelBackupService';

interface AdminBackupWarningBannerProps {
    currentUser: User | null;
    onOpenSettings: () => void;
}

export const AdminBackupWarningBanner: React.FC<AdminBackupWarningBannerProps> = ({
    currentUser,
    onOpenSettings
}) => {
    const [hasBackupDir, setHasBackupDir] = useState<boolean | null>(null);
    const [isDismissed, setIsDismissed] = useState<boolean>(false);

    const isAdmin = currentUser?.role === UserRole.ADMIN;

    // Chỉ kiểm tra đối với tài khoản Quản trị viên
    useEffect(() => {
        if (!isAdmin) {
            setHasBackupDir(true);
            return;
        }

        let isMounted = true;
        const checkDir = async () => {
            const dir = await getExcelBackupDirectory();
            if (isMounted) {
                setHasBackupDir(!!(dir && dir.trim()));
            }
        };

        checkDir();

        // Lắng nghe sự kiện khi Admin cập nhật đường dẫn sao lưu
        const handleDirUpdated = (e: any) => {
            const newDir = e.detail?.directory;
            setHasBackupDir(!!(newDir && newDir.trim()));
        };

        window.addEventListener('excel_backup_dir_updated', handleDirUpdated);
        return () => {
            isMounted = false;
            window.removeEventListener('excel_backup_dir_updated', handleDirUpdated);
        };
    }, [isAdmin]);

    // QUY TẮC BẮT BUỘC:
    // 1. Chỉ hiện với tài khoản Admin
    // 2. Không hiện với bất cứ tài khoản khác
    // 3. Chỉ hiện nếu chưa chọn đường dẫn (hasBackupDir === false)
    if (!isAdmin || hasBackupDir !== false || isDismissed) {
        return null;
    }

    return (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-amber-900 transition-all animate-fade-in-down select-none">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                        <AlertTriangle size={18} />
                    </div>
                    <div className="text-xs sm:text-sm">
                        <span className="font-black text-amber-900 mr-2 uppercase tracking-wide text-[11px] bg-amber-200/80 px-2 py-0.5 rounded">
                            Chỉ dành cho Quản trị viên
                        </span>
                        <span className="font-semibold text-amber-950">
                            Chưa thiết lập đường dẫn sao lưu Excel định kỳ (5 ngày/lần).
                        </span>
                        <span className="hidden md:inline text-amber-800 ml-1">
                            Vui lòng cấu hình thư mục lưu trữ trong tab Chung để tự động xuất và ghi đè file hồ sơ.
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                        onClick={onOpenSettings}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                        <FolderOpen size={14} />
                        <span>Thiết lập ngay</span>
                    </button>
                    <button
                        onClick={() => setIsDismissed(true)}
                        className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                        title="Tạm ẩn thông báo"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminBackupWarningBanner;
