import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
    Bell, BellOff, Calendar, Clock, CheckCircle2, FileText, 
    X, Check, Trash2, ArrowUpRight, AlertTriangle, FileSignature, 
    UserCheck, Inbox
} from 'lucide-react';
import { RecordFile, RecordStatus, User, UserRole } from '../types';
import { 
    InAppNotification, 
    getInAppNotifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    removeInAppNotification, 
    clearAllInAppNotifications,
    isUserRelatedToRecord 
} from '../services/inAppNotificationService';

interface NotificationBellProps {
    records: RecordFile[];
    currentUser: User | null;
    onViewRecord: (record: RecordFile) => void;
    onClearReminder: (recordId: string) => void;
    onClearAllReminders?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
    records,
    currentUser,
    onViewRecord,
    onClearReminder,
    onClearAllReminders
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'ALL' | 'REMINDERS' | 'TASKS'>('ALL');
    const [filterScope, setFilterScope] = useState<'MINE' | 'ALL'>('MINE'); // Mặc định chỉ xem của tôi
    const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>(() => getInAppNotifications(currentUser));
    const popoverRef = useRef<HTMLDivElement>(null);

    const isManager = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN;

    // Lắng nghe sự kiện cập nhật thông báo nội bộ
    const reloadInAppNotifications = useCallback(() => {
        setInAppNotifications(getInAppNotifications(currentUser));
    }, [currentUser]);

