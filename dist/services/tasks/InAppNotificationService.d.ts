import { Database } from '../../utils/database';
import { NotificationType, NotificationPriority } from '@prisma/client';
export interface CreateNotificationRequest {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    data?: Record<string, any>;
    expiresAt?: Date;
}
export interface NotificationResponse {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    isRead: boolean;
    data?: Record<string, any>;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface NotificationFilters {
    type?: NotificationType;
    priority?: NotificationPriority;
    isRead?: boolean;
    fromDate?: Date;
    toDate?: Date;
    expiresOnly?: boolean;
}
export declare class InAppNotificationService {
    private db;
    constructor(db: Database);
    createNotification(request: CreateNotificationRequest): Promise<NotificationResponse>;
    getNotifications(userId: string, filters?: NotificationFilters): Promise<NotificationResponse[]>;
    getUnreadNotifications(userId: string, limit?: number): Promise<NotificationResponse[]>;
    getNotificationById(notificationId: string, userId: string): Promise<NotificationResponse>;
    markAsRead(notificationId: string, userId: string): Promise<NotificationResponse>;
    markAllAsRead(userId: string, filters?: NotificationFilters): Promise<number>;
    deleteNotification(notificationId: string, userId: string): Promise<void>;
    deleteExpiredNotifications(): Promise<number>;
    getNotificationStats(userId: string): Promise<{
        total: number;
        unread: number;
        read: number;
        expired: number;
        highPriority: number;
        urgent: number;
        byType: Record<NotificationType, number>;
    }>;
    createBulkNotifications(requests: CreateNotificationRequest[]): Promise<NotificationResponse[]>;
    getNotificationsByType(userId: string, type: NotificationType, limit?: number): Promise<NotificationResponse[]>;
    getHighPriorityNotifications(userId: string, limit?: number): Promise<NotificationResponse[]>;
    cleanupOldNotifications(daysToKeep?: number): Promise<number>;
    searchNotifications(userId: string, query: string, filters?: NotificationFilters): Promise<NotificationResponse[]>;
    getRecentNotifications(userId: string, hours?: number): Promise<NotificationResponse[]>;
    updateNotificationPriority(notificationId: string, userId: string, newPriority: NotificationPriority): Promise<NotificationResponse>;
    extendNotificationExpiry(notificationId: string, userId: string, newExpiryDate: Date): Promise<NotificationResponse>;
    private mapNotificationToResponse;
}
//# sourceMappingURL=InAppNotificationService.d.ts.map