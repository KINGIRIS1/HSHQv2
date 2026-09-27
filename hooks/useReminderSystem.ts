import { useEffect, useMemo, useRef } from 'react';
import { RecordFile, RecordStatus, User, UserRole } from '../types';
import { updateRecordFieldsApi } from '../services/api';
import { addInAppNotificationForUser, isUserRelatedToRecord } from '../services/inAppNotificationService';

const REMINDER_INTERVAL = 60000; // Kiểm tra mỗi 1 phút
const REPEAT_HOURS = 2; // Nhắc lại mỗi 2 giờ

export const useReminderSystem = (
    records: RecordFile[], 
    onUpdateRecord: (id: string, fields: Partial<RecordFile>) => void,
    currentUser: User | null
) => {
    // 1. Phân luồng tính toán số lượng nhắc nhở active theo tài khoản đăng nhập
    const activeRemindersCount = useMemo(() => {
        if (!currentUser) return 0;
        const now = Date.now();
        
        return records.filter(r => {
            if (!r.reminderDate) return false;
            if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED || r.status === RecordStatus.RETURNED) {
                return false;
            }
            
            // Phân luồng nghiêm ngặt theo tài khoản: Nhân viên chỉ thấy hồ sơ thuộc trách nhiệm của mình
            const isRelated = isUserRelatedToRecord(r, currentUser);
            const isManager = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
            
            // Nếu không phải quản trị viên, chỉ đếm hồ sơ của chính mình
            if (!isManager && !isRelated) {
                return false;
            }

            const reminderTime = new Date(r.reminderDate).getTime();
            return reminderTime <= now;
        }).length;
    }, [records, currentUser]);

    // Dùng ref để tránh việc effect chạy lại mỗi khi records thay đổi
    const recordsRef = useRef(records);
    useEffect(() => {
        recordsRef.current = records;
    }, [records]);

    // Cập nhật ref cho onUpdateRecord
    const onUpdateRef = useRef(onUpdateRecord);
    useEffect(() => {
        onUpdateRef.current = onUpdateRecord;
    }, [onUpdateRecord]);

    // Set lưu trữ các id đã nhắc nhở trong phiên này
    const remindedIds = useRef<Set<string>>(new Set());

    // 2. Tự động gom các sự kiện phân công, trình ký, trả về vào Thông báo nội bộ (Hoàn toàn trong phần mềm)
    const prevRecordsRef = useRef<RecordFile[]>([]);
    useEffect(() => {
        if (prevRecordsRef.current.length === 0) {
            prevRecordsRef.current = records;
            return;
        }

        for (const r of records) {
            const prevR = prevRecordsRef.current.find(p => p.id === r.id);
            if (prevR && prevR.status !== r.status) {
                const newStatus = r.status;

                // A. 'Chờ ký duyệt' -> RecordStatus.PENDING_SIGN
                if (newStatus === RecordStatus.PENDING_SIGN) {
                    const targetSupervisor = r.submittedTo || 'admin';
                    addInAppNotificationForUser(targetSupervisor, {
                        type: 'PENDING_SIGN',
                        recordId: r.id,
                        recordCode: r.code,
                        customerName: r.customerName,
                        title: `Yêu cầu Trình ký mới: ${r.code}`,
                        message: `Hồ sơ khách hàng ${r.customerName} đã được trình ký duyệt. Vui lòng kiểm tra!`,
                    });

                    // Báo lại cho nhân viên phụ trách hồ sơ
                    if (r.assignedTo && r.assignedTo !== targetSupervisor) {
                        addInAppNotificationForUser(r.assignedTo, {
                            type: 'STATUS_CHANGE',
                            recordId: r.id,
                            recordCode: r.code,
                            customerName: r.customerName,
                            title: `Hồ sơ đã được trình ký: ${r.code}`,
                            message: `Hồ sơ khách hàng ${r.customerName} đã chuyển sang trạng thái chờ ký duyệt.`,
                        });
                    }
                }

                // B. 'Hồ sơ trả về' -> RecordStatus.REJECTED
                if (newStatus === RecordStatus.REJECTED) {
                    const targets = [r.assignedTo, r.surveyorId, r.drafterId, r.receivedBy].filter(Boolean) as string[];
                    const uniqueTargets = Array.from(new Set(targets));
                    for (const target of uniqueTargets) {
                        addInAppNotificationForUser(target, {
                            type: 'REJECTED',
                            recordId: r.id,
                            recordCode: r.code,
                            customerName: r.customerName,
                            title: `Hồ sơ bị trả về: ${r.code}`,
                            message: `Hồ sơ khách hàng ${r.customerName} đã bị trả về. Ghi chú: ${r.notes || 'Không có ghi chú'}`,
                        });
                    }
                }

                // C. 'Giao nhân viên' -> Phân công hồ sơ mới
                if (newStatus === RecordStatus.ASSIGNED || newStatus === RecordStatus.FIELD_WORK || newStatus === RecordStatus.OFFICE_WORK) {
                    const targets = [r.assignedTo, r.surveyorId, r.drafterId].filter(Boolean) as string[];
                    const uniqueTargets = Array.from(new Set(targets));
                    for (const target of uniqueTargets) {
                        addInAppNotificationForUser(target, {
                            type: 'ASSIGNED',
                            recordId: r.id,
                            recordCode: r.code,
                            customerName: r.customerName,
                            title: `Giao hồ sơ mới: ${r.code}`,
                            message: `Bạn được phân công xử lý hồ sơ ${r.code} (${r.customerName}).`,
                        });
                    }
                }
            }
        }

        prevRecordsRef.current = records;
    }, [records]);

    // 3. Logic Polling kiểm tra nhắc hẹn làm việc (CHỈ ĐƯA VÀO QUẢ CHUÔNG NỘI BỘ, KHÔNG BẮN RA NGOÀI PHẦN MỀM)
    useEffect(() => {
        let isCancelled = false;

        const checkReminders = async () => {
            if (isCancelled) return;
            const now = Date.now();
            
            for (const r of recordsRef.current) {
                if (isCancelled) break;

                if (r.reminderDate) {
                    const isFinished = r.status === RecordStatus.HANDOVER || 
                                       r.status === RecordStatus.WITHDRAWN || 
                                       r.status === RecordStatus.REJECTED || 
                                       r.status === RecordStatus.RETURNED;
                    const reminderTime = new Date(r.reminderDate).getTime();
                    
                    if (!isFinished && reminderTime <= now) {
                        let shouldNotify = false;
                        if (!r.lastRemindedAt) {
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
                            
                            // Phân luồng đưa vào thông báo nội bộ cho đúng người phụ trách hồ sơ
                            const responsibleUsers = [r.assignedTo, r.surveyorId, r.drafterId, r.receivedBy]
                                .filter(Boolean) as string[];
                            
                            const targetUsers = responsibleUsers.length > 0 
                                ? Array.from(new Set(responsibleUsers)) 
                                : [currentUser?.username || 'admin'];

                            for (const targetUser of targetUsers) {
                                addInAppNotificationForUser(targetUser, {
                                    type: 'REMINDER',
                                    recordId: r.id,
                                    recordCode: r.code,
                                    customerName: r.customerName,
                                    title: `Nhắc hẹn hồ sơ: ${r.code}`,
                                    message: `Đã đến giờ hẹn xử lý hồ sơ khách hàng: ${r.customerName}.`,
                                    reminderDate: r.reminderDate
                                });
                            }

                            const nextLastRemindedAt = new Date().toISOString();
                            onUpdateRef.current(r.id, { lastRemindedAt: nextLastRemindedAt });
                            recordsRef.current = recordsRef.current.map(rec => rec.id === r.id ? { ...rec, lastRemindedAt: nextLastRemindedAt } : rec);
                            
                            try {
                                await updateRecordFieldsApi(r.id, { lastRemindedAt: nextLastRemindedAt });
                            } catch (err) {
                                console.error('Failed to update reminder state', err);
                            }
                            
                            setTimeout(() => {
                                remindedIds.current.delete(r.id);
                            }, REPEAT_HOURS * 60 * 60 * 1000);
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
    }, [currentUser]);

    return { activeRemindersCount };
};
