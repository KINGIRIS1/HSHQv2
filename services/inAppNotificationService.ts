import { RecordFile, User, UserRole } from '../types';

export type InAppNotificationType = 'REMINDER' | 'ASSIGNED' | 'PENDING_SIGN' | 'REJECTED' | 'STATUS_CHANGE';

export interface InAppNotification {
    id: string;
    targetUserKey: string; // username, employeeId, or userId
    type: InAppNotificationType;
    recordId: string;
    recordCode: string;
    customerName: string;
    title: string;
    message: string;
    createdAt: string; // ISO string
    isRead: boolean;
    reminderDate?: string | null;
}

const STORAGE_PREFIX = 'app_user_notifications_v2_';

/**
 * Lấy danh sách định danh của người dùng (id, username, employeeId, name)
 */
export function getUserIdentifiers(user: User | null): string[] {
    if (!user) return [];
    return [
        user.id,
        user.username,
        user.employeeId,
        user.name
    ].filter(Boolean).map(s => String(s).trim().toLowerCase());
}

/**
 * Kiểm tra xem một hồ sơ có thuộc trách nhiệm / phân công của tài khoản người dùng không
 */
export function isUserRelatedToRecord(record: RecordFile, user: User | null): boolean {
    if (!user || !record) return false;

    const userKeys = getUserIdentifiers(user);
    const checkMatch = (val?: string | null) => {
        if (!val) return false;
        return userKeys.includes(String(val).trim().toLowerCase());
    };

    return (
        checkMatch(record.assignedTo) ||
        checkMatch(record.surveyorId) ||
        checkMatch(record.drafterId) ||
        checkMatch(record.receivedBy) ||
        checkMatch(record.submittedTo) ||
        checkMatch(record.checkedBy) ||
        checkMatch((record as any).created_by)
    );
}

/**
 * Lấy storage key chính cho tài khoản
 */
function getStorageKey(user: User | null): string {
    if (!user) return `${STORAGE_PREFIX}anonymous`;
    const primaryKey = user.username || user.employeeId || user.id || 'default';
    return `${STORAGE_PREFIX}${primaryKey.trim().toLowerCase()}`;
}

/**
 * Đọc danh sách thông báo nội bộ của tài khoản
 */
export function getInAppNotifications(user: User | null): InAppNotification[] {
    if (!user) return [];
    try {
        const key = getStorageKey(user);
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Lưu danh sách thông báo của tài khoản và phát sự kiện đồng bộ
 */
export function saveInAppNotifications(user: User | null, list: InAppNotification[]): void {
    if (!user) return;
    try {
        const key = getStorageKey(user);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
        window.dispatchEvent(new CustomEvent('in_app_notifications_updated', { detail: { storageKey: key } }));
    } catch (e) {
        console.error("Lỗi khi lưu thông báo nội bộ:", e);
    }
}

/**
 * Thêm một thông báo mới cho đích danh một tài khoản (phân luồng theo tài khoản)
 */
export function addInAppNotificationForUser(
    targetUserKey: string,
    data: Omit<InAppNotification, 'id' | 'createdAt' | 'isRead' | 'targetUserKey'>
): void {
    if (!targetUserKey || !targetUserKey.trim()) return;
    try {
        const cleanKey = `${STORAGE_PREFIX}${targetUserKey.trim().toLowerCase()}`;
        const raw = localStorage.getItem(cleanKey);
        const existing: InAppNotification[] = raw ? JSON.parse(raw) : [];

        // Ngăn trùng lặp trong vòng 30 phút cho cùng một hồ sơ và loại thông báo
        const now = Date.now();
        const isDuplicate = existing.some(item => 
            item.recordId === data.recordId && 
            item.type === data.type && 
            now - new Date(item.createdAt).getTime() < 30 * 60 * 1000
        );
        if (isDuplicate) return;

        const newItem: InAppNotification = {
            ...data,
            targetUserKey,
            id: 'NOTIF_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            createdAt: new Date().toISOString(),
            isRead: false
        };

        const updated = [newItem, ...existing].slice(0, 100);
        localStorage.setItem(cleanKey, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('in_app_notifications_updated', { detail: { storageKey: cleanKey } }));
    } catch (e) {
        console.error("Lỗi khi thêm thông báo nội bộ:", e);
    }
}

/**
 * Đánh dấu một thông báo đã đọc
 */
export function markNotificationAsRead(user: User | null, notificationId: string): void {
    if (!user) return;
    const list = getInAppNotifications(user);
    const updated = list.map(n => n.id === notificationId ? { ...n, isRead: true } : n);
    saveInAppNotifications(user, updated);
}

/**
 * Đánh dấu tất cả thông báo đã đọc
 */
export function markAllNotificationsAsRead(user: User | null): void {
    if (!user) return;
    const list = getInAppNotifications(user);
    const updated = list.map(n => ({ ...n, isRead: true }));
    saveInAppNotifications(user, updated);
}

/**
 * Xóa một thông báo
 */
export function removeInAppNotification(user: User | null, notificationId: string): void {
    if (!user) return;
    const list = getInAppNotifications(user);
    const updated = list.filter(n => n.id !== notificationId);
    saveInAppNotifications(user, updated);
}

/**
 * Xóa sạch tất cả thông báo
 */
export function clearAllInAppNotifications(user: User | null): void {
    if (!user) return;
    saveInAppNotifications(user, []);
}
