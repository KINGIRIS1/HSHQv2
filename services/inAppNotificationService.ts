import { RecordFile, User, UserRole } from '../types';

export interface InAppNotification {
    id: string;
    type: 'ASSIGN' | 'STAGE_CHANGE' | 'REJECT' | 'REMINDER' | 'PAYMENT' | 'SYSTEM' | string;
    title: string;
    message?: string;
    content?: string;
    recordId?: string;
    recordCode?: string;
    recipientId?: string;
    recipientName?: string;
    createdAt: string;
    isRead?: boolean;
    data?: any;
}

const STORAGE_KEY = 'in_app_notifications_store';

export function getInAppNotifications(currentUser?: User | null): InAppNotification[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const all: InAppNotification[] = JSON.parse(raw);
        if (!Array.isArray(all)) return [];
        
        if (!currentUser) return all;
        
        const isManager = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
        if (isManager) return all;
        
        return all.filter(n => {
            if (!n.recipientId && !n.recipientName) return true;
            if (n.recipientId && (n.recipientId === currentUser.id || n.recipientId === currentUser.username)) return true;
            if (n.recipientName && (n.recipientName.toLowerCase() === currentUser.name.toLowerCase() || n.recipientName.toLowerCase() === currentUser.username.toLowerCase())) return true;
            return false;
        });
    } catch {
        return [];
    }
}

export function saveInAppNotifications(notifications: InAppNotification[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
        window.dispatchEvent(new CustomEvent('in_app_notifications_updated'));
    } catch (e) {
        console.error('Error saving notifications:', e);
    }
}

export function addInAppNotification(notification: Omit<InAppNotification, 'id' | 'createdAt'>): void {
    const all = getInAppNotifications(null);
    const newNotif: InAppNotification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
        isRead: false
    };
    all.unshift(newNotif);
    // Keep max 100 notifications
    if (all.length > 100) {
        all.length = 100;
    }
    saveInAppNotifications(all);
}

export function markNotificationAsRead(currentUser: User | null, id: string): void {
    const all = getInAppNotifications(null);
    const target = all.find(n => n.id === id);
    if (target) {
        target.isRead = true;
        saveInAppNotifications(all);
    }
}

export function markAllNotificationsAsRead(currentUser: User | null): void {
    const all = getInAppNotifications(null);
    all.forEach(n => {
        n.isRead = true;
    });
    saveInAppNotifications(all);
}

export function removeInAppNotification(currentUser: User | null, id: string): void {
    const all = getInAppNotifications(null);
    const filtered = all.filter(n => n.id !== id);
    saveInAppNotifications(filtered);
}

export function clearAllInAppNotifications(currentUser: User | null): void {
    saveInAppNotifications([]);
}

export function isUserRelatedToRecord(record: RecordFile, user: User | null): boolean {
    if (!user || !record) return false;
    const isManager = user.role === UserRole.ADMIN || user.role === UserRole.SUBADMIN;
    if (isManager) return true;
    
    const uName = (user.name || '').toLowerCase();
    const uUser = (user.username || '').toLowerCase();
    const uId = (user.id || '').toLowerCase();
    
    const match = (val?: string | null) => {
        if (!val) return false;
        const v = String(val).toLowerCase();
        return v === uName || v === uUser || v === uId || (uId && v.includes(uId));
    };

    const rec = record as any;
    if (match(record.assignedTo)) return true;
    if (match(rec.processedBy)) return true;
    if (match(rec.assignedPerson)) return true;
    if (match(rec.surveyorId || rec.surveyor)) return true;
    if (match(rec.drawerId || rec.drawer)) return true;
    if (match(rec.receiver)) return true;
    if (match(rec.createdBy)) return true;

    return false;
}
