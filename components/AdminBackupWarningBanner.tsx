import React from 'react';
import { User } from '../types';

interface AdminBackupWarningBannerProps {
    currentUser: User | null;
    onOpenSettings: () => void;
}

export const AdminBackupWarningBanner: React.FC<AdminBackupWarningBannerProps> = () => {
    // Đã bỏ hoàn toàn banner cảnh báo sao lưu tại các tab theo yêu cầu người dùng
    return null;
};

export default AdminBackupWarningBanner;

