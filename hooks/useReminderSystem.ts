import { useState, useEffect, useMemo, useRef } from 'react';
import { RecordFile, RecordStatus, User, UserRole } from '../types';
import { updateRecordApi } from '../services/api';

const REMINDER_INTERVAL = 60000; // Kiểm tra mỗi 1 phút
const REPEAT_HOURS = 2; // Nhắc lại mỗi 2 giờ

// Helper gửi thông báo hệ thống (Notification API)
const triggerSystemNotification = (title: string, body: string) => {
    if (window.electronAPI && window.electronAPI.showNotification) {
        window.electronAPI.showNotification(title, body);
    } else if (Notification.permission === 'granted') {
        new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, { body });
            }
        });
    }
};

export const useReminderSystem = (
    records: RecordFile[], 
    onUpdateRecord: (r: RecordFile) => void,
    currentUser: User | null
) => {
    const [activeRemindersCount, setActiveRemindersCount] = useState(0);

    // Tính toán số lượng nhắc nhở active (đã đến giờ và chưa hoàn thành)
    useEffect(() => {
        const count = records.filter(r => {
            if (!r.reminderDate) return false;
            // Nếu hồ sơ đã xong hoặc rút thì không tính là active reminder
            if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED) return false;
            
            const reminderTime = new Date(r.reminderDate).getTime();
            const now = Date.now();
            return reminderTime <= now;
        }).length;
        setActiveRemindersCount(count);
    }, [records]);

    // Dùng ref để tránh việc effect chạy lại mỗi khi records thay đổi
    const recordsRef = useRef(records);
    useEffect(() => {
        recordsRef.current = records;
    }, [records]);

    // Cập nhật ref cho onUpdateRecord để tránh khởi động lại useEffect liên tục
    const onUpdateRef = useRef(onUpdateRecord);
    useEffect(() => {
        onUpdateRef.current = onUpdateRecord;
    }, [onUpdateRecord]);

    // Set lưu trữ các id đã nhắc nhở trong phiên này để tránh phụ thuộc hoàn toàn vào DB (đề phòng thiếu cột)
    const remindedIds = useRef<Set<string>>(new Set());

    // 1. Tích hợp gửi thông báo hệ thống khi hồ sơ đổi trạng thái
    const prevRecordsRef = useRef<RecordFile[]>([]);
    useEffect(() => {
        // Nếu lần đầu tiên load hoặc danh sách rỗng thì chưa so sánh trạng thái
        if (prevRecordsRef.current.length === 0) {
            prevRecordsRef.current = records;
            return;
        }

        for (const r of records) {
            const prevR = prevRecordsRef.current.find(p => p.id === r.id);
            if (prevR && prevR.status !== r.status) {
                const newStatus = r.status;
                const isAssignedEmployee = currentUser && currentUser.employeeId === r.assignedTo;

                // A. 'Đang chờ ký' -> RecordStatus.PENDING_SIGN
                if (newStatus === RecordStatus.PENDING_SIGN) {
                    const isRelevantSupervisor = currentUser && (
                        currentUser.role === UserRole.ADMIN ||
                        currentUser.role === UserRole.SUBADMIN ||
                        currentUser.employeeId === r.submittedTo
                    );

                    if (isRelevantSupervisor) {
                        triggerSystemNotification(
                            `Yêu cầu Trình ký mới: ${r.code}`,
                            `Hồ sơ của khách hàng ${r.customerName} đã được trình ký duyệt. Vui lòng kiểm tra!`
                        );
                    } else if (isAssignedEmployee) {
                        triggerSystemNotification(
                            `Hồ sơ đã được trình ký: ${r.code}`,
                            `Hồ sơ của khách hàng ${r.customerName} đã chuyển sang trạng thái chờ ký duyệt.`
                        );
                    }
                }

                // B. 'Đã trả về' -> RecordStatus.REJECTED (trả về nhân viên)
                if (newStatus === RecordStatus.REJECTED) {
                    const isOneDoor = currentUser && currentUser.role === UserRole.ONEDOOR;
                    if (isAssignedEmployee) {
                        triggerSystemNotification(
                            `Hồ sơ bị trả về: ${r.code}`,
                            `Hồ sơ khách hàng ${r.customerName} đã bị trả về. Ghi chú: ${r.notes || 'Không có ghi chú chi tiết'}`
                        );
                    } else if (isOneDoor) {
                        triggerSystemNotification(
                            `Hồ sơ lỗi trả về một cửa: ${r.code}`,
                            `Hồ sơ ${r.code} (khách hàng ${r.customerName}) đã bị trả về một cửa.`
                        );
                    }
                }

                // C. 'Giao giải quyết' -> RecordStatus.ASSIGNED
                if (newStatus === RecordStatus.ASSIGNED) {
                    if (isAssignedEmployee) {
                        triggerSystemNotification(
                            `Giao hồ sơ mới: ${r.code}`,
                            `Bạn đã được phân công xử lý hồ sơ ${r.code} cho khách hàng ${r.customerName}.`
                        );
                    }
                }
            }
        }

        prevRecordsRef.current = records;
    }, [records, currentUser]);

    // Logic Polling để bắn thông báo và kiểm tra quá hạn
    useEffect(() => {
        let isCancelled = false;

        const checkReminders = async () => {
            if (isCancelled) return;
            const now = Date.now();
            
            for (const r of recordsRef.current) {
                if (isCancelled) break;

                // --- KIỂM TRA NHẮC LỊCH HẸN THƯỜNG ---
                if (r.reminderDate) {
                    // Bỏ qua nếu hồ sơ đã xong
                    const isFinished = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;
                    const reminderTime = new Date(r.reminderDate).getTime();
                    
                    if (!isFinished && reminderTime <= now) {
                        // Kiểm tra điều kiện nhắc lại (2 tiếng)
                        let shouldNotify = false;
                        if (!r.lastRemindedAt) {
                            // Nếu chưa nhắc trong DB, kiểm tra xem phiên này đã nhắc chưa
                            if (!remindedIds.current.has(r.id)) {
                                shouldNotify = true;
                            }
                        } else {
                            const lastRemindedTime = new Date(r.lastRemindedAt).getTime();
                            const hoursDiff = (now - lastRemindedTime) / (1000 * 60 * 60);
                            if (hoursDiff >= REPEAT_HOURS && !remindedIds.current.has(r.id)) {
                                shouldNotify = true;
                            }
                        }

                        if (shouldNotify) {
                            remindedIds.current.add(r.id);
                            
                            triggerSystemNotification(
                                `Nhắc nhở hồ sơ: ${r.code}`,
                                `Đã đến giờ hẹn xử lý hồ sơ khách hàng: ${r.customerName}. Vui lòng kiểm tra!`
                            );

                            // Cập nhật lastRemindedAt để không spam
                            const updatedRecord = { ...r, lastRemindedAt: new Date().toISOString() };
                            // Gọi update local trước thông qua ref để luôn lấy hàm mới nhất
                            onUpdateRef.current(updatedRecord);
                            // Cập nhật recordsRef ngay để tránh vòng lặp
                            recordsRef.current = recordsRef.current.map(rec => rec.id === updatedRecord.id ? updatedRecord : rec);
                            
                            // Gọi API update DB
                            try {
                                await updateRecordApi(updatedRecord);
                            } catch (err) {
                                console.error('Failed to update reminder state', err);
                            }
                            
                            // Xóa id khỏi set sau 2 tiếng để cho phép nhắc lại (nếu DB thực sự không lưu được)
                            setTimeout(() => {
                                remindedIds.current.delete(r.id);
                            }, REPEAT_HOURS * 60 * 60 * 1000);
                        }
                    }
                }

                // --- KIỂM TRA NHẮC QUÁ HẠN GIẢI QUYẾT (CHỈ NHẮC 1 LẦN) ---
                if (r.deadline && !r.deadlineReminded) {
                    const isFinishedOrWithdrawn = [
                        RecordStatus.HANDOVER, 
                        RecordStatus.RETURNED, 
                        RecordStatus.WITHDRAWN
                    ].includes(r.status);

                    if (!isFinishedOrWithdrawn) {
                        const deadlineDate = new Date(r.deadline);
                        const deadlineTime = deadlineDate.getTime();
                        
                        if (!isNaN(deadlineTime) && now >= deadlineTime) {
                            const isAssignedToCurrentUser = currentUser && currentUser.employeeId === r.assignedTo;
                            const isPrivilegedUser = currentUser && (
                                currentUser.role === UserRole.ADMIN ||
                                currentUser.role === UserRole.SUBADMIN ||
                                currentUser.role === UserRole.TEAM_LEADER
                            );

                            if (isAssignedToCurrentUser || isPrivilegedUser) {
                                // Tắt chế độ thông báo khi hồ sơ hết hạn giải quyết theo yêu cầu người dùng
                                /*
                                triggerSystemNotification(
                                    `Cảnh báo quá hạn: ${r.code}`,
                                    `Hồ sơ của khách hàng ${r.customerName} đã trễ hạn giải quyết vào ngày ${deadlineDate.toLocaleDateString('vi-VN')}.`
                                );
                                */

                                // Đánh dấu đã nhắc nhở quá hạn (nhắc duy nhất 1 lần)
                                const updatedRecord = { ...r, deadlineReminded: true };
                                onUpdateRef.current(updatedRecord);
                                recordsRef.current = recordsRef.current.map(rec => rec.id === updatedRecord.id ? updatedRecord : rec);

                                try {
                                    await updateRecordApi(updatedRecord);
                                } catch (err) {
                                    console.error('Failed to update deadline reminder state', err);
                                }
                            }
                        }
                    }
                }
            }
        };

        const intervalId = setInterval(checkReminders, REMINDER_INTERVAL);

        return () => {
            isCancelled = true;
            clearInterval(intervalId);
        };
    }, [currentUser]); // Thêm currentUser vào deps để lọc chính xác khi đổi tài khoản

    return { activeRemindersCount };
};
