import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bell, BellOff, Calendar, Clock, CheckCircle2, ChevronRight, FileText, AlertCircle, Sparkles, X, Filter } from 'lucide-react';
import { RecordFile, RecordStatus, User, UserRole } from '../types';

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
    const popoverRef = useRef<HTMLDivElement>(null);

    // Filter list of records with reminderDate
    const reminderRecords = useMemo(() => {
        const now = Date.now();
        return records
            .filter(r => {
                if (!r.reminderDate) return false;
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED || r.status === RecordStatus.RETURNED) {
                    return false;
                }
                // Filter by role if employee (show assigned records or created ones)
                if (currentUser && currentUser.role === UserRole.EMPLOYEE) {
                    if (r.assignedTo !== currentUser.employeeId && r.receivedBy !== currentUser.username) {
                        return false;
                    }
                }
                return true;
            })
            .map(r => {
                const reminderTime = new Date(r.reminderDate!).getTime();
                const isDue = reminderTime <= now;
                const isUpcoming = reminderTime > now && reminderTime - now <= 24 * 60 * 60 * 1000; // within 24h
                return {
                    record: r,
                    reminderTime,
                    isDue,
                    isUpcoming
                };
            })
            .sort((a, b) => {
                // Hồ sơ tới hẹn đưa lên đầu
                if (a.isDue && !b.isDue) return -1;
                if (!a.isDue && b.isDue) return 1;
                return a.reminderTime - b.reminderTime;
            });
    }, [records, currentUser]);

    // Count due/overdue reminders
    const dueCount = useMemo(() => {
        return reminderRecords.filter(item => item.isDue).length;
    }, [reminderRecords]);

    // Close when clicking outside
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

    return (
        <div className="relative inline-block" ref={popoverRef}>
            {/* Bell Button */}
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
                <Bell size={20} className={dueCount > 0 ? 'animate-bounce text-yellow-300' : ''} />
                
                {/* Badge Count */}
                {dueCount > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ring-2 ring-blue-900 animate-pulse min-w-[18px] text-center shadow-md">
                        {dueCount > 99 ? '99+' : dueCount}
                    </span>
                ) : reminderRecords.length > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-blue-900 min-w-[18px] text-center">
                        {reminderRecords.length}
                    </span>
                ) : null}
            </button>

            {/* Popover Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right text-gray-800">
                    {/* Header */}
                    <div className="p-3.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-800 text-white flex items-center justify-between border-b border-blue-800">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-white/10 text-yellow-300 backdrop-blur-sm">
                                <Bell size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm tracking-wide leading-none">Thông báo nhắc việc</h3>
                                <p className="text-[11px] text-blue-200 mt-0.5">
                                    {dueCount > 0 ? `Có ${dueCount} lịch nhắc đến giờ xử lý` : `Tổng số: ${reminderRecords.length} lịch hẹn`}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {reminderRecords.length > 0 && onClearAllReminders && (
                                <button
                                    onClick={onClearAllReminders}
                                    className="text-[11px] bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white px-2 py-1 rounded-md transition-colors"
                                    title="Tắt tất cả nhắc nhở"
                                >
                                    Tắt hết
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

                    {/* Reminder List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 scrollbar-thin">
                        {reminderRecords.length === 0 ? (
                            <div className="py-8 px-4 text-center">
                                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-2">
                                    <CheckCircle2 size={24} />
                                </div>
                                <p className="text-sm font-semibold text-gray-700">Không có nhắc nhở nào</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Hiện tại chưa có hồ sơ nào được hẹn giờ nhắc nhở
                                </p>
                            </div>
                        ) : (
                            reminderRecords.map(({ record, reminderTime, isDue, isUpcoming }) => (
                                <div
                                    key={record.id}
                                    className={`p-3 transition-colors hover:bg-blue-50/50 flex flex-col gap-2 relative group ${
                                        isDue ? 'bg-red-50/30' : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-bold text-xs text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200/60 shrink-0">
                                                    {record.code}
                                                </span>
                                                <div className="flex items-center gap-1 text-xs text-gray-700 font-semibold truncate">
                                                    <Calendar size={13} className="text-blue-600 shrink-0" />
                                                    <span>{formatDateTime(record.reminderDate!)}</span>
                                                </div>
                                            </div>

                                            {record.notes && (
                                                <p className="text-[11px] text-gray-600 bg-gray-50 p-1.5 rounded mt-1.5 line-clamp-2 italic border border-gray-100">
                                                    "{record.notes}"
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100/80">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    onClearReminder(record.id);
                                                }}
                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                                                title="Tắt nhắc nhở này"
                                                aria-label="Tắt nhắc"
                                            >
                                                <BellOff size={14} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    onViewRecord(record);
                                                    setIsOpen(false);
                                                }}
                                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                            >
                                                <FileText size={12} />
                                                Xem hồ sơ
                                            </button>
                                        </div>

                                        <div className="flex items-center shrink-0">
                                            {isDue ? (
                                                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-200 animate-pulse shrink-0">
                                                    <Clock size={10} /> Đã đến giờ
                                                </span>
                                            ) : isUpcoming ? (
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200 shrink-0">
                                                    <Clock size={10} /> Trong 24h
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                                                    Sắp tới
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 bg-gray-50 border-t border-gray-100 text-center">
                        <span className="text-[11px] text-gray-500 font-medium">
                            Tự động nhắc nhở khi đến lịch giờ hẹn
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
