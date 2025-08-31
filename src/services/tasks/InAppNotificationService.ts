import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { 
  Notification, 
  NotificationType, 
  NotificationPriority,
  User
} from '@prisma/client';

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

@injectable()
export class InAppNotificationService {
  constructor(@inject(Database) private db: Database) {}

  async createNotification(request: CreateNotificationRequest): Promise<NotificationResponse> {
    const { userId, type, title, message, priority, data, expiresAt } = request;

    // Verify user exists
    const user = await this.db.client.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const notification = await this.db.client.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        priority: priority || NotificationPriority.MEDIUM,
        data: data || {},
        expiresAt
      }
    });

    return this.mapNotificationToResponse(notification);
  }

  async getNotifications(userId: string, filters?: NotificationFilters): Promise<NotificationResponse[]> {
    const whereClause: any = { userId };

    // Apply filters
    if (filters?.type) whereClause.type = filters.type;
    if (filters?.priority) whereClause.priority = filters.priority;
    if (filters?.isRead !== undefined) whereClause.isRead = filters.isRead;
    if (filters?.expiresOnly) whereClause.expiresAt = { not: null };
    
    // Date range filters
    if (filters?.fromDate || filters?.toDate) {
      whereClause.createdAt = {};
      if (filters.fromDate) whereClause.createdAt.gte = filters.fromDate;
      if (filters.toDate) whereClause.createdAt.lte = filters.toDate;
    }

    const notifications = await this.db.client.notification.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return notifications.map(notification => this.mapNotificationToResponse(notification));
  }

  async getUnreadNotifications(userId: string, limit?: number): Promise<NotificationResponse[]> {
    const notifications = await this.db.client.notification.findMany({
      where: {
        userId,
        isRead: false,
        expiresAt: {
          or: [
            null,
            { gte: new Date() }
          ]
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit || 50
    });

    return notifications.map(notification => this.mapNotificationToResponse(notification));
  }

  async getNotificationById(notificationId: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.db.client.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.mapNotificationToResponse(notification);
  }

  async markAsRead(notificationId: string, userId: string): Promise<NotificationResponse> {
    const notification = await this.db.client.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.isRead) {
      return this.mapNotificationToResponse(notification);
    }

    const updatedNotification = await this.db.client.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    return this.mapNotificationToResponse(updatedNotification);
  }

  async markAllAsRead(userId: string, filters?: NotificationFilters): Promise<number> {
    const whereClause: any = { 
      userId, 
      isRead: false 
    };

    // Apply additional filters
    if (filters?.type) whereClause.type = filters.type;
    if (filters?.priority) whereClause.priority = filters.priority;

    const result = await this.db.client.notification.updateMany({
      where: whereClause,
      data: { isRead: true }
    });

    return result.count;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.db.client.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await this.db.client.notification.delete({
      where: { id: notificationId }
    });
  }

  async deleteExpiredNotifications(): Promise<number> {
    const result = await this.db.client.notification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return result.count;
  }

  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    read: number;
    expired: number;
    highPriority: number;
    urgent: number;
    byType: Record<NotificationType, number>;
  }> {
    const notifications = await this.db.client.notification.findMany({
      where: { userId }
    });

    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.isRead).length,
      read: notifications.filter(n => n.isRead).length,
      expired: notifications.filter(n => n.expiresAt && n.expiresAt < new Date()).length,
      highPriority: notifications.filter(n => n.priority === NotificationPriority.HIGH).length,
      urgent: notifications.filter(n => n.priority === NotificationPriority.URGENT).length,
      byType: {} as Record<NotificationType, number>
    };

    // Count by type
    Object.values(NotificationType).forEach(type => {
      stats.byType[type] = notifications.filter(n => n.type === type).length;
    });

    return stats;
  }

  async createBulkNotifications(requests: CreateNotificationRequest[]): Promise<NotificationResponse[]> {
    const notifications = await this.db.client.notification.createMany({
      data: requests.map(request => ({
        userId: request.userId,
        type: request.type,
        title: request.title,
        message: request.message,
        priority: request.priority || NotificationPriority.MEDIUM,
        data: request.data || {},
        expiresAt: request.expiresAt
      }))
    });

    // Fetch created notifications to return full data
    const createdNotifications = await this.db.client.notification.findMany({
      where: {
        userId: { in: requests.map(r => r.userId) },
        title: { in: requests.map(r => r.title) },
        createdAt: { gte: new Date(Date.now() - 1000) } // Within last second
      }
    });

    return createdNotifications.map(notification => this.mapNotificationToResponse(notification));
  }

  async getNotificationsByType(userId: string, type: NotificationType, limit?: number): Promise<NotificationResponse[]> {
    const notifications = await this.db.client.notification.findMany({
      where: {
        userId,
        type,
        expiresAt: {
          or: [
            null,
            { gte: new Date() }
          ]
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit || 20
    });

    return notifications.map(notification => this.mapNotificationToResponse(notification));
  }

  async getHighPriorityNotifications(userId: string, limit?: number): Promise<NotificationResponse[]> {
    const notifications = await this.db.client.notification.findMany({
      where: {
        userId,
        priority: {
          in: [NotificationPriority.HIGH, NotificationPriority.URGENT]
        },
        isRead: false,
        expiresAt: {
          or: [
            null,
            { gte: new Date() }
          ]
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit || 10
    });

    return notifications.map(notification => this.mapNotificationToResponse(notification));
  }

  async cleanupOldNotifications(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db.client.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        isRead: true
      }
    });

    return result.count;
  }

  async searchNotifications(userId: string, query: string, filters?: NotificationFilters): Promise<NotificationResponse[]> {
    const whereClause: any = {
      userId,
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          message: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ]
    };

    // Apply additional filters
    if (filters?.type) whereClause.type = filters.type;
    if (filters?.priority) whereClause.priority = filters.priority;
    if (filters?.isRead !== undefined) whereClause.isRead = filters.isRead;

    const notifications = await this.db.client.notification.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 100 // Limit search results
    });

    return notifications.map(notification => this.mapNotificationToResponse(notification));
  }

  async getRecentNotifications(userId: string, hours: number = 24): Promise<NotificationResponse[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    const notifications = await this.db.client.notification.findMany({
      where: {
        userId,
        createdAt: {
          gte: cutoffDate
        },
        expiresAt: {
          or: [
            null,
            { gte: new Date() }
          ]
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return notifications.map(notification => this.mapNotificationToResponse(notification));
  }

  async updateNotificationPriority(
    notificationId: string, 
    userId: string, 
    newPriority: NotificationPriority
  ): Promise<NotificationResponse> {
    const notification = await this.db.client.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    const updatedNotification = await this.db.client.notification.update({
      where: { id: notificationId },
      data: { priority: newPriority }
    });

    return this.mapNotificationToResponse(updatedNotification);
  }

  async extendNotificationExpiry(
    notificationId: string, 
    userId: string, 
    newExpiryDate: Date
  ): Promise<NotificationResponse> {
    const notification = await this.db.client.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    const updatedNotification = await this.db.client.notification.update({
      where: { id: notificationId },
      data: { expiresAt: newExpiryDate }
    });

    return this.mapNotificationToResponse(updatedNotification);
  }

  private mapNotificationToResponse(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      isRead: notification.isRead,
      data: notification.data as Record<string, any> || undefined,
      expiresAt: notification.expiresAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt
    };
  }
}