    useEffect(() => {
        reloadInAppNotifications();
        const handleUpdate = () => reloadInAppNotifications();
        window.addEventListener('in_app_notifications_updated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('in_app_notifications_updated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [reloadInAppNotifications]);

    // 1. Lọc danh sách Lịch nhắc hẹn làm việc (Phân luồng theo tài khoản)
    const reminderRecords = useMemo(() => {
        if (!currentUser) return [];
        const now = Date.now();

        return records
            .filter(r => {
                if (!r.reminderDate) return false;
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED || r.status === RecordStatus.RETURNED) {
                    return false;
                }
                
                // Nếu chế độ "MINE" hoặc không phải Quản lý: BẮT BUỘC chỉ hiển thị hồ sơ thuộc tài khoản này
                if (!isManager || filterScope === 'MINE') {
                    if (!isUserRelatedToRecord(r, currentUser)) {
                        return false;
                    }
                }

                return true;
            })
            .map(r => {
                const reminderTime = new Date(r.reminderDate!).getTime();
                const isDue = reminderTime <= now;
                const isUpcoming = reminderTime > now && reminderTime - now <= 24 * 60 * 60 * 1000;
                return {
                    record: r,
                    reminderTime,
                    isDue,
                    isUpcoming
                };
            })
            .sort((a, b) => {
                if (a.isDue && !b.isDue) return -1;
                if (!a.isDue && b.isDue) return 1;
                return a.reminderTime - b.reminderTime;
            });
    }, [records, currentUser, isManager, filterScope]);

    // 2. Lọc danh sách Thông báo công việc (In-app notifications)
    const filteredTasks = useMemo(() => {
        return inAppNotifications.filter(item => item.type !== 'REMINDER');
    }, [inAppNotifications]);

    // Số lượng nhắc hẹn đến giờ
    const dueCount = useMemo(() => {
        return reminderRecords.filter(item => item.isDue).length;
    }, [reminderRecords]);

    // Số lượng thông báo công việc chưa đọc
    const unreadTasksCount = useMemo(() => {
        return filteredTasks.filter(item => !item.isRead).length;
    }, [filteredTasks]);

    // Tổng số thông báo cần chú ý
    const totalUrgentCount = dueCount + unreadTasksCount;

    // Đóng dropdown khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const formatDateTime = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes} ${day}/${month}/${year}`;
        } catch {
            return dateStr;
        }
    };

    const handleClearAll = () => {
        if (activeTab === 'REMINDERS' || activeTab === 'ALL') {
            if (onClearAllReminders) onClearAllReminders();
        }
        if (activeTab === 'TASKS' || activeTab === 'ALL') {
            clearAllInAppNotifications(currentUser);
            reloadInAppNotifications();
        }
    };

    const handleMarkAllRead = () => {
        markAllNotificationsAsRead(currentUser);
        reloadInAppNotifications();
    };

    const handleOpenRecordFromNotification = (item: InAppNotification) => {
        const matched = records.find(r => r.id === item.recordId || r.code === item.recordCode);
        if (matched) {
            markNotificationAsRead(currentUser, item.id);
            reloadInAppNotifications();
            setIsOpen(false);
            onViewRecord(matched);
        }
    };

    return (
        <div className="relative inline-block" ref={popoverRef}>
            {/* Nút quả chuông */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-full transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-400/50 ${
                    isOpen 
                        ? 'bg-white/20 text-white shadow-inner ring-2 ring-white/30' 
                        : 'hover:bg-white/10 text-blue-100 hover:text-white'
                }`}
                title="Thông báo & Lịch nhắc hẹn làm việc"
                aria-label="Thông báo"
            >
                <Bell size={20} className={totalUrgentCount > 0 ? 'animate-bounce text-yellow-300' : ''} />
                
                {/* Huy hiệu đếm số lượng */}
                {totalUrgentCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ring-2 ring-blue-900 animate-pulse min-w-[18px] text-center shadow-md">
                        {totalUrgentCount > 99 ? '99+' : totalUrgentCount}
                    </span>
                ) : (reminderRecords.length > 0 || inAppNotifications.length > 0) ? (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-blue-900 min-w-[18px] text-center">
                        {reminderRecords.length + inAppNotifications.length}
                    </span>
                ) : null}
            </button>

            {/* Khung Popover hiển thị danh sách Thông báo & Nhắc hẹn */}
            {isOpen && (
                <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-full mt-1 sm:mt-2.5 w-[calc(100vw-1rem)] sm:w-[420px] max-w-[440px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right text-gray-800 flex flex-col max-h-[85vh]">
                    
                    {/* Header */}
                    <div className="p-3.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 text-white flex flex-col gap-2 shrink-0 border-b border-blue-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-white/10 text-yellow-300 backdrop-blur-sm">
                                    <Bell size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm tracking-wide leading-none">Thông báo & Nhắc việc</h3>
                                    <p className="text-[11px] text-blue-200 mt-0.5">
                                        {totalUrgentCount > 0 
                                            ? `Có ${totalUrgentCount} mục cần bạn xử lý` 
                                            : `Tất cả công việc đã cập nhật`}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {unreadTasksCount > 0 && (
                                    <button
                                        onClick={handleMarkAllRead}
                                        className="text-[10px] bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white px-2 py-1 rounded transition-colors"
                                        title="Đánh dấu tất cả là đã đọc"
                                    >
                                        Đã đọc
                                    </button>
                                )}
                                {(reminderRecords.length > 0 || filteredTasks.length > 0) && (
                                    <button
                                        onClick={handleClearAll}
                                        className="text-[10px] bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white px-2 py-1 rounded transition-colors"
                                        title="Xóa/Tắt thông báo hiện tại"
                                    >
                                        Xóa hết
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/10 rounded-lg text-blue-200 hover:text-white transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Thanh Tab & Bộ lọc phân luồng */}
                        <div className="flex items-center justify-between pt-1 border-t border-white/10 gap-2">
                            <div className="flex items-center gap-1 text-xs">
                                <button
                                    onClick={() => setActiveTab('ALL')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                        activeTab === 'ALL'
                                            ? 'bg-white text-blue-900 shadow-xs'
                                            : 'text-blue-200 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    Tất cả ({reminderRecords.length + filteredTasks.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('REMINDERS')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                        activeTab === 'REMINDERS'
                                            ? 'bg-white text-blue-900 shadow-xs'
                                            : 'text-blue-200 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    Nhắc hẹn
                                    {dueCount > 0 && (
                                        <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                                            {dueCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('TASKS')}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                        activeTab === 'TASKS'
                                            ? 'bg-white text-blue-900 shadow-xs'
                                            : 'text-blue-200 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    Công việc
                                    {unreadTasksCount > 0 && (
                                        <span className="bg-amber-400 text-slate-900 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                                            {unreadTasksCount}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Nút lọc phạm vi dành riêng cho Quản trị viên */}
                            {isManager && (
                                <button
                                    onClick={() => setFilterScope(prev => prev === 'MINE' ? 'ALL' : 'MINE')}
                                    className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-all border ${
                                        filterScope === 'MINE'
                                            ? 'bg-blue-600 text-white border-blue-400'
                                            : 'bg-white/15 text-blue-200 border-white/20 hover:text-white'
                                    }`}
                                    title="Chuyển đổi giữa xem hồ sơ của cá nhân bạn hoặc toàn hệ thống"
                                >
                                    {filterScope === 'MINE' ? 'Hồ sơ của tôi' : 'Toàn đơn vị'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Danh sách thông báo */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 scrollbar-thin max-h-[60vh]">
                        
                        {/* 1. HIỂN THỊ CÁC LỊCH NHẮC HẸN */}
                        {(activeTab === 'ALL' || activeTab === 'REMINDERS') && reminderRecords.map(({ record, isDue, isUpcoming }) => (
                            <div
                                key={`reminder-${record.id}`}
                                className={`p-3 transition-colors hover:bg-blue-50/50 flex flex-col gap-2 relative ${
                                    isDue ? 'bg-red-50/40' : ''
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-xs text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                                                {record.code}
                                            </span>
                                            <span className="text-xs font-semibold text-gray-800 truncate">
                                                {record.customerName}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1 text-[11px] text-gray-600 mt-1">
                                            <Calendar size={12} className="text-blue-600 shrink-0" />
                                            <span>Hẹn: {formatDateTime(record.reminderDate!)}</span>
                                        </div>

                                        {record.notes && (
                                            <p className="text-[11px] text-gray-600 bg-gray-50 p-1.5 rounded mt-1.5 line-clamp-2 italic border border-gray-100">
                                                "{record.notes}"
                                            </p>
                                        )}
                                    </div>

                                    {/* Huy hiệu thời gian */}
                                    <div className="shrink-0">
                                        {isDue ? (
                                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-200 animate-pulse">
                                                <Clock size={10} /> Đã đến giờ
                                            </span>
                                        ) : isUpcoming ? (
                                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
                                                <Clock size={10} /> Trong 24h
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                                Sắp tới
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Thanh nút thao tác */}
                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                                    <button
                                        onClick={() => onClearReminder(record.id)}
                                        className="text-[11px] text-gray-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                        title="Tắt nhắc nhở cho hồ sơ này"
                                    >
                                        <BellOff size={13} /> Tắt nhắc
                                    </button>

                                    <button
                                        onClick={() => {
                                            onViewRecord(record);
                                            setIsOpen(false);
                                        }}
                                        className="px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                                    >
                                        <FileText size={12} /> Xem hồ sơ
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* 2. HIỂN THỊ CÁC THÔNG BÁO CÔNG VIỆC NỘI BỘ */}
                        {(activeTab === 'ALL' || activeTab === 'TASKS') && filteredTasks.map(item => (
                            <div
                                key={item.id}
                                className={`p-3 transition-colors hover:bg-indigo-50/40 flex flex-col gap-2 relative ${
                                    !item.isRead ? 'bg-indigo-50/25' : ''
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 min-w-0">
                                        <div className="p-1.5 rounded-lg shrink-0 mt-0.5 bg-gray-100">
                                            {item.type === 'PENDING_SIGN' ? (
                                                <FileSignature size={15} className="text-purple-600" />
                                            ) : item.type === 'REJECTED' ? (
                                                <AlertTriangle size={15} className="text-rose-600" />
                                            ) : item.type === 'ASSIGNED' ? (
                                                <UserCheck size={15} className="text-blue-600" />
                                            ) : (
                                                <Inbox size={15} className="text-gray-600" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h4 className="text-xs font-bold text-gray-900 leading-tight">
                                                    {item.title}
                                                </h4>
                                                {!item.isRead && (
                                                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                                                {item.message}
                                            </p>
                                            <span className="text-[10px] text-gray-400 block mt-1">
                                                {formatDateTime(item.createdAt)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Nút xóa thông báo */}
                                    <button
                                        onClick={() => {
                                            removeInAppNotification(currentUser, item.id);
                                            reloadInAppNotifications();
                                        }}
                                        className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors shrink-0"
                                        title="Xóa thông báo này"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                                    {!item.isRead && (
                                        <button
                                            onClick={() => {
                                                markNotificationAsRead(currentUser, item.id);
                                                reloadInAppNotifications();
                                            }}
                                            className="text-[11px] text-gray-500 hover:text-blue-600 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                                        >
                                            <Check size={12} /> Đã đọc
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleOpenRecordFromNotification(item)}
                                        className="ml-auto px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 border border-indigo-200"
                                    >
                                        Xem hồ sơ <ArrowUpRight size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* TRƯỜNG HỢP DANH SÁCH RỖNG */}
                        {((activeTab === 'ALL' && reminderRecords.length === 0 && filteredTasks.length === 0) ||
                          (activeTab === 'REMINDERS' && reminderRecords.length === 0) ||
                          (activeTab === 'TASKS' && filteredTasks.length === 0)) && (
                            <div className="py-10 px-4 text-center">
                                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-2">
                                    <CheckCircle2 size={24} />
                                </div>
                                <p className="text-sm font-semibold text-gray-700">Không có thông báo nào</p>
                                <p className="text-xs text-gray-400 mt-0.5 max-w-xs mx-auto">
                                    {filterScope === 'MINE' 
                                        ? 'Hiện tại không có lịch nhắc hẹn hay thông báo công việc nào thuộc tài khoản của bạn.' 
                                        : 'Toàn bộ hồ sơ đang trong tiến độ, không có lịch nhắc đến giờ.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 bg-gray-50 border-t border-gray-100 text-center shrink-0">
                        <span className="text-[11px] text-gray-500 font-medium">
                            Toàn bộ thông báo được gom và phân luồng độc lập theo tài khoản
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
